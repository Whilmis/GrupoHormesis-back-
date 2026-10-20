import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/db';
import { ExecutionEngine } from '../services/execution.engine';
import fs from 'fs';
import path from 'path';

function logToFile(msg: string) {
  fs.appendFileSync(path.join(process.cwd(), 'form_debug.log'), new Date().toISOString() + ' - ' + msg + '\n');
}

export const submitForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workflowId } = req.params;
    
    // El body puede tener cualquier estructura ahora
    const formData = req.body;
    
    // Buscar el workflow para extraer sus fieldMappings
    let workflow = null;
    if (workflowId && workflowId !== 'submit') {
      workflow = await prisma.userWorkflow.findUnique({
        where: { id: workflowId }
      });
    }

    if (!workflow) {
      workflow = await prisma.userWorkflow.findFirst({
        where: { isActive: true }
      });
    }

    if (!workflow) {
      return res.status(404).json({ message: 'Workflow no encontrado' });
    }

    const config = workflow.config as any;
    const refKey = config?.fieldMappings?.referralCodeField;
    const emailKey = config?.fieldMappings?.emailField || 'email';
    const nameKey = config?.fieldMappings?.nameField || 'name';

    let referredByUserId = null;
    let referredByName = null;

    let couponCodeToSearch = null;

    if (refKey && req.body[refKey]) {
      couponCodeToSearch = req.body[refKey];
      logToFile('[FormSubmit] Usando refKey: ' + refKey + ' Valor: ' + couponCodeToSearch);
    } else if (req.body.usedCouponCode) {
      couponCodeToSearch = req.body.usedCouponCode;
      logToFile('[FormSubmit] Usando fallback usedCouponCode: ' + couponCodeToSearch);
    } else if (req.body.referralCode) {
      couponCodeToSearch = req.body.referralCode;
      logToFile('[FormSubmit] Usando fallback referralCode: ' + couponCodeToSearch);
    }

    if (couponCodeToSearch && typeof couponCodeToSearch === 'string') {
      const normalizedCode = couponCodeToSearch.trim().toUpperCase().replace(/\s+/g, '-');
      logToFile('[FormSubmit] normalizedCode: ' + normalizedCode);
      
      const referrer = await prisma.user.findUnique({
        where: { referralCode: normalizedCode }
      });
      
      if (referrer) {
        logToFile('[FormSubmit] Referrer encontrado: ' + referrer.name);
        referredByUserId = referrer.id;
          referredByName = referrer.name;
      } else {
        logToFile('[FormSubmit] No se encontró el referrer para el código: ' + normalizedCode);
      }
    } else {
      logToFile('[FormSubmit] No se encontró ningún código en el body. Body: ' + JSON.stringify(req.body));
    }
    
    const newFormSubmission = await prisma.formSubmission.create({
      data: {
        workflowId,
        name: req.body[nameKey] || null,
        email: req.body[emailKey] || null,
        referredByUserId: referredByUserId,
        payload: req.body
      }
    });

    // Create a Lead if the workflow is linked to a project
    if (workflow.projectId) {
      const newLead = await prisma.lead.create({
        data: {
          projectId: workflow.projectId,
          businessName: req.body.businessName || req.body.company || null,
          contactName: req.body[nameKey] || null,
          email: req.body[emailKey] || null,
          phone: req.body.phone || req.body.telefono || null,
          website: req.body.website || null,
          source: 'Formulario Web',
          status: 'NUEVO',
          metadata: { coupon: req.body.coupon || req.body.referralCode || req.body.couponCode, referredByUserId, referredByName }
        }
      });
      // Inject leadId so ExecutionEngine can log activities
      req.body.leadId = newLead.id;
    }

    // Ejecutar el motor de IA con los datos reales del formulario
    const result = await ExecutionEngine.executeWorkflow(workflowId, req.body);

    res.status(201).json({
      message: 'Formulario procesado exitosamente',
      submission: newFormSubmission,
      executionResult: result
    });
  } catch (error) {
    next(error);
  }
};


export const getFormSubmissions = async (req: Request, res: Response) => {
  try {
    const submissions = await prisma.formSubmission.findMany({
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            project: {
              select: { id: true, name: true }
            }
          }
        },
        referredBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(submissions);
  } catch (error: any) {
    res.status(500).json({ error: 'Error fetching form submissions', details: error.message });
  }
};
