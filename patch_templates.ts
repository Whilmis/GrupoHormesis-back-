import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const mailtoBody = (serviceName: string) => encodeURIComponent(
`Hola equipo de Grupo Hormesis,

Me interesa avanzar con la evaluación de nuestro proyecto de ${serviceName}. 

Para darles más contexto técnico y de negocio antes de nuestra Llamada de Descubrimiento, aquí les detallo nuestra situación:

- Breve descripción de nuestro principal cuello de botella o necesidad actual:
[Por favor, escribe aquí...]

- Nuestro objetivo principal a nivel de negocio con esta implementación:
[Por favor, escribe aquí...]

Para nuestra reunión inicial (15-30 min), les propongo estas dos opciones de disponibilidad:

- Opción 1: [Día y Hora]
- Opción 2: [Día y Hora]

Quedo a la espera de su confirmación para agendar la sesión.

Saludos cordiales,
{{name}}`
);

const getMailtoLink = (serviceName: string) => {
  return `mailto:ventas@grupohormesis.com?subject=Propuesta%20de%20Llamada%20de%20Descubrimiento%20-%20${encodeURIComponent(serviceName)}&body=${mailtoBody(serviceName)}`;
};

const buttonHtml = (serviceName: string) => `
<div style="text-align: center; margin: 35px 0;">
  <a href="${getMailtoLink(serviceName)}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:16px;font-weight:bold;letter-spacing:0.5px;">Responder y Agendar Llamada</a>
</div>
`;

const generateTemplate = (serviceName: string, description: string) => {
  return {
    subject: `Confirmación de Briefing Técnico y Siguientes Pasos – ${serviceName}`,
    body: `
<div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;background:#f8fafc;padding:30px 15px;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background:#0f172a;color:#ffffff;padding:30px 40px;text-align:center;">
      <h1 style="margin:0;font-size:22px;letter-spacing:1px;">GRUPO HORMESIS</h1>
      <p style="margin:5px 0 0 0;font-size:14px;color:#94a3b8;">Consultoría Tecnológica e Ingeniería de Software Premium</p>
    </div>
    
    <!-- Content -->
    <div style="padding:40px;">
      <p style="font-size:16px;line-height:1.6;margin:0 0 20px 0;">Estimado/a <strong>{{name}}</strong>,</p>
      
      <p style="font-size:16px;line-height:1.6;margin:0 0 20px 0;">
        Confirmamos la recepción de su Briefing Técnico. En <strong>Grupo Hormesis</strong> hemos analizado la información preliminar de su empresa, <strong>{{businessName}}</strong>, y confirmamos que su solicitud se alinea perfectamente con nuestro área de especialidad.
      </p>

      <p style="font-size:16px;line-height:1.6;margin:0 0 20px 0;">
        ${description}
      </p>

      <div style="background:#f1f5f9;border-left:4px solid #3b82f6;padding:20px;margin:30px 0;border-radius:0 8px 8px 0;">
        <h3 style="margin:0 0 10px 0;color:#0f172a;font-size:16px;">Siguiente Paso: Llamada de Descubrimiento</h3>
        <p style="margin:0;font-size:15px;line-height:1.5;color:#475569;">
          El objetivo de esta sesión ejecutiva (15-30 min) es profundizar en su arquitectura actual, validar la viabilidad técnica del proyecto y trazar un <em>Roadmap</em> claro de implementación sin ningún compromiso comercial.
        </p>
      </div>

      <p style="font-size:16px;line-height:1.6;margin:0 0 20px 0;text-align:center;color:#64748b;">
        Haga clic en el siguiente botón para respondernos directamente. El correo se pre-completará con una plantilla rápida para que nos comparta su disponibilidad y contexto de negocio.
      </p>

      ${buttonHtml(serviceName)}

      <p style="font-size:16px;line-height:1.6;margin:0;">
        Agradecemos la confianza en nuestro equipo de ingeniería.<br>
        Quedamos atentos a su respuesta.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:25px;text-align:center;">
      <p style="margin:0;font-size:13px;color:#64748b;font-weight:bold;">El Equipo de Ingeniería de Grupo Hormesis</p>
      <p style="margin:5px 0 0 0;font-size:12px;color:#94a3b8;">Transformando procesos mediante arquitectura de software escalable.</p>
    </div>
    
  </div>
</div>
    `.trim()
  };
};

async function patchTemplates() {
  const workflows = await prisma.userWorkflow.findMany({
    include: { template: true }
  });

  const formWf = workflows.find(x => x.template.typeIdentifier === 'form_contact_handler');
  
  if (!formWf) {
    console.log('No se encontro el workflow de formularios.');
    return;
  }

  const config: any = formWf.config || {};
  
  config.generated_responses = {
    "default": generateTemplate(
      "Consultoría Tecnológica", 
      "Nuestro equipo está listo para evaluar sus requerimientos y diseñar una solución tecnológica que elimine sus cuellos de botella operativos y acelere el crecimiento de su negocio."
    ),
    "Desarrollo a Medida (Apps)": generateTemplate(
      "Desarrollo a Medida (Apps)", 
      "El desarrollo de software a medida exige una arquitectura sólida y escalable. Nuestro equipo está listo para estructurar una solución robusta (B2B/B2C) que se integre perfectamente con su operativa actual y le brinde una ventaja competitiva real."
    ),
    "Sistematización & Workflows": generateTemplate(
      "Sistematización & Workflows", 
      "Sabemos que la eficiencia operativa es clave para escalar. Estamos preparados para mapear sus procesos actuales, identificar las redundancias y construir un ecosistema automatizado que reduzca el trabajo manual drásticamente."
    ),
    "Modernización de Arquitectura Cloud": generateTemplate(
      "Modernización de Arquitectura Cloud", 
      "Mantener infraestructuras legacy representa un riesgo y un costo oculto constante. Nuestro equipo Cloud Architect está listo para proponerle una estrategia de migración segura, moderna y bajo modelos de alta disponibilidad."
    ),
    "Ecosistema B2B (CRM/ERP)": generateTemplate(
      "Ecosistema B2B (CRM/ERP)", 
      "Centralizar los datos y la gestión comercial es el pilar de cualquier empresa consolidada. Analizaremos su flujo de ventas y operaciones para diseñar una implementación CRM/ERP que unifique su información y mejore la toma de decisiones."
    )
  };

  await prisma.userWorkflow.update({
    where: { id: formWf.id },
    data: { config }
  });

  console.log('¡Plantillas actualizadas exitosamente con los botones de auto-respuesta y diseño premium!');
}

patchTemplates().catch(console.error).finally(() => prisma.$disconnect());
