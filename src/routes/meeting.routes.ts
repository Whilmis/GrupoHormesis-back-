import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { 
  rescheduleMeeting, 
  deleteMeeting, 
  getColaboradorMeetings, 
  confirmMeeting, 
  declineMeeting,
  getColaboradorStats 
} from '../controllers/meeting.controller';

const router = Router();

router.use(requireAuth);

router.get('/colaborador', getColaboradorMeetings);
router.get('/colaborador/stats', getColaboradorStats);
router.put('/:id/confirm', confirmMeeting);
router.put('/:id/decline', declineMeeting);
router.put('/:id', rescheduleMeeting);
router.delete('/:id', deleteMeeting);

export default router;
