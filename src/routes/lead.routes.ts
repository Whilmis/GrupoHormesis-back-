import { Router } from 'express';
import { getLeadActivities, createLeadActivity } from '../controllers/lead.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/:leadId/activities', getLeadActivities);
router.post('/:leadId/activities', createLeadActivity);

export default router;
