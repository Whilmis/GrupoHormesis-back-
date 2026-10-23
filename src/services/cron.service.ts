import cron, { ScheduledTask } from 'node-cron';
import prisma from '../config/db';
import { ExecutionEngine } from './execution.engine';

const scheduledJobs = new Map<string, ScheduledTask>();

export class CronService {
  static async init(retries = 5, delayMs = 3000) {
    console.log('[CronService] Inicializando scheduler...');
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
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

        console.log(`[CronService] Scheduler inicializado correctamente (${workflows.length} workflows activos)`);
        return;
      } catch (error: any) {
        console.warn(`[CronService] Intento ${attempt}/${retries} al conectar con la base de datos: ${error.message || error}`);
        if (attempt < retries) {
          console.log(`[CronService] Reintentando en ${delayMs / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          console.error('[CronService] No se pudo inicializar el scheduler tras varios intentos. El servidor continúa activo.');
        }
      }
    }
  }

  static scheduleWorkflow(workflowId: string, cronExpression: string, timezone: string = 'Europe/Madrid') {
    if (scheduledJobs.has(workflowId)) {
      scheduledJobs.get(workflowId)?.stop();
      scheduledJobs.delete(workflowId);
    }

    if (!cronExpression || !cron.validate(cronExpression)) {
      if (cronExpression) {
        console.error(`[CronService] Cron inválido para WF ${workflowId}: ${cronExpression}`);
      }
      return;
    }

    const task = cron.schedule(cronExpression, async () => {
      console.log(`[CronService] [${new Date().toISOString()}] ⏰ Ejecutando automático WF: ${workflowId}`);
      try {
        await ExecutionEngine.executeWorkflow(workflowId);
      } catch (error) {
        console.error(`[CronService] Error ejecutando WF ${workflowId}:`, error);
      }
    }, {
      timezone
    });

    scheduledJobs.set(workflowId, task);
    console.log(`[CronService] WF ${workflowId} programado con: "${cronExpression}" (Zona Horaria: ${timezone})`);
  }

  static stopWorkflow(workflowId: string) {
    if (scheduledJobs.has(workflowId)) {
      scheduledJobs.get(workflowId)?.stop();
      scheduledJobs.delete(workflowId);
      console.log(`[CronService] Cron detenido para WF ${workflowId}`);
    }
  }
}
