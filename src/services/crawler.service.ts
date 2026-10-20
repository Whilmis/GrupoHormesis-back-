import { v2 as cloudinary } from 'cloudinary';

export interface WebsiteAnalysis {
  url: string;
  loadTimeMs: number;
  h1: string;
  metaDescription: string;
  screenshotUrl: string;
}

export class CrawlerService {
  static async getBrowserLaunchOptions(customArgs: string[] = []): Promise<any> {
    const fs = await import('fs');
    const { execSync } = await import('child_process');

    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--disable-blink-features=AutomationControlled',
      ...customArgs
    ];

    let executablePath: string | undefined = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (!executablePath) {
      const candidates = [
        '/root/.nix-profile/bin/chromium',
        '/etc/profiles/per-user/root/bin/chromium',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome'
      ];
      for (const c of candidates) {
        try {
          if (fs.existsSync(c)) {
            executablePath = c;
            break;
          }
        } catch (e) {}
      }
    }

    if (!executablePath) {
      try {
        const which = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome 2>/dev/null', { encoding: 'utf8' }).trim();
        if (which && fs.existsSync(which)) {
          executablePath = which;
        }
      } catch (e) {}
    }

    console.log(`[CrawlerService] Launching browser with executablePath: ${executablePath || 'bundled'}`);

    const options: any = {
      headless: true,
      args
    };
    if (executablePath) {
      options.executablePath = executablePath;
    }
    return options;
  }

  static async analyzeWebsiteAndCapture(url: string): Promise<WebsiteAnalysis> {
    console.log(`[CrawlerService] Iniciando análisis para: ${url}`);
    
    // Configurar Cloudinary con fallbacks
    cloudinary.config({ 
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dwjkuhxmr', 
      api_key: process.env.CLOUDINARY_API_KEY || '612857339621335', 
      api_secret: process.env.CLOUDINARY_API_SECRET || 'cbNRPlfpLOP2jVcJniKXZq4Xf0k',
      secure: true
    });
    
    // 1. Lanzar Puppeteer
    const { default: puppeteer } = await import('puppeteer');
    const launchOptions = await CrawlerService.getBrowserLaunchOptions(['--window-size=1280,800']);
    const browser = await puppeteer.launch(launchOptions);
    
    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1280, height: 800 });
      
      const startTime = Date.now();
      
      // Ir a la página
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await new Promise(r => setTimeout(r, 1500));
      } catch (navErr: any) {
        console.warn(`[CrawlerService] Aviso navegando a ${url}: ${navErr.message}`);
      }
      await CrawlerService.dismissCookieBanners(page);
      
      const loadTimeMs = Date.now() - startTime;
      
      // 2. Extraer información técnica (H1, Meta description)
      const seoData = await page.evaluate(() => {
        const h1 = document.querySelector('h1')?.innerText || '';
        const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        return { h1, metaDesc };
      });
      
      // 3. Tomar Captura de Pantalla
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 80 }) as Buffer;
      
      console.log(`[CrawlerService] Captura tomada. Subiendo a Cloudinary...`);
      
      // 4. Subir a Cloudinary con fallback a Data URI
      let screenshotUrl = '';
      try {
        screenshotUrl = await new Promise<string>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { 
              folder: 'hormesis_leads',
              public_id: `lead_${Date.now()}`
            },
            (error, result) => {
              if (error) return reject(error);
              if (!result || !result.secure_url) return reject(new Error('Cloudinary no devolvió resultado'));
              resolve(result.secure_url);
            }
          );
          
          uploadStream.on('error', (err) => reject(err));
          uploadStream.end(screenshotBuffer);
        });
      } catch (uploadErr: any) {
        console.warn(`[CrawlerService] Falló subida a Cloudinary (${uploadErr.message}). Usando Data URI.`);
        screenshotUrl = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;
      }
      
      console.log(`[CrawlerService] Éxito. Imagen lista: ${screenshotUrl.substring(0, 50)}...`);
      
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
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dwjkuhxmr', 
      api_key: process.env.CLOUDINARY_API_KEY || '612857339621335', 
      api_secret: process.env.CLOUDINARY_API_SECRET || 'cbNRPlfpLOP2jVcJniKXZq4Xf0k',
      secure: true
    });

    const uploadToCloudinary = async (buffer: Buffer, publicIdPrefix: string = 'screen'): Promise<string> => {
      try {
        return await new Promise<string>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { 
              folder: 'hormesis_leads',
              public_id: `${publicIdPrefix}_${Date.now()}`
            },
            (error, result) => {
              if (error) return reject(error);
              if (!result || !result.secure_url) return reject(new Error('Cloudinary no devolvió resultado'));
              resolve(result.secure_url);
            }
          );
          uploadStream.on('error', (err) => reject(err));
          uploadStream.end(buffer);
        });
      } catch (err: any) {
        console.warn(`[CrawlerService] Falló subida a Cloudinary (${err.message}). Usando fallback Data URI.`);
        return `data:image/jpeg;base64,${buffer.toString('base64')}`;
      }
    };
    
    const screenshots: { type: string; url: string }[] = [];
    let htmlSourceUrl = '';
    let htmlContent = '';
    let brandIdentity: any = null;

    let browser: any = null;
    try {
      const { default: puppeteer } = await import('puppeteer');
      const launchOptions = await CrawlerService.getBrowserLaunchOptions();
      browser = await puppeteer.launch(launchOptions);
    } catch (launchErr: any) {
      console.warn(`[CrawlerService] No se pudo lanzar Puppeteer (${launchErr.message}). Fallback a análisis por HTTP.`);
    }

    if (browser) {
      try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
        });
        await page.setViewport({ width: 1280, height: 800 });
        
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await new Promise(r => setTimeout(r, 1500));
        } catch (navErr: any) {
          console.warn(`[CrawlerService] Advertencia navegando a ${url}: ${navErr.message}`);
        }

        await CrawlerService.dismissCookieBanners(page);

        try {
          htmlContent = await page.content();
        } catch (cErr: any) {
          console.warn(`[CrawlerService] No se pudo leer page.content(): ${cErr.message}`);
        }

        // 1. Desktop Hero
        try {
          const heroDesktopBuffer = await page.screenshot({ type: 'jpeg', quality: 70 }) as Buffer;
          const heroUrl = await uploadToCloudinary(heroDesktopBuffer, 'desktop_home');
          screenshots.push({ type: 'desktop_home', url: heroUrl });
        } catch (err: any) {
          console.warn(`[CrawlerService] Error en captura desktop_home: ${err.message}`);
        }
        
        // 2. Desktop Footer
        try {
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
          });
          await new Promise(r => setTimeout(r, 800));
          await CrawlerService.dismissCookieBanners(page);
          const footerDesktopBuffer = await page.screenshot({ type: 'jpeg', quality: 70 }) as Buffer;
          const footerUrl = await uploadToCloudinary(footerDesktopBuffer, 'desktop_footer');
          screenshots.push({ type: 'desktop_footer', url: footerUrl });
        } catch (err: any) {
          console.warn(`[CrawlerService] Error en captura desktop_footer: ${err.message}`);
        }
        
        // 3. Mobile Hero
        try {
          await page.setViewport({ width: 375, height: 812, isMobile: true });
          await page.evaluate(() => window.scrollTo(0, 0));
          await new Promise(r => setTimeout(r, 800));
          await CrawlerService.dismissCookieBanners(page);
          const heroMobileBuffer = await page.screenshot({ type: 'jpeg', quality: 70 }) as Buffer;
          const mobileUrl = await uploadToCloudinary(heroMobileBuffer, 'mobile_home');
          screenshots.push({ type: 'mobile_home', url: mobileUrl });
        } catch (err: any) {
          console.warn(`[CrawlerService] Error en captura mobile_home: ${err.message}`);
        }

        // 4. Services (Mock)
        try {
          await page.setViewport({ width: 1280, height: 800 });
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3));
          await new Promise(r => setTimeout(r, 800));
          await CrawlerService.dismissCookieBanners(page);
          const servicesBuffer = await page.screenshot({ type: 'jpeg', quality: 70 }) as Buffer;
          const servicesUrl = await uploadToCloudinary(servicesBuffer, 'services_page');
          screenshots.push({ type: 'services_page', url: servicesUrl });
        } catch (err: any) {
          console.warn(`[CrawlerService] Error en captura services_page: ${err.message}`);
        }

        // 5. Contact (Mock)
        try {
          await page.evaluate(() => window.scrollTo(0, (document.body.scrollHeight / 3) * 2));
          await new Promise(r => setTimeout(r, 800));
          await CrawlerService.dismissCookieBanners(page);
          const contactBuffer = await page.screenshot({ type: 'jpeg', quality: 70 }) as Buffer;
          const contactUrl = await uploadToCloudinary(contactBuffer, 'contact_page');
          screenshots.push({ type: 'contact_page', url: contactUrl });
        } catch (err: any) {
          console.warn(`[CrawlerService] Error en captura contact_page: ${err.message}`);
        }

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
        console.error(`[CrawlerService] Error durante navegación con Puppeteer en ${url}:`, error);
      } finally {
        try { await browser.close(); } catch (cErr) {}
      }
    }

    // Fallback: Si no se obtuvo HTML via Puppeteer, obtenerlo via fetch HTTP directo
    if (!htmlContent) {
      try {
        console.log(`[CrawlerService] Obteniendo HTML por HTTP directo para ${url}...`);
        const fetchRes = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          signal: AbortSignal.timeout(10000)
        });
        if (fetchRes.ok) {
          htmlContent = await fetchRes.text();
        }
      } catch (fErr) {
        console.warn(`[CrawlerService] Fallback HTTP fetch falló para ${url}:`, fErr);
      }
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
