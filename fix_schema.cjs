const fs = require("fs");
let content = fs.readFileSync("prisma/schema.prisma", "utf8");
content = content.replace("status        String     @default(\"NUEVO\")\n  \n  activities", "status        String     @default(\"NUEVO\")\n  metadata      Json?\n  \n  activities");
fs.writeFileSync("prisma/schema.prisma", content);
