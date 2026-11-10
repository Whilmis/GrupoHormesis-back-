import { Router } from 'express';
import { getLeadActivities, createLeadActivity, getColaboradorLeads, updateLeadStatus } from '../controllers/lead.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import prisma from '../config/db';
import { extractBrandAssets, generateConceptualDesignHtml, sanitizeAndGuardMockupHtml, getFrontendUrl } from '../services/execution.engine';
import { getDesignTrendKnowledge } from '../services/design-trends.service';

const router = Router();

// RUTA PÚBLICA LIGERA PARA PRE-RELLENAR NOMBRE/CORREO Y RESOLVER CALENDARIO (SIN JWT EN URL)
router.get('/public/:leadId/summary', async (req, res) => {
  try {
    const { leadId } = req.params;
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        businessName: true,
        contactName: true,
        email: true,
        website: true,
        project: {
          select: { userId: true }
        }
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }

    let calendarId: string | null = null;
    if (lead.project?.userId) {
      const userCal = await prisma.calendar.findFirst({
        where: { userId: lead.project.userId },
        select: { id: true }
      });
      calendarId = userCal?.id || null;
    }
    if (!calendarId) {
      const anyCal = await prisma.calendar.findFirst({ select: { id: true } });
      calendarId = anyCal?.id || null;
    }

    return res.json({
      id: lead.id,
      businessName: lead.businessName || lead.contactName || 'Empresa',
      contactName: lead.contactName,
      email: lead.email || '',
      website: lead.website || '',
      calendarId
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error cargando resumen de lead' });
  }
});

// RUTA PÚBLICA PARA VER MAQUETA EN PANTALLA COMPLETA (CERO 404s + TRACKING DE APERTURA)
router.get('/public/:leadId/mockup', async (req, res) => {
  try {
    const { leadId } = req.params;
    const isEmbed = req.query.embed === '1';
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const isBotOrScreenshot = userAgent.includes('headless') || userAgent.includes('puppeteer') || req.query.internal === '1';

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        businessName: true,
        website: true,
        phone: true,
        contactName: true,
        metadata: true,
        project: { select: { userId: true } }
      }
    });

    if (!lead) {
      const queryName = (req.query.name as string) || (req.query.businessName as string);
      const queryWeb = (req.query.web as string) || (req.query.website as string);
      if (queryName || queryWeb) {
        try {
          const leadName = queryName || 'Empresa';
          const website = queryWeb || '';
          const brandAssets = await extractBrandAssets(website, leadName, leadId, '', {});
          const designTrend = getDesignTrendKnowledge(leadName, brandAssets.layoutArchetype);
          const rawHtml = generateConceptualDesignHtml(
            leadName,
            website,
            brandAssets.palette,
            brandAssets.images,
            brandAssets.fallbackImages,
            brandAssets.layoutArchetype,
            (req.query.phone as string) || '',
            'España',
            4.9,
            {},
            designTrend
          );
          const dynamicHtml = sanitizeAndGuardMockupHtml(rawHtml, leadName, brandAssets.palette, brandAssets.images, brandAssets.fallbackImages, website);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.send(dynamicHtml);
        } catch (dynErr: any) {
          console.warn('[Mockup Route] Falló generación dinámica on-the-fly:', dynErr.message);
        }
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Propuesta no disponible | Grupo Hormesis</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
            .card { background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 48px 32px; max-width: 520px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); }
            .badge { display: inline-block; background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; padding: 6px 14px; border-radius: 9999px; margin-bottom: 20px; border: 1px solid rgba(52, 211, 153, 0.3); }
            h1 { font-size: 24px; font-weight: 700; margin-bottom: 14px; color: #ffffff; letter-spacing: -0.5px; }
            p { font-size: 15px; color: #94a3b8; line-height: 1.6; margin-bottom: 28px; }
            .btn { display: inline-block; background: #10b981; color: #ffffff; padding: 13px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4); transition: all 0.2s; }
            .btn:hover { background: #059669; transform: translateY(-1px); }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">Grupo Hormesis</span>
            <h1>Propuesta en Actualización o No Disponible</h1>
            <p>La propuesta solicitada ha sido archivada o se encuentra en proceso de actualización técnica. Si deseas explorar una solución personalizada para tu negocio o agendar una sesión, puedes contactarnos directamente.</p>
            <a href="https://grupohormesis.es" class="btn">Conocer más sobre Grupo Hormesis</a>
          </div>
        </body>
        </html>
      `);
    }

    // Registrar actividad en el CRM cuando el cliente real abre su propuesta
    if (!isBotOrScreenshot) {
      try {
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
        const recentView = await prisma.activity.findFirst({
          where: {
            leadId: lead.id,
            type: 'MOCKUP_VIEWED',
            createdAt: { gte: tenMinAgo }
          }
        });
        if (!recentView) {
          await prisma.activity.create({
            data: {
              leadId: lead.id,
              type: 'MOCKUP_VIEWED',
              title: '👁️ El cliente abrió la propuesta de diseño',
              description: `El prospecto visualizó la maqueta interactiva de ${lead.businessName || 'su empresa'}.`
            }
          });
        }
      } catch (actErr) {
        // No bloquear renderizado si falla el log de actividad
      }
    }

    const meta = typeof lead.metadata === 'string' ? JSON.parse(lead.metadata) : (lead.metadata || {});
    let html = meta.generatedMockup || meta.creativeAssets?.mockup?.previewHtml;

    const leadName = lead.businessName || lead.contactName || 'Empresa';
    const brandAssets = await extractBrandAssets(lead.website || '', leadName, lead.id, '', meta);

    if (!html) {
      try {
        const designTrend = getDesignTrendKnowledge((lead as any).notes || meta?.niche || meta?.category || leadName, brandAssets.layoutArchetype);
        const rawHtml = generateConceptualDesignHtml(
          leadName,
          lead.website || '',
          brandAssets.palette,
          brandAssets.images,
          brandAssets.fallbackImages,
          brandAssets.layoutArchetype,
          lead.phone || (meta as any).phone || '',
          (meta as any).address || 'España',
          (meta as any).rating || 4.9,
          meta,
          designTrend
        );
        html = sanitizeAndGuardMockupHtml(rawHtml, leadName, brandAssets.palette, brandAssets.images, brandAssets.fallbackImages, lead.website || '');
        meta.generatedMockup = html;
        meta.mockupHeroImage = brandAssets.images.hero;
        await prisma.lead.update({
          where: { id: lead.id },
          data: { metadata: meta }
        });
      } catch (genErr: any) {
        return res.status(500).send('Error generando maqueta: ' + genErr.message);
      }
    } else {
      // Asegurar que cualquier HTML previamente guardado pase por los nuevos guardrails anti-desbordamiento y contraste
      html = sanitizeAndGuardMockupHtml(html, leadName, brandAssets.palette, brandAssets.images, brandAssets.fallbackImages, lead.website || '');
    }

    // Si el cliente accede directamente sin el iframe de PublicProposal, inyectar barra flotante de conversión con botón de Agendar Reunión
    if (!isEmbed && !isBotOrScreenshot) {
      let calendarId: string | null = null;
      if (lead.project?.userId) {
        const cal = await prisma.calendar.findFirst({ where: { userId: lead.project.userId }, select: { id: true } });
        calendarId = cal?.id || null;
      }
      if (!calendarId) {
        const anyCal = await prisma.calendar.findFirst({ select: { id: true } });
        calendarId = anyCal?.id || null;
      }
      const frontendUrl = getFrontendUrl();
      const bookingUrl = calendarId
        ? `${frontendUrl}/book/${calendarId}?ref=${lead.id}`
        : `${frontendUrl}/contacto`;

      const conversionBarHtml = `
      <div id="hormesis-conversion-bar" style="position:fixed; bottom:18px; left:50%; transform:translateX(-50%); background:rgba(15,23,42,0.96); backdrop-filter:blur(14px); color:#ffffff; padding:12px 20px; border-radius:9999px; box-shadow:0 20px 40px rgba(0,0,0,0.45); border:1px solid rgba(16,185,129,0.4); z-index:99999; display:flex; align-items:center; gap:16px; font-family:system-ui,-apple-system,sans-serif; max-width:94vw; flex-wrap:wrap; justify-content:center;">
        <div style="display:flex; align-items:center; gap:8px; font-size:13px;">
          <span style="background:rgba(16,185,129,0.2); color:#34d399; padding:3px 10px; border-radius:9999px; font-weight:700; font-size:11px; text-transform:uppercase;">Grupo Hormesis</span>
          <span style="color:#e2e8f0; font-weight:600;">¿Te gusta esta línea de diseño para <strong>${leadName}</strong>?</span>
        </div>
        <a href="${bookingUrl}" target="_blank" rel="noopener noreferrer" style="background:#10b981; color:#ffffff; padding:9px 20px; border-radius:9999px; font-weight:700; font-size:13px; text-decoration:none; box-shadow:0 4px 14px rgba(16,185,129,0.4); white-space:nowrap;">
          📅 Agendar Reunión (15 min)
        </a>
      </div>`;

      if (html.includes('</body>')) {
        html = html.replace('</body>', `${conversionBarHtml}\n</body>`);
      } else {
        html += conversionBarHtml;
      }
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err: any) {
    return res.status(500).send('Error cargando maqueta: ' + err.message);
  }
});

router.use(requireAuth);

router.get('/', getColaboradorLeads);
router.put('/:leadId/status', updateLeadStatus);

router.get('/:leadId/activities', getLeadActivities);
router.post('/:leadId/activities', createLeadActivity);

export default router;
