import { EmailValidatorService } from './email-validator.service';

export interface StartupRadarConfig {
  redditSubreddits?: string;
  validationKeywords?: string;
  linkedinKeywords?: string;
  targetGeoOrLanguage?: string;
  excludeAdvancedKeywords?: string;
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
  sourcePlatform: 'Reddit' | 'GitHub Indie / MVP' | 'Show HN / Builders' | 'LinkedIn / Ecosistema ES';
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

// Lista negra estricta de grandes tecnológicas y scaleups consolidadas
const EXCLUDE_MATURE_COMPANIES_REGEX =
  /\b(zoom|google|microsoft|apple|meta|facebook|amazon|netflix|openai|anthropic|stripe|notion|figma|canva|hubspot|salesforce|shopify|slack|atlassian|payflow|quipu|getquipu|flanks|factorial|holded|cabify|glovo|jobandtalent|travelperk|typeform|wallapop|fintonic|indexa|badi|bizum|idealista|fotocasa|freepik|domestika|flywire|sequra|capchase|paack|heura|colvin|mercadona|inditex|santander|bbva|telefonica|endesa|iberdrola|series [a-f]|ipo|enterprise-grade|fortune 500|soc2|iso 27001|100\+ employees|50\+ empleados|trabaja con nosotros|sala de prensa|nota de prensa|\$50k mrr|\$100k mrr|1m\+ users)\b/i;

const EXCLUDED_PLATFORM_DOMAINS =
  /reddit\.com|redd\.it|producthunt\.com|linkedin\.com|imgur\.com|giphy\.com|youtube\.com|youtu\.be|twitter\.com|x\.com|facebook\.com|instagram\.com|discord\.gg|github\.com|medium\.com|substack\.com|google\.com|apple\.com|play\.google|apps\.apple|duckduckgo\.com|bing\.com|wikipedia\.org|elpais\.com|expansion\.com|eleconomista\.es|cincodias\.com|xataka\.com|genbeta\.com|forbes\.es|emprendedores\.es|elreferente\.es|startups\.com|cal\.com|loom\.com|linktr\.ee|notion\.so|docs\.google\.com|forms\.gle/i;

export class StartupRadarService {
  /**
   * Detecta si un texto pertenece al contexto en español (España / Latam)
   */
  static isSpanishContent(text: string): boolean {
    if (!text) return false;
    const matches = text.match(
      /\b(españa|madrid|barcelona|valencia|sevilla|bilbao|málaga|zaragoza|méxico|colombia|argentina|chile|perú|uruguay|latam|proyecto|busco|buscando|socio|cofundador|fundador|desarrollador|programador|validar|validando|validación|idea|startup|herramienta|plataforma|estamos|creando|construyendo|lanzando|lista de espera|beta|prototipo|para|con|por|una|los|las|del|que|gestión|facturación|autónomos|pymes|clientes)\b|[áéíóúñ¿¡]/gi
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
   * Extrae correos electrónicos válidos directamente de un bloque de texto
   */
  static extractEmailFromPlainText(text: string): string | null {
    if (!text) return null;
    const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    for (const raw of matches) {
      const clean = raw.toLowerCase().trim().replace(/[.,;!?]+$/, '');
      if (
        !clean.endsWith('.png') &&
        !clean.endsWith('.jpg') &&
        !clean.endsWith('.jpeg') &&
        !clean.endsWith('.svg') &&
        !clean.endsWith('.webp') &&
        !clean.endsWith('.gif') &&
        !clean.includes('example.com') &&
        !clean.includes('yourdomain') &&
        !clean.includes('domain.com') &&
        !clean.includes('email.com') &&
        !clean.includes('sentry.io') &&
        !clean.includes('wixpress.com') &&
        !clean.includes('reddit.com') &&
        !clean.includes('producthunt.com') &&
        !clean.includes('linkedin.com') &&
        !clean.includes('github.com') &&
        !clean.includes('noreply') &&
        !clean.includes('no-reply')
      ) {
        return clean;
      }
    }
    return null;
  }

  /**
   * Inspecciona la landing de un proyecto temprano / MVP para extraer el correo del fundador
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
        timeoutMs = 4500
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

      const homeData = await fetchPageHtml(websiteUrl, 4500);
      if (!homeData) return { email: null, finalUrl: websiteUrl };

      resolvedUrl = homeData.finalUrl;
      const html = homeData.html;

      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const descMatch =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);

      const title = titleMatch?.[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const description = descMatch?.[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

      const plainSample = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .substring(0, 6000);

      if (EXCLUDE_MATURE_COMPANIES_REGEX.test(`${title || ''} ${description || ''}`)) {
        return { email: null, finalUrl: resolvedUrl, isMatureCompany: true };
      }

      const isSpanish =
        /lang=["']es/i.test(html) ||
        parsed.hostname.endsWith('.es') ||
        this.isSpanishContent(`${title || ''} ${description || ''} ${plainSample.substring(0, 1200)}`);

      // 1. Extraer email real visible en la página principal
      let email = await EmailValidatorService.extractBestEmailFromHtml(html, resolvedUrl);
      if (email) {
        return { email, finalUrl: resolvedUrl, title, description, isSpanish, isMatureCompany: false };
      }

      // 2. Probar subpáginas de contacto (/contacto, /contact, /about)
      for (const path of ['/contacto', '/contact']) {
        const subData = await fetchPageHtml(`${origin}${path}`, 3000);
        if (subData?.html) {
          email = await EmailValidatorService.extractBestEmailFromHtml(subData.html, resolvedUrl);
          if (email) {
            return { email, finalUrl: resolvedUrl, title, description, isSpanish, isMatureCompany: false };
          }
        }
      }

      return { email: null, finalUrl: resolvedUrl, title, description, isSpanish, isMatureCompany: false };
    } catch {
      return { email: null, finalUrl: resolvedUrl };
    }
  }

  /**
   * FUENTE 1: REDDIT API (Búsqueda directa de hilos de fundadores con email o MVP linkeado)
   * Prioriza posts en español y de comunidades de startups (r/cofounder, r/startups, r/SideProject, r/SaaS, r/emprendedores)
   * donde el fundador incluye un correo de contacto directo o la URL de su MVP temprano.
   */
  static async fetchRedditIdeationFounders(
    subreddits: string[],
    validationKeywords: string[],
    log?: (msg: string) => void
  ): Promise<RawStartupCandidate[]> {
    const candidates: RawStartupCandidate[] = [];

    const redditQueries = [
      // 1. Hilos en español con correo directo o proyecto en validación
      'https://www.reddit.com/search.json?q=' +
        encodeURIComponent(
          '(startup OR proyecto OR SaaS OR MVP OR cofundador OR "socio técnico" OR app) ("@gmail.com" OR "hola@" OR "contacto@")'
        ) +
        '&sort=new&limit=35&t=year',
      // 2. Subreddits de cofounders y startups con correo directo en el post
      'https://www.reddit.com/r/cofounder+startups+SideProject+SaaS+indiehackers+Entrepreneur/search.json?q=' +
        encodeURIComponent('("gmail.com" OR "hello@" OR "founder@" OR "contact@") (MVP OR cofounder OR developer OR beta OR startup)') +
        '&restrict_sr=1&sort=new&limit=35&t=year',
      // 3. Hilos en español de validación / búsqueda de socio técnico con URL de proyecto
      'https://www.reddit.com/search.json?q=' +
        encodeURIComponent(
          '("busco socio" OR "cofundador" OR "mi primer SaaS" OR "estoy creando" OR "feedback de mi" OR "validando") ("https://")'
        ) +
        '&sort=new&limit=25&t=year'
    ];

    log?.(`[Reddit API] Escaneando hilos de fundadores en ideación y búsqueda de socio técnico con contacto directo...`);

    for (const apiUrl of redditQueries) {
      if (candidates.length >= 20) break;
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 7500);
        const res = await fetch(apiUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'nodejs:hormesis.startup.radar:v4.0 (by /u/hormesis_venture)',
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
          if (score > 180 || EXCLUDE_MATURE_COMPANIES_REGEX.test(fullText) || selftext.length < 30) {
            continue;
          }

          const directEmail = this.extractEmailFromPlainText(fullText) || '';
          const externalUrls = this.extractExternalStartupUrls(fullText);

          // Solo conservar si ya tiene correo directo en el post o una URL de MVP para extraerlo
          if (!directEmail && externalUrls.length === 0) continue;

          const isEs = this.isSpanishContent(fullText);
          let projectName = title
            .replace(/^\[.*?\]\s*/g, '')
            .split(/[-–—:|]/)[0]
            .trim();
          if (projectName.length > 42 || projectName.length < 3) {
            projectName = externalUrls[0]
              ? new URL(externalUrls[0]).hostname.replace(/^www\./i, '').split('.')[0].toUpperCase()
              : `Proyecto de u/${author}`;
          }

          const signalQuote = selftext.replace(/\s+/g, ' ').trim().substring(0, 260);

          if (!candidates.some(c => c.communityUrl === permalink)) {
            candidates.push({
              sourcePlatform: 'Reddit',
              sourceDetail: `${subreddit} · ${isEs ? 'Fundador Hispano' : 'Founder Thread'}`,
              projectName,
              founderName: `u/${author}`,
              founderHandleOrRole: isEs ? `Fundador en ${subreddit}` : `Founder (${subreddit})`,
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
        log?.(`[Reddit API] Aviso: ${err.message}`);
      }
    }

    return candidates.sort((a, b) => {
      if (a.isSpanish !== b.isSpanish) return Number(b.isSpanish) - Number(a.isSpanish);
      return Number(Boolean(b.email)) - Number(Boolean(a.email));
    });
  }

  /**
   * FUENTE 2: GITHUB API — INDIE MAKERS, FUNDADORES Y MVPs EN ESPAÑOL (España & Latam)
   * Usa la API oficial de GitHub (que nunca bloquea IPs cloud) para encontrar:
   * A) Perfiles de fundadores/indie makers en España y Latinoamérica que tienen email público o proyecto activo.
   * B) Repositorios recientes de MVPs / SaaS en español con página web activa o email de autor en los commits.
   */
  static async fetchGitHubSpanishIndieFounders(
    targetGeo: string,
    log?: (msg: string) => void
  ): Promise<RawStartupCandidate[]> {
    const candidates: RawStartupCandidate[] = [];
    log?.(`[GitHub Indie & MVP API] Buscando fundadores, indie makers y MVPs recientes en España y Latinoamérica...`);

    const headers: Record<string, string> = {
      'User-Agent': 'Hormesis-Startup-Radar-App',
      Accept: 'application/vnd.github+json'
    };

    try {
      // A) Buscar repositorios creados recientemente en español de tipo SaaS / MVP / Startup con homepage activa
      const repoQueries = [
        'mvp OR saas OR startup OR "lista de espera" OR "inteligencia artificial" language:TypeScript',
        'startup OR saas OR mvp OR "proyecto" in:description,readme'
      ];

      for (const rq of repoQueries.slice(0, 1)) {
        const repoUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(rq)}&sort=updated&order=desc&per_page=15`;
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 6500);
        const res = await fetch(repoUrl, { signal: controller.signal, headers });
        clearTimeout(t);

        if (res.ok) {
          const data = await res.json();
          const items = data?.items || [];
          for (const repo of items) {
            if (candidates.length >= 10) break;
            const homepage = (repo.homepage || '').trim();
            const desc = repo.description || '';
            const ownerLogin = repo.owner?.login || 'maker';
            const stars = Number(repo.stargazers_count || 0);

            // Descartar proyectos masivos o sin descripción
            if (stars > 150 || !desc) continue;
            const isEs = this.isSpanishContent(`${repo.name} ${desc}`);
            if (!isEs && (!homepage || !homepage.startsWith('http'))) continue;

            // Intentar obtener el email público del autor en sus eventos recientes de GitHub
            let authorEmail = this.extractEmailFromPlainText(desc) || '';
            if (!authorEmail) {
              try {
                const evRes = await fetch(`https://api.github.com/users/${ownerLogin}/events/public?per_page=10`, {
                  headers
                });
                if (evRes.ok) {
                  const events = await evRes.json();
                  for (const ev of events || []) {
                    const commits = ev?.payload?.commits || [];
                    for (const cm of commits) {
                      const em = cm?.author?.email || '';
                      if (
                        em &&
                        em.includes('@') &&
                        !em.includes('noreply.github.com') &&
                        !em.includes('example.com')
                      ) {
                        authorEmail = em.toLowerCase().trim();
                        break;
                      }
                    }
                    if (authorEmail) break;
                  }
                }
              } catch {}
            }

            if (!authorEmail && (!homepage || !homepage.startsWith('http'))) continue;

            candidates.push({
              sourcePlatform: 'GitHub Indie / MVP',
              sourceDetail: `GitHub MVP · ${isEs ? 'Proyecto en Español' : 'Early Builder'} (${stars} ⭐)`,
              projectName: repo.name.replace(/[-_]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
              founderName: ownerLogin,
              founderHandleOrRole: `Indie Builder / Autor (@${ownerLogin})`,
              description: desc,
              signalSnippet: `"Construyendo MVP público (${repo.name}): ${desc}"`,
              communityUrl: repo.html_url,
              websiteUrl: homepage && homepage.startsWith('http') ? homepage : '',
              email: authorEmail,
              upvotesOrScore: stars,
              makersCount: 1,
              tags: ['MVP en Desarrollo', isEs ? 'Español' : 'Indie', 'Builder'],
              isSpanish: isEs
            });
          }
        }
      }

      // B) Buscar usuarios/fundadores en España y Latam que declaran "founder", "startup", "indie", "SaaS" en su bio
      const userSearchUrl = `https://api.github.com/search/users?q=${encodeURIComponent(
        '(founder OR cofounder OR startup OR saas OR indie OR creador) (location:Spain OR location:Madrid OR location:Barcelona OR location:Mexico OR location:Colombia OR location:Argentina)'
      )}&sort=joined&order=desc&per_page=12`;

      const uRes = await fetch(userSearchUrl, { headers });
      if (uRes.ok) {
        const uData = await uRes.json();
        const users = (uData?.items || []).slice(0, 8);

        for (const u of users) {
          if (candidates.length >= 16) break;
          try {
            const profRes = await fetch(`https://api.github.com/users/${u.login}`, { headers });
            if (!profRes.ok) continue;
            const prof = await profRes.json();

            let founderEmail = prof.email || this.extractEmailFromPlainText(prof.bio || '') || '';
            const blogUrl =
              prof.blog && prof.blog.startsWith('http')
                ? prof.blog
                : prof.blog
                ? `https://${prof.blog}`
                : '';

            // Si no tiene email en el perfil, buscar en sus commits públicos
            if (!founderEmail) {
              const evRes = await fetch(`https://api.github.com/users/${u.login}/events/public?per_page=8`, {
                headers
              });
              if (evRes.ok) {
                const events = await evRes.json();
                for (const ev of events || []) {
                  for (const cm of ev?.payload?.commits || []) {
                    const em = cm?.author?.email || '';
                    if (em && em.includes('@') && !em.includes('noreply.github.com')) {
                      founderEmail = em.toLowerCase().trim();
                      break;
                    }
                  }
                  if (founderEmail) break;
                }
              }
            }

            if (!founderEmail && !blogUrl) continue;

            const founderName = prof.name || u.login;
            const companyOrProj =
              (prof.company || '').replace(/^@/, '').trim() ||
              (blogUrl ? new URL(blogUrl).hostname.replace(/^www\./i, '').split('.')[0].toUpperCase() : `Proyecto de ${founderName}`);

            candidates.push({
              sourcePlatform: 'GitHub Indie / MVP',
              sourceDetail: `Founder en ${prof.location || 'España / Latam'}`,
              projectName: companyOrProj,
              founderName,
              founderHandleOrRole: prof.bio ? prof.bio.substring(0, 55) : 'Indie Founder & Developer',
              description: prof.bio || `Fundador técnico / Indie Maker en ${prof.location || 'España'} construyendo ${companyOrProj}.`,
              signalSnippet: `"Bio del Fundador (${prof.location || 'Hispano'}): ${prof.bio || companyOrProj}"`,
              communityUrl: prof.html_url,
              websiteUrl: blogUrl,
              email: founderEmail,
              upvotesOrScore: Number(prof.public_repos || 5),
              makersCount: 1,
              tags: ['Español', prof.location || 'Hispano', 'Founder'],
              isSpanish: true
            });
          } catch {}
        }
      }
    } catch (err: any) {
      log?.(`[GitHub Indie API] Aviso: ${err.message}`);
    }

    return candidates;
  }

  /**
   * FUENTE 3: SHOW HN / ALGOLIA STARTUP API (Lanzamientos tempranos con email de fundador directo)
   * Consulta la API JSON oficial de Hacker News Algolia buscando presentaciones "Show HN" y "Ask HN"
   * de fundadores en etapa temprana que dejan su correo electrónico directo para feedback o socios.
   */
  static async fetchShowHNAndEarlyBuilders(log?: (msg: string) => void): Promise<RawStartupCandidate[]> {
    const candidates: RawStartupCandidate[] = [];
    log?.(`[Show HN & Builders API] Buscando presentaciones tempranas de fundadores con correo directo...`);

    const queries = [
      'https://hn.algolia.com/api/v1/search_by_date?query=' +
        encodeURIComponent('"@gmail.com" OR "hello@" OR "hola@" OR "founder@"') +
        '&tags=show_hn&hitsPerPage=20',
      'https://hn.algolia.com/api/v1/search_by_date?query=' +
        encodeURIComponent('cofounder OR "socio" OR "early beta" OR "feedback" "@gmail.com"') +
        '&tags=story&hitsPerPage=15'
    ];

    for (const qUrl of queries) {
      if (candidates.length >= 12) break;
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 6500);
        const res = await fetch(qUrl, { signal: controller.signal });
        clearTimeout(t);

        if (!res.ok) continue;
        const data = await res.json();
        const hits = data?.hits || [];

        for (const hit of hits) {
          const title: string = hit.title || '';
          const storyText: string = (hit.story_text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          const author: string = hit.author || 'founder';
          const points = Number(hit.points || 1);
          const url: string = hit.url || '';
          const hnLink = `https://news.ycombinator.com/item?id=${hit.objectID}`;

          const combined = `${title} ${storyText}`;
          if (points > 120 || EXCLUDE_MATURE_COMPANIES_REGEX.test(combined)) continue;

          const directEmail = this.extractEmailFromPlainText(combined) || '';
          if (!directEmail && !url) continue;

          const cleanTitle = title.replace(/^Show HN:\s*/i, '').replace(/^Ask HN:\s*/i, '').trim();
          const projectName = cleanTitle.split(/[-–—:|()]/)[0]?.trim() || `MVP de ${author}`;
          const isEs = this.isSpanishContent(combined);

          if (!candidates.some(c => c.communityUrl === hnLink)) {
            candidates.push({
              sourcePlatform: 'Show HN / Builders',
              sourceDetail: `Show HN · Early Launch (${points} pts)`,
              projectName: projectName.substring(0, 42),
              founderName: author,
              founderHandleOrRole: 'Early-Stage Founder (Show HN)',
              description: `${cleanTitle}. ${storyText.substring(0, 260)}`,
              signalSnippet: `"${title} — ${storyText.substring(0, 220) || cleanTitle}"`,
              communityUrl: hnLink,
              websiteUrl: url,
              email: directEmail,
              upvotesOrScore: points,
              makersCount: 1,
              tags: ['Show HN', 'Early MVP', isEs ? 'Español' : 'Founder'],
              isSpanish: isEs
            });
          }
        }
      } catch (err: any) {
        log?.(`[Show HN API] Aviso: ${err.message}`);
      }
    }

    return candidates;
  }

  /**
   * FILTRADO ACTIVO CON IA (GROQ), EXTRACCIÓN DE CORREO OBLIGATORIA Y PRIORIZACIÓN DE ESPAÑOL
   */
  static async qualifyAndFilterWithAI(
    candidates: RawStartupCandidate[],
    config: StartupRadarConfig,
    groqApiKey: string,
    targetCount: number,
    log?: (msg: string) => void
  ): Promise<QualifiedStartupLead[]> {
    const qualified: QualifiedStartupLead[] = [];
    const seenEmails = new Set<string>();
    const senderCompany = config.businessName || 'Grupo Hormesis';
    const senderContext =
      config.businessContext ||
      'Somos un Venture Studio y socio tecnológico que ayuda a fundadores en fase de ideación y pre-seed a construir su MVP funcional en semanas, diseñar la arquitectura IA y validar el producto.';

    // Priorizar candidatos en español y aquellos que ya tienen email extraído directamente
    const sortedCandidates = [...candidates].sort((a, b) => {
      const aHasEmail = Boolean(a.email && a.email.includes('@'));
      const bHasEmail = Boolean(b.email && b.email.includes('@'));
      if (a.isSpanish !== b.isSpanish && aHasEmail === bHasEmail) {
        return Number(b.isSpanish) - Number(a.isSpanish);
      }
      if (aHasEmail !== bHasEmail) {
        return Number(bHasEmail) - Number(aHasEmail);
      }
      return Number(b.isSpanish) - Number(a.isSpanish);
    });

    for (const candidate of sortedCandidates) {
      if (qualified.length >= targetCount) break;

      // 1. Si no tiene email directo pero tiene websiteUrl externa, raspar su landing para obtener el correo
      if (!candidate.email && candidate.websiteUrl && candidate.websiteUrl.startsWith('http')) {
        const inspection = await this.inspectEarlyProjectLanding(candidate.websiteUrl);
        if (inspection.isMatureCompany) {
          continue;
        }
        if (inspection.email) {
          candidate.email = inspection.email;
          candidate.websiteUrl = inspection.finalUrl || candidate.websiteUrl;
        }
        if (inspection.isSpanish) candidate.isSpanish = true;
      }

      // 2. Exigir correo electrónico real y no repetido
      if (!candidate.email || !candidate.email.includes('@')) {
        continue;
      }

      const cleanEmail = candidate.email.toLowerCase().trim();
      if (seenEmails.has(cleanEmail)) continue;

      const emailCheck = await EmailValidatorService.validateEmail(cleanEmail);
      if (!emailCheck.isValid) {
        log?.(`⏭️ Omitiendo correo no entregable (${cleanEmail}): ${emailCheck.reason}`);
        continue;
      }

      seenEmails.add(cleanEmail);
      candidate.email = cleanEmail;
      log?.(`📧 Lead de startup en ideación verificado: ${candidate.projectName} (${candidate.founderName}) -> ${cleanEmail}`);

      // 3. Evaluación y armado de Ficha de Inteligencia en ESPAÑOL con Groq AI
      let aiEvaluation: any = null;
      if (groqApiKey) {
        try {
          const prompt = `Actúa como un Director de Tecnología (CTO) de un Venture Builder evaluando un lead de startup temprana.
Datos del proyecto detectado en ${candidate.sourcePlatform} (${candidate.sourceDetail}):
- Proyecto / Idea: "${candidate.projectName}"
- Fundador / Autor: "${candidate.founderName}" (${candidate.founderHandleOrRole})
- Señal / Extracto original: ${candidate.signalSnippet || candidate.description}
- Web / Comunidad: ${candidate.websiteUrl || candidate.communityUrl}
- Email de contacto verificado: ${candidate.email}

Nuestra empresa ("${senderCompany}"): "${senderContext}"

INSTRUCCIONES (TRADUCE Y REDACTA TODO EL ANÁLISIS EN ESPAÑOL):
1. Si el título o descripción del proyecto está en inglés, traduce/adapta la explicación y la señal al español para que el equipo comercial en España la lea cómodamente.
2. Clasifica su fase exacta ("startupStage") eligiendo UNA de estas 4:
   - "💡 Fase de Ideación"
   - "🤝 Buscando Socio Técnico"
   - "🧪 Validación / Waitlist"
   - "🛠️ MVP Temprano"
3. Determina su Necesidad Técnica Primaria ("primaryTechnicalNeed") en español (ej: "Construcción de MVP Full-Stack & Escalado", "Socio Técnico / Ingeniería de Producto", "Arquitectura de IA & Automatización").
4. Recomienda el Stack Tecnológico ideal ("recommendedStack") para su caso.
5. Extrae 3 cuellos de botella o dolores técnicos concretos de su etapa ("painPoints") en español.
6. Calcula un "qualificationScore" (85 a 98).
7. Redacta en español un "aiSubjectLine" (asunto cercano de fundador a fundador) y un "aiCustomPitch" (2 párrafos cortos y directos comentando su publicación/proyecto "${candidate.projectName}" en ${candidate.sourcePlatform} y proponiendo una charla de 15 min para apoyarle como socio tecnológico).

Devuelve ÚNICAMENTE un JSON válido:
{
  "projectNameEs": "Nombre claro del proyecto",
  "signalSnippetEs": "Resumen claro en español de lo que está construyendo o buscando el fundador",
  "startupStage": "🤝 Buscando Socio Técnico",
  "primaryTechnicalNeed": "Desarrollo de MVP Funcional & Arquitectura Escalable",
  "recommendedStack": "Next.js + TypeScript + Node.js + PostgreSQL + IA",
  "painPoints": [
    "Necesidad de acelerar el desarrollo del MVP sin desviar recursos en infraestructura compleja",
    "Contar con un socio tecnológico que aporte velocidad de iteración y calidad de código",
    "Escalabilidad técnica para convertir a los primeros usuarios en clientes recurrentes"
  ],
  "qualificationScore": 93,
  "aiSubjectLine": "Sobre tu proyecto ${candidate.projectName} — apoyo técnico y MVP",
  "aiCustomPitch": "Hola ${candidate.founderName}, vi lo que estás construyendo con ${candidate.projectName}..."
}`;

          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 9000);
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
                  content: 'Eres un evaluador de startups en etapa pre-seed e ideación. Responde siempre en español y solo con JSON válido.'
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
          log?.(`[Evaluador IA] Aviso en ${candidate.projectName}: ${err.message}`);
        }
      }

      qualified.push({
        ...candidate,
        projectName: aiEvaluation?.projectNameEs || candidate.projectName,
        signalSnippet: aiEvaluation?.signalSnippetEs || candidate.signalSnippet,
        isIdeationOrEarlyStage: true,
        isAdvancedDevelopment: false,
        startupStage: aiEvaluation?.startupStage || (candidate.isSpanish ? '🤝 Buscando Socio Técnico' : '🛠️ MVP Temprano'),
        primaryTechnicalNeed:
          aiEvaluation?.primaryTechnicalNeed || 'Socio Técnico & Construcción de MVP Escalable',
        recommendedStack:
          aiEvaluation?.recommendedStack || 'Next.js + Node.js + PostgreSQL + IA',
        painPoints:
          Array.isArray(aiEvaluation?.painPoints) && aiEvaluation.painPoints.length > 0
            ? aiEvaluation.painPoints
            : [
                'Acelerar el paso de prototipo/idea a producto comercializable sin deuda técnica',
                'Contar con brazo de ingeniería full-stack e IA para iterar con los primeros usuarios'
              ],
        qualificationScore: Number(aiEvaluation?.qualificationScore || 92),
        aiSubjectLine:
          aiEvaluation?.aiSubjectLine ||
          `Sobre ${candidate.projectName} · Socio Tecnológico & Desarrollo MVP`,
        aiCustomPitch:
          aiEvaluation?.aiCustomPitch ||
          `Hola ${candidate.founderName}, estuvimos revisando lo que estás construyendo con ${candidate.projectName} (${candidate.sourceDetail}). En ${senderCompany} acompañamos a fundadores en etapa de ideación y MVP como socio tecnológico para lanzar y escalar el producto en semanas.`
      });
    }

    return qualified;
  }
}
