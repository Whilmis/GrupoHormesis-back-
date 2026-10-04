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
      for (const service of services) {
        console.log(`Generando correo para: ${service}...`);
        
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
        let success = false;
        let attempts = 0;
        
        while (!success && attempts < 3) {
          attempts++;
          try {
            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKeyToUse}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'openai/gpt-oss-20b',
                messages: [
                  { role: 'system', content: 'You are an elite HTML Email Designer and Copywriter that only responds in JSON.' },
                  { role: 'user', content: prompt }
                ],
                temperature: 0.6,
                response_format: { type: "json_object" }
              })
            });

            if (groqResponse.ok) {
              const aiData = await groqResponse.json();
              const rawText = aiData.choices[0].message.content;
              
              const match = rawText.match(/\\{[\\s\\S]*\\}/);
              if (match) {
                generatedResponses[service] = JSON.parse(match[0]);
                console.log(`✅ ¡Éxito con ${service}!`);
                success = true;
              } else {
                console.error(`❌ Intento ${attempts}: La IA no devolvió JSON para ${service}`);
              }
            } else if (groqResponse.status === 429) {
              const errData = await groqResponse.json();
              const errMsg = errData.error?.message || "";
              const timeMatch = errMsg.match(/try again in ([\\d.]+)s/);
              let waitMs = 15000;
              if (timeMatch && timeMatch[1]) {
                waitMs = Math.ceil(parseFloat(timeMatch[1]) * 1000) + 1000; // +1s extra por seguridad
              }
              console.warn(`⚠️ Rate limit (TPM). Esperando ${waitMs / 1000}s antes de reintentar...`);
              await new Promise(resolve => setTimeout(resolve, waitMs));
              continue; 
            } else {
              const errorDetails = await groqResponse.text();
              console.error(`❌ Falló la API de Groq para ${service}:`, errorDetails);
              break; 
            }
          } catch (error) {
            console.error(`❌ Error con ${service}:`, error);
            if (attempts >= 3) break;
          }
          
          if (!success && attempts < 3) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
        
        if (success) {
           await new Promise(resolve => setTimeout(resolve, 2000));
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
