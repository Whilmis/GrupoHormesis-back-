const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.workflowTemplate.update({
    where: { typeIdentifier: 'auto_outreach_google_maps' },
    data: {
      requiredCreds: ['gmail_address', 'gmail_app_password', 'groq_api_key']
    }
  });
  console.log('Credenciales requeridas actualizadas con éxito.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
