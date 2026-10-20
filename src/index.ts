import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import workflowRoutes from './routes/workflow.routes';
import formRoutes from './routes/form.routes';
import projectRoutes from './routes/project.routes';
import leadRoutes from './routes/lead.routes';
import calendarRoutes from './routes/calendar.routes';
import meetingRoutes from './routes/meeting.routes';
import prisma from './config/db';
import { errorHandler } from './middlewares/error.middleware';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const allowedOrigins: (string | RegExp)[] = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://grupohormesis.es',
  'https://www.grupohormesis.es',
  'http://grupohormesis.es',
  'http://www.grupohormesis.es',
  'https://hormesis-front-production.up.railway.app',
  /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*grupohormesis\.es$/,
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(u => u.trim().replace(/\/$/, '')) : [])
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200
}));

app.use(express.json());

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const execCount = await prisma.workflowExecution.count();
    res.json({
      status: 'ok',
      version: '1.0.8-docker',
      execCount,
      dbHost: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).host : 'none',
      chromium: process.env.PUPPETEER_EXECUTABLE_PATH || 'not_set',
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'db_error',
      version: '1.0.8-docker',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/calendars', calendarRoutes);
app.use('/api/meetings', meetingRoutes);

// Error handling middleware
app.use(errorHandler);

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled Rejection:', reason);
});

import { CronService } from './services/cron.service';

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  CronService.init().catch(console.error);
});
