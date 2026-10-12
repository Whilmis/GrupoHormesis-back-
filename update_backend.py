import re

with open("src/controllers/workflow.controller.ts", "r", encoding="utf-8") as f:
    ts = f.read()

ts = re.sub(
    r"const \{ business_context, services, groqCredentialId \} = req\.body;",
    "const { business_context, services, groqCredentialId, brandVoice } = req.body;",
    ts
)

target_pattern = r'  Crea un correo de presentaciA3n u oferta ALTAMENTE persuasivo y hermoso para este servicio: "\$\{service\}".\r?\n  Contexto de la Empresa \(Grupo Hormesis\): \r?\n  "\$\{business_context\}"\r?\n  REQUISITOS ESTRICTOS DE DISEA`O Y ESTRUCTURA \(HTML\):'

replacement = """  Crea un correo de presentación u oferta ALTAMENTE persuasivo y hermoso para este servicio: "${service}".
  Contexto de la Empresa (Grupo Hormesis): 
  "${business_context}"
  ${brandVoice ? `\\nLínea de color / Tono de la Marca:\\n  "${brandVoice}"` : ''}
  REQUISITOS ESTRICTOS DE DISEÑO Y ESTRUCTURA (HTML):"""

ts = re.sub(target_pattern, replacement, ts, flags=re.MULTILINE)

with open("src/controllers/workflow.controller.ts", "w", encoding="utf-8") as f:
    f.write(ts)

print("Backend updated with Python")
