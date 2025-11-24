// ===================================================
// === ФІНАЛЬНА ВЕРСІЯ V6: index.ts ("Плаваюча" статистика) ===
// ===================================================

// === 1. ІМПОРТИ ===
import "dotenv/config"; 
import express, { Request, Response } from 'express'; 
import cors from 'cors';           
// Імпортуємо 'Prisma' для обробки помилок, 'Role' для реєстрації, 'Soldier' для V5
import { PrismaClient, Prisma, Role, Soldier } from '@prisma/client'; 
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { authMiddleware } from './auth.middleware'; 
import axios from 'axios';

// === 2. ІНІЦІАЛІЗАЦІЯ ===
const app = express(); 
const prisma = new PrismaClient(); 
const PORT = process.env.PORT || 5000; 

// === 3. НАЛАШТУВАННЯ (MIDDLEWARE) ===
app.use(express.json()); 
app.use(cors()); 

// ===================================================
// === 4. ПУБЛІЧНІ API (Новини, Галерея, Статистика) ===
// ===================================================

// GET: Отримати всі новини (з лімітом)
app.get('/api/news', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const news = await prisma.news.findMany({
      orderBy: { createdAt: 'desc' }, 
      take: limit, 
    });
    res.json(news); 
  } catch (error) { res.status(500).json({ error: 'Failed to fetch news' }); }
});
// POST: Завантажити "свіжі" новини з зовнішнього API
app.post(
  '/api/news/fetch-external',
  authMiddleware, // Защищаем, чтобы только админ/командир мог это делать
  async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.NEWS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: 'API ключ для новин не налаштовано на сервері' });
      }

      // === ВАЖНО: Адаптуйте этот URL под ваш API ===
      // Это пример для NewsAPI.org (поиск по "ЗСУ" в Украине)
      // Убедитесь, что используете правильный URL для вашего ключа!
      const externalApiUrl = `https://newsapi.org/v2/everything?q=ЗСУ&language=uk&sortBy=publishedAt&apiKey=${apiKey}`;

      // 1. Ваш бэкенд идет на внешний API
      const response = await axios.get(externalApiUrl);
      
      const articles = response.data.articles;
      if (!articles || articles.length === 0) {
        return res.status(200).json({ message: 'Нових новин не знайдено' });
      }

      // 2. Форматируем новости под вашу Prisma-модель 'News'
      const newsToCreate = articles.map((article: any) => ({
        title: article.title,
        content: article.description || '... (немає опису)',
        imageUrl: article.urlToImage,
        // Prisma добавит 'createdAt' и 'id' сама
      })).filter((article: any) => article.title && article.content); // Убираем "пустые" новости

      // 3. Сохраняем в вашу базу данных
      const result = await prisma.news.createMany({
        data: newsToCreate,
        skipDuplicates: true, // Пропускать, если новость с таким @unique title уже есть
      });

      res.status(201).json({ message: `Успішно імпортовано ${result.count} нових новин.` });

    } catch (error: any) {
      console.error('Помилка при завантаженні зовнішніх новин:', error.message);
      res.status(500).json({ message: 'Помилка при завантаженні зовнішніх новин' });
    }
  }
);

// GET: Отримати всі фото для галереї
app.get('/api/gallery', async (req: Request, res: Response) => {
  try {
    const images = await prisma.galleryImage.findMany();
    res.json(images);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch gallery images' }); }
});

// GET: Отримати ЗАГАЛЬНУ статистику (V6 - "Плаваюча")
app.get(
  '/api/statistics/summary',
  async (req: Request, res: Response) => {
    try {
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()); 
      const startOf7DaysAgo = new Date(startOfToday);
      startOf7DaysAgo.setDate(startOfToday.getDate() - 6); 
      const startOf30DaysAgo = new Date(startOfToday);
      startOf30DaysAgo.setDate(startOfToday.getDate() - 29); 
      const startOf365DaysAgo = new Date(startOfToday);
      startOf365DaysAgo.setDate(startOfToday.getDate() - 364); 
      
      const thisWeekCount = await prisma.schedule.count({ where: { date: { gte: startOf7DaysAgo } } });
      const thisMonthCount = await prisma.schedule.count({ where: { date: { gte: startOf30DaysAgo } } });
      const thisYearCount = await prisma.schedule.count({ where: { date: { gte: startOf365DaysAgo } } });

      const allMonthDuties = await prisma.schedule.findMany({
        where: { date: { gte: startOf30DaysAgo } },
        include: { soldier: { select: { name: true } } }
      });
      const counts: { [name: string]: number } = {};
      allMonthDuties.forEach(duty => {
        if (duty.soldier) { counts[duty.soldier.name] = (counts[duty.soldier.name] || 0) + 1; }
      });
      const leaderboard = Object.entries(counts) 
        .sort((a, b) => b[1] - a[1]) 
        .slice(0, 3) 
        .map(([name, count]) => ({ name, count })); 

      res.json({ thisWeekCount, thisMonthCount, thisYearCount, leaderboard });
    } catch (error) { res.status(500).json({ message: 'Помилка отримання статистики' }); }
  }
);
    
// ===================================================
// === 5. API АВТЕНТИФІКАЦІЇ (Register, Login) ===
// ===================================================
    
// POST: Реєстрація (з автоматичним призначенням ролей)
app.post(
  '/api/auth/register',
  [
    body('name', 'Будь ласка, введіть ПІБ').notEmpty(),
    body('rank', 'Будь ласка, оберіть звання').notEmpty(), // Змінено на 'оберіть'
    body('phoneNumber', 'Будь ласка, введіть номер телефону').notEmpty(),
    body('position', 'Будь ласка, введіть посаду').notEmpty(), // Змінено на 'введіть'
    body('email', 'Будь ласка, введіть коректний email').isEmail(),
    body('password', 'Пароль має бути мінімум 6 символів').isLength({ min: 6 }),
    body('passwordConfirmation').custom((value, { req }) => {
      if (value !== req.body.password) { throw new Error('Паролі не збігаються'); }
      return true; 
    }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }
      const { email, password, name, rank, phoneNumber, position } = req.body;
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ message: 'Користувач з таким email вже існує' });
      }
      const hashedPassword = await bcrypt.hash(password, 12);
      let userRole: Role = 'SOLDIER'; 
      if (position.toLowerCase().includes('командир')) { 
        userRole = 'COMMANDER'; 
      }
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role: userRole, 
          soldier: { 
            create: { name, rank, position, phoneNumber, status: 'ACTIVE' }
          }
        },
        include: { soldier: true }
      });
      res.status(201).json({ message: 'Користувач успішно створений' });
    } catch (error) {
      console.error(error); 
      res.status(500).json({ message: 'Щось пішло не так...' });
    }
  }
);

// POST: Логін
app.post(
  '/api/auth/login',
  [
    body('email', 'Введіть коректний email').normalizeEmail().isEmail(),
    body('password', 'Введіть пароль').exists(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array(), message: 'Помилка валідації' });
      }
      const { email, password } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(400).json({ message: 'Користувача не знайдено' });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Неправильний пароль' });
      }
      const token = jwt.sign(
        { userId: user.id, role: user.role, email: user.email },
        process.env.JWT_SECRET as string,    
        { expiresIn: '1h' }                   
      );
      res.json({ token, userId: user.id, role: user.role });
    } catch (error) { res.status(500).json({ message: 'Щось пішло не так...' }); }
  }
);

// GET: Отримати дані про ПОТОЧНОГО залогіненого користувача
app.get(
  '/api/auth/me',
  authMiddleware, 
  async (req: Request, res: Response) => {
    try {
      // @ts-ignore
      const userId = req.user.userId; 
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { soldier: true },
      });
      if (!user) {
        return res.status(404).json({ message: 'Користувача не знайдено' });
      }
      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        soldier: user.soldier 
      });
    } catch (error) { res.status(500).json({ message: 'Помилка отримання даних профілю' }); }
  }
);
    
// ===================================================
// === 7. ЯДРО ПРОЄКТУ (API для Солдат, Нарядів, Графіку) ===
// ===================================================

// --- CRUD для Солдат (Soldiers) ---
    
app.get('/api/soldiers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const soldiers = await prisma.soldier.findMany({ orderBy: { name: 'asc' } });
    res.json(soldiers);
  } catch (error) { res.status(500).json({ message: 'Помилка отримання списку солдат' }); }
});
    
app.post('/api/soldiers', authMiddleware, [ 
    body('name', 'Ім\'я не може бути порожнім').notEmpty(),
    body('rank', 'Звання не може бути порожнім').notEmpty(),
  ], async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { name, rank, status } = req.body; 
      const newSoldier = await prisma.soldier.create({
        data: {
          name,
          rank,
          position: 'Не вказано', 
          status: status || 'ACTIVE', 
        },
      });
      res.status(201).json(newSoldier);
    } catch (error) { res.status(500).json({ message: 'Помилка створення солдата' }); }
  }
);
    
app.patch('/api/soldiers/:id/status', authMiddleware, 
  [ body('status', 'Статус не може бути порожнім').isIn(['ACTIVE', 'LEAVE', 'SICK']) ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { id } = req.params; 
      const { status } = req.body; 
      const updatedSoldier = await prisma.soldier.update({
        where: { id: parseInt(id) },
        data: { status },
      });
      res.json(updatedSoldier);
    } catch (error) { res.status(500).json({ message: 'Помилка оновлення статусу' }); }
  }
);

app.put('/api/soldiers/:id', authMiddleware, [ 
    body('name', 'Ім\'я не може бути порожнім').notEmpty(),
    body('rank', 'Звання не може бути порожнім').notEmpty(),
  ], async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { id } = req.params;
      const { name, rank } = req.body; 
      const updatedSoldier = await prisma.soldier.update({
        where: { id: parseInt(id) },
        data: { name, rank }, 
      });
      res.json(updatedSoldier);
    } catch (error) { res.status(500).json({ message: 'Помилка оновлення солдата' }); }
  }
);

app.delete('/api/soldiers/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const soldierId = parseInt(id);
    await prisma.schedule.deleteMany({ where: { soldierId: soldierId } });
    await prisma.soldier.delete({ where: { id: soldierId } });
    res.json({ message: 'Солдата та всі його наряди в графіку успішно видалено' });
  } catch (error) { 
     if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') { 
       return res.status(400).json({ message: 'Неможливо видалити. Перевірте, чи не пов\'язаний цей запис з акаунтом користувача.' });
     }
     res.status(500).json({ message: 'Помилка видалення солдата' });
  }
});

// --- CRUD для Видів Нарядів (DutyTypes) ---
    
app.get('/api/duty-types', authMiddleware, async (req: Request, res: Response) => {
  try {
    const dutyTypes = await prisma.dutyType.findMany({ orderBy: { name: 'asc' } });
    res.json(dutyTypes);
  } catch (error) { res.status(500).json({ message: 'Помилка отримання видів нарядів' }); }
});
    
app.post('/api/duty-types', authMiddleware, 
  [ body('name', 'Назва не може бути порожнім').notEmpty() ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { name, description, allowedRanks } = req.body;
      const newDutyType = await prisma.dutyType.create({
        data: {
          name,
          description: description || null,
          allowedRanks: allowedRanks || [], 
        },
      });
      res.status(201).json(newDutyType);
    } catch (error) { res.status(500).json({ message: 'Помилка створення виду наряду' }); }
  }
);

app.put('/api/duty-types/:id', authMiddleware, 
  [ body('name', 'Назва не може бути порожнім').notEmpty() ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { id } = req.params;
      const { name, description, allowedRanks } = req.body;
      const updatedDutyType = await prisma.dutyType.update({
        where: { id: parseInt(id) },
        data: { 
          name, 
          description: description || null,
          allowedRanks: allowedRanks, 
        },
      });
      res.json(updatedDutyType);
    } catch (error) { res.status(500).json({ message: 'Помилка оновлення виду наряду' }); }
  }
);

app.delete('/api/duty-types/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dutyTypeId = parseInt(id);
    await prisma.schedule.deleteMany({ where: { dutyTypeId: dutyTypeId } });
    await prisma.dutyType.delete({ where: { id: dutyTypeId } });
    res.json({ message: 'Вид наряду та всі пов\'язані з ним записи у графіку успішно видалено' });
  } catch (error) { 
     if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') { 
       return res.status(400).json({ message: 'Неможливо видалити вид наряду, сталася непередбачена помилка.' });
     }
     res.status(500).json({ message: 'Помилка видалення виду наряду' });
  }
});
    
// --- API для Графіку (Schedule) ---
    
app.get('/api/schedule', authMiddleware, async (req: Request, res: Response) => {
  try {
    const scheduleEvents = await prisma.schedule.findMany({
      include: { soldier: true, dutyType: true },
      orderBy: { date: 'asc' }
    });
    res.json(scheduleEvents);
  } catch (error) { res.status(500).json({ message: 'Помилка отримання графіку' }); }
});

// GET: Отримати ОСОБИСТУ статистику (V6)
// GET: Отримати ОСОБИСТУ статистику (V6)
app.get(
  '/api/statistics/my-summary',
  authMiddleware, 
  async (req: Request, res: Response) => {
    try {
      // @ts-ignore
      const userId = req.user.userId;
      const soldier = await prisma.soldier.findUnique({ where: { userId: userId } });

      if (!soldier) {
        return res.status(404).json({ message: 'Профіль солдата не знайдено' });
      }
      
      // === НОВА ЛОГІКА ДАТ ===
      const today = new Date();
      // Встановлюємо час на 00:00:00, щоб уникнути проблем з часовими поясами
      today.setHours(0, 0, 0, 0); 

      // --- 1. Логіка для "ЦЬОГО РОКУ" ---
      // (з 1 січня по 31 грудня поточного року)
      const startOfYear = new Date(today.getFullYear(), 0, 1); // 1 січня
      const endOfYear = new Date(today.getFullYear(), 11, 31); // 31 грудня

      // --- 2. Логіка для "ЦЬОГО МІСЯЦЯ" ---
      // (з 1-го числа по останнє число поточного місяця)
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      // (0-й день наступного місяця = останній день поточного)
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      // --- 3. Логіка для "ЦЬОГО ТИЖНЯ" (Понеділок - Неділя) ---
      // getDay() повертає 0 для Неділі, 1 для Понеділка, ... 6 для Суботи
      const dayOfWeek = today.getDay(); 
      // Формула для пошуку Понеділка:
      // Якщо сьогодні Неділя (0), віднімаємо 6 днів.
      // В іншому випадку, віднімаємо (dayOfWeek - 1)
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const startOfWeek = new Date(today.setDate(diff));
      startOfWeek.setHours(0, 0, 0, 0); // Переконуємось, що це початок дня
      
      // Кінець тижня = Понеділок + 6 днів
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999); // Кінець дня в неділю
      
      // === ЗАПИТИ ДО БАЗИ (З ВИПРАВЛЕННЯМ) ===

      const thisWeekCount = await prisma.schedule.count({
        where: { 
            soldierId: soldier.id, 
            date: { 
                gte: startOfWeek, // Більше або дорівнює Понеділку
                lte: endOfWeek    // Менше або дорівнює Неділі
            } 
        }
      });
      
      const thisMonthCount = await prisma.schedule.count({
        where: { 
            soldierId: soldier.id, 
            date: { 
                gte: startOfMonth, // Більше або дорівнює 1-му числу
                lte: endOfMonth    // Менше або дорівнює останньому числу
            } 
        }
      });

      const thisYearCount = await prisma.schedule.count({
        where: { 
            soldierId: soldier.id, 
            date: { 
                gte: startOfYear, // Більше або дорівнює 1 січня
                lte: endOfYear    // Менше або дорівнює 31 грудня
            } 
        }
      });
      
      res.json({ thisWeekCount, thisMonthCount, thisYearCount });

    } catch (error) {
      console.error(error); // Додайте це, щоб бачити помилки в консолі сервера
      res.status(500).json({ message: 'Помилка отримання особистої статистики' });
    }
  }
);

// GET: Отримати "Мій" графік (для Солдата)
app.get(
  '/api/schedule/my-schedule',
  authMiddleware, 
  async (req: Request, res: Response) => {
    try {
      // @ts-ignore
      const userId = req.user.userId; 
      const soldier = await prisma.soldier.findUnique({
        where: { userId: userId },
      });
      if (!soldier) {
        return res.status(404).json({ message: 'Профіль солдата не знайдено' });
      }

      const myDutyDates = await prisma.schedule.findMany({
        where: { soldierId: soldier.id },
        select: { date: true },
        distinct: ['date']
      });
      const datesToFetch = myDutyDates.map(d => d.date);

      const scheduleEvents = await prisma.schedule.findMany({
        where: { date: { in: datesToFetch } },
        include: { soldier: true, dutyType: true },
        orderBy: { date: 'asc' }
      });
      
      res.json(scheduleEvents);

    } catch (error) {
      res.status(500).json({ message: 'Помилка отримання особистого графіку' });
    }
  }
);

// POST: Згенерувати графік (V5 - "М'який" кулдаун, з ролями)
app.post(
  '/api/schedule/generate',
  authMiddleware, 
  async (req: Request, res: Response) => {
    try {
      const { month, year } = req.body; 

      if (!month || !year) {
        return res.status(400).json({ message: 'Будь ласка, вкажіть місяць та рік' }); // <-- ТВОЯ ПОМИЛКА БУЛА ТУТ
      }

      const activeSoldiers = await prisma.soldier.findMany({
        where: { status: 'ACTIVE' },
      });
      const dutyTypes = await prisma.dutyType.findMany(); 

      if (activeSoldiers.length === 0 || dutyTypes.length === 0) {
        return res.status(400).json({ message: 'Недостаньо даних: додайте солдат та види нарядів' });
      }

      const lastDutyDates: { [id: number]: Date } = {};
      const generationStartDate = new Date(year, month - 1, 1);
      
      const recentDuties = await prisma.schedule.groupBy({
        by: ['soldierId'],
        _max: { date: true },
        where: { date: { lt: generationStartDate } }
      });
      
      const defaultLastDate = new Date('2000-01-01');
      activeSoldiers.forEach(s => {
        const foundDuty = recentDuties.find(d => d.soldierId === s.id);
        lastDutyDates[s.id] = foundDuty?._max.date || defaultLastDate;
      });

      const daysInMonth = new Date(year, month, 0).getDate();
      const newScheduleEntries = []; 

      for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month - 1, day);
        
        for (const duty of dutyTypes) {
          let selectedSoldier: Soldier | null = null; 
          
          const allowedRanks = duty.allowedRanks.map(r => r.toLowerCase());
          let eligibleSoldiers = activeSoldiers.slice(); 

          if (allowedRanks.length > 0) {
            eligibleSoldiers = eligibleSoldiers.filter(s => 
              allowedRanks.includes(s.rank.toLowerCase())
            );
          }
          
          if (eligibleSoldiers.length === 0) {
            continue; 
          }

          const fourDaysAgo = new Date(currentDate);
          fourDaysAgo.setDate(currentDate.getDate() - 3);
          
          const availableSoldiers = eligibleSoldiers.sort((a, b) => {
            const aIsRested = lastDutyDates[a.id] < fourDaysAgo;
            const bIsRested = lastDutyDates[b.id] < fourDaysAgo;
        
            if (aIsRested && !bIsRested) return -1; 
            if (!aIsRested && bIsRested) return 1;  
        
            return lastDutyDates[a.id].getTime() - lastDutyDates[b.id].getTime();
          });
          
          selectedSoldier = availableSoldiers[0]; 

          if (selectedSoldier) {
            newScheduleEntries.push({
              date: currentDate,
              soldierId: selectedSoldier.id,
              dutyTypeId: duty.id,
            });
            lastDutyDates[selectedSoldier.id] = currentDate;
          }
        }
      }

      await prisma.schedule.deleteMany({
        where: {
          date: {
            gte: new Date(year, month - 1, 1),
            lte: new Date(year, month - 1, daysInMonth),
          }
        }
      });
      
      await prisma.schedule.createMany({
        data: newScheduleEntries,
      });

      res.status(201).json({ message: `Графік на ${month}/${year} успішно згенеровано!` });

    } catch (error: any) {
      console.error(error);
      res.status(500).json({ message: 'Помилка генерації графіку', error: error.message });
    }
  }
);
    
// ===================================================
// === 9. ЗАПУСК СЕРВЕРА ===
// ===================================================
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});