const fs = require("fs");
let ts = fs.readFileSync("src/controllers/workflow.controller.ts", "utf8");

ts = ts.replace(
  /const \{ business_context, services, groqCredentialId \} = req\.body;/,
  "const { business_context, services, groqCredentialId, brandVoice } = req.body;"
);

const promptInjection = `  Crea un correo de presentaciA3n u oferta ALTAMENTE persuasivo y hermoso para este servicio: "${service}".\n  Contexto de la Empresa (Grupo Hormesis): \n  "${business_context}"\n  ${brandVoice ? '\\nLínea de color / Tono de la Marca:\\n  "' + brandVoice + '"' : ''}\n  REQUISITOS ESTRICTOS DE DISEÑO Y ESTRUCTURA (HTML):`.replace(/\$\{service\}/g, "$${service}").replace(/\$\{business_context\}/g, "$${business_context}").replace(/\$\{brandVoice\}/g, "$${brandVoice}");

// I'll just use a literal string with escaped template variables for the output
const finalInjection = "  Crea un correo de presentaciA3n u oferta ALTAMENTE persuasivo y hermoso para este servicio: \"${service}\".\n  Contexto de la Empresa (Grupo Hormesis): \n  \"${business_context}\"\n  ${brandVoice ? `\\nLínea de color / Tono de la Marca:\\n  \"${brandVoice}\"` : ''}\n  REQUISITOS ESTRICTOS DE DISEÑO Y ESTRUCTURA (HTML):";


ts = ts.replace(
  /  Crea un correo de presentaciA3n u oferta ALTAMENTE persuasivo y hermoso para este servicio: "\$\{service\}".\r?\n  Contexto de la Empresa \(Grupo Hormesis\): \r?\n  "\$\{business_context\}"\r?\n  REQUISITOS ESTRICTOS DE DISEA`O Y ESTRUCTURA \(HTML\):/,
  finalInjection
);

fs.writeFileSync("src/controllers/workflow.controller.ts", ts);
console.log("Replaced backend safely");
