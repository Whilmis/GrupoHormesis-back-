import re

engine_path = r'C:\Users\whilmis\Documents\GitHub\Hormesis-back\src\services\execution.engine.ts'

with open(engine_path, 'r', encoding='utf-8') as f:
    engine_code = f.read()

# We need to change the loop for the crawler
search_pattern = r"// --- NUEVA LÓGICA: Enriquecimiento Técnico Visual con Crawler ---.*?(?=\s+// Guardar en el CRM)"
replacement = """// --- NUEVA LÓGICA: 5 LEADS Y CRAWLING MULTIMODAL (IA) ---
    // 1. Filtrar solo los que tienen correo real
    const validLeads = detailedLeads.filter(l => 
      l.email && l.email !== 'No disponible' && l.email !== 'Error de conexiÃ³n' &&
      l.website && l.website !== 'No disponible' && l.website !== 'Error de conexiÃ³n'
    );
    
    // 2. Tomar exactamente 5
    const finalLeads = validLeads.slice(0, 5);
    context.log(`Se filtraron ${finalLeads.length} leads válidos para auditoría profunda.`);

    let crawledCount = 0;
    // Usar la clave de Groq (si existe en las credenciales globales/workflow, o del env)
    const groqKey = context.credentials['groq_api_key'] || process.env.GROQ_API_KEY;

    for (const l of finalLeads) {
      try {
        context.log(`[Crawler] Auditando (5 Capturas + IA) web de ${l.name} (${l.website})...`);
        const crawlerData = await CrawlerService.auditWebsite(l.website, groqKey as string);
        
        // Formato exacto requerido
        l.metadata = {
          technicalAnalysis: {
            url: l.website,
            htmlSourceUrl: crawlerData.htmlSourceUrl || undefined,
            screenshots: crawlerData.screenshots
          },
          aiAuditReport: crawlerData.aiAuditReport
        };
        crawledCount++;
      } catch (e: any) {
        context.log(`[Crawler] Falló la auditoría para ${l.website}: ${e.message}`);
      }
    }
    context.log(`Auditoría IA completada para ${crawledCount} leads.`);
"""

new_code = re.sub(search_pattern, replacement, engine_code, flags=re.DOTALL)

search_crm = r"for \(const l of detailedLeads\) \{"
new_code = new_code.replace(search_crm, "for (const l of finalLeads) {")

search_return = r"total_found: detailedLeads\.length,\s+leads: detailedLeads"
new_code = new_code.replace(search_return, "total_found: finalLeads.length,\n      leads: finalLeads")

with open(engine_path, 'w', encoding='utf-8') as f:
    f.write(new_code)
print("Updated execution.engine.ts")
