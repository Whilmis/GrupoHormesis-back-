import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/db';


export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        role: true,
        referralCode: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        role: true,
        referralCode: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
};

import bcrypt from 'bcrypt';

const createUserSchema = z.object({
  name: z.string().min(2),
  company: z.string().min(2).optional(),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['cliente', 'colaborador', 'admin'])
});

function generateReferralCode(name: string): string {
  const prefix = name.trim().substring(0, 4).toUpperCase() || 'USER';
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${randomStr}`;
}

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = createUserSchema.parse(req.body);
    const { name, company, email, password, role } = validatedData;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'El correo ya está registrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        name,
        company: company || '',
        email,
        passwordHash,
        role,
        referralCode: generateReferralCode(name)
      },
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        role: true,
        referralCode: true,
        createdAt: true
      }
    });

    res.status(201).json({ message: 'Usuario creado', user: newUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Errores de validación', errors: error.errors });
    }
    next(error);
  }
};

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  company: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional().or(z.literal('')),
  role: z.enum(['cliente', 'colaborador', 'admin']).optional()
});

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validatedData = updateUserSchema.parse(req.body);

    const dataToUpdate: any = {
      name: validatedData.name,
      email: validatedData.email,
      role: validatedData.role,
      company: validatedData.company,
    };

    if (validatedData.password && validatedData.password !== '') {
      const salt = await bcrypt.genSalt(10);
      dataToUpdate.passwordHash = await bcrypt.hash(validatedData.password, salt);
    }

    // Remover undefined
    Object.keys(dataToUpdate).forEach(key => dataToUpdate[key] === undefined && delete dataToUpdate[key]);

    if (dataToUpdate.email) {
      const existingEmail = await prisma.user.findUnique({ where: { email: dataToUpdate.email } });
      if (existingEmail && existingEmail.id !== id) {
        return res.status(400).json({ message: 'El correo ya está en uso por otro usuario' });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        role: true,
        referralCode: true,
      }
    });

    res.json({ message: 'Usuario actualizado', user: updatedUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Errores de validación', errors: error.errors });
    }
    // Error prisma if user not found
    if ((error as any).code === 'P2025') {
       return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    next(error);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Evitar que el admin se borre a sí mismo
    if ((req as any).user.id === id) {
      return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta' });
    }

    await prisma.user.delete({
      where: { id }
    });

    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    if ((error as any).code === 'P2025') {
       return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    next(error);
  }
};
