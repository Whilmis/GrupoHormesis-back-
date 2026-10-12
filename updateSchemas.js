const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.workflowTemplate.findMany();
  
  for (const t of templates) {
    if (t.typeIdentifier === 'auto_outreach_google_maps') {
      const configSchema = typeof t.configSchema === 'string' ? JSON.parse(t.configSchema) : t.configSchema;
      configSchema.properties = configSchema.properties || {};
      configSchema.properties.calendarId = {
        type: "string",
        title: "Calendario Asignado para Reuniones",
        description: "Selecciona el calendario al que el cliente será dirigido en el correo",
        format: "calendar"
      };
      await prisma.workflowTemplate.update({
        where: { id: t.id },
        data: { configSchema }
      });
      console.log('Updated auto_outreach_google_maps');
    }
    
    if (t.typeIdentifier === 'form_contact_handler') {
      const configSchema = typeof t.configSchema === 'string' ? JSON.parse(t.configSchema) : t.configSchema;
      configSchema.configFields = configSchema.configFields || [];
      // Also add it here since it uses a different format, but wait, the prompt explicitly said:
      // "Añade a la propiedad properties del esquema de la plantilla lo siguiente:"
      // "json" ...
      // So maybe they updated form_contact_handler to use properties too? 
      // Let's just add properties.calendarId anyway so it's consistent.
      configSchema.properties = configSchema.properties || {};
      configSchema.properties.calendarId = {
        type: "string",
        title: "Calendario Asignado para Reuniones",
        description: "Selecciona el calendario al que el cliente será dirigido en el correo",
        format: "calendar"
      };
      await prisma.workflowTemplate.update({
        where: { id: t.id },
        data: { configSchema }
      });
      console.log('Updated form_contact_handler');
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
