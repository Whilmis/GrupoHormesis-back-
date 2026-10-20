import nodemailer, { Transporter } from 'nodemailer';

let transporter: Transporter;


// Configurar el transporte
const initTransporter = async () => {
  if (!transporter) {
    // Si existen variables de entorno SMTP, usamos el correo real (Gmail, Resend, etc)
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_PORT === '465', // true para 465, false para otros puertos
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      console.log('✉️ Email Service iniciado con servidor SMTP real');
    } else {
      // Si no hay variables, usamos Ethereal como respaldo local
      console.log('⚠️ No se encontraron credenciales SMTP en .env. Usando Ethereal de prueba...');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('✉️ Email Service iniciado con cuenta de Ethereal');
    }
  }
  return transporter;
};

export const sendVerificationEmail = async (to: string, token: string) => {
  try {
    const emailTransporter = await initTransporter();
    
    const frontendUrl = process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes('localhost')
      ? process.env.FRONTEND_URL.replace(/\/$/, '')
      : 'https://grupohormesis.es';
    const verificationLink = `${frontendUrl}/confirmar-email?token=${token}`;
    const senderAddress = process.env.SMTP_FROM || '"Portal Grupo Hormesis" <no-reply@grupohormesis.com>';

    const info = await emailTransporter.sendMail({
      from: senderAddress, // sender address
      to, // list of receivers
      subject: 'Confirma tu correo electrónico', // Subject line
      text: `¡Hola! Por favor confirma tu correo entrando a este enlace: ${verificationLink}`, // plain text body
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a;">¡Bienvenido a Grupo Hormesis!</h2>
          <p style="color: #475569;">Gracias por registrarte en nuestro portal. Para activar tu cuenta y poder iniciar sesión, necesitamos que confirmes tu correo electrónico haciendo clic en el siguiente botón:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Confirmar mi Correo
            </a>
          </div>
          <p style="color: #64748b; font-size: 0.85rem;">Si no solicitaste esta cuenta, puedes ignorar este correo de forma segura.</p>
        </div>
      `, // html body
    });

    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    // El enlace "Preview URL" permite ver cómo luce el correo sin necesitar una bandeja de entrada real.
    
    return true;
  } catch (error) {
    console.error('Error enviando email:', error);
    return false;
  }
};
