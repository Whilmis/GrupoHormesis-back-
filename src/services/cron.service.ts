import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { ExecutionEngine } from './execution.engine';

const prisma = new PrismaClient();
const scheduledJobs = new Map<string, cron.ScheduledTask>();

export class CronService {
  static async init() {
    console.log('[CronService] Inicializando scheduler...');
    
    // Buscar workflows activos que tengan un schedule configurado
    const workflows = await prisma.userWorkflow.findMany({
      where: { isActive: true }
    });

    for (const wf of workflows) {
      const config = wf.config as any;
      if (config && config.schedule) {
        this.scheduleWorkflow(wf.id, config.schedule);
      }
    }
  }

  static scheduleWorkflow(workflowId: string, cronExpression: string) {
    if (scheduledJobs.has(workflowId)) {
      scheduledJobs.get(workflowId)?.stop();
      scheduledJobs.delete(workflowId);
    }

    if (!cron.validate(cronExpression)) {
      console.error(`[CronService] Cron inválido para WF ${workflowId}: ${cronExpression}`);
      return;
    }

    const task = cron.schedule(cronExpression, async () => {
      console.log(`[CronService] Ejecutando automático WF: ${workflowId}`);
      try {
        await ExecutionEngine.executeWorkflow(workflowId);
      } catch (error) {
        console.error(`[CronService] Error ejecutando WF ${workflowId}:`, error);
      }
    });

    scheduledJobs.set(workflowId, task);
    console.log(`[CronService] WF ${workflowId} programado con: ${cronExpression}`);
  }

  static stopWorkflow(workflowId: string) {
    if (scheduledJobs.has(workflowId)) {
      scheduledJobs.get(workflowId)?.stop();
      scheduledJobs.delete(workflowId);
      console.log(`[CronService] Cron detenido para WF ${workflowId}`);
    }
  }
}
