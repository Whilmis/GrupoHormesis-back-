import { Request, Response } from 'express';
import prisma from '../config/db';
import { CredentialService } from '../services/credential.service';
import { ExecutionEngine, ensureExecutiveFormEmailHtml, extractBusinessNameFromText, extractBrandColors } from '../services/execution.engine';
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
      const workflow = await prisma.userWorkflow.findUnique({
        where: { id },
        include: { template: true }
      });
      if (!workflow) return res.status(404).json({ error: 'Workflow no encontrado' });
      if (!workflow.isActive) return res.status(400).json({ error: 'El workflow está inactivo' });

      // 1. Evitar ejecuciones simultáneas del mismo workflow que sobrecarguen la RAM en Railway
      const activeExec = await prisma.workflowExecution.findFirst({
        where: {
          userWorkflowId: id,
          status: 'running',
          startedAt: { gte: new Date(Date.now() - 3 * 60 * 1000) } // Menos de 3 minutos
        },
        orderBy: { startedAt: 'desc' },
        select: { id: true, startedAt: true }
      });

      if (activeExec) {
        console.log(`[workflowController] Workflow ${id} ya tiene una ejecución activa (${activeExec.id}). Conectando al frontend...`);
        return res.json({
          message: 'El workflow ya se está ejecutando en segundo plano.',
          runningInBackground: true,
          executionId: activeExec.id,
          result: {
            isRunningInBackground: true,
            message: 'Ya hay una ejecución activa en curso. Mostrando progreso en tiempo real...',
            leads: []
          }
        });
      }

      // 2. Si es un workflow pesado (Google Maps, Crawler Puppeteer o Outreach), responder de inmediato en segundo plano
      const isHeavy = ['lead_collector', 'auto_outreach_google_maps', 'google_stitch_designer'].includes(
        workflow.template?.typeIdentifier
      );

      if (isHeavy) {
        console.log(`[workflowController] Iniciando workflow pesado (${workflow.template?.typeIdentifier}) en background para ID: ${id}`);
        ExecutionEngine.executeWorkflow(id).catch(err => {
          console.error(`[workflowController] Error en background para WF ${id}:`, err);
        });

        // Pequeño descanso de 300ms para asegurar que el registro 'running' esté listo en PostgreSQL
        await new Promise(r => setTimeout(r, 300));
        const newExec = await prisma.workflowExecution.findFirst({
          where: { userWorkflowId: id },
          orderBy: { startedAt: 'desc' },
          select: { id: true }
        });

        return res.json({
          message: 'El workflow se ha iniciado en segundo plano con éxito.',
          runningInBackground: true,
          executionId: newExec?.id,
          result: {
            isRunningInBackground: true,
            message: 'Iniciando búsqueda de leads y auditoría web con IA en segundo plano...',
            searchQuery: 'Recolector de leads en curso',
            total_found: 0,
            audited_leads: 0,
            leads: []
          }
        });
      }

      // 3. Workflows ligeros (como form_contact_handler): ejecutar directamente con race de 25s
      const executionPromise = ExecutionEngine.executeWorkflow(id);
      const timeoutPromise = new Promise<{ isTimeout: true; result?: undefined }>((resolve) => {
        setTimeout(() => resolve({ isTimeout: true }), 25000);
      });

      const outcome = await Promise.race([
        executionPromise.then(result => ({ isTimeout: false as const, result })),
        timeoutPromise
      ]);

      if (outcome.isTimeout) {
        console.log(`[workflowController] Workflow ID ${id} supera los 25s. Pasando a segundo plano.`);
        executionPromise.catch(err => {
          console.error(`[workflowController] Error en background para WF ${id}:`, err);
        });

        return res.json({
          message: 'El workflow se está procesando en segundo plano.',
          runningInBackground: true,
          result: {
            isRunningInBackground: true,
            message: 'El workflow continúa ejecutándose en el servidor.',
            leads: []
          }
        });
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
      const { business_context, business_name, brand_voice, services, groqCredentialId } = req.body;
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
        Boolean(brand_voice || req.body.brandVoice) &&
        (req.body.mode === 'outreach' || (serviceList.length === 1 && serviceList[0] === 'Propuesta de Negocios'));

      const brandVoiceText = brand_voice || req.body.brandVoice || '';
      const companyName =
        business_name ||
        req.body.businessName ||
        extractBusinessNameFromText(business_context, 'Nuestra Empresa');
      const colors = extractBrandColors(brandVoiceText || business_context);

      const buildExecutiveHtmlFromStructured = (
        serviceName: string,
        data: any,
        bookingUrl: string = '[Link_Calendario]'
      ): string => {
        const comp = data?.companyName || companyName;
        const primary = data?.primaryColor || colors.primary;
        const accent = data?.accentColor || colors.accent;
        const badge = data?.badge || `${comp.toUpperCase()} · PROPUESTA ESTRATÉGICA`;
        const headline = data?.headline || `Propuesta: ${serviceName}`;
        const subtitle = data?.subtitle || 'Diagnóstico y propuesta personalizada para [Nombre]';
        const p1 =
          data?.introParagraph1 ||
          `Hola <strong style='color: ${primary};'>[Nombre]</strong>, hemos recibido tu solicitud sobre <strong style='color: ${primary};'>${serviceName}</strong> en ${comp}.`;
        const p2 =
          data?.introParagraph2 ||
          `En ${comp} nos especializamos en ofrecer soluciones diseñadas a medida para optimizar tus resultados y maximizar el rendimiento de tu inversión.`;
        const valueBoxTitle = data?.valueBoxTitle || `⚡ ¿Por qué elegir ${comp} para ${serviceName}?`;
        const benefits: Array<{ icon?: string; title?: string; desc?: string }> =
          Array.isArray(data?.benefits) && data.benefits.length > 0
            ? data.benefits
            : [
                {
                  icon: '✅',
                  title: 'Solución 100% a Medida',
                  desc: `Adaptamos cada aspecto de ${serviceName} a las necesidades específicas de tu negocio.`
                },
                {
                  icon: '⚡',
                  title: 'Eficiencia y Resultados Ágiles',
                  desc: 'Eliminamos fricciones y aceleramos tiempos de respuesta desde el primer momento.'
                },
                {
                  icon: '📈',
                  title: 'Garantía y Acompañamiento',
                  desc: 'Atención cercana, comunicación continua y enfoque absoluto en satisfacción y ROI.'
                }
              ];
        const steps: Array<{ title?: string; desc?: string }> =
          Array.isArray(data?.steps) && data.steps.length > 0
            ? data.steps
            : [
                {
                  title: '1. Diagnóstico Inicial',
                  desc: 'Evaluamos tu situación actual y objetivos clave sin compromiso.'
                },
                {
                  title: '2. Propuesta & Plan de Acción',
                  desc: 'Definimos el alcance, plazos de entrega y presupuesto personalizado.'
                },
                {
                  title: '3. Ejecución y Soporte',
                  desc: 'Despliegue ágil con garantía técnica y acompañamiento profesional.'
                }
              ];
        const guarantee =
          data?.guarantee ||
          'Compromiso de calidad, total confidencialidad y garantía de satisfacción.';

        const benefitsHtml = benefits
          .map(
            (b) =>
              `<div style='margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;'>
                <div style='font-size: 14.5px; font-weight: 700; color: ${primary}; margin-bottom: 3px;'>${b.icon || '✅'} ${b.title || 'Beneficio Clave'}</div>
                <div style='font-size: 13.5px; color: #475569; line-height: 1.55;'>${b.desc || ''}</div>
              </div>`
          )
          .join('');

        const stepsHtml = steps
          .map(
            (s) =>
              `<div style='margin-bottom: 10px; font-size: 13.5px; color: #334155; line-height: 1.5;'>
                <strong style='color: ${primary};'>${s.title || 'Paso'}:</strong> ${s.desc || ''}
              </div>`
          )
          .join('');

        const ctaBooking = data?.ctaBookingText || '📅 Agendar Llamada o Cita (15 min)';
        const footerComp = data?.footerCompany || comp;

        return `<div style='max-width: 640px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Inter, Helvetica, Arial, sans-serif; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08); color: #1e293b;'>
  <div style='background: ${primary}; border-top: 4px solid ${accent}; padding: 32px 28px;'>
    <span style='display: inline-block; background: rgba(255, 255, 255, 0.15); color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; padding: 5px 12px; border-radius: 9999px; border: 1px solid rgba(255, 255, 255, 0.25);'>${badge}</span>
    <h1 style='color: #ffffff; font-size: 22px; font-weight: 800; margin: 14px 0 6px 0; line-height: 1.3;'>${headline}</h1>
    <p style='color: #cbd5e1; font-size: 14px; margin: 0; line-height: 1.5;'>${subtitle}</p>
  </div>
  <div style='padding: 28px;'>
    <p style='font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 14px 0;'>${p1}</p>
    <p style='font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 22px 0;'>${p2}</p>
    <div style='background: #f8fafc; border-left: 4px solid ${accent}; border-radius: 8px; padding: 20px 22px; margin: 24px 0;'>
      <h3 style='margin: 0 0 14px 0; color: ${primary}; font-size: 16px; font-weight: 700;'>${valueBoxTitle}</h3>
      ${benefitsHtml}
    </div>
    <div style='background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px 22px; margin: 22px 0;'>
      <h4 style='margin: 0 0 12px 0; color: ${primary}; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;'>📋 Hoja de Ruta</h4>
      ${stepsHtml}
    </div>
    <div style='background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; color: #334155; font-size: 13px; margin-bottom: 24px; line-height: 1.5;'>
      🔒 <strong>Compromiso ${comp}:</strong> ${guarantee}
    </div>
    <div style='text-align: center; padding: 24px 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;'>
      <p style='margin: 0 0 16px 0; color: ${primary}; font-size: 15px; font-weight: 700;'>¿Deseas evaluar tu caso directamente con nosotros?</p>
      <a href='${bookingUrl}' target='_blank' style='display: inline-block; background: ${accent}; color: #ffffff; padding: 14px 26px; border-radius: 8px; font-weight: 700; font-size: 14px; text-decoration: none; margin: 6px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);'>${ctaBooking}</a>
      <a href='mailto:?subject=${encodeURIComponent('Consulta sobre ' + serviceName + ' - ' + comp)}' style='display: inline-block; background: ${primary}; color: #ffffff; padding: 13px 22px; border-radius: 8px; font-weight: 600; font-size: 13px; text-decoration: none; margin: 6px;'>✉️ Responder por Correo</a>
    </div>
  </div>
  <div style='background: ${primary}; padding: 18px 28px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1);'>
    <p style='margin: 0; color: #f8fafc; font-size: 13px; font-weight: 700;'>${footerComp}</p>
  </div>
</div>`;
      };

      const modelsCascade = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant'];

      const generateForSingleService = async (service: string, idx: number): Promise<[string, { subject: string; body: string }]> => {
        const prompt = isOutreachMode
          ? `Eres un Copywriter experto en captación B2B para la empresa "${companyName}".
Contexto de la empresa: "${business_context}"
Tono y Línea de Color: "${brandVoiceText || 'Profesional y persuasivo'}"
Servicio ofrecido: "${service}"

Crea un Cold Email persuasivo en HTML para ofrecer "${service}".
REGLAS ESTRICTAS:
1. Representas ÚNICAMENTE a "${companyName}". NUNCA menciones a Grupo Hormesis ni empresas externas que no pertenezcan al contexto dado.
2. Asunto corto (4-7 palabras).
3. Gancho directo y 2-3 oportunidades de valor para el cliente.
4. Usa comillas simples (') en atributos HTML y [Nombre] para el cliente.
Devuelve SOLO un JSON válido:
{
  "subject": "Asunto magnético corto",
  "body": "<p style='font-size: 15px; color: #334155; margin-bottom: 12px;'>...</p><ul style='color: #475569;'><li>...</li></ul>"
}`
          : `Eres el Director Comercial y Consultor Estratégico de la empresa "${companyName}".
Contexto del negocio y servicios: "${business_context}"
Línea de Color / Identidad Visual: "${brandVoiceText || 'Profesional acorde al sector'}"
Servicio solicitado: "${service}"

Un cliente potencial ([Nombre]) ha solicitado información en el formulario web sobre el servicio "${service}".
Redacta una respuesta comercial ejecutiva y de alto valor adaptada 100% a la propuesta de valor y tono de "${companyName}".

REGLAS OBLIGATORIAS:
1. El correo es emitido por "${companyName}". NUNCA menciones a Grupo Hormesis ni a ninguna entidad ajena al contexto del negocio.
2. Propón la paleta de colores para este negocio:
   - "primaryColor": color hexadecimal oscuro para fondo de cabecera y botones secundarios (ej: '#0f172a', '#1e3a8a', '#18181b', '#1e293b', etc.)
   - "accentColor": color hexadecimal vibrante para acentos y botón principal (ej: '#10b981', '#2563eb', '#f59e0b', '#7c3aed', '#0284c7', etc.)
3. Usa [Nombre] para el cliente. NO uses comillas dobles internas en textos que rompan el JSON.
4. Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta:
{
  "companyName": "${companyName}",
  "primaryColor": "${colors.primary}",
  "accentColor": "${colors.accent}",
  "subject": "Asunto personalizado y magnético sobre ${service} (6-10 palabras)",
  "badge": "${companyName.toUpperCase()} · PROPUESTA PERSONALIZADA",
  "headline": "Título potente enfocado en ${service}",
  "subtitle": "Información y propuesta preparada para [Nombre]",
  "introParagraph1": "Saludo a [Nombre] confirmando su solicitud sobre ${service} y destacando el objetivo principal.",
  "introParagraph2": "Segundo párrafo explicando cómo ${companyName} resuelve su necesidad con excelencia y garantías.",
  "valueBoxTitle": "⚡ Ventajas clave de nuestra solución de ${service}",
  "benefits": [
    { "icon": "✅", "title": "Beneficio 1 específico", "desc": "Descripción orientada a valor y satisfacción." },
    { "icon": "⚡", "title": "Beneficio 2 específico", "desc": "Descripción sobre rapidez, profesionalidad y resultados." },
    { "icon": "📈", "title": "Beneficio 3 específico", "desc": "Descripción sobre garantía y confianza." }
  ],
  "steps": [
    { "title": "1. Diagnóstico / Asesoría Inicial", "desc": "Analizamos tus requerimientos particulares sin compromiso." },
    { "title": "2. Plan de Acción y Presupuesto a Medida", "desc": "Te presentamos la propuesta detallada adaptada a tus objetivos." },
    { "title": "3. Ejecución y Acompañamiento", "desc": "Despliegue del servicio con seguimiento cercano." }
  ],
  "guarantee": "Compromiso de calidad, atención personalizada y garantía de satisfacción.",
  "ctaBookingText": "📅 Agendar Llamada o Cita de Consulta",
  "footerCompany": "${companyName}"
}`;

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
                    ? ensureExecutiveFormEmailHtml(parsed.body, service, '[Link_Calendario]', {
                        companyName,
                        businessContext: business_context,
                        brandVoice: brandVoiceText,
                        primaryColor: parsed.primaryColor || colors.primary,
                        accentColor: parsed.accentColor || colors.accent
                      })
                    : buildExecutiveHtmlFromStructured(service, parsed, '[Link_Calendario]');
                  return [
                    service,
                    {
                      subject: parsed.subject || `Propuesta e Información: ${service} | ${companyName}`,
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

        // Fallback de respaldo adaptado al negocio
        log(`[${service}] Usando plantilla ejecutiva estructurada adaptada a ${companyName}.`);
        return [
          service,
          {
            subject: `Propuesta e Información: ${service} | ${companyName}`,
            body: buildExecutiveHtmlFromStructured(service, {}, '[Link_Calendario]')
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
        'Transforma y enriquece completamente el contenido para que sea una propuesta ejecutiva de máxima persuasión y valor.';
      const compName =
        currentConfig.businessName ||
        extractBusinessNameFromText(currentConfig.businessContext, workflow.name || 'Nuestra Empresa');
      const brandColors = extractBrandColors(currentConfig.brandVoice || currentConfig.businessContext);
      const businessContextInfo = currentConfig.businessContext || `Empresa: ${compName}`;
      const modelsCascade = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant'];

      const refineSingleService = async (srvKey: string, currentTpl: any, idx: number): Promise<[string, { subject: string; body: string }]> => {
        const currentPlainSnippet = (currentTpl?.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 600);
        const prompt = `Eres el Director Comercial de "${compName}".
Contexto de la empresa: "${businessContextInfo}"
Línea de color / Identidad: "${currentConfig.brandVoice || 'Profesional'}"
Servicio: "${srvKey}"
Asunto actual: "${currentTpl?.subject || srvKey}"
Resumen del contenido actual: "${currentPlainSnippet}"

INSTRUCCIÓN DE MEJORA DEL USUARIO:
"${userInstruction}"

Reescribe y mejora el contenido aplicando la instrucción del usuario para el servicio "${srvKey}". Usa [Nombre] para referirte al cliente.
REGLA OBLIGATORIA: El correo es emitido exclusivamente por "${compName}". NUNCA menciones a Grupo Hormesis ni entidades ajenas.
Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:
{
  "companyName": "${compName}",
  "primaryColor": "${brandColors.primary}",
  "accentColor": "${brandColors.accent}",
  "subject": "Asunto personalizado mejorado (6-10 palabras)",
  "badge": "${compName.toUpperCase()} · PROPUESTA ESPECIALIZADA",
  "headline": "Título ejecutivo potente enfocado en ${srvKey}",
  "subtitle": "Propuesta y asesoramiento para [Nombre]",
  "introParagraph1": "Primer párrafo consultivo aplicando la mejora solicitada y saludando a [Nombre].",
  "introParagraph2": "Segundo párrafo consultivo de autoridad y resultados en ${compName}.",
  "valueBoxTitle": "⚡ Ventajas clave de nuestra solución de ${srvKey}",
  "benefits": [
    { "icon": "✅", "title": "Beneficio clave 1", "desc": "Descripción persuasiva." },
    { "icon": "⚡", "title": "Beneficio clave 2", "desc": "Descripción persuasiva." },
    { "icon": "📈", "title": "Beneficio clave 3", "desc": "Descripción persuasiva." }
  ],
  "steps": [
    { "title": "1. Diagnóstico Inicial", "desc": "Analizamos tus requerimientos particulares." },
    { "title": "2. Plan de Acción y Propuesta", "desc": "Detalle de alcance y presupuesto personalizado." },
    { "title": "3. Ejecución y Garantía", "desc": "Despliegue ágil con seguimiento." }
  ],
  "guarantee": "Compromiso de calidad, confidencialidad y garantía de satisfacción.",
  "ctaBookingText": "📅 Agendar Llamada o Cita de Consulta",
  "footerCompany": "${compName}"
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
                const comp = parsed.companyName || compName;
                const primary = parsed.primaryColor || brandColors.primary;
                const accent = parsed.accentColor || brandColors.accent;

                const benefitsHtml = (Array.isArray(parsed.benefits) ? parsed.benefits : [])
                  .map(
                    (b: any) =>
                      `<div style='margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;'>
                        <div style='font-size: 14.5px; font-weight: 700; color: ${primary}; margin-bottom: 3px;'>${b.icon || '✅'} ${b.title || ''}</div>
                        <div style='font-size: 13.5px; color: #475569; line-height: 1.55;'>${b.desc || ''}</div>
                      </div>`
                  )
                  .join('');
                const stepsHtml = (Array.isArray(parsed.steps) ? parsed.steps : [])
                  .map(
                    (s: any) =>
                      `<div style='margin-bottom: 10px; font-size: 13.5px; color: #334155; line-height: 1.5;'>
                        <strong style='color: ${primary};'>${s.title || ''}:</strong> ${s.desc || ''}
                      </div>`
                  )
                  .join('');

                const richHtml = `<div style='max-width: 640px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Inter, Helvetica, Arial, sans-serif; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08); color: #1e293b;'>
  <div style='background: ${primary}; border-top: 4px solid ${accent}; padding: 32px 28px;'>
    <span style='display: inline-block; background: rgba(255, 255, 255, 0.15); color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; padding: 5px 12px; border-radius: 9999px; border: 1px solid rgba(255, 255, 255, 0.25);'>${parsed.badge || `${comp.toUpperCase()} · PROPUESTA ESPECIALIZADA`}</span>
    <h1 style='color: #ffffff; font-size: 22px; font-weight: 800; margin: 14px 0 6px 0; line-height: 1.3;'>${parsed.headline || `Propuesta: ${srvKey}`}</h1>
    <p style='color: #cbd5e1; font-size: 14px; margin: 0; line-height: 1.5;'>${parsed.subtitle || 'Preparado especialmente para [Nombre]'}</p>
  </div>
  <div style='padding: 28px;'>
    <p style='font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 14px 0;'>${parsed.introParagraph1 || ''}</p>
    <p style='font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 22px 0;'>${parsed.introParagraph2 || ''}</p>
    <div style='background: #f8fafc; border-left: 4px solid ${accent}; border-radius: 8px; padding: 20px 22px; margin: 24px 0;'>
      <h3 style='margin: 0 0 14px 0; color: ${primary}; font-size: 16px; font-weight: 700;'>${parsed.valueBoxTitle || `⚡ Ventajas en ${srvKey}`}</h3>
      ${benefitsHtml}
    </div>
    <div style='background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px 22px; margin: 22px 0;'>
      <h4 style='margin: 0 0 12px 0; color: ${primary}; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;'>📋 Hoja de Ruta</h4>
      ${stepsHtml}
    </div>
    <div style='background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; color: #334155; font-size: 13px; margin-bottom: 24px; line-height: 1.5;'>
      🔒 <strong>Compromiso ${comp}:</strong> ${parsed.guarantee || 'Calidad profesional y garantía de satisfacción.'}
    </div>
    <div style='text-align: center; padding: 24px 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;'>
      <p style='margin: 0 0 16px 0; color: ${primary}; font-size: 15px; font-weight: 700;'>¿Evaluamos cómo aplicarlo a tu caso en una sesión de 15 minutos?</p>
      <a href='[Link_Calendario]' target='_blank' style='display: inline-block; background: ${accent}; color: #ffffff; padding: 14px 26px; border-radius: 8px; font-weight: 700; font-size: 14px; text-decoration: none; margin: 6px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);'>${parsed.ctaBookingText || '📅 Agendar Llamada o Cita (15 min)'}</a>
      <a href='mailto:?subject=${encodeURIComponent('Consulta sobre ' + srvKey + ' - ' + comp)}' style='display: inline-block; background: ${primary}; color: #ffffff; padding: 13px 22px; border-radius: 8px; font-weight: 600; font-size: 13px; text-decoration: none; margin: 6px;'>✉️ Responder por Correo</a>
    </div>
  </div>
  <div style='background: ${primary}; padding: 18px 28px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1);'>
    <p style='margin: 0; color: #f8fafc; font-size: 13px; font-weight: 700;'>${parsed.footerCompany || comp}</p>
  </div>
</div>`;

                return [
                  srvKey,
                  {
                    subject: parsed.subject || currentTpl?.subject || `Propuesta: ${srvKey} | ${comp}`,
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
            subject: currentTpl?.subject || `Propuesta: ${srvKey} | ${compName}`,
            body: ensureExecutiveFormEmailHtml(currentTpl?.body || '', srvKey, '[Link_Calendario]', {
              companyName: compName,
              businessContext: businessContextInfo,
              brandVoice: currentConfig.brandVoice
            })
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
