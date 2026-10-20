import dns from 'dns/promises';

export interface EmailValidationResult {
  isValid: boolean;
  email: string;
  domain?: string;
  reason?: string;
}

export class EmailValidatorService {
  private static domainCache = new Map<string, { isValid: boolean; reason?: string; timestamp: number }>();
  private static CACHE_TTL_MS = 1000 * 60 * 60; // 1 hora de caché

  // Prefijos locales ficticios o de marcador de posición habituales en plantillas web
  private static BLOCKED_LOCAL_PARTS = new Set([
    'tucorreo', 'correo', 'tuemail', 'email', 'ejemplo', 'example', 'test', 'prueba', 
    'demo', 'fake', 'sample', 'temp', 'dummy', 'nobody', 'tunombre', 'nombre', 
    'yourname', 'youremail', 'your-email', 'name', 'username', 'user', 'usuario',
    'no-reply', 'noreply', 'donotreply', 'do-not-reply', 'bounce', 'mailer-daemon'
  ]);

  // Dominios de prueba, ficticios, de constructores web o plataformas de desarrollo
  private static BLOCKED_DOMAINS = new Set([
    'example.com', 'example.org', 'example.net',
    'dominio.com', 'tudominio.com', 'tudominio.es', 'tudominio.net',
    'electronico.com', 'correo.es', 'correo.com', 'email.com',
    'test.com', 'testing.com', 'localhost', 'invalid',
    'midominio.com', 'misitio.es', 'sitio.com', 'empresa.com', 'miempresa.com',
    'wixpress.com', 'sentry.io', 'sentry-cdn.com', 'wordpress.org', 'wordpress.com',
    'automattic.com', 'cloudflare.com', 'shopify.com', 'elementor.com', 'wpengine.com', 
    'schema.org', 'gravatar.com', 'github.com', 'recaptcha.net', 'google.com', 
    'themeforest.net', 'envato.com', 'cookiebot.com', 'onetrust.com', 'iubenda.com', 
    'privacypolicies.com', 'whoisguard.com', 'domainsbyproxy.com', 'contactprivacy.com', 
    'privacyprotect.org', 'withgoogle.com', 'googleapis.com', 'bootstrap.com', 
    'fontawesome.com', 'jquery.com', 'w3.org'
  ]);

  // Dominios con errores tipográficos comunes de proveedores populares
  private static TYPO_DOMAINS = new Set([
    'gmial.com', 'gamil.com', 'gmaill.com', 'gmai.com', 'gmai.es', 'gmail.es',
    'hotmial.com', 'hotmai.com', 'hotmaill.com', 'hotmial.es',
    'outlok.com', 'outllok.com', 'outloo.com', 'outlok.es',
    'yaho.com', 'yahooo.com', 'yahho.com'
  ]);

  // Servicios de correo temporal y desechable
  private static DISPOSABLE_DOMAINS = new Set([
    'mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com', 
    'sharklasers.com', 'dispostable.com', 'throwawaymail.com', 'yopmail.com', 
    'trashmail.com', 'getairmail.com', 'mohmal.com', 'crazymailing.com'
  ]);

  // Extensiones de archivos que suelen colarse como falsos TLDs en expresiones regulares
  private static INVALID_TLDS = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff',
    'js', 'css', 'html', 'htm', 'php', 'asp', 'aspx', 'jsp',
    'woff', 'woff2', 'ttf', 'eot', 'otf',
    'pdf', 'zip', 'rar', 'tar', 'gz', '7z',
    'mp4', 'mp3', 'mov', 'avi', 'mkv', 'webm',
    'json', 'xml', 'map', 'txt', 'csv'
  ]);

  // Patrones de servidores de nombres (NS) que indican dominios aparcados, en venta o suspendidos
  private static PARKED_NS_PATTERNS = [
    /parking/i,
    /parked/i,
    /dns-parking/i,
    /parklogic/i,
    /sedo/i,
    /bodis/i,
    /dan\.com/i,
    /above\.com/i,
    /undeveloped/i,
    /afternic/i,
    /domainparking/i
  ];

  /**
   * Valida la sintaxis básica, longitud y descarta nombres y dominios de prueba obvios.
   */
  static isSyntaxValid(email: string): { valid: boolean; reason?: string } {
    if (!email || typeof email !== 'string') {
      return { valid: false, reason: 'El correo está vacío o no es una cadena válida' };
    }

    const clean = email.trim().toLowerCase();
    if (clean.length < 5 || clean.length > 254) {
      return { valid: false, reason: 'Longitud de correo fuera del límite permitido (5-254 caracteres)' };
    }

    if (clean.includes('..') || clean.includes(' ') || clean.includes('/') || clean.includes('\\')) {
      return { valid: false, reason: 'El correo contiene caracteres o secuencias inválidas (ej. puntos consecutivos o espacios)' };
    }

    const atCount = (clean.match(/@/g) || []).length;
    if (atCount !== 1) {
      return { valid: false, reason: 'El correo debe contener exactamente un símbolo @' };
    }

    const [localPart, domain] = clean.split('@');
    if (!localPart || !domain || localPart.length > 64) {
      return { valid: false, reason: 'La parte local del correo excede 64 caracteres o es nula' };
    }

    if (localPart.startsWith('.') || localPart.endsWith('.')) {
      return { valid: false, reason: 'La parte local no puede comenzar ni terminar con un punto' };
    }

    const domainParts = domain.split('.');
    if (domainParts.length < 2) {
      return { valid: false, reason: 'El dominio debe contener al menos un punto' };
    }

    const tld = domainParts[domainParts.length - 1];
    if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
      return { valid: false, reason: 'TLD inválido' };
    }

    if (this.INVALID_TLDS.has(tld)) {
      return { valid: false, reason: `Falso positivo detectado (extensión de archivo .${tld})` };
    }

    if (this.BLOCKED_LOCAL_PARTS.has(localPart)) {
      return { valid: false, reason: `Nombre local de marcador de posición descartado (${localPart})` };
    }

    if (this.BLOCKED_DOMAINS.has(domain)) {
      return { valid: false, reason: `Dominio de prueba o proveedor de plataforma descartado (${domain})` };
    }

    if (this.TYPO_DOMAINS.has(domain)) {
      return { valid: false, reason: `Error tipográfico detectado en dominio común (${domain})` };
    }

    if (this.DISPOSABLE_DOMAINS.has(domain)) {
      return { valid: false, reason: `Proveedor de correo temporal o desechable descartado (${domain})` };
    }

    return { valid: true };
  }

  /**
   * Comprueba en tiempo real si el dominio posee servidores MX activos y que no esté aparcado.
   */
  static async hasValidMxAndActiveServer(domain: string, timeoutMs: number = 3000): Promise<{ valid: boolean; reason?: string }> {
    const cleanDomain = domain.toLowerCase().trim();

    // 1. Revisar caché en memoria
    const cached = this.domainCache.get(cleanDomain);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return { valid: cached.isValid, reason: cached.reason };
    }

    try {
      // 2. Consulta de registros MX con timeout estricto
      const resolveMxPromise = dns.resolveMx(cleanDomain);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DNS Timeout')), timeoutMs)
      );

      const mxRecords = await Promise.race([resolveMxPromise, timeoutPromise]);
      if (!mxRecords || mxRecords.length === 0) {
        const res = { valid: false, reason: `El dominio ${cleanDomain} no tiene registros de correo (MX) configurados` };
        this.domainCache.set(cleanDomain, { isValid: false, reason: res.reason, timestamp: Date.now() });
        return res;
      }

      // RFC 7505: "Null MX" (exchange: ".") indica explícitamente que el dominio no acepta correos
      const validMx = mxRecords.filter(r => r && r.exchange && r.exchange.trim() !== '.' && r.exchange.trim() !== '');
      if (validMx.length === 0) {
        const res = { valid: false, reason: `El dominio ${cleanDomain} tiene un Null MX (rechaza correo explícitamente)` };
        this.domainCache.set(cleanDomain, { isValid: false, reason: res.reason, timestamp: Date.now() });
        return res;
      }

      // 3. Comprobar que al menos un servidor MX de destino sea resoluble a una IP válida
      let mxResolvesToIp = false;
      for (const r of validMx.slice(0, 2)) {
        try {
          const ips = await dns.resolve4(r.exchange);
          if (ips && ips.length > 0) {
            mxResolvesToIp = true;
            break;
          }
        } catch (e) {}
      }

      if (!mxResolvesToIp) {
        const res = { valid: false, reason: `Los servidores MX de ${cleanDomain} no resuelven a ninguna dirección IP activa` };
        this.domainCache.set(cleanDomain, { isValid: false, reason: res.reason, timestamp: Date.now() });
        return res;
      }

      // 4. Comprobar servidores de nombres (NS) para descartar dominios aparcados/expirados (ej. dns-parking.com, sedoparking)
      try {
        const resolveNsPromise = dns.resolveNs(cleanDomain);
        const nsTimeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('NS Timeout')), 2000));
        const nsRecords = await Promise.race([resolveNsPromise, nsTimeout]);

        for (const ns of nsRecords) {
          if (this.PARKED_NS_PATTERNS.some(p => p.test(ns))) {
            const res = { valid: false, reason: `El dominio ${cleanDomain} está aparcado o en venta (${ns}) y no posee buzón activo` };
            this.domainCache.set(cleanDomain, { isValid: false, reason: res.reason, timestamp: Date.now() });
            return res;
          }
        }
      } catch (nsErr) {
        // Si la consulta NS falla por timeout o formato, nos guiamos por la resolución MX que ya fue positiva
      }

      // Guardar en caché como válido
      this.domainCache.set(cleanDomain, { isValid: true, timestamp: Date.now() });
      return { valid: true };

    } catch (err: any) {
      let reason = `Fallo de resolución de dominio para ${cleanDomain}`;
      if (err.code === 'ENOTFOUND') {
        reason = `El dominio ${cleanDomain} no existe`;
      } else if (err.code === 'ENODATA') {
        reason = `El dominio ${cleanDomain} existe pero no tiene ningún registro de correo (MX)`;
      } else if (err.message === 'DNS Timeout') {
        reason = `Tiempo de espera agotado al consultar servidores de ${cleanDomain}`;
      }
      this.domainCache.set(cleanDomain, { isValid: false, reason, timestamp: Date.now() });
      return { valid: false, reason };
    }
  }

  /**
   * Valida completamente una dirección de correo (sintaxis + DNS MX activo + servidor real).
   */
  static async validateEmail(email: string, websiteUrl?: string): Promise<EmailValidationResult> {
    const clean = (email || '').trim().toLowerCase();
    
    // 1. Sintaxis y patrones
    const syntax = this.isSyntaxValid(clean);
    if (!syntax.valid) {
      return { isValid: false, email: clean, reason: syntax.reason };
    }

    const domain = clean.split('@')[1];

    // 2. DNS MX y chequeo de dominio aparcado
    const mxCheck = await this.hasValidMxAndActiveServer(domain);
    if (!mxCheck.valid) {
      return { isValid: false, email: clean, domain, reason: mxCheck.reason };
    }

    return { isValid: true, email: clean, domain };
  }

  /**
   * Extrae todas las direcciones de correo de un HTML, descarta las inválidas y selecciona
   * la más confiable y de mayor calidad dando prioridad al dominio del negocio.
   */
  static async extractBestEmailFromHtml(html: string, websiteUrl?: string): Promise<string | null> {
    if (!html || typeof html !== 'string') return null;

    const candidateSet = new Set<string>();

    // 1. Extraer enlaces mailto:
    const mailtoRegex = /href=["']mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})[?"']/gi;
    let m: RegExpExecArray | null;
    while ((m = mailtoRegex.exec(html)) !== null) {
      if (m[1]) candidateSet.add(m[1].toLowerCase().trim());
    }

    // 2. Extraer texto plano con formato email
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const textMatches = html.match(emailRegex) || [];
    for (const match of textMatches) {
      candidateSet.add(match.toLowerCase().trim());
    }

    if (candidateSet.size === 0) return null;

    // Extraer hostname base del sitio web para afinidad
    let websiteDomain = '';
    if (websiteUrl) {
      try {
        const u = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
        websiteDomain = u.hostname.replace(/^www\./, '').toLowerCase();
      } catch (e) {}
    }

    // 3. Validar todos los candidatos concurrentemente
    const validationPromises = Array.from(candidateSet).map(async (candidate) => {
      const result = await this.validateEmail(candidate, websiteUrl);
      return { candidate, ...result };
    });

    const results = await Promise.all(validationPromises);
    const validCandidates = results.filter(r => r.isValid);

    if (validCandidates.length === 0) {
      return null;
    }

    // 4. Puntuar y ordenar candidatos válidos para seleccionar el de mayor confianza
    const priorityPrefixes = [
      'info@', 'contacto@', 'contact@', 'hola@', 'direccion@', 'administracion@',
      'atencion@', 'atencionalcliente@', 'reservas@', 'comercial@', 'ventas@', 'recepcion@'
    ];

    validCandidates.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      const emailA = a.candidate;
      const emailB = b.candidate;
      const domainA = a.domain || '';
      const domainB = b.domain || '';

      // Gran bonificación si el dominio del correo coincide exactamente con el dominio de la web
      if (websiteDomain && (domainA === websiteDomain || domainA.endsWith('.' + websiteDomain))) {
        scoreA += 60;
      }
      if (websiteDomain && (domainB === websiteDomain || domainB.endsWith('.' + websiteDomain))) {
        scoreB += 60;
      }

      // Bonificación si proviene de un enlace mailto (indica intención explícita de recibir contacto)
      if (html.toLowerCase().includes(`mailto:${emailA}`)) scoreA += 30;
      if (html.toLowerCase().includes(`mailto:${emailB}`)) scoreB += 30;

      // Bonificación por prefijo corporativo estándar
      if (priorityPrefixes.some(p => emailA.startsWith(p))) scoreA += 20;
      if (priorityPrefixes.some(p => emailB.startsWith(p))) scoreB += 20;

      return scoreB - scoreA;
    });

    return validCandidates[0].candidate;
  }
}
