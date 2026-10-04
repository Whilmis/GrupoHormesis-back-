import sys

path = r'c:\Users\whilmis\Documents\GitHub\Hormesis-back\src\controllers\workflow.controller.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

new_method = """  async generateTemplates(req: Request, res: Response) {
    try {
      const { business_context, services, groqCredentialId } = req.body;
      const userId = (req as any).user.id;
      let apiKeyToUse = process.env.GROQ_API_KEY;
      if (groqCredentialId) {
        const cred = await prisma.credential.findFirst({ where: { id: groqCredentialId, userId } });
        if (cred) {
          apiKeyToUse = CredentialService.decrypt(cred.encrypted, cred.iv);
        }
      }
      if (!apiKeyToUse) return res.status(400).json({ error: 'Groq API Key no configurada.' });
      const generatedResponses: Record<string, {subject: string, body: string}> = {};
      // 🔄 ITERACIÓN UNO POR UNO: Una llamada a la IA dedicada por cada servicio
      for (const service of services) {
        const prompt = `
Eres un Master Copywriter B2B y un Diseñador Experto de Emails en HTML.
Crea un correo de presentación u oferta ALTAMENTE persuasivo y hermoso para este servicio: "${service}".
Contexto de la Empresa (Grupo Hormesis): 
"${business_context}"
REQUISITOS ESTRICTOS DE DISEÑO Y ESTRUCTURA (HTML):
1. Usa un diseño premium, limpio y corporativo con estilos inline (no uses <style> en el head, ponlos directo en las etiquetas).
2. OBLIGATORIO usar la línea de color de la marca: 
   - Azul Pizarra oscuro (#0f172a) para encabezados, fondos de header o textos principales.
   - Verde Esmeralda (#10b981) para botones de Call To Action, acentos, o divisores.
3. El diseño debe incluir: Un encabezado (header), un cuerpo limpio con buen padding, y un pie de página profesional.
4. BOTÓN DE AUTO-RESPUESTA (CRÍTICO): Crea un botón grande y vistoso (fondo Verde Esmeralda #10b981, texto blanco, esquinas redondeadas) que sea un enlace 'mailto:'.
   - href="mailto:ventas@grupohormesis.com?subject=Me%20interesa%20el%20servicio%20de%20${encodeURIComponent(service)}&body=Hola,%20quisiera%20recibir%20m%C3%A1s%20informaci%C3%B3n%20sobre..."
   - El texto del botón debe ser algo como "Responder Automáticamente" o "Me Interesa (Respuesta Rápida)".
5. El correo debe sentirse humano, aportando valor de inmediato, identificando puntos de dolor y ofreciendo Grupo Hormesis como la solución.
Devuelve EXACTAMENTE Y SOLAMENTE un JSON válido con esta estructura (sin bloques markdown \`\`\`json, solo las llaves):
{
  "subject": "Asunto magnético y profesional",
  "body": "<div style='...'>Todo el código HTML aquí...</div>"
}
`;
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKeyToUse}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant', // Modelo configurado
            messages: [
              { role: 'system', content: 'You are an elite HTML Email Designer and Copywriter that only responds in JSON.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.6,
          })
        });
        if (groqResponse.ok) {
          const aiData = await groqResponse.json();
          let rawText = aiData.choices[0].message.content;
          
          // Limpiar Markdown si la IA se equivoca y lo agrega
          rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          
          try {
            const parsed = JSON.parse(rawText);
            generatedResponses[service] = parsed;
          } catch(e) {
            console.error("Error parseando respuesta de Groq para", service, rawText);
          }
        } else {
          console.error("Error en Groq API para el servicio:", service);
        }
      }
      res.json(generatedResponses);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Error generando plantillas' });
    }
  },"""

start_idx = content.find("  async generateTemplates(")
if start_idx == -1:
    print("Could not find generateTemplates!")
    sys.exit(1)

end_idx = content.find("  async refineTemplates(", start_idx)
if end_idx == -1:
    print("Could not find refineTemplates!")
    sys.exit(1)

# Replace everything from start_idx to end_idx with new_method
content = content[:start_idx] + new_method + "\n\n" + content[end_idx:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
