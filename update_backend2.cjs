const fs = require("fs");
let ts = fs.readFileSync("src/controllers/workflow.controller.ts", "utf8");

ts = ts.replace(
  /const \{ business_context, services, groqCredentialId \} = req\.body;/,
  "const { business_context, services, groqCredentialId, brandVoice } = req.body;"
);

const promptInjection = `  Crea un correo de presentación u oferta ALTAMENTE persuasivo y hermoso para este servicio: "${service}".
  Contexto de la Empresa (Grupo Hormesis): 
  "${business_context}"
  ${brandVoice ? `Línea de color / Tono de la Marca:\n  "${brandVoice}"` : ''}
  REQUISITOS ESTRICTOS DE DISEÑO Y ESTRUCTURA (HTML):`;

ts = ts.replace(
  /  Crea un correo de presentaciA3n u oferta ALTAMENTE persuasivo y hermoso para este servicio: "\$\{service\}".\r?\n  Contexto de la Empresa \(Grupo Hormesis\): \r?\n  "\$\{business_context\}"\r?\n  REQUISITOS ESTRICTOS DE DISEA`O Y ESTRUCTURA \(HTML\):/,
  promptInjection
);

fs.writeFileSync("src/controllers/workflow.controller.ts", ts);
console.log("Replaced backend successfully");
