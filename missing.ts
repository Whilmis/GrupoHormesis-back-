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
    try {
      const { id } = req.params;
      // Ejecutar motor
      const result = await ExecutionEngine.executeWorkflow(id);
      
      res.json({ message: 'Ejecucion completada', result });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error en ejecucion' });
    }
  },

  async getExecutions(req: Request, res: Response) {
    try {
      const { id } = req.params; // ID del UserWorkflow
      const executions = await prisma.workflowExecution.findMany({
        where: { userWorkflowId: id },
        orderBy: { startedAt: 'desc' },
        take: 10
      });
      res.json(executions);
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

  async generateTemplates(req: Request, res: Response) {
    try {
      const { workflowId, groqCredentialId } = req.body;
      const userId = (req as any).user.id;

      const workflow = await prisma.userWorkflow.findFirst({
        where: { id: workflowId, userId },
        include: { credentials: true }
      });

      if (!workflow) return res.status(404).json({ error: 'Workflow no encontrado' });

      // Determine Groq API key
      let apiKeyToUse = process.env.GROQ_API_KEY;
      if (groqCredentialId) {
        const groqCred = workflow.credentials.find(c => c.id === groqCredentialId);
        if (groqCred) {
          apiKeyToUse = CredentialService.decrypt(groqCred.encrypted, groqCred.iv);
        } else {
          return res.status(400).json({ error: 'Credencial Groq no encontrada o no asociada al workflow.' });
        }
      } else {
        const fallbackGroqCred = workflow.credentials.find(c => c.type === 'groq_api_key');
        if (fallbackGroqCred) {
          apiKeyToUse = CredentialService.decrypt(fallbackGroqCred.encrypted, fallbackGroqCred.iv);
        }
      }

      if (!apiKeyToUse) {
        return res.status(400).json({ error: 'No se encontro API Key de Groq. Configura una credencial o la variable de entorno.' });
      }

      const services = workflow.template.configSchema?.services || [];
      if (services.length === 0) return res.status(400).json({ error: 'El workflow no requiere servicios' });

      const userPrompt = `
Eres un asistente que genera plantillas de correos electronicos profesionales.
El usuario tiene un formulario que requiere notificar a estos departamentos/servicios: ${services.join(', ')}.

Devuelve EXACTAMENTE un JSON con esta estructura (nada de texto antes ni despues, solo el JSON):
{
  "${services[0]}": {
    "subject": "Asunto del correo...",
    "body": "<h1>Hola {{name}}...</h1>"
  },
  ... (para el resto de servicios)
}
`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKeyToUse}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'You are a helpful JSON-only assistant.' },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.5,
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq API error: ${errText}`);
      }

      const data = await response.json();
      let text = data.choices[0].message.content.trim();
      
      if (text.startsWith('```json')) text = text.replace(/^```json\n?/, '').replace(/```$/, '');
      if (text.startsWith('```')) text = text.replace(/^```\n?/, '').replace(/```$/, '');

      const parsed = JSON.parse(text);
      res.json(parsed);

    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Error generando plantillas', details: error.message });
    }
  },
