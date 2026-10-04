import { PrismaClient, UserWorkflow, Credential } from '@prisma/client';
import { CredentialService } from './credential.service';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

// DefiniciÃ³n genÃ©rica para los tipos de workflows
export interface WorkflowContext {
  workflow: UserWorkflow;
  credentials: Record<string, string>; // clave -> valor desencriptado
  log: (message: string) => void;
  inputData?: any; // Datos que pueden venir de un webhook o API
}

export abstract class BaseWorkflowType {
  abstract typeIdentifier: string;
  abstract execute(context: WorkflowContext): Promise<any>;
}

// ----------------------------------------------------
// EJEMPLO: Recolector de Leads
// ----------------------------------------------------
class LeadCollectorWorkflow extends BaseWorkflowType {
  typeIdentifier = 'lead_collector';

  async execute(context: WorkflowContext): Promise<any> {
    context.log('Iniciando Lead Collector...');
    
    // 1. Obtener credenciales
    const googleMapsKey = context.credentials['google_maps_api'];
    if (!googleMapsKey) {
      throw new Error('Falta la credencial de Google Maps API (google_maps_api)');
    }
    
    // 2. Obtener config del workflow
    const config = context.workflow.config as any;
    
    const nichesStr = config?.niches || 'restaurantes';
    const locationsStr = config?.locations || 'madrid';
    
    const nichesArray = nichesStr.split(',').map((s: string) => s.trim()).filter(Boolean);
    const locationsArray = locationsStr.split(',').map((s: string) => s.trim()).filter(Boolean);
    
    const selectedNiche = nichesArray[Math.floor(Math.random() * nichesArray.length)] || 'restaurantes';
    const selectedLocation = locationsArray[Math.floor(Math.random() * locationsArray.length)] || 'madrid';
    
    const searchQuery = `${selectedNiche} en ${selectedLocation}`;
    context.log(`Buscando leads para: ${searchQuery}`);
    
    context.log(`Consultando Google Places API...`);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${googleMapsKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error HTTP de Google Maps: ${response.status}`);
    }
    const dataObj = await response.json();
    
    if (dataObj.status !== 'OK' && dataObj.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Maps API error: ${dataObj.status} - ${dataObj.error_message || ''}`);
    }
    
    let leads = (dataObj.results || []).map((place: any) => ({
      name: place.name,
      address: place.formatted_address,
      rating: place.rating,
      place_id: place.place_id,
      types: place.types,
      phone: 'No disponible',
      website: 'No disponible'
    }));
    
    context.log(`Obteniendo detalles (teléfono y sitio web) para ${leads.length} leads...`);

    // Usamos Promise.all para hacer las peticiones de detalles en paralelo y no ralentizar la ejecución
    const detailedLeads = await Promise.all(leads.map(async (lead: any) => {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${lead.place_id}&fields=formatted_phone_number,website&key=${googleMapsKey}`;
        const detailsRes = await fetch(detailsUrl);
        if (detailsRes.ok) {
          const detailsData = await detailsRes.json();
          if (detailsData.result) {
            lead.phone = detailsData.result.formatted_phone_number || 'No disponible';
            lead.website = detailsData.result.website || 'No disponible';
          }
        }
      } catch (err) {
        // Ignoramos el error de un solo lead para no frenar el resto del proceso
        lead.phone = 'Error de conexión';
        lead.website = 'Error de conexión';
      }
      return lead;
    }));
    
    context.log(`Encontrados ${detailedLeads.length} leads reales en Google Maps con sus detalles.`);
    
    return { 
      searchQuery,
      total_found: detailedLeads.length,
      leads: detailedLeads 
    };
  }
}

class FormContactWorkflow extends BaseWorkflowType {
  typeIdentifier = 'form_contact_handler';

  async execute(context: WorkflowContext): Promise<any> {
    context.log('Iniciando Form Contact Handler...');
    let data = context.inputData;
    
    // Auto-inyectar datos de prueba si es una ejecución manual sin webhook
    if (!data || Object.keys(data).length === 0 || !data.email) {
      context.log('Ejecución manual detectada (sin datos de webhook). Usando datos de prueba (Lead Simulado)...');
      data = {
        name: 'Lead de Prueba',
        email: 'ventas@grupohormesis.com', // Enviamos la prueba al mismo correo para evitar rebotados
        businessName: 'Empresa Test',
        service: 'Sistematización & Workflows', 
        message: 'Este es un correo de prueba de ejecución manual.'
      };
    }

    const gmailAddress = context.credentials['gmail_address'];
    const gmailAppPassword = (context.credentials['gmail_app_password'] || '').replace(/\s+/g, '');

    if (!gmailAddress || !gmailAppPassword) {
      throw new Error('Faltan credenciales de Gmail (gmail_address o gmail_app_password).');
    }

    const config = context.workflow.config as any;

    context.log(`Procesando lead: ${data.name} (${data.email}) - Servicio: ${data.service}`);

    const normalizeStr = (str: string) => 
      (str || '').toString().toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const requestedService = normalizeStr(data.service);
    const templates = config?.generated_responses || {};
    let matchedTemplate: any = null;
    
    for (const [key, template] of Object.entries(templates)) {
      if (normalizeStr(key) === requestedService) {
        matchedTemplate = template;
        break;
      }
    }
    
    // Si no hay coincidencia exacta (o si no se envió servicio), tomar 'default' o la primera disponible
    if (!matchedTemplate) {
      context.log(`No se encontró coincidencia exacta para "${requestedService}". Usando plantilla por defecto.`);
      matchedTemplate = templates['default'] || Object.values(templates)[0];
    }

    if (!matchedTemplate) {
      throw new Error('No hay respuestas pre-generadas configuradas en este workflow. Por favor, generalas desde el panel de control.');
    }

    let clientSubject = matchedTemplate.subject || `[${context.workflow.name}] Tu solicitud`;
    let clientBody = matchedTemplate.body || '';

    // Reemplazar variables tanto en el asunto como en el cuerpo
    const variables = {
      '{{name}}': data.name || '',
      '[Nombre]': data.name || '',
      '{{email}}': data.email || '',
      '{{businessName}}': data.businessName || '',
      '{{service}}': data.service || '',
      '{{message}}': data.message || ''
    };

    for (const [key, value] of Object.entries(variables)) {
      const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      clientSubject = clientSubject.replace(new RegExp(safeKey, 'g'), value as string);
      clientBody = clientBody.replace(new RegExp(safeKey, 'g'), value as string);
    }

    context.log(`Enviando correo con asunto: ${clientSubject}`);

    // Configurar transporte nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailAddress,
        pass: gmailAppPassword
      }
    });

    await transporter.sendMail({
      from: `"${context.workflow.name}" <${gmailAddress}>`,
      to: data.email,
      subject: clientSubject,
      text: clientBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      html: clientBody
    });

    // Registrar la actividad en el Lead si existe el leadId
    if (data.leadId) {
      await prisma.activity.create({
        data: {
          leadId: data.leadId,
          type: 'AUTO_EMAIL',
          title: 'Correo automático enviado',
          description: clientBody,
          metadata: { subject: clientSubject }
        }
      });
      context.log(`Actividad AUTO_EMAIL registrada para el lead: ${data.leadId}`);
    }

    context.log('Correo enviado correctamente.');

    return { 
      message: 'Lead procesado exitosamente', 
      leadData: data 
    };
  }
}

// ----------------------------------------------------
// MOTOR DE EJECUCIÃ“N
// ----------------------------------------------------
export class ExecutionEngine {
  private static registeredTypes: BaseWorkflowType[] = [
    new LeadCollectorWorkflow(),
    new FormContactWorkflow()
  ];

  static async executeWorkflow(userWorkflowId: string, inputData?: any) {
    // 1. Cargar el workflow con la plantilla y credenciales
    const workflow = await prisma.userWorkflow.findUnique({
      where: { id: userWorkflowId },
      include: { 
        template: true,
        credentials: true
      }
    });

    if (!workflow) throw new Error('Workflow no encontrado');
    if (!workflow.isActive) throw new Error('El Workflow estÃ¡ inactivo');

    // 2. Buscar el tipo de workflow (la lÃ³gica)
    const engineType = this.registeredTypes.find(t => t.typeIdentifier === workflow.template.typeIdentifier);
    if (!engineType) throw new Error(`Tipo de workflow no implementado: ${workflow.template.typeIdentifier}`);

    // 3. Crear registro de ejecuciÃ³n
    const execution = await prisma.workflowExecution.create({
      data: {
        userWorkflowId: workflow.id,
        status: 'running',
        logs: []
      }
    });

    const logs: string[] = [];
    const logFn = (msg: string) => logs.push(`[${new Date().toISOString()}] ${msg}`);

    try {
      logFn('Preparando credenciales...');
      // Fetch global credentials for the user as fallback
      const globalCreds = await prisma.credential.findMany({
        where: { userId: workflow.userId }
      });

      const decryptedCreds: Record<string, string> = {};
      
      // Load global credentials first
      for (const cred of globalCreds) {
        decryptedCreds[cred.type] = CredentialService.decrypt(cred.encrypted, cred.iv);
      }
      
      // Override with workflow-specific credentials if they exist
      for (const cred of workflow.credentials) {
        decryptedCreds[cred.type] = CredentialService.decrypt(cred.encrypted, cred.iv);
      }

      // 4. Ejecutar
      logFn('Ejecutando...');
      const context: WorkflowContext = {
        workflow,
        credentials: decryptedCreds,
        log: logFn,
        inputData
      };

      const resultData = await engineType.execute(context);

      logFn('EjecuciÃ³n completada con Ã©xito.');

      // 5. Guardar resultado final
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'success',
          logs: logs as any,
          resultData: resultData as any,
          completedAt: new Date()
        }
      });

      return resultData;
    } catch (error: any) {
      logFn(`ERROR: ${error.message}`);
      
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'error',
          logs: logs as any,
          completedAt: new Date()
        }
      });
      
      throw error;
    }
  }
}


