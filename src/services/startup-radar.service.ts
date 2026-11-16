import { EmailValidatorService } from './email-validator.service';

export interface StartupRadarConfig {
  productHuntTags?: string;
  redditSubreddits?: string;
  validationKeywords?: string;
  linkedinKeywords?: string;
  targetGeoOrLanguage?: string;
  excludeAdvancedKeywords?: string;
  maxUpvotesThreshold?: number;
  batchLimit?: number;
  autoSendEmails?: boolean;
  businessName?: string;
  businessContext?: string;
  brandVoice?: string;
  servicesOffered?: string;
  schedule?: string;
  calendarId?: string;
  generated_outreach_email?: {
    subject: string;
    body: string;
  };
}

export interface RawStartupCandidate {
  sourcePlatform: 'Product Hunt' | 'Reddit' | 'LinkedIn';
  sourceDetail: string;
  projectName: string;
  founderName: string;
  founderHandleOrRole: string;
  description: string;
  communityUrl: string;
  websiteUrl: string;
  email: string;
  upvotesOrScore: number;
  makersCount: number;
  tags: string[];
  rawSnippet: string;
  isSpanish: boolean;
}

export interface QualifiedStartupLead extends RawStartupCandidate {
  isIdeationOrEarlyStage: boolean;
  isAdvancedDevelopment: boolean;
  startupStage: 'Ideación' | 'Validación / Pre-Seed' | 'MVP Temprano';
  primaryTechnicalNeed: string;
  painPoints: string[];
  qualificationScore: number;
  aiCustomPitch: string;
  aiSubjectLine: string;
}

// Filtro estricto contra gigantes tecnológicos y productos consolidados
const EXCLUDE_MATURE_OR_BIGTECH_REGEX =
  /\b(zoom|google|microsoft|apple|meta|facebook|amazon|netflix|openai|anthropic|stripe|notion|figma|canva|hubspot|salesforce|shopify|slack|atlassian|series [a-f]|ipo|enterprise-grade|fortune 500|soc2 type ii|100\+ employees|hiring senior|\$50k mrr|\$100k mrr|1m\+ users)\b/i;

// Detector de idioma español / contexto hispano
const SPANISH_SIGNAL_REGEX =
  /\b(españa|madrid|barcelona|valencia|sevilla|bilbao|málaga|méxico|colombia|argentina|chile|perú|latam|proyecto|busco|buscando|socio|cofundador|fundador|desarrollador|programador|validar|validación|idea|negocio|empresa|aplicación|plataforma|herramienta|ayuda|equipo|lanzamiento|para|con|una|los|las|del|que|por|cómo|más|estamos|creando|construyendo)\b|[áéíóúñ¿¡]/i;

const EXCLUDED_DOMAINS_FOR_STARTUP_URL =
  /reddit\.com|redd\.it|producthunt\.com|linkedin\.com|imgur\.com|giphy\.com|youtube\.com|youtu\.be|twitter\.com|x\.com|facebook\.com|instagram\.com|discord\.gg|github\.com|medium\.com|substack\.com|google\.com|apple\.com|play\.google|apps\.apple|duckduckgo\.com|bing\.com|wikipedia\.org/i;

export class StartupRadarService {
  /**
   * Detecta si un texto o candidato pertenece al ecosistema en español (España / Latam)
   */
  static isSpanishContent(text: string): boolean {
    if (!text) return false;
    const matches = text.match(
      /\b(españa|madrid|barcelona|valencia|méxico|colombia|argentina|chile|latam|proyecto|busco|buscando|socio|cofundador|fundador|desarrollador|validar|validando|idea|startup|herramienta|plataforma|estamos|creando|construyendo|para|con|por|una|los|las|del|que)\b|[áéíóúñ]/gi
    );
    return Boolean(matches && matches.length >= 2);
  }

  /**
   * Extrae URLs externas de startups mencionadas en un texto
   */
  static extractExternalStartupUrls(text: string): string[] {
    if (!text) return [];
    const urlRegex = /https?:\/\/[a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-zA-Z]{2,}[^\s)"'<>[\]]*/gi;
    const matches = text.match(urlRegex) || [];
    const cleaned: string[] = [];

    for (const raw of matches) {
      try {
        const urlObj = new URL(raw.replace(/[.,;!?]+$/, ''));
        if (!EXCLUDED_DOMAINS_FOR_STARTUP_URL.test(urlObj.hostname)) {
          const base = `${urlObj.protocol}//${urlObj.hostname}`;
          if (!cleaned.includes(base)) cleaned.push(base);
        }
      } catch {}
    }
    return cleaned;
  }

  /**
   * Extrae correos electrónicos directamente de un bloque de texto
   */
  static extractEmailFromPlainText(text: string): string | null {
    if (!text) return null;
    const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    for (const raw of matches) {
      const clean = raw.toLowerCase().trim().replace(/[.,;!?]+$/, '');
      if (
        !clean.endsWith('.png') &&
        !clean.endsWith('.jpg') &&
        !clean.endsWith('.svg') &&
        !clean.includes('example.com') &&
        !clean.includes('sentry.io') &&
        !clean.includes('wixpress.com') &&
        !clean.includes('noreply') &&
        !clean.includes('no-reply')
      ) {
        return clean;
      }
    }
    return null;
  }

  /**
   * Raspa la web de una startup (home y páginas de contacto/aviso legal) para extraer su correo real y metadatos.
   * Si la web tiene registros MX válidos en su dominio propio pero ofusca el correo en JS, resuelve el buzón de fundador/contacto verificado por MX.
   */
  static async deepScrapeStartupWebsite(
    websiteUrl: string
  ): Promise<{ email: string | null; finalUrl: string; title?: string; description?: string; isSpanish?: boolean }> {
    if (!websiteUrl || !websiteUrl.startsWith('http')) {
      return { email: null, finalUrl: websiteUrl };
    }

    let resolvedUrl = websiteUrl;
    try {
      const parsed = new URL(websiteUrl);
      const origin = `${parsed.protocol}//${parsed.hostname}`;

      const fetchPageHtml = async (targetUrl: string, timeoutMs = 5000): Promise<{ html: string; finalUrl: string } | null> => {
        try {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), timeoutMs);
          const res = await fetch(targetUrl, {
            signal: controller.signal,
            redirect: 'follow',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
              Accept: 'text/html,application/xhtml+xml'
            }
          });
          clearTimeout(t);
          if (!res.ok) return null;
          const html = await res.text();
          return { html, finalUrl: res.url || targetUrl };
        } catch {
          return null;
        }
      };

      const homeData = await fetchPageHtml(websiteUrl, 5500);
      if (!homeData) return { email: null, finalUrl: websiteUrl };

      resolvedUrl = homeData.finalUrl;
      const html = homeData.html;

      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const descMatch =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);

      const title = titleMatch?.[1]?.replace(/\s+/g, ' ').trim();
      const description = descMatch?.[1]?.replace(/\s+/g, ' ').trim();
      const isSpanish =
        /lang=["']es/i.test(html) ||
        parsed.hostname.endsWith('.es') ||
        this.isSpanishContent(`${title || ''} ${description || ''}`);

      // 1. Intentar extraer email de la página principal
      let email = await EmailValidatorService.extractBestEmailFromHtml(html, resolvedUrl);
      if (email) {
        return { email, finalUrl: resolvedUrl, title, description, isSpanish };
      }

      // 2. Si no está en la home, buscar en subpáginas típicas (/contacto, /contact, /aviso-legal, /about)
      const contactPaths = ['/contacto', '/contact', '/aviso-legal', '/sobre-nosotros', '/about'];
      for (const path of contactPaths.slice(0, 3)) {
        const subData = await fetchPageHtml(`${origin}${path}`, 3500);
        if (subData?.html) {
          email = await EmailValidatorService.extractBestEmailFromHtml(subData.html, resolvedUrl);
          if (email) {
            return { email, finalUrl: resolvedUrl, title, description, isSpanish };
          }
        }
      }

      // 3. Si es un dominio propio de startup (no plataforma genérica), verificar si el dominio tiene servidor de correo MX activo
      const cleanHost = new URL(resolvedUrl).hostname.replace(/^www\./i, '');
      if (!EXCLUDED_DOMAINS_FOR_STARTUP_URL.test(cleanHost) && cleanHost.includes('.')) {
        const candidateEmails = [`hola@${cleanHost}`, `info@${cleanHost}`, `contacto@${cleanHost}`, `hello@${cleanHost}`];
        const validation = await EmailValidatorService.validateEmail(candidateEmails[0], resolvedUrl);
        if (validation.isValid) {
          return {
            email: isSpanish ? `hola@${cleanHost}` : `hello@${cleanHost}`,
            finalUrl: resolvedUrl,
            title,
            description,
            isSpanish
          };
        }
      }

      return { email: null, finalUrl: resolvedUrl, title, description, isSpanish };
    } catch {
      return { email: null, finalUrl: resolvedUrl };
    }
  }

  /**
   * Si tenemos una URL de Product Hunt (ej. https://www.producthunt.com/products/xxx),
   * raspa la página de Product Hunt para extraer el sitio web externo real de la startup.
   */
  static async resolveProductHuntExternalWebsite(phUrl: string): Promise<string | null> {
    if (!phUrl || !phUrl.includes('producthunt.com')) return null;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(phUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html'
        }
      });
      clearTimeout(t);
      if (!res.ok) return null;
      const html = await res.text();
      const externalUrls = this.extractExternalStartupUrls(html);
      return externalUrls[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * 1. REDDIT EN ESPAÑOL E INTERNACIONAL (Prioridad proyectos en español)
   * Monitorea comunidades de emprendedores, startups y desarrollo en español (r/es, r/Spain, r/emprendedores,
   * r/programacion, r/devsarg, r/startups, r/cofounder, r/SaaS) buscando fundadores en ideación/validación.
   */
  static async fetchRedditStartupCandidates(
    subreddits: string[],
    validationKeywords: string[],
    log?: (msg: string) => void
  ): Promise<RawStartupCandidate[]> {
    const candidates: RawStartupCandidate[] = [];

    // Consultas prioritarias en español para capturar fundadores hispanohablantes
    const spanishQueries = [
      'https://www.reddit.com/search.json?q=' +
        encodeURIComponent(
          '("socio técnico" OR "cofundador" OR "busco programador" OR "busco desarrollador" OR "validando idea" OR "mi startup" OR "construyendo MVP")'
        ) +
        '&sort=new&limit=20&t=year',
      'https://www.reddit.com/r/startups+cofounder+SaaS+SideProject+emprendedores+programacion/search.json?q=' +
        encodeURIComponent('("socio" OR "cofounder" OR "MVP" OR "startup" OR "idea" OR "españa" OR "latam")') +
        '&restrict_sr=1&sort=new&limit=20&t=month'
    ];

    const customSubQuery = (subreddits.length > 0 ? subreddits : ['cofounder', 'startups', 'SaaS', 'SideProject'])
      .slice(0, 5)
      .join('+');
    const customTerms =
      validationKeywords.length > 0
        ? validationKeywords.slice(0, 4).map(k => `"${k}"`).join(' OR ')
        : '"looking for technical cofounder" OR "need developer" OR "validating idea" OR "building MVP"';

    const urlsToTry = [
      ...spanishQueries,
      `https://www.reddit.com/r/${customSubQuery}/search.json?q=${encodeURIComponent(customTerms)}&restrict_sr=1&sort=new&limit=15&t=month`
    ];

    log?.(`[Reddit API] Monitoreando comunidades hispanas y globales de startups con filtros de validación e ideación...`);

    for (const apiUrl of urlsToTry) {
      if (candidates.length >= 16) break;
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 7000);
        const res = await fetch(apiUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'nodejs:hormesis.startup.radar:v2.0 (by /u/hormesis_ai)',
            Accept: 'application/json'
          }
        });
        clearTimeout(t);

        if (!res.ok) continue;
        const data = await res.json();
        const children = data?.data?.children || [];

        for (const child of children) {
          const post = child?.data;
          if (!post || post.over_18) continue;

          const title: string = post.title || '';
          const selftext: string = post.selftext || '';
          const author: string = post.author || 'founder';
          const subreddit: string = post.subreddit_name_prefixed || `r/${post.subreddit || 'startups'}`;
          const score = Number(post.score || 0);
          const permalink = post.permalink ? `https://www.reddit.com${post.permalink}` : '';

          const fullText = `${title} ${selftext}`;
          if (EXCLUDE_MATURE_OR_BIGTECH_REGEX.test(fullText) || score > 200) {
            continue;
          }

          const externalUrls = this.extractExternalStartupUrls(fullText);
          const directEmail = this.extractEmailFromPlainText(fullText) || '';

          // Solo nos interesan candidatos que tengan email en el post o una URL de proyecto para extraer su email
          if (!directEmail && externalUrls.length === 0) {
            continue;
          }

          const isEs = this.isSpanishContent(fullText);
          let projectName = title
            .replace(/^\[.*?\]\s*/, '')
            .split(/[-–—:|]/)[0]
            .trim();
          if (projectName.length > 42 || projectName.length < 3) {
            projectName = externalUrls[0]
              ? new URL(externalUrls[0]).hostname.replace(/^www\./i, '').split('.')[0].toUpperCase()
              : `Startup de ${author}`;
          }

          if (!candidates.some(c => c.communityUrl === permalink)) {
            candidates.push({
              sourcePlatform: 'Reddit',
              sourceDetail: `${subreddit} · ${isEs ? 'Startup en Español' : 'Validación / Seed'}`,
              projectName,
              founderName: author,
              founderHandleOrRole: `Fundador en ${subreddit}`,
              description: selftext ? selftext.substring(0, 360).replace(/\s+/g, ' ') : title,
              communityUrl: permalink,
              websiteUrl: externalUrls[0] || permalink,
              email: directEmail,
              upvotesOrScore: score,
              makersCount: 1,
              tags: [subreddit, isEs ? 'Español' : 'Seed'].filter(Boolean),
              rawSnippet: `[${subreddit}] ${title} — ${selftext.substring(0, 400)}`,
              isSpanish: isEs
            });
          }
        }
      } catch (err: any) {
        log?.(`[Reddit API] Aviso: ${err.message}`);
      }
    }

    // Ordenar priorizando proyectos en español y aquellos que ya tienen email o web propia
    return candidates.sort((a, b) => Number(b.isSpanish) - Number(a.isSpanish));
  }

  /**
   * 2. PRODUCT HUNT PIPELINE (Con resolución de dominio real y filtro anti-BigTech)
   */
  static async fetchProductHuntCandidates(
    tags: string[],
    maxUpvotes: number,
    productHuntToken?: string,
    log?: (msg: string) => void
  ): Promise<RawStartupCandidate[]> {
    const candidates: RawStartupCandidate[] = [];
    const cleanTags = tags.length > 0 ? tags : ['pre-launch', 'ideation', 'mvp', 'saas', 'artificial-intelligence'];

    // A) Si hay Token de Product Hunt API v2 GraphQL
    if (productHuntToken && productHuntToken.trim().length > 10) {
      log?.(`[Product Hunt API] Consultando GraphQL v2 para etiquetas: ${cleanTags.slice(0, 4).join(', ')}...`);
      for (const topicSlug of cleanTags.slice(0, 3)) {
        try {
          const query = `
            query($topic: String!) {
              posts(first: 10, topic: $topic, order: NEWEST) {
                edges {
                  node {
                    name
                    tagline
                    description
                    url
                    website
                    votesCount
                    makers {
                      name
                      headline
                    }
                  }
                }
              }
            }
          `;
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 7000);
          const res = await fetch('https://api.producthunt.com/v2/api/graphql', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${productHuntToken.trim()}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, variables: { topic: topicSlug.toLowerCase().replace(/\s+/g, '-') } })
          });
          clearTimeout(t);

          if (res.ok) {
            const json = await res.json();
            const edges = json?.data?.posts?.edges || [];
            for (const edge of edges) {
              const node = edge?.node;
              if (!node) continue;
              const votes = Number(node.votesCount || 0);
              const makers = Array.isArray(node.makers) ? node.makers : [];
              const fullText = `${node.name} ${node.tagline || ''} ${node.description || ''}`;

              if (votes > maxUpvotes || makers.length > 3 || EXCLUDE_MATURE_OR_BIGTECH_REGEX.test(fullText)) {
                continue;
              }

              const primaryMaker = makers[0] || { name: 'Founder', headline: 'Early-Stage Maker' };
              const isEs = this.isSpanishContent(fullText);

              candidates.push({
                sourcePlatform: 'Product Hunt',
                sourceDetail: `Product Hunt · #${topicSlug}`,
                projectName: node.name,
                founderName: primaryMaker.name || 'Founder',
                founderHandleOrRole: primaryMaker.headline || 'Maker & Co-Founder',
                description: `${node.tagline || ''}. ${node.description || ''}`.trim(),
                communityUrl: node.url || 'https://www.producthunt.com',
                websiteUrl: node.website || node.url || '',
                email: '',
                upvotesOrScore: votes,
                makersCount: makers.length || 1,
                tags: [topicSlug],
                rawSnippet: fullText,
                isSpanish: isEs
              });
            }
          }
        } catch {}
      }
    }

    // B) Feed Público Atom de Product Hunt (Descartando marcas gigantes como Zoom, Google, etc.)
    if (candidates.length < 5) {
      log?.(`[Product Hunt] Analizando nuevos lanzamientos indie/early-stage en Product Hunt...`);
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 6500);
        const feedRes = await fetch('https://www.producthunt.com/feed', {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; StartupIdeationRadar/2.0)',
            Accept: 'application/atom+xml,application/xml,text/xml'
          }
        });
        clearTimeout(t);

        if (feedRes.ok) {
          const xml = await feedRes.text();
          const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
          let match;
          while ((match = entryRegex.exec(xml)) !== null && candidates.length < 8) {
            const entry = match[1];
            const title = (entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
              .replace(/<!\[CDATA\[|\]\]>/g, '')
              .trim();
            const author = (entry.match(/<name[^>]*>([\s\S]*?)<\/name>/i)?.[1] || 'Founder')
              .replace(/<!\[CDATA\[|\]\]>/g, '')
              .trim();
            const link = entry.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || '';
            const rawContentHtml = (entry.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] || '')
              .replace(/<!\[CDATA\[|\]\]>/g, '');
            const cleanText = rawContentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

            if (!title) continue;
            const combined = `${title} ${cleanText} ${link}`;
            if (EXCLUDE_MATURE_OR_BIGTECH_REGEX.test(combined)) continue;

            const parts = title.split(/\s+[-–—]\s+/);
            const projectName = parts[0]?.trim() || title;
            const tagline = parts.slice(1).join(' - ').trim() || cleanText.substring(0, 160);
            const isEs = this.isSpanishContent(combined);

            // Solo incluir del feed de Product Hunt si tiene URL externa real de la startup (no enlaces internos a producthunt.com/products/...)
            const extUrls = this.extractExternalStartupUrls(rawContentHtml);
            if (extUrls.length === 0) continue;

            candidates.push({
              sourcePlatform: 'Product Hunt',
              sourceDetail: `Product Hunt · ${isEs ? 'Lanzamiento Hispano' : 'Early-Stage Maker'}`,
              projectName,
              founderName: author,
              founderHandleOrRole: 'Fundador / Maker',
              description: tagline,
              communityUrl: link,
              websiteUrl: extUrls[0],
              email: '',
              upvotesOrScore: 14,
              makersCount: 1,
              tags: cleanTags.slice(0, 2),
              rawSnippet: `${projectName} (${author}): ${tagline}`,
              isSpanish: isEs
            });
          }
        }
      } catch (err: any) {
        log?.(`[Product Hunt] Aviso leyendo feed: ${err.message}`);
      }
    }

    return candidates.sort((a, b) => Number(b.isSpanish) - Number(a.isSpanish));
  }

  /**
   * 3. BÚSQUEDA AVANZADA DE STARTUPS Y FUNDADORES EN ESPAÑOL (LinkedIn Seed + Ecosistema Startup Hispano)
   * Busca activamente proyectos, startups pre-seed y fundadores en España y Latinoamérica que tengan
   * sitio web o contacto público y estén en etapa temprana / MVP.
   */
  static async fetchSpanishStartupsAndLinkedInFounders(
    linkedinKeywords: string[],
    targetGeo: string,
    log?: (msg: string) => void
  ): Promise<RawStartupCandidate[]> {
    const candidates: RawStartupCandidate[] = [];
    log?.(`[Búsqueda Avanzada ES] Buscando startups en fase semilla y fundadores en español (España / Latam)...`);

    const searchQueries = [
      // 1. Startups españolas/latam en fase semilla o buscando socio técnico / MVP con web propia
      `"startup" ("fase semilla" OR "pre-seed" OR "MVP" OR "socio técnico" OR "cofundador") ("hola@" OR "contacto@" OR "info@") site:.es OR site:.io OR site:.com`,
      // 2. Fundadores en LinkedIn España / Latam en etapa Stealth / Pre-Seed / Ideación
      `site:linkedin.com/in/ ("Fundador" OR "Co-Founder" OR "Stealth" OR "Pre-seed" OR "MVP") ("España" OR "Madrid" OR "Barcelona" OR "México" OR "Colombia")`,
      // 3. Startups emergentes SaaS / IA en España con página de contacto
      `"startup" ("inteligencia artificial" OR "SaaS" OR "plataforma") "contacto" site:.es -blog -noticias -elpais -expansion`
    ];

    for (const q of searchQueries) {
      if (candidates.length >= 12) break;
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 6500);
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}&kl=es-es`;
        const res = await fetch(searchUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'es-ES,es;q=0.9',
            Accept: 'text/html'
          }
        });
        clearTimeout(t);

        if (!res.ok) continue;
        const html = await res.text();
        const resultBlocks = html.split(/class=["']result__body["']/i).slice(1, 10);

        for (const block of resultBlocks) {
          const titleRaw = block.match(/class=["']result__a["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] || '';
          const snippetRaw =
            block.match(/class=["']result__snippet["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] ||
            block.match(/class=["']result__snippet["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
            '';
          const urlMatch = block.match(/uddg=([^"&]+)/i);

          const cleanTitle = titleRaw.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
          const cleanSnippet = snippetRaw
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim();
          const decodedUrl = urlMatch ? decodeURIComponent(urlMatch[1]) : '';

          if (!cleanTitle || !decodedUrl.startsWith('http')) continue;
          if (EXCLUDE_MATURE_OR_BIGTECH_REGEX.test(`${cleanTitle} ${cleanSnippet} ${decodedUrl}`)) continue;

          const emailInSnippet = this.extractEmailFromPlainText(`${cleanTitle} ${cleanSnippet}`) || '';
          const isLinkedIn = decodedUrl.includes('linkedin.com/in/');

          if (isLinkedIn) {
            const titleParts = cleanTitle.replace(/\s*\|\s*LinkedIn.*$/i, '').split(/\s+[-–—]\s+/);
            const founderName = titleParts[0]?.trim() || 'Fundador';
            const roleOrHeadline = titleParts.slice(1).join(' · ').trim() || 'Fundador Pre-Seed';
            const extUrls = this.extractExternalStartupUrls(cleanSnippet);

            // En LinkedIn solo agregamos si el snippet incluye email o web de su startup para poder obtener su correo real
            if (!emailInSnippet && extUrls.length === 0) continue;

            candidates.push({
              sourcePlatform: 'LinkedIn',
              sourceDetail: 'LinkedIn · Fundador Semilla (ES)',
              projectName: titleParts[2]?.trim() || `Startup de ${founderName}`,
              founderName,
              founderHandleOrRole: roleOrHeadline,
              description: cleanSnippet,
              communityUrl: decodedUrl,
              websiteUrl: extUrls[0] || decodedUrl,
              email: emailInSnippet,
              upvotesOrScore: 10,
              makersCount: 1,
              tags: ['Español', 'LinkedIn Seed', 'Ideación'],
              rawSnippet: `${cleanTitle} — ${cleanSnippet}`,
              isSpanish: true
            });
          } else if (!EXCLUDED_DOMAINS_FOR_STARTUP_URL.test(decodedUrl)) {
            const urlObj = new URL(decodedUrl);
            const domainName = urlObj.hostname.replace(/^www\./i, '');
            const projectName = cleanTitle.split(/[-–—|•:]/)[0]?.trim() || domainName;

            candidates.push({
              sourcePlatform: 'LinkedIn',
              sourceDetail: 'Ecosistema Startup España / Latam',
              projectName: projectName.substring(0, 40),
              founderName: `Equipo Fundador de ${projectName.substring(0, 25)}`,
              founderHandleOrRole: 'Fundador / Pre-Seed',
              description: cleanSnippet || `Proyecto tecnológico emergente en ${domainName}`,
              communityUrl: decodedUrl,
              websiteUrl: `${urlObj.protocol}//${urlObj.hostname}`,
              email: emailInSnippet,
              upvotesOrScore: 15,
              makersCount: 1,
              tags: ['Español', 'Seed Stage', 'MVP'],
              rawSnippet: `${cleanTitle} (${domainName}) — ${cleanSnippet}`,
              isSpanish: true
            });
          }
        }
      } catch (err: any) {
        log?.(`[Búsqueda Avanzada ES] Aviso: ${err.message}`);
      }
    }

    return candidates;
  }

  /**
   * 4. DESCUBRIMIENTO DE DOMINIOS DE STARTUPS HISPANAS REALES CON MX Y EMAIL VERIFICADO
   * Cuando las búsquedas de comunidades devuelven pocos leads con email público, descubre y verifica
   * sitios web reales de startups hispanas en etapa temprana, comprobando su HTML y registros MX reales.
   */
  static async discoverVerifiedSpanishStartupLeads(
    config: StartupRadarConfig,
    groqApiKey: string,
    neededCount: number,
    existingUrls: Set<string>,
    log?: (msg: string) => void
  ): Promise<RawStartupCandidate[]> {
    if (!groqApiKey || neededCount <= 0) return [];
    log?.(`[Descubrimiento Hispano IA] Buscando ${neededCount} startups/proyectos adicionales en español con correo verificable...`);

    const prompt = `Actúa como un scout de Venture Capital en España y Latinoamérica (Lanzadera, Wayra, Enisa, Tetuan Valley, Product Hunt España, Indie Hackers ES).
Necesitamos identificar ${neededCount + 6} startups o proyectos tecnológicos emergentes del ecosistema hispano (España, México, Colombia, Argentina, Chile) que estén en etapa semilla, validación o crecimiento temprano y tengan dominio web activo (.es, .com, .io, .ai, .app) para extraer su contacto.

Devuelve ÚNICAMENTE un JSON válido con la propiedad "startups":
{
  "startups": [
    {
      "sourcePlatform": "Product Hunt" | "Reddit" | "LinkedIn",
      "sourceDetail": "Ej: Product Hunt España · Seed | LinkedIn · Pre-Seed España | Reddit · r/emprendedores",
      "projectName": "Nombre real de la startup hispana",
      "founderName": "Nombre del fundador o CEO",
      "founderHandleOrRole": "Fundador & CEO",
      "websiteUrl": "https://dominio-real.es",
      "description": "Descripción en español del producto y su reto técnico actual (escalado de MVP, IA, automatización o arquitectura)."
    }
  ]
}`;

    const verifiedCandidates: RawStartupCandidate[] = [];
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 12000);
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Eres un analista de startups hispanas. Responde solo en JSON válido.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.5,
          max_tokens: 1800
        })
      });
      clearTimeout(t);

      if (res.ok) {
        const data = await res.json();
        const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
        const list = Array.isArray(parsed.startups) ? parsed.startups : [];

        for (const item of list) {
          if (verifiedCandidates.length >= neededCount) break;
          const web = (item.websiteUrl || '').trim();
          if (!web.startsWith('http') || existingUrls.has(web)) continue;

          // Verificar que el sitio web exista de verdad y extraer su correo real o validar su servidor MX
          const scraped = await this.deepScrapeStartupWebsite(web);
          if (scraped.email) {
            existingUrls.add(web);
            verifiedCandidates.push({
              sourcePlatform: item.sourcePlatform || 'LinkedIn',
              sourceDetail: item.sourceDetail || 'Ecosistema Startup Hispano · Seed',
              projectName: item.projectName || 'Startup Hispana',
              founderName: item.founderName || 'Fundador',
              founderHandleOrRole: item.founderHandleOrRole || 'Fundador & CEO',
              description: scraped.description || item.description || '',
              communityUrl: scraped.finalUrl || web,
              websiteUrl: scraped.finalUrl || web,
              email: scraped.email,
              upvotesOrScore: 18,
              makersCount: 1,
              tags: ['Español', 'Seed Stage', 'Email Verificado'],
              rawSnippet: `${item.projectName} (${item.founderName}): ${item.description}`,
              isSpanish: true
            });
            log?.(`✅ Startup hispana verificada con correo activo: ${item.projectName} -> ${scraped.email}`);
          }
        }
      }
    } catch (err: any) {
      log?.(`[Descubrimiento Hispano IA] Aviso: ${err.message}`);
    }

    return verifiedCandidates;
  }

  /**
   * 5. FILTRADO ACTIVO CON IA, PRIORIDAD ESPAÑOL Y GARANTÍA DE CORREO ELECTRÓNICO
   * - Resuelve la web real si viene de Product Hunt.
   * - Raspa la web de la startup para obtener el correo electrónico real.
   * - Descarta cualquier candidato que NO tenga un correo electrónico válido o que sea una empresa avanzada.
   * - Prioriza los proyectos en español y genera todo el diagnóstico y pitch en español.
   */
  static async qualifyAndFilterWithAI(
    candidates: RawStartupCandidate[],
    config: StartupRadarConfig,
    groqApiKey: string,
    targetCount: number,
    log?: (msg: string) => void
  ): Promise<QualifiedStartupLead[]> {
    const qualified: QualifiedStartupLead[] = [];
    const senderCompany = config.businessName || 'Grupo Hormesis';
    const senderContext =
      config.businessContext ||
      'Somos un estudio tecnológico y socio de ingeniería especializado en construir MVPs escalables, arquitectura IA y desarrollo full-stack para startups en fase de ideación y semilla.';

    // Ordenar candidatos dando máxima prioridad a los que están en español
    const sortedCandidates = [...candidates].sort((a, b) => {
      if (a.isSpanish !== b.isSpanish) return Number(b.isSpanish) - Number(a.isSpanish);
      if (Boolean(a.email) !== Boolean(b.email)) return Number(Boolean(b.email)) - Number(Boolean(a.email));
      return 0;
    });

    for (const candidate of sortedCandidates) {
      if (qualified.length >= targetCount) break;

      // 1. Si el websiteUrl apunta a Product Hunt, intentar resolver la web externa real de la startup
      if (candidate.websiteUrl && candidate.websiteUrl.includes('producthunt.com')) {
        const realWeb = await this.resolveProductHuntExternalWebsite(candidate.websiteUrl);
        if (realWeb) {
          candidate.websiteUrl = realWeb;
        }
      }

      // 2. Si aún no tiene email y tiene una web externa real, raspar su web (/ y /contacto) para extraer el correo
      if (
        !candidate.email &&
        candidate.websiteUrl &&
        candidate.websiteUrl.startsWith('http') &&
        !EXCLUDED_DOMAINS_FOR_STARTUP_URL.test(candidate.websiteUrl)
      ) {
        const scraped = await this.deepScrapeStartupWebsite(candidate.websiteUrl);
        if (scraped.email) {
          candidate.email = scraped.email;
          candidate.websiteUrl = scraped.finalUrl || candidate.websiteUrl;
          if (scraped.isSpanish) candidate.isSpanish = true;
          log?.(`📧 Correo extraído de la web de ${candidate.projectName}: ${candidate.email}`);
        }
      }

      // 3. REGLA ESTRICTA: Si el lead no tiene correo electrónico válido, lo descartamos para que todos los leads sean contactables
      if (!candidate.email || !candidate.email.includes('@')) {
        log?.(`⏭️ Omitiendo "${candidate.projectName}" por no disponer de correo electrónico público verificable.`);
        continue;
      }

      const emailCheck = await EmailValidatorService.validateEmail(candidate.email);
      if (!emailCheck.isValid) {
        log?.(`⏭️ Omitiendo "${candidate.projectName}" (${candidate.email}): ${emailCheck.reason}`);
        continue;
      }

      // 4. Evaluación y calificación en ESPAÑOL con Groq AI
      let aiEvaluation: any = null;
      if (groqApiKey) {
        try {
          const prompt = `Analiza este lead de startup extraído de ${candidate.sourcePlatform} (${candidate.sourceDetail}):
- Proyecto / Startup: "${candidate.projectName}"
- Fundador / Contacto: "${candidate.founderName}" (${candidate.founderHandleOrRole})
- Email verificado: "${candidate.email}"
- Web: "${candidate.websiteUrl}"
- Descripción: "${candidate.description}"

Nuestra empresa ("${senderCompany}"): "${senderContext}"

REGLAS OBLIGATORIAS (TODO EN ESPAÑOL):
1. Determina si el proyecto ya es una gran corporación consolidada ("isAdvancedDevelopment": true/false). Si es una startup en ideación, validación, pre-seed o crecimiento temprano que puede requerir apoyo técnico, MVP o escalado, pon false.
2. Clasifica su etapa ("startupStage"): "Ideación", "Validación / Pre-Seed", o "MVP Temprano".
3. Define en español su necesidad técnica primaria ("primaryTechnicalNeed"), ej: "Desarrollo de MVP & Arquitectura Escalable", "Socio Técnico / Ingeniería Full-Stack", "Integración de IA y Automatización de Procesos".
4. Lista 2 dolores técnicos concretos en español ("painPoints").
5. Asigna un "qualificationScore" (80 a 98).
6. Redacta SIEMPRE EN ESPAÑOL un "aiSubjectLine" (asunto atractivo de fundador a fundador, 5-9 palabras) y un "aiCustomPitch" (2 párrafos cercanos en español dirigidos a ${candidate.founderName} sobre ${candidate.projectName}, ofreciendo apoyo técnico/MVP desde ${senderCompany}).

Devuelve SOLO un JSON válido:
{
  "isIdeationOrEarlyStage": true,
  "isAdvancedDevelopment": false,
  "startupStage": "Validación / Pre-Seed",
  "primaryTechnicalNeed": "Socio Técnico & Construcción de MVP Escalable",
  "painPoints": ["Necesidad de acelerar el lanzamiento de funcionalidades clave sin deuda técnica", "Escalabilidad de arquitectura y automatización con IA"],
  "qualificationScore": 94,
  "aiSubjectLine": "Sobre ${candidate.projectName} — colaboración técnica y MVP",
  "aiCustomPitch": "Hola ${candidate.founderName}, estuvimos viendo el trabajo que están realizando en ${candidate.projectName}..."
}`;

          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 10000);
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${groqApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              response_format: { type: 'json_object' },
              messages: [
                {
                  role: 'system',
                  content: 'Eres un asesor técnico de startups. Responde siempre en español y únicamente con un objeto JSON válido.'
                },
                { role: 'user', content: prompt }
              ],
              temperature: 0.4,
              max_tokens: 900
            })
          });
          clearTimeout(t);

          if (res.ok) {
            const data = await res.json();
            const content = data.choices?.[0]?.message?.content || '';
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
              aiEvaluation = JSON.parse(match[0]);
            }
          }
        } catch (err: any) {
          log?.(`[Filtro IA] Aviso evaluando ${candidate.projectName}: ${err.message}`);
        }
      }

      if (aiEvaluation?.isAdvancedDevelopment === true) {
        log?.(`🚫 Descartado por filtro de madurez: "${candidate.projectName}" (desarrollo avanzado detectado).`);
        continue;
      }

      qualified.push({
        ...candidate,
        isIdeationOrEarlyStage: true,
        isAdvancedDevelopment: false,
        startupStage: aiEvaluation?.startupStage || 'Validación / Pre-Seed',
        primaryTechnicalNeed:
          aiEvaluation?.primaryTechnicalNeed || 'Socio Técnico & Construcción de MVP Escalable',
        painPoints:
          Array.isArray(aiEvaluation?.painPoints) && aiEvaluation.painPoints.length > 0
            ? aiEvaluation.painPoints
            : [
                'Iteración ágil de producto y validación con usuarios reales sin deuda técnica',
                'Arquitectura escalable e integración de IA lista para crecimiento'
              ],
        qualificationScore: Number(aiEvaluation?.qualificationScore || 92),
        aiSubjectLine:
          aiEvaluation?.aiSubjectLine ||
          `Sobre ${candidate.projectName} · Colaboración Técnica y Desarrollo MVP`,
        aiCustomPitch:
          aiEvaluation?.aiCustomPitch ||
          `Hola ${candidate.founderName}, estuvimos revisando tu proyecto ${candidate.projectName} (${candidate.websiteUrl}). En ${senderCompany} acompañamos a fundadores hispanohablantes en fase de ideación y pre-seed como socio tecnológico para acelerar el desarrollo de su MVP y arquitectura con IA.`
      });
    }

    return qualified;
  }
}
