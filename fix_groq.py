filename = "src/controllers/workflow.controller.ts"
with open(filename, "r", encoding="utf-8") as f:
    ts = f.read()

ts = ts.replace("model: 'openai/gpt-oss-20b',", "model: 'llama-3.1-70b-versatile',\n                response_format: { type: 'json_object' },")

ts = ts.replace("that only responds in JSON.' }", "that only responds in valid JSON. You must use single quotes for all HTML attributes to prevent JSON escaping errors.' }")

ts = ts.replace("6. El correo debe sentirse humano", "6. El correo debe sentirse humano, aportando valor de inmediato.\n7. CRÍTICO PARA EL CÓDIGO HTML: Debes usar ÚNICAMENTE comillas simples (') para todos los atributos dentro de tus etiquetas HTML. NO uses comillas dobles internas porque romperán el JSON.\n8. El correo debe sentirse humano")

ts = ts.replace("err(`?O Intento ${attempts}: Error parseando JSON para ${service}`);", "err(`Error parseando JSON para ${service}. RAW: ${match[0]}`);")
ts = ts.replace("err(`?O Intento ${attempts}: La IA no devolviA3 JSON para ${service}`);", "err(`La IA no devolvió JSON para ${service}. RAW: ${rawText}`);")

with open(filename, "w", encoding="utf-8") as f:
    f.write(ts)
