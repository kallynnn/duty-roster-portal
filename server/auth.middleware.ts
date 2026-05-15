import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: number;
  role: string;
  email: string;
}

// Розширюємо глобальний Request Express — додаємо поле user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const token = (req.headers.authorization || '').split(' ')[1];

  if (!token) {
    res.status(401).json({ message: 'Немає токену, автентифікація відхилена' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Токен невалідний' });
  }
};