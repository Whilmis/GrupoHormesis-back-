import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const template = await prisma.workflowTemplate.findUnique({
    where: { typeIdentifier: 'lead_collector' }
  });

  if (template) {
    const creds = new Set(template.requiredCreds || []);
    creds.add('google_maps_api');
    creds.add('groq_api_key');

    await prisma.workflowTemplate.update({
      where: { typeIdentifier: 'lead_collector' },
      data: {
        requiredCreds: Array.from(creds)
      }
    });
    console.log("Template updated: added groq_api_key to required credentials.");
  } else {
    console.log("Template not found");
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
