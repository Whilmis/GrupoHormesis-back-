import { Router } from 'express';
import { getLeadActivities, createLeadActivity, getColaboradorLeads, updateLeadStatus } from '../controllers/lead.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { PrismaClient } from '@prisma/client';
import { extractBrandAssets, generateConceptualDesignHtml, sanitizeAndGuardMockupHtml } from '../services/execution.engine';

const prisma = new PrismaClient();
const router = Router();

// RUTA PÚBLICA PARA VER MAQUETA EN PANTALLA COMPLETA (CERO 404s)
router.get('/public/:leadId/mockup', async (req, res) => {
  try {
    const { leadId } = req.params;
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, businessName: true, website: true, phone: true, contactName: true, metadata: true }
    });

    if (!lead) {
      return res.status(404).send('<h1>Propuesta no encontrada</h1>');
    }

    const meta = typeof lead.metadata === 'string' ? JSON.parse(lead.metadata) : (lead.metadata || {});
    let html = meta.generatedMockup || meta.creativeAssets?.mockup?.previewHtml;

    if (!html) {
      try {
        const leadName = lead.businessName || lead.contactName || 'Empresa';
        const brandAssets = await extractBrandAssets(lead.website || '', leadName, lead.id, '', meta);
        const rawHtml = generateConceptualDesignHtml(
          leadName,
          lead.website || '',
          brandAssets.palette,
          brandAssets.images,
          brandAssets.fallbackImages,
          brandAssets.layoutArchetype,
          lead.phone || (meta as any).phone || '',
          (meta as any).address || 'España',
          (meta as any).rating || 4.9
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
