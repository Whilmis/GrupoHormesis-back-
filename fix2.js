const fs = require("fs");
let content = fs.readFileSync("src/services/execution.engine.ts", "utf8");
content = content.replace(/context\.log\(`Guardando leads en el CRM \(Proyecto: \)\.\.\.`\);/g, "context.log(`Guardando leads en el CRM (Proyecto: ${context.workflow.projectId})...`);");
fs.writeFileSync("src/services/execution.engine.ts", content);
