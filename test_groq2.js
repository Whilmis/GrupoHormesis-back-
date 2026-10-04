import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  let apiKeyToUse = process.env.GROQ_API_KEY;
  if (!apiKeyToUse) {
    console.log("No GROQ_API_KEY in .env");
    return;
  }
  
  const services = ["Sistematización & Workflows", "Desarrollo a Medida (Apps)", "Ecosistema B2B (CRM/ERP)", "Integración con IA", "Modernización Cloud", "Otro"];
  const business_context = "Empresa B2B.";
  
  for (const service of services) {
        console.log(`\nGenerando correo para: ${service}...`);
        
        const prompt = `Eres un copywriter. Escribe un correo corto JSON para ${service}. Devuelve EXACTAMENTE un JSON: {"subject":"...","body":"..."}`;
        let success = false;
        let attempts = 0;
        
        while (!success && attempts < 5) {
          attempts++;
          try {
            console.log(`Intento ${attempts}...`);
            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKeyToUse}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'openai/gpt-oss-20b',
                messages: [
                  { role: 'system', content: 'You only respond in JSON.' },
                  { role: 'user', content: prompt }
                ],
                temperature: 0.6,
                response_format: { type: "json_object" }
              })
            });

            if (groqResponse.ok) {
              const aiData = await groqResponse.json();
              const rawText = aiData.choices[0].message.content;
              console.log("Respuesta:", rawText);
              
              const match = rawText.match(/\{[\s\S]*\}/);
              if (match) {
                try {
                  JSON.parse(match[0]);
                  console.log(`✅ Éxito con ${service}!`);
                  success = true;
                } catch (parseError) {
                  console.error(`❌ Intento ${attempts}: Error parseando JSON`);
                }
              } else {
                console.error(`❌ Intento ${attempts}: La IA no devolvió JSON`);
              }
            } else {
              const errStatus = groqResponse.status;
              const errorText = await groqResponse.text();
              console.log("Status:", errStatus, errorText);
              
              if (errStatus === 429) {
                let waitMs = 5000; 
                const timeMatch = errorText.match(/try again in ([\d.]+)s/);
                if (timeMatch && timeMatch[1]) {
                  waitMs = Math.ceil(parseFloat(timeMatch[1]) * 1000) + 1000;
                }
                console.log(`Esperando ${waitMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitMs));
              } else {
                break; 
              }
            }
          } catch (error) {
            console.error(`❌ Error de red`, error);
          }
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
  }
}
run();
