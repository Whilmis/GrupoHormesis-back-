const fs = require("fs");
let content = fs.readFileSync("src/controllers/form.controller.ts", "utf8");

content = content.replace("let referredByUserId = null;", "let referredByUserId = null;\n    let referredByName = null;");
content = content.replace("referredByUserId = referrer.id;", "referredByUserId = referrer.id;\n          referredByName = referrer.name;");
content = content.replace("metadata: { coupon: req.body.coupon || req.body.referralCode || req.body.couponCode, referredByUserId }", "metadata: { coupon: req.body.coupon || req.body.referralCode || req.body.couponCode, referredByUserId, referredByName }");

fs.writeFileSync("src/controllers/form.controller.ts", content);
