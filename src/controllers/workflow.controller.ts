import { Request, Response } from 'express';
import prisma from '../config/db';
import { CredentialService } from '../services/credential.service';
import { ExecutionEngine, ensureExecutiveFormEmailHtml } from '../services/execution.engine';
import { CronService } from '../services/cron.service';



export const workflowController = {
  // --- TEMPLATES ---
  async getTemplates(req: Request, res: Response) {
    try {
      const templates = await prisma.workflowTemplate.findMany();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: 'Error obteniendo plantillas' });
    }
  },

  // --- USER WORKFLOWS ---
  async getUserWorkflows(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const workflows = await prisma.userWorkflow.findMany({
        where: { userId },
        include: { template: true, credentials: true }
      });
      res.json(workflows);
    } catch (error) {
      res.status(500).json({ error: 'Error obteniendo workflows del usuario' });
    }
  },

  async createUserWorkflow(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { templateId, name, config, credentialIds, projectId } = req.body;

      const workflow = await prisma.userWorkflow.create({
        data: {
          userId,
          templateId,
          name,
          config,
          projectId: projectId || undefined,
          credentials: credentialIds ? { connect: credentialIds.map((id: string) => ({ id })) } : undefined
        }
      });
      res.status(201).json(workflow);
    } catch (error: any) {
      console.error(error); res.status(500).json({ error: 'Error creando workflow', details: error.message || String(error) });
    }
  },

  
  
  async updateUserWorkflow(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { config, name, credentialIds, projectId, isActive } = req.body;
      const userId = (req as any).user.id;

      const existing = await prisma.userWorkflow.findFirst({
        where: { id, userId }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Workflow no encontrado' });
      }

      // Hacer un merge superficial/profundo del config existente con el nuevo
      let mergedConfig = existing.config;
      if (config !== undefined) {
        mergedConfig = {
          ...(typeof existing.config === 'object' && existing.config ? existing.config : {}),
          ...config,
          // Mantener los fieldMappings si existen en el viejo y no vienen en el nuevo
          fieldMappings: config.fieldMappings !== undefined 
            ? config.fieldMappings 
            : (existing.config as any)?.fieldMappings
        };
      }

      const workflow = await prisma.userWorkflow.update({
        where: { id },
        data: { 
          name: name !== undefined ? name : undefined,
          isActive: isActive !== undefined ? isActive : undefined,
          config: config !== undefined ? mergedConfig : undefined,
          projectId: projectId !== undefined ? (projectId || null) : undefined,
          credentials: credentialIds ? { set: credentialIds.map((credId: string) => ({ id: credId })) } : undefined
        },
        include: { credentials: true }
      });

      // Actualizar reactivamente el scheduler de CronService
      const scheduleExpr = (workflow.config as any)?.schedule;
      if (workflow.isActive && scheduleExpr) {
        CronService.scheduleWorkflow(workflow.id, scheduleExpr);
      } else {
        CronService.stopWorkflow(workflow.id);
      }

      res.json(workflow);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error actualizando workflow' });
    }
  },

    async deleteUserWorkflow(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      const workflow = await prisma.userWorkflow.findFirst({
        where: { id, userId }
      });

      if (!workflow) {
        return res.status(404).json({ error: 'Workflow no encontrado' });
      }

      CronService.stopWorkflow(id);

      await prisma.userWorkflow.delete({
        where: { id }
      });

      res.json({ message: 'Workflow eliminado correctamente' });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Error eliminando workflow', details: error.message });
    }
  },

  // --- EJECUCION PUBLICA (WEBHOOK) ---
  async webhook(req: Request, res: Response) {
    try {
      const { id } = req.params; // ID del UserWorkflow
      const inputData = req.body;

      // Ejecutar motor pasando el inputData
      // Nota: Esta ruta no requiere autenticacion porque es para recibir datos de clientes externos.
      const result = await ExecutionEngine.executeWorkflow(id, inputData);
      
      res.json({ message: 'Webhook procesado con exito', result });
    } catch (error: any) {
      console.error('Error en webhook:', error);
      res.status(500).json({ error: error.message || 'Error procesando webhook' });
    }
  },

  // --- EJECUCION MANUAL ---
  async executeWorkflow(req: Request, res: Response) {
    const { id } = req.params;
    console.log(`[workflowController] === executeWorkflow START for ID: ${id} ===`);
    try {
      // Race de seguridad de 35s: Si un workflow con muchas tareas toma más tiempo,
      // respondemos 200 con ejecución en segundo plano para evitar que el proxy de Railway (60s)
      // corte la conexión con 502 Bad Gateway y bloqueos de CORS.
      const executionPromise = ExecutionEngine.executeWorkflow(id);
      const timeoutPromise = new Promise<{ isTimeout: true; result?: undefined }>((resolve) => {
        setTimeout(() => resolve({ isTimeout: true }), 35000);
      });

      const outcome = await Promise.race([
        executionPromise.then(result => ({ isTimeout: false as const, result })),
        timeoutPromise
      ]);

      if (outcome.isTimeout) {
        console.log(`[workflowController] Workflow ID ${id} supera los 35s. Respondiendo 200 en segundo plano.`);
        // Asegurar que errores en background no queden sin atrapar
        executionPromise.catch(err => {
          console.error(`[workflowController] Error en background para WF ${id}:`, err);
        });

        // Intentar obtener el ID de la ejecución en curso para seguimiento del frontend
        let executionId: string | undefined;
        try {
          const activeExec = await prisma.workflowExecution.findFirst({
            where: { userWorkflowId: id, status: 'running' },
            orderBy: { startedAt: 'desc' },
            select: { id: true }
          });
          executionId = activeExec?.id;
        } catch (e) {}

        res.json({
          message: 'El workflow se está ejecutando en segundo plano. Puedes revisar los avances en vivo en el panel.',
          runningInBackground: true,
          executionId,
          result: {
            isRunningInBackground: true,
            message: 'El workflow se está ejecutando en segundo plano en el servidor. Los nuevos leads calificados se guardarán automáticamente en tu base de datos.',
            searchQuery: 'Ejecución en segundo plano',
            total_found: 0,
            audited_leads: 0,
            leads: []
          }
        });
        return;
      }

      console.log(`[workflowController] === executeWorkflow SUCCESS for ID: ${id} ===`);
      res.json({
        message: 'Ejecucion completada',
        result: outcome.result || {
          message: 'Ejecución completada',
          total_found: 0,
          audited_leads: 0,
          leads: []
        }
      });
    } catch (error: any) {
      console.error(`[workflowController] === executeWorkflow ERROR for ID: ${id}:`, error);
      res.status(500).json({ error: error.message || 'Error en ejecucion' });
    }
  },

  async getExecutions(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const [formSubmissions, workflowExecutions] = await Promise.all([
        prisma.formSubmission.findMany({
          where: { workflowId: id },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            referredBy: {
              select: {
                name: true
              }
            }
          }
        }),
        prisma.workflowExecution.findMany({
          where: { userWorkflowId: id },
          orderBy: { startedAt: 'desc' },
          take: 25
        })
      ]);

      const formattedForms = formSubmissions.map(f => ({ ...f, type: 'form' }));
      const formattedExecs = workflowExecutions.map(e => ({
        id: e.id,
        userWorkflowId: e.userWorkflowId,
        status: e.status,
        resultData: e.resultData,
        logs: e.logs,
        startedAt: e.startedAt,
        completedAt: e.completedAt,
        createdAt: e.startedAt,
        type: 'execution'
      }));

      // Unir y ordenar por fecha descendente
      const all = [...formattedExecs, ...formattedForms].sort((a, b) => {
        const dateA = new Date(a.createdAt || a.startedAt).getTime();
        const dateB = new Date(b.createdAt || b.startedAt).getTime();
        return dateB - dateA;
      });

      res.json(all);
    } catch (error: any) {
      console.error('Error obteniendo ejecuciones:', error);
      res.status(500).json({ error: 'Error obteniendo ejecuciones' });
    }
  },

  // --- CREDENCIALES ---
  async getCredentials(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const credentials = await prisma.credential.findMany({
        where: { userId },
        select: { id: true, type: true, name: true, createdAt: true, updatedAt: true } // Nunca retornar el secreto
      });
      res.json(credentials);
    } catch (error) {
      res.status(500).json({ error: 'Error obteniendo credenciales' });
    }
  },

  async saveCredential(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { type, name, value, userWorkflowId } = req.body; // value es el texto plano (el secreto)

      const encryptedData = CredentialService.encrypt(value);

      const credential = await prisma.credential.create({
        data: {
          userId,
          type,
          name,
          encrypted: encryptedData.encrypted,
          iv: encryptedData.iv,
          workflows: userWorkflowId ? { connect: { id: userWorkflowId } } : undefined
        }
      });

      res.status(201).json({ id: credential.id, name: credential.name, type: credential.type });
    } catch (error) {
      res.status(500).json({ error: 'Error guardando credencial' });
    }
  },

  async deleteCredential(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;
      
      const cred = await prisma.credential.findFirst({ where: { id, userId } });
      if (!cred) return res.status(404).json({ error: 'Credencial no encontrada' });
      
      await prisma.credential.delete({ where: { id } });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Error eliminando credencial' });
    }
  },

  async updateCredential(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;
      const { name, value } = req.body;

      const cred = await prisma.credential.findFirst({ where: { id, userId } });
      if (!cred) return res.status(404).json({ error: 'Credencial no encontrada' });

      const dataToUpdate: any = {};
      if (name) dataToUpdate.name = name;
      if (value) {
        const encryptedData = CredentialService.encrypt(value);
        dataToUpdate.encrypted = encryptedData.encrypted;
        dataToUpdate.iv = encryptedData.iv;
      }

      const updated = await prisma.credential.update({
        where: { id },
        data: dataToUpdate
      });

      res.json({ id: updated.id, name: updated.name, type: updated.type });
    } catch (error) {
      res.status(500).json({ error: 'Error actualizando credencial' });
    }
  },

  async getCredentialValue(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;
      
      const cred = await prisma.credential.findFirst({ where: { id, userId } });
      if (!cred) return res.status(404).json({ error: 'Credencial no encontrada' });

      const decryptedValue = CredentialService.decrypt(cred.encrypted, cred.iv);
      res.json({ value: decryptedValue });
    } catch (error) {
      res.status(500).json({ error: 'Error obteniendo valor de la credencial' });
    }
  },

  async generateTemplates(req: Request, res: Response) {
    const log = (msg: string) => console.log(`[generateTemplates] ${msg}`);
    const err = (msg: string, detail: any = '') => console.error(`[generateTemplates] ${msg}`, detail);

    log('=== INICIANDO GENERATE TEMPLATES (MODO RÁPIDO PARALELO) ===');

    try {
      const { business_context, services, groqCredentialId, brandVoice } = req.body;
      const userId = (req as any).user.id;
      let apiKeyToUse = process.env.GROQ_API_KEY;
      if (groqCredentialId) {
        const cred = await prisma.credential.findFirst({ where: { id: groqCredentialId, userId } });
        if (cred) {
          apiKeyToUse = CredentialService.decrypt(cred.encrypted, cred.iv);
        }
      }
      if (!apiKeyToUse) {
        const anyGroqCred = await prisma.credential.findFirst({ where: { userId, type: 'groq_api_key' } });
        if (anyGroqCred) {
          apiKeyToUse = CredentialService.decrypt(anyGroqCred.encrypted, anyGroqCred.iv);
        }
      }
      if (!apiKeyToUse) {
        err('Groq API Key no configurada.');
        return res.status(400).json({ error: 'Groq API Key no configurada.' });
      }

      const serviceList: string[] = Array.isArray(services)
        ? services.map((s: any) => String(s).trim()).filter(Boolean)
        : [];
      const isOutreachMode =
        Boolean(brandVoice) ||
        req.body.mode === 'outreach' ||
        (serviceList.length === 1 && serviceList[0] === 'Propuesta de Negocios');

      const buildExecutiveHtmlFromStructured = (serviceName: string, data: any, mailtoHref: string): string => {
        const badge = data?.badge || 'GRUPO HORMESIS · SOLUCIÓN ESPECIALIZADA';
        const headline = data?.headline || `Propuesta Estratégica: ${serviceName}`;
        const subtitle = data?.subtitle || 'Diagnóstico y hoja de ruta preparada para [Nombre]';
        const p1 =
          data?.introParagraph1 ||
          `Hola <strong style='color: #0f172a;'>[Nombre]</strong>, hemos recibido tu solicitud sobre <strong style='color: #0f172a;'>${serviceName}</strong> y nuestro equipo de ingeniería ha analizado cómo estructurar una solución de alto impacto para tu negocio.`;
        const p2 =
          data?.introParagraph2 ||
          `En Grupo Hormesis diseñamos e implementamos arquitecturas tecnológicas pensadas para eliminar fricciones operativas, acelerar tiempos de respuesta y multiplicar la rentabilidad de cada proceso.`;
        const valueBoxTitle = data?.valueBoxTitle || `⚡ ¿Qué logramos con nuestra solución de ${serviceName}?`;
        const benefits: Array<{ icon?: string; title?: string; desc?: string }> =
          Array.isArray(data?.benefits) && data.benefits.length > 0
            ? data.benefits
            : [
                {
                  icon: '✅',
                  title: 'Arquitectura 100% a Medida',
                  desc: `Adaptamos cada flujo e integración de ${serviceName} a la operativa real de tu empresa.`
                },
                {
                  icon: '⚡',
                  title: 'Automatización y Ahorro Operativo',
                  desc: 'Eliminamos tareas manuales repetitivas y cuellos de botella desde la primera semana.'
                },
                {
                  icon: '📈',
                  title: 'Enfoque Directo en Conversión y ROI',
                  desc: 'Métricas claras de rendimiento, escalabilidad garantizada y retorno de inversión medible.'
                }
              ];
        const steps: Array<{ title?: string; desc?: string }> =
          Array.isArray(data?.steps) && data.steps.length > 0
            ? data.steps
            : [
                {
                  title: '1. Sesión de Diagnóstico (15 min)',
                  desc: 'Evaluamos tu situación actual, objetivos de negocio y requerimientos técnicos.'
                },
                {
                  title: '2. Diseño de Arquitectura y Propuesta',
                  desc: 'Definimos el alcance exacto, cronograma de entregas y proyección de retorno.'
                },
                {
                  title: '3. Implementación Ágil y Escalado',
                  desc: 'Despliegue sin interrumpir tu operación actual y acompañamiento técnico continuo.'
                }
              ];
        const guarantee =
          data?.guarantee ||
          'Confidencialidad absoluta, soporte directo de ingeniería y arquitectura diseñada para escalar.';

        const benefitsHtml = benefits
          .map(
            (b) =>
              `<div style='margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;'>
                <div style='font-size: 14.5px; font-weight: 700; color: #0f172a; margin-bottom: 3px;'>${b.icon || '✅'} ${b.title || 'Beneficio Clave'}</div>
                <div style='font-size: 13.5px; color: #475569; line-height: 1.55;'>${b.desc || ''}</div>
              </div>`
          )
          .join('');

        const stepsHtml = steps
          .map(
            (s) =>
              `<div style='margin-bottom: 10px; font-size: 13.5px; color: #334155; line-height: 1.5;'>
                <strong style='color: #0f172a;'>${s.title || 'Paso'}:</strong> ${s.desc || ''}
              </div>`
          )
          .join('');

        return `<div style='max-width: 640px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Inter, Helvetica, Arial, sans-serif; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08); color: #1e293b;'>
  <div style='background: #0f172a; border-top: 4px solid #10b981; padding: 32px 28px;'>
    <span style='display: inline-block; background: rgba(16, 185, 129, 0.18); color: #34d399; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; padding: 5px 12px; border-radius: 9999px; border: 1px solid rgba(52, 211, 153, 0.3);'>${badge}</span>
    <h1 style='color: #ffffff; font-size: 22px; font-weight: 800; margin: 14px 0 6px 0; line-height: 1.3;'>${headline}</h1>
    <p style='color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.5;'>${subtitle}</p>
  </div>
  <div style='padding: 28px;'>
    <p style='font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 14px 0;'>${p1}</p>
    <p style='font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 22px 0;'>${p2}</p>
    <div style='background: #f8fafc; border-left: 4px solid #10b981; border-radius: 8px; padding: 20px 22px; margin: 24px 0;'>
      <h3 style='margin: 0 0 14px 0; color: #0f172a; font-size: 16px; font-weight: 700;'>${valueBoxTitle}</h3>
      ${benefitsHtml}
    </div>
    <div style='background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px 22px; margin: 22px 0;'>
      <h4 style='margin: 0 0 12px 0; color: #0f172a; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;'>📋 Hoja de Ruta de Implementación</h4>
      ${stepsHtml}
    </div>
    <div style='background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px 18px; color: #065f46; font-size: 13px; margin-bottom: 24px; line-height: 1.5;'>
      🔒 <strong>Garantía Grupo Hormesis:</strong> ${guarantee}
    </div>
    <div style='text-align: center; padding: 24px 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;'>
      <p style='margin: 0 0 16px 0; color: #0f172a; font-size: 15px; font-weight: 700;'>¿Evaluamos cómo aplicarlo a tu negocio en una sesión de 15 minutos?</p>
      <a href='[Link_Calendario]' target='_blank' style='display: inline-block; background: #10b981; color: #ffffff; padding: 14px 26px; border-radius: 8px; font-weight: 700; font-size: 14px; text-decoration: none; margin: 6px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);'>📅 Agendar Llamada de Diagnóstico (15 min)</a>
      <a href='${mailtoHref}' style='display: inline-block; background: #0f172a; color: #ffffff; padding: 13px 22px; border-radius: 8px; font-weight: 600; font-size: 13px; text-decoration: none; margin: 6px;'>✉️ Responder con Detalles por Correo</a>
    </div>
  </div>
  <div style='background: #0f172a; padding: 20px 28px; text-align: center; border-top: 1px solid #1e293b;'>
    <p style='margin: 0 0 4px 0; color: #f8fafc; font-size: 13px; font-weight: 700;'>Grupo Hormesis · Sistematización Empresarial e Inteligencia Artificial</p>
    <p style='margin: 0; color: #94a3b8; font-size: 12px;'><a href='https://grupohormesis.es' style='color: #34d399; text-decoration: none; font-weight: 600;'>grupohormesis.es</a></p>
  </div>
</div>`;
      };

      const modelsCascade = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant'];

      const generateForSingleService = async (service: string, idx: number): Promise<[string, { subject: string; body: string }]> => {
        const mailtoBody = `Hola equipo de Grupo Hormesis,\n\nHe recibido su propuesta inicial sobre ${service} y me gustaría avanzar con la Llamada de Diagnóstico (15 min).\n\n- Principal reto o necesidad actual:\n[Escribe brevemente aquí...]\n\nSaludos,\n[Nombre]`;
        const mailtoHref = `mailto:ventas@grupohormesis.com?subject=${encodeURIComponent('Diagnóstico de Proyecto - ' + service)}&body=${encodeURIComponent(mailtoBody)}`;

        const prompt = isOutreachMode
          ? `Eres un Master Copywriter B2B. Crea un Cold Email breve en HTML para ofrecer "${service}".
Contexto de Grupo Hormesis: "${business_context}"
Reglas:
1. Asunto corto (4-7 palabras).
2. Gancho directo sobre su web y una línea de diseño conceptual preparada para su negocio.
3. Menciona 2-3 oportunidades técnicas clave.
4. Usa comillas simples (') en atributos HTML y [Nombre] para el cliente.
Devuelve SOLO un JSON válido:
{
  "subject": "Asunto corto",
  "body": "<p style='font-size: 15px; color: #334155; margin-bottom: 12px;'>...</p><ul style='color: #475569;'><li>...</li></ul>"
}`
          : `Eres un Director de Consultoría B2B de Grupo Hormesis.
Un cliente potencial acaba de solicitar información en nuestro formulario web sobre el servicio: "${service}".
Contexto de nuestra empresa (Grupo Hormesis): "${business_context}"

Redacta el contenido estratégico y altamente persuasivo para responderle sobre "${service}".
Usa [Nombre] para referirte al cliente. NO uses comillas dobles internas que rompan el JSON.
Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta:
{
  "subject": "Asunto ejecutivo, cercano y de alto valor sobre ${service} (6-10 palabras)",
  "badge": "GRUPO HORMESIS · SOLUCIÓN ESPECIALIZADA",
  "headline": "Título ejecutivo potente enfocado en transformar su área de ${service}",
  "subtitle": "Propuesta estratégica e información clave preparada para [Nombre]",
  "introParagraph1": "Saludo cercano a [Nombre] confirmando su solicitud sobre ${service} y conectando con el principal dolor o reto que sufren las empresas en esta área.",
  "introParagraph2": "Segundo párrafo consultivo explicando cómo Grupo Hormesis resuelve este reto combinando ingeniería a medida, IA y enfoque en rentabilidad.",
  "valueBoxTitle": "⚡ Impacto directo al implementar nuestra solución de ${service}",
  "benefits": [
    { "icon": "✅", "title": "Título del beneficio 1 específico de ${service}", "desc": "Descripción persuasiva orientada a ROI y resultados medibles." },
    { "icon": "⚡", "title": "Título del beneficio 2 específico de ${service}", "desc": "Descripción persuasiva sobre ahorro de tiempo y eliminación de fricciones." },
    { "icon": "📈", "title": "Título del beneficio 3 específico de ${service}", "desc": "Descripción persuasiva sobre escalabilidad y ventaja competitiva." },
    { "icon": "🔒", "title": "Título del beneficio 4 específico de ${service}", "desc": "Descripción persuasiva sobre robustez técnica y acompañamiento." }
  ],
  "steps": [
    { "title": "1. Sesión de Diagnóstico Técnico (15 min)", "desc": "Analizamos tu caso actual y objetivos clave." },
    { "title": "2. Arquitectura y Propuesta a Medida", "desc": "Entregamos el plan de implementación detallado con plazos y ROI." },
    { "title": "3. Despliegue Ágil y Resultados", "desc": "Ejecución por fases con garantía técnica y soporte directo." }
  ],
  "guarantee": "Confidencialidad total, arquitectura escalable diseñada a medida y enfoque 100% en retorno de inversión."
}`;

        // Rotar el modelo inicial según el índice para repartir cuota de TPM en llamadas paralelas
        const orderedModels = [
          modelsCascade[idx % modelsCascade.length],
          ...modelsCascade.filter((_, i) => i !== idx % modelsCascade.length)
        ];

        for (const modelName of orderedModels) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 14000);
            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              signal: controller.signal,
              headers: {
                Authorization: `Bearer ${apiKeyToUse}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: modelName,
                response_format: { type: 'json_object' },
                messages: [
                  {
                    role: 'system',
                    content:
                      'You are an elite B2B Consultant and Copywriter. Always respond with a valid JSON object matching the requested schema.'
                  },
                  { role: 'user', content: prompt }
                ],
                temperature: 0.6,
                max_tokens: 1800
              })
            });
            clearTimeout(timeoutId);

            if (groqResponse.ok) {
              const aiData = await groqResponse.json();
              const rawText = aiData.choices?.[0]?.message?.content || '';
              const match = rawText.match(/\{[\s\S]*\}/);
              if (match) {
                const parsed = JSON.parse(match[0]);
                if (isOutreachMode) {
                  return [
                    service,
                    {
                      subject: parsed.subject || `Idea rápida para tu proyecto de ${service}`,
                      body: parsed.body || `<p>Hola [Nombre], hemos preparado una propuesta para ${service}.</p>`
                    }
                  ];
                } else {
                  const fullHtml = parsed.body
                    ? ensureExecutiveFormEmailHtml(parsed.body, service, '[Link_Calendario]', mailtoHref)
                    : buildExecutiveHtmlFromStructured(service, parsed, mailtoHref);
                  return [
                    service,
                    {
                      subject: parsed.subject || `Propuesta Estratégica de ${service} | Grupo Hormesis`,
                      body: fullHtml
                    }
                  ];
                }
              }
            } else {
              log(`[${service}] Modelo ${modelName} respondió status ${groqResponse.status}. Probando siguiente modelo...`);
            }
          } catch (e: any) {
            log(`[${service}] Aviso en modelo ${modelName}: ${e.message}`);
          }
        }

        // Fallback inmediato de alta calidad si todos los modelos están saturados
        log(`[${service}] Usando plantilla ejecutiva estructurada de respaldo.`);
        return [
          service,
          {
            subject: `Propuesta Estratégica: ${service} para tu empresa | Grupo Hormesis`,
            body: buildExecutiveHtmlFromStructured(service, {}, mailtoHref)
          }
        ];
      };

      const entries = await Promise.all(serviceList.map((srv, idx) => generateForSingleService(srv, idx)));
      const generatedResponses: Record<string, { subject: string; body: string }> = Object.fromEntries(entries);

      log(`=== FIN. Generadas ${entries.length} plantillas ejecutivas con éxito ===`);
      return res.json(generatedResponses);
    } catch (error: any) {
      err('Error Fatal Catch:', error.message);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Error generando plantillas: ' + error.message });
      }
    }
  },

  async refineTemplates(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { refinement_prompt, service } = req.body;
      const userId = (req as any).user.id;
      const workflow = await prisma.userWorkflow.findFirst({
        where: { id, userId },
        include: { credentials: true }
      });
      if (!workflow) return res.status(404).json({ error: 'Workflow no encontrado' });
      const currentConfig = workflow.config as any;
      if (!currentConfig || !currentConfig.generated_responses) {
        return res.status(400).json({ error: 'Este workflow no tiene plantillas generadas para refinar.' });
      }
      let groqCred = workflow.credentials.find((c: any) => c.type === 'groq_api_key');
      if (!groqCred) {
        groqCred = (await prisma.credential.findFirst({ where: { userId, type: 'groq_api_key' } })) as any;
      }
      let apiKeyToUse = process.env.GROQ_API_KEY;
      if (groqCred) {
        apiKeyToUse = CredentialService.decrypt(groqCred.encrypted, groqCred.iv);
      }
      if (!apiKeyToUse) return res.status(400).json({ error: 'No se encontro API Key de Groq asociada a este workflow.' });

      const templatesToRefine: Record<string, any> = service
        ? { [service]: currentConfig.generated_responses[service] }
        : currentConfig.generated_responses;
      if (service && !templatesToRefine[service]) {
        return res.status(400).json({ error: 'El servicio especificado no existe en este workflow.' });
      }

      const userInstruction =
        (refinement_prompt || '').trim() ||
        'Transforma y enriquece completamente el contenido para que sea una propuesta ejecutiva B2B de máxima autoridad y conversión.';
      const businessContextInfo = currentConfig.businessContext || 'Consultora tecnológica de sistematización e Inteligencia Artificial (Grupo Hormesis).';
      const modelsCascade = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant'];

      const refineSingleService = async (srvKey: string, currentTpl: any, idx: number): Promise<[string, { subject: string; body: string }]> => {
        const mailtoBody = `Hola equipo de Grupo Hormesis,\n\nHe recibido su propuesta inicial sobre ${srvKey} y me gustaría avanzar con la Llamada de Diagnóstico (15 min).\n\nSaludos,\n[Nombre]`;
        const mailtoHref = `mailto:ventas@grupohormesis.com?subject=${encodeURIComponent('Diagnóstico de Proyecto - ' + srvKey)}&body=${encodeURIComponent(mailtoBody)}`;

        const currentPlainSnippet = (currentTpl?.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 600);
        const prompt = `Eres un Director de Consultoría B2B de Grupo Hormesis.
Contexto de la empresa: "${businessContextInfo}"
Servicio: "${srvKey}"
Asunto actual: "${currentTpl?.subject || srvKey}"
Resumen del contenido actual: "${currentPlainSnippet}"

INSTRUCCIÓN DE MEJORA DEL USUARIO:
"${userInstruction}"

Reescribe y mejora el contenido aplicando la instrucción del usuario para el servicio "${srvKey}". Usa [Nombre] para referirte al cliente.
Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:
{
  "subject": "Asunto ejecutivo mejorado aplicando la instrucción",
  "badge": "GRUPO HORMESIS · SOLUCIÓN ESPECIALIZADA",
  "headline": "Título ejecutivo potente enfocado en ${srvKey}",
  "subtitle": "Propuesta estratégica preparada para [Nombre]",
  "introParagraph1": "Primer párrafo consultivo aplicando la mejora solicitada y saludando a [Nombre].",
  "introParagraph2": "Segundo párrafo consultivo de autoridad técnica y enfoque en resultados.",
  "valueBoxTitle": "⚡ Impacto directo al implementar nuestra solución de ${srvKey}",
  "benefits": [
    { "icon": "✅", "title": "Beneficio clave 1", "desc": "Descripción persuasiva orientada a ROI." },
    { "icon": "⚡", "title": "Beneficio clave 2", "desc": "Descripción persuasiva sobre eficiencia y automatización." },
    { "icon": "📈", "title": "Beneficio clave 3", "desc": "Descripción persuasiva sobre escalabilidad." },
    { "icon": "🔒", "title": "Beneficio clave 4", "desc": "Descripción persuasiva sobre seguridad y soporte." }
  ],
  "steps": [
    { "title": "1. Sesión de Diagnóstico Técnico (15 min)", "desc": "Analizamos tu caso actual y objetivos clave." },
    { "title": "2. Arquitectura y Propuesta a Medida", "desc": "Entregamos el plan de implementación detallado con plazos y ROI." },
    { "title": "3. Despliegue Ágil y Resultados", "desc": "Ejecución por fases con garantía técnica." }
  ],
  "guarantee": "Confidencialidad total, arquitectura escalable diseñada a medida y enfoque 100% en retorno de inversión."
}`;

        const orderedModels = [
          modelsCascade[idx % modelsCascade.length],
          ...modelsCascade.filter((_, i) => i !== idx % modelsCascade.length)
        ];

        for (const modelName of orderedModels) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 14000);
            const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              signal: controller.signal,
              headers: {
                Authorization: `Bearer ${apiKeyToUse}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: modelName,
                response_format: { type: 'json_object' },
                messages: [
                  { role: 'system', content: 'You are an elite B2B Copywriter. Respond only with a valid JSON object.' },
                  { role: 'user', content: prompt }
                ],
                temperature: 0.5,
                max_tokens: 1800
              })
            });
            clearTimeout(timeoutId);

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              const rawText = aiData.choices?.[0]?.message?.content || '';
              const match = rawText.match(/\{[\s\S]*\}/);
              if (match) {
                const parsed = JSON.parse(match[0]);
                const benefitsHtml = (Array.isArray(parsed.benefits) ? parsed.benefits : [])
                  .map(
                    (b: any) =>
                      `<div style='margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;'>
                        <div style='font-size: 14.5px; font-weight: 700; color: #0f172a; margin-bottom: 3px;'>${b.icon || '✅'} ${b.title || ''}</div>
                        <div style='font-size: 13.5px; color: #475569; line-height: 1.55;'>${b.desc || ''}</div>
                      </div>`
                  )
                  .join('');
                const stepsHtml = (Array.isArray(parsed.steps) ? parsed.steps : [])
                  .map(
                    (s: any) =>
                      `<div style='margin-bottom: 10px; font-size: 13.5px; color: #334155; line-height: 1.5;'>
                        <strong style='color: #0f172a;'>${s.title || ''}:</strong> ${s.desc || ''}
                      </div>`
                  )
                  .join('');

                const richHtml = `<div style='max-width: 640px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Inter, Helvetica, Arial, sans-serif; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08); color: #1e293b;'>
  <div style='background: #0f172a; border-top: 4px solid #10b981; padding: 32px 28px;'>
    <span style='display: inline-block; background: rgba(16, 185, 129, 0.18); color: #34d399; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; padding: 5px 12px; border-radius: 9999px; border: 1px solid rgba(52, 211, 153, 0.3);'>${parsed.badge || 'GRUPO HORMESIS · SOLUCIÓN ESPECIALIZADA'}</span>
    <h1 style='color: #ffffff; font-size: 22px; font-weight: 800; margin: 14px 0 6px 0; line-height: 1.3;'>${parsed.headline || `Propuesta Estratégica: ${srvKey}`}</h1>
    <p style='color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.5;'>${parsed.subtitle || 'Preparado especialmente para [Nombre]'}</p>
  </div>
  <div style='padding: 28px;'>
    <p style='font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 14px 0;'>${parsed.introParagraph1 || ''}</p>
    <p style='font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 22px 0;'>${parsed.introParagraph2 || ''}</p>
    <div style='background: #f8fafc; border-left: 4px solid #10b981; border-radius: 8px; padding: 20px 22px; margin: 24px 0;'>
      <h3 style='margin: 0 0 14px 0; color: #0f172a; font-size: 16px; font-weight: 700;'>${parsed.valueBoxTitle || `⚡ Impacto directo en ${srvKey}`}</h3>
      ${benefitsHtml}
    </div>
    <div style='background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px 22px; margin: 22px 0;'>
      <h4 style='margin: 0 0 12px 0; color: #0f172a; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;'>📋 Hoja de Ruta de Implementación</h4>
      ${stepsHtml}
    </div>
    <div style='background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px 18px; color: #065f46; font-size: 13px; margin-bottom: 24px; line-height: 1.5;'>
      🔒 <strong>Garantía Grupo Hormesis:</strong> ${parsed.guarantee || 'Confidencialidad total y enfoque 100% en rentabilidad.'}
    </div>
    <div style='text-align: center; padding: 24px 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;'>
      <p style='margin: 0 0 16px 0; color: #0f172a; font-size: 15px; font-weight: 700;'>¿Evaluamos cómo aplicarlo a tu negocio en una sesión de 15 minutos?</p>
      <a href='[Link_Calendario]' target='_blank' style='display: inline-block; background: #10b981; color: #ffffff; padding: 14px 26px; border-radius: 8px; font-weight: 700; font-size: 14px; text-decoration: none; margin: 6px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);'>📅 Agendar Llamada de Diagnóstico (15 min)</a>
      <a href='${mailtoHref}' style='display: inline-block; background: #0f172a; color: #ffffff; padding: 13px 22px; border-radius: 8px; font-weight: 600; font-size: 13px; text-decoration: none; margin: 6px;'>✉️ Responder con Detalles por Correo</a>
    </div>
  </div>
  <div style='background: #0f172a; padding: 20px 28px; text-align: center; border-top: 1px solid #1e293b;'>
    <p style='margin: 0 0 4px 0; color: #f8fafc; font-size: 13px; font-weight: 700;'>Grupo Hormesis · Sistematización Empresarial e Inteligencia Artificial</p>
    <p style='margin: 0; color: #94a3b8; font-size: 12px;'><a href='https://grupohormesis.es' style='color: #34d399; text-decoration: none; font-weight: 600;'>grupohormesis.es</a></p>
  </div>
</div>`;

                return [
                  srvKey,
                  {
                    subject: parsed.subject || currentTpl?.subject || `Propuesta Estratégica: ${srvKey}`,
                    body: richHtml
                  }
                ];
              }
            }
          } catch (e) {}
        }

        return [
          srvKey,
          {
            subject: currentTpl?.subject || `Propuesta Estratégica: ${srvKey} | Grupo Hormesis`,
            body: ensureExecutiveFormEmailHtml(currentTpl?.body || '', srvKey, '[Link_Calendario]', mailtoHref)
          }
        ];
      };

      const entriesToRefine = Object.entries(templatesToRefine);
      const refinedEntries = await Promise.all(
        entriesToRefine.map(([srvKey, tpl], idx) => refineSingleService(srvKey, tpl, idx))
      );
      const newTemplates = Object.fromEntries(refinedEntries);

      if (service) {
        currentConfig.generated_responses[service] = newTemplates[service];
      } else {
        currentConfig.generated_responses = newTemplates;
      }
      await prisma.userWorkflow.update({
        where: { id },
        data: { config: currentConfig }
      });
      res.json({ generated_responses: currentConfig.generated_responses });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Error refinando plantillas' });
    }
  }
};
