import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const template = await prisma.workflowTemplate.findUnique({
    where: { typeIdentifier: 'lead_collector' }
  });
  if (template) {
    await prisma.workflowTemplate.update({
      where: { typeIdentifier: 'lead_collector' },
      data: {
        configSchema: {
          niches: {
            title: "Nichos objetivo (Separados por comas)",
            description: "Ej. Hoteles, Restaurantes, Clínicas Dentales",
            type: "string",
            format: "textarea"
          },
          locations: {
            title: "Ciudades o Pueblos (Separados por comas)",
            description: "Ej. Madrid, Barcelona, Valencia",
            type: "string",
            format: "textarea"
          },
          schedule: {
            title: "Horario de ejecución (Cron)",
            description: "Ej. 0 10 * * * (Todos los días a las 10 AM)",
            type: "string"
          }
        }
      }
    });
    console.log("Template updated");
  } else {
    console.log("Template not found");
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
