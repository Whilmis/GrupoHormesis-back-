import { v2 as cloudinary } from 'cloudinary';

export interface WebsiteAnalysis {
  url: string;
  loadTimeMs: number;
  h1: string;
  metaDescription: string;
  screenshotUrl: string;
}

export class CrawlerService {
  static async analyzeWebsiteAndCapture(url: string): Promise<WebsiteAnalysis> {
    console.log(`[CrawlerService] Iniciando análisis para: ${url}`);
    
    // Configurar Cloudinary
    cloudinary.config({ 
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
      api_key: process.env.CLOUDINARY_API_KEY, 
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });
    
    // 1. Lanzar Puppeteer (dynamic import para evitar errores ESM en CommonJS)
    const { default: puppeteer } = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
    });
    
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      
      const startTime = Date.now();
      
      // Ir a la página y esperar a que cargue la red
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await CrawlerService.dismissCookieBanners(page);
      
      const loadTimeMs = Date.now() - startTime;
      
      // 2. Extraer información técnica (H1, Meta description)
      const seoData = await page.evaluate(() => {
        const h1 = document.querySelector('h1')?.innerText || '';
        const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        return { h1, metaDesc };
      });
      
      // 3. Tomar Captura de Pantalla
      // Lo tomamos como buffer en memoria para no guardarlo en el disco duro del servidor
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 80 }) as Buffer;
      
      console.log(`[CrawlerService] Captura tomada. Subiendo a Cloudinary...`);
      
      // 4. Subir a Cloudinary usando un Stream
      const screenshotUrl = await new Promise<string>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { 
            folder: 'hormesis_leads',
            // Por ahora guardamos la imagen plana. Las capas (overlays de Play)
            // las aplicaremos dinámicamente en la URL o en un paso posterior.
          },
          (error, result) => {
            if (error) return reject(error);
            if (!result) return reject(new Error('Cloudinary no devolvió resultado'));
            resolve(result.secure_url);
          }
        );
        
        uploadStream.on('error', (err) => reject(err));
        uploadStream.end(screenshotBuffer);
      });
      
      console.log(`[CrawlerService] Éxito. Imagen subida a: ${screenshotUrl}`);
      
      return {
        url,
        loadTimeMs,
        h1: seoData.h1,
        metaDescription: seoData.metaDesc,
        screenshotUrl
      };
      
    } catch (error) {
      console.error(`[CrawlerService] Error analizando ${url}:`, error);
      throw error;
    } finally {
      await browser.close();
    }
  }

  private static async dismissCookieBanners(page: any) {
    try {
      await page.evaluate(() => {
        // 1. Intentar hacer clic en botones de aceptación de cookies comunes
        const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));
        const acceptPatterns = /^(aceptar|acepto|accept|agree|permitir todas|aceptar todas|allow all|accept all|entendido|de acuerdo|consiento)$/i;
        const loosePatterns = /(aceptar|acepto|accept|agree|permitir|allow|entendido)/i;

        for (const btn of buttons) {
          const text = ((btn as HTMLElement).innerText || btn.textContent || '').trim();
          if (acceptPatterns.test(text) || (loosePatterns.test(text) && text.length < 25)) {
            try {
              (btn as HTMLElement).click();
              break;
            } catch (e) {}
          }
        }

        // 2. Ocultar y remover capas, overlays y modales de cookies conocidos
        const selectors = [
          '#onetrust-consent-sdk', '#onetrust-banner-sdk', '.onetrust-pc-dark-filter',
          '#cookie-notice', '#cookie-law-info-bar', '#cookie-law-info-again',
          '.cookie-banner', '.cc-banner', '.cc-window', '.cc-floating',
          '.tarteaucitron-alert-big', '#tarteaucitronRoot',
          '#CybotCookiebotDialog', '#CybotCookiebotDialogBodyUnderlay',
          '.cookie-consent', '.cookies-consent', '#cookies-banner',
          '.modal-cookies', '.aviso-cookies', '#aviso-cookies',
          '[id*="cookie" i]', '[class*="cookie" i]',
          '[id*="consent" i]', '[class*="consent" i]'
        ];

        selectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(el => {
            if (el && el !== document.body && el !== document.documentElement && !el.contains(document.querySelector('main')) && !el.contains(document.querySelector('article'))) {
              const style = window.getComputedStyle(el);
              if (style.position === 'fixed' || style.position === 'absolute' || parseInt(style.zIndex, 10) > 30 || (el.id && el.id.toLowerCase().includes('cookie'))) {
                (el as HTMLElement).style.setProperty('display', 'none', 'important');
                (el as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
                (el as HTMLElement).remove();
              }
            }
          });
        });

        // 3. Restaurar overflow y scroll del body/html si el banner lo bloqueó
        document.body.style.setProperty('overflow', 'auto', 'important');
        document.documentElement.style.setProperty('overflow', 'auto', 'important');
      });

      await new Promise(r => setTimeout(r, 600));
    } catch (err) {
      // Ignorar si el sitio web no permite evaluar scripts
    }
  }

  static async auditWebsite(url: string, groqKey: string): Promise<any> {
    console.log(`[CrawlerService] Iniciando auditoría para: ${url}`);
    
    cloudinary.config({ 
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
      api_key: process.env.CLOUDINARY_API_KEY, 
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });

    const uploadToCloudinary = async (buffer: Buffer): Promise<string> => {
      return new Promise<string>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'hormesis_leads' },
          (error, result) => {
            if (error) return reject(error);
            if (!result) return reject(new Error('Cloudinary no devolvió resultado'));
            resolve(result.secure_url);
          }
        );
        uploadStream.on('error', (err) => reject(err));
        uploadStream.end(buffer);
      });
    };
    
    const { default: puppeteer } = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const screenshots: { type: string; url: string }[] = [];
    let htmlSourceUrl = '';
    let htmlContent = '';
    let brandIdentity: any = null;
    
    try {
      const page = await browser.newPage();
      
      // 1. Desktop Hero
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await CrawlerService.dismissCookieBanners(page);
      htmlContent = await page.content();
      const heroDesktopBuffer = await page.screenshot({ type: 'jpeg', quality: 70 }) as Buffer;
      screenshots.push({ type: 'desktop_home', url: await uploadToCloudinary(heroDesktopBuffer) });
      
      // 2. Desktop Footer
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(r => setTimeout(r, 1000));
      await CrawlerService.dismissCookieBanners(page);
      const footerDesktopBuffer = await page.screenshot({ type: 'jpeg', quality: 70 }) as Buffer;
      screenshots.push({ type: 'desktop_footer', url: await uploadToCloudinary(footerDesktopBuffer) });
      
      // 3. Mobile Hero
      await page.setViewport({ width: 375, height: 812, isMobile: true });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await CrawlerService.dismissCookieBanners(page);
      const heroMobileBuffer = await page.screenshot({ type: 'jpeg', quality: 70 }) as Buffer;
      screenshots.push({ type: 'mobile_home', url: await uploadToCloudinary(heroMobileBuffer) });

      // 4. Services (Mock)
      await page.setViewport({ width: 1280, height: 800 });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3));
      await new Promise(r => setTimeout(r, 1000));
      await CrawlerService.dismissCookieBanners(page);
      const servicesBuffer = await page.screenshot({ type: 'jpeg', quality: 70 }) as Buffer;
      screenshots.push({ type: 'services_page', url: await uploadToCloudinary(servicesBuffer) });

      // 5. Contact (Mock)
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await new Promise(r => setTimeout(r, 1000));
      await CrawlerService.dismissCookieBanners(page);
      const contactBuffer = await page.screenshot({ type: 'jpeg', quality: 70 }) as Buffer;
      screenshots.push({ type: 'contact_page', url: await uploadToCloudinary(contactBuffer) });

      // 6. Extraer Identidad de Marca y Colores Computados del DOM Real
      try {
        brandIdentity = await page.evaluate(() => {
          const themeColor = document.querySelector('meta[name="theme-color"]')?.getAttribute('content') || 
                             document.querySelector('meta[name="msapplication-TileColor"]')?.getAttribute('content') || null;

          let primaryVar: string | null = null;
          let accentVar: string | null = null;
          try {
            const rootStyle = window.getComputedStyle(document.documentElement);
            const pVars = ['--primary', '--color-primary', '--primary-color', '--theme-primary', '--main-color', '--brand', '--brand-color', '--e-global-color-primary'];
            for (const v of pVars) {
              const val = rootStyle.getPropertyValue(v)?.trim();
              if (val && (val.startsWith('#') || val.startsWith('rgb'))) {
                primaryVar = val;
                break;
              }
            }
            const aVars = ['--accent', '--color-accent', '--accent-color', '--secondary', '--color-secondary', '--e-global-color-accent'];
            for (const v of aVars) {
              const val = rootStyle.getPropertyValue(v)?.trim();
              if (val && (val.startsWith('#') || val.startsWith('rgb'))) {
                accentVar = val;
                break;
              }
            }
          } catch (e) {}

          let navBg: string | null = null;
          let btnBg: string | null = null;
          try {
            const nav = document.querySelector('header, nav, .navbar, #header, #nav, [class*="nav" i], [class*="header" i]');
            if (nav) navBg = window.getComputedStyle(nav).backgroundColor;
            const btn = document.querySelector('button, .btn, a.btn, input[type="submit"], [class*="button" i]');
            if (btn) btnBg = window.getComputedStyle(btn).backgroundColor;
          } catch (e) {}

          let logoUrl: string | null = null;
          try {
            const logoEl = document.querySelector('img[src*="logo" i], img[class*="logo" i], img[alt*="logo" i], .navbar-brand img, header img');
            if (logoEl) logoUrl = (logoEl as HTMLImageElement).currentSrc || (logoEl as HTMLImageElement).src || null;
          } catch (e) {}

          return {
            themeColor,
            primaryVar,
            accentVar,
            navBg,
            btnBg,
            logoUrl
          };
        });
      } catch (brandErr) {
        console.warn('[CrawlerService] No se pudieron extraer estilos calculados:', brandErr);
      }
      
    } catch (error) {
      console.error(`[CrawlerService] Error analizando ${url}:`, error);
    } finally {
      await browser.close();
    }

    let aiAuditReport = {
      technicalErrors: [] as string[],
      visualErrors: [] as string[],
      detailedAnalysis: 'No se pudo generar el análisis.'
    };

    if (screenshots.length === 0 && !htmlContent) {
      aiAuditReport = {
        technicalErrors: ['El sitio web no respondió o no se pudo acceder a la URL.'],
        visualErrors: ['No se pudieron obtener capturas de pantalla de la web.'],
        detailedAnalysis: 'No fue posible auditar el sitio web debido a un error de conexión con el servidor de destino.'
      };
    } else if (groqKey) {
      console.log(`[CrawlerService] Llamando a Groq Vision para auditar (optimizando tokens para plan ITPM)...`);
      const prompt = `Actúas como un experto auditor Web (SEO, UX, Código). Responde estrictamente con un objeto json válido. Analiza este código fuente HTML (truncado) y la captura visual del sitio web.
Instrucciones obligatorias de brevedad:
- technicalErrors: máximo 3 errores técnicos concisos (1 frase corta cada uno).
- visualErrors: máximo 3 errores visuales concisos (1 frase corta cada uno).
- detailedAnalysis: resumen ejecutivo conciso (máximo 2 a 3 frases).

Devuelve tu análisis OBLIGATORIAMENTE en formato JSON estricto con esta estructura exacta:
{
  "technicalErrors": ["error 1", "error 2"],
  "visualErrors": ["error 1", "error 2"],
  "detailedAnalysis": "Resumen ejecutivo..."
}`;

      const groqPayload = {
        model: 'qwen/qwen3.8-27b',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'text', text: 'HTML (truncado): ' + htmlContent.substring(0, 2000) },
              ...screenshots.slice(0, 1).map(s => ({
                type: 'image_url',
                image_url: { url: s.url }
              }))
            ]
          }
        ],
        temperature: 0.2,
        max_tokens: 600,
        response_format: { type: 'json_object' }
      };

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${groqKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(groqPayload)
          });

          if (response.ok) {
            const aiData = await response.json();
            const rawText = aiData.choices[0].message.content;
            const match = rawText.match(/\{[\s\S]*\}/);
            if (match) {
              aiAuditReport = JSON.parse(match[0]);
            }
            break; // Éxito, salir del bucle de reintento
          }

          const errorText = await response.text();
          if ((response.status === 429 || response.status === 413) && attempt < 3) {
            // Extraer tiempo de espera exacto de Groq (ej: "Please try again in 12.3s")
            const timeMatch = errorText.match(/try again in ([\d.]+)s/i);
            const waitSeconds = timeMatch ? Math.ceil(parseFloat(timeMatch[1])) + 1 : 13;
            console.log(`[CrawlerService] Rate limit de Groq (Intento ${attempt}/3). Esperando ${waitSeconds}s para reintentar...`);
            await new Promise(r => setTimeout(r, waitSeconds * 1000));
            continue;
          } else {
            console.error(`[CrawlerService] Error en Groq: ${response.status} - ${errorText}`);
            break;
          }
        } catch (err: any) {
          console.error(`[CrawlerService] Excepción llamando a Groq: ${err.message}`);
          break;
        }
      }
    }

    return {
      url,
      htmlSourceUrl,
      screenshots,
      aiAuditReport,
      brandIdentity
    };
  }
}
