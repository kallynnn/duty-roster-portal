// src/types/express.d.ts
// Розширюємо глобальний тип Express.Request — додаємо поле user
// Завдяки цьому req.user доступний у ВСІХ роутах без кастингів

import { JwtPayload } from '../auth.middleware';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}