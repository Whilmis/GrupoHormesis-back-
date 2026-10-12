const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const leads = await prisma.lead.findMany({ take: 1 });
  if (leads.length === 0) {
    console.log("No leads");
    return;
  }
  
  await prisma.activity.create({
    data: {
      leadId: leads[0].id,
      type: 'AUTO_EMAIL',
      title: 'Prueba Correo Automático Enviado (Outreach)',
      description: 'Asunto: Propuesta de Diseño web\n\nEste es el cuerpo del correo generado.'
    }
  });
  console.log("Activity created");
}

run().catch(console.error).finally(() => prisma.$disconnect());
