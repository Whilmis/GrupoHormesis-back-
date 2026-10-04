import { Router } from 'express';
import { workflowController } from '../controllers/workflow.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Webhook Público (Recibe datos externos sin autenticación)
router.post('/webhook/:id', workflowController.webhook);

// Templates
router.get('/templates', requireAuth, workflowController.getTemplates);

// Workflows del usuario
router.get('/', requireAuth, workflowController.getUserWorkflows);
router.post('/', requireAuth, workflowController.createUserWorkflow);
router.delete('/:id', requireAuth, workflowController.deleteUserWorkflow);
router.put('/:id', requireAuth, workflowController.updateUserWorkflow);
router.post('/:id/refine-templates', requireAuth, workflowController.refineTemplates);
router.post('/:id/execute', requireAuth, workflowController.executeWorkflow);
router.get('/:id/executions', requireAuth, workflowController.getExecutions);
router.post('/generate-templates', requireAuth, workflowController.generateTemplates);

// Credenciales
router.get('/credentials', requireAuth, workflowController.getCredentials);
router.post('/credentials', requireAuth, workflowController.saveCredential);
router.delete('/credentials/:id', requireAuth, workflowController.deleteCredential);
router.put('/credentials/:id', requireAuth, workflowController.updateCredential);
router.get('/credentials/:id/value', requireAuth, workflowController.getCredentialValue);

export default router;

