import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Actualizar reunión (Drag & Drop)
export const rescheduleMeeting = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { startTime, endTime } = req.body;
    const userId = (req as any).user.id;

    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'Faltan startTime o endTime' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Fechas inválidas' });
    }

    // Validar que la reunión exista y pertenezca al usuario autenticado (via su calendario)
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: { calendar: true }
    });

    if (!meeting || meeting.calendar.userId !== userId) {
      return res.status(404).json({ error: 'Reunión no encontrada' });
    }

    // Verificar Overlap considerando bufferTime
    const bufferMs = (meeting.calendar.bufferTime || 0) * 60000;
    const expandedStart = new Date(start.getTime() - bufferMs);
    const expandedEnd = new Date(end.getTime() + bufferMs);

    const overlappingMeeting = await prisma.meeting.findFirst({
      where: {
        calendarId: meeting.calendarId,
        id: { not: id }, // Excluir la reunión actual
        status: 'SCHEDULED',
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

    const updatedMeeting = await prisma.meeting.update({
      where: { id },
      data: {
        startTime: start,
        endTime: end
      }
    });

    res.json(updatedMeeting);
  } catch (error: any) {
    res.status(500).json({ error: 'Error reprogramando la reunión', details: error.message });
  }
};

// Eliminar reunión (Cancelación)
export const deleteMeeting = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: { calendar: true }
    });

    if (!meeting || meeting.calendar.userId !== userId) {
      return res.status(404).json({ error: 'Reunión no encontrada' });
    }

    await prisma.meeting.delete({
      where: { id }
    });

    res.json({ message: 'Reunión cancelada' });
  } catch (error: any) {
    res.status(500).json({ error: 'Error cancelando la reunión', details: error.message });
  }
};

// Obtener reuniones asignadas o disponibles para el colaborador
export const getColaboradorMeetings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // Buscar reuniones asignadas directamente al usuario o de calendarios de sus proyectos
    const meetings = await prisma.meeting.findMany({
      where: {
        OR: [
          { assignedUserId: userId },
          { assignedUserId: null }, // Disponibles para tomar
          { calendar: { userId } }
        ]
      },
      include: {
        lead: {
          select: {
            id: true,
            businessName: true,
            website: true,
            phone: true,
            email: true,
            metadata: true
          }
        },
        calendar: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    res.json(meetings);
  } catch (error: any) {
    res.status(500).json({ error: 'Error obteniendo reuniones del colaborador', details: error.message });
  }
};

// Confirmar asistencia a la reunión
export const confirmMeeting = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const meeting = await prisma.meeting.findUnique({
      where: { id }
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Reunión no encontrada' });
    }

    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        assignedUserId: userId,
        colaboradorStatus: 'CONFIRMED'
      },
      include: {
        lead: true,
        calendar: true
      }
    });

    res.json({ message: 'Asistencia confirmada con éxito', meeting: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Error confirmando reunión', details: error.message });
  }
};

// Declinar o solicitar reasignación
export const declineMeeting = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const meeting = await prisma.meeting.findUnique({
      where: { id }
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Reunión no encontrada' });
    }

    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        assignedUserId: null, // Devolver a la cola
        colaboradorStatus: 'DECLINED'
      }
    });

    res.json({ message: 'Reunión devuelta a la cola de atención', meeting: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Error declinando reunión', details: error.message });
  }
};


// Estadísticas del colaborador
export const getColaboradorStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const [pendingMeetings, confirmedMeetings, todayMeetings, totalLeads, totalForms] = await Promise.all([
      prisma.meeting.count({
        where: {
          colaboradorStatus: 'PENDING_CONFIRMATION',
          status: 'SCHEDULED'
        }
      }),
      prisma.meeting.count({
        where: {
          colaboradorStatus: 'CONFIRMED',
          status: 'SCHEDULED',
          OR: [{ assignedUserId: userId }, { assignedUserId: null }]
        }
      }),
      prisma.meeting.findMany({
        where: {
          status: 'SCHEDULED',
          startTime: { gte: todayStart, lt: todayEnd }
        },
        include: {
          lead: true,
          calendar: true
        },
        orderBy: { startTime: 'asc' }
      }),
      prisma.lead.count(),
      prisma.formSubmission.count()
    ]);

    res.json({
      pendingMeetings,
      confirmedMeetings,
      todayMeetings,
      totalLeads,
      totalForms
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error obteniendo estadísticas', details: error.message });
  }
};
