filename = "src/controllers/workflow.controller.ts"
with open(filename, "r", encoding="utf-8") as f:
    content = f.read()

import re

new_mailto = """const mailtoBody = `Hola equipo de Grupo Hormesis,\\n\\nMe interesa avanzar con la evaluación de nuestro proyecto de ${service}. \\n\\nPara darles más contexto técnico y de negocio antes de nuestra Llamada de Descubrimiento, aquí les detallo nuestra situación:\\n\\n- Breve descripción de nuestro principal cuello de botella o necesidad actual:\\n[Por favor, escribe aquí...]\\n\\n- Nuestro objetivo principal a nivel de negocio con esta implementación:\\n[Por favor, escribe aquí...]\\n\\n(Opcional) Ya he agendado la reunión a través del botón adjunto para la siguiente fecha/hora:\\n[Pega aquí la fecha/hora de la reunión]\\n\\nQuedo a la espera de sus comentarios.\\n\\nSaludos cordiales,\\n[Nombre]`;"""

content = re.sub(
    r'const mailtoBody = `Hola equipo de Grupo Hormesis,.*?\[Nombre\]`;',
    new_mailto.replace("\\", "\\\\"),
    content,
    flags=re.DOTALL
)

with open(filename, "w", encoding="utf-8") as f:
    f.write(content)
