import { Request, Response } from 'express';
import prisma from '../config/db';

export const getProjects = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { workflows: true }
        },
        workflows: {
          include: {
            _count: {
              select: { formSubmissions: true }
            },
            executions: {
              where: { status: 'success' },
              select: { resultData: true }
            }
          }
        }
      }
    });

    // Calcular el total de leads (formularios + scraping)
    // Para simplificar el _count en la respuesta:
    const formattedProjects = projects.map(p => {
      // Sumar leads de formularios
      const totalFormLeads = p.workflows.reduce((sum, w) => sum + w._count.formSubmissions, 0);
      
      // Sumar leads de scraping
      let totalScrapingLeads = 0;
      for (const w of p.workflows) {
        for (const ex of w.executions) {
          const resultData = ex.resultData as any;
          if (resultData && resultData.leads && Array.isArray(resultData.leads)) {
            totalScrapingLeads += resultData.leads.length;
          }
        }
      }
      
      return {
        id: p.id,
        name: p.name,
        industry: p.industry,
        description: p.description,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        _count: {
          workflows: p._count.workflows,
          leads: totalFormLeads + totalScrapingLeads
        }
      };
    });

    res.json(formattedProjects);
  } catch (error: any) {
    res.status(500).json({ error: 'Error fetching projects', details: error.message });
  }
};

export const createProject = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { name, industry, description } = req.body;

    const project = await prisma.project.create({
      data: {
        name,
        industry,
        description,
        userId
      }
    });

    res.status(201).json(project);
  } catch (error: any) {
    res.status(500).json({ error: 'Error creating project', details: error.message });
  }
};

export const getProjectLeads = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { projectId } = req.params;

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

export const getProjectActivities = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId, userId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const activities = await prisma.activity.findMany({
      where: {
        lead: {
          projectId: projectId
        }
      },
      include: {
        lead: {
          select: {
            businessName: true,
            contactName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(activities);
  } catch (error: any) {
    res.status(500).json({ error: 'Error fetching project activities', details: error.message });
  }
};
