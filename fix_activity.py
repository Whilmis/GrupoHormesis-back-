import re

with open("src/services/execution.engine.ts", "r", encoding="utf-8") as f:
    ts = f.read()

# I will replace the incorrect prisma.activity.create block

incorrect_block = """        // Registrar actividad
        await prisma.activity.create({
          data: {
            title: 'Correo de Outreach Enviado',
            description: `Se enviA3 automAticamente el correo de presentaciA3n al lead ${lead.businessName || lead.email}.`,
            date: new Date(),
            projectId: sourceWorkflow.projectId
          }
        });"""

# Because of encoding issues with "enviA3" etc, I will use regex on a substring of it
pattern = r"// Registrar actividad\s+await prisma\.activity\.create\(\{\s+data: \{\s+title: 'Correo de Outreach Enviado',\s+description: `Se envi[^`]+`,\s+date: new Date\(\),\s+projectId: sourceWorkflow\.projectId\s+\}\s+\}\);"

replacement = """        // Registrar actividad
        await prisma.activity.create({
          data: {
            leadId: lead.id,
            type: 'AUTO_EMAIL',
            title: 'Correo Automático Enviado (Outreach)',
            description: `Asunto: ${clientSubject}\\n\\nSe ha enviado el correo generado por IA.`
          }
        });"""

ts = re.sub(pattern, replacement, ts, flags=re.MULTILINE)

with open("src/services/execution.engine.ts", "w", encoding="utf-8") as f:
    f.write(ts)

print("Execution engine fixed")
