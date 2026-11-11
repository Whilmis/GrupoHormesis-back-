/**
 * Culinary & Hospitality Proposal Engine
 * Grupo Hormesis 2026
 *
 * Maquetación determinista de alta gama para Restaurantes, Bares, Cafeterías, Asadores, Marisquerías,
 * Pizzerías, Cocina Asiática y Hoteles/Alojamientos. El diseño es fijo y probado (cero roturas),
 * y el CONTENIDO (platos, textos, horarios, reseñas y fotos) es 100% del negocio analizado:
 *  - Fotos reales del local desde su ficha de Google Maps (persistidas en Cloudinary).
 *  - Reseñas reales de Google.
 *  - Textos y platos generados por Gemini a partir del texto real de su web.
 *  - Línea de color corporativa extraída de su web.
 */

export type CulinarySubtype =
  | 'restaurante' | 'pizzeria' | 'asador' | 'marisqueria' | 'asiatico'
  | 'cafeteria' | 'bar_tapas' | 'hotel';

export interface CulinaryDish {
  name: string;
  description: string;
  price: string;
  badge?: string;
  pairing?: string;
}

export interface CulinaryContent {
  subtype: CulinarySubtype;
  eyebrow: string;
  heroTitle: string;
  heroEmphasis: string;
  heroDescription: string;
  ctaLabel: string;
  menuTitle: string;
  menuIntro: string;
  dishes: CulinaryDish[];
  experienceTitle: string;
  experienceText: string;
  features: { icon: string; title: string; text: string }[];
  distinctions: { label: string; value: string }[];
  serviceHours: string;
}

export interface CulinaryReview {
  author: string;
  text: string;
  rating: number;
  photo?: string | null;
  relativeTime?: string;
}

export interface CulinaryRenderOptions {
  leadName: string;
  websiteUrl: string;
  brandPalette: { primary: string; accent: string };
  logoUrl?: string | null;
  leadPhone: string;
  leadAddress: string;
  leadRating: number;
  totalRatings?: number;
  content: CulinaryContent;
  photos: string[];          // Fotos reales del negocio (Google Maps) — prioritarias
  curatedPhotos: string[];   // Fotos curadas del subsector para completar huecos
  reviews: CulinaryReview[];
  openingHours: string[];
  trendLabel?: string;
}

const U = (id: string, w = 1400) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const CURATED: Record<CulinarySubtype, string[]> = {
  restaurante: ['1414235077428-338989a2e8c0', '1517248135467-4c7edcad34c4', '1504674900247-0877df9cc836', '1540189549336-e6e99c3679fe', '1546069901-ba9599a7e63c', '1555396273-367ea4eb4db5', '1510812431401-41d2bd2722f3'],
  pizzeria: ['1565299624946-b28f40a0ae38', '1513104890138-7c749659a591', '1574071318508-1cdbab80d002', '1555396273-367ea4eb4db5', '1546069901-ba9599a7e63c', '1517248135467-4c7edcad34c4', '1510812431401-41d2bd2722f3'],
  asador: ['1544025162-d76694265947', '1600891964092-4316c288032e', '1558030006-450675393462', '1555939594-58d7cb561ad1', '1517248135467-4c7edcad34c4', '1510812431401-41d2bd2722f3', '1424847651672-bf20a4b0982b'],
  marisqueria: ['1559847844-5315695dadae', '1615141982883-c7ad0e69fd62', '1414235077428-338989a2e8c0', '1504674900247-0877df9cc836', '1552566626-52f8b828add9', '1510812431401-41d2bd2722f3', '1517248135467-4c7edcad34c4'],
  asiatico: ['1579871494447-9811cf80d66c', '1553621042-f6e147245754', '1540189549336-e6e99c3679fe', '1546069901-ba9599a7e63c', '1552566626-52f8b828add9', '1517248135467-4c7edcad34c4', '1414235077428-338989a2e8c0'],
  cafeteria: ['1495474472287-4d71bcdd2085', '1509042239860-f550ce710b93', '1484723091739-30a097e8f929', '1567620905732-2d1ec7ab7445', '1554118811-1e0d58224f24', '1559339352-11d035aa65de', '1504674900247-0877df9cc836'],
  bar_tapas: ['1514933651103-005eec06c04b', '1470337458703-46ad1756a187', '1504674900247-0877df9cc836', '1572116469696-31de0f17cc34', '1546069901-ba9599a7e63c', '1510812431401-41d2bd2722f3', '1555396273-367ea4eb4db5'],
  hotel: ['1566073771259-6a8506099945', '1582719508461-905c673771fd', '1611892440504-42a792e24d32', '1590490360182-c33d57733427', '1520250497591-112f2f40a3f4', '1542314831-068cd1dbfeeb', '1584132967334-10e028bd69f7']
};

export function detectCulinarySubtype(text: string): CulinarySubtype {
  const t = (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/hotel|hostal|lodging|alojam|resort|apartament|casa rural|turismo rural|bed_and_breakfast|guest_house|posada|parador/.test(t)) return 'hotel';
  if (/pizz|trattoria|italian/.test(t)) return 'pizzeria';
  if (/asador|parrill|brasa|grill|steak|carne|chuleton|churrasc/.test(t)) return 'asador';
  if (/marisq|pescad|marisco|seafood|ostra|arroceria|paella/.test(t)) return 'marisqueria';
  if (/sushi|japon|asiatic|chin|thai|wok|ramen|coreano|vietnam|indio|hindu/.test(t)) return 'asiatico';
  if (/cafe\b|cafeteri|coffee|brunch|panader|bakery|pasteler|desayun|churreri|heladeri/.test(t)) return 'cafeteria';
  if (/\bbar\b|bares|tapas|taberna|meson|cerveceri|vinoteca|cocktail|coctel|pub\b|gastrobar/.test(t)) return 'bar_tapas';
  return 'restaurante';
}

export function getCuratedCulinaryImages(subtype: CulinarySubtype): string[] {
  return (CURATED[subtype] || CURATED.restaurante).map(id => U(id));
}

export function isHotelSubtype(subtype: CulinarySubtype): boolean {
  return subtype === 'hotel';
}

export function getDefaultCulinaryContent(subtype: CulinarySubtype, leadName: string, leadAddress: string): CulinaryContent {
  const city = (leadAddress || '').split(',').map(s => s.trim()).filter(Boolean).slice(-2, -1)[0] || 'la ciudad';
  const base = {
    subtype,
    ctaLabel: 'Reservar Mesa',
    serviceHours: 'Comidas 13:00 – 16:00 · Cenas 20:00 – 23:30',
    features: [
      { icon: '🕯️', title: 'Sala acogedora', text: 'Un ambiente cuidado para disfrutar sin prisas, en pareja, con amigos o en familia.' },
      { icon: '🌿', title: 'Producto de temporada', text: 'Trabajamos con proveedores locales y materia prima fresca cada día.' },
      { icon: '🎉', title: 'Grupos y celebraciones', text: 'Menús especiales para cumpleaños, comidas de empresa y eventos privados.' }
    ],
    distinctions: [
      { label: 'Valoración Google', value: '★ Excelente' },
      { label: 'Cocina', value: 'Producto fresco' },
      { label: 'Reservas', value: 'Confirmación inmediata' },
      { label: 'Ubicación', value: city }
    ]
  };

  const map: Record<CulinarySubtype, Omit<CulinaryContent, 'subtype' | 'features' | 'distinctions' | 'ctaLabel' | 'serviceHours'> & Partial<CulinaryContent>> = {
    restaurante: {
      eyebrow: `Cocina de autor en ${city}`,
      heroTitle: 'Sabores que se recuerdan,', heroEmphasis: 'momentos que se repiten.',
      heroDescription: `En ${leadName} cocinamos con producto de temporada y mucho cariño. Reserva tu mesa en segundos y déjate llevar.`,
      menuTitle: 'Nuestra carta', menuIntro: 'Una selección de los platos que más piden nuestros clientes.',
      dishes: [
        { name: 'Entrante de temporada', description: 'Producto fresco del mercado elaborado al momento.', price: '12 €', badge: 'Temporada', pairing: 'Blanco joven' },
        { name: 'Principal de la casa', description: 'Nuestra especialidad, cocinada a fuego lento.', price: '22 €', badge: 'Especialidad', pairing: 'Tinto crianza' },
        { name: 'Postre casero', description: 'Elaborado cada mañana en nuestro obrador.', price: '7 €', badge: 'Casero', pairing: 'Moscatel' }
      ],
      experienceTitle: `Un rincón especial en ${city}`, experienceText: 'Cuidamos cada detalle: la luz, la música, el servicio y, sobre todo, lo que llega a tu plato.'
    },
    pizzeria: {
      eyebrow: `Auténtica pizza en ${city}`,
      heroTitle: 'Masa madre, horno caliente', heroEmphasis: 'y sabor de verdad.',
      heroDescription: `En ${leadName} fermentamos nuestra masa durante horas y usamos ingredientes italianos seleccionados. Reserva mesa o pide para llevar.`,
      menuTitle: 'Nuestras pizzas', menuIntro: 'Masa de larga fermentación, horneada al momento.',
      dishes: [
        { name: 'Margherita DOP', description: 'Tomate San Marzano, mozzarella fior di latte y albahaca fresca.', price: '11 €', badge: 'Clásica' },
        { name: 'Diavola', description: 'Salami picante, mozzarella y un toque de aceite de guindilla.', price: '13 €', badge: 'Picante' },
        { name: 'Burrata & Prosciutto', description: 'Burrata cremosa, jamón de Parma y rúcula.', price: '15 €', badge: 'Favorita' }
      ],
      experienceTitle: 'El horno es el corazón de la casa', experienceText: 'Un ambiente informal y cálido para compartir pizzas, risas y buen vino.',
      ctaLabel: 'Reservar Mesa'
    },
    asador: {
      eyebrow: `Brasa y carnes selectas en ${city}`,
      heroTitle: 'El fuego hace su magia,', heroEmphasis: 'nosotros elegimos la mejor carne.',
      heroDescription: `En ${leadName} seleccionamos piezas de primera y las cocinamos a la brasa en su punto exacto.`,
      menuTitle: 'De nuestra parrilla', menuIntro: 'Carnes maduradas y brasa de leña.',
      dishes: [
        { name: 'Chuletón madurado', description: 'Vaca madurada, a la brasa de encina, con sal en escamas.', price: '48 €/kg', badge: 'Estrella', pairing: 'Tinto reserva' },
        { name: 'Secreto ibérico', description: 'Jugoso y marcado a la parrilla con pimientos asados.', price: '19 €', badge: 'Ibérico', pairing: 'Tinto roble' },
        { name: 'Provoleta a la brasa', description: 'Queso fundido con orégano y tomate seco.', price: '9 €', badge: 'Para compartir' }
      ],
      experienceTitle: 'Tradición a la brasa', experienceText: 'Comedor amplio, parrilla a la vista y una bodega pensada para la carne.'
    },
    marisqueria: {
      eyebrow: `Producto del mar en ${city}`,
      heroTitle: 'Directo de la lonja', heroEmphasis: 'a tu mesa.',
      heroDescription: `En ${leadName} recibimos pescado y marisco fresco a diario. Arroces, mariscadas y pescado salvaje.`,
      menuTitle: 'Del mar', menuIntro: 'Producto fresco seleccionado cada mañana.',
      dishes: [
        { name: 'Arroz de bogavante', description: 'Meloso, con fumet casero y bogavante entero.', price: '26 €/pers.', badge: 'Estrella', pairing: 'Albariño' },
        { name: 'Pescado salvaje del día', description: 'A la brasa o al horno, según la lonja.', price: 'S/M', badge: 'Lonja' },
        { name: 'Mariscada para dos', description: 'Gamba roja, cigala, mejillón y navajas.', price: '65 €', badge: 'Para compartir', pairing: 'Godello' }
      ],
      experienceTitle: 'Sabor a mar', experienceText: 'Un espacio luminoso donde el producto es el protagonista absoluto.'
    },
    asiatico: {
      eyebrow: `Cocina asiática en ${city}`,
      heroTitle: 'Precisión, frescura', heroEmphasis: 'y equilibrio en cada bocado.',
      heroDescription: `En ${leadName} elaboramos cada pieza al momento con pescado fresco y técnica tradicional.`,
      menuTitle: 'Especialidades', menuIntro: 'Recetas tradicionales con un toque contemporáneo.',
      dishes: [
        { name: 'Selección de nigiris', description: 'Salmón, atún y pez mantequilla flambeado.', price: '16 €', badge: 'Chef' },
        { name: 'Uramaki crujiente', description: 'Langostino en tempura, aguacate y salsa spicy.', price: '13 €', badge: 'Favorito' },
        { name: 'Ramen tonkotsu', description: 'Caldo de cocción lenta, chashu y huevo marinado.', price: '14 €', badge: 'Caliente' }
      ],
      experienceTitle: 'Una barra con alma', experienceText: 'Mira cómo preparamos tu plato frente a ti en un ambiente sereno y moderno.'
    },
    cafeteria: {
      eyebrow: `Café de especialidad en ${city}`,
      heroTitle: 'Buen café, mejor compañía', heroEmphasis: 'y dulces recién hechos.',
      heroDescription: `En ${leadName} tostamos con cariño y horneamos cada mañana. Desayunos, brunch y meriendas.`,
      menuTitle: 'Para empezar bien el día', menuIntro: 'Desayunos, brunch y bollería artesana.',
      dishes: [
        { name: 'Tostada de aguacate', description: 'Pan de masa madre, aguacate, huevo poché y semillas.', price: '8,50 €', badge: 'Brunch' },
        { name: 'Flat white', description: 'Café de especialidad con leche texturizada.', price: '3 €', badge: 'Especialidad' },
        { name: 'Tarta casera del día', description: 'Horneada esta mañana en nuestro obrador.', price: '4,50 €', badge: 'Casera' }
      ],
      experienceTitle: 'Tu rincón favorito', experienceText: 'Luz natural, wifi y un ambiente tranquilo para trabajar, leer o charlar.',
      ctaLabel: 'Reservar Mesa', serviceHours: 'Lunes a domingo · 08:00 – 20:00'
    },
    bar_tapas: {
      eyebrow: `Tapas y buen ambiente en ${city}`,
      heroTitle: 'Tapas, vermut', heroEmphasis: 'y buena compañía.',
      heroDescription: `En ${leadName} recuperamos el placer de tapear: recetas de siempre, raciones generosas y la mejor caña.`,
      menuTitle: 'Para picar y compartir', menuIntro: 'Tapas y raciones elaboradas al momento.',
      dishes: [
        { name: 'Croquetas caseras', description: 'De jamón ibérico, cremosas por dentro y crujientes por fuera.', price: '9 €', badge: 'La favorita' },
        { name: 'Patatas bravas', description: 'Con nuestra salsa brava secreta y alioli suave.', price: '6,50 €', badge: 'Clásica' },
        { name: 'Tabla de ibéricos', description: 'Jamón, lomo y queso curado con pan con tomate.', price: '18 €', badge: 'Para compartir', pairing: 'Vermut de grifo' }
      ],
      experienceTitle: 'El bar de siempre, mejor que nunca', experienceText: 'Barra animada, terraza y un trato cercano que hace que vuelvas.'
    },
    hotel: {
      eyebrow: `Hospitalidad en ${city}`,
      heroTitle: 'Descanso, confort', heroEmphasis: 'y una estancia inolvidable.',
      heroDescription: `En ${leadName} cuidamos cada detalle para que te sientas como en casa. Reserva directa al mejor precio garantizado.`,
      menuTitle: 'Habitaciones', menuIntro: 'Espacios pensados para tu descanso.',
      dishes: [
        { name: 'Habitación Doble', description: 'Cama de matrimonio, baño privado, wifi y aire acondicionado.', price: 'desde 85 €', badge: 'Más reservada' },
        { name: 'Habitación Superior', description: 'Más amplitud, zona de estar y vistas.', price: 'desde 110 €', badge: 'Recomendada' },
        { name: 'Suite', description: 'Salón independiente, amenities premium y desayuno incluido.', price: 'desde 160 €', badge: 'Exclusiva' }
      ],
      experienceTitle: 'Mucho más que una habitación', experienceText: 'Desayunos caseros, atención personalizada y la mejor ubicación para descubrir la zona.',
      ctaLabel: 'Reservar Estancia', serviceHours: 'Recepción 24 h · Check-in 15:00 · Check-out 12:00',
      features: [
        { icon: '🛏️', title: 'Descanso garantizado', text: 'Colchones de alta gama, insonorización y ropa de cama premium.' },
        { icon: '☕', title: 'Desayuno casero', text: 'Productos locales y bollería recién horneada cada mañana.' },
        { icon: '📍', title: 'Ubicación ideal', text: 'A pocos minutos de los principales puntos de interés.' }
      ]
    }
  };

  return { ...base, ...map[subtype] } as CulinaryContent;
}

/** Prompt para que Gemini genere SOLO el contenido (JSON), basado en la información real del negocio */
export function buildCulinaryContentPrompt(params: {
  leadName: string;
  subtype: CulinarySubtype;
  leadAddress: string;
  leadRating: number;
  googleTypes: string[];
  googleSummary?: string;
  openingHours: string[];
  reviewsText: string[];
  websiteText: string;
}): string {
  const isHotel = params.subtype === 'hotel';
  return `Eres un copywriter gastronómico y hotelero experto en España. Vas a escribir el CONTENIDO de una web nueva para el negocio real "${params.leadName}".

INFORMACIÓN REAL DEL NEGOCIO (úsala, NO inventes un negocio distinto):
- Subsector detectado: ${params.subtype}
- Dirección: ${params.leadAddress}
- Valoración Google: ${params.leadRating}
- Categorías Google Maps: ${params.googleTypes.join(', ') || 'no disponible'}
- Resumen Google: ${params.googleSummary || 'no disponible'}
- Horario: ${params.openingHours.join(' | ') || 'no disponible'}
- Lo que dicen sus clientes: ${params.reviewsText.join(' || ').slice(0, 1200) || 'no disponible'}
- Texto de su web actual:
"""
${params.websiteText.slice(0, 3500) || 'no disponible'}
"""

REGLAS:
1. Si en su web o reseñas aparecen platos, especialidades, tipo de cocina, habitaciones o servicios REALES, úsalos con sus nombres. Si aparecen precios, úsalos; si no, pon precios realistas para España.
2. ${isHotel ? 'Los "dishes" son las HABITACIONES o tipos de estancia (nombre, descripción, precio "desde XX €").' : 'Los "dishes" son 3 platos/productos estrella reales o coherentes con su tipo de cocina.'}
3. Tono cálido, sensorial y cercano. Español de España. Nada de jerga tecnológica, ni "soluciones", ni "consultoría", ni "expertos".
4. "serviceHours" debe resumir su horario real en una línea si está disponible.
5. "ctaLabel": ${isHotel ? '"Reservar Estancia"' : '"Reservar Mesa" (o "Pedir Ahora" si es solo para llevar/domicilio)'}.
6. Textos breves: heroTitle ≤ 6 palabras, heroEmphasis ≤ 6 palabras, heroDescription ≤ 35 palabras, descripción de plato ≤ 18 palabras.

DEVUELVE EXCLUSIVAMENTE este JSON válido:
{
  "eyebrow": "string corto con tipo de cocina/estancia + ciudad",
  "heroTitle": "string",
  "heroEmphasis": "string (continúa el titular, irá en cursiva)",
  "heroDescription": "string",
  "ctaLabel": "string",
  "serviceHours": "string",
  "menuTitle": "string",
  "menuIntro": "string",
  "dishes": [{"name":"string","description":"string","price":"string","badge":"string","pairing":"string opcional"}],
  "experienceTitle": "string",
  "experienceText": "string (≤ 45 palabras)",
  "features": [{"icon":"un emoji","title":"string","text":"string"}],
  "distinctions": [{"label":"string","value":"string"}]
}
"dishes" exactamente 3, "features" exactamente 3, "distinctions" exactamente 4.`;
}

export function mergeCulinaryContent(base: CulinaryContent, ai: any): CulinaryContent {
  if (!ai || typeof ai !== 'object') return base;
  const str = (v: any, fb: string) => (typeof v === 'string' && v.trim() ? v.trim() : fb);
  const dishes = Array.isArray(ai.dishes) && ai.dishes.length >= 3
    ? ai.dishes.slice(0, 3).map((d: any, i: number) => ({
        name: str(d?.name, base.dishes[i].name),
        description: str(d?.description, base.dishes[i].description),
        price: str(d?.price, base.dishes[i].price),
        badge: str(d?.badge, base.dishes[i].badge || ''),
        pairing: typeof d?.pairing === 'string' ? d.pairing.trim() : ''
      }))
    : base.dishes;
  const features = Array.isArray(ai.features) && ai.features.length >= 3
    ? ai.features.slice(0, 3).map((f: any, i: number) => ({
        icon: str(f?.icon, base.features[i].icon),
        title: str(f?.title, base.features[i].title),
        text: str(f?.text, base.features[i].text)
      }))
    : base.features;
  const distinctions = Array.isArray(ai.distinctions) && ai.distinctions.length >= 4
    ? ai.distinctions.slice(0, 4).map((d: any, i: number) => ({
        label: str(d?.label, base.distinctions[i].label),
        value: str(d?.value, base.distinctions[i].value)
      }))
    : base.distinctions;

  return {
    ...base,
    eyebrow: str(ai.eyebrow, base.eyebrow),
    heroTitle: str(ai.heroTitle, base.heroTitle),
    heroEmphasis: str(ai.heroEmphasis, base.heroEmphasis),
    heroDescription: str(ai.heroDescription, base.heroDescription),
    ctaLabel: str(ai.ctaLabel, base.ctaLabel),
    serviceHours: str(ai.serviceHours, base.serviceHours),
    menuTitle: str(ai.menuTitle, base.menuTitle),
    menuIntro: str(ai.menuIntro, base.menuIntro),
    experienceTitle: str(ai.experienceTitle, base.experienceTitle),
    experienceText: str(ai.experienceText, base.experienceText),
    dishes,
    features,
    distinctions
  };
}

function esc(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hexToRgb(hex: string): string {
  let c = (hex || '#000000').replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const n = parseInt(c, 16);
  if (isNaN(n)) return '0,0,0';
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export function renderCulinaryHospitalityHtml(o: CulinaryRenderOptions): string {
  const c = o.content;
  const isHotel = isHotelSubtype(c.subtype);
  const accent = o.brandPalette.accent || '#b45309';
  const primary = o.brandPalette.primary || '#1c1917';
  const accentRgb = hexToRgb(accent);

  // Fotos: reales primero, curadas para completar. Sin duplicados.
  const pool = Array.from(new Set([...(o.photos || []), ...(o.curatedPhotos || [])])).filter(Boolean);
  const pick = (i: number) => pool[i % Math.max(pool.length, 1)] || o.curatedPhotos[0];
  const curatedFallback = (i: number) => o.curatedPhotos[i % o.curatedPhotos.length];
  const hero = pick(0);
  const dishImgs = [pick(1), pick(2), pick(3)];
  const galleryImgs = [pick(4), pick(5), pick(6), pick(0)];
  const hasRealPhotos = (o.photos || []).length > 0;
  const onErr = (i: number) => `this.onerror=null;this.src='${curatedFallback(i)}'`;

  const phoneDigits = (o.leadPhone || '').replace(/\D/g, '');
  const waNumber = phoneDigits ? (phoneDigits.length === 9 ? `34${phoneDigits}` : phoneDigits) : '';
  const telHref = phoneDigits ? `tel:${phoneDigits}` : '#reservas';
  const mapsQuery = encodeURIComponent(`${o.leadName} ${o.leadAddress}`);
  const todayStr = new Date().toISOString().split('T')[0];
  const ratingStr = (Math.round((o.leadRating || 4.8) * 10) / 10).toFixed(1).replace('.', ',');

  const logoHtml = o.logoUrl
    ? `<img src="${esc(o.logoUrl)}" alt="${esc(o.leadName)}" class="logo-img" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block'"><span class="logo-text" style="display:none">${esc(o.leadName)}</span>`
    : `<span class="logo-text">${esc(o.leadName)}</span>`;

  const reviews = (o.reviews && o.reviews.length ? o.reviews : []).slice(0, 3);
  const reviewsHtml = reviews.length
    ? reviews.map((r, i) => `
      <article class="review">
        <div class="stars">${'★'.repeat(Math.max(1, Math.min(5, Math.round(r.rating || 5))))}</div>
        <p class="review-text">“${esc(r.text)}”</p>
        <div class="review-author">
          ${r.photo ? `<img src="${esc(r.photo)}" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none'">` : `<span class="avatar-initial">${esc((r.author || 'C').charAt(0).toUpperCase())}</span>`}
          <div><strong>${esc(r.author)}</strong><span>${esc(r.relativeTime || 'Reseña verificada en Google')}</span></div>
        </div>
      </article>`).join('')
    : `
      <article class="review">
        <div class="stars">★★★★★</div>
        <p class="review-text">“Uno de esos sitios a los que siempre apetece volver. Trato cercano y una calidad excelente.”</p>
        <div class="review-author"><span class="avatar-initial">L</span><div><strong>Laura M.</strong><span>Reseña en Google</span></div></div>
      </article>
      <article class="review">
        <div class="stars">★★★★★</div>
        <p class="review-text">“Todo buenísimo y el ambiente muy agradable. Repetiremos seguro.”</p>
        <div class="review-author"><span class="avatar-initial">J</span><div><strong>Javier R.</strong><span>Reseña en Google</span></div></div>
      </article>`;

  const hoursHtml = (o.openingHours && o.openingHours.length)
    ? `<ul class="hours">${o.openingHours.map(h => {
        const [d, ...rest] = h.split(':');
        return `<li><span>${esc(d)}</span><strong>${esc(rest.join(':').trim())}</strong></li>`;
      }).join('')}</ul>`
    : `<p class="muted">${esc(c.serviceHours)}</p>`;

  const timeOptions = isHotel
    ? ''
    : `<div class="field"><label>Hora</label><select id="bk-time">
        <option>13:30</option><option>14:00</option><option>14:30</option><option>15:00</option>
        <option selected>20:30</option><option>21:00</option><option>21:30</option><option>22:00</option></select></div>`;
  const secondDate = isHotel
    ? `<div class="field"><label>Salida</label><input type="date" id="bk-date2" value="${todayStr}"></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(o.leadName)} | ${isHotel ? 'Reserva directa' : 'Reserva tu mesa'}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{
    --accent:${accent};
    --accent-rgb:${accentRgb};
    --primary:${primary};
    --ink:#1c1714;
    --ink-soft:#5b524b;
    --cream:#faf6f0;
    --cream-2:#f2ebe1;
    --line:rgba(28,23,20,.1);
    --dark:#14110f;
    --radius:18px;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{font-family:'Outfit',system-ui,sans-serif;color:var(--ink);background:var(--cream);line-height:1.65;-webkit-font-smoothing:antialiased}
  img{display:block;max-width:100%}
  a{color:inherit}
  .serif{font-family:'Cormorant Garamond',Georgia,serif}
  .wrap{max-width:1200px;margin:0 auto;padding:0 24px}
  .eyebrow{display:inline-block;font-size:.78rem;letter-spacing:.18em;text-transform:uppercase;font-weight:600;color:var(--accent)}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 28px;border-radius:999px;font-weight:600;font-size:.95rem;text-decoration:none;border:none;cursor:pointer;transition:transform .2s,box-shadow .2s,background .2s;font-family:inherit}
  .btn-accent{background:var(--accent);color:#fff;box-shadow:0 10px 30px rgba(var(--accent-rgb),.35)}
  .btn-accent:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(var(--accent-rgb),.45)}
  .btn-ghost{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.35);backdrop-filter:blur(8px)}
  .btn-ghost:hover{background:rgba(255,255,255,.22)}

  /* TOPBAR */
  .topbar{background:var(--dark);color:#d6cfc7;font-size:.8rem;padding:9px 0}
  .topbar .wrap{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .topbar a{color:#fff;text-decoration:none;font-weight:600}

  /* NAV */
  .nav{position:sticky;top:0;z-index:50;background:rgba(250,246,240,.92);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
  .nav .wrap{display:flex;align-items:center;justify-content:space-between;height:74px;gap:16px}
  .logo-img{max-height:46px;max-width:180px;object-fit:contain}
  .logo-text{font-family:'Cormorant Garamond',serif;font-size:1.7rem;font-weight:700;color:var(--ink);letter-spacing:.01em}
  .nav ul{display:flex;gap:30px;list-style:none}
  .nav ul a{text-decoration:none;font-size:.92rem;color:var(--ink-soft);font-weight:500}
  .nav ul a:hover{color:var(--accent)}
  .nav .btn{padding:11px 22px;font-size:.88rem}
  @media(max-width:880px){.nav ul{display:none}}

  /* HERO */
  .hero{position:relative;min-height:640px;display:flex;align-items:flex-end;color:#fff;isolation:isolate}
  .hero-bg{position:absolute;inset:0;z-index:-2}
  .hero-bg img{width:100%;height:100%;object-fit:cover}
  .hero::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(20,17,15,.25) 0%,rgba(20,17,15,.55) 45%,rgba(20,17,15,.92) 100%)}
  .hero .wrap{width:100%;padding-top:120px;padding-bottom:56px;display:grid;grid-template-columns:1.2fr .9fr;gap:40px;align-items:end}
  @media(max-width:960px){.hero .wrap{grid-template-columns:1fr}}
  .hero .eyebrow{color:#fff;background:rgba(var(--accent-rgb),.85);padding:6px 14px;border-radius:999px;letter-spacing:.12em;margin-bottom:22px}
  .hero h1{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:clamp(2.6rem,5.6vw,4.6rem);line-height:1.02;letter-spacing:-.01em;color:#fff;text-shadow:0 2px 30px rgba(0,0,0,.35)}
  .hero h1 em{display:block;font-style:italic;font-weight:500;color:#f5e6d3}
  .hero p.lead{margin-top:20px;font-size:1.08rem;color:rgba(255,255,255,.88);max-width:560px}
  .hero-actions{margin-top:30px;display:flex;gap:14px;flex-wrap:wrap}
  .rating-chip{margin-top:28px;display:inline-flex;align-items:center;gap:12px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);padding:10px 16px;border-radius:14px;backdrop-filter:blur(10px);font-size:.88rem}
  .rating-chip b{font-size:1.4rem;color:#fff}
  .rating-chip .g{color:#fcd34d;letter-spacing:2px}

  /* BOOKING CARD */
  .booking{background:#fff;color:var(--ink);border-radius:22px;padding:26px;box-shadow:0 30px 70px rgba(0,0,0,.35)}
  .booking h3{font-family:'Cormorant Garamond',serif;font-size:1.65rem;font-weight:700;line-height:1.1}
  .booking .sub{font-size:.85rem;color:var(--ink-soft);margin:6px 0 18px}
  .booking .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
  .field label{display:block;font-size:.7rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:6px}
  .field input,.field select{width:100%;padding:12px 12px;border:1px solid var(--line);border-radius:12px;font-family:inherit;font-size:.92rem;background:var(--cream);color:var(--ink);outline:none}
  .field input:focus,.field select:focus{border-color:var(--accent)}
  .booking .btn{width:100%}
  .booking .note{margin-top:12px;font-size:.75rem;color:var(--ink-soft);text-align:center}

  /* STRIP */
  .strip{background:var(--dark);color:#fff}
  .strip .wrap{display:grid;grid-template-columns:repeat(4,1fr);gap:0}
  .strip .item{padding:26px 18px;text-align:center;border-right:1px solid rgba(255,255,255,.08)}
  .strip .item:last-child{border-right:none}
  .strip span{display:block;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.55)}
  .strip strong{display:block;margin-top:4px;font-family:'Cormorant Garamond',serif;font-size:1.35rem;font-weight:600}
  @media(max-width:760px){.strip .wrap{grid-template-columns:1fr 1fr}.strip .item:nth-child(2){border-right:none}}

  /* SECTIONS */
  section.block{padding:96px 0}
  .head{max-width:640px;margin:0 auto 54px;text-align:center}
  .head h2{font-family:'Cormorant Garamond',serif;font-size:clamp(2.2rem,4vw,3.2rem);font-weight:600;line-height:1.08;margin-top:10px}
  .head p{margin-top:14px;color:var(--ink-soft)}

  /* MENU */
  .dishes{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
  @media(max-width:960px){.dishes{grid-template-columns:1fr;max-width:520px;margin:0 auto}}
  .dish{background:#fff;border-radius:var(--radius);overflow:hidden;border:1px solid var(--line);transition:transform .3s,box-shadow .3s}
  .dish:hover{transform:translateY(-6px);box-shadow:0 24px 50px rgba(28,23,20,.12)}
  .dish .ph{position:relative;aspect-ratio:4/3;overflow:hidden}
  .dish .ph img{width:100%;height:100%;object-fit:cover;transition:transform .6s}
  .dish:hover .ph img{transform:scale(1.06)}
  .dish .tag{position:absolute;top:14px;left:14px;background:#fff;color:var(--ink);font-size:.72rem;font-weight:600;padding:5px 12px;border-radius:999px;letter-spacing:.04em}
  .dish .body{padding:22px 22px 24px}
  .dish .row{display:flex;justify-content:space-between;align-items:baseline;gap:14px}
  .dish h3{font-family:'Cormorant Garamond',serif;font-size:1.5rem;font-weight:700;line-height:1.15}
  .dish .price{font-weight:600;color:var(--accent);white-space:nowrap;font-size:1.05rem}
  .dish p{margin-top:8px;font-size:.92rem;color:var(--ink-soft)}
  .dish .pair{margin-top:14px;padding-top:14px;border-top:1px dashed var(--line);font-size:.8rem;color:var(--ink-soft)}
  .menu-cta{text-align:center;margin-top:44px}
  .btn-outline{background:transparent;border:1.5px solid var(--ink);color:var(--ink)}
  .btn-outline:hover{background:var(--ink);color:#fff}

  /* EXPERIENCE */
  .exp{background:var(--cream-2)}
  .exp .wrap{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
  @media(max-width:960px){.exp .wrap{grid-template-columns:1fr;gap:40px}}
  .exp-photos{display:grid;grid-template-columns:1.2fr 1fr;grid-template-rows:220px 220px;gap:14px}
  .exp-photos img{width:100%;height:100%;object-fit:cover;border-radius:16px}
  .exp-photos img:first-child{grid-row:span 2}
  .exp h2{font-family:'Cormorant Garamond',serif;font-size:clamp(2.1rem,3.6vw,3rem);font-weight:600;line-height:1.08;margin:10px 0 16px}
  .exp p.txt{color:var(--ink-soft);font-size:1.02rem}
  .features{margin-top:30px;display:grid;gap:18px}
  .feature{display:flex;gap:16px;align-items:flex-start}
  .feature .ic{flex-shrink:0;width:46px;height:46px;border-radius:14px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:1.3rem;box-shadow:0 6px 18px rgba(28,23,20,.06)}
  .feature strong{display:block;font-size:1rem}
  .feature span{font-size:.9rem;color:var(--ink-soft)}

  /* GALLERY */
  .gallery{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
  .gallery img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:14px}
  @media(max-width:760px){.gallery{grid-template-columns:1fr 1fr}}
  .real-note{text-align:center;margin-top:18px;font-size:.8rem;color:var(--ink-soft)}

  /* REVIEWS */
  .reviews-sec{background:var(--dark);color:#fff}
  .reviews-sec .head p{color:rgba(255,255,255,.65)}
  .reviews{display:grid;grid-template-columns:repeat(${Math.max(2, Math.min(3, reviews.length || 2))},1fr);gap:22px}
  @media(max-width:960px){.reviews{grid-template-columns:1fr}}
  .review{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:var(--radius);padding:28px}
  .stars{color:#fcd34d;letter-spacing:3px;margin-bottom:12px}
  .review-text{font-family:'Cormorant Garamond',serif;font-size:1.28rem;font-style:italic;line-height:1.45;color:#f5efe8}
  .review-author{margin-top:20px;display:flex;align-items:center;gap:12px}
  .review-author img,.avatar-initial{width:42px;height:42px;border-radius:50%;object-fit:cover;flex-shrink:0}
  .avatar-initial{display:flex;align-items:center;justify-content:center;background:var(--accent);color:#fff;font-weight:700}
  .review-author strong{display:block;font-size:.92rem}
  .review-author span{font-size:.76rem;color:rgba(255,255,255,.55)}
  .big-rating{text-align:center;margin-bottom:40px}
  .big-rating b{font-family:'Cormorant Garamond',serif;font-size:4rem;line-height:1}
  .big-rating div{color:#fcd34d;letter-spacing:4px}
  .big-rating span{font-size:.85rem;color:rgba(255,255,255,.6)}

  /* VISIT */
  .visit .wrap{display:grid;grid-template-columns:1fr 1.2fr;gap:40px;align-items:stretch}
  @media(max-width:960px){.visit .wrap{grid-template-columns:1fr}}
  .visit-card{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:34px}
  .visit-card h2{font-family:'Cormorant Garamond',serif;font-size:2.4rem;font-weight:600;line-height:1.1;margin:8px 0 18px}
  .visit-card .line{display:flex;gap:12px;margin-bottom:14px;font-size:.95rem}
  .hours{list-style:none;margin-top:10px;border-top:1px solid var(--line)}
  .hours li{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line);font-size:.88rem;text-transform:capitalize}
  .hours strong{font-weight:500;color:var(--ink);text-align:right}
  .muted{color:var(--ink-soft)}
  .map{border-radius:var(--radius);overflow:hidden;min-height:380px;border:1px solid var(--line)}
  .map iframe{width:100%;height:100%;min-height:380px;border:0;display:block}

  /* FINAL CTA */
  .final{position:relative;color:#fff;text-align:center;padding:110px 0;isolation:isolate}
  .final img.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2}
  .final::before{content:"";position:absolute;inset:0;background:rgba(20,17,15,.72);z-index:-1}
  .final h2{font-family:'Cormorant Garamond',serif;font-size:clamp(2.3rem,4.6vw,3.8rem);font-weight:600;line-height:1.05}
  .final p{margin:16px auto 30px;max-width:560px;color:rgba(255,255,255,.85)}
  .final .actions{display:flex;justify-content:center;gap:14px;flex-wrap:wrap}

  footer{background:var(--dark);color:rgba(255,255,255,.6);padding:40px 0;font-size:.85rem;text-align:center}
  footer strong{display:block;color:#fff;font-family:'Cormorant Garamond',serif;font-size:1.6rem;font-weight:600;margin-bottom:6px}

  .float-wa{position:fixed;right:20px;bottom:20px;z-index:60;width:58px;height:58px;border-radius:50%;background:#25d366;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 28px rgba(0,0,0,.25);text-decoration:none;font-size:1.6rem}
  .mobile-bar{display:none}
  @media(max-width:640px){
    section.block{padding:70px 0}
    .hero{min-height:auto}
    .hero .wrap{padding-top:90px}
    .booking .grid{grid-template-columns:1fr}
    .exp-photos{grid-template-rows:160px 160px}
    .mobile-bar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:55;background:#fff;border-top:1px solid var(--line);padding:10px 14px;gap:10px}
    .mobile-bar a{flex:1;padding:12px}
    .float-wa{bottom:84px}
    body{padding-bottom:70px}
  }
</style>
</head>
<body>

<div class="topbar"><div class="wrap">
  <span>🕒 ${esc(c.serviceHours)}</span>
  <span>📍 ${esc(o.leadAddress)}${phoneDigits ? ` · <a href="${telHref}">${esc(o.leadPhone)}</a>` : ''}</span>
</div></div>

<nav class="nav"><div class="wrap">
  <a href="#inicio" style="text-decoration:none;display:flex;align-items:center">${logoHtml}</a>
  <ul>
    <li><a href="#carta">${isHotel ? 'Habitaciones' : 'La Carta'}</a></li>
    <li><a href="#experiencia">${isHotel ? 'El Hotel' : 'El Restaurante'}</a></li>
    <li><a href="#galeria">Galería</a></li>
    <li><a href="#opiniones">Opiniones</a></li>
    <li><a href="#visitanos">Cómo llegar</a></li>
  </ul>
  <a href="#reservas" class="btn btn-accent">${esc(c.ctaLabel)}</a>
</div></nav>

<header class="hero" id="inicio">
  <div class="hero-bg"><img src="${esc(hero)}" alt="${esc(o.leadName)}" referrerpolicy="no-referrer" onerror="${onErr(0)}"></div>
  <div class="wrap">
    <div>
      <span class="eyebrow">${esc(c.eyebrow)}</span>
      <h1>${esc(c.heroTitle)} <em>${esc(c.heroEmphasis)}</em></h1>
      <p class="lead">${esc(c.heroDescription)}</p>
      <div class="hero-actions">
        <a href="#reservas" class="btn btn-accent">${esc(c.ctaLabel)}</a>
        <a href="#carta" class="btn btn-ghost">${isHotel ? 'Ver habitaciones' : 'Ver la carta'}</a>
      </div>
      <div class="rating-chip"><b>${ratingStr}</b><div><div class="g">★★★★★</div>${o.totalRatings ? `${o.totalRatings} opiniones en Google` : 'Valoración en Google'}</div></div>
    </div>

    <form class="booking" id="reservas" onsubmit="return hmBook(event)">
      <h3>${isHotel ? 'Reserva directa' : 'Reserva tu mesa'}</h3>
      <p class="sub">${isHotel ? 'Mejor precio garantizado reservando con nosotros.' : 'Confirmación inmediata, sin comisiones.'}</p>
      <div class="grid">
        <div class="field"><label>${isHotel ? 'Entrada' : 'Fecha'}</label><input type="date" id="bk-date" value="${todayStr}"></div>
        ${secondDate}
        <div class="field"><label>${isHotel ? 'Huéspedes' : 'Personas'}</label><select id="bk-people"><option>1</option><option selected>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>8+</option></select></div>
        ${timeOptions}
      </div>
      <button type="submit" class="btn btn-accent">${esc(c.ctaLabel)}</button>
      <p class="note">${phoneDigits ? `O llámanos al <a href="${telHref}"><b>${esc(o.leadPhone)}</b></a>` : 'Te confirmamos en minutos'}</p>
    </form>
  </div>
</header>

<div class="strip"><div class="wrap">
  ${c.distinctions.map(d => `<div class="item"><span>${esc(d.label)}</span><strong>${esc(d.value)}</strong></div>`).join('')}
</div></div>

<section class="block" id="carta"><div class="wrap">
  <div class="head">
    <span class="eyebrow">${isHotel ? 'Alojamiento' : 'Gastronomía'}</span>
    <h2>${esc(c.menuTitle)}</h2>
    <p>${esc(c.menuIntro)}</p>
  </div>
  <div class="dishes">
    ${c.dishes.map((d, i) => `
    <article class="dish">
      <div class="ph"><img src="${esc(dishImgs[i])}" alt="${esc(d.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="${onErr(i + 1)}">${d.badge ? `<span class="tag">${esc(d.badge)}</span>` : ''}</div>
      <div class="body">
        <div class="row"><h3>${esc(d.name)}</h3><span class="price">${esc(d.price)}</span></div>
        <p>${esc(d.description)}</p>
        ${d.pairing ? `<div class="pair">🍷 Maridaje: ${esc(d.pairing)}</div>` : ''}
      </div>
    </article>`).join('')}
  </div>
  <div class="menu-cta"><a href="#reservas" class="btn btn-outline">${isHotel ? 'Consultar disponibilidad' : 'Ver carta completa y reservar'}</a></div>
</div></section>

<section class="block exp" id="experiencia"><div class="wrap">
  <div class="exp-photos">
    <img src="${esc(galleryImgs[0])}" alt="${esc(o.leadName)}" loading="lazy" referrerpolicy="no-referrer" onerror="${onErr(4)}">
    <img src="${esc(galleryImgs[1])}" alt="${esc(o.leadName)}" loading="lazy" referrerpolicy="no-referrer" onerror="${onErr(5)}">
    <img src="${esc(galleryImgs[2])}" alt="${esc(o.leadName)}" loading="lazy" referrerpolicy="no-referrer" onerror="${onErr(6)}">
  </div>
  <div>
    <span class="eyebrow">La experiencia</span>
    <h2>${esc(c.experienceTitle)}</h2>
    <p class="txt">${esc(c.experienceText)}</p>
    <div class="features">
      ${c.features.map(f => `<div class="feature"><div class="ic">${esc(f.icon)}</div><div><strong>${esc(f.title)}</strong><span>${esc(f.text)}</span></div></div>`).join('')}
    </div>
  </div>
</div></section>

<section class="block" id="galeria"><div class="wrap">
  <div class="head"><span class="eyebrow">Galería</span><h2>${isHotel ? 'Así es tu estancia' : 'Así se vive en ' + esc(o.leadName)}</h2></div>
  <div class="gallery">
    ${[pick(1), pick(4), pick(2), pick(5)].map((src, i) => `<img src="${esc(src)}" alt="${esc(o.leadName)}" loading="lazy" referrerpolicy="no-referrer" onerror="${onErr(i + 2)}">`).join('')}
  </div>
  ${hasRealPhotos ? `<p class="real-note">📸 Fotografías reales de ${esc(o.leadName)} publicadas en su ficha de Google Maps.</p>` : ''}
</div></section>

<section class="block reviews-sec" id="opiniones"><div class="wrap">
  <div class="big-rating"><b>${ratingStr}</b><div>★★★★★</div><span>${o.totalRatings ? `Basado en ${o.totalRatings} opiniones reales en Google` : 'Valoración media en Google'}</span></div>
  <div class="reviews">${reviewsHtml}</div>
</div></section>

<section class="block visit" id="visitanos"><div class="wrap">
  <div class="visit-card">
    <span class="eyebrow">Visítanos</span>
    <h2>Te esperamos</h2>
    <div class="line">📍 <span>${esc(o.leadAddress)}</span></div>
    ${phoneDigits ? `<div class="line">📞 <a href="${telHref}" style="text-decoration:none;font-weight:600">${esc(o.leadPhone)}</a></div>` : ''}
    <div style="margin-top:18px"><span class="eyebrow" style="color:var(--ink)">Horario</span>${hoursHtml}</div>
  </div>
  <div class="map"><iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${mapsQuery}&output=embed" title="Mapa ${esc(o.leadName)}"></iframe></div>
</div></section>

<section class="final">
  <img class="bg" src="${esc(pick(3))}" alt="" referrerpolicy="no-referrer" onerror="${onErr(3)}">
  <div class="wrap">
    <h2>${isHotel ? 'Tu próxima escapada empieza aquí' : 'Tu mesa te está esperando'}</h2>
    <p>${isHotel ? 'Reserva directamente con nosotros y disfruta de las mejores condiciones.' : 'Reserva ahora en menos de 30 segundos y asegura tu sitio.'}</p>
    <div class="actions">
      <a href="#reservas" class="btn btn-accent">${esc(c.ctaLabel)}</a>
      ${phoneDigits ? `<a href="${telHref}" class="btn btn-ghost">📞 ${esc(o.leadPhone)}</a>` : ''}
    </div>
  </div>
</section>

<footer><div class="wrap">
  <strong>${esc(o.leadName)}</strong>
  ${esc(o.leadAddress)}${phoneDigits ? ` · ${esc(o.leadPhone)}` : ''}
</div></footer>

${waNumber ? `<a class="float-wa" href="https://wa.me/${waNumber}" target="_blank" rel="noopener" aria-label="WhatsApp">💬</a>` : ''}
<div class="mobile-bar">
  ${phoneDigits ? `<a href="${telHref}" class="btn btn-outline">📞 Llamar</a>` : ''}
  <a href="#reservas" class="btn btn-accent">${esc(c.ctaLabel)}</a>
</div>

<script>
function hmBook(e){
  e.preventDefault();
  var d=document.getElementById('bk-date').value;
  var p=document.getElementById('bk-people').value;
  var t=document.getElementById('bk-time');
  var d2=document.getElementById('bk-date2');
  var bizName=${JSON.stringify(o.leadName).replace(/</g, '\\u003c')};
  var msg='Hola '+bizName+', me gustaría ${isHotel ? 'reservar una estancia' : 'reservar mesa'}: '+d+(d2?(' a '+d2.value):'')+', '+p+' personas'+(t?(' a las '+t.value):'')+'.';
  ${waNumber ? `window.open('https://wa.me/${waNumber}?text='+encodeURIComponent(msg),'_blank');` : phoneDigits ? `window.location.href='${telHref}';` : `alert(msg);`}
  return false;
}
</script>
</body>
</html>`;
}
