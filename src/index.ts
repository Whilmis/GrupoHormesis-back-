import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import workflowRoutes from './routes/workflow.routes';
import formRoutes from './routes/form.routes';
import projectRoutes from './routes/project.routes';
import leadRoutes from './routes/lead.routes';
import { errorHandler } from './middlewares/error.middleware';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/leads', leadRoutes);

// Error handling middleware
app.use(errorHandler);

import { CronService } from './services/cron.service';

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  CronService.init().catch(console.error);
});
