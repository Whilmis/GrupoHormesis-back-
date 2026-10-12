import re

engine_path = r'C:\Users\whilmis\Documents\GitHub\Hormesis-back\src\services\execution.engine.ts'

with open(engine_path, 'r', encoding='utf-8') as f:
    engine_code = f.read()

# Replace the Promise.all logic with a sequential loop that stops at 5 valid leads.
search_promise = r"// Usamos Promise\.all para hacer las peticiones.*?context\.log\(`Encontrados \$\{detailedLeads\.length\}.*?y posibles correos\)\.`\);"

replacement_promise = """
    // Procesamiento secuencial para detenerse exactamente al encontrar 5 válidos
    const detailedLeads: any[] = [];
    const finalLeads: any[] = [];
    
    for (const lead of leads) {
      if (finalLeads.length >= 5) {
        break; // Detenerse exactamente al conseguir 5 leads válidos
      }
      
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${lead.place_id}&fields=formatted_phone_number,website&key=${googleMapsKey}`;
        const detailsRes = await fetch(detailsUrl);
        if (detailsRes.ok) {
          const detailsData = await detailsRes.json();
          if (detailsData.result) {
            lead.phone = detailsData.result.formatted_phone_number || 'No disponible';
            lead.website = detailsData.result.website || 'No disponible';
            lead.email = 'No disponible';

            // Intentar scrapear el email si hay sitio web
            if (lead.website !== 'No disponible') {
              try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
                const siteRes = await fetch(lead.website, {
                  signal: controller.signal,
                  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36' }
                });
                clearTimeout(timeoutId);

                if (siteRes.ok) {
                  const html = await siteRes.text();
                  
                  // 1. Buscar mailto:
                  const mailtoRegex = /href=["']mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})(\\?.*)?["']/i;
                  const mailtoMatch = html.match(mailtoRegex);
                  if (mailtoMatch && mailtoMatch[1]) {
                    lead.email = mailtoMatch[1].toLowerCase();
                  } else {
                    // 2. Buscar texto con formato email
                    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/g;
                    const matches = html.match(emailRegex);
                    if (matches) {
                      // Filtrar extensiones o librerÃ­as falsas
                      const validEmails = matches.filter((e: string) => {
                        const lowE = e.toLowerCase();
                        return !lowE.endsWith('.png') && !lowE.endsWith('.jpg') && 
                               !lowE.endsWith('.jpeg') && !lowE.endsWith('.gif') &&
                               !lowE.endsWith('.webp') && !lowE.includes('sentry') && 
                               !lowE.includes('example.com') && !lowE.includes('wixpress');
                      });
                      if (validEmails.length > 0) {
                        lead.email = validEmails[0].toLowerCase();
                      }
                    }
                  }
                }
              } catch (siteErr) {
                // Ignorar error de scraping (timeout, dominio inactivo, etc)
              }
            }
          }
        }
      } catch (err) {
        // Ignoramos el error de un solo lead para no frenar el resto del proceso
        lead.phone = 'Error de conexiÃ³n';
        lead.website = 'Error de conexiÃ³n';
        lead.email = 'Error de conexiÃ³n';
      }
      
      detailedLeads.push(lead);
      
      // Comprobar si es un lead válido
      if (lead.email && lead.email !== 'No disponible' && lead.email !== 'Error de conexiÃ³n' &&
          lead.website && lead.website !== 'No disponible' && lead.website !== 'Error de conexiÃ³n') {
        finalLeads.push(lead);
        context.log(`¡Lead válido encontrado! (${finalLeads.length}/5): ${lead.name}`);
      }
    }
    
    context.log(`Se procesaron detalles de ${detailedLeads.length} leads para encontrar ${finalLeads.length} válidos.`);
"""

new_code = re.sub(search_promise, replacement_promise, engine_code, flags=re.DOTALL)

# Now, we should also remove the previous filtering logic we added since we just generated finalLeads.
search_filter = r"// --- NUEVA LÓGICA: 5 LEADS Y CRAWLING MULTIMODAL \(IA\) ---.*?const groqKey = "
replacement_filter = """// --- NUEVA LÓGICA: 5 LEADS Y CRAWLING MULTIMODAL (IA) ---
    let crawledCount = 0;
    // Usar la clave de Groq (si existe en las credenciales globales/workflow, o del env)
    const groqKey = """

new_code = re.sub(search_filter, replacement_filter, new_code, flags=re.DOTALL)

with open(engine_path, 'w', encoding='utf-8') as f:
    f.write(new_code)
print("Updated engine sequentially")
