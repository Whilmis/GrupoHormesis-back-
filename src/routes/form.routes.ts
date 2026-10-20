import { Router } from 'express';
import { submitForm, getFormSubmissions } from '../controllers/form.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// POST /api/forms/submit y /api/forms/:workflowId/submit
router.post('/submit', submitForm);
router.post('/:workflowId/submit', submitForm);
router.get('/', requireAuth, getFormSubmissions);

export default router;
