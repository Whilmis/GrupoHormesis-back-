import { Request, Response } from 'express';
import prisma from '../config/db';

export const getProjectLeads = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { projectId } = req.params;

    // Verify project belongs to user
    const project = await prisma.project.findUnique({
      where: { id: projectId, userId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const leads = await prisma.lead.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(leads);
  } catch (error: any) {
    res.status(500).json({ error: 'Error fetching project leads', details: error.message });
  }
};

export const getLeadActivities = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { leadId } = req.params;

    // Verify lead belongs to a project owned by the user
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { project: true }
    });

    if (!lead || lead.project.userId !== userId) {
      return res.status(404).json({ error: 'Lead not found' });
    }

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
    const userId = (req as any).user.id;
    const { leadId } = req.params;
    const { type, title, description, metadata } = req.body;

    // Verify lead belongs to a project owned by the user
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { project: true }
    });

    if (!lead || lead.project.userId !== userId) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const activity = await prisma.activity.create({
      data: {
        leadId,
        type,
        title,
        description,
        metadata
      }
    });

    res.status(201).json(activity);
  } catch (error: any) {
    res.status(500).json({ error: 'Error creating lead activity', details: error.message });
  }
};
