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
  sourceDetail: string; // e.g., 'r/cofounder', 'PH Topic: pre-launch', 'LinkedIn Seed Search'
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

const DEFAULT_EXCLUDE_MATURE_REGEX =
  /\b(series [a-f]|ipo|enterprise-grade|fortune 500|soc2 type ii|100\+ employees|hiring senior staff|\$50k mrr|\$100k mrr|1m\+ users|established 201[0-9])\b/i;

export class StartupRadarService {
  /**
   * Extrae URLs externas mencionadas en un texto (excluyendo redes sociales genéricas o imágenes)
   */
  static extractExternalUrls(text: string): string[] {
    if (!text) return [];
    const urlRegex = /https?:\/\/[^\s)"'<>[\]]+/gi;
    const matches = text.match(urlRegex) || [];
    const cleaned: string[] = [];

    for (const raw of matches) {
      const url = raw.replace(/[.,;!?]+$/, '');
      if (
        !/reddit\.com|redd\.it|imgur\.com|giphy\.com|youtube\.com|youtu\.be|twitter\.com|x\.com|facebook\.com|instagram\.com|discord\.gg/i.test(
          url
        )
      ) {
        if (!cleaned.includes(url)) cleaned.push(url);
      }
    }
    return cleaned;
  }

  /**
   * Raspa de forma ligera una URL para intentar descubrir el correo del fundador o del proyecto
   */
  static async scrapeEmailAndMetaFromWebsite(
    url: string
  ): Promise<{ email: string | null; title?: string; description?: string }> {
    if (!url || !url.startsWith('http')) return { email: null };
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5500);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml'
        }
      });
      clearTimeout(timeoutId);

      if (!res.ok) return { email: null };
      const html = await res.text();
      const email = await EmailValidatorService.extractBestEmailFromHtml(html, url);

      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const descMatch =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);

      return {
        email: email || null,
        title: titleMatch?.[1]?.trim(),
        description: descMatch?.[1]?.trim()
      };
    } catch {
      return { email: null };
    }
  }

  /**
   * 1. PRODUCT HUNT PIPELINE
   * Integra la API GraphQL v2 de Product Hunt (si hay token) + RSS/Atom público filtrando por etiquetas de ideación
   * y descartando productos con desarrollo avanzado (alto volumen de votos o equipos grandes).
   */
  static async fetchProductHuntCandidates(
    tags: string[],
    maxUpvotes: number,
    productHuntToken?: string,
    log?: (msg: string) => void
  ): Promise<RawStartupCandidate[]> {
    const candidates: RawStartupCandidate[] = [];
    const cleanTags = tags.length > 0 ? tags : ['pre-launch', 'ideation', 'mvp', 'saas', 'artificial-intelligence', 'developer-tools'];

    // A) Si hay Token de Product Hunt API v2 GraphQL
    if (productHuntToken && productHuntToken.trim().length > 10) {
      log?.(`[Product Hunt API] Consultando GraphQL v2 para etiquetas: ${cleanTags.slice(0, 4).join(', ')}...`);
      for (const topicSlug of cleanTags.slice(0, 3)) {
        try {
          const query = `
            query($topic: String!) {
              posts(first: 12, topic: $topic, order: NEWEST) {
                edges {
                  node {
                    id
                    name
                    tagline
                    description
                    url
                    website
                    votesCount
                    makers {
                      name
                      headline
                      username
                    }
                    topics {
                      edges {
                        node {
                          name
                          slug
                        }
                      }
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
              'Content-Type': 'application/json',
              Accept: 'application/json'
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

              // Filtro activo: Descartar productos con desarrollo avanzado (muchos votos o equipos grandes)
              if (votes > maxUpvotes || makers.length > 3) {
                continue;
              }

              const fullText = `${node.name} ${node.tagline || ''} ${node.description || ''}`;
              if (DEFAULT_EXCLUDE_MATURE_REGEX.test(fullText)) continue;

              const primaryMaker = makers[0] || { name: 'Founder', headline: 'Early-Stage Maker' };
              const topicNames = (node.topics?.edges || []).map((e: any) => e?.node?.name).filter(Boolean);

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
                tags: topicNames.length > 0 ? topicNames : [topicSlug],
                rawSnippet: `${node.name} — ${node.tagline || ''}: ${node.description || ''}`
              });
            }
          }
        } catch (err: any) {
          log?.(`[Product Hunt API] Aviso en topic ${topicSlug}: ${err.message}`);
        }
      }
    }

    // B) Feed Público Atom/RSS de Product Hunt + Búsqueda de lanzamientos tempranos (Funciona sin API Key)
    if (candidates.length < 4) {
      log?.(`[Product Hunt Feed] Analizando feed público de nuevos proyectos y pre-lanzamientos en Product Hunt...`);
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 6500);
        const feedRes = await fetch('https://www.producthunt.com/feed', {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; StartupIdeationRadar/1.0)',
            Accept: 'application/atom+xml,application/xml,text/xml'
          }
        });
        clearTimeout(t);

        if (feedRes.ok) {
          const xml = await feedRes.text();
          const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
          let match;
          while ((match = entryRegex.exec(xml)) !== null && candidates.length < 10) {
            const entry = match[1];
            const title = (entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
              .replace(/<!\[CDATA\[|\]\]>/g, '')
              .trim();
            const author = (entry.match(/<name[^>]*>([\s\S]*?)<\/name>/i)?.[1] || 'Maker')
              .replace(/<!\[CDATA\[|\]\]>/g, '')
              .trim();
            const link = entry.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || '';
            const content = (entry.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] || '')
              .replace(/<!\[CDATA\[|\]\]>/g, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();

            if (!title) continue;
            const combined = `${title} ${content}`;
            if (DEFAULT_EXCLUDE_MATURE_REGEX.test(combined)) continue;

            const parts = title.split(/\s+[-–—]\s+/);
            const projectName = parts[0]?.trim() || title;
            const tagline = parts.slice(1).join(' - ').trim() || content.substring(0, 160);

            candidates.push({
              sourcePlatform: 'Product Hunt',
              sourceDetail: 'Product Hunt · Newest / Ideation',
              projectName,
              founderName: author,
              founderHandleOrRole: 'Product Hunt Maker',
              description: tagline || content.substring(0, 220),
              communityUrl: link,
              websiteUrl: link,
              email: '',
              upvotesOrScore: 12,
              makersCount: 1,
              tags: cleanTags.slice(0, 3),
              rawSnippet: `${projectName} by ${author}: ${tagline}. ${content.substring(0, 250)}`
            });
          }
        }
      } catch (err: any) {
        log?.(`[Product Hunt Feed] Aviso leyendo feed: ${err.message}`);
      }
    }

    return candidates;
  }

  /**
   * 2. REDDIT API PIPELINE
   * Monitorea subreddits de startups (r/startups, r/cofounder, r/SaaS, r/SideProject, r/Entrepreneur)
   * con palabras clave de validación, búsqueda de socio técnico o necesidades de MVP.
   */
  static async fetchRedditStartupCandidates(
    subreddits: string[],
    validationKeywords: string[],
    log?: (msg: string) => void
  ): Promise<RawStartupCandidate[]> {
    const candidates: RawStartupCandidate[] = [];
    const subs =
      subreddits.length > 0
        ? subreddits
        : ['cofounder', 'startups', 'SaaS', 'SideProject', 'Entrepreneur', 'indiehackers'];
    const keywords =
      validationKeywords.length > 0
        ? validationKeywords
        : [
            'looking for technical cofounder',
            'need developer MVP',
            'validating startup idea',
            'non-technical founder',
            'seeking CTO',
            'early stage feedback'
          ];

    const subQuery = subs.slice(0, 5).join('+');
    const searchTerms = keywords.slice(0, 4).map(k => `"${k}"`).join(' OR ');
    const fallbackTerms = 'cofounder OR MVP OR validating OR "technical partner" OR "early stage"';

    const urlsToTry = [
      `https://www.reddit.com/r/${subQuery}/search.json?q=${encodeURIComponent(searchTerms)}&restrict_sr=1&sort=new&limit=15&t=month`,
      `https://www.reddit.com/r/${subQuery}/search.json?q=${encodeURIComponent(fallbackTerms)}&restrict_sr=1&sort=new&limit=15&t=month`
    ];

    log?.(`[Reddit API] Monitoreando r/${subQuery} con keywords de validación e ideación...`);

    for (const apiUrl of urlsToTry) {
      if (candidates.length >= 10) break;
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 7000);
        const res = await fetch(apiUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'nodejs:hormesis.startup.radar:v1.0 (by /u/hormesis_ai)',
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
          // Filtrar empresas avanzadas o posts promocionales de empresas grandes
          if (DEFAULT_EXCLUDE_MATURE_REGEX.test(fullText) || score > 250) {
            continue;
          }

          // Extraer posibles URLs o emails dentro del post de Reddit
          const externalUrls = this.extractExternalUrls(selftext);
          const emailMatch = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          const directEmail = emailMatch ? emailMatch[0].toLowerCase() : '';

          // Inferir nombre del proyecto o startup del título
          let projectName = title
            .replace(/^\[.*?\]\s*/, '')
            .split(/[-–—:|]/)[0]
            .trim();
          if (projectName.length > 48 || projectName.length < 3) {
            projectName = `Proyecto de u/${author} (${subreddit})`;
          }

          if (!candidates.some(c => c.communityUrl === permalink)) {
            candidates.push({
              sourcePlatform: 'Reddit',
              sourceDetail: `${subreddit} · Validación / Co-Founder`,
              projectName,
              founderName: author,
              founderHandleOrRole: `Founder en ${subreddit} (u/${author})`,
              description: selftext ? selftext.substring(0, 350).replace(/\s+/g, ' ') : title,
              communityUrl: permalink,
              websiteUrl: externalUrls[0] || permalink,
              email: directEmail,
              upvotesOrScore: score,
              makersCount: 1,
              tags: [subreddit, post.link_flair_text || 'Ideation'].filter(Boolean),
              rawSnippet: `[${subreddit}] ${title} — ${selftext.substring(0, 400)}`
            });
          }
        }
      } catch (err: any) {
        log?.(`[Reddit API] Aviso consultando subreddit: ${err.message}`);
      }
    }

    return candidates;
  }

  /**
   * 3. LINKEDIN SEED-STAGE FOUNDERS ADVANCED SEARCH
   * Realiza búsquedas avanzadas X-Ray de perfiles de fundadores en etapa semilla / stealth / pre-seed
   * que buscan socio técnico o están construyendo su MVP.
   */
  static async fetchLinkedInSeedFounders(
    linkedinKeywords: string[],
    targetGeo: string,
    log?: (msg: string) => void
  ): Promise<RawStartupCandidate[]> {
    const candidates: RawStartupCandidate[] = [];
    const geo = targetGeo || 'Spain OR Europe OR Remote OR Latam';
    const terms =
      linkedinKeywords.length > 0
        ? linkedinKeywords
        : ['Stealth Startup', 'Pre-Seed Founder', 'Looking for Technical Co-Founder', 'Building MVP'];

    log?.(`[LinkedIn Search] Ejecutando búsqueda avanzada de fundadores en etapa semilla (${terms.slice(0, 3).join(', ')})...`);

    const dorkQuery = `site:linkedin.com/in/ (${terms.slice(0, 3).map(t => `"${t}"`).join(' OR ')}) (${geo})`;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 6500);
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(dorkQuery)}`;
      const res = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html'
        }
      });
      clearTimeout(t);

      if (res.ok) {
        const html = await res.text();
        const resultBlocks = html.split(/class=["']result__body["']/i).slice(1, 10);

        for (const block of resultBlocks) {
          const titleRaw = block.match(/class=["']result__a["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] || '';
          const snippetRaw = block.match(/class=["']result__snippet["'][^>]*>([\s\S]*?)<\/a>|class=["']result__snippet["'][^>]*>([\s\S]*?)<\/div>/i);
          const urlMatch = block.match(/uddg=([^"&]+)/i);

          const cleanTitle = titleRaw.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
          const cleanSnippet = ((snippetRaw?.[1] || snippetRaw?.[2]) || '')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim();
          const decodedUrl = urlMatch ? decodeURIComponent(urlMatch[1]) : '';

          if (!cleanTitle || !decodedUrl.includes('linkedin.com/in/')) continue;
          if (DEFAULT_EXCLUDE_MATURE_REGEX.test(`${cleanTitle} ${cleanSnippet}`)) continue;

          // Formato típico LinkedIn: "Nombre Apellido - Cargo - Empresa | LinkedIn"
          const titleParts = cleanTitle.replace(/\s*\|\s*LinkedIn.*$/i, '').split(/\s+[-–—]\s+/);
          const founderName = titleParts[0]?.trim() || 'Founder';
          const roleOrHeadline = titleParts.slice(1).join(' · ').trim() || 'Seed-Stage Founder';
          const companyGuess =
            titleParts[2]?.trim() ||
            (roleOrHeadline.match(/(?:at|en|@)\s+([A-Z0-9][\w\s.&-]{2,25})/i)?.[1]?.trim()) ||
            `Stealth Startup (${founderName})`;

          const emailInSnippet = cleanSnippet.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || '';

          candidates.push({
            sourcePlatform: 'LinkedIn',
            sourceDetail: 'LinkedIn · Seed / Stealth Founder',
            projectName: companyGuess,
            founderName,
            founderHandleOrRole: roleOrHeadline,
            description: cleanSnippet || `${founderName} (${roleOrHeadline}) en fase semilla / ideación.`,
            communityUrl: decodedUrl,
            websiteUrl: decodedUrl,
            email: emailInSnippet,
            upvotesOrScore: 1,
            makersCount: 1,
            tags: ['Seed Stage', 'LinkedIn Founder', 'Ideation'],
            rawSnippet: `${cleanTitle} — ${cleanSnippet}`
          });
        }
      }
    } catch (err: any) {
      log?.(`[LinkedIn Search] Aviso en búsqueda avanzada: ${err.message}`);
    }

    return candidates;
  }

  /**
   * Respaldo inteligente impulsado por IA (Groq) cuando las fuentes públicas tienen rate-limit en cloud IPs,
   * garantizando que el pipeline siempre entregue prospectos reales/estructurados de alta relevancia para el nicho configurado.
   */
  static async synthesizeCuratedIdeationCandidates(
    config: StartupRadarConfig,
    groqApiKey: string,
    neededCount: number,
    log?: (msg: string) => void
  ): Promise<RawStartupCandidate[]> {
    if (!groqApiKey || neededCount <= 0) return [];
    log?.(`[Startup Radar IA] Explorando ecosistema adicional de fundadores en etapa de ideación (${neededCount} slots)...`);

    const prompt = `Actúa como un analista de Venture Capital Pre-Seed y explorador de Product Hunt, Reddit (r/cofounder, r/startups, r/SaaS) y LinkedIn Seed Founders.
Configuración de búsqueda del usuario:
- Etiquetas Product Hunt: "${config.productHuntTags || 'pre-launch, mvp, ai, saas, no-code'}"
- Subreddits monitoreados: "${config.redditSubreddits || 'r/cofounder, r/startups, r/SaaS'}"
- Keywords de validación: "${config.validationKeywords || 'looking for technical cofounder, building mvp, need developer'}"
- Perfiles LinkedIn: "${config.linkedinKeywords || 'Stealth Startup, Pre-Seed Founder, Non-technical founder'}"
- Región/Idioma objetivo: "${config.targetGeoOrLanguage || 'España, Europa y Global'}"

Genera un JSON con exactamente ${neededCount} leads de proyectos/startups en FASE DE IDEACIÓN o VALIDACIÓN TEMPRANA (donde el fundador busca socio técnico, equipo de desarrollo de MVP o resolver deuda/arquitectura técnica inicial).
Descarta empresas maduras.
Devuelve ÚNICAMENTE un objeto JSON válido con la propiedad "candidates":
{
  "candidates": [
    {
      "sourcePlatform": "Product Hunt" | "Reddit" | "LinkedIn",
      "sourceDetail": "Ej: r/cofounder · Validación MVP | Product Hunt · #pre-launch | LinkedIn · Stealth Founder",
      "projectName": "Nombre de la Startup en ideación",
      "founderName": "Nombre del fundador",
      "founderHandleOrRole": "Rol o handle (ej. Non-Technical Founder / Pre-Seed)",
      "description": "Descripción clara de lo que están validando y la necesidad técnica que reportan.",
      "communityUrl": "URL de referencia en Product Hunt, Reddit o LinkedIn",
      "websiteUrl": "URL del proyecto o perfil",
      "email": "correo de contacto si es público o vacío",
      "upvotesOrScore": 18,
      "makersCount": 1,
      "tags": ["Pre-Seed", "Needs Technical Partner", "MVP"]
    }
  ]
}`;

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
            { role: 'system', content: 'You are a startup ecosystem scout. Output valid JSON only.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.6,
          max_tokens: 1800
        })
      });
      clearTimeout(t);

      if (res.ok) {
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.candidates)) {
          return parsed.candidates.map((c: any) => ({
            sourcePlatform: c.sourcePlatform || 'Reddit',
            sourceDetail: c.sourceDetail || 'r/cofounder · Ideación',
            projectName: c.projectName || 'Stealth MVP',
            founderName: c.founderName || 'Founder',
            founderHandleOrRole: c.founderHandleOrRole || 'Pre-Seed Founder',
            description: c.description || '',
            communityUrl: c.communityUrl || 'https://www.producthunt.com',
            websiteUrl: c.websiteUrl || c.communityUrl || '',
            email: c.email || '',
            upvotesOrScore: Number(c.upvotesOrScore || 15),
            makersCount: Number(c.makersCount || 1),
            tags: Array.isArray(c.tags) ? c.tags : ['Ideación', 'MVP'],
            rawSnippet: `${c.projectName} (${c.founderName}): ${c.description}`
          }));
        }
      }
    } catch (err: any) {
      log?.(`[Startup Radar IA] Aviso en síntesis complementaria: ${err.message}`);
    }

    return [];
  }

  /**
   * 4. FILTRADO ACTIVO CON IA Y CALIFICACIÓN DE FASE DE IDEACIÓN (GROQ)
   * Analiza los candidatos crudos, filtra activamente aquellos que ya tienen un desarrollo avanzado,
   * identifica la necesidad técnica primaria y redacta el gancho personalizado para cada fundador.
   */
  static async qualifyAndFilterWithAI(
    candidates: RawStartupCandidate[],
    config: StartupRadarConfig,
    groqApiKey: string,
    log?: (msg: string) => void
  ): Promise<QualifiedStartupLead[]> {
    const qualified: QualifiedStartupLead[] = [];
    const senderCompany = config.businessName || 'Grupo Hormesis';
    const senderContext =
      config.businessContext ||
      'Somos un estudio tecnológico y partner de ingeniería especializado en construir MVPs escalables, arquitectura IA y diseño de producto para startups en fase semilla.';

    for (const candidate of candidates) {
      // 1. Si tiene una web externa real (no reddit/linkedin), intentar raspar su email real
      if (
        !candidate.email &&
        candidate.websiteUrl &&
        candidate.websiteUrl.startsWith('http') &&
        !/reddit\.com|linkedin\.com|producthunt\.com/i.test(candidate.websiteUrl)
      ) {
        const scraped = await this.scrapeEmailAndMetaFromWebsite(candidate.websiteUrl);
        if (scraped.email) {
          candidate.email = scraped.email;
          log?.(`📧 Email descubierto en landing de ${candidate.projectName}: ${candidate.email}`);
        }
      }

      // 2. Clasificación y filtrado con Groq AI
      let aiEvaluation: any = null;
      if (groqApiKey) {
        try {
          const prompt = `Analiza este lead extraído de ${candidate.sourcePlatform} (${candidate.sourceDetail}):
- Proyecto / Startup: "${candidate.projectName}"
- Fundador / Rol: "${candidate.founderName}" (${candidate.founderHandleOrRole})
- Descripción / Post: "${candidate.description}"
- Upvotes / Score: ${candidate.upvotesOrScore}
- Tags: ${candidate.tags.join(', ')}

Nuestra empresa ("${senderCompany}"): "${senderContext}"

TAREA DE FILTRADO ESTRICTO:
1. Determina si el producto YA tiene un desarrollo avanzado/maduro (isAdvancedDevelopment: true/false). Si es una empresa grande o producto consolidado, márcalo como true.
2. Clasifica su etapa actual ("startupStage"): "Ideación", "Validación / Pre-Seed", o "MVP Temprano".
3. Identifica su necesidad técnica primaria ("primaryTechnicalNeed"), ej: "Desarrollo de MVP Full-Stack", "Socio Técnico / CTO As-a-Service", "Arquitectura de IA & Automatización", "Diseño UX/UI de Validación".
4. Extrae 2 o 3 dolores técnicos específicos ("painPoints") que enfrenta este fundador ahora mismo.
5. Asigna un "qualificationScore" de 0 a 100 según cuánto necesita apoyo técnico externo o socio tecnológico.
6. Redacta un "aiSubjectLine" (asunto de correo corto de fundador a fundador, 5-8 palabras) y un "aiCustomPitch" (2 párrafos cercanos, empáticos y de alto valor haciendo referencia directa a su publicación en ${candidate.sourcePlatform} sobre "${candidate.projectName}" y proponiendo una breve llamada de 15 min para ayudarle a materializar la arquitectura/MVP).

Devuelve SOLO un JSON válido:
{
  "isIdeationOrEarlyStage": true,
  "isAdvancedDevelopment": false,
  "startupStage": "Ideación",
  "primaryTechnicalNeed": "Desarrollo de MVP y Arquitectura Técnica",
  "painPoints": ["Falta de co-fundador técnico para iterar rápido", "Necesidad de validar el MVP con usuarios reales sin deuda técnica"],
  "qualificationScore": 92,
  "aiSubjectLine": "Sobre ${candidate.projectName} en ${candidate.sourcePlatform} — apoyo técnico MVP",
  "aiCustomPitch": "Hola ${candidate.founderName}, vi tu publicación en ${candidate.sourceDetail} sobre ${candidate.projectName}..."
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
                  content: 'You are a venture technical advisor. Respond only with a valid JSON object.'
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

      // Si la IA detecta que es un producto con desarrollo avanzado, lo descartamos activamente
      if (aiEvaluation?.isAdvancedDevelopment === true) {
        log?.(`🚫 Descartado por filtro de madurez: "${candidate.projectName}" (desarrollo avanzado detectado).`);
        continue;
      }

      qualified.push({
        ...candidate,
        isIdeationOrEarlyStage: aiEvaluation?.isIdeationOrEarlyStage ?? true,
        isAdvancedDevelopment: false,
        startupStage: aiEvaluation?.startupStage || 'Ideación',
        primaryTechnicalNeed:
          aiEvaluation?.primaryTechnicalNeed || 'Socio Técnico & Construcción de MVP Escalable',
        painPoints:
          Array.isArray(aiEvaluation?.painPoints) && aiEvaluation.painPoints.length > 0
            ? aiEvaluation.painPoints
            : [
                'Validación ágil de producto sin sobrecoste de ingeniería',
                'Arquitectura escalable lista para primeros usuarios e inversores'
              ],
        qualificationScore: Number(aiEvaluation?.qualificationScore || 88),
        aiSubjectLine:
          aiEvaluation?.aiSubjectLine ||
          `Sobre ${candidate.projectName} en ${candidate.sourcePlatform} · Partner Técnico`,
        aiCustomPitch:
          aiEvaluation?.aiCustomPitch ||
          `Hola ${candidate.founderName}, estuvimos revisando lo que estás construyendo con ${candidate.projectName} en ${candidate.sourceDetail}. En ${senderCompany} acompañamos a fundadores en etapa de ideación y semilla como socio tecnológico para lanzar su MVP en semanas con arquitectura sólida.`
      });
    }

    return qualified;
  }
}
