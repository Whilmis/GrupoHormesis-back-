with open("src/services/execution.engine.ts", "r", encoding="utf-8") as f:
    ts = f.read()

# Add the AutoOutreachGoogleMapsWorkflow class
outreach_class = """
// ----------------------------------------------------
// EJEMPLO: Auto Outreach (Google Maps)
// ----------------------------------------------------
class AutoOutreachGoogleMapsWorkflow extends BaseWorkflowType {
  typeIdentifier = 'auto_outreach_google_maps';

  async execute(context: WorkflowContext): Promise<any> {
    context.log('Iniciando Auto Outreach...');
    
    // 1. Obtener credenciales
    const gmailAddress = context.credentials['gmail_address'];
    const gmailAppPassword = (context.credentials['gmail_app_password'] || '').replace(/\\s+/g, '');
    
    if (!gmailAddress || !gmailAppPassword) {
      throw new Error('Faltan credenciales de Gmail (gmail_address o gmail_app_password).');
    }

    // 2. Obtener config
    const config = context.workflow.config as any;
    const sourceWorkflowId = config?.sourceWorkflowId;
    const maxEmailsPerDay = parseInt(config?.maxEmailsPerDay || '50', 10);
    const emailTemplate = config?.generated_outreach_email;

    if (!sourceWorkflowId) {
      throw new Error('No se ha configurado la fuente de leads (Campaña de Google Maps).');
    }
    if (!emailTemplate || !emailTemplate.subject || !emailTemplate.body) {
      throw new Error('No se ha generado el correo inicial con IA en la configuración del workflow.');
    }

    // 3. Buscar workflow fuente para saber su proyecto
    const sourceWorkflow = await prisma.userWorkflow.findUnique({ where: { id: sourceWorkflowId } });
    if (!sourceWorkflow || !sourceWorkflow.projectId) {
      throw new Error('El workflow fuente no existe o no está asignado a un proyecto válido.');
    }

    // 4. Buscar leads
    const leads = await prisma.lead.findMany({
      where: {
        projectId: sourceWorkflow.projectId,
        status: 'NUEVO',
        email: { not: null }
      },
      take: maxEmailsPerDay
    });

    if (leads.length === 0) {
      context.log('No hay leads nuevos con correo electrónico para contactar.');
      return { message: '0 leads contactados' };
    }

    context.log(`Se encontraron ${leads.length} leads para contactar.`);

    // 5. Configurar Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailAddress,
        pass: gmailAppPassword
      }
    });

    let sentCount = 0;

    for (const lead of leads) {
      context.log(`Enviando correo a: ${lead.email} (${lead.businessName || 'Empresa'})...`);
      
      const clientSubject = emailTemplate.subject;
      let clientBody = emailTemplate.body;
      
      // Personalización básica
      if (lead.businessName) {
        clientBody = clientBody.replace(/{{name}}/g, lead.businessName);
      } else {
        clientBody = clientBody.replace(/{{name}}/g, 'Equipo');
      }

      try {
        await transporter.sendMail({
          from: gmailAddress,
          to: lead.email,
          subject: clientSubject,
          html: clientBody
        });
        
        context.log(`Correo enviado a ${lead.email}. Actualizando estado a CONTACTADO...`);
        
        // Actualizar lead
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: 'CONTACTADO' }
        });

        // Registrar actividad
        await prisma.activity.create({
          data: {
            title: 'Correo de Outreach Enviado',
            description: `Se envió automáticamente el correo de presentación al lead ${lead.businessName || lead.email}.`,
            date: new Date(),
            projectId: sourceWorkflow.projectId
          }
        });

        sentCount++;
      } catch (error: any) {
        context.log(`Error enviando correo a ${lead.email}: ${error.message}`);
      }
    }

    context.log(`Proceso finalizado. Se enviaron ${sentCount} correos exitosamente.`);
    
    return {
      total_found: leads.length,
      emails_sent: sentCount
    };
  }
}
"""

ts = ts.replace(
    "class FormContactWorkflow extends BaseWorkflowType {",
    outreach_class + "\nclass FormContactWorkflow extends BaseWorkflowType {"
)

ts = ts.replace(
    "new FormContactWorkflow()",
    "new FormContactWorkflow(),\n    new AutoOutreachGoogleMapsWorkflow()"
)

with open("src/services/execution.engine.ts", "w", encoding="utf-8") as f:
    f.write(ts)

print("Execution engine updated")
