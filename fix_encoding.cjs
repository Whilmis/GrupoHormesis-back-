const fs = require("fs");
let content = fs.readFileSync("src/services/execution.engine.ts", "utf8");
content = content.replace(/Correo autom(.*?|)tico enviado/g, "Correo automático enviado");
fs.writeFileSync("src/services/execution.engine.ts", content);
