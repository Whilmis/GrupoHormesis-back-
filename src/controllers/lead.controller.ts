import { Request, Response } from 'express';
import prisma from '../config/db';

export const getProjectLeads = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const { projectId } = req.params;

    if (userRole !== 'colaborador' && userRole !== 'admin') {
      const project = await prisma.project.findUnique({
        where: { id: projectId, userId }
      });
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }

    const leads = await prisma.lead.findMany({
      where: { projectId },
      include: {
        meetings: true,
        _count: { select: { activities: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(leads);
  } catch (error: any) {
    res.status(500).json({ error: 'Error fetching project leads', details: error.message });
  }
};

export const getColaboradorLeads = async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;

    const where: any = {};
    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }
    if (search && typeof search === 'string') {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { website: { contains: search, mode: 'insensitive' } }
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true, industry: true }
        },
        meetings: {
          orderBy: { startTime: 'desc' },
          take: 1
        },
        _count: {
          select: { activities: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(leads);
  } catch (error: any) {
    res.status(500).json({ error: 'Error fetching colaborador leads', details: error.message });
  }
};

export const updateLeadStatus = async (req: Request, res: Response) => {
  try {
    const { leadId } = req.params;
    const { status, note } = req.body;
    const userName = (req as any).user.name || 'Colaborador';

    const validStatuses = ['NUEVO', 'CONTACTADO', 'REUNIÓN AGENDADA', 'PROPUESTA ENVIADA', 'GANADO', 'PERDIDO'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }

    const existingLead = await prisma.lead.findUnique({
      where: { id: leadId }
    });

    if (!existingLead) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }

    const oldStatus = existingLead.status;
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        ...(status ? { status } : {})
      }
    });

    // Registrar actividad si hubo cambio de estado o nota
    if (status && status !== oldStatus) {
      await prisma.activity.create({
        data: {
          leadId,
          type: 'STATUS_CHANGE',
          title: `Estado cambiado a ${status}`,
          description: note || `Cambiado de ${oldStatus} a ${status} por ${userName}`,
          metadata: { oldStatus, newStatus: status, changedBy: userName }
        }
      });
    } else if (note) {
      await prisma.activity.create({
        data: {
          leadId,
          type: 'MANUAL_NOTE',
          title: 'Nota interna añadida',
          description: note,
          metadata: { addedBy: userName }
        }
      });
    }

    res.json(updatedLead);
  } catch (error: any) {
    res.status(500).json({ error: 'Error actualizando estado de lead', details: error.message });
  }
};

export const getLeadActivities = async (req: Request, res: Response) => {
  try {
    const { leadId } = req.params;

    const activities = await prisma.activity.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(activities);
  } catch (error: any) {
    res.status(500).json({ error: 'Error fetching lead activities', details: error.message });
  }
};

export const createLeadActivity = async (req: Request, res: Response) => {
  try {
    const { leadId } = req.params;
    const { type, title, description, metadata } = req.body;

    const activity = await prisma.activity.create({
      data: {
        leadId,
        type: type || 'MANUAL_NOTE',
        title: title || 'Nota de seguimiento',
        description,
        metadata
      }
    });

    res.status(201).json(activity);
  } catch (error: any) {
    res.status(500).json({ error: 'Error creating lead activity', details: error.message });
  }
};
