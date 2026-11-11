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
    const fs = require('fs');
    const logFile = 'groq_debug.log';
    const log = (msg: string) => {
      console.log(msg);
      fs.appendFileSync(logFile, new Date().toISOString() + ' LOG: ' + msg + '\n');
    };
    const err = (msg: string, detail: any = '') => {
      console.error(msg, detail);
      fs.appendFileSync(logFile, new Date().toISOString() + ' ERR: ' + msg + ' ' + (typeof detail === 'object' ? JSON.stringify(detail) : detail) + '\n');
    };

    log('=== INICIANDO GENERATE TEMPLATES ===');

    res.setHeader('Content-Type', 'application/json');
    res.flushHeaders();
    const keepAliveInterval = setInterval(() => {
      res.write(' ');
    }, 10000);

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
        clearInterval(keepAliveInterval);
        err('Groq API Key no configurada.');
        return res.status(400).end(JSON.stringify({ error: 'Groq API Key no configurada.' }));
      }
      
      const generatedResponses: Record<string, {subject: string, body: string}> = {};
      const isOutreachMode = Boolean(brandVoice) || req.body.mode === 'outreach' || (Array.isArray(services) && services.length === 1 && services[0] === 'Propuesta de Negocios');
      
      for (const service of services) {
        log(`Generando correo (${isOutreachMode ? 'Outreach' : 'Formulario Premium'}) para: ${service}...`);
        
        const mailtoBody = `Hola equipo de Grupo Hormesis,\n\nHe recibido su propuesta inicial sobre ${service} y me gustaría avanzar con la Llamada de Diagnóstico (15 min).\n\n- Principal reto o necesidad actual:\n[Escribe brevemente aquí...]\n\n- Mejor horario tentativo:\n[Indica día/hora o agenda directo en el enlace del correo]\n\nSaludos,\n[Nombre]`;
        const mailtoHref = `mailto:ventas@grupohormesis.com?subject=${encodeURIComponent('Diagnóstico de Proyecto - ' + service)}&body=${encodeURIComponent(mailtoBody)}`;

        const prompt = isOutreachMode ? `
Eres un Master Copywriter B2B y un Diseñador Experto de Emails en HTML.
Tu objetivo es crear un "Cold Email" (correo en frío) ALTAMENTE efectivo y hermoso para ofrecer este servicio: "${service}".
Contexto de la Empresa (Grupo Hormesis): 
"${business_context}"

REQUISITOS ESTRICTOS DE ESTRATEGIA B2B Y COPYWRITING:
1. ASUNTO (SUBJECT): Debe ser MUY CORTO (4 a 7 palabras máximo), intrigante y casi informal. Evita sonar como un boletín comercial. (Ej: "Idea rápida para tu web", "Pregunta sobre tu arquitectura").
2. EL GANCHO (HOOK): No te presentes con "Hola, somos la agencia X". Inicia aportando valor directo, explicando que tras auditar su sitio web actual, prepararon una línea de diseño conceptual y detectaron problemas técnicos habituales que frenan sus conversiones.
3. ACLARACIÓN IMPORTANTE: Deja claro que la muestra visual generada NO es un producto final cerrado ni una plantilla rígida, sino una *dirección de diseño y punto de partida* que se adapta totalmente a su marca.
4. PROBLEMAS TÉCNICOS Y SOLUCIONES DE VALOR: Menciona 2-3 problemas técnicos comunes que suelen sufrir los negocios de su sector.
5. LONGITUD: El texto debe ser ágil, conciso y profesional (menos de 150 palabras).
6. CTA (Call To Action): Si les interesa resolver cualquiera de estos puntos técnicos o explorar esa línea de diseño, invítalos a pulsar el botón para agendar un Meet de 15 minutos o responder directamente a este correo.

REQUISITOS ESTRICTOS DE DISEÑO Y ESTRUCTURA (HTML):
1. Usa un diseño premium, limpio y corporativo con estilos inline.
2. OBLIGATORIO usar la línea de color de la marca: Azul Pizarra oscuro (#0f172a) y Verde Esmeralda (#10b981).
3. NO INCLUYAS BOTONES NI PIES DE PÁGINA (CRÍTICO): La plantilla maestra del sistema se encarga de inyectar automáticamente la cabecera corporativa, el GIF animado interactivo, la auditoría y los botones finales. Genera únicamente el texto persuasivo editorial y las viñetas de valor.
4. CRÍTICO PARA EL CÓDIGO HTML: Debes usar ÚNICAMENTE comillas simples (') para todos los atributos dentro de tus etiquetas HTML. NO uses comillas dobles internas porque romperán el JSON.
5. Usa [Nombre] para referirte al cliente. EVITA usar llaves { } en el texto para no romper el formato JSON.

Devuelve EXACTAMENTE Y SOLAMENTE un JSON válido con esta estructura (sin bloques markdown, solo llaves):
{
  "subject": "Asunto magnético de 4-7 palabras",
  "body": "<p style='font-size: 15px; color: #334155; margin-bottom: 12px;'>Gancho inicial...</p><ul style='color: #475569;'><li>...</li></ul>"
}
` : `
Eres un Director de Consultoría B2B y Diseñador Senior de Emails HTML Ejecutivos.
Un potencial cliente acaba de completar nuestro formulario web solicitando información sobre el servicio: "${service}".
Contexto de nuestra empresa (Grupo Hormesis):
"${business_context}"

Tu objetivo es crear una respuesta automática en HTML COMPLETA, EXTENSA, SOFISTICADA Y DE ALTA CONVERSIÓN para el servicio "${service}". NO hagas un correo simple ni corto; debe verse como una propuesta ejecutiva de primer nivel que genere máxima autoridad y confianza inmediata.

ESTRUCTURA VISUAL Y DE CONTENIDO OBLIGATORIA (TODO CON ESTILOS INLINE):
1. CONTENEDOR MAESTRO:
   - Un contenedor principal con max-width: 640px, margin: 0 auto, font-family: 'Segoe UI', Inter, Helvetica, Arial, sans-serif, background: #ffffff, border-radius: 14px, overflow: hidden, border: 1px solid #e2e8f0, box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08).
2. CABECERA EJECUTIVA (HEADER):
   - Fondo oscuro corporativo (#0f172a) con borde superior o acento en Verde Esmeralda (#10b981), padding: 32px 28px.
   - Una insignia superior (badge) con fondo rgba(16, 185, 129, 0.18), texto #34d399, font-size: 11px, font-weight: 700, letter-spacing: 1.2px, text-transform: uppercase (ej: 'GRUPO HORMESIS · SOLUCIÓN ESPECIALIZADA').
   - Un título H1 blanco (#ffffff, font-size: 23px, margin: 12px 0 6px 0) enfocado en transformar su área de "${service}".
   - Un subtítulo en gris claro (#94a3b8, font-size: 14px) dando la bienvenida a [Nombre].
3. APERTURA CONSULTIVA Y DIAGNÓSTICO DE DOLOR:
   - Saludo personalizado a [Nombre] confirmando su solicitud sobre "${service}".
   - 2 párrafos empáticos y estratégicos que demuestren profundo dominio técnico (conectando con el contexto de negocio y los cuellos de botella reales que enfrentan las empresas al intentar implementar "${service}" sin una arquitectura sólida).
4. CAJA DE PROPUESTA DE VALOR Y ENTREGABLES CLAVE:
   - Un bloque destacado (background: #f8fafc, border-left: 4px solid #10b981, border-radius: 8px, padding: 20px 22px, margin: 22px 0).
   - Título de sección en #0f172a (font-size: 16px, font-weight: 700).
   - 3 a 4 puntos de alto impacto con iconos (✅, ⚡, 📈, 🔒), donde cada punto tenga un título en negrita (#0f172a) y una explicación concreta del beneficio medible (ahorro de horas operativas, escalabilidad, precisión o retorno de inversión).
5. HOJA DE RUTA DE IMPLEMENTACIÓN (3 PASOS):
   - Una sección clara con fondo #ffffff, border: 1px solid #e2e8f0, border-radius: 10px, padding: 20px, margin: 22px 0, explicando qué ocurre a continuación:
     * Paso 1: Llamada de Diagnóstico Técnico (15 min) para evaluar su caso actual.
     * Paso 2: Diseño de Arquitectura y Propuesta a Medida con plazos y ROI claro.
     * Paso 3: Implementación Ágil, Integración y Acompañamiento Continuo.
6. SELLO DE GARANTÍA Y CONFIANZA:
   - Una franja en verde suave (background: #ecfdf5, border: 1px solid #a7f3d0, border-radius: 8px, padding: 14px 18px, color: #065f46, font-size: 13px) destacando confidencialidad, arquitectura a medida y enfoque 100% en rentabilidad.
7. SECCIÓN DE LLAMADA A LA ACCIÓN (CTA) CON 2 BOTONES:
   - Un bloque centrado (text-align: center, margin: 28px 0 18px 0, padding: 24px, background: #f8fafc, border-radius: 12px, border: 1px solid #e2e8f0):
     * Botón Principal (enlace a '[Link_Calendario]'): display: inline-block; background: #10b981; color: #ffffff; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 15px; text-decoration: none; margin: 6px; con el texto: '📅 Agendar Llamada de Diagnóstico (15 min)'
     * Botón Secundario (enlace a '${mailtoHref}'): display: inline-block; background: #0f172a; color: #ffffff; padding: 12px 22px; border-radius: 8px; font-weight: 600; font-size: 13px; text-decoration: none; margin: 6px; con el texto: '✉️ Responder con Detalles por Correo'
8. PIE DE PÁGINA CORPORATIVO (FOOTER):
   - Fondo #0f172a o #f1f5f9, padding: 20px 28px, texto centrado con la firma del Equipo de Ingeniería y Consultoría de Grupo Hormesis y enlace a https://grupohormesis.es.

REGLAS TÉCNICAS CRÍTICAS PARA EL JSON:
- Usa ÚNICAMENTE comillas simples (') para TODOS los atributos HTML (style='...', href='...'). JAMÁS uses comillas dobles dentro del valor de "body".
- Usa [Nombre] para el nombre del cliente y [Link_Calendario] para la URL del botón principal. NO uses llaves dobles en el HTML para no romper el JSON.
- Devuelve ÚNICAMENTE un objeto JSON válido (sin bloques markdown):
{
  "subject": "Asunto ejecutivo, cercano y magnético sobre ${service}",
  "body": "<div style='max-width: 640px; margin: 0 auto; ...'>...HTML completo aquí...</div>"
}
`;
        let success = false;
        let attempts = 0;
        
        while (!success && attempts < 5) {
          attempts++;
          try {
            log(`[${service}] Intento ${attempts}...`);
            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKeyToUse}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'openai/gpt-oss-120b',
                messages: [
                  { role: 'system', content: 'You are an elite HTML Email Designer and Copywriter that only responds in valid JSON. You must use single quotes for all HTML attributes to prevent JSON escaping errors. Do not use markdown blocks, just output the raw JSON.' },
                  { role: 'user', content: prompt }
                ],
                temperature: 0.6,
                max_tokens: 4000
              })
            });

            if (groqResponse.ok) {
              const aiData = await groqResponse.json();
              const rawText = aiData.choices[0].message.content;
              
              const match = rawText.match(/\{[\s\S]*\}/);
              if (match) {
                try {
                  const parsed = JSON.parse(match[0]);
                  if (!isOutreachMode && parsed && typeof parsed.body === 'string') {
                    parsed.body = ensureExecutiveFormEmailHtml(parsed.body, service, '[Link_Calendario]', mailtoHref);
                  }
                  generatedResponses[service] = parsed;
                  log(`✅ ¡Éxito con ${service}!`);
                  success = true;
                } catch (parseError: any) {
                  err(`❌ Intento ${attempts}: Error parseando JSON para ${service}. RAW TEXT: ${rawText}. ParseError: ${parseError.message}`);
                }
              } else {
                err(`❌ Intento ${attempts}: La IA no devolvió JSON para ${service}`);
              }
            } else {
              const errStatus = groqResponse.status;
              const errorText = await groqResponse.text();
              
              if (errStatus === 429) {
                let waitMs = 20000; 
                const timeMatch = errorText.match(/try again in ([\d.]+)s/);
                if (timeMatch && timeMatch[1]) {
                  waitMs = Math.ceil(parseFloat(timeMatch[1]) * 1000) + 2000; 
                }
                if (waitMs > 60000) {
                   err(`⚠️ Rate limit MUY ALTO (${waitMs/1000}s). Abortando este servicio.`);
                   break;
                }
                log(`⚠️ Rate limit (429). Esperando ${waitMs / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, waitMs));
              } else if (errStatus >= 500) {
                log(`⚠️ Error del servidor Groq (${errStatus}). Reintentando en 5s...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
              } else {
                err(`❌ Falló la API de Groq para ${service} con status ${errStatus}:`, errorText);
                break; 
              }
            }
          } catch (error: any) {
            err(`❌ Error de red/fetch con ${service}:`, error.message);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
        
        log(`⏱️ Descansando 3s antes del siguiente servicio...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      clearInterval(keepAliveInterval);
      const finalJson = JSON.stringify(generatedResponses);
      log(`=== FIN. Enviando JSON de tamaño: ${finalJson.length} bytes ===`);
      res.end(finalJson);
    } catch (error: any) {
      err('Error Fatal Catch:', error.message);
      clearInterval(keepAliveInterval);
      if (!res.headersSent) {
        res.status(500).end(JSON.stringify({ error: 'Error generando plantillas' }));
      } else {
        res.end(JSON.stringify({ error: 'Error interno generando plantillas' }));
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
      const groqCred = workflow.credentials.find((c: any) => c.type === 'groq_api_key');
      let apiKeyToUse = process.env.GROQ_API_KEY;
      if (groqCred) {
        apiKeyToUse = CredentialService.decrypt(groqCred.encrypted, groqCred.iv);
      }
      if (!apiKeyToUse) return res.status(400).json({ error: 'No se encontro API Key de Groq asociada a este workflow.' });
      // Filtrar para enviar a la IA solo lo que vamos a refinar
      const templatesToRefine = service 
        ? { [service]: currentConfig.generated_responses[service] } 
        : currentConfig.generated_responses;
      if (service && !templatesToRefine[service]) {
        return res.status(400).json({ error: 'El servicio especificado no existe en este workflow.' });
      }
      const userInstruction = (refinement_prompt || '').trim() || 'Transforma y enriquece completamente estas plantillas en correos HTML ejecutivos de alta conversión, con cabecera corporativa #0f172a, bloques de valor con checkmarks, hoja de ruta de 3 pasos, franja de garantía y botones de acción claros.';
      const businessContextInfo = currentConfig.businessContext ? `Contexto de la empresa: "${currentConfig.businessContext}"` : '';
      const aiPrompt = `
Eres un Director de Consultoría B2B y Diseñador Senior de Emails HTML Ejecutivos para Grupo Hormesis.
${businessContextInfo}
El usuario tiene actualmente estas plantillas de correo para responder a formularios web:
${JSON.stringify(templatesToRefine, null, 2)}

INSTRUCCIÓN DE MEJORA DEL USUARIO:
"${userInstruction}"

REQUISITOS OBLIGATORIOS DE DISEÑO Y ESTRUCTURA HTML (PARA CADA SERVICIO):
1. Aplica la instrucción del usuario y asegúrate de que cada correo tenga una estructura HTML EJECUTIVA COMPLETA Y SOFISTICADA (no un simple texto corto), con estilos inline:
   - Contenedor principal (max-width: 640px, margin: 0 auto, background: #ffffff, border-radius: 14px, border: 1px solid #e2e8f0, overflow: hidden, font-family: 'Segoe UI', Inter, Arial, sans-serif).
   - Cabecera corporativa en Azul Pizarra (#0f172a, padding: 30px 28px, borde superior #10b981) con insignia en Verde Esmeralda (#34d399), título impactante en blanco (#ffffff) sobre el servicio y subtítulo saludando a [Nombre].
   - Cuerpo consultivo (padding: 28px) que conecte con los retos del cliente, una caja destacada de Propuesta de Valor y Entregables (background: #f8fafc, border-left: 4px solid #10b981, padding: 20px, con 3-4 puntos clave con iconos ✅/⚡/📈), y una Hoja de Ruta en 3 pasos claros (1. Diagnóstico de 15 min, 2. Propuesta y Arquitectura a Medida, 3. Implementación Ágil).
   - Franja de garantía/confianza (background: #ecfdf5, border: 1px solid #a7f3d0, color: #065f46, padding: 14px 18px, border-radius: 8px).
   - Bloque de Llamada a la Acción (CTA) centrado con Botón Principal en Verde Esmeralda (#10b981, texto #ffffff, href='[Link_Calendario]', texto '📅 Agendar Llamada de Diagnóstico (15 min)') y Botón Secundario (#0f172a, texto #ffffff, href='mailto:ventas@grupohormesis.com', texto '✉️ Responder por Correo').
   - Pie de página corporativo de Grupo Hormesis (https://grupohormesis.es).
2. Usa [Nombre] para referirte al cliente y [Link_Calendario] para el enlace de agendar reunión.
3. CRÍTICO PARA EL CÓDIGO HTML: Debes usar ÚNICAMENTE comillas simples (') para todos los atributos dentro de tus etiquetas HTML. NO uses comillas dobles internas porque romperán el JSON.
4. Devuelve EXACTAMENTE un JSON válido (sin bloques Markdown, sin texto antes ni después) manteniendo las mismas claves de servicio:
{
  "NombreDelServicio": {
    "subject": "Asunto ejecutivo mejorado",
    "body": "<div style='max-width: 640px; ...'>...</div>"
  }
}
`;
      const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKeyToUse}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          messages: [
            { role: 'system', content: 'You are a helpful JSON-only assistant. You must use single quotes for all HTML attributes to prevent JSON escaping errors. Do not use markdown blocks, just output the raw JSON.' },
            { role: 'user', content: aiPrompt }
          ],
          temperature: 0.5,
          max_tokens: 4000
        })
      });
      if (!aiResponse.ok) {
        const errData = await aiResponse.json();
        return res.status(500).json({ error: 'Groq API error: ' + JSON.stringify(errData) });
      }
      const aiData = await aiResponse.json();
      let rawText = aiData.choices[0].message.content;
      const match = rawText.match(/\{[\s\S]*\}/);
      rawText = match ? match[0] : rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      let newTemplates;
      try {
        newTemplates = JSON.parse(rawText);
      } catch (parseError: any) {
        console.error("❌ RAW TEXT GROQ REFINE:", rawText);
        return res.status(500).json({ 
          error: 'Error de parseo JSON desde Groq.', 
          details: rawText 
        });
      }
      // Asegurar que cada plantilla refinada conserve la estructura ejecutiva completa
      for (const [srvKey, tplVal] of Object.entries(newTemplates as Record<string, any>)) {
        if (tplVal && typeof tplVal.body === 'string') {
          tplVal.body = ensureExecutiveFormEmailHtml(tplVal.body, srvKey, '[Link_Calendario]');
        }
      }
      // Si fue un solo servicio, mergear con los existentes. Si fueron todos, reemplazar.
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
