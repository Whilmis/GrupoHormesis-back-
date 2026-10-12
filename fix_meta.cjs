const fs = require("fs");
let content = fs.readFileSync("src/services/execution.engine.ts", "utf8");
content = content.replace("metadata: { subject: clientSubject }", "metadata: { subject: clientSubject, workflowName: context.workflow.name }");
fs.writeFileSync("src/services/execution.engine.ts", content);
