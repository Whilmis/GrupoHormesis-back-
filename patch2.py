import sys

path = r'c:\Users\whilmis\Documents\GitHub\Hormesis-back\src\controllers\workflow.controller.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Check if already has refineTemplates
if "async refineTemplates(" in content:
    print("Already has refineTemplates! Replacing it...")
    # we don't handle replacement here for simplicity, we will just abort
    print("ABORT")
    sys.exit(0)

# Replace the last `};` with the new method
old_end = """    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Error generando plantillas', details: error.message });
    }
  }
};"""

new_end = """    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Error generando plantillas', details: error.message });
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
`;
      const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKeyToUse}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'You are a helpful JSON-only assistant.' },
            { role: 'user', content: aiPrompt }
          ],
          temperature: 0.5,
        })
      });
      if (!aiResponse.ok) {
        const errData = await aiResponse.json();
        return res.status(500).json({ error: 'Groq API error: ' + JSON.stringify(errData) });
      }
      const aiData = await aiResponse.json();
      let rawText = aiData.choices[0].message.content;
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const newTemplates = JSON.parse(rawText);
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
"""

if old_end not in content:
    # try replacing just the last };
    content = content.rstrip()
    if content.endswith('};'):
        content = content[:-2] + ",\n\n" + new_end.split("  },\n\n")[1]
    else:
        print("COULD NOT FIND END OF FILE")
        sys.exit(1)
else:
    content = content.replace(old_end, new_end)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
