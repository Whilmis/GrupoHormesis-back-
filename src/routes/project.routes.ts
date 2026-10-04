import { Router } from 'express';
import { getProjects, createProject, getProjectLeads, getProjectActivities } from '../controllers/project.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', getProjects);
router.post('/', createProject);
router.get('/:projectId/leads', getProjectLeads);
router.get('/:projectId/activities', getProjectActivities);

export default router;
