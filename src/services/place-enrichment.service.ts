/**
 * Place Enrichment Service
 * Grupo Hormesis 2026
 *
 * Obtiene datos REALES del negocio desde Google Maps (Places API): fotos del local y de sus platos,
 * reseñas auténticas, horarios, tipos de negocio (restaurant, bar, lodging...), dirección y valoración.
 * Las fotos se suben a Cloudinary para que la URL pública nunca exponga la API key de Google.
 */
import { v2 as cloudinary } from 'cloudinary';

export interface PlaceReview {
  author: string;
  text: string;
  rating: number;
  photo?: string | null;
  relativeTime?: string;
}

export interface PlaceData {
  placeId: string;
  name?: string;
  address?: string;
  phone?: string;
  rating?: number;
  totalRatings?: number;
  types: string[];
  priceLevel?: number;
  photos: string[];
  reviews: PlaceReview[];
  openingHours: string[];
  summary?: string;
  fetchedAt: string;
}

const DETAIL_FIELDS = [
  'place_id', 'name', 'formatted_address', 'formatted_phone_number', 'rating', 'user_ratings_total',
  'types', 'photos', 'reviews', 'opening_hours', 'price_level', 'editorial_summary'
].join(',');

async function fetchJson(url: string, timeoutMs = 8000): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Convierte una photo_reference de Google en una URL pública permanente (Cloudinary) sin exponer la API key */
async function persistPlacePhoto(photoRef: string, apiKey: string, placeId: string, index: number): Promise<string | null> {
  const googleUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photo_reference=${encodeURIComponent(photoRef)}&key=${apiKey}`;

  // 1. Preferente: subir a Cloudinary (URL estable y optimizada)
  try {
    const result = await cloudinary.uploader.upload(googleUrl, {
      folder: 'hormesis/places',
      public_id: `${placeId}_${index}`.replace(/[^a-zA-Z0-9_-]/g, ''),
      overwrite: true,
      resource_type: 'image',
      transformation: [{ width: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }]
    });
    if (result?.secure_url) return result.secure_url;
  } catch (e) {
    // continuar con fallback
  }

  // 2. Fallback: resolver la redirección de Google hacia lh3.googleusercontent.com (sin API key en la URL)
  try {
    const res = await fetch(googleUrl, { redirect: 'manual' });
    const location = res.headers.get('location');
    if (location && location.startsWith('https://')) return location;
  } catch (e) {}

  return null;
}

export function mapGoogleTypesToNiche(types: string[] = []): string {
  const t = types.map(x => x.toLowerCase());
  if (t.some(x => ['lodging', 'hotel', 'resort_hotel', 'bed_and_breakfast', 'guest_house', 'campground', 'rv_park'].includes(x))) return 'hotel alojamiento';
  if (t.some(x => ['restaurant', 'food', 'meal_takeaway', 'meal_delivery', 'bar', 'cafe', 'bakery', 'night_club'].includes(x))) {
    if (t.includes('cafe') || t.includes('bakery')) return 'cafeteria restaurante';
    if (t.includes('bar') && !t.includes('restaurant')) return 'bar tapas restaurante';
    return 'restaurante gastronomia';
  }
  return '';
}

/**
 * Enriquecer un lead con datos reales de Google Maps.
 * Si ya fue enriquecido previamente (meta.placeData), lo reutiliza sin consumir cuota.
 */
export async function enrichLeadWithGooglePlace(
  lead: { businessName?: string | null; website?: string | null; phone?: string | null },
  meta: any,
  googleMapsKey: string | undefined,
  log: (msg: string) => void = () => {},
  locationHint?: string
): Promise<PlaceData | null> {
  if (meta?.placeData?.fetchedAt && Array.isArray(meta.placeData.photos)) {
    return meta.placeData as PlaceData;
  }
  if (!googleMapsKey) return null;

  let placeId: string | undefined = meta?.placeId;

  // 1. Localizar el negocio si no tenemos placeId guardado
  if (!placeId && lead.businessName) {
    const query = [lead.businessName, meta?.address || locationHint || ''].filter(Boolean).join(' ');
    const search = await fetchJson(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=es&key=${googleMapsKey}`);
    const candidates: any[] = search?.results || [];
    if (candidates.length) {
      const normName = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      const target = normName(lead.businessName);
      const best = candidates.find(c => {
        const n = normName(c.name || '');
        return n && (n.includes(target) || target.includes(n));
      }) || candidates[0];
      placeId = best?.place_id;
    }
  }

  if (!placeId) {
    log(`Aviso: No se localizó la ficha de Google Maps para "${lead.businessName}".`);
    return null;
  }

  // 2. Detalles completos del local
  const details = await fetchJson(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${DETAIL_FIELDS}&language=es&reviews_sort=most_relevant&key=${googleMapsKey}`);
  const r = details?.result;
  if (!r) {
    log(`Aviso: Google Maps no devolvió detalles para "${lead.businessName}" (${details?.status || 'sin respuesta'}).`);
    return null;
  }

  // 3. Fotos reales (máx. 7) persistidas en Cloudinary
  const photoRefs: string[] = (r.photos || []).slice(0, 7).map((p: any) => p.photo_reference).filter(Boolean);
  const photos: string[] = [];
  for (let i = 0; i < photoRefs.length; i++) {
    const url = await persistPlacePhoto(photoRefs[i], googleMapsKey, placeId, i);
    if (url) photos.push(url);
  }

  // 4. Reseñas reales positivas y con contenido
  const reviews: PlaceReview[] = (r.reviews || [])
    .filter((rv: any) => (rv.rating || 0) >= 4 && (rv.text || '').trim().length >= 40)
    .slice(0, 3)
    .map((rv: any) => ({
      author: rv.author_name || 'Cliente de Google',
      text: (rv.text || '').trim().replace(/\s+/g, ' ').slice(0, 320),
      rating: rv.rating || 5,
      photo: rv.profile_photo_url || null,
      relativeTime: rv.relative_time_description || ''
    }));

  const placeData: PlaceData = {
    placeId,
    name: r.name,
    address: r.formatted_address,
    phone: r.formatted_phone_number,
    rating: r.rating,
    totalRatings: r.user_ratings_total,
    types: r.types || [],
    priceLevel: r.price_level,
    photos,
    reviews,
    openingHours: r.opening_hours?.weekday_text || [],
    summary: r.editorial_summary?.overview,
    fetchedAt: new Date().toISOString()
  };

  log(`📍 Ficha real de Google Maps obtenida: ${photos.length} fotos del local, ${reviews.length} reseñas reales, tipos: ${placeData.types.slice(0, 4).join(', ')}.`);
  return placeData;
}

/** Extrae texto relevante de la web del negocio (título, descripción, encabezados y párrafos) para personalizar la propuesta */
export async function fetchWebsiteTextSnapshot(websiteUrl: string): Promise<string> {
  if (!websiteUrl || !websiteUrl.startsWith('http')) return '';
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    clearTimeout(t);
    if (!res.ok) return '';
    const html = await res.text();
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
    const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || '').trim();
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    return `TÍTULO: ${title}\nDESCRIPCIÓN: ${desc}\nTEXTO: ${body.slice(0, 3500)}`;
  } catch {
    return '';
  }
}

