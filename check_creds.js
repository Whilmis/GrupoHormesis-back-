const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const t1 = await prisma.workflowTemplate.findUnique({where:{typeIdentifier:'form_contact_handler'}});
  const t2 = await prisma.workflowTemplate.findUnique({where:{typeIdentifier:'auto_outreach_google_maps'}});
  console.log("form_contact_handler requiredCreds:", t1?.requiredCreds);
  console.log("auto_outreach_google_maps requiredCreds:", t2?.requiredCreds);
}
main().catch(console.error).finally(() => prisma.$disconnect());
