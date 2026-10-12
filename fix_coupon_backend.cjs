const fs = require("fs");
let content = fs.readFileSync("src/services/execution.engine.ts", "utf8");
content = content.replace("metadata: { subject: clientSubject, workflowName: context.workflow.name }", "metadata: { subject: clientSubject, workflowName: context.workflow.name, coupon: data.coupon || data.referralCode || data.couponCode }");
fs.writeFileSync("src/services/execution.engine.ts", content);
