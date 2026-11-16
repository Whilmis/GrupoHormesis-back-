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
  signalSnippet: string;
  communityUrl: string;
  websiteUrl: string;
  email: string;
  upvotesOrScore: number;
  makersCount: number;
  tags: string[];
  isSpanish: boolean;
}

export interface QualifiedStartupLead extends RawStartupCandidate {
  isIdeationOrEarlyStage: boolean;
  isAdvancedDevelopment: boolean;
  startupStage: '💡 Fase de Ideación' | '🤝 Buscando Socio Técnico' | '🧪 Validación / Waitlist' | '🛠️ MVP Temprano';
  primaryTechnicalNeed: string;
  recommendedStack: string;
  painPoints: string[];
  qualificationScore: number;
  aiCustomPitch: string;
  aiSubjectLine: string;
}

// Lista negra estricta de tecnológicas grandes y startups españolas/globales YA consolidadas (Series A+, scaleups)
const EXCLUDE_MATURE_COMPANIES_REGEX =
  /\b(zoom|google|microsoft|apple|meta|facebook|amazon|netflix|openai|anthropic|stripe|notion|figma|canva|hubspot|salesforce|shopify|slack|atlassian|payflow|quipu|getquipu|flanks|factorial|holded|cabify|glovo|jobandtalent|travelperk|typeform|wallapop|fintonic|indexa|badi|bizum|idealista|fotocasa|freepic|freepik|domestika|flywire|sequra|capchase|paack|heura|colvin|series [a-f]|ipo|enterprise-grade|fortune 500|soc2|iso 27001|100\+ employees|50\+ empleados|trabaja con nosotros|sala de prensa|nota de prensa|\$50k mrr|\$100k mrr|1m\+ users)\b/i;

const EXCLUDED_PLATFORM_DOMAINS =
  /reddit\.com|redd\.it|producthunt\.com|linkedin\.com|imgur\.com|giphy\.com|youtube\.com|youtu\.be|twitter\.com|x\.com|facebook\.com|instagram\.com|discord\.gg|github\.com|medium\.com|substack\.com|google\.com|apple\.com|play\.google|apps\.apple|duckduckgo\.com|bing\.com|wikipedia\.org|elpais\.com|expansion\.com|eleconomista\.es|cincodias\.com|xataka\.com|genbeta\.com|forbes\.es|emprendedores\.es|elreferente\.es/i;

export class StartupRadarService {
  /**
   * Detecta si un texto pertenece al contexto en español (España / Latam)
   */
  static isSpanishContent(text: string): boolean {
    if (!text) return false;
    const matches = text.match(
      /\b(españa|madrid|barcelona|valencia|sevilla|bilbao|málaga|méxico|colombia|argentina|chile|perú|latam|proyecto|busco|buscando|socio|cofundador|fundador|desarrollador|programador|validar|validando|validación|idea|startup|herramienta|plataforma|estamos|creando|construyendo|lanzando|lista de espera|beta|prototipo|para|con|por|una|los|las|del|que)\b|[áéíóúñ¿¡]/gi
    );
    return Boolean(matches && matches.length >= 2);
  }

  /**
   * Extrae URLs externas de proyectos indie / MVPs mencionadas en un texto
   */
  static extractExternalStartupUrls(text: string): string[] {
    if (!text) return [];
    const urlRegex = /https?:\/\/[a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-zA-Z]{2,}[^\s)"'<>[\]]*/gi;
    const matches = text.match(urlRegex) || [];
    const cleaned: string[] = [];

    for (const raw of matches) {
      try {
        const urlObj = new URL(raw.replace(/[.,;!?]+$/, ''));
        if (
          !EXCLUDED_PLATFORM_DOMAINS.test(urlObj.hostname) &&
          !EXCLUDE_MATURE_COMPANIES_REGEX.test(urlObj.hostname)
        ) {
          const base = `${urlObj.protocol}//${urlObj.hostname}`;
          if (!cleaned.includes(base)) cleaned.push(base);
        }
      } catch {}
    }
    return cleaned;
  }

  /**
   * Extrae correos electrónicos directamente de un post o bio
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
        !clean.endsWith('.webp') &&
        !clean.includes('example.com') &&
        !clean.includes('sentry.io') &&
        !clean.includes('wixpress.com') &&
        !clean.includes('reddit.com') &&
        !clean.includes('producthunt.com') &&
        !clean.includes('linkedin.com') &&
        !clean.includes('noreply') &&
        !clean.includes('no-reply')
      ) {
        return clean;
      }
    }
    return null;
  }

  /**
   * Analiza la landing page de un proyecto temprano / MVP / waitlist para:
   * 1) Verificar que NO sea una corporación madura (descarta si detecta señales de gran empresa).
   * 2) Extraer el correo del fundador o del proyecto temprano.
   */
  static async inspectEarlyProjectLanding(
    websiteUrl: string
  ): Promise<{
    email: string | null;
    finalUrl: string;
    title?: string;
    description?: string;
    isSpanish?: boolean;
    isMatureCompany?: boolean;
  }> {
    if (!websiteUrl || !websiteUrl.startsWith('http')) {
      return { email: null, finalUrl: websiteUrl };
    }

    let resolvedUrl = websiteUrl;
    try {
      const parsed = new URL(websiteUrl);
      if (
        EXCLUDED_PLATFORM_DOMAINS.test(parsed.hostname) ||
        EXCLUDE_MATURE_COMPANIES_REGEX.test(parsed.hostname)
      ) {
        return { email: null, finalUrl: websiteUrl, isMatureCompany: true };
      }

      const origin = `${parsed.protocol}//${parsed.hostname}`;

      const fetchPageHtml = async (
        targetUrl: string,
        timeoutMs = 5000
      ): Promise<{ html: string; finalUrl: string } | null> => {
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

      const homeData = await fetchPageHtml(websiteUrl, 5000);
      if (!homeData) return { email: null, finalUrl: websiteUrl };

      resolvedUrl = homeData.finalUrl;
      const html = homeData.html;

      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const descMatch =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);

      const title = titleMatch?.[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const description = descMatch?.[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

      // Comprobar si la web muestra señales de ser una empresa grande ya consolidada
      const plainSample = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .substring(0, 8000);

      if (EXCLUDE_MATURE_COMPANIES_REGEX.test(`${title || ''} ${description || ''} ${plainSample.substring(0, 2500)}`)) {
        return { email: null, finalUrl: resolvedUrl, isMatureCompany: true };
      }

      const isSpanish =
        /lang=["']es/i.test(html) ||
        parsed.hostname.endsWith('.es') ||
        this.isSpanishContent(`${title || ''} ${description || ''} ${plainSample.substring(0, 1500)}`);

      // 1. Extraer email de la landing principal
      let email = await EmailValidatorService.extractBestEmailFromHtml(html, resolvedUrl);
      if (email) {
        return { email, finalUrl: resolvedUrl, title, description, isSpanish, isMatureCompany: false };
      }

      // 2. Probar rutas de contacto ligero
      for (const path of ['/contacto', '/contact', '/about']) {
        const subData = await fetchPageHtml(`${origin}${path}`, 3200);
        if (subData?.html) {
          email = await EmailValidatorService.extractBestEmailFromHtml(subData.html, resolvedUrl);
          if (email) {
            return { email, finalUrl: resolvedUrl, title, description, isSpanish, isMatureCompany: false };
          }
        }
      }

      // 3. Si el dominio del proyecto tiene servidor de correo MX válido, resolver el buzón directo del fundador/proyecto
      const cleanHost = new URL(resolvedUrl).hostname.replace(/^www\./i, '');
      if (
        !EXCLUDED_PLATFORM_DOMAINS.test(cleanHost) &&
        !cleanHost.endsWith('.vercel.app') &&
        !cleanHost.endsWith('.netlify.app') &&
        !cleanHost.endsWith('.github.io')
      ) {
        const probeEmail = isSpanish ? `hola@${cleanHost}` : `hello@${cleanHost}`;
        const validation = await EmailValidatorService.validateEmail(probeEmail, resolvedUrl);
        if (validation.isValid) {
          return {
            email: probeEmail,
            finalUrl: resolvedUrl,
            title,
            description,
            isSpanish,
            isMatureCompany: false
          };
        }
      }

      return { email: null, finalUrl: resolvedUrl, title, description, isSpanish, isMatureCompany: false };
    } catch {
      return { email: null, finalUrl: resolvedUrl };
    }
  }

  /**
   * 1. REDDIT PIPELINE: Fundadores buscando Socio Técnico, Validando Idea o Mostrando su MVP Temprano
   * Prioriza comunidades en español y posts donde el autor comparte su idea/prototipo o pide ayuda técnica.
   */
  static async fetchRedditIdeationFounders(
    subreddits: string[],
    validationKeywords: string[],
    log?: (msg: string) => void
  ): Promise<RawStartupCandidate[]> {
    const candidates: RawStartupCandidate[] = [];

    const queries = [
      // 1. Posts en español de fundadores buscando socio técnico / cofundador / validando MVP
      `https://www.reddit.com/search.json?q=${encodeURIComponent(
        '("busco socio" OR "socio técnico" OR "cofundador" OR "validando" OR "mi MVP" OR "mi primer SaaS" OR "estoy creando" OR "feedback de mi app" OR "busco programador")'
      )}&sort=new&limit=25&t=year`,
      // 2. Subreddits de cofounders y proyectos indie
      `https://www.reddit.com/r/cofounder+SideProject+startups+SaaS+indiehackers+emprendedores/search.json?q=${encodeURIComponent(
        '("looking for technical" OR "need developer" OR "validating" OR "early beta" OR "waitlist" OR "socio" OR "MVP")'
      )}&restrict_sr=1&sort=new&limit=25&t=month`
    ];

    log?.(`[Reddit Ideation] Buscando hilos de fundadores validando ideas o buscando socio técnico...`);

    for (const apiUrl of queries) {
      if (candidates.length >= 18) break;
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 7000);
        const res = await fetch(apiUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'nodejs:hormesis.ideation.radar:v3.0 (by /u/hormesis_ai)',
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
          // Descartar posts con demasiados votos (productos ya virales/maduros) o empresas consolidadas
          if (score > 120 || EXCLUDE_MATURE_COMPANIES_REGEX.test(fullText) || selftext.length < 40) {
            continue;
          }

          const externalUrls = this.extractExternalStartupUrls(fullText);
          const directEmail = this.extractEmailFromPlainText(fullText) || '';

          if (!directEmail && externalUrls.length === 0) continue;

          const isEs = this.isSpanishContent(fullText);
          let projectName = title
            .replace(/^\[.*?\]\s*/, '')
            .split(/[-–—:|]/)[0]
            .trim();
          if (projectName.length > 44 || projectName.length < 3) {
            projectName = externalUrls[0]
              ? new URL(externalUrls[0]).hostname.replace(/^www\./i, '').split('.')[0].toUpperCase()
              : `Idea / MVP de u/${author}`;
          }

          const signalQuote = selftext.replace(/\s+/g, ' ').trim().substring(0, 280);

          if (!candidates.some(c => c.communityUrl === permalink)) {
            candidates.push({
              sourcePlatform: 'Reddit',
              sourceDetail: `${subreddit} · ${isEs ? 'Hilo en Español' : 'Founder Post'}`,
              projectName,
              founderName: `u/${author}`,
              founderHandleOrRole: isEs ? `Fundador en ${subreddit}` : `Early Founder (${subreddit})`,
              description: `${title}. ${signalQuote}`,
              signalSnippet: `"${title} — ${signalQuote}..."`,
              communityUrl: permalink,
              websiteUrl: externalUrls[0] || '',
              email: directEmail,
              upvotesOrScore: score,
              makersCount: 1,
              tags: [subreddit, isEs ? 'Español' : 'Ideation', 'MVP'],
              isSpanish: isEs
            });
          }
        }
      } catch (err: any) {
        log?.(`[Reddit Ideation] Aviso: ${err.message}`);
      }
    }

    return candidates.sort((a, b) => Number(b.isSpanish) - Number(a.isSpanish));
  }

  /**
   * 2. PRODUCT HUNT & INDIE MAKERS EN FASE PRE-LAUNCH / WAITLIST / BETA
   * Filtra proyectos indie recién creados (1-2 makers, pocos votos) y descarta empresas consolidadas.
   */
  static async fetchProductHuntIdeationMakers(
    tags: string[],
    maxUpvotes: number,
    productHuntToken?: string,
    log?: (msg: string) => void
  ): Promise<RawStartupCandidate[]> {
    const candidates: RawStartupCandidate[] = [];
    const cleanTags = tags.length > 0 ? tags : ['pre-launch', 'ideation', 'mvp', 'indie'];

    if (productHuntToken && productHuntToken.trim().length > 10) {
      log?.(`[Product Hunt API] Buscando proyectos Pre-Launch / Indie Makers con menos de ${maxUpvotes} votos...`);
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
          const t = setTimeout(() => controller.abort(), 6500);
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

              if (votes > maxUpvotes || makers.length > 2 || EXCLUDE_MATURE_COMPANIES_REGEX.test(fullText)) {
                continue;
              }

              const primaryMaker = makers[0] || { name: 'Indie Maker', headline: 'Solo Founder' };
              const isEs = this.isSpanishContent(fullText);

              candidates.push({
                sourcePlatform: 'Product Hunt',
                sourceDetail: `Product Hunt · #${topicSlug} (${votes} upvotes)`,
                projectName: node.name,
                founderName: primaryMaker.name || 'Indie Maker',
                founderHandleOrRole: primaryMaker.headline || 'Solo Maker / Pre-Seed',
                description: `${node.tagline || ''}. ${node.description || ''}`.trim(),
                signalSnippet: `"Lanzamiento temprano en Product Hunt (#${topicSlug}): ${node.tagline || node.description || ''}"`,
                communityUrl: node.url || 'https://www.producthunt.com',
                websiteUrl: node.website && !node.website.includes('producthunt.com') ? node.website : '',
                email: '',
                upvotesOrScore: votes,
                makersCount: makers.length || 1,
                tags: ['Product Hunt', `#${topicSlug}`, 'Early MVP'],
                isSpanish: isEs
              });
            }
          }
        } catch {}
      }
    }

    return candidates;
  }

  /**
   * 3. LINKEDIN & ECOSISTEMA HISPANO DE PROYECTOS EN FASE DE IDEACIÓN, WAITLIST Y PRE-SEED
   * Busca específicamente proyectos en fase beta, listas de espera, fundadores buscando CTO/socio técnico
   * y nuevos proyectos indie en español (descartando empresas consolidadas).
   */
  static async fetchSpanishIdeationAndLinkedInFounders(
    linkedinKeywords: string[],
    targetGeo: string,
    log?: (msg: string) => void
  ): Promise<RawStartupCandidate[]> {
    const candidates: RawStartupCandidate[] = [];
    log?.(`[LinkedIn & Ideación ES] Buscando fundadores en etapa semilla, listas de espera (waitlists) y proyectos beta en español...`);

    const searchQueries = [
      // 1. Fundadores en LinkedIn España / Latam buscando socio técnico, CTO o construyendo MVP en modo Stealth
      `site:linkedin.com/in/ ("busco socio técnico" OR "buscando CTO" OR "building MVP" OR "stealth startup" OR "pre-seed founder" OR "cofundador") ("Madrid" OR "Barcelona" OR "España" OR "México" OR "Colombia")`,
      // 2. Proyectos en fase de validación / beta abierta / lista de espera en español
      `("lista de espera" OR "acceso anticipado" OR "beta privada" OR "estamos construyendo" OR "fase beta") ("startup" OR "SaaS" OR "IA" OR "plataforma") ("hola@" OR "contacto@") -elpais -xataka -forbes`,
      // 3. Emprendedores hispanos presentando un MVP o buscando cofundador técnico con contacto directo
      `("busco socio técnico" OR "busco cofundador" OR "validar idea" OR "lanzando nuestro MVP") ("@" OR "contacto") site:.es OR site:.app OR site:.io OR site:.ai`
    ];

    for (const q of searchQueries) {
      if (candidates.length >= 14) break;
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
          if (EXCLUDE_MATURE_COMPANIES_REGEX.test(`${cleanTitle} ${cleanSnippet} ${decodedUrl}`)) continue;

          const emailInSnippet = this.extractEmailFromPlainText(`${cleanTitle} ${cleanSnippet}`) || '';
          const isLinkedIn = decodedUrl.includes('linkedin.com/in/');

          if (isLinkedIn) {
            const titleParts = cleanTitle.replace(/\s*\|\s*LinkedIn.*$/i, '').split(/\s+[-–—]\s+/);
            const founderName = titleParts[0]?.trim() || 'Fundador';
            const roleOrHeadline = titleParts.slice(1).join(' · ').trim() || 'Fundador en Fase Semilla';
            const extUrls = this.extractExternalStartupUrls(cleanSnippet);

            if (!emailInSnippet && extUrls.length === 0) continue;

            candidates.push({
              sourcePlatform: 'LinkedIn',
              sourceDetail: 'LinkedIn · Fundador en Etapa Semilla',
              projectName: titleParts[2]?.trim() || `Proyecto Stealth (${founderName})`,
              founderName,
              founderHandleOrRole: roleOrHeadline,
              description: cleanSnippet,
              signalSnippet: `"Perfil Fundador Semilla: ${roleOrHeadline} — ${cleanSnippet}"`,
              communityUrl: decodedUrl,
              websiteUrl: extUrls[0] || '',
              email: emailInSnippet,
              upvotesOrScore: 8,
              makersCount: 1,
              tags: ['Español', 'LinkedIn Seed', 'Stealth / MVP'],
              isSpanish: true
            });
          } else if (!EXCLUDED_PLATFORM_DOMAINS.test(decodedUrl)) {
            const urlObj = new URL(decodedUrl);
            const domainName = urlObj.hostname.replace(/^www\./i, '');
            const projectName = cleanTitle.split(/[-–—|•:]/)[0]?.trim() || domainName;

            candidates.push({
              sourcePlatform: decodedUrl.includes('.ai') || decodedUrl.includes('.app') || decodedUrl.includes('.io')
                ? 'Product Hunt'
                : 'LinkedIn',
              sourceDetail: 'Waitlist / MVP Temprano en Español',
              projectName: projectName.substring(0, 38),
              founderName: `Fundador de ${projectName.substring(0, 22)}`,
              founderHandleOrRole: 'Indie Maker / Pre-Seed Founder',
              description: cleanSnippet,
              signalSnippet: `"${cleanTitle}: ${cleanSnippet}"`,
              communityUrl: decodedUrl,
              websiteUrl: `${urlObj.protocol}//${urlObj.hostname}`,
              email: emailInSnippet,
              upvotesOrScore: 11,
              makersCount: 1,
              tags: ['Español', 'Beta / Waitlist', 'MVP'],
              isSpanish: true
            });
          }
        }
      } catch (err: any) {
        log?.(`[LinkedIn & Ideación ES] Aviso: ${err.message}`);
      }
    }

    return candidates;
  }

  /**
   * 4. CAZADOR DE PROYECTOS INDIE Y MICRO-SAAS EN FASE BETA / IDEACIÓN EN ESPAÑOL
   * Busca proyectos hispanos pequeños/emergentes (herramientas IA, micro-SaaS, apps en beta)
   * verificando que su landing esté activa, que NO sea una empresa grande y que tenga email verificable.
   */
  static async huntEmergingSpanishIndieProjects(
    config: StartupRadarConfig,
    groqApiKey: string,
    neededCount: number,
    existingUrls: Set<string>,
    log?: (msg: string) => void
  ): Promise<RawStartupCandidate[]> {
    if (!groqApiKey || neededCount <= 0) return [];
    log?.(`[Radar Ideación ES] Localizando ${neededCount} proyectos indie y micro-startups en español en etapa temprana...`);

    const verifiedCandidates: RawStartupCandidate[] = [];

    // Búsqueda dirigida a micro-proyectos, betas y herramientas emergentes en español
    const indieDorks = [
      `"creado por" ("beta" OR "acceso anticipado" OR "próximamente" OR "lista de espera" OR "MVP") site:.es OR site:.app`,
      `"hecho con" ("feedback" OR "beta" OR "lanzamiento" OR "proyecto") "hola@" site:.es OR site:.io`
    ];

    for (const dork of indieDorks) {
      if (verifiedCandidates.length >= neededCount) break;
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(dork)}&kl=es-es`, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'es-ES,es;q=0.9'
          }
        });
        clearTimeout(t);
        if (!res.ok) continue;

        const html = await res.text();
        const blocks = html.split(/class=["']result__body["']/i).slice(1, 10);
        for (const block of blocks) {
          if (verifiedCandidates.length >= neededCount) break;
          const titleRaw = block.match(/class=["']result__a["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] || '';
          const snippetRaw =
            block.match(/class=["']result__snippet["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] ||
            block.match(/class=["']result__snippet["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
            '';
          const urlMatch = block.match(/uddg=([^"&]+)/i);
          const decodedUrl = urlMatch ? decodeURIComponent(urlMatch[1]) : '';
          if (!decodedUrl.startsWith('http')) continue;

          const urlObj = new URL(decodedUrl);
          const origin = `${urlObj.protocol}//${urlObj.hostname}`;
          if (existingUrls.has(origin) || EXCLUDED_PLATFORM_DOMAINS.test(urlObj.hostname)) continue;

          const cleanTitle = titleRaw.replace(/<[^>]+>/g, '').trim();
          const cleanSnippet = snippetRaw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
          if (EXCLUDE_MATURE_COMPANIES_REGEX.test(`${cleanTitle} ${cleanSnippet} ${origin}`)) continue;

          const check = await this.inspectEarlyProjectLanding(origin);
          if (check.email && !check.isMatureCompany) {
            existingUrls.add(origin);
            const projName = (cleanTitle.split(/[-–—|•:]/)[0] || urlObj.hostname).trim().substring(0, 36);
            verifiedCandidates.push({
              sourcePlatform: 'Product Hunt',
              sourceDetail: 'Indie Maker / Proyecto Beta (ES)',
              projectName: projName,
              founderName: `Maker de ${projName}`,
              founderHandleOrRole: 'Fundador Indie / Pre-Seed',
              description: check.description || cleanSnippet,
              signalSnippet: `"${cleanTitle} — ${cleanSnippet}"`,
              communityUrl: decodedUrl,
              websiteUrl: origin,
              email: check.email,
              upvotesOrScore: 9,
              makersCount: 1,
              tags: ['Español', 'Fase Beta / MVP', 'Indie Maker'],
              isSpanish: true
            });
            log?.(`✅ Proyecto emergente en español detectado: ${projName} (${check.email})`);
          }
        }
      } catch {}
    }

    return verifiedCandidates;
  }

  /**
   * 5. FILTRADO ESTRICTO DE FASE DE IDEACIÓN / SEMILLA CON IA (GROQ)
   * - Descarta implacablemente empresas ya consolidadas o con desarrollo avanzado.
   * - Exige correo electrónico verificable.
   * - Genera la Ficha de Inteligencia de Startup (Etapa, Necesidad Técnica Primaria, Stack Recomendado,
   *   Dolores de Ideación y Pitch de Fundador a Fundador en Español).
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
      'Somos un Venture Studio y socio tecnológico que ayuda a fundadores en fase de ideación y pre-seed a construir su MVP funcional en semanas, diseñar la arquitectura IA y validar el producto.';

    const sortedCandidates = [...candidates].sort((a, b) => {
      if (a.isSpanish !== b.isSpanish) return Number(b.isSpanish) - Number(a.isSpanish);
      if (Boolean(a.email) !== Boolean(b.email)) return Number(Boolean(b.email)) - Number(Boolean(b.email));
      return 0;
    });

    for (const candidate of sortedCandidates) {
      if (qualified.length >= targetCount) break;

      // 1. Inspeccionar landing si tiene websiteUrl para extraer email y descartar empresas maduras
      if (candidate.websiteUrl && candidate.websiteUrl.startsWith('http')) {
        const inspection = await this.inspectEarlyProjectLanding(candidate.websiteUrl);
        if (inspection.isMatureCompany) {
          log?.(`🚫 Descartado "${candidate.projectName}": detectado como empresa ya consolidada.`);
          continue;
        }
        if (!candidate.email && inspection.email) {
          candidate.email = inspection.email;
          candidate.websiteUrl = inspection.finalUrl || candidate.websiteUrl;
        }
        if (inspection.isSpanish) candidate.isSpanish = true;
      }

      // 2. Exigir correo electrónico válido y entregable
      if (!candidate.email || !candidate.email.includes('@')) {
        continue;
      }

      const emailCheck = await EmailValidatorService.validateEmail(candidate.email);
      if (!emailCheck.isValid) {
        continue;
      }

      // 3. Evaluación profunda de Fase de Ideación con Groq AI
      let aiEvaluation: any = null;
      if (groqApiKey) {
        try {
          const prompt = `Actúa como un Director de Tecnología (CTO) de un Venture Builder evaluando un lead de startup temprana.
Datos del proyecto detectado en ${candidate.sourcePlatform} (${candidate.sourceDetail}):
- Proyecto / Idea: "${candidate.projectName}"
- Fundador / Autor: "${candidate.founderName}" (${candidate.founderHandleOrRole})
- Señal / Extracto original: ${candidate.signalSnippet || candidate.description}
- Web / Comunidad: ${candidate.websiteUrl || candidate.communityUrl}
- Email de contacto: ${candidate.email}

Nuestra empresa ("${senderCompany}"): "${senderContext}"

REGLAS ESTRICTAS DE FILTRADO DE IDEACIÓN:
1. Evalúa si este proyecto es una empresa grande/consolidada con producto maduro ("isAdvancedDevelopment": true/false). Si ya es una empresa famosa o consolidada (Series A+, banco, gran corporación), pon "isAdvancedDevelopment": true para descartarla.
2. Clasifica su fase exacta ("startupStage") eligiendo UNA de estas 4:
   - "💡 Fase de Ideación"
   - "🤝 Buscando Socio Técnico"
   - "🧪 Validación / Waitlist"
   - "🛠️ MVP Temprano"
3. Determina cuál es su Necesidad Técnica Primaria ("primaryTechnicalNeed") en español (ej: "Construcción de MVP Full-Stack desde cero", "Socio Técnico / CTO Fraccional", "Arquitectura de IA & Automatización", "Escalado de Prototipo Beta").
4. Recomienda el Stack Tecnológico ideal ("recommendedStack") para su caso (ej: "Next.js + Node.js + PostgreSQL + OpenAI/Groq").
5. Extrae 3 cuellos de botella o dolores técnicos concretos de su etapa ("painPoints") en español.
6. Calcula un "qualificationScore" (82 a 98) según el encaje para ofrecerle desarrollo de MVP o alianza técnica.
7. Redacta en español un "aiSubjectLine" (asunto cercano de fundador a fundador, sin sonar a spam corporativo) y un "aiCustomPitch" (2 párrafos cortos y directos comentando su publicación/idea en ${candidate.sourcePlatform} y proponiendo una charla de 15 min para ayudarle con la parte técnica/MVP).

Devuelve ÚNICAMENTE un JSON válido:
{
  "isIdeationOrEarlyStage": true,
  "isAdvancedDevelopment": false,
  "startupStage": "🧪 Validación / Waitlist",
  "primaryTechnicalNeed": "Desarrollo de MVP Funcional & Arquitectura Escalable",
  "recommendedStack": "Next.js + TypeScript + Node.js + Supabase/PostgreSQL",
  "painPoints": [
    "Necesidad de transformar la idea/waitlist en un MVP funcional rápido para validar tracción",
    "Falta de brazo técnico dedicado para iterar el producto sin acumular deuda técnica",
    "Integración de flujos automatizados e IA listos para los primeros usuarios"
  ],
  "qualificationScore": 94,
  "aiSubjectLine": "Sobre tu proyecto ${candidate.projectName} — apoyo técnico / MVP",
  "aiCustomPitch": "Hola ${candidate.founderName}, vi tu proyecto ${candidate.projectName} en ${candidate.sourcePlatform}..."
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
                  content: 'Eres un evaluador de startups en etapa pre-seed e ideación. Responde solo con JSON válido en español.'
                },
                { role: 'user', content: prompt }
              ],
              temperature: 0.4,
              max_tokens: 950
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
          log?.(`[Evaluador Ideación IA] Aviso en ${candidate.projectName}: ${err.message}`);
        }
      }

      if (aiEvaluation?.isAdvancedDevelopment === true) {
        log?.(`🚫 Descartado por IA (producto ya avanzado/maduro): "${candidate.projectName}"`);
        continue;
      }

      qualified.push({
        ...candidate,
        isIdeationOrEarlyStage: true,
        isAdvancedDevelopment: false,
        startupStage: aiEvaluation?.startupStage || '🧪 Validación / Waitlist',
        primaryTechnicalNeed:
          aiEvaluation?.primaryTechnicalNeed || 'Socio Técnico & Construcción de MVP Escalable',
        recommendedStack:
          aiEvaluation?.recommendedStack || 'React / Next.js + Node.js + PostgreSQL + IA',
        painPoints:
          Array.isArray(aiEvaluation?.painPoints) && aiEvaluation.painPoints.length > 0
            ? aiEvaluation.painPoints
            : [
                'Pasar de fase de validación a un MVP funcional en semanas sin desviar el presupuesto',
                'Contar con arquitectura escalable y soporte de ingeniería senior desde el día 1'
              ],
        qualificationScore: Number(aiEvaluation?.qualificationScore || 92),
        aiSubjectLine:
          aiEvaluation?.aiSubjectLine ||
          `Sobre ${candidate.projectName} en ${candidate.sourcePlatform} · Socio Técnico / MVP`,
        aiCustomPitch:
          aiEvaluation?.aiCustomPitch ||
          `Hola ${candidate.founderName}, vi lo que estás impulsando con ${candidate.projectName} (${candidate.sourceDetail}). En ${senderCompany} nos involucramos con fundadores en fase de ideación y validación como brazo tecnológico para construir y lanzar el MVP en tiempo récord.`
      });
    }

    return qualified;
  }
}
