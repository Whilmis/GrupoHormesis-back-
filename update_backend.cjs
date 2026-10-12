const fs = require("fs");
let ts = fs.readFileSync("src/controllers/workflow.controller.ts", "utf8");

// Add brandVoice to the extracted body parameters
ts = ts.replace(
  /const \{ business_context, services, groqCredentialId \} = req\.body;/,
  "const { business_context, services, groqCredentialId, brandVoice } = req.body;"
);

// Append brandVoice to the prompt
const promptInjection = `
  Contexto de la Empresa (Grupo Hormesis): 
  "${business_context}"
  \${brandVoice ? \`Línea de color / Tono de la Marca:\n  "\${brandVoice}"\` : ''}
  REQUISITOS ESTRICTOS DE DISEÑO Y ESTRUCTURA (HTML):
`;

ts = ts.replace(
  /Contexto de la Empresa \(Grupo Hormesis\): \r?\n\s*"[^"]+"\r?\n\s*REQUISITOS ESTRICTOS DE DISEA`O Y ESTRUCTURA \(HTML\):/,
  promptInjection
);

// also fix the weird encoding issue with DISEÑO and `
ts = ts.replace(/DISEA`O/, 'DISEÑO');

fs.writeFileSync("src/controllers/workflow.controller.ts", ts);
console.log("Updated backend controller");
