/**
 * Design Trends & Multi-Archetype Web Layout Engine
 * Grupo Hormesis 2026
 * 
 * Generates radically distinct, award-winning web design proposals tailored to
 * contemporary web design trends (Awwwards, Pinterest UI, Dribbble, Linear/Apple).
 */

export interface DesignTrendReference {
  niche: string;
  archetype: 'bento_tech' | 'editorial_magazine' | 'luxury_dark_split' | 'brutalist_minimal' | 'culinary_hospitality';
  trendTitle: string;
  source: 'Pinterest Trends 2026' | 'Awwwards SOTD' | 'Dribbble Top Curations' | 'Swiss Modern Standards' | 'Relais & Châteaux / Michelin Aesthetics';
  visualHighlights: string[];
  keyComponents: string[];
  recommendedTypography: { display: string; body: string };
  searchSnippets?: string[];
}

export function detectNiche(nicheText?: string, businessName?: string, notes?: string): string {
  const combined = `${nicheText || ''} ${businessName || ''} ${notes || ''}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  if (/abogad|juridic|bufete|despacho|notar|procurad|litigio|derecho|penal|mercantil|laboralis|civilis|lawyer|law firm/i.test(combined)) return 'legal';
  if (/dental|clinic|dentis|odontol|medic|fisio|fisioterap|salud|podolog|oftalmol|pediatr/i.test(combined)) return 'salud';
  if (/restauran|gastronom|tapas|pizz|asador|hosteler|cafeteri|cerveceri|marisqueri|bistrot|bar\b|taberna/i.test(combined)) return 'restaurantes';
  if (/arquitect|construc|edifica|urbanis|reforma|fontaner|pintur|carpinter|albanil|electricis/i.test(combined)) return 'reformas';
  if (/inmobiliar|real estate|vivienda|propiedad|promocion|fincas|alquiler/i.test(combined)) return 'inmobiliaria';
  if (/solar|fotovolt|placa|panel|renovable|energ|clima|aerotermi/i.test(combined)) return 'solar';
  if (/veterin|mascot|perr|gat|canin|felin|animal/i.test(combined)) return 'veterinaria';
  if (/hotel|hostal|rural|turis|alojam|apartament|resort/i.test(combined)) return 'turismo';
  if (/taller|mecanic|coche|auto|motor|neumatic|chapa y pintura/i.test(combined)) return 'automocion';
  if (/peluquer|barberia|estetica|estilista|manicura|salon de belleza|spa\b/i.test(combined)) return 'belleza';
  if (/gimnas|gym|fitnes|crossfit|entrena|yoga|pilates|deport/i.test(combined)) return 'fitness';
  if (/gestor|asesor fiscal|asesor contable|tributar|renta/i.test(combined)) return 'gestoria';
  return 'general';
}

export function getDesignTrendKnowledge(nicheText: string, archetype: string): DesignTrendReference {
  const niche = detectNiche(nicheText);
  const arch = (['bento_tech', 'editorial_magazine', 'luxury_dark_split', 'brutalist_minimal', 'culinary_hospitality'].includes(archetype) 
    ? archetype 
    : (niche === 'restaurantes' || niche === 'turismo' ? 'culinary_hospitality' : 'bento_tech')) as 'bento_tech' | 'editorial_magazine' | 'luxury_dark_split' | 'brutalist_minimal' | 'culinary_hospitality';

  const nicheMap: Record<string, { title: string; highlights: string[]; components: string[] }> = {
    restaurantes: {
      title: 'Haute Cuisine & Sensory Atmosphere (Michelin & Boutique Hospitality)',
      highlights: [
        'Motor de reservas de mesa en tiempo real sin comisiones externas (Fecha, Comensales, Turno Almuerzo/Cena)',
        'Carta gastronómica interactiva y menú degustación con maridaje de sumiller y alérgenos',
        'Fotografía inmersiva de texturas culinarias, sala íntima y bodega subterránea'
      ],
      components: ['Reserva instantánea de mesa', 'Carta digital & Menú Degustación', 'Distintivo Guía Michelin / Soles Repsol']
    },
    turismo: {
      title: 'Boutique Hotel & Resort Sanctuary Experience',
      highlights: [
        'Motor de reservas de estancias y suites con confirmación inmediata y concierge',
        'Escaparate inmersivo de habitaciones de autor, vistas y servicios wellness',
        'Tarifas oficiales garantizadas y atención personalizada sin intermediarios'
      ],
      components: ['Reserva directa de estancia / habitación', 'Galería de suites & spa', 'Sello de calidad turística y 4.9★']
    },
    salud: {
      title: 'Biomimetic Medical Trust & Clean UI',
      highlights: ['Insignia médica colegiada y credenciales oficiales verificadas', 'Selector de cita previa online sin colas de espera telefónica', 'Micro-métricas de satisfacción de pacientes y tecnología clínica'],
      components: ['Agendamiento de cita en 1-clic', 'Especialidades clínicas estructuradas', 'Cuadro facultativo verificado']
    },
    reformas: {
      title: 'Architectural Brutalism & Full-Bleed Showcase',
      highlights: ['Escaparate monumental de proyectos con fichas técnicas de materiales', 'Comparador visual de acabados y distribución de espacios', 'Calculadora ágil de presupuesto estimativo'],
      components: ['Galería de proyectos con m² y plazos', 'Garantía decenal por escrito', 'Simulador de reforma integral']
    },
    legal: {
      title: 'Executive High-Authority Editorial & Swiss Law',
      highlights: ['Tipografía monumental de prestigio y peso jurídico', 'Matriz de áreas de práctica (Civil, Mercantil, Penal, Tributario)', 'Sello de confidencialidad estricta y consulta urgente'],
      components: ['Consulta confidencial directa', 'Desglose de especialidades jurídicas', 'Casos de éxito y resolución favorable']
    },
    inmobiliaria: {
      title: 'Panoramic Real Estate Showcase & Bento Specs',
      highlights: ['Fichas modulares de propiedades con badges de habitaciones, m² y precio', 'Botón de visita presencial o tour virtual inmediato', 'Cualificación ágil de compradores sin tareas manuales'],
      components: ['Filtros rápidos de cartera', 'Agendamiento de visitas presenciales', 'Sello de garantía inmobiliaria']
    },
    solar: {
      title: 'Clean-Tech Sustainable Vanguard',
      highlights: ['Simulador visual de ahorro mensual en factura de luz', 'Monitor de potencia instalada (kWp) y retorno de inversión', 'Insignia de instalador oficial autorizado y subvenciones activas'],
      components: ['Calculadora de ahorro energético', 'Estudio solar gratuito en 24h', 'Garantía de placas de 25 años']
    },
    automocion: {
      title: 'Precision Mechanical Grid & Kinetic Booking',
      highlights: ['Selector rápido de revisión periódica e ITV', 'Desglose transparente de servicios y diagnóstico previo', 'Garantía oficial por escrito en piezas originales'],
      components: ['Cita directa a taller', 'Diagnóstico preventivo', 'Vehículo de cortesía garantizado']
    },
    belleza: {
      title: 'High-End Beauty Atelier & Editorial Harmony',
      highlights: ['Catálogo visual de rituales y tratamientos capilares/faciales', 'Galería de transformaciones y estilismo de autor', 'Reserva directa con selección de profesional'],
      components: ['Menú de servicios de autor', 'Reserva online de estilismo', 'Productos y marcas prémium']
    },
    veterinaria: {
      title: 'Empathetic Animal Care & 24h Medical Badge',
      highlights: ['Insignia visible de urgencias 24h con marcación telefónica inmediata', 'Instalaciones y quirófano de última generación', 'Atención personalizada y trato cariñoso'],
      components: ['Botón directo de urgencias 24h', 'Historial y vacunación preventiva', 'Equipo médico especializado']
    },
    general: {
      title: 'Contemporary B2B Vanguard & Apple/Linear Hierarchy',
      highlights: ['Propuesta de valor clara en el primer pliegue sin rodeos', 'Métricas de impacto empresarial y testimonios verificados', 'Flujo de contacto de fricción cero'],
      components: ['Llamada a la acción directa', 'Desglose de servicios clave', 'Garantía de satisfacción']
    }
  };

  const currentNiche = nicheMap[niche] || nicheMap.general;

  const archetypeSources: Record<string, { source: DesignTrendReference['source']; typo: { display: string; body: string } }> = {
    bento_tech: { source: 'Awwwards SOTD', typo: { display: 'Plus Jakarta Sans (800/900)', body: 'Space Grotesk & Inter' } },
    editorial_magazine: { source: 'Pinterest Trends 2026', typo: { display: 'Playfair Display & Cinzel', body: 'Inter (400/500)' } },
    luxury_dark_split: { source: 'Dribbble Top Curations', typo: { display: 'Outfit (700/800) & Syne', body: 'Inter' } },
    brutalist_minimal: { source: 'Swiss Modern Standards', typo: { display: 'Syne (800) & Plus Jakarta Sans', body: 'Plus Jakarta Sans' } },
    culinary_hospitality: { source: 'Relais & Châteaux / Michelin Aesthetics', typo: { display: 'Playfair Display & Cormorant Garamond', body: 'Outfit & Inter' } }
  };

  const archMeta = archetypeSources[arch] || archetypeSources.culinary_hospitality;

  const archetypeLabel = arch === 'culinary_hospitality' 
    ? 'Alta Gastronomía & Relais' 
    : arch === 'bento_tech' 
      ? 'Bento Grid' 
      : arch === 'editorial_magazine' 
        ? 'Editorial' 
        : arch === 'luxury_dark_split' 
          ? 'Luxury Dark' 
          : 'Neo-Brutalism';

  return {
    niche,
    archetype: arch,
    trendTitle: `${currentNiche.title} (${archetypeLabel})`,
    source: archMeta.source,
    visualHighlights: currentNiche.highlights,
    keyComponents: currentNiche.components,
    recommendedTypography: archMeta.typo
  };
}

export async function searchDesignTrendReferences(
  leadName: string,
  archetype: string,
  contextText?: string,
  address?: string
): Promise<DesignTrendReference> {
  const baseKnowledge = getDesignTrendKnowledge(contextText || leadName, archetype);

  try {
    const query = `${baseKnowledge.niche} website design trends awwwards pinterest 2026`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500); // 2.5s timeout strictly guarded

    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const html = await res.text();
      const snippets: string[] = [];
      const snippetRegex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = snippetRegex.exec(html)) !== null && snippets.length < 3) {
        const clean = match[1].replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").trim();
        if (clean && clean.length > 20) snippets.push(clean);
      }
      if (snippets.length > 0) {
        baseKnowledge.searchSnippets = snippets;
      }
    }
  } catch (e) {}

  return baseKnowledge;
}

/**
 * Universal Entrypoint for Multi-Archetype Conceptual Web Design
 */
export function generateArchetypeHtml(
  leadName: string,
  websiteUrl: string,
  brandPalette: any,
  catImages: any,
  fallbackCat: any,
  archetype: string,
  leadPhone: string,
  leadAddress: string,
  leadRating: number,
  nicheOrMeta?: any,
  designTrend?: DesignTrendReference
): string {
  const trend = designTrend || getDesignTrendKnowledge(
    typeof nicheOrMeta === 'string' ? nicheOrMeta : (nicheOrMeta?.niche || nicheOrMeta?.notes || leadName),
    archetype
  );

  const selectedArch = (['bento_tech', 'editorial_magazine', 'luxury_dark_split', 'brutalist_minimal', 'culinary_hospitality'].includes(archetype)
    ? archetype
    : (trend.archetype || (trend.niche === 'restaurantes' || trend.niche === 'turismo' ? 'culinary_hospitality' : 'bento_tech')));

  if (selectedArch === 'culinary_hospitality') {
    return generateCulinaryHospitalityHtml(leadName, websiteUrl, brandPalette, catImages, fallbackCat, leadPhone, leadAddress, leadRating, trend);
  } else if (selectedArch === 'editorial_magazine') {
    return generateEditorialMagazineHtml(leadName, websiteUrl, brandPalette, catImages, fallbackCat, leadPhone, leadAddress, leadRating, trend);
  } else if (selectedArch === 'luxury_dark_split') {
    return generateLuxuryDarkSplitHtml(leadName, websiteUrl, brandPalette, catImages, fallbackCat, leadPhone, leadAddress, leadRating, trend);
  } else if (selectedArch === 'brutalist_minimal') {
    return generateBrutalistMinimalHtml(leadName, websiteUrl, brandPalette, catImages, fallbackCat, leadPhone, leadAddress, leadRating, trend);
  } else {
    return generateBentoTechHtml(leadName, websiteUrl, brandPalette, catImages, fallbackCat, leadPhone, leadAddress, leadRating, trend);
  }
}

// ------------------------------------------------------------------------------------------------
// ARCHETYPE 1: BENTO GRID TECH VANGUARD (Apple & Linear UI 2026)
// ------------------------------------------------------------------------------------------------
function generateBentoTechHtml(
  leadName: string,
  websiteUrl: string,
  brandPalette: any,
  catImages: any,
  fallbackCat: any,
  leadPhone: string,
  leadAddress: string,
  leadRating: number,
  trend: DesignTrendReference
): string {
  const logoHtml = catImages.logo
    ? `<img src="${catImages.logo}" referrerpolicy="no-referrer" alt="${leadName}" style="max-height: 42px; max-width: 180px; object-fit: contain;">`
    : `<span style="font-weight: 900; font-size: 1.35rem; color: ${brandPalette.primary}; letter-spacing: -0.04em;">${leadName}</span>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${leadName} | Propuesta de Rediseño Oficial 2026</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: ${brandPalette.primary};
      --primary-accent: ${brandPalette.accent};
      --bg: #f8fafc;
      --bg-surface: #ffffff;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --border-color: rgba(226, 232, 240, 0.9);
      --card-radius: 24px;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text-main);
      line-height: 1.6;
      background-image: 
        radial-gradient(at 100% 0%, ${brandPalette.accent}14 0px, transparent 40%),
        radial-gradient(at 0% 50%, ${brandPalette.primary}10 0px, transparent 40%);
      background-attachment: fixed;
    }
    .topbar {
      background: var(--primary);
      color: #ffffff;
      padding: 10px 24px;
      font-size: 0.82rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    .topbar a { color: #ffffff; font-weight: 700; text-decoration: underline; }
    .navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 36px;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .nav-links { display: flex; gap: 28px; list-style: none; align-items: center; }
    .nav-links a { color: var(--text-muted); text-decoration: none; font-weight: 600; font-size: 0.92rem; }
    .nav-links a:hover { color: var(--primary-accent); }
    @media (max-width: 868px) { .nav-links { display: none; } }
    .nav-cta {
      background: var(--primary-accent);
      color: #fff;
      padding: 10px 22px;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 0.88rem;
      text-decoration: none;
      box-shadow: 0 4px 14px ${brandPalette.accent}44;
    }
    
    /* BENTO GRID HERO */
    .bento-hero {
      max-width: 1240px;
      margin: 40px auto;
      padding: 0 24px;
      display: grid;
      grid-template-columns: 1.35fr 1fr;
      grid-gap: 22px;
    }
    @media (max-width: 960px) { .bento-hero { grid-template-columns: 1fr; } }
    .bento-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--card-radius);
      padding: 34px;
      box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.05);
      position: relative;
      overflow: hidden;
    }
    .bento-focal {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: var(--primary);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 0.82rem;
      font-weight: 700;
      margin-bottom: 20px;
      width: fit-content;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      background: var(--primary-accent);
      border-radius: 50%;
      box-shadow: 0 0 0 3px ${brandPalette.accent}33;
    }
    .hero-title {
      font-size: clamp(2.2rem, 4.2vw, 3.4rem);
      font-weight: 900;
      letter-spacing: -0.04em;
      line-height: 1.12;
      color: var(--text-main);
      margin-bottom: 18px;
    }
    .hero-title span { color: var(--primary-accent); }
    .hero-p {
      color: var(--text-muted);
      font-size: 1.1rem;
      margin-bottom: 26px;
      max-width: 540px;
    }
    .hero-btns { display: flex; gap: 14px; flex-wrap: wrap; }
    .btn-main {
      background: var(--primary-accent);
      color: #fff;
      padding: 13px 28px;
      border-radius: 14px;
      font-weight: 800;
      text-decoration: none;
      box-shadow: 0 8px 20px ${brandPalette.accent}33;
    }
    .btn-sec {
      background: #ffffff;
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 13px 24px;
      border-radius: 14px;
      font-weight: 700;
      text-decoration: none;
    }
    
    .bento-subgrid {
      display: grid;
      grid-template-rows: 1.4fr 1fr;
      grid-gap: 22px;
    }
    .bento-img-card {
      padding: 0;
      min-height: 250px;
    }
    .bento-img-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      border-radius: var(--card-radius);
    }
    .bento-img-badge {
      position: absolute;
      bottom: 16px;
      left: 16px;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(12px);
      padding: 8px 16px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 800;
      color: var(--primary);
    }
    .bento-metrics-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-gap: 16px;
    }
    .metric-box {
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 20px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .metric-num {
      font-size: 2rem;
      font-weight: 900;
      color: var(--primary);
      font-family: 'Space Grotesk', sans-serif;
      line-height: 1.1;
    }
    .metric-lbl {
      font-size: 0.82rem;
      color: var(--text-muted);
      font-weight: 600;
      margin-top: 4px;
    }

    /* SERVICES BENTO */
    .section-wrap { max-width: 1240px; margin: 70px auto; padding: 0 24px; }
    .sec-head { text-align: center; margin-bottom: 40px; }
    .sec-badge {
      display: inline-block;
      background: ${brandPalette.accent}14;
      color: var(--primary-accent);
      padding: 5px 14px;
      border-radius: 9999px;
      font-size: 0.82rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 10px;
    }
    .sec-title { font-size: 2.3rem; font-weight: 900; letter-spacing: -0.03em; }
    .services-bento {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      grid-gap: 22px;
    }
    @media (max-width: 868px) { .services-bento { grid-template-columns: 1fr; } }
    .service-lead-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--card-radius);
      padding: 30px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .service-lead-card img {
      width: 100%;
      height: 220px;
      object-fit: cover;
      border-radius: 16px;
      margin-top: 20px;
    }
    .service-mini-col {
      display: grid;
      grid-template-rows: 1fr 1fr;
      grid-gap: 22px;
    }
    .service-mini-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--card-radius);
      padding: 26px;
    }

    /* PROCESS */
    .process-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      grid-gap: 20px;
    }
    .process-box {
      background: #fff;
      border: 1px solid var(--border-color);
      border-radius: 18px;
      padding: 24px;
    }
    .p-step {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1.8rem;
      font-weight: 900;
      color: var(--primary-accent);
      margin-bottom: 10px;
    }

    /* CTA BANNER */
    .cta-banner {
      background: linear-gradient(135deg, ${brandPalette.primary} 0%, #091322 100%);
      color: #fff;
      border-radius: 30px;
      padding: 50px 36px;
      text-align: center;
      margin-top: 60px;
      position: relative;
    }
    .cta-banner h2 { font-size: 2.4rem; font-weight: 900; margin-bottom: 14px; }
    .cta-banner p { font-size: 1.15rem; opacity: 0.9; margin-bottom: 26px; max-width: 600px; margin-left: auto; margin-right: auto; }
    .cta-banner a {
      background: var(--primary-accent);
      color: #ffffff;
      padding: 14px 34px;
      border-radius: 14px;
      font-weight: 800;
      text-decoration: none;
      display: inline-block;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    }

    /* FOOTER */
    .footer {
      border-top: 1px solid var(--border-color);
      background: #ffffff;
      padding: 36px 24px;
      text-align: center;
      margin-top: 80px;
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    /* FLOATING TREND BADGE */
    .trend-indicator-badge {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(12px);
      color: #ffffff;
      padding: 12px 18px;
      border-radius: 16px;
      font-size: 0.82rem;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25);
      border: 1px solid rgba(255,255,255,0.15);
      z-index: 999;
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-width: 320px;
    }
    .trend-tag { color: ${brandPalette.accent}; font-weight: 800; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.05em; }
  </style>
</head>
<body>
  <div class="topbar">
    <div>🚀 Propuesta oficial de rediseño de alta velocidad para <strong>${leadName}</strong></div>
    <div>Ubicación: <strong>${leadAddress}</strong> · <a href="tel:${leadPhone}">Llamar: ${leadPhone}</a></div>
  </div>

  <nav class="navbar">
    <div style="display:flex; align-items:center; gap:12px;">
      ${logoHtml}
    </div>
    <ul class="nav-links">
      <li><a href="#solucion">Solución</a></li>
      <li><a href="#servicios">Servicios Especializados</a></li>
      <li><a href="#proceso">Metodología</a></li>
      <li><a href="#contacto">Contacto Directo</a></li>
    </ul>
    <a href="tel:${leadPhone}" class="nav-cta">Pedir Cita Online</a>
  </nav>

  <!-- BENTO HERO -->
  <main class="bento-hero">
    <div class="bento-card bento-focal">
      <div class="status-badge">
        <span class="pulse-dot"></span>
        Dirección de Diseño Vanguardia: ${trend.source}
      </div>
      <h1 class="hero-title">Innovación y Excelencia en <span>${leadName}</span></h1>
      <p class="hero-p">Optimizamos la experiencia digital con arquitectura modular de carga instantánea, adaptada rigurosamente a ${leadAddress}.</p>
      <div class="hero-btns">
        <a href="tel:${leadPhone}" class="btn-main">Agendar Consulta Prioritaria</a>
        <a href="#servicios" class="btn-sec">Explorar Soluciones</a>
      </div>
    </div>

    <div class="bento-subgrid">
      <div class="bento-card bento-img-card">
        <img src="${catImages.hero}" referrerpolicy="no-referrer" alt="${leadName}">
        <div class="bento-img-badge">⭐ ${leadRating} / 5 · Verificado en Google Maps</div>
      </div>
      <div class="bento-metrics-row">
        <div class="metric-box">
          <div class="metric-num">+98%</div>
          <div class="metric-lbl">Satisfacción Local</div>
        </div>
        <div class="metric-box">
          <div class="metric-num">&lt;0.8s</div>
          <div class="metric-lbl">Velocidad de Carga</div>
        </div>
      </div>
    </div>
  </main>

  <!-- SERVICIOS BENTO -->
  <section id="servicios" class="section-wrap">
    <div class="sec-head">
      <span class="sec-badge">Soluciones Especializadas</span>
      <h2 class="sec-title">Especialidades Diseñadas para tu Comodidad</h2>
    </div>
    <div class="services-bento">
      <div class="service-lead-card">
        <div>
          <span style="font-size:0.8rem; font-weight:800; color:var(--primary-accent); text-transform:uppercase;">Especialidad Principal</span>
          <h3 style="font-size:1.6rem; font-weight:800; margin:10px 0;">Atención Integral Personalizada</h3>
          <p style="color:var(--text-muted); font-size:1rem;">Protocolos modernos con la más alta exigencia y atención directa en ${leadAddress}.</p>
        </div>
        <img src="${catImages.service1}" referrerpolicy="no-referrer" alt="Servicio Destacado">
      </div>
      <div class="service-mini-col">
        <div class="service-mini-card">
          <h4 style="font-size:1.25rem; font-weight:800; color:var(--primary); margin-bottom:8px;">Tecnología y Diagnóstico Ágil</h4>
          <p style="color:var(--text-muted); font-size:0.92rem;">Procesos digitalizados para evitar esperas y asegurar máxima fiabilidad.</p>
        </div>
        <div class="service-mini-card">
          <h4 style="font-size:1.25rem; font-weight:800; color:var(--primary); margin-bottom:8px;">Garantía y Seguimiento Continuo</h4>
          <p style="color:var(--text-muted); font-size:0.92rem;">Acompañamiento profesional en cada etapa de tu servicio o proyecto.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- METODOLOGÍA -->
  <section id="proceso" class="section-wrap">
    <div class="sec-head">
      <span class="sec-badge">Paso a Paso</span>
      <h2 class="sec-title">Cómo Trabajamos Contigo</h2>
    </div>
    <div class="process-grid">
      <div class="process-box">
        <div class="p-step">01</div>
        <h4 style="font-weight:800; margin-bottom:6px;">Contacto Ágil</h4>
        <p style="color:var(--text-muted); font-size:0.9rem;">Atención inmediata sin formularios eternos.</p>
      </div>
      <div class="process-box">
        <div class="p-step">02</div>
        <h4 style="font-weight:800; margin-bottom:6px;">Diagnóstico</h4>
        <p style="color:var(--text-muted); font-size:0.9rem;">Evaluación a medida de tus requerimientos.</p>
      </div>
      <div class="process-box">
        <div class="p-step">03</div>
        <h4 style="font-weight:800; margin-bottom:6px;">Ejecución</h4>
        <p style="color:var(--text-muted); font-size:0.9rem;">Aplicación rigurosa con estándares de excelencia.</p>
      </div>
      <div class="process-box">
        <div class="p-step">04</div>
        <h4 style="font-weight:800; margin-bottom:6px;">Satisfacción</h4>
        <p style="color:var(--text-muted); font-size:0.9rem;">Garantía y seguimiento post-servicio.</p>
      </div>
    </div>

    <!-- CTA -->
    <div id="contacto" class="cta-banner">
      <h2>Descubre la Experiencia en ${leadName}</h2>
      <p>Llámanos o agenda tu cita directa sin ningún tipo de compromiso.</p>
      <a href="tel:${leadPhone}">📞 Contactar: ${leadPhone}</a>
    </div>
  </section>

  <footer class="footer">
    <p><strong>${leadName}</strong> · ${leadAddress} · Tel: ${leadPhone}</p>
    <p style="margin-top:6px; font-size:0.8rem; opacity:0.8;">Identidad cromática extraída de ${websiteUrl}</p>
  </footer>

  <div class="trend-indicator-badge">
    <span class="trend-tag">✨ Tendencia Web (${trend.source})</span>
    <strong>${trend.trendTitle}</strong>
    <span style="font-size:0.75rem; opacity:0.8;">Arquetipo: Bento Grid Vanguard Tech</span>
  </div>
</body>
</html>`;
}

// ------------------------------------------------------------------------------------------------
// ARCHETYPE 2: EDITORIAL HIGH-FASHION & SWISS MODERN (Kinfolk & Awwwards SOTD)
// ------------------------------------------------------------------------------------------------
function generateEditorialMagazineHtml(
  leadName: string,
  websiteUrl: string,
  brandPalette: any,
  catImages: any,
  fallbackCat: any,
  leadPhone: string,
  leadAddress: string,
  leadRating: number,
  trend: DesignTrendReference
): string {
  const logoHtml = catImages.logo
    ? `<img src="${catImages.logo}" referrerpolicy="no-referrer" alt="${leadName}" style="max-height: 48px; max-width: 200px; object-fit: contain;">`
    : `<span style="font-family:'Playfair Display', serif; font-size:1.6rem; font-weight:900; letter-spacing:-0.03em; color:${brandPalette.primary};">${leadName}</span>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${leadName} | Edición Editorial 2026</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;0,900;1,400;1,700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: ${brandPalette.primary};
      --primary-accent: ${brandPalette.accent};
      --bg: #fcfbf8;
      --bg-surface: #ffffff;
      --text-main: #18181b;
      --text-muted: #52525b;
      --border-color: #e4e4e7;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text-main);
      line-height: 1.7;
      overflow-x: hidden;
    }
    .editorial-header {
      border-bottom: 1px solid var(--border-color);
      padding: 16px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(252, 251, 248, 0.95);
      position: sticky;
      top: 0;
      z-index: 50;
      backdrop-filter: blur(10px);
    }
    .header-issue {
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--text-muted);
    }
    .editorial-nav-btn {
      background: var(--primary);
      color: #ffffff;
      padding: 9px 24px;
      border-radius: 9999px;
      text-decoration: none;
      font-size: 0.84rem;
      font-weight: 600;
      letter-spacing: 0.05em;
    }
    
    /* SCULPTURAL HERO */
    .hero-editorial {
      max-width: 1100px;
      margin: 60px auto 40px auto;
      text-align: center;
      padding: 0 24px;
    }
    .kicker {
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--primary-accent);
      margin-bottom: 20px;
      display: block;
    }
    .monumental-title {
      font-family: 'Playfair Display', serif;
      font-size: clamp(2.6rem, 6vw, 4.8rem);
      font-weight: 900;
      line-height: 1.08;
      letter-spacing: -0.03em;
      color: var(--text-main);
      margin-bottom: 24px;
    }
    .monumental-title em {
      font-style: italic;
      color: var(--primary-accent);
    }
    .editorial-sub {
      font-size: 1.2rem;
      color: var(--text-muted);
      max-width: 680px;
      margin: 0 auto 34px auto;
      font-weight: 300;
      line-height: 1.6;
    }
    
    /* MARQUEE TICKER */
    .marquee-wrap {
      overflow: hidden;
      white-space: nowrap;
      border-top: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
      background: #ffffff;
      padding: 14px 0;
      margin: 30px 0 50px 0;
    }
    .marquee-inner {
      display: inline-block;
      animation: tickerLoop 24s linear infinite;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--primary);
    }
    @keyframes tickerLoop {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    /* ARCH MASK IMAGE */
    .arch-container {
      max-width: 720px;
      margin: 0 auto;
      position: relative;
    }
    .arch-img-frame {
      border-radius: 260px 260px 24px 24px;
      overflow: hidden;
      box-shadow: 0 30px 60px -15px rgba(24, 24, 27, 0.15);
      border: 1px solid var(--border-color);
      background: #ffffff;
    }
    .arch-img-frame img {
      width: 100%;
      height: 480px;
      object-fit: cover;
      display: block;
    }
    .authority-seal {
      position: absolute;
      bottom: -24px;
      right: -20px;
      background: var(--primary-accent);
      color: #ffffff;
      width: 110px;
      height: 110px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 10px;
      box-shadow: 0 12px 24px rgba(0,0,0,0.18);
      font-size: 0.72rem;
      font-weight: 800;
      line-height: 1.2;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    @media (max-width: 768px) {
      .authority-seal { width: 90px; height: 90px; font-size: 0.65rem; right: 10px; bottom: -15px; }
      .arch-img-frame img { height: 360px; }
    }

    /* MANIFESTO */
    .manifesto-section {
      max-width: 980px;
      margin: 90px auto;
      padding: 0 24px;
      display: grid;
      grid-template-columns: 1fr 1.3fr;
      grid-gap: 50px;
      align-items: center;
    }
    @media (max-width: 868px) { .manifesto-section { grid-template-columns: 1fr; } }
    .manifesto-quote {
      font-family: 'Playfair Display', serif;
      font-size: 2.2rem;
      line-height: 1.2;
      font-weight: 700;
      color: var(--primary);
    }
    
    /* NUMBERED SERVICES */
    .services-editorial {
      max-width: 1050px;
      margin: 80px auto;
      padding: 0 24px;
    }
    .editorial-item {
      display: grid;
      grid-template-columns: 120px 1.4fr 1fr;
      grid-gap: 30px;
      align-items: center;
      padding: 40px 0;
      border-bottom: 1px solid var(--border-color);
    }
    @media (max-width: 868px) { .editorial-item { grid-template-columns: 1fr; } }
    .item-num {
      font-family: 'Playfair Display', serif;
      font-size: 3rem;
      font-weight: 900;
      color: var(--primary-accent);
      opacity: 0.8;
    }
    .item-img {
      border-radius: 16px;
      overflow: hidden;
      max-height: 200px;
    }
    .item-img img { width: 100%; height: 100%; object-fit: cover; }

    /* EDITORIAL CLOSURE */
    .editorial-closure {
      background: var(--primary);
      color: #ffffff;
      padding: 70px 24px;
      text-align: center;
      margin-top: 90px;
    }
    .editorial-closure h2 {
      font-family: 'Playfair Display', serif;
      font-size: 2.8rem;
      font-weight: 800;
      margin-bottom: 16px;
    }
    .editorial-closure p {
      font-size: 1.15rem;
      opacity: 0.85;
      margin-bottom: 30px;
    }
    .editorial-closure a {
      background: var(--primary-accent);
      color: #ffffff;
      padding: 14px 36px;
      border-radius: 9999px;
      font-weight: 700;
      text-decoration: none;
      display: inline-block;
    }

    .footer-editorial {
      padding: 34px 24px;
      text-align: center;
      font-size: 0.84rem;
      color: var(--text-muted);
      border-top: 1px solid var(--border-color);
    }

    /* BADGE */
    .trend-indicator-badge {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #18181b;
      color: #ffffff;
      padding: 12px 18px;
      border-radius: 14px;
      font-size: 0.82rem;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      z-index: 999;
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-width: 320px;
    }
    .trend-tag { color: var(--primary-accent); font-weight: 800; text-transform: uppercase; font-size: 0.72rem; }
  </style>
</head>
<body>
  <header class="editorial-header">
    <div class="header-issue">EDICIÓN OFICIAL 2026 · ${leadAddress.toUpperCase()}</div>
    <div style="display:flex; align-items:center;">
      ${logoHtml}
    </div>
    <a href="tel:${leadPhone}" class="editorial-nav-btn">Pedir Cita</a>
  </header>

  <main class="hero-editorial">
    <span class="kicker">Dirección de Diseño Kinfolk & Awwwards</span>
    <h1 class="monumental-title">El Arte de la Excelencia en <em>${leadName}</em></h1>
    <p class="editorial-sub">Dedicación minuciosa y rigor profesional para ofrecer una experiencia inigualable en ${leadAddress}.</p>
    
    <div class="arch-container">
      <div class="arch-img-frame">
        <img src="${catImages.hero}" referrerpolicy="no-referrer" alt="${leadName}">
      </div>
      <div class="authority-seal">
        <span>⭐ ${leadRating}</span>
        <span>Excelencia Verificada</span>
      </div>
    </div>
  </main>

  <div class="marquee-wrap">
    <div class="marquee-inner">
      EXCELENCIA Y COMPROMISO · SERVICIO OFICIAL EN ${leadAddress.toUpperCase()} · MÁXIMA CALIDAD · GARANTÍA COMPROBADA · ATENCIÓN PERSONALIZADA · &nbsp;&nbsp;&nbsp;&nbsp;
      EXCELENCIA Y COMPROMISO · SERVICIO OFICIAL EN ${leadAddress.toUpperCase()} · MÁXIMA CALIDAD · GARANTÍA COMPROBADA · ATENCIÓN PERSONALIZADA · 
    </div>
  </div>

  <section class="manifesto-section">
    <div class="manifesto-quote">
      "La verdadera distinción nace del cuidado por cada detalle y el respeto absoluto a cada cliente."
    </div>
    <div>
      <h3 style="font-size:1.4rem; font-weight:700; margin-bottom:14px; color:var(--primary);">Compromiso con ${leadAddress}</h3>
      <p style="color:var(--text-muted); font-size:1.05rem;">
        En ${leadName} combinamos tradición, precisión contemporánea y un trato directo para resolver tus necesidades con la máxima celeridad y tranquilidad.
      </p>
    </div>
  </section>

  <section class="services-editorial">
    <h2 style="font-family:'Playfair Display', serif; font-size:2.4rem; margin-bottom:30px; text-align:center;">Nuestras Especialidades</h2>
    
    <div class="editorial-item">
      <div class="item-num">01.</div>
      <div>
        <h3 style="font-size:1.35rem; font-weight:700; margin-bottom:6px;">Atención Preferente y Diagnóstico</h3>
        <p style="color:var(--text-muted); font-size:0.95rem;">Estudio detallado de tu situación con asesoramiento experto desde el primer minuto.</p>
      </div>
      <div class="item-img"><img src="${catImages.service1}" referrerpolicy="no-referrer" alt="Servicio 1"></div>
    </div>

    <div class="editorial-item">
      <div class="item-num">02.</div>
      <div>
        <h3 style="font-size:1.35rem; font-weight:700; margin-bottom:6px;">Protocolos de Máxima Calidad</h3>
        <p style="color:var(--text-muted); font-size:0.95rem;">Aplicación de estándares rigurosos y materiales de primer nivel garantizados.</p>
      </div>
      <div class="item-img"><img src="${catImages.service2}" referrerpolicy="no-referrer" alt="Servicio 2"></div>
    </div>

    <div class="editorial-item">
      <div class="item-num">03.</div>
      <div>
        <h3 style="font-size:1.35rem; font-weight:700; margin-bottom:6px;">Acompañamiento y Garantía Oficial</h3>
        <p style="color:var(--text-muted); font-size:0.95rem;">Tranquilidad total con servicio post-venta y soporte continuo en tu localidad.</p>
      </div>
      <div class="item-img"><img src="${catImages.service3}" referrerpolicy="no-referrer" alt="Servicio 3"></div>
    </div>
  </section>

  <section class="editorial-closure">
    <h2>Inicia tu Consulta con ${leadName}</h2>
    <p>Atención directa y prioritaria en ${leadAddress}.</p>
    <a href="tel:${leadPhone}">📞 Llamar Directamente: ${leadPhone}</a>
  </section>

  <footer class="footer-editorial">
    <p><strong>${leadName}</strong> · ${leadAddress} · Tel: ${leadPhone}</p>
    <p style="margin-top:6px; opacity:0.75;">Identidad cromática adaptada de ${websiteUrl}</p>
  </footer>

  <div class="trend-indicator-badge">
    <span class="trend-tag">✨ Tendencia Web (${trend.source})</span>
    <strong>${trend.trendTitle}</strong>
    <span style="font-size:0.75rem; opacity:0.8;">Arquetipo: Editorial High-Fashion</span>
  </div>
</body>
</html>`;
}

// ------------------------------------------------------------------------------------------------
// ARCHETYPE 3: LUXURY DARK & AMBIENT NEON GLOW (Dribbble & Alto Standing)
// ------------------------------------------------------------------------------------------------
function generateLuxuryDarkSplitHtml(
  leadName: string,
  websiteUrl: string,
  brandPalette: any,
  catImages: any,
  fallbackCat: any,
  leadPhone: string,
  leadAddress: string,
  leadRating: number,
  trend: DesignTrendReference
): string {
  const logoHtml = catImages.logo
    ? `<img src="${catImages.logo}" referrerpolicy="no-referrer" alt="${leadName}" style="max-height: 44px; max-width: 190px; object-fit: contain; filter: drop-shadow(0 0 10px rgba(255,255,255,0.2));">`
    : `<span style="font-weight: 800; font-size: 1.4rem; color: #ffffff; letter-spacing: -0.02em;">${leadName}</span>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${leadName} | Luxury Dark Edition 2026</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: ${brandPalette.primary};
      --primary-accent: ${brandPalette.accent};
      --bg: #070a12;
      --bg-surface: #0f1626;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --border-color: rgba(255, 255, 255, 0.09);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Outfit', -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text-main);
      line-height: 1.6;
      background-image: 
        radial-gradient(circle at 85% 10%, ${brandPalette.accent}24 0px, transparent 50%),
        radial-gradient(circle at 15% 45%, ${brandPalette.primary}22 0px, transparent 50%);
      background-attachment: fixed;
    }
    .dark-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 40px;
      background: rgba(7, 10, 18, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .dark-nav-cta {
      background: var(--primary-accent);
      color: #ffffff;
      padding: 10px 24px;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 0.9rem;
      text-decoration: none;
      box-shadow: 0 0 25px ${brandPalette.accent}55;
    }
    
    /* SPLIT HERO */
    .hero-split {
      max-width: 1240px;
      margin: 60px auto;
      padding: 0 24px;
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      grid-gap: 50px;
      align-items: center;
    }
    @media (max-width: 960px) { .hero-split { grid-template-columns: 1fr; } }
    .neon-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid ${brandPalette.accent}44;
      color: var(--primary-accent);
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 0.82rem;
      font-weight: 700;
      margin-bottom: 22px;
      box-shadow: 0 0 15px ${brandPalette.accent}22;
    }
    .hero-glow-title {
      font-size: clamp(2.4rem, 4.5vw, 3.8rem);
      font-weight: 900;
      line-height: 1.1;
      margin-bottom: 20px;
      color: #ffffff;
    }
    .hero-glow-title span {
      color: var(--primary-accent);
      text-shadow: 0 0 28px ${brandPalette.accent}55;
    }
    .hero-desc {
      color: var(--text-muted);
      font-size: 1.15rem;
      margin-bottom: 30px;
      max-width: 560px;
      font-family: 'Inter', sans-serif;
    }
    .hero-action-row { display: flex; gap: 16px; flex-wrap: wrap; }
    .btn-neon {
      background: var(--primary-accent);
      color: #ffffff;
      padding: 14px 32px;
      border-radius: 14px;
      font-weight: 800;
      text-decoration: none;
      box-shadow: 0 0 30px ${brandPalette.accent}66;
    }
    .btn-dark-sec {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      color: #fff;
      padding: 14px 28px;
      border-radius: 14px;
      font-weight: 700;
      text-decoration: none;
    }
    
    /* HOLOGRAPHIC CARD */
    .holo-card-wrap {
      position: relative;
    }
    .holo-card {
      background: var(--bg-surface);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 28px;
      padding: 12px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 60px ${brandPalette.accent}22;
    }
    .holo-card img {
      width: 100%;
      height: 400px;
      object-fit: cover;
      border-radius: 20px;
      display: block;
    }
    .holo-floating-badge {
      position: absolute;
      bottom: -18px;
      left: 24px;
      background: rgba(15, 22, 38, 0.95);
      border: 1px solid ${brandPalette.accent}55;
      padding: 10px 20px;
      border-radius: 16px;
      color: #fff;
      font-size: 0.88rem;
      font-weight: 800;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
    }

    /* TRUST STRIP */
    .dark-trust-strip {
      max-width: 1240px;
      margin: 80px auto 40px auto;
      padding: 24px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      grid-gap: 20px;
      text-align: center;
    }
    .strip-val { font-size: 1.8rem; font-weight: 900; color: var(--primary-accent); }
    .strip-lbl { font-size: 0.85rem; color: var(--text-muted); }

    /* SERVICES GRID */
    .services-dark-grid {
      max-width: 1240px;
      margin: 60px auto;
      padding: 0 24px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      grid-gap: 24px;
    }
    .dark-service-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 24px;
      padding: 28px;
      transition: transform 0.3s, border-color 0.3s, box-shadow 0.3s;
    }
    .dark-service-card:hover {
      border-color: ${brandPalette.accent}88;
      box-shadow: 0 0 30px ${brandPalette.accent}22;
      transform: translateY(-4px);
    }
    .dark-service-card img {
      width: 100%;
      height: 200px;
      object-fit: cover;
      border-radius: 16px;
      margin-bottom: 20px;
    }

    /* MIDNIGHT CTA */
    .midnight-cta {
      max-width: 1240px;
      margin: 90px auto;
      padding: 60px 36px;
      background: radial-gradient(circle at 50% 50%, ${brandPalette.primary}33 0%, var(--bg-surface) 100%);
      border: 1px solid ${brandPalette.accent}44;
      border-radius: 32px;
      text-align: center;
      box-shadow: 0 0 60px ${brandPalette.accent}22;
    }
    .midnight-cta h2 { font-size: 2.5rem; font-weight: 900; margin-bottom: 14px; }
    .midnight-cta p { font-size: 1.15rem; color: var(--text-muted); margin-bottom: 28px; }

    .dark-footer {
      border-top: 1px solid var(--border-color);
      padding: 40px 24px;
      text-align: center;
      font-size: 0.88rem;
      color: var(--text-muted);
    }

    /* BADGE */
    .trend-indicator-badge {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(15, 22, 38, 0.95);
      border: 1px solid ${brandPalette.accent}66;
      color: #ffffff;
      padding: 12px 18px;
      border-radius: 16px;
      font-size: 0.82rem;
      box-shadow: 0 0 30px ${brandPalette.accent}33;
      z-index: 999;
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-width: 320px;
    }
    .trend-tag { color: var(--primary-accent); font-weight: 800; text-transform: uppercase; font-size: 0.72rem; }
  </style>
</head>
<body>
  <nav class="dark-nav">
    <div style="display:flex; align-items:center; gap:12px;">
      ${logoHtml}
    </div>
    <a href="tel:${leadPhone}" class="dark-nav-cta">Solicitar Acceso Directo</a>
  </nav>

  <main class="hero-split">
    <div>
      <div class="neon-pill">
        ✨ Atmósfera de Alto Standing · ${trend.source}
      </div>
      <h1 class="hero-glow-title">Distinción Absoluta en <span>${leadName}</span></h1>
      <p class="hero-desc">
        Diseñado con la más avanzada tecnología visual inmersiva. Un ecosistema prémium para clientes exigentes en ${leadAddress}.
      </p>
      <div class="hero-action-row">
        <a href="tel:${leadPhone}" class="btn-neon">📞 Hablar con un Especialista</a>
        <a href="#servicios" class="btn-dark-sec">Conocer Soluciones</a>
      </div>
    </div>

    <div class="holo-card-wrap">
      <div class="holo-card">
        <img src="${catImages.hero}" referrerpolicy="no-referrer" alt="${leadName}">
      </div>
      <div class="holo-floating-badge">
        ⭐ ${leadRating} / 5 · Máxima Excelencia
      </div>
    </div>
  </main>

  <div class="dark-trust-strip">
    <div>
      <div class="strip-val">100%</div>
      <div class="strip-lbl">Garantía y Confianza</div>
    </div>
    <div>
      <div class="strip-val">⭐ ${leadRating}</div>
      <div class="strip-lbl">Calificación en Google Maps</div>
    </div>
    <div>
      <div class="strip-val">&lt; 1h</div>
      <div class="strip-lbl">Respuesta Prioritaria</div>
    </div>
    <div>
      <div class="strip-val">${leadAddress}</div>
      <div class="strip-lbl">Atención Presencial</div>
    </div>
  </div>

  <section id="servicios" class="services-dark-grid">
    <div class="dark-service-card">
      <img src="${catImages.service1}" referrerpolicy="no-referrer" alt="Servicio 1">
      <h3 style="font-size:1.35rem; font-weight:800; margin-bottom:8px;">Consultoría y Diagnóstico Exclusivo</h3>
      <p style="color:var(--text-muted); font-size:0.92rem;">Atención sin intermediarios para resolver cada caso con máxima precisión.</p>
    </div>
    <div class="dark-service-card">
      <img src="${catImages.service2}" referrerpolicy="no-referrer" alt="Servicio 2">
      <h3 style="font-size:1.35rem; font-weight:800; margin-bottom:8px;">Protocolos de Alta Gama</h3>
      <p style="color:var(--text-muted); font-size:0.92rem;">Estándares internacionales adaptados a las necesidades reales de tu sector.</p>
    </div>
    <div class="dark-service-card">
      <img src="${catImages.service3}" referrerpolicy="no-referrer" alt="Servicio 3">
      <h3 style="font-size:1.35rem; font-weight:800; margin-bottom:8px;">Soporte y Garantía Total</h3>
      <p style="color:var(--text-muted); font-size:0.92rem;">Seguimiento proactivo para asegurar el éxito de cada intervención.</p>
    </div>
  </section>

  <section class="midnight-cta">
    <h2>Eleva tu Experiencia con ${leadName}</h2>
    <p>Contacta de inmediato para coordinar tu cita o asesoramiento privado.</p>
    <a href="tel:${leadPhone}" class="btn-neon">📞 Contactar Directamente: ${leadPhone}</a>
  </section>

  <footer class="dark-footer">
    <p><strong>${leadName}</strong> · ${leadAddress} · Tel: ${leadPhone}</p>
    <p style="margin-top:6px; opacity:0.6;">Identidad de color extraída de ${websiteUrl}</p>
  </footer>

  <div class="trend-indicator-badge">
    <span class="trend-tag">✨ Tendencia Web (${trend.source})</span>
    <strong>${trend.trendTitle}</strong>
    <span style="font-size:0.75rem; opacity:0.8;">Arquetipo: Luxury Dark & Neon Glow</span>
  </div>
</body>
</html>`;
}

// ------------------------------------------------------------------------------------------------
// ARCHETYPE 4: NEO-BRUTALISM & SWISS MINIMAL (Figma & Gumroad Trends)
// ------------------------------------------------------------------------------------------------
function generateBrutalistMinimalHtml(
  leadName: string,
  websiteUrl: string,
  brandPalette: any,
  catImages: any,
  fallbackCat: any,
  leadPhone: string,
  leadAddress: string,
  leadRating: number,
  trend: DesignTrendReference
): string {
  const logoHtml = catImages.logo
    ? `<img src="${catImages.logo}" referrerpolicy="no-referrer" alt="${leadName}" style="max-height: 44px; max-width: 190px; object-fit: contain;">`
    : `<span style="font-family:'Syne', sans-serif; font-weight: 900; font-size: 1.45rem; color: #0f172a; text-transform: uppercase;">${leadName}</span>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${leadName} | Neo-Brutalism Edition 2026</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: ${brandPalette.primary};
      --primary-accent: ${brandPalette.accent};
      --bg: #ffffff;
      --border-dark: #0f172a;
      --hard-shadow: 5px 5px 0px #0f172a;
      --hard-shadow-lg: 8px 8px 0px #0f172a;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg);
      color: #0f172a;
      line-height: 1.6;
    }
    .brutalist-nav {
      border-bottom: 3px solid var(--border-dark);
      padding: 16px 36px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .brutalist-cta-btn {
      background: var(--primary-accent);
      color: #ffffff;
      border: 2.5px solid var(--border-dark);
      padding: 10px 22px;
      font-weight: 800;
      font-size: 0.9rem;
      text-decoration: none;
      box-shadow: 4px 4px 0px #0f172a;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .brutalist-cta-btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: 6px 6px 0px #0f172a;
    }
    
    /* HERO */
    .brutalist-hero {
      max-width: 1200px;
      margin: 50px auto;
      padding: 0 24px;
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      grid-gap: 40px;
      align-items: center;
    }
    @media (max-width: 900px) { .brutalist-hero { grid-template-columns: 1fr; } }
    .sticker-badge {
      display: inline-block;
      background: #fef08a;
      border: 2px solid var(--border-dark);
      color: #0f172a;
      padding: 6px 14px;
      font-weight: 900;
      font-size: 0.82rem;
      text-transform: uppercase;
      box-shadow: 3px 3px 0px #0f172a;
      margin-bottom: 18px;
    }
    .brutalist-title {
      font-family: 'Syne', sans-serif;
      font-size: clamp(2.4rem, 4.8vw, 3.8rem);
      font-weight: 900;
      text-transform: uppercase;
      line-height: 1.05;
      letter-spacing: -0.02em;
      margin-bottom: 20px;
    }
    .brutalist-title span {
      background: var(--primary);
      color: #ffffff;
      padding: 2px 8px;
    }
    .brutalist-desc {
      font-size: 1.15rem;
      color: #334155;
      font-weight: 500;
      margin-bottom: 28px;
      max-width: 520px;
    }
    .btn-brutal-main {
      background: var(--primary-accent);
      color: #ffffff;
      border: 3px solid var(--border-dark);
      padding: 14px 30px;
      font-weight: 900;
      font-size: 1rem;
      text-decoration: none;
      display: inline-block;
      box-shadow: var(--hard-shadow);
      margin-right: 14px;
      margin-bottom: 10px;
    }
    .btn-brutal-sec {
      background: #ffffff;
      color: #0f172a;
      border: 3px solid var(--border-dark);
      padding: 14px 26px;
      font-weight: 800;
      text-decoration: none;
      display: inline-block;
      box-shadow: var(--hard-shadow);
      margin-bottom: 10px;
    }
    
    .brutalist-img-box {
      border: 3px solid var(--border-dark);
      box-shadow: var(--hard-shadow-lg);
      background: var(--primary);
      padding: 14px;
      position: relative;
    }
    .brutalist-img-box img {
      width: 100%;
      height: 380px;
      object-fit: cover;
      border: 2px solid var(--border-dark);
      display: block;
    }
    .img-tag-stamp {
      position: absolute;
      top: -14px;
      right: -14px;
      background: #f43f5e;
      color: #fff;
      border: 2.5px solid var(--border-dark);
      padding: 6px 14px;
      font-weight: 900;
      font-size: 0.8rem;
      box-shadow: 3px 3px 0px #0f172a;
      transform: rotate(3deg);
    }

    /* TICKER */
    .brutalist-ticker {
      background: var(--border-dark);
      color: #ffffff;
      border-top: 3px solid var(--border-dark);
      border-bottom: 3px solid var(--border-dark);
      padding: 12px 0;
      margin: 40px 0;
      overflow: hidden;
      white-space: nowrap;
      font-weight: 900;
      font-size: 0.95rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    /* SERVICES */
    .services-sec { max-width: 1200px; margin: 60px auto; padding: 0 24px; }
    .services-grid-brutal {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      grid-gap: 26px;
    }
    .service-brutal-card {
      border: 3px solid var(--border-dark);
      box-shadow: var(--hard-shadow);
      padding: 24px;
      background: #ffffff;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .service-brutal-card:hover {
      transform: translate(-3px, -3px);
      box-shadow: 8px 8px 0px var(--border-dark);
    }
    .service-brutal-card img {
      width: 100%;
      height: 200px;
      object-fit: cover;
      border: 2px solid var(--border-dark);
      margin-bottom: 16px;
    }

    /* PROCESS NUMBERS */
    .process-brutal-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      grid-gap: 20px;
      margin-top: 30px;
    }
    .p-box-brutal {
      border: 2.5px solid var(--border-dark);
      box-shadow: 4px 4px 0px var(--border-dark);
      padding: 20px;
      background: #f8fafc;
    }
    .p-big-num {
      font-family: 'Syne', sans-serif;
      font-size: 2.5rem;
      font-weight: 900;
      color: var(--primary);
      line-height: 1;
      margin-bottom: 6px;
    }

    /* CTA */
    .cta-brutal {
      border: 3.5px solid var(--border-dark);
      box-shadow: var(--hard-shadow-lg);
      background: #fef08a;
      padding: 50px 30px;
      text-align: center;
      margin-top: 70px;
    }
    .cta-brutal h2 {
      font-family: 'Syne', sans-serif;
      font-size: 2.6rem;
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    .footer-brutal {
      border-top: 3px solid var(--border-dark);
      padding: 36px 24px;
      text-align: center;
      margin-top: 70px;
      font-weight: 700;
      font-size: 0.9rem;
    }

    /* BADGE */
    .trend-indicator-badge {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #ffffff;
      border: 2.5px solid var(--border-dark);
      box-shadow: 4px 4px 0px var(--border-dark);
      color: #0f172a;
      padding: 12px 18px;
      font-size: 0.82rem;
      z-index: 999;
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-width: 320px;
    }
    .trend-tag { color: var(--primary); font-weight: 900; text-transform: uppercase; font-size: 0.72rem; }
  </style>
</head>
<body>
  <nav class="brutalist-nav">
    <div style="display:flex; align-items:center;">
      ${logoHtml}
    </div>
    <a href="tel:${leadPhone}" class="brutalist-cta-btn">Pedir Cita Inmediata</a>
  </nav>

  <main class="brutalist-hero">
    <div>
      <div class="sticker-badge">★ Vanguardia Suiza · ${trend.source}</div>
      <h1 class="brutalist-title">Máxima Solvencia en <span>${leadName}</span></h1>
      <p class="brutalist-desc">
        Rigor técnico y atención sin intermediarios en ${leadAddress}. Construido para ser veloz, claro y resolutivo.
      </p>
      <div>
        <a href="tel:${leadPhone}" class="btn-brutal-main">📞 Llamar al ${leadPhone}</a>
        <a href="#servicios" class="btn-brutal-sec">Ver Especialidades</a>
      </div>
    </div>

    <div class="brutalist-img-box">
      <div class="img-tag-stamp">⭐ ${leadRating} / 5 LOCAL</div>
      <img src="${catImages.hero}" referrerpolicy="no-referrer" alt="${leadName}">
    </div>
  </main>

  <div class="brutalist-ticker">
    <div style="display:inline-block; animation: tickerLoop 20s linear infinite;">
      GARANTÍA DIRECTA · ${leadAddress.toUpperCase()} · SIN INTERMEDIARIOS · VALORACIÓN ⭐ ${leadRating} · ATENCIÓN 100% PERSONALIZADA · &nbsp;&nbsp;&nbsp;&nbsp;
      GARANTÍA DIRECTA · ${leadAddress.toUpperCase()} · SIN INTERMEDIARIOS · VALORACIÓN ⭐ ${leadRating} · ATENCIÓN 100% PERSONALIZADA · 
    </div>
  </div>

  <section id="servicios" class="services-sec">
    <h2 style="font-family:'Syne', sans-serif; font-size:2.2rem; font-weight:900; text-transform:uppercase; margin-bottom:24px; text-align:center;">
      Especialidades Clave
    </h2>
    <div class="services-grid-brutal">
      <div class="service-brutal-card">
        <img src="${catImages.service1}" referrerpolicy="no-referrer" alt="Servicio 1">
        <h3 style="font-size:1.25rem; font-weight:900; margin-bottom:8px;">Atención y Diagnóstico Inmediato</h3>
        <p style="color:#475569; font-size:0.92rem;">Evaluamos cada necesidad de forma ágil y transparente desde el primer instante.</p>
      </div>
      <div class="service-brutal-card">
        <img src="${catImages.service2}" referrerpolicy="no-referrer" alt="Servicio 2">
        <h3 style="font-size:1.25rem; font-weight:900; margin-bottom:8px;">Máximo Rigor Profesional</h3>
        <p style="color:#475569; font-size:0.92rem;">Ejecutamos cada servicio bajo los más altos estándares técnicos de nuestro sector.</p>
      </div>
      <div class="service-brutal-card">
        <img src="${catImages.service3}" referrerpolicy="no-referrer" alt="Servicio 3">
        <h3 style="font-size:1.25rem; font-weight:900; margin-bottom:8px;">Garantía y Confianza Local</h3>
        <p style="color:#475569; font-size:0.92rem;">Atención cercana y respaldo total en cada intervención realizada.</p>
      </div>
    </div>

    <!-- PROCESO -->
    <div style="margin-top:60px;">
      <h3 style="font-family:'Syne', sans-serif; font-size:1.8rem; font-weight:900; text-transform:uppercase; text-align:center;">Método de Trabajo</h3>
      <div class="process-brutal-grid">
        <div class="p-box-brutal">
          <div class="p-big-num">01</div>
          <h4 style="font-weight:900; margin-bottom:4px;">Contacto</h4>
          <p style="color:#475569; font-size:0.85rem;">Comunicación directa vía teléfono o WhatsApp.</p>
        </div>
        <div class="p-box-brutal">
          <div class="p-big-num">02</div>
          <h4 style="font-weight:900; margin-bottom:4px;">Propuesta</h4>
          <p style="color:#475569; font-size:0.85rem;">Presupuesto y valoración clara sin rodeos.</p>
        </div>
        <div class="p-box-brutal">
          <div class="p-big-num">03</div>
          <h4 style="font-weight:900; margin-bottom:4px;">Solución</h4>
          <p style="color:#475569; font-size:0.85rem;">Ejecución precisa con los mejores materiales.</p>
        </div>
        <div class="p-box-brutal">
          <div class="p-big-num">04</div>
          <h4 style="font-weight:900; margin-bottom:4px;">Cierre</h4>
          <p style="color:#475569; font-size:0.85rem;">Verificación final y satisfacción garantizada.</p>
        </div>
      </div>
    </div>

    <div class="cta-brutal">
      <h2>Habla Directamente con ${leadName}</h2>
      <p style="font-size:1.15rem; font-weight:600; margin-bottom:20px;">Llámanos ahora mismo para resolver cualquier consulta en ${leadAddress}.</p>
      <a href="tel:${leadPhone}" class="btn-brutal-main" style="background:#0f172a; color:#fff; font-size:1.1rem;">📞 Contactar: ${leadPhone}</a>
    </div>
  </section>

  <footer class="footer-brutal">
    <p>${leadName} · ${leadAddress} · Tel: ${leadPhone}</p>
    <p style="margin-top:4px; font-weight:500; font-size:0.8rem; opacity:0.8;">Identidad cromática oficial de ${websiteUrl}</p>
  </footer>

  <div class="trend-indicator-badge">
    <span class="trend-tag">✨ Tendencia Web (${trend.source})</span>
    <strong>${trend.trendTitle}</strong>
    <span style="font-size:0.75rem; opacity:0.8;">Arquetipo: Neo-Brutalism & Modern Architecture</span>
  </div>
</body>
</html>`;
}

// ------------------------------------------------------------------------------------------------
// ARCHETYPE 5: HAUTE CUISINE & BOUTIQUE HOSPITALITY (Michelin, Relais & Châteaux 2026)
// ------------------------------------------------------------------------------------------------
function generateCulinaryHospitalityHtml(
  leadName: string,
  websiteUrl: string,
  brandPalette: any,
  catImages: any,
  fallbackCat: any,
  leadPhone: string,
  leadAddress: string,
  leadRating: number,
  trend: DesignTrendReference
): string {
  const isHotel = /hotel|hostal|rural|turis|alojam|resort/i.test(`${leadName} ${trend.niche}`);
  const logoHtml = catImages.logo
    ? `<img src="${catImages.logo}" referrerpolicy="no-referrer" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline-block';" alt="${leadName}" style="max-height: 48px; max-width: 200px; object-fit: contain;"><span style="display:none; font-family:'Playfair Display',serif; font-weight:800; font-size:1.45rem; color:#f8fafc; letter-spacing:0.04em;">${leadName}</span>`
    : `<span style="font-family:'Playfair Display',serif; font-weight:800; font-size:1.45rem; color:#f8fafc; letter-spacing:0.04em; text-transform:uppercase;">${leadName}</span>`;

  const heroImg = catImages.hero || fallbackCat.hero;
  const s1Img = catImages.service1 || fallbackCat.service1;
  const s2Img = catImages.service2 || fallbackCat.service2;
  const s3Img = catImages.service3 || fallbackCat.service3;
  const av1Img = catImages.avatar1 || fallbackCat.avatar1;
  const av2Img = catImages.avatar2 || fallbackCat.avatar2;

  const todayStr = new Date().toISOString().split('T')[0];

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${leadName} | ${isHotel ? 'Boutique Hotel & Hospitalidad de Autor' : 'Alta Gastronomía & Reservas Oficiales'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600&family=Outfit:wght@300;400;500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: ${brandPalette.primary};
      --primary-accent: ${brandPalette.accent || '#d4af37'};
      --gold: #d4af37;
      --gold-light: #fef08a;
      --bg: #0b0d12;
      --bg-surface: #131720;
      --bg-card: rgba(22, 28, 40, 0.75);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --border-color: rgba(212, 175, 55, 0.2);
      --border-subtle: rgba(255, 255, 255, 0.08);
      --radius: 20px;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text-main);
      line-height: 1.65;
      background-image: 
        radial-gradient(at 0% 0%, ${brandPalette.primary}22 0px, transparent 50%),
        radial-gradient(at 100% 20%, ${brandPalette.accent}18 0px, transparent 40%),
        radial-gradient(at 50% 80%, rgba(212, 175, 55, 0.06) 0px, transparent 50%);
      background-attachment: fixed;
    }

    /* TOP NOTICE BAR */
    .culinary-topbar {
      background: rgba(11, 13, 18, 0.95);
      border-bottom: 1px solid var(--border-subtle);
      color: #cbd5e1;
      padding: 10px 24px;
      font-size: 0.82rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .culinary-topbar strong { color: var(--gold); }
    .topbar-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(212, 175, 55, 0.12);
      border: 1px solid rgba(212, 175, 55, 0.3);
      padding: 2px 10px;
      border-radius: 999px;
      color: var(--gold);
      font-size: 0.75rem;
      font-weight: 600;
    }

    /* NAVBAR */
    .culinary-nav {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(15, 19, 27, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border-subtle);
      padding: 18px 36px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .nav-links {
      display: flex;
      gap: 28px;
      list-style: none;
      align-items: center;
    }
    .nav-links a {
      color: #cbd5e1;
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      letter-spacing: 0.03em;
      transition: color 0.2s;
    }
    .nav-links a:hover { color: var(--gold); }
    @media (max-width: 900px) { .nav-links { display: none; } }
    .nav-actions { display: flex; align-items: center; gap: 14px; }
    .btn-nav-reserve {
      background: linear-gradient(135deg, var(--gold) 0%, #b8860b 100%);
      color: #0b0d12;
      font-weight: 700;
      font-size: 0.88rem;
      padding: 10px 22px;
      border-radius: 999px;
      text-decoration: none;
      box-shadow: 0 4px 18px rgba(212, 175, 55, 0.35);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn-nav-reserve:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(212, 175, 55, 0.5);
    }

    /* HERO GASTRONÓMICO / BOUTIQUE */
    .culinary-hero {
      max-width: 1260px;
      margin: 40px auto 60px;
      padding: 0 24px;
      display: grid;
      grid-template-columns: 1.15fr 0.95fr;
      gap: 40px;
      align-items: center;
    }
    @media (max-width: 960px) { .culinary-hero { grid-template-columns: 1fr; margin-top: 20px; } }

    .hero-badge-tag {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(212, 175, 55, 0.1);
      border: 1px solid rgba(212, 175, 55, 0.35);
      color: var(--gold);
      padding: 6px 16px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      margin-bottom: 20px;
      text-transform: uppercase;
    }
    .hero-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(2.4rem, 4.5vw, 3.8rem);
      line-height: 1.15;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 20px;
      letter-spacing: -0.02em;
    }
    .hero-title em {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-style: italic;
      color: var(--gold);
      font-weight: 400;
    }
    .hero-desc {
      font-size: 1.05rem;
      color: #94a3b8;
      margin-bottom: 30px;
      line-height: 1.7;
      max-width: 580px;
    }

    /* MOTOR DE RESERVAS WIDGET */
    .booking-engine-box {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: 24px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45), 0 0 40px rgba(212, 175, 55, 0.08);
      backdrop-filter: blur(16px);
      margin-bottom: 24px;
    }
    .booking-engine-title {
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--gold);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .booking-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    @media (max-width: 640px) { .booking-grid { grid-template-columns: 1fr; } }
    .booking-field label {
      display: block;
      font-size: 0.72rem;
      text-transform: uppercase;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: 6px;
    }
    .booking-input {
      width: 100%;
      background: rgba(11, 13, 18, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      padding: 10px 12px;
      color: #ffffff;
      font-size: 0.88rem;
      font-family: inherit;
      outline: none;
    }
    .booking-input:focus { border-color: var(--gold); }
    .btn-booking-confirm {
      width: 100%;
      background: linear-gradient(135deg, var(--gold) 0%, #b8860b 100%);
      color: #0b0d12;
      border: none;
      border-radius: 12px;
      padding: 14px 20px;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn-booking-confirm:hover {
      box-shadow: 0 8px 24px rgba(212, 175, 55, 0.4);
      transform: translateY(-2px);
    }

    /* HERO VISUAL FRAME */
    .hero-visual-frame {
      position: relative;
    }
    .hero-visual-img {
      width: 100%;
      height: 520px;
      object-fit: cover;
      border-radius: 28px;
      border: 1px solid var(--border-color);
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
      display: block;
    }
    .hero-michelin-badge {
      position: absolute;
      top: 24px;
      right: 24px;
      background: rgba(15, 19, 27, 0.9);
      border: 1px solid var(--gold);
      border-radius: 16px;
      padding: 12px 18px;
      color: #ffffff;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(12px);
      text-align: center;
    }
    .hero-michelin-badge span { display: block; font-size: 0.7rem; color: var(--gold); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .hero-michelin-badge strong { font-size: 1.15rem; color: #fff; font-family: 'Playfair Display', serif; }
    
    .hero-rating-badge {
      position: absolute;
      bottom: 24px;
      left: 24px;
      background: rgba(15, 19, 27, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      padding: 14px 20px;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 14px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(12px);
    }

    /* DISTINCTIONS STRIP */
    .distinctions-strip {
      border-top: 1px solid var(--border-subtle);
      border-bottom: 1px solid var(--border-subtle);
      background: rgba(19, 23, 32, 0.4);
      padding: 24px 0;
      margin: 40px 0;
    }
    .distinctions-grid {
      max-width: 1260px;
      margin: 0 auto;
      padding: 0 24px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      text-align: center;
    }
    @media (max-width: 800px) { .distinctions-grid { grid-template-columns: repeat(2, 1fr); } }
    .distinction-item strong { display: block; color: #fff; font-size: 0.95rem; margin-top: 4px; }
    .distinction-item span { font-size: 0.78rem; color: var(--gold); text-transform: uppercase; letter-spacing: 0.05em; }

    /* CARTA GASTRONÓMICA INTERACTIVA */
    .menu-section {
      max-width: 1260px;
      margin: 80px auto;
      padding: 0 24px;
    }
    .section-header-centered {
      text-align: center;
      max-width: 700px;
      margin: 0 auto 50px;
    }
    .section-eyebrow {
      font-size: 0.8rem;
      color: var(--gold);
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 10px;
      display: block;
    }
    .section-heading {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(2rem, 3.5vw, 2.8rem);
      color: #ffffff;
      margin-bottom: 14px;
    }
    .menu-dishes-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 28px;
    }
    @media (max-width: 960px) { .menu-dishes-grid { grid-template-columns: 1fr; } }
    .dish-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 20px;
      overflow: hidden;
      transition: transform 0.25s, border-color 0.25s, box-shadow 0.25s;
    }
    .dish-card:hover {
      transform: translateY(-6px);
      border-color: var(--border-color);
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4), 0 0 24px rgba(212, 175, 55, 0.12);
    }
    .dish-img-wrap {
      position: relative;
      height: 220px;
      overflow: hidden;
    }
    .dish-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.4s;
    }
    .dish-card:hover .dish-img { transform: scale(1.05); }
    .dish-badge {
      position: absolute;
      top: 14px;
      left: 14px;
      background: rgba(11, 13, 18, 0.85);
      border: 1px solid var(--gold);
      color: var(--gold);
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .dish-body {
      padding: 24px;
    }
    .dish-title-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 10px;
      gap: 12px;
    }
    .dish-name {
      font-family: 'Playfair Display', serif;
      font-size: 1.25rem;
      color: #ffffff;
      font-weight: 700;
    }
    .dish-price {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--gold);
      white-space: nowrap;
    }
    .dish-desc {
      font-size: 0.88rem;
      color: #94a3b8;
      line-height: 1.6;
      margin-bottom: 16px;
    }
    .dish-pairing {
      background: rgba(212, 175, 55, 0.08);
      border-left: 2px solid var(--gold);
      padding: 8px 12px;
      border-radius: 0 8px 8px 0;
      font-size: 0.78rem;
      color: #cbd5e1;
    }

    /* EL ESPACIO & LA SALA */
    .space-section {
      max-width: 1260px;
      margin: 80px auto;
      padding: 0 24px;
    }
    .space-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      align-items: center;
    }
    @media (max-width: 900px) { .space-grid { grid-template-columns: 1fr; } }
    .space-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius);
      padding: 36px;
    }
    .space-feature-list {
      list-style: none;
      margin-top: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .space-feature-item {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }
    .space-feature-icon {
      background: rgba(212, 175, 55, 0.15);
      border: 1px solid var(--gold);
      color: var(--gold);
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      flex-shrink: 0;
    }

    /* REVIEWS */
    .reviews-section {
      max-width: 1260px;
      margin: 80px auto;
      padding: 0 24px;
    }
    .reviews-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    @media (max-width: 800px) { .reviews-grid { grid-template-columns: 1fr; } }
    .review-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius);
      padding: 30px;
      position: relative;
    }
    .review-quote {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-style: italic;
      font-size: 1.25rem;
      color: #e2e8f0;
      line-height: 1.6;
      margin-bottom: 20px;
    }
    .review-author {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .review-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid var(--gold);
    }

    /* RESERVATION CALLOUT BANNER */
    .reservation-banner {
      max-width: 1260px;
      margin: 80px auto;
      padding: 60px 40px;
      background: linear-gradient(135deg, rgba(19, 23, 32, 0.95) 0%, rgba(30, 20, 20, 0.95) 100%);
      border: 1px solid var(--border-color);
      border-radius: 28px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
      position: relative;
      overflow: hidden;
    }
    .reservation-banner h2 {
      font-family: 'Playfair Display', serif;
      font-size: clamp(2rem, 3.5vw, 3rem);
      color: #ffffff;
      margin-bottom: 14px;
    }
    .banner-actions {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-top: 30px;
      flex-wrap: wrap;
    }
    .btn-gold-big {
      background: linear-gradient(135deg, var(--gold) 0%, #b8860b 100%);
      color: #0b0d12;
      font-weight: 700;
      font-size: 1.05rem;
      padding: 16px 36px;
      border-radius: 999px;
      text-decoration: none;
      box-shadow: 0 6px 24px rgba(212, 175, 55, 0.4);
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .btn-secondary-dark {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #fff;
      font-weight: 600;
      font-size: 1.05rem;
      padding: 16px 32px;
      border-radius: 999px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }

    /* FOOTER */
    .culinary-footer {
      border-top: 1px solid var(--border-subtle);
      background: #090b0e;
      padding: 50px 24px 40px;
      text-align: center;
      color: #94a3b8;
      font-size: 0.88rem;
    }
    .footer-brand {
      font-family: 'Playfair Display', serif;
      font-size: 1.4rem;
      color: #fff;
      margin-bottom: 10px;
    }

    .trend-indicator-badge {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(15, 19, 27, 0.95);
      border: 1px solid var(--gold);
      border-radius: 14px;
      padding: 10px 16px;
      color: #ffffff;
      font-size: 0.8rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      z-index: 1000;
      backdrop-filter: blur(10px);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .trend-tag { color: var(--gold); font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
  </style>
</head>
<body>

  <!-- TOP NOTICE BAR -->
  <aside class="culinary-topbar">
    <div>
      <span class="topbar-badge">✨ Experiencia 2026</span>
      <strong>${isHotel ? 'Recepción & Concierge 24/7' : 'Servicio Gastronómico'}:</strong>
      ${isHotel ? 'Check-in: 15:00 · Desayuno Gourmet incluido' : 'Almuerzos: 13:00 - 16:30 · Cenas: 20:00 - 23:45'}
    </div>
    <div>
      📍 ${leadAddress} · 📞 Reservas directas: <a href="tel:${leadPhone}" style="color:var(--gold); font-weight:700; text-decoration:none;">${leadPhone}</a>
    </div>
  </aside>

  <!-- NAVBAR -->
  <header class="culinary-nav">
    <div class="logo-wrap">
      ${logoHtml}
    </div>
    <ul class="nav-links">
      <li><a href="#inicio">Inicio</a></li>
      <li><a href="#carta">${isHotel ? 'Suites & Servicios' : 'Nuestra Carta'}</a></li>
      <li><a href="#experiencia">La Experiencia</a></li>
      <li><a href="#bodega">${isHotel ? 'Wellness & Bodega' : 'Bodega & Maridaje'}</a></li>
      <li><a href="#espacio">El Espacio</a></li>
      <li><a href="#reservas">Reservas</a></li>
    </ul>
    <div class="nav-actions">
      <a href="#reservas" class="btn-nav-reserve">🍽️ Reservar Mesa</a>
    </div>
  </header>

  <!-- HERO SECTION -->
  <section class="culinary-hero" id="inicio">
    <div class="hero-content">
      <div class="hero-badge-tag">
        ⭐ ${isHotel ? 'Hospitalidad de Autor & Confort' : 'Alta Gastronomía & Tradición'} · ${leadAddress}
      </div>
      <h1 class="hero-title">
        Donde el sabor se convierte en un <em>arte inolvidable.</em>
      </h1>
      <p class="hero-desc">
        ${isHotel 
          ? `Disfruta del confort y la distinción en ${leadName}. Habitaciones de autor, atención personalizada y el encanto inigualable de ${leadAddress}.` 
          : `Bienvenido a ${leadName}. Una propuesta culinaria guiada por el respeto al producto de temporada, técnicas de autor y una bodega con más de 80 referencias seleccionadas.`}
      </p>

      <!-- MOTOR DE RESERVAS WIDGET -->
      <div class="booking-engine-box">
        <div class="booking-engine-title">
          <span>📅</span> ${isHotel ? 'Motor de Disponibilidad & Estancias' : 'Motor de Reservas Directas de Mesa'}
        </div>
        <div class="booking-grid">
          <div class="booking-field">
            <label>Fecha de Reserva</label>
            <input type="date" value="${todayStr}" class="booking-input">
          </div>
          <div class="booking-field">
            <label>${isHotel ? 'Huéspedes' : 'Comensales'}</label>
            <select class="booking-input">
              <option>2 Personas (Mesa Íntima)</option>
              <option>4 Personas</option>
              <option>6 Personas</option>
              <option>8+ Personas (Grupo)</option>
            </select>
          </div>
          <div class="booking-field">
            <label>Turno / Horario</label>
            <select class="booking-input">
              <option>Almuerzo · 14:00</option>
              <option>Almuerzo · 15:00</option>
              <option>Cena · 20:30</option>
              <option>Cena · 21:30</option>
              <option>Cena · 22:30</option>
              <option>Terraza Climatizada</option>
            </select>
          </div>
        </div>
        <a href="tel:${leadPhone}" class="btn-booking-confirm">
          🍽️ Confirmar Reserva de Mesa · ${leadPhone}
        </a>
      </div>
    </div>

    <!-- HERO VISUAL -->
    <div class="hero-visual-frame">
      <img src="${heroImg}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${fallbackCat.hero}';" class="hero-visual-img" alt="${leadName}">
      
      <div class="hero-michelin-badge">
        <span>Guía de Excelencia</span>
        <strong>Recomendado 2026</strong>
      </div>

      <div class="hero-rating-badge">
        <div style="font-size:1.8rem; color:var(--gold); font-weight:800;">${leadRating} ★</div>
        <div>
          <strong style="display:block; font-size:0.9rem;">Valoración Oficial en Google</strong>
          <span style="font-size:0.75rem; color:#94a3b8;">Opiniones verificadas de clientes</span>
        </div>
      </div>
    </div>
  </section>

  <!-- DISTINCTIONS STRIP -->
  <aside class="distinctions-strip">
    <div class="distinctions-grid">
      <div class="distinction-item">
        <span>Distinción Culinaria</span>
        <strong>🏆 Recomendado Gastronómico 2026</strong>
      </div>
      <div class="distinction-item">
        <span>Materia Prima</span>
        <strong>🌿 Producto de Temporada & Km 0</strong>
      </div>
      <div class="distinction-item">
        <span>Cava & Maridaje</span>
        <strong>🍷 Selección Exclusiva de Sumiller</strong>
      </div>
      <div class="distinction-item">
        <span>Experiencia Cliente</span>
        <strong>⭐ ${leadRating}/5 Satisfacción Garantizada</strong>
      </div>
    </div>
  </aside>

  <!-- CARTA GASTRONÓMICA INTERACTIVA -->
  <section class="menu-section" id="carta">
    <div class="section-header-centered">
      <span class="section-eyebrow">Gastronomía de Vanguardia</span>
      <h2 class="section-heading">Nuestra Carta & Especialidades</h2>
      <p style="color:#94a3b8; font-size:0.95rem;">
        Platos elaborados al momento con ingredientes nobles de lonja y huerto propio, respetando las texturas y potenciando cada matiz de sabor.
      </p>
    </div>

    <div class="menu-dishes-grid">
      <!-- PLATO 1 -->
      <article class="dish-card">
        <div class="dish-img-wrap">
          <img src="${s1Img}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${fallbackCat.service1}';" class="dish-img" alt="Especialidad 1">
          <span class="dish-badge">Especialidad de la Casa</span>
        </div>
        <div class="dish-body">
          <div class="dish-title-row">
            <h3 class="dish-name">Solomillo de Autor a la Brasa</h3>
            <span class="dish-price">26,50 €</span>
          </div>
          <p class="dish-desc">Corte madurado durante 45 días, asado a fuego de sarmiento con reducción de vino añejo y guarnición de patata trufada.</p>
          <div class="dish-pairing">🍷 <strong>Maridaje:</strong> Tinto Reserva D.O. de cuerpo intenso.</div>
        </div>
      </article>

      <!-- PLATO 2 -->
      <article class="dish-card">
        <div class="dish-img-wrap">
          <img src="${s2Img}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${fallbackCat.service2}';" class="dish-img" alt="Especialidad 2">
          <span class="dish-badge">Del Cantábrico</span>
        </div>
        <div class="dish-body">
          <div class="dish-title-row">
            <h3 class="dish-name">Arroz Meloso con Bogavante</h3>
            <span class="dish-price">24,00 €</span>
          </div>
          <p class="dish-desc">Fondo reducido de marisco con azafrán en hebra, bogavante fresco y emulsión suave de alioli de ajo asado.</p>
          <div class="dish-pairing">🥂 <strong>Maridaje:</strong> Blanco fermentado en barrica o espumoso brut nature.</div>
        </div>
      </article>

      <!-- PLATO 3 -->
      <article class="dish-card">
        <div class="dish-img-wrap">
          <img src="${s3Img}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${fallbackCat.service3}';" class="dish-img" alt="Especialidad 3">
          <span class="dish-badge">Sugerencia del Chef</span>
        </div>
        <div class="dish-body">
          <div class="dish-title-row">
            <h3 class="dish-name">Tartar Templado de Salmón & Aguacate</h3>
            <span class="dish-price">19,50 €</span>
          </div>
          <p class="dish-desc">Dados de salmón salvaje macerado en cítricos y soja suave, base de aguacate cremoso y toques crujientes de alga nori.</p>
          <div class="dish-pairing">🍷 <strong>Maridaje:</strong> Rosado fresco o Albariño sobre lías.</div>
        </div>
      </article>
    </div>
  </section>

  <!-- EL ESPACIO & LA SALA -->
  <section class="space-section" id="espacio">
    <div class="space-grid">
      <div class="space-card">
        <span class="section-eyebrow">Hospitalidad de Alto Nivel</span>
        <h2 style="font-family:'Playfair Display',serif; font-size:2.2rem; color:#fff; margin-bottom:16px;">
          Un refugio de calma y sofisticación en ${leadAddress}
        </h2>
        <p style="color:#94a3b8; font-size:0.95rem; line-height:1.7;">
          Cada rincón de ${leadName} ha sido concebido para proporcionar una desconexión absoluta. Desde la acústica estudiada de la sala hasta el servicio de mesa impecable, cuidamos cada segundo de tu velada.
        </p>
        <ul class="space-feature-list">
          <li class="space-feature-item">
            <div class="space-feature-icon">🕯️</div>
            <div>
              <strong style="display:block; color:#fff; font-size:0.95rem;">Sala Principal Íntima</strong>
              <span style="font-size:0.84rem; color:#94a3b8;">Mesas espaciadas con mantelería fina y privacidad total.</span>
            </div>
          </li>
          <li class="space-feature-item">
            <div class="space-feature-icon">🍇</div>
            <div>
              <strong style="display:block; color:#fff; font-size:0.95rem;">Cava Privada & Degustación</strong>
              <span style="font-size:0.84rem; color:#94a3b8;">Visitas guiadas por nuestro sumiller y catas personalizadas.</span>
            </div>
          </li>
          <li class="space-feature-item">
            <div class="space-feature-icon">🌿</div>
            <div>
              <strong style="display:block; color:#fff; font-size:0.95rem;">Terraza Climatizada & Eventos</strong>
              <span style="font-size:0.84rem; color:#94a3b8;">Espacio reservable para comidas de empresa o celebraciones exclusivas.</span>
            </div>
          </li>
        </ul>
      </div>

      <div>
        <img src="${heroImg}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${fallbackCat.hero}';" style="width:100%; height:460px; object-fit:cover; border-radius:24px; border:1px solid var(--border-color); box-shadow:0 20px 50px rgba(0,0,0,0.5);" alt="Espacio y Sala">
      </div>
    </div>
  </section>

  <!-- RESEÑAS VERIFICADAS -->
  <section class="reviews-section" id="experiencia">
    <div class="section-header-centered">
      <span class="section-eyebrow">La Opinión de Nuestros Clientes</span>
      <h2 class="section-heading">Momentos Culinarios Inolvidables</h2>
    </div>

    <div class="reviews-grid">
      <article class="review-card">
        <div style="color:var(--gold); margin-bottom:12px; font-size:1.1rem;">★★★★★</div>
        <p class="review-quote">
          "Una de las experiencias gastronómicas más sorprendentes de la zona. El trato del personal fue excepcional y el punto de las carnes sencillamente perfecto."
        </p>
        <div class="review-author">
          <img src="${av1Img}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${fallbackCat.avatar1}';" class="review-avatar" alt="Comensal">
          <div>
            <strong style="display:block; color:#fff; font-size:0.92rem;">Elena Gómez</strong>
            <span style="font-size:0.75rem; color:#94a3b8;">Cliente recurrente en Google Maps</span>
          </div>
        </div>
      </article>

      <article class="review-card">
        <div style="color:var(--gold); margin-bottom:12px; font-size:1.1rem;">★★★★★</div>
        <p class="review-quote">
          "Ambiente íntimo, servicio impecable y una carta de vinos con joyas que no encuentras en otros lugares. Totalmente recomendable para una ocasión especial."
        </p>
        <div class="review-author">
          <img src="${av2Img}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${fallbackCat.avatar2}';" class="review-avatar" alt="Comensal">
          <div>
            <strong style="display:block; color:#fff; font-size:0.92rem;">Carlos Mendizábal</strong>
            <span style="font-size:0.75rem; color:#94a3b8;">Crítica gastronómica verificada</span>
          </div>
        </div>
      </article>
    </div>
  </section>

  <!-- BANNER FINAL DE RESERVAS -->
  <section class="reservation-banner" id="reservas">
    <span class="section-eyebrow">Asegura tu Mesa</span>
    <h2>Reserva Directa sin Intermediarios</h2>
    <p style="color:#cbd5e1; max-width:620px; margin:0 auto; font-size:1.05rem;">
      Garantizamos la mejor ubicación en sala y confirmación inmediata. Para reservas de grupos superiores a 8 personas o eventos privados, contacta directamente con nuestro equipo.
    </p>

    <div class="banner-actions">
      <a href="tel:${leadPhone}" class="btn-gold-big">
        📞 Llamar para Reservar: ${leadPhone}
      </a>
      <a href="https://wa.me/${leadPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${leadName}, deseo reservar mesa para una experiencia gastronómica.`)}" target="_blank" class="btn-secondary-dark">
        💬 Reservar por WhatsApp
      </a>
    </div>
    <p style="margin-top:20px; font-size:0.78rem; color:#94a3b8;">
      Aviso de cortesía: Se ruega notificar modificaciones de comensales con 2 horas de antelación.
    </p>
  </section>

  <!-- FOOTER -->
  <footer class="culinary-footer">
    <div class="footer-brand">${leadName}</div>
    <p style="margin-bottom:6px;">${leadAddress} · Teléfono directo: ${leadPhone}</p>
    <p style="font-size:0.78rem; opacity:0.7;">Propuesta conceptual de alta costura web · Identidad cromática oficial de ${websiteUrl}</p>
  </footer>

  <!-- WATERMARK TREND BADGE -->
  <div class="trend-indicator-badge">
    <span class="trend-tag">✨ Tendencia Web (${trend.source})</span>
    <strong>${trend.trendTitle}</strong>
    <span style="font-size:0.75rem; opacity:0.8;">Arquetipo: Haute Cuisine & Hospitality Vanguard 2026</span>
  </div>

</body>
</html>`;
}
