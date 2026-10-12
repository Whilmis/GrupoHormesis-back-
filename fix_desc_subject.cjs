const fs = require("fs");
let ts = fs.readFileSync("src/services/execution.engine.ts", "utf8");

ts = ts.replace(
  /description: clientBody/,
  "description: `<strong>Asunto: ${clientSubject}</strong><br><br>` + clientBody"
);

fs.writeFileSync("src/services/execution.engine.ts", ts);
console.log("Replaced description with subject and clientBody");
