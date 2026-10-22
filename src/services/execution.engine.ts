import { CrawlerService } from './crawler.service';
import { EmailValidatorService } from './email-validator.service';
import { Prisma, UserWorkflow, Credential } from '@prisma/client';
import { CredentialService } from './credential.service';
import nodemailer from 'nodemailer';
import { v2 as cloudinary } from 'cloudinary';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';

export function getFrontendUrl(): string {
  const envUrl = process.env.FRONTEND_URL?.trim();
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/$/, '');
  }
  return 'https://grupohormesis.es';
}

export function getBackendUrl(): string {
  const envUrl = process.env.BACKEND_URL?.trim();
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/$/, '');
  }
  return 'https://hormesis-back-production.up.railway.app';
}

async function generateMagicLink(leadId: string, calendarId: string): Promise<string | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId }
  });
  if (lead && calendarId) {
    const token = jwt.sign(
      { 
        leadId: lead.id, 
        name: lead.businessName || 'Invitado', 
        email: lead.email 
      },
      process.env.JWT_SECRET || 'tu_secreto_super_seguro_aqui_123!'
    );
    const frontendUrl = getFrontendUrl();
    return `${frontendUrl}/book/${calendarId}?token=${token}`;
  }
  return null;
}

export async function captureMockupScreenshot(mockupHtml: string, leadId: string): Promise<string> {
  const { default: puppeteer } = await import('puppeteer');
  const launchOptions = await CrawlerService.getBrowserLaunchOptions();
  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setContent(mockupHtml, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 600)); // permitir fuentes web y estilos
    const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 85 }) as Buffer;

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dwjkuhxmr',
      api_key: process.env.CLOUDINARY_API_KEY || '612857339621335',
      api_secret: process.env.CLOUDINARY_API_SECRET || 'cbNRPlfpLOP2jVcJniKXZq4Xf0k',
      secure: true
    });

    let uploadUrl = '';
    try {
      uploadUrl = await new Promise<string>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'hormesis_mockups', public_id: `propuesta_${leadId}_${Date.now()}` },
          (error, result) => {
            if (error || !result) return reject(error || new Error('Error subiendo captura de propuesta a Cloudinary'));
            resolve(result.secure_url || result.url);
          }
        );
        uploadStream.end(screenshotBuffer);
      });
    } catch (uploadErr: any) {
      console.warn(`[ExecutionEngine] Falló subida de mockup a Cloudinary: ${uploadErr.message}. Usando Data URI.`);
      uploadUrl = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;
    }

    return uploadUrl;
  } finally {
    await browser.close();
  }
}

function getComparisonFrameHtml(type: 'before' | 'after', imageSrc: string, businessName: string, websiteUrl: string) {
  let cleanDomain = (websiteUrl || '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0] || (businessName ? `${businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com` : 'tu-sitio.com');

  const isBefore = type === 'before';
  const badgeText = isBefore ? '🔴 SITIO WEB ACTUAL' : '🟢 PROPUESTA REDISEÑO · GRUPO HORMESIS';
  const badgeStyle = isBefore
    ? 'background: rgba(239, 68, 68, 0.18); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);'
    : 'background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.5); box-shadow: 0 0 15px rgba(16, 185, 129, 0.25);';

  const footerText = isBefore
    ? '⚠️ Diagnóstico Digital: Fricciones de conversión y diseño anticuado'
    : '✨ Propuesta Conceptual: 100% Responsive, Alta Velocidad y Foco en Ventas';
  const footerStyle = isBefore
    ? 'background: rgba(15, 23, 42, 0.92); color: #94a3b8; border-top: 1px solid rgba(239, 68, 68, 0.3);'
    : 'background: rgba(15, 23, 42, 0.92); color: #e2e8f0; border-top: 1px solid rgba(16, 185, 129, 0.35);';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1000px;
      height: 640px;
      background: radial-gradient(circle at 50% 20%, #1e293b 0%, #090d16 100%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .mockup-window {
      width: 920px;
      height: 570px;
      background: #0f172a;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .title-bar {
      height: 44px;
      background: #111827;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      padding: 0 16px;
      justify-content: space-between;
    }
    .traffic-lights {
      display: flex;
      gap: 7px;
      align-items: center;
    }
    .dot {
      width: 11px;
      height: 11px;
      border-radius: 50%;
    }
    .dot-red { background: #ef4444; }
    .dot-yellow { background: #f59e0b; }
    .dot-green { background: #10b981; }
    
    .url-bar {
      background: #1f2937;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 4px 14px;
      font-size: 11px;
      color: #9ca3af;
      display: flex;
      align-items: center;
      gap: 6px;
      max-width: 380px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .badge {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      padding: 4px 12px;
      border-radius: 20px;
      ${badgeStyle}
    }
    .viewport {
      flex: 1;
      position: relative;
      background: #020617;
      overflow: hidden;
      display: flex;
    }
    .viewport-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top;
      display: block;
    }
    .footer-pill {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(8px);
      ${footerStyle}
    }
  </style>
</head>
<body>
  <div class="mockup-window">
    <div class="title-bar">
      <div class="traffic-lights">
        <div class="dot dot-red"></div>
        <div class="dot dot-yellow"></div>
        <div class="dot dot-green"></div>
      </div>
      <div class="url-bar">
        <span>🔒</span>
        <span>https://${cleanDomain}</span>
      </div>
      <div class="badge">${badgeText}</div>
    </div>
    <div class="viewport">
      <img src="${imageSrc}" class="viewport-img" />
      <div class="footer-pill">${footerText}</div>
    </div>
  </div>
</body>
</html>`;
}

async function generateComparisonGif(
  beforeUrl: string, 
  afterUrl: string, 
  businessName: string, 
  websiteUrl: string = ''
): Promise<string | null> {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dwjkuhxmr';
    const apiKey = process.env.CLOUDINARY_API_KEY || '612857339621335';
    const apiSecret = process.env.CLOUDINARY_API_SECRET || 'cbNRPlfpLOP2jVcJniKXZq4Xf0k';

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true
    });

    if (!beforeUrl) return afterUrl || null;
    if (!afterUrl) return beforeUrl || null;

    const tag = `comp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // 1. Intentar composición premium enmarcada con Puppeteer (diseño macOS de alta conversión)
    try {
      const [beforeRes, afterRes] = await Promise.all([
        fetch(beforeUrl),
        fetch(afterUrl)
      ]);
      const [beforeBuf, afterBuf] = await Promise.all([
        beforeRes.arrayBuffer().then(b => Buffer.from(b)),
        afterRes.arrayBuffer().then(b => Buffer.from(b))
      ]);
      const beforeDataUri = `data:image/jpeg;base64,${beforeBuf.toString('base64')}`;
      const afterDataUri = `data:image/jpeg;base64,${afterBuf.toString('base64')}`;

      const { default: puppeteer } = await import('puppeteer');
      const launchOptions = await CrawlerService.getBrowserLaunchOptions();
      const browser = await puppeteer.launch(launchOptions);

      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1000, height: 640, deviceScaleFactor: 1 });

        // Render Frame 1 (Antes)
        await page.setContent(getComparisonFrameHtml('before', beforeDataUri, businessName, websiteUrl), { waitUntil: 'load' });
        const frame1Buffer = await page.screenshot({ type: 'jpeg', quality: 90 }) as Buffer;

        // Render Frame 2 (Después / Propuesta)
        await page.setContent(getComparisonFrameHtml('after', afterDataUri, businessName, websiteUrl), { waitUntil: 'load' });
        const frame2Buffer = await page.screenshot({ type: 'jpeg', quality: 90 }) as Buffer;

        // Subir frames con orden alfabético estricto (01_before, 02_after)
        await Promise.all([
          new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { tags: [tag], public_id: `${tag}_01_before` },
              (err, res) => err ? reject(err) : resolve(res)
            );
            stream.end(frame1Buffer);
          }),
          new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { tags: [tag], public_id: `${tag}_02_after` },
              (err, res) => err ? reject(err) : resolve(res)
            );
            stream.end(frame2Buffer);
          })
        ]);

        const multiResult = await (cloudinary.uploader as any).multi(tag, {
          delay: 2000, // 2 segundos para apreciar claramente cada estado
          format: 'gif'
        });

        return multiResult.secure_url || multiResult.url || null;
      } finally {
        await browser.close();
      }
    } catch (composeErr: any) {
      console.warn('[ExecutionEngine] Fallback a GIF directo por error en composición:', composeErr.message);
      // Fallback a subida directa garantizando orden alfabético
      await cloudinary.uploader.upload(beforeUrl, { tags: [tag], public_id: `${tag}_01_before` });
      await cloudinary.uploader.upload(afterUrl, { tags: [tag], public_id: `${tag}_02_after` });

      const multiResult = await (cloudinary.uploader as any).multi(tag, {
        delay: 1800,
        format: 'gif'
      });
      return multiResult.secure_url || multiResult.url || null;
    }
  } catch (err: any) {
    console.warn('[ExecutionEngine] Error generando GIF de comparación:', err.message);
    return null;
  }
}

// DefiniciÃ³n genÃ©rica para los tipos de workflows
export interface WorkflowContext {
  workflow: UserWorkflow;
  credentials: Record<string, string>; // clave -> valor desencriptado
  log: (message: string) => void;
  inputData?: any; // Datos que pueden venir de un webhook o API
}

export abstract class BaseWorkflowType {
  abstract typeIdentifier: string;
  abstract execute(context: WorkflowContext): Promise<any>;
}

// ----------------------------------------------------
// EJEMPLO: Recolector de Leads
// ----------------------------------------------------
class LeadCollectorWorkflow extends BaseWorkflowType {
  typeIdentifier = 'lead_collector';

  async execute(context: WorkflowContext): Promise<any> {
    context.log('Iniciando Lead Collector con Auditoría Web IA (Groq)...');
    
    // 1. Obtener credenciales
    const googleMapsKey = context.credentials['google_maps_api'];
    if (!googleMapsKey) {
      throw new Error('Falta la credencial de Google Maps API (google_maps_api)');
    }

    const groqKey = context.credentials['groq_api_key'] || process.env.GROQ_API_KEY;
    
    // 2. Obtener config del workflow
    const config = context.workflow.config as any;
    
    const nichesStr = config?.niches || 'restaurantes';
    const locationsStr = config?.locations || 'madrid';
    
    const nichesArray = nichesStr.split(',').map((s: string) => s.trim()).filter(Boolean);
    const locationsArray = locationsStr.split(',').map((s: string) => s.trim()).filter(Boolean);
    
    const selectedNiche = nichesArray[Math.floor(Math.random() * nichesArray.length)] || 'restaurantes';
    const selectedLocation = locationsArray[Math.floor(Math.random() * locationsArray.length)] || 'madrid';
    
    const searchQuery = `${selectedNiche} en ${selectedLocation}`;
    context.log(`Buscando leads para: ${searchQuery}`);
    
    context.log(`Consultando Google Places API...`);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${googleMapsKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error HTTP de Google Maps: ${response.status}`);
    }
    const dataObj = await response.json();
    
    if (dataObj.status !== 'OK' && dataObj.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Maps API error: ${dataObj.status} - ${dataObj.error_message || ''}`);
    }
    
    let leads = (dataObj.results || []).map((place: any) => ({
      name: place.name,
      address: place.formatted_address,
      rating: place.rating,
      place_id: place.place_id,
      types: place.types,
      phone: 'No disponible',
      website: 'No disponible',
      email: 'No disponible'
    }));
    
    context.log(`Obteniendo detalles (teléfono, web y email) para ${leads.length} leads...`);

    // Procesamiento secuencial para encontrar leads válidos con sitio web
    const detailedLeads: any[] = [];
    const validLeadsToAudit: any[] = [];

    for (const lead of leads) {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${lead.place_id}&fields=formatted_phone_number,website&key=${googleMapsKey}`;
        const detailsRes = await fetch(detailsUrl);
        if (detailsRes.ok) {
          const detailsData = await detailsRes.json();
          if (detailsData.result) {
            lead.phone = detailsData.result.formatted_phone_number || 'No disponible';
            lead.website = detailsData.result.website || 'No disponible';

            // Scrapear y validar email real del sitio web si existe (descartando servidores caídos o aparcados)
            if (lead.website && lead.website !== 'No disponible') {
              try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);
                const siteRes = await fetch(lead.website, {
                  signal: controller.signal,
                  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });
                clearTimeout(timeoutId);

                if (siteRes.ok) {
                  const html = await siteRes.text();
                  const verifiedEmail = await EmailValidatorService.extractBestEmailFromHtml(html, lead.website);
                  if (verifiedEmail) {
                    lead.email = verifiedEmail;
                  }
                }
              } catch (e) {}
            }
          }
        }
      } catch (err) {
        lead.phone = 'Error de conexión';
        lead.website = 'Error de conexión';
      }

      detailedLeads.push(lead);

      // Si tiene web real, califica para ser auditado (hasta 5 para no exceder cuotas de visión)
      if (lead.website && lead.website.startsWith('http') && validLeadsToAudit.length < 5) {
        validLeadsToAudit.push(lead);
      }
    }

    context.log(`Se encontraron ${detailedLeads.length} leads. Auditando ${validLeadsToAudit.length} sitios web con Groq AI...`);

    // 3. Auditoría Web Profunda (Capturas y Groq AI)
    let auditedCount = 0;
    for (const l of validLeadsToAudit) {
      try {
        context.log(`[Crawler] Capturando y auditando con Groq: ${l.name} (${l.website})...`);
        const crawlerData = await CrawlerService.auditWebsite(l.website, groqKey as string);
        l.metadata = {
          technicalAnalysis: {
            url: l.website,
            htmlSourceUrl: crawlerData.htmlSourceUrl || undefined,
            screenshots: crawlerData.screenshots
          },
          brandIdentity: crawlerData.brandIdentity,
          aiAuditReport: crawlerData.aiAuditReport
        };

        // Si el scraping rápido no encontró email pero Puppeteer renderizó la web completa, extraerlo ahora
        if ((!l.email || l.email === 'No disponible') && crawlerData?.htmlContent) {
          const emailFromPuppeteer = await EmailValidatorService.extractBestEmailFromHtml(crawlerData.htmlContent, l.website);
          if (emailFromPuppeteer) {
            l.email = emailFromPuppeteer;
            context.log(`📧 Correo corporativo real extraído vía Puppeteer para ${l.name}: ${l.email}`);
          }
        }

        auditedCount++;
        context.log(`✅ Auditoría completada para ${l.name}`);
      } catch (auditErr: any) {
        context.log(`Aviso: Falló auditoría para ${l.website}: ${auditErr.message}`);
      }
    }

    // 4. Guardar en el CRM ÚNICAMENTE los leads calificados con su auditoría completa
    if (context.workflow.projectId) {
      context.log(`Guardando leads calificados en el CRM (Proyecto: ${context.workflow.projectId})...`);
      let savedCount = 0;
      for (const l of validLeadsToAudit) {
        try {
          await prisma.lead.create({
            data: {
              projectId: context.workflow.projectId,
              businessName: l.name,
              email: l.email !== 'No disponible' ? l.email : undefined,
              phone: l.phone !== 'No disponible' && l.phone !== 'Error de conexión' ? l.phone : undefined,
              website: l.website !== 'No disponible' && l.website !== 'Error de conexión' ? l.website : undefined,
              source: 'Google Maps (Scraper)',
              status: 'NUEVO',
              metadata: l.metadata ? l.metadata : undefined
            }
          });
          savedCount++;
        } catch (e: any) {
          context.log(`Error guardando lead ${l.name}: ${e.message || String(e)}`);
        }
      }
      context.log(`Se guardaron exitosamente ${savedCount} leads calificados con auditoría en el CRM.`);
    }

    return { 
      searchQuery,
      total_found: validLeadsToAudit.length,
      audited_leads: auditedCount,
      leads: validLeadsToAudit 
    };
  }
}

class AutoOutreachGoogleMapsWorkflow extends BaseWorkflowType {
  typeIdentifier = 'auto_outreach_google_maps';

  async execute(context: WorkflowContext): Promise<any> {
    context.log('Iniciando Auto Outreach con GIF Creativo y Auditoría Web...');
    
    // 1. Obtener credenciales
    const gmailAddress = context.credentials['gmail_address'];
    const gmailAppPassword = (context.credentials['gmail_app_password'] || '').replace(/\s+/g, '');
    
    if (!gmailAddress || !gmailAppPassword) {
      throw new Error('Faltan credenciales de Gmail (gmail_address o gmail_app_password).');
    }

    // 2. Obtener config
    const config = context.workflow.config as any;
    const sourceWorkflowId = config?.sourceWorkflowId;
    const maxEmailsPerDay = parseInt(config?.maxEmailsPerDay || '50', 10);
    const emailTemplate = config?.generated_outreach_email;

    if (!sourceWorkflowId) {
      throw new Error('No se ha configurado la fuente de leads (Campaña de Google Maps).');
    }

    // 3. Buscar workflow fuente para saber su proyecto
    let sourceWorkflow = await prisma.userWorkflow.findUnique({ where: { id: sourceWorkflowId } });
    if (!sourceWorkflow || !sourceWorkflow.projectId) {
      const fallbackWorkflow = await prisma.userWorkflow.findFirst({
        where: {
          userId: context.workflow.userId,
          template: { typeIdentifier: 'lead_collector' },
          projectId: { not: null }
        }
      });
      if (fallbackWorkflow) {
        sourceWorkflow = fallbackWorkflow;
        context.log('Aviso: Vinculado automáticamente con el Recolector de Leads activo');
      } else if (context.workflow.projectId) {
        sourceWorkflow = context.workflow;
      } else {
        throw new Error('El workflow fuente no existe o no está asignado a un proyecto válido.');
      }
    }

    // 4. Buscar leads
    const leads = await prisma.lead.findMany({
      where: {
        projectId: sourceWorkflow.projectId as string,
        status: 'NUEVO',
        email: { not: null }
      },
      take: maxEmailsPerDay
    });

    if (leads.length === 0) {
      context.log('No hay leads nuevos con correo electrónico para contactar.');
      return { message: '0 leads contactados' };
    }

    context.log(`Se encontraron ${leads.length} leads para contactar.`);

    // 5. Configurar Nodemailer con IPv4 forzada y timeouts estrictos para Railway / Docker
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: gmailAddress,
        pass: gmailAppPassword
      },
      family: 4, // Forzar IPv4 para evitar ENETUNREACH / 2min timeout por IPv6 en Railway
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });

    let sentCount = 0;
    const backendUrl = getBackendUrl();
    const frontendUrl = getFrontendUrl();

    for (const lead of leads) {
      // 5.1 Pre-flight: Validación profunda de entregabilidad y estado real del servidor de correo
      const emailValidation = await EmailValidatorService.validateEmail(lead.email as string, lead.website || undefined);
      if (!emailValidation.isValid) {
        context.log(`⚠️ Descartando envío a ${lead.email} (${lead.businessName || 'Empresa'}): ${emailValidation.reason}. Marcando como CORREO_INVALIDO para evitar rebotes.`);
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            status: 'CORREO_INVALIDO',
            metadata: {
              ...(typeof lead.metadata === 'object' && lead.metadata ? lead.metadata : {}),
              emailValidationError: emailValidation.reason
            }
          }
        });
        continue;
      }

      context.log(`Procesando envío para: ${lead.email} (${lead.businessName || 'Empresa'})...`);
      
      const meta = typeof lead.metadata === 'string' ? JSON.parse(lead.metadata) : (lead.metadata || {});
      const screenshots = meta?.technicalAnalysis?.screenshots || [];
      const beforeScreenshot = screenshots[0]?.url || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80';
      const audit = meta?.aiAuditReport || {};

      // 6. Asegurar Maqueta Web (Generar automáticamente si aún no existe para que el link NUNCA dé 404)
      let mockupHtml = meta?.generatedMockup || meta?.creativeAssets?.mockup?.previewHtml || '';
      let mockupHeroImage = meta?.mockupHeroImage || meta?.creativeAssets?.mockup?.scrapedAssets?.hero;

      if (!mockupHtml) {
        context.log(`Aviso: El lead ${lead.businessName} no tenía maqueta generada. Creando propuesta visual conceptual automática...`);
        try {
          const brandAssets = await extractBrandAssets(lead.website || '', lead.businessName || 'Empresa', lead.id, (lead as any).notes || '', meta);
          mockupHeroImage = brandAssets.images.hero;
          const fallbackHtml = generateConceptualDesignHtml(
            lead.businessName || 'Empresa',
            lead.website || '',
            brandAssets.palette,
            brandAssets.images,
            brandAssets.fallbackImages,
            brandAssets.layoutArchetype,
            (lead as any).phone || '',
            (lead as any).address || 'España',
            (lead as any).rating || 4.9
          );
          mockupHtml = sanitizeAndGuardMockupHtml(fallbackHtml, lead.businessName || 'Empresa', brandAssets.palette, brandAssets.images, brandAssets.fallbackImages, lead.website || undefined);
          meta.generatedMockup = mockupHtml;
          meta.mockupHeroImage = mockupHeroImage;
          await prisma.lead.update({
            where: { id: lead.id },
            data: { metadata: meta }
          });
          context.log(`✅ Propuesta conceptual generada y guardada para ${lead.businessName}`);
        } catch (mErr: any) {
          context.log(`Aviso generando maqueta preliminar: ${mErr.message}`);
        }
      }

      // Enlace para ver la maqueta en pantalla completa (con fallback query params resilientes)
      const qParams = new URLSearchParams();
      if (lead.businessName) qParams.set('name', lead.businessName);
      if (lead.website) qParams.set('web', lead.website);
      const qStr = qParams.toString() ? `?${qParams.toString()}` : '';
      const fullScreenMockupUrl = `${backendUrl}/api/leads/public/${lead.id}/mockup${qStr}`;

      // 7. Generar GIF Animado Antes vs Después para este lead (Composición enmarcada con Captura Real de la Propuesta)
      let proposalScreenshotUrl = meta?.mockupScreenshotUrl || meta?.creativeAssets?.mockup?.previewImageUrl;
      if (!proposalScreenshotUrl && mockupHtml) {
        try {
          context.log(`📸 Capturando pantalla real de la propuesta para ${lead.businessName}...`);
          proposalScreenshotUrl = await captureMockupScreenshot(mockupHtml, lead.id);
          if (proposalScreenshotUrl) {
            meta.mockupScreenshotUrl = proposalScreenshotUrl;
            await prisma.lead.update({
              where: { id: lead.id },
              data: { metadata: meta }
            });
            context.log(`✅ Captura de propuesta guardada: ${proposalScreenshotUrl}`);
          }
        } catch (capErr: any) {
          context.log(`Aviso capturando maqueta: ${capErr.message}`);
        }
      }

      let gifUrl = meta?.comparisonGifUrl;
      const isInvalidGif = !gifUrl || gifUrl.includes('fl_multi') || !gifUrl.includes('/multi/') || !meta?.hasFramedGif;
      if (isInvalidGif) {
        context.log(`Generando GIF animado Antes vs Después (Composición Premium) para ${lead.businessName}...`);
        const afterImg = proposalScreenshotUrl || mockupHeroImage || meta?.mockupHeroImage || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80';
        try {
          const freshGif = await generateComparisonGif(beforeScreenshot, afterImg, lead.businessName || 'Tu Negocio', lead.website || '');
          if (freshGif && freshGif.includes('/multi/')) {
            gifUrl = freshGif;
            meta.comparisonGifUrl = gifUrl;
            meta.hasFramedGif = true;
            await prisma.lead.update({
              where: { id: lead.id },
              data: { metadata: meta }
            });
            context.log(`✅ GIF animado con marco y propuesta real creado exitosamente: ${gifUrl}`);
          }
        } catch (gifErr: any) {
          context.log(`Aviso: No se pudo generar GIF animado: ${gifErr.message}`);
        }
      }

      // 8. Enlace para agendar meet (Magic Link) con resolución automática de calendario
      let magicLink = '';
      let calendarId = config?.calendarId;
      if (!calendarId) {
        const defaultCal = (await prisma.calendar.findFirst({
          where: { userId: context.workflow.userId }
        })) || (await prisma.calendar.findFirst());
        calendarId = defaultCal?.id;
      }
      if (calendarId) {
        magicLink = (await generateMagicLink(lead.id, calendarId)) || '';
      }
      if (!magicLink) {
        magicLink = `mailto:${gmailAddress}?subject=${encodeURIComponent('Agendar Reunión - ' + (lead.businessName || ''))}&body=${encodeURIComponent('Hola equipo de Grupo Hormesis, me interesa agendar una llamada de 15 minutos para revisar la propuesta.')}`;
      }

      // 9. Construir Errores de Auditoría
      const technicalErrors: string[] = Array.isArray(audit?.technicalErrors) ? audit.technicalErrors : [];
      const visualErrors: string[] = Array.isArray(audit?.visualErrors) ? audit.visualErrors : [];
      const detailedAnalysis: string = audit?.detailedAnalysis || 'Tu sitio actual presenta fricciones de conversión y diseño anticuado frente a competidores directos.';

      let auditHtml = '';
      if (technicalErrors.length > 0 || visualErrors.length > 0) {
        auditHtml = `
        <div style="background: #f8fafc; border-left: 4px solid #f43f5e; padding: 16px 20px; margin: 24px 0; border-radius: 4px;">
          <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 16px; font-family: sans-serif;">🔍 Diagnóstico Rápido de su Sitio Web (${lead.website || 'Web actual'}):</h4>
          <p style="color: #475569; font-size: 14px; margin: 0 0 12px 0; line-height: 1.5;">${detailedAnalysis}</p>
          <ul style="margin: 0; padding-left: 20px; color: #334155; font-size: 13px; line-height: 1.6;">
            ${technicalErrors.map(e => `<li style="margin-bottom: 4px;"><strong>Fallo Técnico:</strong> ${e}</li>`).join('')}
            ${visualErrors.map(e => `<li style="margin-bottom: 4px;"><strong>Fricción Visual:</strong> ${e}</li>`).join('')}
          </ul>
        </div>
        `;
      }

      // 10. Bloque Visual: Línea de diseño conceptual (no producto cerrado) y Solución a Problemas Técnicos Comunes
      let visualBlockHtml = '';
      const hasWorkingGif = gifUrl && gifUrl.includes('/multi/') && !gifUrl.includes('fl_multi');
      if (hasWorkingGif) {
        visualBlockHtml = `
        <div style="text-align: center; margin: 26px 0; padding: 20px; background: #0f172a; border-radius: 12px;">
          <span style="display: inline-block; background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 12px; border-radius: 20px; margin-bottom: 10px; border: 1px solid rgba(52, 211, 153, 0.3);">
            Línea de Diseño y Dirección Visual de Referencia
          </span>
          <p style="color: #cbd5e1; font-size: 13px; margin: 0 0 14px 0; line-height: 1.5; font-family: sans-serif;">
            No se trata de una plantilla fija ni de un producto final cerrado, sino de una <strong>propuesta de estilo y arquitectura moderna</strong> sobre la que podemos construir y adaptar al 100% las necesidades de ${lead.businessName || 'su negocio'}.
          </p>
          <a href="${fullScreenMockupUrl}" target="_blank" style="text-decoration: none; display: block;">
            <img src="${gifUrl}" alt="Comparación Conceptual Antes vs Línea de Diseño" style="width: 100%; max-width: 600px; border-radius: 8px; border: 1px solid #334155; display: block; margin: 0 auto;" />
          </a>
          <div style="margin-top: 16px;">
            <a href="${fullScreenMockupUrl}" target="_blank" style="display: inline-block; background: #10b981; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 13px; font-family: sans-serif; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
              🖥️ Explorar la Línea de Diseño en Pantalla Completa
            </a>
          </div>
        </div>
        `;
      } else {
        visualBlockHtml = `
        <div style="text-align: center; margin: 24px 0; padding: 22px; background: #0f172a; border-radius: 12px;">
          <span style="display: inline-block; background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 12px; border-radius: 20px; margin-bottom: 10px; border: 1px solid rgba(52, 211, 153, 0.3);">
            Línea de Diseño y Dirección Visual de Referencia
          </span>
          <p style="color: #cbd5e1; font-size: 13px; margin: 0 0 16px 0; line-height: 1.5; font-family: sans-serif;">
            No se trata de una plantilla fija ni de un producto cerrado, sino de una <strong>propuesta de estilo y arquitectura moderna</strong> adaptada a <strong>${lead.businessName || 'su negocio'}</strong>:
          </p>
          <a href="${fullScreenMockupUrl}" target="_blank" style="display: inline-block; background: #10b981; color: #ffffff; padding: 13px 26px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; font-family: sans-serif; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
            🖥️ Explorar la Línea de Diseño en Pantalla Completa
          </a>
        </div>
        `;
      }

      // Soluciones a problemas técnicos y de automatización según nicho
      const websiteLower = (lead.website || '').toLowerCase();
      const nameLower = (lead.businessName || '').toLowerCase();
      let solutionsHtml = '';

      if (nameLower.includes('restauran') || nameLower.includes('bar') || nameLower.includes('cafe') || nameLower.includes('gastro') || nameLower.includes('asador')) {
        solutionsHtml = `
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 15px; font-family: sans-serif;">⚙️ Soluciones operativas que implementamos habitualmente para el sector gastronómico:</h4>
          <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.6;">
            <li><strong>Sistema de Reservas Automatizado:</strong> Confirmaciones por WhatsApp/Email sin comisiones por cubierto de terceros.</li>
            <li><strong>Carta Digital Dinámica & Pedidos Directos:</strong> Menús interactivos rápidos para optimizar el ticket medio.</li>
            <li><strong>Automatización de Redes Sociales y Reseñas con IA:</strong> Captura y respuesta inteligente a reseñas de Google para fidelizar comensales.</li>
          </ul>
        </div>
        `;
      } else if (nameLower.includes('inmobil') || nameLower.includes('realt') || nameLower.includes('prop') || nameLower.includes('piso') || nameLower.includes('casa')) {
        solutionsHtml = `
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 15px; font-family: sans-serif;">⚙️ Soluciones de captación y procesos que resolvemos en el sector inmobiliario:</h4>
          <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.6;">
            <li><strong>Filtros Avanzados y Catálogo Rápido:</strong> Fichas de inmuebles con carga instantánea y botón directo de visita.</li>
            <li><strong>Cualificación Automática de Compradores con IA:</strong> Filtro de capacidad y preferencias antes de agendar la visita al inmueble.</li>
            <li><strong>Automatización de Contenido y Portales:</strong> Sincronización ágil de cartera y presencia digital sin tareas manuales repetitivas.</li>
          </ul>
        </div>
        `;
      } else if (nameLower.includes('clinic') || nameLower.includes('dent') || nameLower.includes('salud') || nameLower.includes('fisio') || nameLower.includes('medic')) {
        solutionsHtml = `
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 15px; font-family: sans-serif;">⚙️ Soluciones de gestión y captación para el sector salud y clínicas:</h4>
          <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.6;">
            <li><strong>Cita Previa Online Inteligente:</strong> Agendamiento directo con recordatorios automatizados para reducir el ausentismo (no-shows).</li>
            <li><strong>Atención Rápida por Chatbot IA:</strong> Resolución de dudas frecuentes sobre tratamientos 24/7 sin sobrecargar recepción.</li>
            <li><strong>Reputación y Google Reviews:</strong> Solicitud automatizada y ética de valoraciones a pacientes satisfechos.</li>
          </ul>
        </div>
        `;
      } else {
        solutionsHtml = `
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 15px; font-family: sans-serif;">⚙️ Retos técnicos y de automatización que resolvemos en Grupo Hormesis:</h4>
          <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.6;">
            <li><strong>Sistemas de Captación y Agendamiento 24/7:</strong> Calificación de prospectos en piloto automático.</li>
            <li><strong>Automatización de Tareas Repetitivas con IA:</strong> Gestión de respuestas, CRM y presencia en canales digitales.</li>
            <li><strong>Optimización de Conversión y Velocidad:</strong> Arquitectura moderna diseñada para retener usuarios y convertirlos en clientes.</li>
          </ul>
        </div>
        `;
      }

      // 11. Datos de Contacto y Nombre del Cliente
      const clientName = lead.businessName || lead.contactName || 'Equipo';

      // 12. Reemplazo exhaustivo de variables [Nombre], [Empresa], {{name}}, etc.
      const replaceVariables = (text: string) => {
        if (!text) return '';
        return text
          .replace(/\[Nombre del Cliente\]/gi, clientName)
          .replace(/\[Nombre de la Empresa\]/gi, clientName)
          .replace(/\[Nombre Empresa\]/gi, clientName)
          .replace(/\[Nombre\]/gi, clientName)
          .replace(/\[Empresa\]/gi, clientName)
          .replace(/\[Cliente\]/gi, clientName)
          .replace(/\[Tu Negocio\]/gi, clientName)
          .replace(/{{name}}/gi, clientName)
          .replace(/{{nombre}}/gi, clientName)
          .replace(/{{businessName}}/gi, clientName)
          .replace(/{{Empresa}}/gi, clientName)
          .replace(/{{magic_link}}/gi, magicLink)
          .replace(/\[magic_link\]/gi, magicLink)
          .replace(/{{link_magico}}/gi, magicLink)
          .replace(/{{mockup_url}}/gi, fullScreenMockupUrl)
          .replace(/\[mockup_url\]/gi, fullScreenMockupUrl)
          .replace(/{{enlace_maqueta}}/gi, fullScreenMockupUrl);
      };

      // 13. Limpieza y saneamiento del texto generado por IA para evitar duplicación de botones, footers o banners
      let cleanedIntroHtml = '';
      if (emailTemplate?.body) {
        let raw = replaceVariables(emailTemplate.body);
        
        // Eliminar bloques previos de botones (Responder / Agendar)
        raw = raw.replace(/<div[^>]*>[\s\S]*?(?:Responder|Agendar\s*Reuni[oó]n)[\s\S]*?<\/div>/gi, '');
        raw = raw.replace(/<a[^>]*>(?:Responder|Agendar[^<]*)<\/a>/gi, '');
        
        // Eliminar footers o copyright previos incrustados
        raw = raw.replace(/<p[^>]*>[\s\S]*?(?:Grupo\s+Hormesis|derechos\s+reservados)[\s\S]*?<\/p>/gi, '');
        raw = raw.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
        
        // Eliminar cabeceras oscuras duplicadas (tipo "Transforma tu Propuesta de Negocios")
        raw = raw.replace(/<div[^>]*background(?:-color)?:\s*#(?:0f172a|000|1e293b)[^>]*>[\s\S]*?<\/div>/gi, '');
        
        // Eliminar saludos duplicados "Hola [Nombre]" si ya existían al principio
        raw = raw.replace(/<p[^>]*>\s*Hola\s*[^<]*<\/p>/gi, '');
        
        cleanedIntroHtml = raw.trim();
      }

      if (!cleanedIntroHtml) {
        cleanedIntroHtml = `
          <p style="font-size: 15px; color: #334155; margin: 0 0 14px 0; line-height: 1.6;">
            Estuvimos analizando la experiencia digital de su sitio web actual (${lead.website || 'su presencia online'}) y encontramos oportunidades concretas de conversión y arquitectura moderna que pueden impulsar la captación de clientes para <strong>${clientName}</strong>.
          </p>
        `;
      }

      let clientSubject = emailTemplate?.subject 
        ? replaceVariables(emailTemplate.subject)
        : `Propuesta de rediseño web y auditoría para ${clientName}`;

      // 14. Plantilla estructurada para el botón 'Responder' (facilita al cliente detallar problemas y servicios de interés)
      const replySubject = encodeURIComponent(`Interés en propuesta y soluciones - ${clientName}`);
      const replyBodyTemplate = 
`Hola equipo de Grupo Hormesis,

He revisado la auditoría y propuesta visual para ${clientName}. Nos gustaría avanzar y comentarles nuestra situación:

1. PROBLEMAS O RETOS QUE NOS GUSTARÍA RESOLVER EN NUESTRO NEGOCIO:
- [Describe aquí brevemente tus principales problemas en la web actual, cuellos de botella o tareas manuales]

2. SERVICIOS O ÁREAS QUE NOS GUSTARÍA CONOCER MÁS:
(Marca con una X las opciones de tu interés)
[ ] Rediseño web moderno y optimización de conversión (CRO)
[ ] Automatización de tareas repetitivas y flujos de trabajo con IA
[ ] Agendamiento de citas / reservas online automatizadas
[ ] Cualificación y captación automática de clientes (CRM / Chatbots)
[ ] Optimización de velocidad, SEO y resolución de fallos técnicos

3. AGENDAR REUNIÓN (CALENDARIO ONLINE):
(Para elegir el día y hora de la videollamada de 15 min, por favor pulsa directamente el botón 'Agendar Reunión' en el correo para ver los horarios disponibles en nuestro calendario interactivo en tiempo real)

4. COMENTARIOS ADICIONALES:
- [Escribe aquí cualquier contexto o duda adicional que quieras comentarnos antes de la sesión]

---
Nombre de contacto: [Tu Nombre]
Empresa: ${clientName}
Teléfono: ${lead.phone || '[Tu Teléfono]'}`;

      const replyMailtoUrl = `mailto:${gmailAddress}?subject=${replySubject}&body=${encodeURIComponent(replyBodyTemplate)}`;

      // 15. Plantilla Maestra Unificada (Single-Card Flow con GIF Above-The-Fold y 2 Botones Finales)
      let clientBody = `
        <div style="background-color: #f1f5f9; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td align="center">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 630px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.07); border: 1px solid #e2e8f0;">
                  
                  <!-- ENCABEZADO DE MARCA -->
                  <tr>
                    <td style="background-color: #0f172a; padding: 22px 28px; text-align: center;">
                      <h2 style="color: #ffffff; margin: 0; font-size: 19px; font-weight: 700; letter-spacing: 0.5px; font-family: sans-serif;">
                        GRUPO HORMESIS
                      </h2>
                      <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-family: sans-serif;">
                        Transformación Digital & Soluciones con Inteligencia Artificial
                      </p>
                    </td>
                  </tr>

                  <!-- CUERPO INTEGRADO -->
                  <tr>
                    <td style="padding: 28px 28px 20px 28px; color: #1e293b; font-size: 14px; line-height: 1.6;">
                      
                      <!-- SALUDO PERSONALIZADO -->
                      <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 14px 0; font-family: sans-serif;">
                        Hola, equipo de ${clientName}:
                      </p>

                      <!-- GANCHO / TEXTO PERSUASIVO INICIAL -->
                      <div style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 18px;">
                        ${cleanedIntroHtml}
                      </div>

                      <!-- 🎬 1. HERO VISUAL: EL GIF DE COMPARACIÓN INMEDIATO (ABOVE THE FOLD) -->
                      ${visualBlockHtml}

                      <!-- 🔍 2. DIAGNÓSTICO RÁPIDO & AUDITORÍA TÉCNICA -->
                      ${auditHtml}

                      <!-- ⚙️ 3. SOLUCIONES Y AUTOMATIZACIONES SEGÚN SECTOR -->
                      ${solutionsHtml}

                      <!-- 🎯 4. CIERRE CON LOS 2 BOTONES DE ACCIÓN (MEET CON LINK MÁGICO + RESPUESTA ESTRUCTURADA) -->
                      <div style="margin: 32px 0 12px 0; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center;">
                        <p style="color: #0f172a; font-size: 15px; font-weight: 700; margin: 0 0 6px 0; font-family: sans-serif;">
                          ¿Revisamos esta propuesta o resolvemos estos puntos técnicos en su negocio?
                        </p>
                        <p style="color: #64748b; font-size: 13px; margin: 0 0 18px 0; font-family: sans-serif;">
                          Podemos analizarlo juntos en una breve videollamada de 15 minutos sin compromiso.
                        </p>
                        
                        <div style="text-align: center;">
                          <a href="${magicLink}" target="_blank" style="background-color: #10b981; color: #ffffff; padding: 13px 26px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 14px; font-family: sans-serif; display: inline-block; margin: 6px 8px; box-shadow: 0 3px 10px rgba(16, 185, 129, 0.35);">
                            📅 Agendar Reunión (15 min)
                          </a>
                          <a href="${replyMailtoUrl}" style="background-color: #0f172a; color: #ffffff; padding: 13px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; font-family: sans-serif; display: inline-block; margin: 6px 8px;">
                            💬 Responder
                          </a>
                        </div>
                      </div>

                    </td>
                  </tr>

                  <!-- PIE DE PÁGINA CORPORATIVO -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 18px 24px; text-align: center; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 11px; font-family: sans-serif; line-height: 1.5;">
                      Grupo Hormesis | Transformación Digital & Marketing Estratégico<br/>
                      © 2026 Todos los derechos reservados.
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </div>
      `;

      // Sanitización estricta: Garantizar que NINGÚN enlace local (localhost) viaje en el correo
      clientBody = clientBody
        .replace(/https?:\/\/localhost:5173/gi, frontendUrl)
        .replace(/https?:\/\/127\.0\.0\.1:5173/gi, frontendUrl)
        .replace(/https?:\/\/localhost:3000/gi, backendUrl)
        .replace(/https?:\/\/127\.0\.0\.1:3000/gi, backendUrl);

      clientSubject = clientSubject
        .replace(/https?:\/\/localhost:\d+/gi, '')
        .replace(/https?:\/\/127\.0\.0\.1:\d+/gi, '');

      try {
        await transporter.sendMail({
          from: gmailAddress,
          to: lead.email as string,
          subject: clientSubject,
          html: clientBody
        });
        
        context.log(`✅ Correo enviado a ${lead.email}. Actualizando estado a CONTACTADO...`);
        
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: 'CONTACTADO' }
        });

        await prisma.activity.create({
          data: {
            leadId: lead.id,
            type: 'AUTO_EMAIL',
            title: 'Correo Automático con GIF y Auditoría Enviado',
            description: `<strong>Asunto: ${clientSubject}</strong><br><br>` + clientBody
          }
        });

        sentCount++;
      } catch (error: any) {
        context.log(`Error enviando correo a ${lead.email}: ${error.message}`);
      }
    }

    context.log(`Proceso finalizado. Se enviaron ${sentCount} correos exitosamente.`);
    
    return {
      total_found: leads.length,
      emails_sent: sentCount
    };
  }
}

function isColorSignificant(hex: string): boolean {
  if (!hex || !hex.startsWith('#')) return false;
  let clean = hex.substring(1).toLowerCase();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length !== 6) return false;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
  // Descartar casi blancos y blancos puros (> 240)
  if (r > 240 && g > 240 && b > 240) return false;
  // Descartar casi negros (< 18)
  if (r < 18 && g < 18 && b < 18) return false;
  // Descartar grises planos desaturados
  if (Math.abs(r - g) < 14 && Math.abs(g - b) < 14 && Math.abs(r - b) < 14) return false;
  return true;
}

function rgbToHex(rgbStr: string): string | null {
  if (!rgbStr) return null;
  const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return null;
  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  return isColorSignificant(hex) ? hex : null;
}

function normalizeColorToHex(colorStr: string | null | undefined): string | null {
  if (!colorStr) return null;
  const s = colorStr.trim();
  if (s.startsWith('#')) {
    let clean = s.substring(1);
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    if (clean.length >= 6) {
      const hex = '#' + clean.substring(0, 6).toLowerCase();
      return isColorSignificant(hex) ? hex : null;
    }
  }
  if (s.startsWith('rgb')) {
    return rgbToHex(s);
  }
  return null;
}

function generateHarmoniousAccent(primaryHex: string): string {
  let clean = primaryHex.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
  const num = parseInt(clean, 16);
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  if (brightness < 120) {
    r = Math.min(255, Math.round(r * 1.5 + 50));
    g = Math.min(255, Math.round(g * 1.5 + 50));
    b = Math.min(255, Math.round(b * 1.5 + 50));
  } else {
    r = Math.max(0, Math.round(r * 0.55));
    g = Math.max(0, Math.round(g * 0.55));
    b = Math.max(0, Math.round(b * 0.55));
  }
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

async function testImageUrl(url: string | null): Promise<string | null> {
  if (!url || !url.startsWith('http')) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) {
      const ctype = res.headers.get('content-type') || '';
      if (!ctype || ctype.includes('image') || ctype.includes('octet-stream')) {
        return url;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function extractBrandAssets(websiteUrl: string, businessName: string, leadId: string, niche: string, leadMetadata?: any): Promise<{
  palette: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
    textColor: string;
    name: string;
  };
  images: {
    logo: string | null;
    hero: string;
    service1: string;
    service2: string;
    service3: string;
    avatar1: string;
    avatar2: string;
    isRealClientImages: boolean;
    hasClientLogo?: boolean;
  };
  fallbackImages: {
    hero: string;
    service1: string;
    service2: string;
    service3: string;
    avatar1: string;
    avatar2: string;
  };
  layoutArchetype: 'editorial_magazine' | 'brutalist_minimal' | 'luxury_dark_split' | 'bento_tech';
}> {
  let foundHexes: string[] = [];
  const counts: Record<string, number> = {};
  let scrapedLogo: string | null = null;
  let scrapedOgImage: string | null = null;
  let scrapedPhotos: string[] = [];

  // 1. Extraer desde leadMetadata.brandIdentity si fue analizado por Puppeteer
  const bIdentity = leadMetadata?.brandIdentity || leadMetadata?.technicalAnalysis?.brandIdentity;
  if (bIdentity) {
    const cPrimary = normalizeColorToHex(bIdentity.primaryVar || bIdentity.themeColor || bIdentity.navBg);
    const cAccent = normalizeColorToHex(bIdentity.accentVar || bIdentity.btnBg);
    if (cPrimary && !foundHexes.includes(cPrimary)) foundHexes.push(cPrimary);
    if (cAccent && !foundHexes.includes(cAccent)) foundHexes.push(cAccent);
    if (bIdentity.logoUrl && !scrapedLogo) scrapedLogo = bIdentity.logoUrl;
  }

  // 2. Extracción directa del HTML y CSS de la URL de base
  if (websiteUrl && websiteUrl.startsWith('http')) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(websiteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const html = await res.text();
        const baseUrl = new URL(websiteUrl);

        // A. Meta theme-color y msapplication-TileColor
        const themeMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:theme-color|msapplication-TileColor)["'][^>]+content=["']([^"']+)["']/i) ||
                           html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:theme-color|msapplication-TileColor)["']/i);
        if (themeMatch && themeMatch[1]) {
          const c = normalizeColorToHex(themeMatch[1]);
          if (c && !foundHexes.includes(c)) foundHexes.unshift(c);
        }

        // B. CSS Custom Properties / Variables de marca en <style> o HTML
        const cssVarRegex = /--(?:primary|brand|main|accent|color-primary|theme-primary|theme-color|e-global-color-primary)[^:]*:\s*([^;}\n]+)/gi;
        let varMatch;
        while ((varMatch = cssVarRegex.exec(html)) !== null) {
          const c = normalizeColorToHex(varMatch[1]);
          if (c && !foundHexes.includes(c)) foundHexes.push(c);
        }

        // C. Extraer colores de hojas de estilo vinculadas (<link rel="stylesheet">)
        const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/gi;
        let lMatch;
        const cssUrls: string[] = [];
        while ((lMatch = linkRegex.exec(html)) !== null) {
          try {
            const href = lMatch[1];
            if (!href || href.includes('fonts.google') || href.includes('fontawesome') || href.includes('icon')) continue;
            const fullCssUrl = new URL(href, baseUrl).href;
            if (fullCssUrl.startsWith('http') && !cssUrls.includes(fullCssUrl)) {
              cssUrls.push(fullCssUrl);
            }
          } catch (e) {}
        }

        // Inspeccionar las 2 primeras hojas de estilo prioritarias (theme, style, main, app)
        const priorityCss = cssUrls.sort((a, b) => {
          const score = (u: string) => /theme|style|main|app|global|custom/i.test(u) ? -1 : 1;
          return score(a) - score(b);
        }).slice(0, 2);

        for (const cssUrl of priorityCss) {
          try {
            const cssCtrl = new AbortController();
            const cssT = setTimeout(() => cssCtrl.abort(), 2000);
            const cssRes = await fetch(cssUrl, { signal: cssCtrl.signal });
            clearTimeout(cssT);
            if (cssRes.ok) {
              const cssText = await cssRes.text();
              let cVar;
              while ((cVar = cssVarRegex.exec(cssText)) !== null) {
                const c = normalizeColorToHex(cVar[1]);
                if (c && !foundHexes.includes(c)) foundHexes.push(c);
              }
              const cssHexes = cssText.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g) || [];
              for (const h of cssHexes) {
                const c = normalizeColorToHex(h);
                if (c) counts[c] = (counts[c] || 0) + 1;
              }
            }
          } catch (e) {}
        }

        // D. Extraer todos los Hex y RGB del HTML y <style>
        const hexMatches = html.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g) || [];
        for (const h of hexMatches) {
          const c = normalizeColorToHex(h);
          if (c) counts[c] = (counts[c] || 0) + 1;
        }

        const rgbMatches = html.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+[^)]*\)/gi) || [];
        for (const r of rgbMatches) {
          const c = rgbToHex(r);
          if (c) counts[c] = (counts[c] || 0) + 1;
        }

        // Ordenar colores encontrados por frecuencia
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        for (const [color] of sorted) {
          if (!foundHexes.includes(color)) foundHexes.push(color);
        }

        // E. Extraer Únicamente el Logo del Cliente (las fotos antiguas de su web se descartan para evitar baja resolución)
        const imgRegex = /<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
        let match;
        while ((match = imgRegex.exec(html)) !== null) {
          const fullTag = match[0];
          const rawSrc = match[1];
          if (!rawSrc || rawSrc.startsWith('data:image') || rawSrc.includes('pixel') || rawSrc.includes('track')) continue;

          try {
            const absUrl = new URL(rawSrc, baseUrl).href;
            const isLogo = /logo|brand|header/i.test(fullTag) || /logo|brand/i.test(rawSrc);
            if (isLogo && !scrapedLogo) {
              scrapedLogo = absUrl;
              break;
            }
          } catch (e) {}
        }
      }
    } catch (err: any) {}
  }

  // 3. Pre-validación rápida de accesibilidad del logo para evitar imágenes rotas
  if (scrapedLogo) {
    const validLogo = await testImageUrl(scrapedLogo);
    if (!validLogo) scrapedLogo = null;
  }

  function hashStr(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
    return Math.abs(h);
  }
  const seed = hashStr((businessName || '') + (websiteUrl || ''));

  // Determinación de Arquetipo de Diseño Pinterest/Dribbble
  const archetypes: Array<'editorial_magazine' | 'brutalist_minimal' | 'luxury_dark_split' | 'bento_tech'> = [
    'editorial_magazine',
    'brutalist_minimal',
    'luxury_dark_split',
    'bento_tech'
  ];
  const layoutArchetype = archetypes[seed % archetypes.length];

  // Paleta de Colores
  let palette = {
    primary: '#0f2744',
    accent: '#2563eb',
    background: '#ffffff',
    surface: '#f8fafc',
    textColor: '#0f172a',
    name: 'Azul Pizarra Moderno'
  };

  if (foundHexes.length >= 2) {
    palette = {
      primary: foundHexes[0],
      accent: foundHexes[1],
      background: '#ffffff',
      surface: '#f8fafc',
      textColor: '#0f172a',
      name: `Línea de color corporativa real de ${websiteUrl} (${foundHexes.slice(0, 2).join(', ')})`
    };
  } else if (foundHexes.length === 1) {
    palette = {
      primary: foundHexes[0],
      accent: generateHarmoniousAccent(foundHexes[0]),
      background: '#ffffff',
      surface: '#f8fafc',
      textColor: '#0f172a',
      name: `Color corporativo real de ${websiteUrl} (${foundHexes[0]})`
    };
  } else {
    const palettes = [
      { primary: '#0f3d3e', accent: '#d39e82', background: '#fcfbf7', surface: '#f4f1ea', textColor: '#1a2323', name: 'Verde Botánico & Terracota Cálido' },
      { primary: '#8b1d2c', accent: '#d97706', background: '#faf9f6', surface: '#f5f2eb', textColor: '#1f1315', name: 'Burdeos Real & Ocre Ámbar' },
      { primary: '#14532d', accent: '#16a34a', background: '#fcfdfc', surface: '#f0fdf4', textColor: '#052e16', name: 'Verde Esmeralda Natural' },
      { primary: '#18181b', accent: '#ca8a04', background: '#fafaf9', surface: '#f5f5f4', textColor: '#18181b', name: 'Grafito & Oro Pulido' },
      { primary: '#431407', accent: '#ea580c', background: '#fdfaf8', surface: '#fff7ed', textColor: '#270c04', name: 'Cobre & Naranja Brasa' },
      { primary: '#312e81', accent: '#7c3aed', background: '#fdfcfe', surface: '#f5f3ff', textColor: '#1e1b4b', name: 'Índigo Ejecutivo & Violeta' },
      { primary: '#164e63', accent: '#06b6d4', background: '#f8fafc', surface: '#ecfeff', textColor: '#083344', name: 'Cian Petróleo & Turquesa' },
      { primary: '#0f172a', accent: '#0284c7', background: '#f8fafc', surface: '#f1f5f9', textColor: '#0f172a', name: 'Azul Pizarra & Zafiro' }
    ];
    palette = palettes[seed % palettes.length];
  }

  // Las fotografías de Hero y Servicios se generan exclusivamente con colecciones curadas de alta definición adaptadas al sector exacto
  const fallbackCat = getCategoryImages(leadId, businessName, niche, websiteUrl, leadMetadata);

  return {
    palette,
    images: {
      logo: scrapedLogo,
      hero: fallbackCat.hero,
      service1: fallbackCat.service1,
      service2: fallbackCat.service2,
      service3: fallbackCat.service3,
      avatar1: fallbackCat.avatar1,
      avatar2: fallbackCat.avatar2,
      isRealClientImages: false, // Solo se utiliza el logo del cliente; el resto generado por Google AI
      hasClientLogo: Boolean(scrapedLogo)
    },
    fallbackImages: fallbackCat,
    layoutArchetype
  };
}

function getCategoryImages(leadId: string, businessName: string, niche: string, website: string, leadMetadata?: any) {
  const metaParts = [
    businessName,
    niche,
    website,
    leadMetadata?.niche,
    leadMetadata?.category,
    leadMetadata?.searchQuery,
    Array.isArray(leadMetadata?.types) ? leadMetadata.types.join(' ') : '',
    leadMetadata?.aiAuditReport?.businessType || '',
    leadMetadata?.aiAuditReport?.detailedAnalysis || ''
  ];
  const rawCombined = metaParts.filter(Boolean).join(' ').toLowerCase();
  // Normalizar eliminando tildes para búsqueda infalible
  const normalized = rawCombined.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const has = (...terms: string[]) => terms.some(t => normalized.includes(t));
  const hasWord = (pattern: RegExp) => pattern.test(normalized);

  function hashSeed(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  const seed = hashSeed((leadId || '') + (businessName || '') + (website || ''));

  const avatarPool = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=180&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=180&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=180&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=180&q=80',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=180&q=80',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=180&q=80',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=180&q=80',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=180&q=80',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=180&q=80',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=180&q=80'
  ];

  // 1. PRIORIDAD MÁXIMA: Despachos Jurídicos, Bufetes de Abogados, Notarías, Procuradores y Asesoría Legal
  if (has('abogad', 'juridic', 'bufete', 'despacho', 'notar', 'procurad', 'litigio', 'derecho', 'penal', 'mercantil', 'laboralis', 'civilis', 'tribunal', 'pleito', 'herencia', 'defensa legal', 'asesoria legal', 'asesoria juridica', 'consultoria juridica', 'lawyer', 'law firm', 'attorney', 'jurista')) {
    const heroes = [
      'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80', // Balanza de la justicia y códigos legales en madera noble
      'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80', // Mesa de despacho jurídico con documentos y firma
      'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80', // Sala de juntas de alto standing para reuniones de socios
      'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80', // Sede moderna de bufete corporativo
      'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80'  // Consulta legal con cliente en despacho privado
    ];
    const services = [
      'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80', // Litigios y defensa en tribunales
      'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80', // Derecho civil, mercantil y societario
      'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80', // Asesoramiento fiscal, tributario y herencias
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=600&q=80'  // Mediación, acuerdos y contratación
    ];
    return {
      hero: heroes[seed % heroes.length],
      service1: services[(seed + 1) % services.length],
      service2: services[(seed + 2) % services.length],
      service3: services[(seed + 3) % services.length],
      avatar1: avatarPool[(seed + 2) % avatarPool.length],
      avatar2: avatarPool[(seed + 5) % avatarPool.length]
    };
  }

  // 2. Clínicas, Salud, Odontología, Dental, Médicos, Fisioterapia
  if (has('dental', 'clinic', 'dentis', 'odontol', 'medic', 'fisio', 'fisioterap', 'salud', 'quiropractic', 'podolog', 'oftalmol', 'pediatr')) {
    const heroes = [
      'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1200&q=80'
    ];
    const services = [
      'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1598256989800-fe5f95da9787?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=600&q=80'
    ];
    return {
      hero: heroes[seed % heroes.length],
      service1: services[(seed + 1) % services.length],
      service2: services[(seed + 2) % services.length],
      service3: services[(seed + 3) % services.length],
      avatar1: avatarPool[(seed + 3) % avatarPool.length],
      avatar2: avatarPool[(seed + 5) % avatarPool.length]
    };
  }

  // 3. Energía Solar, Fotovoltaica, Climatización y Renovables
  if (has('solar', 'fotovolt', 'placa', 'panel', 'renovable', 'energ', 'clima', 'aerotermi', 'calefacc', 'autoconsumo')) {
    const heroes = [
      'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1200&q=80', // Vivienda moderna con placas solares en tejado
      'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=1200&q=80', // Instalación fotovoltaica residencial
      'https://images.unsplash.com/photo-1558449028-b53a39d100fc?auto=format&fit=crop&w=1200&q=80', // Técnico especializado con placas solares
      'https://images.unsplash.com/photo-1497440001374-f26997328c1b?auto=format&fit=crop&w=1200&q=80', // Tejado con placas solares y sol brillante
      'https://images.unsplash.com/photo-1545209569-80b6b23b49e3?auto=format&fit=crop&w=1200&q=80', // Instalación de energía limpia y sostenible
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80', // Hogar autosuficiente y eficiente
      'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1200&q=80', // Paneles y tecnología solar avanzada
      'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1200&q=80'  // Soluciones renovables para familias y empresas
    ];
    const services = [
      'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1545209569-80b6b23b49e3?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=600&q=80'
    ];
    return {
      hero: heroes[seed % heroes.length],
      service1: services[(seed + 1) % services.length],
      service2: services[(seed + 2) % services.length],
      service3: services[(seed + 3) % services.length],
      avatar1: avatarPool[(seed + 1) % avatarPool.length],
      avatar2: avatarPool[(seed + 4) % avatarPool.length]
    };
  }

  // 4. Arquitectura, Reformas, Obras, Fontanería, Pintura, Carpintería, Cerrajería, Electricistas
  if (has('arquitect', 'construc', 'edifica', 'urbanis', 'reforma', 'fontaner', 'pintur', 'carpinter', 'cerrajer', 'albanil', 'electricis', 'averia')) {
    const heroes = [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=80'
    ];
    const services = [
      'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1534349762230-e0cadf78f5da?auto=format&fit=crop&w=600&q=80'
    ];
    return {
      hero: heroes[seed % heroes.length],
      service1: services[(seed + 1) % services.length],
      service2: services[(seed + 2) % services.length],
      service3: services[(seed + 3) % services.length],
      avatar1: avatarPool[(seed + 2) % avatarPool.length],
      avatar2: avatarPool[(seed + 5) % avatarPool.length]
    };
  }

  // 5. Inmobiliarias y Promotoras
  if (has('inmobiliar', 'real estate', 'vivienda', 'propiedad', 'promocion', 'fincas', 'alquiler de piso')) {
    const heroes = [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80'
    ];
    const services = [
      'https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=600&q=80'
    ];
    return {
      hero: heroes[seed % heroes.length],
      service1: services[(seed + 1) % services.length],
      service2: services[(seed + 2) % services.length],
      service3: services[(seed + 3) % services.length],
      avatar1: avatarPool[(seed + 2) % avatarPool.length],
      avatar2: avatarPool[(seed + 5) % avatarPool.length]
    };
  }

  // 6. Veterinaria, Mascotas, Animales
  if (has('veterin', 'mascot', 'perr', 'gat', 'canin', 'felin', 'zoosanit', 'animal')) {
    const heroes = [
      'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?auto=format&fit=crop&w=1200&q=80'
    ];
    const services = [
      'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=600&q=80'
    ];
    return {
      hero: heroes[seed % heroes.length],
      service1: services[(seed + 1) % services.length],
      service2: services[(seed + 2) % services.length],
      service3: services[(seed + 3) % services.length],
      avatar1: avatarPool[(seed + 1) % avatarPool.length],
      avatar2: avatarPool[(seed + 3) % avatarPool.length]
    };
  }

  // 7. Hoteles, Casas Rurales, Turismo, Alojamientos
  if (has('hotel', 'hostal', 'rural', 'turis', 'alojam', 'apartament', 'viaje', 'resort')) {
    const heroes = [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80'
    ];
    const services = [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80'
    ];
    return {
      hero: heroes[seed % heroes.length],
      service1: services[(seed + 1) % services.length],
      service2: services[(seed + 2) % services.length],
      service3: services[(seed + 3) % services.length],
      avatar1: avatarPool[(seed + 2) % avatarPool.length],
      avatar2: avatarPool[(seed + 5) % avatarPool.length]
    };
  }

  // 8. Restaurantes, Hostelería, Bares y Gastronomía (¡CERO falsos positivos con palabras como embargo, Barcelona o barrio!)
  if (
    has('restauran', 'gastronom', 'tapas', 'pizz', 'asador', 'hosteler', 'cafeteri', 'cerveceri', 'marisqueri', 'churreri', 'bistrot', 'braser', 'vinoteci', 'bodeguita') ||
    hasWord(/\b(bar|bares|taberna|meson)\b/)
  ) {
    const heroes = [
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=80'
    ];
    const services = [
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80'
    ];
    return {
      hero: heroes[seed % heroes.length],
      service1: services[(seed + 1) % services.length],
      service2: services[(seed + 2) % services.length],
      service3: services[(seed + 3) % services.length],
      avatar1: avatarPool[(seed + 1) % avatarPool.length],
      avatar2: avatarPool[(seed + 4) % avatarPool.length]
    };
  }

  // 9. Peluquerías, Estética, Belleza, Spas y Barberías (¡CERO falsos positivos con apellidos como Barberá/Barbero o salas/salones!)
  if (
    has('peluquer', 'barberia', 'barbershop', 'corte de pelo', 'corte de barba', 'afeitado clasico', 'estetica', 'estilista', 'manicura', 'pedicura', 'depilac', 'salon de belleza', 'centro de estetica', 'centro de belleza', 'unas esculpidas') ||
    hasWord(/\b(barberia|barbershop|peluqueria|peluquero|peluquera|estilistas|spa)\b/)
  ) {
    const heroes = [
      'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80'
    ];
    const services = [
      'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80'
    ];
    return {
      hero: heroes[seed % heroes.length],
      service1: services[(seed + 1) % services.length],
      service2: services[(seed + 2) % services.length],
      service3: services[(seed + 3) % services.length],
      avatar1: avatarPool[(seed + 1) % avatarPool.length],
      avatar2: avatarPool[(seed + 3) % avatarPool.length]
    };
  }

  // 10. Talleres Mecánicos y Automoción
  if (has('taller mecanic', 'mecanic', 'coche', 'auto', 'motor', 'neumatic', 'chapa y pintura', 'vehiculo', 'itv')) {
    const heroes = [
      'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80'
    ];
    const services = [
      'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=600&q=80'
    ];
    return {
      hero: heroes[seed % heroes.length],
      service1: services[(seed + 1) % services.length],
      service2: services[(seed + 2) % services.length],
      service3: services[(seed + 3) % services.length],
      avatar1: avatarPool[(seed + 2) % avatarPool.length],
      avatar2: avatarPool[(seed + 4) % avatarPool.length]
    };
  }

  // 11. Gimnasios, Fitness, Deportes, Yoga, Entrenamiento Personal
  if (has('gimnas', 'gym', 'fitnes', 'crossfit', 'entrena', 'yoga', 'pilates', 'deport', 'boxeo', 'artes marciales')) {
    const heroes = [
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80'
    ];
    const services = [
      'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=600&q=80'
    ];
    return {
      hero: heroes[seed % heroes.length],
      service1: services[(seed + 1) % services.length],
      service2: services[(seed + 2) % services.length],
      service3: services[(seed + 3) % services.length],
      avatar1: avatarPool[(seed + 1) % avatarPool.length],
      avatar2: avatarPool[(seed + 3) % avatarPool.length]
    };
  }

  // 12. Gestorías, Asesorías Fiscales, Contables y Trámites
  if (has('gestor', 'asesor fiscal', 'asesor contable', 'tributar', 'transferencia', 'renta', 'autonomos', 'pymes')) {
    const heroes = [
      'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80'
    ];
    const services = [
      'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80'
    ];
    return {
      hero: heroes[seed % heroes.length],
      service1: services[(seed + 1) % services.length],
      service2: services[(seed + 3) % services.length],
      service3: services[(seed + 5) % services.length],
      avatar1: avatarPool[(seed + 2) % avatarPool.length],
      avatar2: avatarPool[(seed + 6) % avatarPool.length]
    };
  }

  // 13. Limpieza, Mantenimiento, Desinfección, Plagas
  if (has('limpiez', 'mantenim', 'desinfec', 'plaga', 'lavander', 'tintoreri')) {
    const heroes = [
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=1200&q=80'
    ];
    const services = [
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80'
    ];
    return {
      hero: heroes[seed % heroes.length],
      service1: services[(seed + 1) % services.length],
      service2: services[(seed + 2) % services.length],
      service3: services[(seed + 3) % services.length],
      avatar1: avatarPool[(seed + 2) % avatarPool.length],
      avatar2: avatarPool[(seed + 4) % avatarPool.length]
    };
  }

  // 14. Academias, Idiomas, Educación
  if (has('idioma', 'ingles', 'school', 'academ', 'educa', 'autoescuela')) {
    const heroes = [
      'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&w=1200&q=80'
    ];
    const services = [
      'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1501504905252-473c47e087f8?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=600&q=80'
    ];
    return {
      hero: heroes[seed % heroes.length],
      service1: services[(seed + 1) % services.length],
      service2: services[(seed + 2) % services.length],
      service3: services[(seed + 3) % services.length],
      avatar1: avatarPool[(seed + 1) % avatarPool.length],
      avatar2: avatarPool[(seed + 4) % avatarPool.length]
    };
  }

  // 15. Fallback variado para Empresas y Servicios Generales (rotación de equipos reales y tecnología, CERO rascacielos)
  const heroes = [
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80', // Equipo profesional dinámico y cercano
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80', // Reunión de asesoramiento y estrategia
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=80', // Liderazgo y atención directa personalizada
    'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80', // Presentación de proyectos y resultados
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80', // Innovación y excelencia en el servicio
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80'  // Espacio corporativo moderno y profesional
  ];
  const services = [
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=600&q=80'
  ];
  return {
    hero: heroes[seed % heroes.length],
    service1: services[(seed + 1) % services.length],
    service2: services[(seed + 2) % services.length],
    service3: services[(seed + 3) % services.length],
    avatar1: avatarPool[(seed) % avatarPool.length],
    avatar2: avatarPool[(seed + 4) % avatarPool.length]
  };
}

export function sanitizeAndGuardMockupHtml(
  rawHtml: string,
  leadName: string,
  brandPalette: any,
  catImages: any,
  fallbackCat: any,
  websiteUrl?: string
): string {
  if (!rawHtml) return '';
  let html = rawHtml;

  let websiteHost = '';
  if (websiteUrl) {
    try {
      websiteHost = new URL(websiteUrl).hostname.replace(/^www\./, '');
    } catch (e) {}
  }

  // 1. Inyectar Guardrails CSS para evitar cortes, desbordamientos y forzar línea de color
  const guardStyles = `
  <style id="hormesis-layout-and-brand-guardrails">
    /* Forzar variables de marca extraídas de la URL de base */
    :root {
      --primary: ${brandPalette.primary} !important;
      --primary-accent: ${brandPalette.accent} !important;
      --bg: ${brandPalette.background} !important;
      --bg-surface: ${brandPalette.surface} !important;
      --text-main: ${brandPalette.textColor} !important;
    }

    /* Reglas maestras anti-cortes y anti-desbordamiento */
    *, *::before, *::after {
      box-sizing: border-box !important;
    }
    html, body {
      max-width: 100% !important;
      overflow-x: hidden !important;
      min-height: 100% !important;
      height: auto !important;
      margin: 0;
      padding: 0;
    }

    /* Evitar que alturas fijas o 100vh corten secciones o tarjetas */
    section, header, footer, main, article,
    .hero, [class*="hero"], [class*="section"], [class*="container"], [class*="wrapper"] {
      height: auto !important;
      min-height: auto !important;
      max-width: 100% !important;
      overflow-wrap: break-word !important;
      word-break: break-word !important;
    }

    /* Tarjetas y componentes flexibles sin desborde */
    .card, [class*="card"], [class*="box"], [class*="item"], [class*="service"], [class*="bento"] {
      height: auto !important;
      min-height: auto !important;
      overflow-wrap: break-word !important;
      word-break: break-word !important;
      max-width: 100% !important;
    }

    /* Imágenes responsivas con preservación de proporciones */
    img {
      max-width: 100% !important;
      height: auto !important;
      display: inline-block;
    }
    img[class*="hero"], img[class*="main"], img[class*="service"], img[class*="banner"] {
      object-fit: cover !important;
    }

    /* Tarjetas e insignias flotantes con margen seguro */
    [class*="floating"], [class*="badge"], [class*="pill"] {
      max-width: calc(100% - 24px) !important;
    }

    /* Textos y títulos siempre contenidos */
    h1, h2, h3, h4, h5, h6, p, span, a {
      overflow-wrap: break-word !important;
      word-wrap: break-word !important;
    }

    /* Navbar fluido y sin cortes */
    nav, .navbar, [class*="nav"] {
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
  </style>
  `;

  if (html.includes('</head>')) {
    html = html.replace('</head>', `${guardStyles}\n</head>`);
  } else if (html.includes('<body')) {
    html = html.replace('<body', `${guardStyles}\n<body`);
  } else {
    html = `${guardStyles}\n${html}`;
  }

  // 2. Proteger todas las etiquetas <img>: asegurar que no provengan de la web del cliente (excepto logo) y añadir onerror fallback
  html = html.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
    let newAttrs = attrs;

    // Asegurar referrerpolicy="no-referrer"
    if (!/referrerpolicy=/i.test(newAttrs)) {
      newAttrs += ' referrerpolicy="no-referrer"';
    }
    // Asegurar loading="lazy" si no es hero principal
    if (!/loading=/i.test(newAttrs) && !/hero|main/i.test(newAttrs)) {
      newAttrs += ' loading="lazy"';
    }

    const isLogo = /logo/i.test(newAttrs) || /logo/i.test(match);

    // Manejar el Logo del cliente
    if (isLogo) {
      if (!/onerror=/i.test(newAttrs)) {
        newAttrs += ` onerror="this.style.display='none'; var next = this.nextElementSibling; if(next && next.classList.contains('fallback-logo-text')) next.style.display='inline-block';"`;
      }
      return `<img${newAttrs}><span class="fallback-logo-text" style="display:none; font-weight:800; font-size:1.35rem; color:${brandPalette.primary}; letter-spacing:-0.03em;">${leadName}</span>`;
    }

    // Para imágenes que NO son el logo: Si apuntan a la web del cliente o tienen src roto/relativo, sustituir por imagen de alta definición curada
    try {
      const srcMatch = newAttrs.match(/src=["']([^"']+)["']/i);
      if (srcMatch && srcMatch[1]) {
        const srcVal = srcMatch[1];
        const isClientDomain = websiteHost && srcVal.includes(websiteHost);
        const isInvalidSrc = !srcVal.startsWith('http') && !srcVal.startsWith('data:');
        if (isClientDomain || isInvalidSrc) {
          const isAvatar = /avatar|user|client|persona/i.test(newAttrs);
          const isService = /service|servicio|project|card/i.test(newAttrs);
          const replacementUrl = isAvatar ? fallbackCat.avatar1 : (isService ? fallbackCat.service1 : fallbackCat.hero);
          newAttrs = newAttrs.replace(srcMatch[0], `src="${replacementUrl}"`);
        }
      }
    } catch (e) {}

    // Manejar onerror para imágenes generales
    if (!/onerror=/i.test(newAttrs)) {
      const isAvatar = /avatar|user|client|persona/i.test(newAttrs);
      const isService = /service|servicio|project|card/i.test(newAttrs);
      const fallbackUrl = isAvatar ? fallbackCat.avatar1 : (isService ? fallbackCat.service1 : fallbackCat.hero);
      newAttrs += ` onerror="this.onerror=null; this.src='${fallbackUrl}';"`;
    }

    return `<img${newAttrs}>`;
  });

  return html;
}


export function generateConceptualDesignHtml(
  leadName: string,
  websiteUrl: string,
  brandPalette: any,
  catImages: any,
  fallbackCat: any,
  archetype: string,
  leadPhone: string,
  leadAddress: string,
  leadRating: number
): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${leadName} | Propuesta de Rediseño Oficial 2026</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: ${brandPalette.primary};
      --primary-accent: ${brandPalette.accent};
      --primary-gradient: linear-gradient(135deg, ${brandPalette.primary} 0%, ${brandPalette.accent} 100%);
      --bg: ${brandPalette.background};
      --bg-surface: ${brandPalette.surface};
      --text-main: ${brandPalette.textColor};
      --text-muted: #64748b;
      --border-color: rgba(226, 232, 240, 0.85);
      --shadow-sm: 0 2px 4px rgba(0,0,0,0.02);
      --shadow-md: 0 10px 25px -5px rgba(15, 23, 42, 0.08);
      --shadow-lg: 0 25px 50px -12px rgba(15, 23, 42, 0.15);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      max-width: 100%;
      overflow-x: hidden;
      min-height: 100%;
    }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 90% 0%, ${brandPalette.accent}14 0px, transparent 50%),
        radial-gradient(at 0% 40%, ${brandPalette.primary}10 0px, transparent 40%);
      background-attachment: fixed;
      color: var(--text-main);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    .topbar {
      background: var(--primary);
      color: #ffffff;
      padding: 9px 24px;
      font-size: 0.83rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    .topbar a { color: #ffffff; text-decoration: underline; font-weight: 700; }
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
      max-width: 100%;
    }
    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-img {
      max-height: 44px;
      max-width: 190px;
      object-fit: contain;
    }
    .logo-text {
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--primary);
      display: inline-block;
    }
    .nav-links {
      display: flex;
      gap: 28px;
      list-style: none;
      align-items: center;
      flex-wrap: wrap;
    }
    .nav-links a {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.92rem;
      font-weight: 600;
      transition: color 0.2s;
    }
    .nav-links a:hover { color: var(--primary-accent); }
    @media (max-width: 868px) { .nav-links { display: none; } }
    .nav-cta {
      background: var(--primary-accent);
      color: #ffffff;
      padding: 10px 24px;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 0.9rem;
      text-decoration: none;
      box-shadow: 0 8px 18px rgba(0,0,0,0.15);
      transition: transform 0.2s;
      white-space: nowrap;
    }
    .nav-cta:hover { transform: translateY(-2px); }
    .hero {
      max-width: 1240px;
      margin: 0 auto;
      padding: 60px 24px 70px 24px;
      display: grid;
      grid-template-columns: 1.18fr 0.82fr;
      gap: 50px;
      align-items: center;
      min-height: auto;
    }
    @media (max-width: 960px) { .hero { grid-template-columns: 1fr; padding: 40px 20px; } }
    .vanguard-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: var(--primary);
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 700;
      margin-bottom: 22px;
      max-width: calc(100% - 24px);
    }
    .pulse-dot { width: 8px; height: 8px; background: ${brandPalette.accent}; border-radius: 50%; box-shadow: 0 0 0 3px rgba(0,0,0,0.1); }
    .hero-title {
      font-size: clamp(2rem, 4.5vw, 3.8rem);
      font-weight: 900;
      line-height: 1.12;
      letter-spacing: -0.03em;
      color: var(--text-main);
      margin-bottom: 22px;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    .hero-title span { color: var(--primary-accent); }
    .hero-p { font-size: 1.15rem; color: var(--text-muted); margin-bottom: 28px; max-width: 580px; overflow-wrap: break-word; }
    .persona-tabs { display: flex; gap: 10px; margin-bottom: 28px; flex-wrap: wrap; }
    .persona-tab {
      background: #ffffff;
      border: 1px solid var(--border-color);
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-muted);
    }
    .persona-tab.active {
      background: var(--primary);
      color: #ffffff;
      border-color: var(--primary);
    }
    .hero-actions { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; margin-bottom: 22px; }
    .btn-primary {
      background: var(--primary-accent);
      color: white;
      padding: 15px 32px;
      border-radius: 14px;
      font-weight: 700;
      font-size: 1.02rem;
      text-decoration: none;
      box-shadow: 0 12px 28px rgba(0,0,0,0.15);
      transition: transform 0.2s;
      white-space: nowrap;
    }
    .btn-primary:hover { transform: translateY(-2px); }
    .btn-whatsapp {
      background: #25d366;
      color: white;
      padding: 15px 26px;
      border-radius: 14px;
      font-weight: 700;
      font-size: 1.02rem;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
    }
    .hero-visual-wrapper {
      position: relative;
      padding: 14px;
      max-width: 100%;
    }
    .hero-img-main {
      width: 100%;
      height: auto;
      min-height: 300px;
      max-height: 460px;
      aspect-ratio: 4/3;
      object-fit: cover;
      border-radius: 28px;
      box-shadow: var(--shadow-lg);
      border: 1px solid rgba(0,0,0,0.06);
    }
    .floating-card {
      position: absolute;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.9);
      border-radius: 18px;
      padding: 12px 18px;
      box-shadow: 0 16px 35px rgba(0, 0, 0, 0.12);
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 10;
      max-width: calc(100% - 28px);
    }
    .card-top { top: 0px; right: 0px; transform: translate(8px, -8px); }
    .card-bottom { bottom: 0px; left: 0px; transform: translate(-8px, 8px); }
    @media (max-width: 640px) {
      .card-top { transform: none; top: 10px; right: 10px; }
      .card-bottom { transform: none; bottom: 10px; left: 10px; }
    }
    .trust-strip {
      max-width: 1240px;
      margin: 0 auto;
      padding: 24px;
      border-top: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 20px;
      font-size: 0.9rem;
      font-weight: 700;
      color: #475569;
    }
    .bento-section { max-width: 1240px; margin: 70px auto; padding: 0 24px; }
    .bento-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 24px; margin-top: 36px; }
    .bento-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 24px;
      padding: 36px;
      box-shadow: var(--shadow-sm);
      overflow-wrap: break-word;
    }
    .bento-metric { font-size: 3.2rem; font-weight: 900; color: var(--primary-accent); line-height: 1; margin-bottom: 10px; }
    .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 24px; margin-top: 36px; }
    .service-card {
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 22px;
      overflow: hidden;
      box-shadow: var(--shadow-sm);
    }
    .service-img { width: 100%; height: 220px; object-fit: cover; }
    .service-content { padding: 26px; }
    .reviews-section { background: var(--bg-surface); padding: 70px 24px; margin-top: 70px; }
    .reviews-grid { max-width: 1240px; margin: 36px auto 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 24px; }
    .review-card { background: #ffffff; border: 1px solid var(--border-color); border-radius: 20px; padding: 28px; box-shadow: var(--shadow-sm); }
    /* Sección Proceso en 4 Pasos */
    .process-section { max-width: 1240px; margin: 80px auto; padding: 0 24px; }
    .section-badge {
      display: inline-block;
      background: rgba(37, 99, 235, 0.08);
      color: var(--primary-accent);
      border: 1px solid rgba(37, 99, 235, 0.2);
      font-weight: 800;
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 5px 14px;
      border-radius: 9999px;
      margin-bottom: 12px;
    }
    .section-title { font-size: clamp(1.8rem, 3.5vw, 2.6rem); font-weight: 900; line-height: 1.2; margin-bottom: 12px; color: var(--text-main); }
    .section-subtitle { font-size: 1.05rem; color: var(--text-muted); max-width: 640px; margin-bottom: 38px; }
    .process-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 24px; }
    .process-card {
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 22px;
      padding: 32px 24px;
      box-shadow: var(--shadow-sm);
      position: relative;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .process-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); }
    .step-num {
      font-size: 2.4rem;
      font-weight: 900;
      color: var(--primary-accent);
      opacity: 0.85;
      line-height: 1;
      margin-bottom: 16px;
      font-feature-settings: "tnum";
    }
    .process-card h3 { font-size: 1.18rem; font-weight: 800; margin-bottom: 10px; color: var(--text-main); }
    .process-card p { font-size: 0.92rem; color: var(--text-muted); line-height: 1.55; }

    /* Sección Preguntas Frecuentes FAQ */
    .faq-section { max-width: 1240px; margin: 80px auto; padding: 0 24px; }
    .faq-container { display: flex; flex-direction: column; gap: 14px; margin-top: 30px; }
    .faq-card {
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 18px;
      padding: 20px 24px;
      transition: border-color 0.2s;
    }
    .faq-card[open] { border-color: var(--primary-accent); box-shadow: var(--shadow-sm); }
    .faq-question {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-main);
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      user-select: none;
      list-style: none;
    }
    .faq-question::-webkit-details-marker { display: none; }
    .faq-icon {
      font-size: 1.3rem;
      color: var(--primary-accent);
      font-weight: 800;
      transition: transform 0.2s;
    }
    .faq-card[open] .faq-icon { transform: rotate(45deg); }
    .faq-answer {
      padding-top: 14px;
      color: var(--text-muted);
      font-size: 0.94rem;
      line-height: 1.6;
      border-top: 1px solid rgba(226, 232, 240, 0.6);
      margin-top: 12px;
    }
    .cta-banner {
      max-width: 1240px;
      margin: 70px auto;
      padding: 50px 32px;
      background: var(--primary-gradient);
      border-radius: 28px;
      color: white;
      text-align: center;
      box-shadow: var(--shadow-lg);
    }
    .footer { background: var(--primary); color: #cbd5e1; padding: 45px 24px; text-align: center; font-size: 0.88rem; }
  </style>
</head>
<body>
  <div class="topbar">
    <div>⭐ ${leadRating} en Google Maps • Especialistas en ${leadAddress}</div>
    <div>Atención directa: <a href="tel:${leadPhone}">${leadPhone}</a></div>
  </div>

  <header class="navbar">
    <div class="logo-container">
      ${catImages.logo ? `
        <img src="${catImages.logo}" referrerpolicy="no-referrer" onerror="this.style.display='none'; var f=this.nextElementSibling; if(f) f.style.display='inline-block';" alt="${leadName}" class="logo-img">
        <span class="logo-text" style="display: none;">${leadName}</span>
      ` : `
        <span class="logo-text">${leadName}</span>
      `}
    </div>
    <ul class="nav-links">
      <li><a href="#solucion">La Propuesta</a></li>
      <li><a href="#servicios">Especialidades</a></li>
      <li><a href="#proceso">Cómo Trabajamos</a></li>
      <li><a href="#faq">Preguntas Frecuentes</a></li>
      <li><a href="#contacto">Contacto</a></li>
    </ul>
    <a href="tel:${leadPhone}" class="nav-cta">Pedir Cita Online</a>
  </header>

  <main>
    <section class="hero">
      <div>
        <div class="vanguard-pill">
          <span class="pulse-dot"></span> Rediseño Oficial con Identidad de Marca · ${leadAddress}
        </div>
        <h1 class="hero-title">
          La máxima excelencia y confianza para los clientes de <span>${leadName}</span>
        </h1>
        <p class="hero-p">
          Una presencia digital concebida para transmitir autoridad instantánea, adaptada fielmente al logotipo oficial y la línea de color de tu empresa, con dirección de arte y recursos visuales de alta definición generados por Google AI.
        </p>
        <div class="persona-tabs">
          <div class="persona-tab active">🏢 Soluciones Profesionales</div>
          <div class="persona-tab">👤 Clientes Particulares</div>
          <div class="persona-tab">⚡ Trámites Urgentes</div>
        </div>
        <div class="hero-actions">
          <a href="tel:${leadPhone}" class="btn-primary">📞 Contactar Ahora ➔</a>
          <a href="https://wa.me/?text=Hola%20${encodeURIComponent(leadName)}" class="btn-whatsapp">💬 WhatsApp Inmediato</a>
        </div>
      </div>

      <div class="hero-visual-wrapper">
        <img src="${catImages.hero}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${fallbackCat.hero}';" alt="${leadName}" class="hero-img-main">
        <div class="floating-card card-top">
          <div style="font-size: 1.4rem;">⭐</div>
          <div>
            <div style="font-weight: 800; font-size: 0.95rem;">${leadRating} / 5.0</div>
            <div style="font-size: 0.75rem; color: #64748b;">Google Verified Reviews</div>
          </div>
        </div>
        <div class="floating-card card-bottom">
          <div style="font-size: 1.4rem;">⚡</div>
          <div>
            <div style="font-weight: 800; font-size: 0.95rem; color: ${brandPalette.accent};">Carga en 0.8s</div>
            <div style="font-size: 0.75rem; color: #64748b;">100% Core Web Vitals</div>
          </div>
        </div>
      </div>
    </section>

    <div class="trust-strip">
      <div>🔒 Confidencialidad y Rigor</div>
      <div>⚡ Respuesta en menos de 24 horas</div>
      <div>📍 Sede en ${leadAddress}</div>
      <div>💎 Atención Directa</div>
    </div>

    <section id="solucion" class="bento-section">
      <div class="bento-grid">
        <div class="bento-card">
          <div class="bento-metric">0.8s</div>
          <h3 style="font-size: 1.35rem; font-weight: 800; margin-bottom: 8px;">Experiencia Móvil Ultra Fluida</h3>
          <p style="color: var(--text-muted);">Eliminamos la lentitud y fugas de clientes de la web anterior con navegación optimizada para llamadas y WhatsApp.</p>
        </div>
        <div class="bento-card">
          <div class="bento-metric">+99%</div>
          <h3 style="font-size: 1.35rem; font-weight: 800; margin-bottom: 8px;">Efectividad y Casos Resueltos</h3>
          <p style="color: var(--text-muted);">Acompañamiento cercano y profesional adaptado a las necesidades de tu sector.</p>
        </div>
      </div>
    </section>

    <section id="servicios" class="bento-section">
      <h2 style="font-size: 2rem; font-weight: 800; margin-bottom: 24px;">Servicios Destacados</h2>
      <div class="services-grid">
        <div class="service-card">
          <img src="${catImages.service1}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${fallbackCat.service1}';" alt="Servicio 1" class="service-img">
          <div class="service-content">
            <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 8px;">Asesoramiento Estratégico</h3>
            <p style="color: var(--text-muted); font-size: 0.92rem;">Atención especializada para empresas y particulares en ${leadAddress}.</p>
          </div>
        </div>
        <div class="service-card">
          <img src="${catImages.service2}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${fallbackCat.service2}';" alt="Servicio 2" class="service-img">
          <div class="service-content">
            <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 8px;">Gestión Operativa Integral</h3>
            <p style="color: var(--text-muted); font-size: 0.92rem;">Resolución ágil de expedientes y trámites con total transparencia.</p>
          </div>
        </div>
        <div class="service-card">
          <img src="${catImages.service3}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${fallbackCat.service3}';" alt="Servicio 3" class="service-img">
          <div class="service-content">
            <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 8px;">Atención al Cliente Exclusiva</h3>
            <p style="color: var(--text-muted); font-size: 0.92rem;">Canal directo para resolver dudas en tiempo récord.</p>
          </div>
        </div>
      </div>
    </section>

    <section id="proceso" class="process-section">
      <span class="section-badge">Metodología Ágil</span>
      <h2 class="section-title">Tu proyecto en 4 sencillos pasos</h2>
      <p class="section-subtitle">Un proceso claro, transparente y sin complicaciones desde el primer contacto con ${leadName}.</p>
      <div class="process-grid">
        <div class="process-card">
          <div class="step-num">01</div>
          <h3>Estudio Previo y Diagnóstico</h3>
          <p>Evaluamos tus requerimientos específicos en ${leadAddress} y elaboramos una propuesta técnica y económica personalizada sin compromiso.</p>
        </div>
        <div class="process-card">
          <div class="step-num">02</div>
          <h3>Planificación y Trámites</h3>
          <p>Gestionamos licencias, autorizaciones técnicas y subvenciones disponibles para que no tengas que preocuparte de nada.</p>
        </div>
        <div class="process-card">
          <div class="step-num">03</div>
          <h3>Ejecución de Alta Precisión</h3>
          <p>Instalación o servicio realizado por técnicos cualificados con materiales de primera calidad en los plazos convenidos.</p>
        </div>
        <div class="process-card">
          <div class="step-num">04</div>
          <h3>Puesta a Punto y Garantía</h3>
          <p>Comprobación rigurosa de funcionamiento, entrega formal y soporte continuo con garantía oficial respaldada.</p>
        </div>
      </div>
    </section>

    <section id="faq" class="faq-section">
      <span class="section-badge">Resolución de Dudas</span>
      <h2 class="section-title">Preguntas Frecuentes</h2>
      <p class="section-subtitle">Todo lo que necesitas saber antes de comenzar con ${leadName}.</p>
      <div class="faq-container">
        <details class="faq-card" open>
          <summary class="faq-question">
            <span>¿Cuánto tiempo toma la realización del trabajo o instalación?</span>
            <span class="faq-icon">+</span>
          </summary>
          <div class="faq-answer">
            <p>Los plazos habituales de respuesta y estudio técnico son de 24 a 48 horas. La ejecución se coordina de forma ágil adaptándonos a tus horarios para evitar cualquier interrupción en tu rutina o negocio.</p>
          </div>
        </details>
        <details class="faq-card">
          <summary class="faq-question">
            <span>¿Gestionáis las subvenciones, licencias o bonificaciones fiscales?</span>
            <span class="faq-icon">+</span>
          </summary>
          <div class="faq-answer">
            <p>Sí, tramitamos íntegramente la documentación requerida para bonificaciones locales, deducciones y ayudas autonómicas y europeas aplicables en ${leadAddress} para que obtengas el máximo beneficio.</p>
          </div>
        </details>
        <details class="faq-card">
          <summary class="faq-question">
            <span>¿Qué garantías y soporte técnico se ofrecen?</span>
            <span class="faq-icon">+</span>
          </summary>
          <div class="faq-answer">
            <p>Todos nuestros proyectos cuentan con garantía oficial por escrito tanto en componentes como en mano de obra, además de un canal de soporte telefónico directo para cualquier consulta posterior.</p>
          </div>
        </details>
        <details class="faq-card">
          <summary class="faq-question">
            <span>¿Tiene algún coste o compromiso solicitar un estudio inicial?</span>
            <span class="faq-icon">+</span>
          </summary>
          <div class="faq-answer">
            <p>No, la consulta inicial, valoración de viabilidad y presupuesto son totalmente gratuitos y sin ningún tipo de compromiso.</p>
          </div>
        </details>
      </div>
    </section>

    <div id="contacto" class="cta-banner">
      <h2 style="font-size: 2.2rem; font-weight: 900; margin-bottom: 12px;">Comienza hoy con ${leadName}</h2>
      <p style="margin-bottom: 24px; font-size: 1.1rem; opacity: 0.9;">Contacta directamente para solicitar más información o pedir tu cita.</p>
      <a href="tel:${leadPhone}" style="background: white; color: var(--primary); padding: 14px 30px; border-radius: 12px; font-weight: 800; text-decoration: none;">📞 Llamar al ${leadPhone}</a>
    </div>
  </main>

  <footer class="footer">
    <p><strong>${leadName}</strong> · ${leadAddress} · Teléfono: ${leadPhone}</p>
    <p style="margin-top: 8px; font-size: 0.8rem; opacity: 0.7;">Rediseño basado en la identidad de marca de ${websiteUrl}</p>
  </footer>
</body>
</html>
`.trim();
}

class GoogleStitchWorkflow extends BaseWorkflowType {
  typeIdentifier = 'google_stitch_designer';

  async execute(context: WorkflowContext): Promise<any> {
    context.log('🎨 Iniciando Motor de Vanguardia Digital con Modelos Multi-Arquetipo (Pinterest/Dribbble)...');

    // 1. Validar credencial
    const stitchApiKey = context.credentials['google_stitch_api_key'];
    if (!stitchApiKey) {
      throw new Error('Falta la credencial de Google Stitch (google_stitch_api_key). Por favor regístrala en las credenciales del workflow.');
    }

    // 2. Obtener config
    const config = context.workflow.config as any;
    const sourceWorkflowId = config?.sourceWorkflowId;
    const designStyle = config?.designStyle || 'vanguard_pinterest_award';
    const batchLimit = parseInt(config?.batchLimit || '5', 10);

    if (!sourceWorkflowId) {
      throw new Error('No se ha configurado la fuente de leads (Campaña de Google Maps).');
    }

    // 3. Buscar workflow fuente para saber su projectId (con fallback inteligente)
    let sourceWorkflow = sourceWorkflowId ? await prisma.userWorkflow.findUnique({ where: { id: sourceWorkflowId } }) : null;
    if (!sourceWorkflow || !sourceWorkflow.projectId) {
      const fallbackWorkflow = await prisma.userWorkflow.findFirst({
        where: {
          userId: context.workflow.userId,
          template: { typeIdentifier: 'lead_collector' },
          projectId: { not: null }
        }
      });
      if (fallbackWorkflow) {
        sourceWorkflow = fallbackWorkflow;
        context.log('Aviso: Vinculado automáticamente con el Recolector de Leads activo');
      } else if (context.workflow.projectId) {
        sourceWorkflow = context.workflow;
      } else {
        throw new Error('El workflow fuente no existe o no está asignado a un proyecto válido.');
      }
    }

    // 4. Buscar leads del proyecto que tengan análisis/auditoría obligatoriamente
    const candidateLeads = await prisma.lead.findMany({
      where: {
        projectId: sourceWorkflow.projectId as string,
        metadata: { not: Prisma.JsonNull }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // Filtrar: DEBEN tener auditoría (aiAuditReport o capturas) Y no tener maqueta aún
    const leadsToProcess = candidateLeads.filter(lead => {
      const meta = (typeof lead.metadata === 'object' && lead.metadata) ? (lead.metadata as any) : {};
      const hasAnalysis = !!(meta.aiAuditReport || (meta.technicalAnalysis?.screenshots && meta.technicalAnalysis.screenshots.length > 0));
      const hasMockup = !!(meta.creativeAssets?.mockup?.previewHtml || meta.creativeAssets?.mockup?.previewImageUrl || meta.generatedMockup);
      return hasAnalysis && !hasMockup;
    }).slice(0, batchLimit);

    if (leadsToProcess.length === 0) {
      context.log('ℹ️ Todos los leads de este proyecto ya cuentan con maqueta generada o no hay leads disponibles.');
      return { message: '0 maquetas necesarias', processed: 0 };
    }

    context.log(`Se procesarán ${leadsToProcess.length} leads con arquetipos de diseño únicos (Pinterest/Awwwards).`);

    let processedCount = 0;

    // Modelos activos de Gemini con fallback en cascada para evitar 429
    const activeModels = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-flash-lite-latest'];

    for (const lead of leadsToProcess) {
      const leadName = lead.businessName || lead.contactName || 'Empresa';
      context.log(`📐 Diseñando maqueta de alta costura digital para: "${leadName}"...`);

      const meta = (typeof lead.metadata === 'object' && lead.metadata) ? (lead.metadata as any) : {};
      const techAnalysis = meta.technicalAnalysis || {};
      const aiAudit = meta.aiAuditReport || {};

      const errorsSummary = [
        ...(aiAudit.technicalErrors || []),
        ...(aiAudit.visualErrors || [])
      ].slice(0, 5).join('; ');

      const websiteUrl = lead.website || (techAnalysis as any).url || 'No disponible';
      const leadPhone = lead.phone || 'Teléfono no disponible';
      const leadAddress = (lead as any).address || (meta as any).address || 'España';
      const leadRating = (lead as any).rating || meta?.rating || 4.9;

      // 1. Extraer marca, imágenes reales y definir arquetipo de diseño
      const brandAssets = await extractBrandAssets(websiteUrl, leadName, lead.id, (lead as any).notes || '', meta);
      const brandPalette = brandAssets.palette;
      const catImages = brandAssets.images;
      const fallbackCat = brandAssets.fallbackImages;
      const archetype = brandAssets.layoutArchetype;
      const clientScreenshot = techAnalysis.screenshots?.[0]?.url || techAnalysis.screenshotUrl || null;

      context.log(`🎨 Paleta corporativa real: ${brandPalette.name} (Primario: ${brandPalette.primary}, Acento: ${brandPalette.accent}). Arquetipo: ${archetype}.`);
      context.log(`📸 Identidad visual: Logo oficial del cliente: ${catImages.logo ? 'Detectado y verificado' : 'Fallback tipográfico estilizado'}. Fotografías y recursos visuales: Generados en alta resolución por Google AI.`);

      let generatedHtml = '';
      let generatedCss = '';
      let stitchProjectId = '';
      let systemPrompt = '';

      // Definir especificaciones arquitectónicas profundas según el arquetipo de Pinterest / Dribbble
      let archetypePrompt = '';
      if (archetype === 'bento_tech') {
        archetypePrompt = `
👑 ARQUETIPO OBLIGATORIO: "BENTO GRID VANGUARD TECH" (Tendencia Pinterest & Apple/Linear UI 2026)
- COMPOSICIÓN DEL HERO (¡PROHIBIDO EL TÍPICO 2-COLUMNAS TEXTO/IMAGEN!):
  * El Hero DEBE ser un BENTO GRID MODULAR ASIMÉTRICO de 3 o 4 cuadrantes acoplados en CSS Grid (display: grid; grid-template-columns: 1.35fr 1fr; gap: 20px;):
    1. Cuadrante Principal (Grande, ocupa 2 filas): Gran titular tipográfico Grotesk, badge de innovación con punto pulsante, selector de servicios y botón CTA con efecto glass y glow.
    2. Cuadrante Visual: Fotografía de alta definición (${catImages.hero}) enmarcada en tarjeta bento con glassmorphism, indicador de estado e insignia.
    3. Cuadrante Métrico: Métrica gigante (${leadRating} ★ o +90% Eficiencia) con micro-gráfico SVG de barras o línea de tendencia en color ${brandPalette.accent}.
    4. Cuadrante Confianza: Reseñas verificadas con avatares solapados y garantía en ${leadAddress}.
- COMPOSICIÓN DE SECCIONES:
  1. Navbar tecnológico flotante con logo y enlaces (#solucion, #servicios, #proceso, #faq, #contacto).
  2. Hero Bento Grid Modular Asimétrico.
  3. Trust Strip con métricas e insignias.
  4. Bento Grid de Servicios (1 tarjeta ancha destacada con imagen + 2 tarjetas compactas).
  5. Stepper Tecnológico de Proceso (01, 02, 03, 04 conectados con línea SVG de progreso).
  6. FAQ Bento Acordeón interactivo (<details class="faq-card"><summary>...).
  7. Banner CTA Final con gradiente y llamada directa a ${leadPhone}.
  8. Footer tecnológico.
- TIPOGRAFÍA: Google Fonts 'Plus Jakarta Sans' (800 y 900 para títulos, 400 y 500 para textos).
- COLORES: Usa estrictamente ${brandPalette.primary} como color rector y ${brandPalette.accent} para botones, acentos y resplandores.`;
      } else if (archetype === 'editorial_magazine') {
        archetypePrompt = `
👑 ARQUETIPO OBLIGATORIO: "EDITORIAL HIGH-FASHION & SWISS MODERN" (Tendencia Pinterest Awwwards & Kinfolk)
- COMPOSICIÓN DEL HERO (¡PROHIBIDO EL TÍPICO 2-COLUMNAS TEXTO/IMAGEN!):
  * Hero Centralizado y Escultórico de Alta Costura:
    1. Encabezado Monumental Centrado combinando tipografía Serif de lujo ('Playfair Display' o 'Cinzel') con Sans-serif geométrica para subtítulos.
    2. Cinta Marquee Ticker Animada horizontal a todo el ancho (infinite scroll continuo con CSS @keyframes) con conceptos clave ("EXCELENCIA · SERVICIO OFICIAL · ${leadAddress.toUpperCase()} · MÁXIMA GARANTÍA").
    3. Fotografía Hero Central (${catImages.hero}) con máscara arquitectónica en arco (border-radius: 200px 200px 24px 24px), flanqueada por un sello circular de certificación en SVG y una cita de autoridad.
    4. Botones duales de acción centrados con elegancia editorial.
- COMPOSICIÓN DE SECCIONES:
  1. Navbar Editorial minimalista con logo, enlaces estilizados y botón tipo cápsula.
  2. Hero Escultórico con Titular Monumental, Marquee Ticker y Fotografía en Arco.
  3. Declaración de Marca con tipografía de gran formato y espaciado generoso.
  4. Servicios en Formato Revista (lista numerada 01., 02., 03. con imágenes intercaladas y descripciones de autor).
  5. Proceso Editorial en 4 Pasos (línea de tiempo limpia y minimalista).
  6. Preguntas Frecuentes estilo editorial con separadores de línea fina y signos elegantes.
  7. Banner de Cierre con tipografía serif y contacto directo a ${leadPhone}.
  8. Footer editorial sofisticado.
- TIPOGRAFÍA: Google Fonts 'Playfair Display' para títulos y 'Inter' para cuerpo.
- COLORES: Integra con maestría ${brandPalette.primary} en la tipografía y detalles, y ${brandPalette.accent} en los botones de acción y sellos.`;
      } else if (archetype === 'luxury_dark_split') {
        archetypePrompt = `
👑 ARQUETIPO OBLIGATORIO: "LUXURY DARK & AMBIENT NEON GLOW" (Tendencia Pinterest Dark Mode de Alto Standing)
- COMPOSICIÓN DEL HERO (¡PROHIBIDO EL TÍPICO 2-COLUMNAS TEXTO/IMAGEN!):
  * Atmósfera Inmersiva Dark de Máxima Sofisticación:
    1. Fondo Dark Profundo (#090d16 o #0b0f19) con auras de iluminación ambiental difusa (radial-gradient con ${brandPalette.primary} y ${brandPalette.accent} al 18% de opacidad).
    2. Titular con texto degradado luminoso (background: linear-gradient(135deg, #ffffff 0%, ${brandPalette.accent} 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;).
    3. Tarjeta de imagen Hero (${catImages.hero}) con Glassmorphism Neón (backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 0 60px ${brandPalette.accent}33; border-radius: 28px;).
    4. Botones CTA con resplandor neón/luminoso (box-shadow: 0 0 25px ${brandPalette.accent}66;).
- COMPOSICIÓN DE SECCIONES:
  1. Navbar Dark Glass translúcido con desenfoque de fondo y logo iluminado.
  2. Hero Dark Inmersivo con resplandores ambientales y tarjeta holográfica.
  3. Trust Strip oscuro con métricas brillantes de alto contraste.
  4. Tarjetas Bento Dark para la propuesta de valor con bordes luminosos al hover.
  5. Servicios Destacados con tarjetas oscuras de cristal y fotografías iluminadas.
  6. Metodología en 4 Pasos conectada con línea de luz neón.
  7. FAQ Acordeón Dark con bordes activos iluminados al expandirse.
  8. Gran Banner CTA Nocturno de máxima conversión.
  9. Footer Dark de alta gama.
- TIPOGRAFÍA: Google Fonts 'Outfit' o 'Syne' + 'Inter'.
- COLORES: Fondo oscuro de contraste, ${brandPalette.primary} y ${brandPalette.accent} como focos de luz y acción.`;
      } else {
        archetypePrompt = `
👑 ARQUETIPO OBLIGATORIO: "PANORAMIC IMMERSIVE SHOWCASE & KINETIC MINIMAL" (Tendencia Dribbble Studio & Stripe/Vercel)
- COMPOSICIÓN DEL HERO (¡PROHIBIDO EL TÍPICO 2-COLUMNAS TEXTO/IMAGEN!):
  * Gran Escaparate Panorámico Inmersivo a Pantalla Completa:
    1. Cabecera monumental centrada: Badge flotante interactivo con categoría y localidad (${leadAddress}).
    2. Gran Titular panorámico a todo el ancho (font-size: clamp(2.4rem, 5vw, 4.2rem); max-width: 950px; margin: 0 auto; text-align: center;).
    3. Subtítulo centrado de alta conversión y botones CTA en cápsula dual con micro-animaciones.
    4. Directamente debajo: Gran ESCAPARATE PANORÁMICO FLOTANTE (Showcase tipo ventana con marco de diseño, borde sutil y sombra 3D) conteniendo la fotografía de alta definición (${catImages.hero}), con 2 tarjetas de confianza flotantes en los extremos opuestos.
- COMPOSICIÓN DE SECCIONES:
  1. Navbar minimalista tipo cápsula flotante centrada con logo y enlaces.
  2. Hero Escaparate Panorámico Inmersivo.
  3. Ticker interactivo de confianza con ⭐ ${leadRating} y garantías oficiales.
  4. Soluciones con cuadrícula de alta precisión geométrica (tarjetas con bordes nítidos de 1.5px).
  5. Servicios Especializados con fotografías en alta definición y badges de especialidad.
  6. Proceso en 4 Pasos en disposición de tarjetas apiladas con sombras de elevación.
  7. FAQ Acordeón limpio y moderno (<details class="faq-card"><summary>...).
  8. Banner CTA Final con contraste audaz y botones de contacto inmediato.
  9. Footer minimalista y estructurado.
- TIPOGRAFÍA: Google Fonts 'Plus Jakarta Sans' + 'Inter'.
- COLORES: Blanco nítido o marfil con acentos enérgicos en ${brandPalette.primary} y ${brandPalette.accent}.`;
      }

      // Prompt para Gemini
      systemPrompt = `Eres un Director de Arte y Diseñador Web de Élite galardonado en Awwwards, Pinterest UI Trends y Dribbble.
Tu misión es diseñar un REDISEÑO WEB DE ALTÍSIMA GAMA, TOTALMENTE A LA VANGUARDIA DIGITAL para "${leadName}".

${archetypePrompt}

LÍNEA DE COLOR CORPORATIVA REAL (EXTRAÍDA DE SU WEB ORIGINAL "${websiteUrl}"):
- Color Primario Corporativo: ${brandPalette.primary}
- Color de Acento / Botones de Acción: ${brandPalette.accent}
- Color de Fondo: ${brandPalette.background}
- Color de Superficies y Tarjetas: ${brandPalette.surface}
- Color de Texto: ${brandPalette.textColor}

¡REGLA SUPREMA DE COLOR!:
Es ESTRICTO Y OBLIGATORIO usar esta paleta corporativa real en todo el diseño.
Define en :root:
  --primary: ${brandPalette.primary};
  --primary-accent: ${brandPalette.accent};
  --bg: ${brandPalette.background};
  --bg-surface: ${brandPalette.surface};
  --text-main: ${brandPalette.textColor};
Aplica ${brandPalette.primary} como color corporativo rector.
Aplica ${brandPalette.accent} a los botones de acción (CTA), badges y llamadas a la acción.
PROHIBIDO cambiar estos colores por paletas genéricas. La empresa "${leadName}" debe reconocer inmediatamente sus colores.

REGLAS TÉCNICAS ESTRICTAS (CERO ELEMENTOS CORTADOS Y CERO IMÁGENES ROTAS):
1. ¡CERO ELEMENTOS CORTADOS!:
   - NUNCA uses "height: 100vh", "height: 100%", o alturas fijas en px en secciones, hero o tarjetas. Usa SIEMPRE "min-height: auto" o "min-height" con espaciado generoso (padding: 60px 24px) para que TODO el contenido quepa holgadamente.
   - NUNCA uses "overflow: hidden" en contenedores que tengan tarjetas flotantes o elementos absolutos.
   - Incluye siempre "box-sizing: border-box" universalmente (*, *::before, *::after).
   - En títulos y párrafos, incluye "overflow-wrap: break-word" y "word-break: break-word".
   - Contenedores de botones o enlaces de navegación deben tener "flex-wrap: wrap" y "gap" adecuado.
2. ¡IMÁGENES Y RECURSOS VISUALES: COHERENCIA SECTORIAL ESTRICTA Y SÓLO LOGO DEL CLIENTE!:
   - ¡PROHIBIDO PONER IMÁGENES GENÉRICAS O DESCONTEXTUALIZADAS!: La empresa es "${leadName}" y opera en el sector de "${leadAddress}". Si es de energía solar, fotovoltaica, reformas, automoción, etc., el diseño DEBE respirar ese sector al 100%. NUNCA coloques edificios o rascacielos de oficinas si el cliente se dedica a paneles solares, comercio o servicios domésticos.
   - ¡PROHIBIDO USAR FOTOGRAFÍAS DE LA WEB DEL CLIENTE!: Utiliza ÚNICAMENTE su logotipo oficial para identificar su marca.
   - LOGOTIPO OFICIAL DEL CLIENTE:
     ${catImages.logo ? 
       `<div class="logo-wrap"><img src="${catImages.logo}" referrerpolicy="no-referrer" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline-block';" alt="${leadName}" style="max-height: 44px; object-fit: contain;"><span class="logo-text" style="display:none; font-weight:800; font-size:1.35rem; color:${brandPalette.primary};">${leadName}</span></div>` 
       : `<span class="logo-text" style="font-weight:800; font-size:1.35rem; color:${brandPalette.primary};">${leadName}</span>`}
   - FOTOGRAFÍAS Y RECURSOS VISUALES DE ALTA DEFINICIÓN GENERADOS POR GOOGLE AI:
     * Para fotografía de alta definición en Hero y Servicios, utiliza EXCLUSIVAMENTE estas fuentes verificadas en alta resolución (1200px / 600px):
       - Hero Principal (adaptada al sector de ${leadName}): <img src="${catImages.hero}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${fallbackCat.hero}';" alt="${leadName}">
       - Servicio 1: <img src="${catImages.service1}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${fallbackCat.service1}';" alt="Servicio 1">
       - Servicio 2: <img src="${catImages.service2}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${fallbackCat.service2}';" alt="Servicio 2">
       - Servicio 3: <img src="${catImages.service3}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${fallbackCat.service3}';" alt="Servicio 3">
       - Testimonios/Avatares: <img src="${catImages.avatar1}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${fallbackCat.avatar1}';" alt="Cliente">
     * RECURSOS VISUALES EN CÓDIGO GENERADOS POR GOOGLE: Puedes crear e incorporar libremente componentes visuales modernos en HTML/SVG (iconos vectoriales SVG nítidos en línea, mini dashboards interactivos, tarjetas bento de métricas, insignias flotantes con calificaciones). ¡Todo debe lucir ultra premium, sin dependencias externas rotas!
3. ¡NAVBAR COMPLETO Y NUNCA VACÍO!:
   - Debe contener:
     (a) El logo del cliente con el fallback tipográfico indicado.
     (b) Menú de enlaces navegables (ej: "Inicio", "Especialidades", "Cómo Trabajamos", "Preguntas Frecuentes", "Contacto").
     (c) Botón de contacto destacado: <a href="tel:${leadPhone}" class="nav-cta">Pedir Cita Online</a>.

DATOS DEL CLIENTE:
- Empresa: "${leadName}"
- Web original: ${websiteUrl}
- Teléfono directo: ${leadPhone}
- Ubicación: ${leadAddress}
- Valoración Google Maps: ⭐ ${leadRating} / 5
- Errores de auditoría resueltos: ${errorsSummary || 'Lentitud y diseño desactualizado.'}

FORMATO:
- Código HTML5 autónomo, completo y responsive con Google Fonts y CSS en etiqueta <style>.
- DEVUELVE EXCLUSIVAMENTE el código dentro de un bloque HTML (con doctype y html) sin introducciones.`;

      // Intentar invocar los modelos de Google AI en cascada
      for (const modelName of activeModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${stitchApiKey}`;
          const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemPrompt }] }]
            })
          });

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            let rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const htmlMatch = rawText.match(/```html([\s\S]*?)```/i);
            if (htmlMatch) {
              generatedHtml = htmlMatch[1].trim();
            } else if (rawText.includes('<html') || rawText.includes('<!DOCTYPE')) {
              generatedHtml = rawText.replace(/^```html?/i, '').replace(/```$/i, '').trim();
            }
            if (generatedHtml) {
              context.log(`✅ Maqueta generada con éxito por Google AI (${modelName}) para ${leadName} (${generatedHtml.length} caracteres).`);
              break;
            }
          } else {
            const errData = await geminiRes.json();
            context.log(`Aviso Google AI (${modelName}) status ${geminiRes.status}: ${errData.error?.message?.substring(0, 80)}`);
          }
        } catch (err: any) {
          context.log(`Error conectando a ${modelName}: ${err.message}`);
        }
      }

      // Fallback de ultra-diseño con NAVBAR COMPLETO y arquetipo enriquecido si todos los modelos se agotan
      if (!generatedHtml) {
        generatedHtml = generateConceptualDesignHtml(leadName, websiteUrl, brandPalette, catImages, fallbackCat, archetype, leadPhone, leadAddress, leadRating);
      }

      // Aplicar guardrails maestros de maquetación y protección de activos
      generatedHtml = sanitizeAndGuardMockupHtml(generatedHtml, leadName, brandPalette, catImages, fallbackCat, websiteUrl);

      let mockupScreenshotUrl = '';
      try {
        context.log(`📸 Generando captura visual de la propuesta Google AI para ${leadName}...`);
        mockupScreenshotUrl = await captureMockupScreenshot(generatedHtml, lead.id);
      } catch (capErr: any) {
        context.log(`Aviso generando captura de maqueta: ${capErr.message}`);
      }

      const mockupData = {
        generatedAt: new Date().toISOString(),
        designStyle,
        status: 'READY',
        title: `Propuesta de Rediseño Web (${archetype}): ${leadName}`,
        previewHtml: generatedHtml,
        previewCss: generatedCss,
        stitchProjectId: stitchProjectId || null,
        promptUsed: systemPrompt,
        brandPalette,
        layoutArchetype: archetype,
        scrapedAssets: {
          hasClientLogo: Boolean(catImages.logo),
          logo: catImages.logo,
          hero: catImages.hero
        },
        previewImageUrl: mockupScreenshotUrl || (techAnalysis.screenshots && techAnalysis.screenshots[0]?.url) || null,
        features: [
          `Identidad cromática extraída de su web original (${brandPalette.primary} / ${brandPalette.accent})`,
          catImages.logo ? 'Logotipo oficial de la empresa integrado' : 'Insignia tipográfica corporativa estilizada',
          'Recursos visuales y fotografía editorial de alta resolución generados por Google AI',
          `Arquetipo de diseño único: ${archetype}`,
          'Navbar completo con navegación y contacto',
          'Hero Section Asimétrico de alto impacto con llamada a la acción y WhatsApp'
        ]
      };

      const updatedMetadata = {
        ...meta,
        mockupHeroImage: catImages.hero,
        mockupScreenshotUrl: mockupScreenshotUrl || null,
        generatedMockup: generatedHtml,
        creativeAssets: {
          ...(meta.creativeAssets || {}),
          mockup: mockupData
        }
      };

      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          metadata: updatedMetadata
        }
      });

      await prisma.activity.create({
        data: {
          leadId: lead.id,
          type: 'MOCKUP_GENERATED',
          title: 'Maqueta Web Generada (Logo Real & Visuales Google AI)',
          description: `Se ha generado una maqueta adaptada a la línea de color (${brandPalette.primary} / ${brandPalette.accent}) y logotipo de ${websiteUrl}, con fotografía de alta definición generada por Google AI para ${leadName}.`
        }
      });

      processedCount++;
      context.log(`✅ Maqueta guardada exitosamente para ${leadName} con su logotipo oficial y recursos de alta definición de Google AI.`);
    }

    context.log(`🎉 Proceso completado. Se generaron ${processedCount} maquetas web con diseño vanguardista, identidad de color real y visuales de alta definición.`);
    return {
      totalCandidates: leadsToProcess.length,
      mockupsGenerated: processedCount
    };
  }
}


class FormContactWorkflow extends BaseWorkflowType {
  typeIdentifier = 'form_contact_handler';

  async execute(context: WorkflowContext): Promise<any> {
    context.log('Iniciando Form Contact Handler...');
    let data = context.inputData;
    
    // Auto-inyectar datos de prueba si es una ejecución manual sin webhook
    if (!data || Object.keys(data).length === 0 || !data.email) {
      context.log('Ejecución manual detectada (sin datos de webhook). Usando datos de prueba (Lead Simulado)...');
      data = {
        name: 'Lead de Prueba',
        email: 'ventas@grupohormesis.com', // Enviamos la prueba al mismo correo para evitar rebotados
        businessName: 'Empresa Test',
        service: 'Sistematización & Workflows', 
        message: 'Este es un correo de prueba de ejecución manual.'
      };
    }

    const gmailAddress = context.credentials['gmail_address'];
    const gmailAppPassword = (context.credentials['gmail_app_password'] || '').replace(/\s+/g, '');

    if (!gmailAddress || !gmailAppPassword) {
      throw new Error('Faltan credenciales de Gmail (gmail_address o gmail_app_password).');
    }

    const config = context.workflow.config as any;

    context.log(`Procesando lead: ${data.name} (${data.email}) - Servicio: ${data.service}`);

    const normalizeStr = (str: string) => 
      (str || '').toString().toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const requestedService = normalizeStr(data.service);
    const templates = config?.generated_responses || {};
    let matchedTemplate: any = null;
    
    for (const [key, template] of Object.entries(templates)) {
      if (normalizeStr(key) === requestedService) {
        matchedTemplate = template;
        break;
      }
    }
    
    // Si no hay coincidencia exacta (o si no se envió servicio), tomar 'default' o la primera disponible
    if (!matchedTemplate) {
      context.log(`No se encontró coincidencia exacta para "${requestedService}". Usando plantilla por defecto.`);
      matchedTemplate = templates['default'] || Object.values(templates)[0];
    }

    if (!matchedTemplate) {
      throw new Error('No hay respuestas pre-generadas configuradas en este workflow. Por favor, generalas desde el panel de control.');
    }

    let clientSubject = matchedTemplate.subject || `[${context.workflow.name}] Tu solicitud`;
    let clientBody = matchedTemplate.body || '';

    // Reemplazar variables tanto en el asunto como en el cuerpo
    const variables = {
      '{{name}}': data.name || '',
      '[Nombre]': data.name || '',
      '{{email}}': data.email || '',
      '{{businessName}}': data.businessName || '',
      '{{service}}': data.service || '',
      '{{message}}': data.message || ''
    };

    for (const [key, value] of Object.entries(variables)) {
      const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      clientSubject = clientSubject.replace(new RegExp(safeKey, 'g'), value as string);
      clientBody = clientBody.replace(new RegExp(safeKey, 'g'), value as string);
    }

    context.log(`Enviando correo con asunto: ${clientSubject}`);

    // Validar entregabilidad del correo antes de enviar auto-respuesta
    if (data.email) {
      const emailValidation = await EmailValidatorService.validateEmail(data.email);
      if (!emailValidation.isValid) {
        context.log(`Aviso: Correo de formulario descartado (${data.email}): ${emailValidation.reason}. Omitiendo envío para evitar rebotes.`);
        return { message: 'Correo de formulario inválido, omitido', reason: emailValidation.reason };
      }
    }

    // Configurar transporte nodemailer con IPv4 forzada
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: gmailAddress,
        pass: gmailAppPassword
      },
      family: 4,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });

    await transporter.sendMail({
      from: `"${context.workflow.name}" <${gmailAddress}>`,
      to: data.email,
      subject: clientSubject,
      text: clientBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      html: clientBody
    });

    // Registrar la actividad en el Lead si existe el leadId
    if (data.leadId) {
      await prisma.activity.create({
        data: {
          leadId: data.leadId,
          type: 'AUTO_EMAIL',
          title: 'Correo automático enviado',
          description: clientBody,
          metadata: { subject: clientSubject }
        }
      });
      context.log(`Actividad AUTO_EMAIL registrada para el lead: ${data.leadId}`);
    }

    context.log('Correo enviado correctamente.');

    return { 
      message: 'Lead procesado exitosamente', 
      leadData: data 
    };
  }
}

// ----------------------------------------------------
// MOTOR DE EJECUCIÃ“N
// ----------------------------------------------------
export class ExecutionEngine {
  private static registeredTypes: BaseWorkflowType[] = [
    new LeadCollectorWorkflow(),
    new FormContactWorkflow(),
    new AutoOutreachGoogleMapsWorkflow(),
    new GoogleStitchWorkflow()
  ];

  static async executeWorkflow(userWorkflowId: string, inputData?: any) {
    console.log(`[ExecutionEngine] 1. Looking up workflow: ${userWorkflowId}`);
    // 1. Cargar el workflow con la plantilla y credenciales
    const workflow = await prisma.userWorkflow.findUnique({
      where: { id: userWorkflowId },
      include: { 
        template: true,
        credentials: true
      }
    });

    console.log(`[ExecutionEngine] 2. Workflow found: ${workflow?.name}, active: ${workflow?.isActive}`);
    if (!workflow) throw new Error('Workflow no encontrado');
    if (!workflow.isActive) throw new Error('El Workflow está inactivo');

    // 2. Buscar el tipo de workflow (la lógica)
    const engineType = this.registeredTypes.find(t => t.typeIdentifier === workflow.template.typeIdentifier);
    console.log(`[ExecutionEngine] 3. EngineType: ${engineType?.typeIdentifier}`);
    if (!engineType) throw new Error(`Tipo de workflow no implementado: ${workflow.template.typeIdentifier}`);

    // 3. Crear registro de ejecución
    console.log(`[ExecutionEngine] 4. Creating workflowExecution record...`);
    const execution = await prisma.workflowExecution.create({
      data: {
        userWorkflowId: workflow.id,
        status: 'running',
        logs: []
      }
    });
    console.log(`[ExecutionEngine] 5. Created execution record: ${execution.id}`);

    const logs: string[] = [];
    const logFn = (msg: string) => {
      console.log(`[ExecutionEngine WF ${userWorkflowId}] ${msg}`);
      logs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    try {
      logFn('Preparando credenciales...');
      // Fetch global credentials for the user as fallback
      const globalCreds = await prisma.credential.findMany({
        where: { userId: workflow.userId }
      });

      const decryptedCreds: Record<string, string> = {};
      
      // Load global credentials first
      for (const cred of globalCreds) {
        decryptedCreds[cred.type] = CredentialService.decrypt(cred.encrypted, cred.iv);
      }
      
      // Override with workflow-specific credentials if they exist
      for (const cred of workflow.credentials) {
        decryptedCreds[cred.type] = CredentialService.decrypt(cred.encrypted, cred.iv);
      }

      // 4. Ejecutar
      logFn('Ejecutando...');
      const context: WorkflowContext = {
        workflow,
        credentials: decryptedCreds,
        log: logFn,
        inputData
      };

      const resultData = await engineType.execute(context);

      logFn('EjecuciÃ³n completada con Ã©xito.');

      // 5. Guardar resultado final
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'success',
          logs: logs as any,
          resultData: resultData as any,
          completedAt: new Date()
        }
      });

      return resultData;
    } catch (error: any) {
      logFn(`ERROR: ${error.message}`);
      
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'error',
          logs: logs as any,
          completedAt: new Date()
        }
      });
      
      throw error;
    }
  }
}


