import { Router } from 'express';
import { submitForm } from '../controllers/form.controller';

const router = Router();

// POST /api/forms/:workflowId/submit
router.post('/:workflowId/submit', submitForm);

export default router;
