const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.workflowTemplate.update({
    where: { typeIdentifier: 'auto_outreach_google_maps' },
    data: {
      name: 'Envío de Correos Automático (Google Maps -> Groq AI)'
    }
  });
  console.log('Nombre actualizado con éxito.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
