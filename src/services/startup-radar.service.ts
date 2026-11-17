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
  sourcePlatform: 'Reddit' | 'GitHub Indie / MVP' | 'Show HN / Builders' | 'Ecosistema Startup ES';
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

const EXCLUDE_MATURE_COMPANIES_REGEX =
  /\b(zoom|google|microsoft|apple|meta|facebook|amazon|netflix|openai|anthropic|stripe|notion|figma|canva|hubspot|salesforce|shopify|slack|atlassian|payflow|quipu|getquipu|flanks|factorial|holded|cabify|glovo|jobandtalent|travelperk|typeform|wallapop|fintonic|indexa|badi|bizum|idealista|fotocasa|freepik|domestika|flywire|sequra|capchase|paack|heura|colvin|mercadona|inditex|santander|bbva|telefonica|endesa|iberdrola|series [a-f]|ipo|enterprise-grade|fortune 500|soc2|iso 27001|100\+ employees|50\+ empleados|\$50k mrr|\$100k mrr|1m\+ users)\b/i;

const EXCLUDED_PLATFORM_DOMAINS =
  /reddit\.com|redd\.it|producthunt\.com|linkedin\.com|imgur\.com|giphy\.com|youtube\.com|youtu\.be|twitter\.com|x\.com|facebook\.com|instagram\.com|discord\.gg|github\.com|medium\.com|substack\.com|google\.com|apple\.com|play\.google|apps\.apple|duckduckgo\.com|bing\.com|wikipedia\.org|elpais\.com|expansion\.com|eleconomista\.es|cincodias\.com|xataka\.com|genbeta\.com|forbes\.es|emprendedores\.es|elreferente\.es|startups\.com|cal\.com|loom\.com|linktr\.ee|notion\.so|docs\.google\.com|forms\.gle|news\.ycombinator\.com/i;

export class StartupRadarService {
  static isSpanishContent(text: string): boolean {
    if (!text) return false;
    const matches = text.match(
      /\b(españa|madrid|barcelona|valencia|sevilla|bilbao|málaga|zaragoza|méxico|colombia|argentina|chile|perú|uruguay|latam|proyecto|busco|buscando|socio|cofundador|fundador|desarrollador|programador|validar|validando|validación|idea|startup|herramienta|plataforma|estamos|creando|construyendo|lanzando|lista de espera|beta|prototipo|para|con|por|una|los|las|del|que|gestión|facturación|autónomos|pymes|clientes)\b|[áéíóúñ¿¡]/gi
    );
    return Boolean(matches && matches.length >= 2);
  }

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
        timeoutMs = 4000
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

      const homeData = await fetchPageHtml(websiteUrl, 4200);
      if (!homeData) return { email: null, finalUrl: websiteUrl };

      resolvedUrl = homeData.finalUrl;
      const html = homeData.html;

      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const descMatch =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);

      const title = titleMatch?.[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const description = descMatch?.[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

      if (EXCLUDE_MATURE_COMPANIES_REGEX.test(`${title || ''} ${description || ''}`)) {
        return { email: null, finalUrl: resolvedUrl, isMatureCompany: true };
      }

      const isSpanish =
        /lang=["']es/i.test(html) ||
        parsed.hostname.endsWith('.es') ||
        this.isSpanishContent(`${title || ''} ${description || ''}`);

      let email = await EmailValidatorService.extractBestEmailFromHtml(html, resolvedUrl);
      if (email) {
        return { email, finalUrl: resolvedUrl, title, description, isSpanish, isMatureCompany: false };
      }

      for (const path of ['/contacto', '/contact']) {
        const subData = await fetchPageHtml(`${origin}${path}`, 2800);
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
   * FUENTE 1: REDDIT CLOUD-SAFE API (PullPush Reddit Index + Reddit JSON)
   * Funciona al 100% en servidores Cloud (Railway/AWS) sin bloqueos 403.
   */
  static async fetchRedditIdeationFounders(
    subreddits: string[],
    validationKeywords: string[],
    existingEmails: Set<string>,
    existingUrls: Set<string>,
    log?: (msg: string) => void
  ): Promise<RawStartupCandidate[]> {
    const candidates: RawStartupCandidate[] = [];
    log?.(`[Reddit Ideation API] Buscando fundadores en búsqueda de socio técnico o validando MVP...`);

    // 1. PullPush Reddit Search API (No bloquea IPs de Railway)
    const pullPushQueries = [
      'https://api.pullpush.io/reddit/search/submission/?q=' +
        encodeURIComponent('gmail.com OR hola@ OR contacto@ OR hello@ OR founder@') +
        '&subreddit=cofounder,startups,SideProject,SaaS,indiehackers,Entrepreneur&size=40&sort=desc',
      'https://api.pullpush.io/reddit/search/submission/?q=' +
        encodeURIComponent('socio tecnico OR cofundador OR validando OR "mi MVP" OR "mi startup"') +
        '&size=35&sort=desc',
      'https://api.pullpush.io/reddit/search/submission/?q=' +
        encodeURIComponent('"looking for technical co-founder" OR "seeking CTO" OR "building MVP"') +
        '&subreddit=cofounder,startups,SideProject,SaaS&size=35&sort=desc'
    ];

    for (const ppUrl of pullPushQueries) {
      if (candidates.length >= 18) break;
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 7000);
        const res = await fetch(ppUrl, {
          signal: controller.signal,
          headers: { Accept: 'application/json' }
        });
        clearTimeout(t);

        if (!res.ok) continue;
        const json = await res.json();
        const posts = Array.isArray(json?.data) ? json.data : [];

        for (const post of posts) {
          const title: string = post.title || '';
          const selftext: string = post.selftext || '';
          if (!selftext || selftext === '[removed]' || selftext === '[deleted]' || selftext.length < 30) continue;

          const author: string = post.author || 'founder';
          const subreddit = `r/${post.subreddit || 'cofounder'}`;
          const permalink = post.permalink
            ? `https://www.reddit.com${post.permalink}`
            : `https://www.reddit.com/r/${post.subreddit}/comments/${post.id}`;

          if (existingUrls.has(permalink)) continue;

          const fullText = `${title} ${selftext}`;
          if (EXCLUDE_MATURE_COMPANIES_REGEX.test(fullText)) continue;

          const directEmail = this.extractEmailFromPlainText(fullText) || '';
          const externalUrls = this.extractExternalStartupUrls(fullText);

          if (!directEmail && externalUrls.length === 0) continue;
          if (directEmail && existingEmails.has(directEmail.toLowerCase())) continue;

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
              sourceDetail: `${subreddit} · ${isEs ? 'Fundador Hispano' : 'Co-Founder / MVP'}`,
              projectName,
              founderName: `u/${author}`,
              founderHandleOrRole: isEs ? `Fundador en ${subreddit}` : `Founder (${subreddit})`,
              description: `${title}. ${signalQuote}`,
              signalSnippet: `"${title} — ${signalQuote}..."`,
              communityUrl: permalink,
              websiteUrl: externalUrls[0] || '',
              email: directEmail,
              upvotesOrScore: Number(post.score || 5),
              makersCount: 1,
              tags: [subreddit, isEs ? 'Español' : 'Ideation', 'MVP'],
              isSpanish: isEs
            });
          }
        }
      } catch (err: any) {
        log?.(`[Reddit PullPush API] Aviso: ${err.message}`);
      }
    }

    return candidates;
  }

  /**
   * FUENTE 2: ALGOLIA HN STARTUP & FOUNDER API (Show HN / Ask HN / Seeking Co-Founder)
   * Consulta múltiples páginas y términos en Algolia JSON API (nunca bloquea IPs cloud)
   * excluyendo leads ya guardados en el CRM.
   */
  static async fetchShowHNAndEarlyBuilders(
    existingEmails: Set<string>,
    existingUrls: Set<string>,
    log?: (msg: string) => void
  ): Promise<RawStartupCandidate[]> {
    const candidates: RawStartupCandidate[] = [];
    log?.(`[Show HN & Builders API] Escaneando lanzamientos tempranos y fundadores con correo directo...`);

    const searchQueries = [
      'https://hn.algolia.com/api/v1/search_by_date?query=' +
        encodeURIComponent('"gmail.com"') +
        '&tags=show_hn&hitsPerPage=40',
      'https://hn.algolia.com/api/v1/search_by_date?query=' +
        encodeURIComponent('"hello@" OR "hola@" OR "founder@" OR "contact@"') +
        '&tags=show_hn&hitsPerPage=40',
      'https://hn.algolia.com/api/v1/search_by_date?query=' +
        encodeURIComponent('cofounder OR "co-founder" OR "early beta" OR "waitlist" "gmail.com"') +
        '&tags=(story,show_hn,ask_hn)&hitsPerPage=40'
    ];

    for (const qUrl of searchQueries) {
      if (candidates.length >= 18) break;
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
          const storyText: string = (hit.story_text || '')
            .replace(/&#x2F;/g, '/')
            .replace(/&#x27;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const author: string = hit.author || 'founder';
          const points = Number(hit.points || 1);
          const url: string = hit.url || '';
          const hnLink = `https://news.ycombinator.com/item?id=${hit.objectID}`;

          if (existingUrls.has(hnLink) || (url && existingUrls.has(url))) continue;

          const combined = `${title} ${storyText}`;
          if (points > 140 || EXCLUDE_MATURE_COMPANIES_REGEX.test(combined)) continue;

          const directEmail = this.extractEmailFromPlainText(combined) || '';
          if (!directEmail && !url) continue;
          if (directEmail && existingEmails.has(directEmail.toLowerCase())) continue;

          const cleanTitle = title.replace(/^Show HN:\s*/i, '').replace(/^Ask HN:\s*/i, '').trim();
          const projectName = cleanTitle.split(/[-–—:|()]/)[0]?.trim() || `MVP de ${author}`;
          const isEs = this.isSpanishContent(combined);

          if (!candidates.some(c => c.communityUrl === hnLink || (directEmail && c.email === directEmail))) {
            candidates.push({
              sourcePlatform: 'Show HN / Builders',
              sourceDetail: `Show HN · Early Launch (${points} pts)`,
              projectName: projectName.substring(0, 42),
              founderName: author,
              founderHandleOrRole: 'Indie Maker & Founder',
              description: `${cleanTitle}. ${storyText.substring(0, 260)}`,
              signalSnippet: `"${cleanTitle} — ${storyText.substring(0, 220) || cleanTitle}"`,
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
   * FUENTE 3: GITHUB COMMITS & REPOSITORIES SEARCH (1 sola llamada ligera para no agotar rate-limit en Railway)
   * Busca commits/repos recientes de MVPs y proyectos en español que traen el email del autor directamente en el payload.
   */
  static async fetchGitHubSpanishIndieFounders(
    existingEmails: Set<string>,
    existingUrls: Set<string>,
    log?: (msg: string) => void
  ): Promise<RawStartupCandidate[]> {
    const candidates: RawStartupCandidate[] = [];
    log?.(`[GitHub Indie & MVP API] Buscando autores de MVPs y proyectos SaaS en español...`);

    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 6500);
      const res = await fetch(
        'https://api.github.com/search/commits?q=' +
          encodeURIComponent('mvp OR saas OR startup OR landing OR beta author-date:>2025-01-01') +
          '&sort=author-date&order=desc&per_page=30',
        {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Hormesis-Startup-Radar-App',
            Accept: 'application/vnd.github.cloak-preview+json,application/vnd.github+json'
          }
        }
      );
      clearTimeout(t);

      if (res.ok) {
        const data = await res.json();
        const items = data?.items || [];
        for (const item of items) {
          if (candidates.length >= 12) break;
          const authorEmail = (item?.commit?.author?.email || '').toLowerCase().trim();
          const authorName = item?.commit?.author?.name || item?.author?.login || 'Founder';
          const repo = item?.repository;
          if (!repo || !authorEmail || !authorEmail.includes('@')) continue;
          if (
            authorEmail.includes('noreply') ||
            authorEmail.includes('github.com') ||
            authorEmail.includes('example.com') ||
            authorEmail.includes('bot') ||
            existingEmails.has(authorEmail)
          ) {
            continue;
          }

          const repoUrl = repo.html_url || '';
          if (existingUrls.has(repoUrl)) continue;

          const desc = repo.description || item?.commit?.message || '';
          const fullText = `${repo.name} ${desc} ${authorName}`;
          if (EXCLUDE_MATURE_COMPANIES_REGEX.test(fullText)) continue;

          const isEs = this.isSpanishContent(fullText) || authorEmail.endsWith('.es');

          if (!candidates.some(c => c.email === authorEmail)) {
            candidates.push({
              sourcePlatform: 'GitHub Indie / MVP',
              sourceDetail: `GitHub MVP · ${isEs ? 'Builder Hispano' : 'Indie Builder'}`,
              projectName: repo.name.replace(/[-_]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
              founderName: authorName,
              founderHandleOrRole: `Indie Founder & Developer (@${item?.author?.login || authorName})`,
              description: desc.substring(0, 260),
              signalSnippet: `"Construyendo ${repo.name}: ${desc.substring(0, 220)}"`,
              communityUrl: repoUrl,
              websiteUrl: repoUrl,
              email: authorEmail,
              upvotesOrScore: 10,
              makersCount: 1,
              tags: ['MVP Temprano', isEs ? 'Español' : 'Builder'],
              isSpanish: isEs
            });
          }
        }
      }
    } catch (err: any) {
      log?.(`[GitHub Indie API] Aviso: ${err.message}`);
    }

    return candidates;
  }

  /**
   * FILTRADO ACTIVO CON IA (GROQ), DEDUPLICACIÓN CONTRA EL CRM Y PRIORIZACIÓN DE ESPAÑOL
   */
  static async qualifyAndFilterWithAI(
    candidates: RawStartupCandidate[],
    config: StartupRadarConfig,
    groqApiKey: string,
    targetCount: number,
    existingEmails: Set<string>,
    log?: (msg: string) => void
  ): Promise<QualifiedStartupLead[]> {
    const qualified: QualifiedStartupLead[] = [];
    const seenEmails = new Set<string>(existingEmails);
    const senderCompany = config.businessName || 'Grupo Hormesis';
    const senderContext =
      config.businessContext ||
      'Somos un Venture Studio y socio tecnológico que ayuda a fundadores en fase de ideación y pre-seed a construir su MVP funcional en semanas, diseñar la arquitectura IA y validar el producto.';

    // Ordenar priorizando candidatos que YA tienen email directo y contenido en español
    const sortedCandidates = [...candidates].sort((a, b) => {
      const aHasEmail = Boolean(a.email && a.email.includes('@'));
      const bHasEmail = Boolean(b.email && b.email.includes('@'));
      if (aHasEmail !== bHasEmail) return Number(bHasEmail) - Number(aHasEmail);
      if (a.isSpanish !== b.isSpanish) return Number(b.isSpanish) - Number(a.isSpanish);
      return 0;
    });

    for (const candidate of sortedCandidates) {
      if (qualified.length >= targetCount) break;

      if (!candidate.email && candidate.websiteUrl && candidate.websiteUrl.startsWith('http')) {
        const inspection = await this.inspectEarlyProjectLanding(candidate.websiteUrl);
        if (inspection.isMatureCompany) continue;
        if (inspection.email) {
          candidate.email = inspection.email;
          candidate.websiteUrl = inspection.finalUrl || candidate.websiteUrl;
        }
        if (inspection.isSpanish) candidate.isSpanish = true;
      }

      if (!candidate.email || !candidate.email.includes('@')) continue;

      const cleanEmail = candidate.email.toLowerCase().trim();
      if (seenEmails.has(cleanEmail)) continue;

      const emailCheck = await EmailValidatorService.validateEmail(cleanEmail);
      if (!emailCheck.isValid) continue;

      seenEmails.add(cleanEmail);
      candidate.email = cleanEmail;
      log?.(`📧 Lead nuevo verificado: ${candidate.projectName} (${candidate.founderName}) -> ${cleanEmail}`);

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

INSTRUCCIONES (TRADUCE Y REDACTA TODO EN ESPAÑOL):
1. Si el nombre o extracto del proyecto está en inglés, traduce/adapta "signalSnippetEs" al español para que el equipo en España entienda de inmediato qué hace el proyecto y qué busca el fundador.
2. Clasifica su fase exacta ("startupStage") eligiendo UNA de estas 4:
   - "💡 Fase de Ideación"
   - "🤝 Buscando Socio Técnico"
   - "🧪 Validación / Waitlist"
   - "🛠️ MVP Temprano"
3. Determina su Necesidad Técnica Primaria ("primaryTechnicalNeed") en español.
4. Recomienda el Stack Tecnológico ideal ("recommendedStack") para su caso.
5. Extrae 3 cuellos de botella o dolores técnicos concretos de su etapa ("painPoints") en español.
6. Calcula un "qualificationScore" (85 a 98).
7. Redacta en español un "aiSubjectLine" y un "aiCustomPitch" (2 párrafos cortos y directos comentando su publicación/proyecto "${candidate.projectName}" en ${candidate.sourcePlatform} y proponiendo una charla de 15 min para apoyarle como socio tecnológico).

Devuelve ÚNICAMENTE un JSON válido:
{
  "projectNameEs": "${candidate.projectName}",
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
          const t = setTimeout(() => controller.abort(), 8000);
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
              max_tokens: 800
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
        } catch {}
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
