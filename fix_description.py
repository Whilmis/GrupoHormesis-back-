import re

with open("src/services/execution.engine.ts", "r", encoding="utf-8") as f:
    ts = f.read()

pattern = r"description: `Asunto: \$\{clientSubject\}\\n\\nSe ha enviado el correo generado por IA.`"
replacement = "description: clientBody"

ts = re.sub(pattern, replacement, ts, flags=re.MULTILINE)

with open("src/services/execution.engine.ts", "w", encoding="utf-8") as f:
    f.write(ts)

print("Execution engine description fixed")
