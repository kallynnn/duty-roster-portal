import "dotenv/config"; // Завантажуємо змінні з .env

// Просто експортуємо об'єкт конфігурації
export default {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    // Прямо вказуємо Prisma використовувати змінну з .env
    url: process.env.DATABASE_URL,
  },
};