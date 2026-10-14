import { Request, Response } from 'express';
import prisma from '../config/db';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';



export const getCalendars = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const calendars = await prisma.calendar.findMany({
      where: { userId }
    });
    res.json(calendars);
  } catch (error: any) {
    res.status(500).json({ error: 'Error fetching calendars', details: error.message });
  }
};

export const createCalendar = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { name, description, timezone, availability, duration, bufferTime } = req.body;
    
    const calendar = await prisma.calendar.create({
      data: {
        userId,
        name,
        description,
        timezone,
        availability,
        duration,
        bufferTime
      } as any // as any to prevent TS errors due to outdated Prisma Client
    });
    res.status(201).json(calendar);
  } catch (error: any) {
    res.status(500).json({ error: 'Error creating calendar', details: error.message });
  }
};

export const updateCalendar = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { name, description, timezone, availability, duration, bufferTime } = req.body;
    
    const calendar = await prisma.calendar.findUnique({ where: { id } });
    if (!calendar || calendar.userId !== userId) {
      return res.status(404).json({ error: 'Calendar not found' });
    }
    
    const updated = await prisma.calendar.update({
      where: { id },
      data: { name, description, timezone, availability, duration, bufferTime } as any
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Error updating calendar', details: error.message });
  }
};

export const deleteCalendar = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    
    const calendar = await prisma.calendar.findUnique({ where: { id } });
    if (!calendar || calendar.userId !== userId) {
      return res.status(404).json({ error: 'Calendar not found' });
    }
    
    await prisma.calendar.delete({ where: { id } });
    res.json({ message: 'Calendar deleted' });
  } catch (error: any) {
    res.status(500).json({ error: 'Error deleting calendar', details: error.message });
  }
};

// Public endpoint for booking page
export const getPublicCalendar = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const calendar = await prisma.calendar.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        timezone: true,
        availability: true,
        duration: true,
        user: { select: { name: true, company: true } }
      }
    });
    
    if (!calendar) {
      return res.status(404).json({ error: 'Calendar not found' });
    }
    
    res.json(calendar);
  } catch (error: any) {
    res.status(500).json({ error: 'Error fetching calendar', details: error.message });
  }
};

export const bookMeeting = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // calendarId
    const { guestName, guestEmail, startTime, endTime, notes, leadId } = req.body;
    
    // 1. Validaciones básicas de Input
    if (!guestName || !guestEmail || !startTime || !endTime) {
      return res.status(400).json({ error: 'Faltan campos requeridos (guestName, guestEmail, startTime, endTime)' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestEmail)) {
      return res.status(400).json({ error: 'El formato del correo es inválido' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Las fechas proporcionadas son inválidas' });
    }

    if (start < new Date()) {
      return res.status(400).json({ error: 'No puedes agendar una reunión en el pasado' });
    }

    if (end <= start) {
      return res.status(400).json({ error: 'La fecha de fin debe ser posterior a la de inicio' });
    }

    // 2. Verificar existencia del Calendario
    const calendar = await prisma.calendar.findUnique({ where: { id } });
    if (!calendar) {
      return res.status(404).json({ error: 'Calendario no encontrado' });
    }

    // 3. Seguridad: Verificar que el Lead pertenezca al usuario del calendario
    if (leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: { project: true }
      });
      
      if (!lead || lead.project.userId !== calendar.userId) {
        return res.status(403).json({ error: 'Sesión inválida o permiso denegado para este contacto.' });
      }
    }

    // 4. Bloqueo de Overlap (Cruce de horarios) considerando bufferTime
    const bufferMs = (calendar.bufferTime || 0) * 60000;
    const expandedStart = new Date(start.getTime() - bufferMs);
    const expandedEnd = new Date(end.getTime() + bufferMs);

    const overlappingMeeting = await prisma.meeting.findFirst({
      where: {
        calendarId: id,
        status: 'SCHEDULED', // Solo bloqueamos si la otra reunión sigue en pie
        OR: [
          {
            startTime: { lt: expandedEnd },
            endTime: { gt: expandedStart }
          }
        ]
      }
    });

    if (overlappingMeeting) {
      return res.status(409).json({ error: 'Este espacio de tiempo ya no está disponible. Por favor, selecciona otro horario.' });
    }
    
    // 5. Integración con Google Meet
    let hangoutLink = null;
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
      
      const calendarAPI = google.calendar({ version: 'v3', auth: oauth2Client });
      
      const finalTimezone = req.body.guestTimezone || calendar.timezone || 'Europe/Madrid';

      const event = await calendarAPI.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: 1,
        sendUpdates: 'all', // 🔥 ESTO HACE QUE GOOGLE ENVÍE EL CORREO AUTOMÁTICAMENTE
        requestBody: {
          summary: `Reunión: ${guestName} - ${calendar.name}`,
          description: `${notes ? String(notes).substring(0, 1000) : ''}\n\n[CRM Info]\nLead ID: ${leadId || 'N/A'}\nEnlace Lead: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/portal/leads`,
          start: { dateTime: start.toISOString(), timeZone: finalTimezone },
          end: { dateTime: end.toISOString(), timeZone: finalTimezone },
          attendees: [{ email: guestEmail }],
          conferenceData: {
            createRequest: { requestId: uuidv4() }
          }
        }
      });
      
      hangoutLink = event.data.hangoutLink || null;
    } catch (googleError: any) {
      console.error('[Google Meet] Error generating link:', googleError.response?.data || googleError);
      return res.status(500).json({ 
        error: 'Fallo al generar el link de Google Meet. Revisa los logs del backend.', 
        details: googleError.response?.data || googleError.message 
      });
    }

    // 6. Creación segura
    const meeting = await prisma.meeting.create({
      data: {
        calendarId: id,
        guestName,
        guestEmail,
        startTime: start,
        endTime: end,
        notes: notes ? String(notes).substring(0, 1000) : null,
        leadId: leadId || null,
        meetLink: hangoutLink
      }
    });

    // 7. Post-Hook Interno (CRM): Actualizar Lead y Registrar Actividad si viene de Magic Link
    if (leadId) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: 'REUNION_AGENDADA' }
      });
      
      await prisma.activity.create({
        data: {
          leadId,
          type: 'MEETING_BOOKED',
          title: 'Reunión Agendada (Magic Link)',
          description: `El cliente agendó una reunión para el ${start.toLocaleString()}. ${hangoutLink ? `<br>Enlace de Meet: <a href="${hangoutLink}" target="_blank">Unirse</a>` : ''}`
        }
      });
    }
    
    res.status(201).json(meeting);
  } catch (error: any) {
    res.status(500).json({ error: 'Error interno agendando la reunión', details: error.message });
  }
};

export const getCalendarMeetings = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, month, year } = req.query;

    const whereClause: any = { calendarId: id };

    // Filtros dinámicos para optimizar la carga del frontend
    if (startDate && endDate) {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      // Lógica de intersección: la reunión debe empezar antes del fin del rango y terminar después del inicio del rango
      whereClause.startTime = { lte: end };
      whereClause.endTime = { gte: start };
    } else if (month && year) {
      const y = parseInt(year as string, 10);
      const m = parseInt(month as string, 10); // Asume 1-12
      
      const startOfMonth = new Date(y, m - 1, 1);
      const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999);
      
      whereClause.startTime = { lte: endOfMonth };
      whereClause.endTime = { gte: startOfMonth };
    }

    const meetings = await prisma.meeting.findMany({
      where: whereClause,
      orderBy: { startTime: 'asc' }
    });
    
    res.json(meetings);
  } catch (error: any) {
    res.status(500).json({ error: 'Error fetching meetings', details: error.message });
  }
};
