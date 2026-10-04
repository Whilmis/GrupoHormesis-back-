import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import prisma from '../config/db';
import { sendVerificationEmail } from '../services/email.service';

function generateReferralCode(name: string): string {
  const prefix = name.trim().substring(0, 4).toUpperCase() || 'USER';
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${randomStr}`;
}

const registerSchema = z.object({
  name: z.string().min(2),
  empresa: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['cliente', 'colaborador']).optional(),
  phone: z.string().optional(),
  joinWhatsapp: z.boolean().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { name, empresa, email, password, role, phone, joinWhatsapp } = validatedData;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'El email ya está registrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = uuidv4();

    const newUser = await prisma.user.create({
      data: {
        name,
        company: empresa,
        email,
        passwordHash,
        role: role || 'cliente',
        phone: phone || null,
        joinWhatsapp: joinWhatsapp || false,
        isVerified: false,
        verificationToken,
        referralCode: generateReferralCode(name),
      },
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        role: true,
        phone: true,
        joinWhatsapp: true,
        isVerified: true,
        referralCode: true,
        createdAt: true
      }
    });

    // Enviar correo de verificación de forma asíncrona (no bloqueante)
    sendVerificationEmail(newUser.email, verificationToken);

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: newUser
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Errores de validación', errors: error.errors });
    }
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    if (!user.isVerified && user.role !== 'admin') {
      return res.status(403).json({ message: 'Por favor, confirma tu correo electrónico primero.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'supersecret_jwt_key_hormesis_2026',
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Login exitoso',
      token
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Errores de validación', errors: error.errors });
    }
    next(error);
  }
};

export const getMe = async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        company: true,
        role: true,
        referralCode: true,
        createdAt: true,
        updatedAt: true
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

export const confirmEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.query;
    
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Token de verificación inválido o ausente.' });
    }

    const user = await prisma.user.findFirst({
      where: { verificationToken: token }
    });

    if (!user) {
      return res.status(400).json({ message: 'El enlace de verificación es inválido o ha expirado.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null
      }
    });

    res.json({ message: 'Tu correo ha sido verificado con éxito. Ya puedes iniciar sesión.' });
  } catch (error) {
    next(error);
  }
};
