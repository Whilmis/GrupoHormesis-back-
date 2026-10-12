import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { 
  getCalendars, 
  createCalendar, 
  updateCalendar, 
  deleteCalendar,
  getPublicCalendar,
  bookMeeting,
  getCalendarMeetings
} from '../controllers/calendar.controller';

const router = Router();

// Public routes
router.get('/public/:id', getPublicCalendar);
router.post('/public/:id/book', bookMeeting);
router.get('/public/:id/meetings', getCalendarMeetings); // used for calculating available slots

// Protected routes
router.use(requireAuth);
router.get('/', getCalendars);
router.post('/', createCalendar);
router.put('/:id', updateCalendar);
router.delete('/:id', deleteCalendar);

export default router;
