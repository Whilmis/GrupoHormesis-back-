import { Request, Response } from 'express';
import prisma from '../config/db';
import { CredentialService } from '../services/credential.service';
import { ExecutionEngine } from '../services/execution.engine';
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
      // Race de seguridad de 25s: Si un workflow con muchas tareas toma más tiempo,
      // respondemos 200 con ejecución en segundo plano para evitar que el proxy de Railway (60s)
      // corte la conexión con 502 Bad Gateway y bloqueos de CORS.
      const executionPromise = ExecutionEngine.executeWorkflow(id);
      const timeoutPromise = new Promise<{ isTimeout: true }>((resolve) => {
        setTimeout(() => resolve({ isTimeout: true }), 12000);
      });

      const outcome = await Promise.race([
        executionPromise.then(result => ({ isTimeout: false, result })),
        timeoutPromise
      ]);

      if (outcome.isTimeout) {
        console.log(`[workflowController] Workflow ID ${id} supera los 25s. Respondiendo 200 en segundo plano.`);
        // Asegurar que errores en background no queden sin atrapar
        executionPromise.catch(err => {
          console.error(`[workflowController] Error en background para WF ${id}:`, err);
        });

        res.json({
          message: 'El workflow se está ejecutando en segundo plano. Puedes revisar los avances en el panel.',
          runningInBackground: true
        });
        return;
      }

      console.log(`[workflowController] === executeWorkflow SUCCESS for ID: ${id} ===`);
      res.json({ message: 'Ejecucion completada', result: outcome.result });
    } catch (error: any) {
      console.error(`[workflowController] === executeWorkflow ERROR for ID: ${id}:`, error);
      res.status(500).json({ error: error.message || 'Error en ejecucion' });
    }
  },

  async getExecutions(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const formSubmissions = await prisma.formSubmission.findMany({
        where: { workflowId: id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          referredBy: {
            select: {
              name: true
            }
          }
        }
      });

      res.json(formSubmissions.map(f => ({ ...f, type: 'form' })));
    } catch (error) {
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
      
      for (const service of services) {
        log(`Generando correo para: ${service}...`);
        
        const mailtoBody = `Hola equipo de Grupo Hormesis,\n\nMe interesa avanzar con la evaluación de nuestro proyecto de ${service}. \n\nPara darles más contexto técnico y de negocio antes de nuestra Llamada de Descubrimiento, aquí les detallo nuestra situación:\n\n- Breve descripción de nuestro principal cuello de botella o necesidad actual:\n[Por favor, escribe aquí...]\n\n- Nuestro objetivo principal a nivel de negocio con esta implementación:\n[Por favor, escribe aquí...]\n\n(Opcional) Ya he agendado la reunión a través del botón adjunto para la siguiente fecha/hora:\n[Pega aquí la fecha/hora de la reunión]\n\nQuedo a la espera de sus comentarios.\n\nSaludos cordiales,\n[Nombre]`;

        const prompt = `
Eres un Master Copywriter B2B y un Diseñador Experto de Emails en HTML.
Tu objetivo es crear un "Cold Email" (correo en frío) ALTAMENTE efectivo y hermoso para ofrecer este servicio: "${service}".
Contexto de la Empresa (Grupo Hormesis): 
"${business_context}"

REQUISITOS ESTRICTOS DE ESTRATEGIA B2B Y COPYWRITING:
1. ASUNTO (SUBJECT): Debe ser MUY CORTO (4 a 7 palabras máximo), intrigante y casi informal. Evita sonar como un boletín comercial. (Ej: "Idea rápida para tu web", "Pregunta sobre tu arquitectura").
2. EL GANCHO (HOOK): No te presentes con "Hola, somos la agencia X". Inicia aportando valor directo, explicando que tras auditar su sitio web actual, prepararon una línea de diseño conceptual y detectaron problemas técnicos habituales que frenan sus conversiones.
3. ACLARACIÓN IMPORTANTE: Deja claro que la muestra visual generada NO es un producto final cerrado ni una plantilla rígida, sino una *dirección de diseño y punto de partida* que se adapta totalmente a su marca.
4. PROBLEMAS TÉCNICOS Y SOLUCIONES DE VALOR: Menciona 2-3 problemas técnicos comunes que suelen sufrir los negocios de su sector (ej: si es gastronomía, sistemas de reservas propios sin comisiones o automatización de reseñas con IA; si es inmobiliaria, cualificación automática y velocidad de catálogo; si es clínica, recordatorios de citas automáticos y chatbots 24/7).
5. LONGITUD: El texto debe ser ágil, conciso y profesional (menos de 150 palabras).
6. CTA (Call To Action): Si les interesa resolver cualquiera de estos puntos técnicos o explorar esa línea de diseño, invítalos a pulsar el botón para agendar un Meet de 15 minutos o responder directamente a este correo.

REQUISITOS ESTRICTOS DE DISEÑO Y ESTRUCTURA (HTML):
1. Usa un diseño premium, limpio y corporativo con estilos inline.
2. OBLIGATORIO usar la línea de color de la marca: 
   - Azul Pizarra oscuro (#0f172a) para encabezados o textos principales.
   - Verde Esmeralda (#10b981) para botones o acentos.
3. NO incluyas miniaturas de video ni menciones la palabra video. Céntrate en la auditoría técnica, la línea de diseño conceptual y las soluciones de negocio.

4. NO INCLUYAS BOTONES NI PIES DE PÁGINA (CRÍTICO): La plantilla maestra del sistema se encarga de inyectar automáticamente la cabecera corporativa, el GIF animado interactivo, la auditoría y los botones finales de 'Agendar Reunión' y 'Responder'. Genera únicamente el texto persuasivo editorial y las viñetas de valor.
5. CRÍTICO PARA EL CÓDIGO HTML: Debes usar ÚNICAMENTE comillas simples (') para todos los atributos dentro de tus etiquetas HTML. NO uses comillas dobles internas porque romperán el JSON.
6. Usa [Nombre] para referirte al cliente. EVITA usar llaves { } en el texto para no romper el formato JSON.

Devuelve EXACTAMENTE Y SOLAMENTE un JSON válido con esta estructura (sin bloques markdown, solo llaves):
{
  "subject": "Asunto magnético de 4-7 palabras",
  "body": "<p style='font-size: 15px; color: #334155; margin-bottom: 12px;'>Gancho inicial...</p><ul style='color: #475569;'><li>...</li></ul>"
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
                  generatedResponses[service] = JSON.parse(match[0]);
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
      const aiPrompt = `
Eres un Master Copywriter experto en ventas B2B. El usuario ya ha generado estas plantillas de correo:
${JSON.stringify(templatesToRefine, null, 2)}
Ahora, el usuario te pide que las MEJORES o MODIFIQUES siguiendo esta instruccion exacta:
"${refinement_prompt}"
Reglas:
1. Aplica la peticion del usuario a las plantillas proporcionadas.
2. Manten el formato HTML limpio sin etiquetas html/head/body. Usa estilos inline.
3. Devuelve EXACTAMENTE un JSON valido (sin formato Markdown, sin texto antes ni despues) con la misma estructura (un objeto por cada servicio).
4. CRÍTICO PARA EL CÓDIGO HTML: Debes usar ÚNICAMENTE comillas simples (') para todos los atributos dentro de tus etiquetas HTML. NO uses comillas dobles internas porque romperán el JSON.
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
