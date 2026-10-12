filename = "src/controllers/workflow.controller.ts"
with open(filename, "r", encoding="utf-8") as f:
    content = f.read()

import re

# Replace mailtoBody
new_mailto = """const mailtoBody = `Hola equipo de Grupo Hormesis,\\n\\nMe interesa avanzar con la evaluación de nuestro proyecto de ${service}. \\n\\nPara darles más contexto técnico y de negocio antes de nuestra Llamada de Descubrimiento, aquí les detallo nuestra situación:\\n\\n- Breve descripción de nuestro principal cuello de botella o necesidad actual:\\n[Por favor, escribe aquí...]\\n\\n- Nuestro objetivo principal a nivel de negocio con esta implementación:\\n[Por favor, escribe aquí...]\\n\\nPueden utilizar el otro botón para que generemos la reunión en una hora disponible, o bien, si prefieren, sugiero esta hora:\\n[Opcional: Día y Hora]\\n\\nQuedo a la espera de sus comentarios.\\n\\nSaludos cordiales,\\n[Nombre]`;"""

content = re.sub(
    r'const mailtoBody = `Hola equipo de Grupo Hormesis,.*?\[Nombre\]`;',
    new_mailto.replace("\\", "\\\\"),
    content,
    flags=re.DOTALL
)

# Replace the prompt instructions for buttons
old_instructions = """  4. BOTA"N DE AUTO-RESPUESTA Y CONTEXTO (CRA?TICO): Crea UN AsNICO botA3n grande y vistoso (fondo Verde Esmeralda #10b981, texto blanco, esquinas redondeadas) que sea un enlace 'mailto:'.
     - href="mailto:ventas@grupohormesis.com?subject=Propuesta%20de%20Llamada%20de%20Descubrimiento%20-%20${encodeURIComponent(service)}&body=${encodeURIComponent(mailtoBody)}"
     - El texto del botA3n debe decir EXACTAMENTE: "Responder y Agendar Llamada".
  5. IMPORTANTE: NO incluyas mAltiples botones. Usa AsNICAMENTE este botA3n de respuesta."""

new_instructions = """  4. BOTONES DE ACCIÓN (CRÍTICO): Crea DOS botones alineados uno al lado del otro (o apilados elegantemente si es en móvil) DENTRO del cuerpo del correo:
     - Botón 1 (Responder): Fondo Verde Esmeralda #10b981, texto blanco, que sea un enlace 'mailto:'.
       href="mailto:ventas@grupohormesis.com?subject=Propuesta%20de%20Llamada%20de%20Descubrimiento%20-%20${encodeURIComponent(service)}&body=${encodeURIComponent(mailtoBody)}"
       El texto debe decir EXACTAMENTE: "Responder".
     - Botón 2 (Agendar Reunión): Diseño secundario elegante (por ejemplo, fondo blanco con borde verde #10b981 y texto verde, o fondo azul oscuro, a tu criterio), texto blanco o acorde al diseño.
       href="{{magic_link}}"
       El texto debe decir EXACTAMENTE: "Agendar Reunión".
     Asegúrate de que ambos botones estén centrados y pertenezcan a la estructura principal del correo HTML."""

# Because encoding might be messed up in the source file, I'll use a regex that matches the list items roughly
content = re.sub(
    r'4\..*?Crea UN.*?5\..*?este bot.*?respuesta\.',
    new_instructions,
    content,
    flags=re.DOTALL | re.IGNORECASE
)

# Fix the encoding issues from my previous regex just in case
# Wait, I will just write it and check if it worked.
with open(filename, "w", encoding="utf-8") as f:
    f.write(content)
