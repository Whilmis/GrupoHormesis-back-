const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const t = await prisma.workflowTemplate.create({
    data: {
      typeIdentifier: 'auto_outreach_google_maps',
      name: 'Outreach Automatizado (Google Maps -> Groq AI)',
      description: 'Toma leads del Recolector de Google Maps con correo, genera un email personalizado con Groq AI usando contexto de empresa, y los envía en el horario configurado.',
      requiredCreds: ['groq_api', 'smtp_email'],
      configSchema: {
        type: 'object',
        properties: {
          sourceWorkflowId: { type: 'string', description: 'ID del UserWorkflow (Recolector de Leads)' },
          businessContext: { type: 'string', description: 'Contexto de la empresa para la IA' },
          brandVoice: { type: 'string', description: 'Línea de color o tono de la empresa' },
          maxEmailsPerDay: { type: 'number', description: 'Cantidad máxima de correos a enviar por día', default: 50 },
          schedule: { type: 'string', description: 'Horario (ej. "Lunes a Viernes a las 8:00")' }
        },
        required: ['sourceWorkflowId', 'businessContext', 'brandVoice', 'maxEmailsPerDay', 'schedule']
      }
    }
  });
  console.log('Template creado:', t.id);
}
main().catch(console.error).finally(() => prisma.$disconnect());
