const fs = require("fs");
let ts = fs.readFileSync("src/services/execution.engine.ts", "utf8");

ts = ts.replace(
  /description: `Asunto: \$\{clientSubject\}[\s\S]*?Se ha enviado el correo generado por IA\.`/,
  "description: clientBody"
);

fs.writeFileSync("src/services/execution.engine.ts", ts);
console.log("Replaced description with clientBody");
