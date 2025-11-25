// ===================================================
// === ФІНАЛЬНА ВЕРСІЯ V7: index.ts (ВСЕ ВКЛЮЧЕНО) ===
// ===================================================

import "dotenv/config"; 
import express, { Request, Response } from 'express'; 
import cors from 'cors';           
import { PrismaClient, Prisma, Role, Soldier } from '@prisma/client'; 
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { authMiddleware } from './auth.middleware'; 

const app = express(); 
const prisma = new PrismaClient(); 
const PORT = process.env.PORT || 5000; 

app.use(express.json()); 
app.use(cors()); 

// ===================================================
// === ПУБЛІЧНІ API ===
// ===================================================

app.get('/api/news', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const news = await prisma.news.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
    res.json(news); 
  } catch (error) { res.status(500).json({ error: 'Failed to fetch news' }); }
});

app.get('/api/gallery', async (req: Request, res: Response) => {
  try {
    const images = await prisma.galleryImage.findMany();
    res.json(images);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch gallery images' }); }
});

// --- ОСЬ ЦЬОГО РОУТУ ТОБІ НЕ ВИСТАЧАЛО (Загальна статистика) ---
app.get('/api/statistics/summary', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()); 
    
    const startOf7DaysAgo = new Date(startOfToday); startOf7DaysAgo.setDate(startOfToday.getDate() - 6); 
    const startOf30DaysAgo = new Date(startOfToday); startOf30DaysAgo.setDate(startOfToday.getDate() - 29); 
    const startOf365DaysAgo = new Date(startOfToday); startOf365DaysAgo.setDate(startOfToday.getDate() - 364); 
    
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
});

// ===================================================
// === АВТЕНТИФІКАЦІЯ ===
// ===================================================

app.post('/api/auth/register', [
    body('name', 'Будь ласка, введіть ПІБ').notEmpty(),
    body('rank', 'Будь ласка, оберіть звання').notEmpty(),
    body('phoneNumber', 'Будь ласка, введіть номер телефону').notEmpty(),
    body('position', 'Будь ласка, введіть посаду').notEmpty(),
    body('email', 'Будь ласка, введіть коректний email').isEmail(),
    body('password', 'Пароль має бути мінімум 6 символів').isLength({ min: 6 }),
    body('passwordConfirmation').custom((value, { req }) => {
      if (value !== req.body.password) { throw new Error('Паролі не збігаються'); } return true; 
    }),
  ], async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
      const { email, password, name, rank, phoneNumber, position } = req.body;
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) return res.status(400).json({ message: 'Користувач з таким email вже існує' });
      const hashedPassword = await bcrypt.hash(password, 12);
      let userRole: Role = 'SOLDIER'; 
      if (position.toLowerCase().includes('командир')) userRole = 'COMMANDER'; 
      const user = await prisma.user.create({
        data: {
          email, password: hashedPassword, role: userRole, 
          soldier: { create: { name, rank, position, phoneNumber, status: 'ACTIVE' } }
        }, include: { soldier: true }
      });
      res.status(201).json({ message: 'Користувач успішно створений' });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Щось пішло не так...' }); }
  }
);

app.post('/api/auth/login', [
    body('email', 'Введіть коректний email').normalizeEmail().isEmail(),
    body('password', 'Введіть пароль').exists(),
  ], async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array(), message: 'Помилка валідації' });
      const { email, password } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return res.status(400).json({ message: 'Користувача не знайдено' });
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Неправильний пароль' });
      const token = jwt.sign({ userId: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
      res.json({ token, userId: user.id, role: user.role });
    } catch (error) { res.status(500).json({ message: 'Щось пішло не так...' }); }
  }
);

app.get('/api/auth/me', authMiddleware, async (req: Request, res: Response) => {
    try {
      // @ts-ignore
      const userId = req.user.userId; 
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { soldier: true } });
      if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });
      res.json({ id: user.id, email: user.email, role: user.role, soldier: user.soldier });
    } catch (error) { res.status(500).json({ message: 'Помилка отримання даних профілю' }); }
  }
);

// ===================================================
// === ЗАХИЩЕНІ API (ЯДРО) ===
// ===================================================

// Новини (з NewsAPI)
app.post('/api/news/fetch-external', authMiddleware, async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.NEWS_API_KEY;
      if (!apiKey) throw new Error('Відсутній ключ NewsAPI');
      const url = `https://newsapi.org/v2/everything?q=(військові OR армія OR ЗСУ)&language=uk&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`;
      const newsResponse = await fetch(url);
      const newsData = await newsResponse.json();
      if (newsData.status !== 'ok') throw new Error(newsData.message || 'Помилка NewsAPI');
      const articles = newsData.articles;
      if (!articles || articles.length === 0) return res.status(404).json({ message: 'Новин не знайдено' });
      let addedCount = 0;
      for (const article of articles) {
        const existingNews = await prisma.news.findFirst({ where: { title: article.title } });
        if (!existingNews && article.title !== "[Removed]") {
          await prisma.news.create({
            data: { title: article.title, content: article.description || '...', imageUrl: article.urlToImage || null, createdAt: new Date(article.publishedAt) },
          });
          addedCount++;
        }
      }
      res.status(201).json({ message: `Успішно завантажено ${addedCount} нових новин.` });
    } catch (error: any) { res.status(500).json({ message: error.message || 'Помилка' }); }
  }
);

// Фото
app.post('/api/gallery', authMiddleware, [body('imageUrl').isURL(), body('description').notEmpty()], async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { imageUrl, description } = req.body;
      const newImage = await prisma.galleryImage.create({ data: { imageUrl, description } });
      res.status(201).json(newImage);
    } catch (error) { res.status(500).json({ message: 'Помилка' }); }
  }
);

// Солдати (CRUD)
app.get('/api/soldiers', authMiddleware, async (req: Request, res: Response) => {
  try { const soldiers = await prisma.soldier.findMany({ orderBy: { name: 'asc' } }); res.json(soldiers); } catch (e) { res.status(500).json({ message: 'Помилка' }); }
});
app.post('/api/soldiers', authMiddleware, [body('name').notEmpty(), body('rank').notEmpty()], async (req: Request, res: Response) => {
  try {
    const { name, rank, status } = req.body; 
    const newSoldier = await prisma.soldier.create({ data: { name, rank, position: 'Не вказано', status: status || 'ACTIVE' } });
    res.status(201).json(newSoldier);
  } catch (e) { res.status(500).json({ message: 'Помилка' }); }
});
app.patch('/api/soldiers/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try { const { id } = req.params; const { status } = req.body; 
  const updated = await prisma.soldier.update({ where: { id: parseInt(id) }, data: { status } }); res.json(updated); } catch (e) { res.status(500).json({ message: 'Помилка' }); }
});
app.put('/api/soldiers/:id', authMiddleware, async (req: Request, res: Response) => {
  try { const { id } = req.params; const { name, rank } = req.body; 
  const updated = await prisma.soldier.update({ where: { id: parseInt(id) }, data: { name, rank } }); res.json(updated); } catch (e) { res.status(500).json({ message: 'Помилка' }); }
});
app.delete('/api/soldiers/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const soldierId = parseInt(req.params.id);
    await prisma.schedule.deleteMany({ where: { soldierId } });
    await prisma.soldier.delete({ where: { id: soldierId } });
    res.json({ message: 'Видалено' });
  } catch (e) { res.status(500).json({ message: 'Помилка видалення' }); }
});

// Види нарядів (CRUD)
app.get('/api/duty-types', authMiddleware, async (req: Request, res: Response) => {
  try { const dt = await prisma.dutyType.findMany({ orderBy: { name: 'asc' } }); res.json(dt); } catch (e) { res.status(500).json({ message: 'Помилка' }); }
});
app.post('/api/duty-types', authMiddleware, [body('name').notEmpty()], async (req: Request, res: Response) => {
  try {
    const { name, description, allowedRanks } = req.body;
    const newDT = await prisma.dutyType.create({ data: { name, description, allowedRanks: allowedRanks || [] } });
    res.status(201).json(newDT);
  } catch (e) { res.status(500).json({ message: 'Помилка' }); }
});
app.put('/api/duty-types/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params; const { name, description, allowedRanks } = req.body;
    const updated = await prisma.dutyType.update({ where: { id: parseInt(id) }, data: { name, description, allowedRanks } }); res.json(updated);
  } catch (e) { res.status(500).json({ message: 'Помилка' }); }
});
app.delete('/api/duty-types/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const dutyTypeId = parseInt(req.params.id);
    await prisma.schedule.deleteMany({ where: { dutyTypeId } });
    await prisma.dutyType.delete({ where: { id: dutyTypeId } });
    res.json({ message: 'Видалено' });
  } catch (e) { res.status(500).json({ message: 'Помилка' }); }
});

// Графік та Генерація
app.get('/api/schedule', authMiddleware, async (req: Request, res: Response) => {
  try {
    const events = await prisma.schedule.findMany({ include: { soldier: true, dutyType: true }, orderBy: { date: 'asc' } });
    res.json(events);
  } catch (e) { res.status(500).json({ message: 'Помилка' }); }
});

app.get('/api/statistics/my-summary', authMiddleware, async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.user.userId; const soldier = await prisma.soldier.findUnique({ where: { userId } });
    if (!soldier) return res.status(404).json({ message: 'Солдата не знайдено' });
    // Дати
    const today = new Date(); const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOf7 = new Date(startOfToday); startOf7.setDate(startOf7.getDate() - 6);
    const startOf30 = new Date(startOfToday); startOf30.setDate(startOf30.getDate() - 29);
    const startOf365 = new Date(startOfToday); startOf365.setDate(startOf365.getDate() - 364);

    const w = await prisma.schedule.count({ where: { soldierId: soldier.id, date: { gte: startOf7 } } });
    const m = await prisma.schedule.count({ where: { soldierId: soldier.id, date: { gte: startOf30 } } });
    const y = await prisma.schedule.count({ where: { soldierId: soldier.id, date: { gte: startOf365 } } });
    res.json({ thisWeekCount: w, thisMonthCount: m, thisYearCount: y });
  } catch (e) { res.status(500).json({ message: 'Помилка' }); }
});

app.get('/api/schedule/my-schedule', authMiddleware, async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.user.userId; const soldier = await prisma.soldier.findUnique({ where: { userId } });
    if (!soldier) return res.status(404).json({ message: 'Солдата не знайдено' });
    const myDates = await prisma.schedule.findMany({ where: { soldierId: soldier.id }, select: { date: true }, distinct: ['date'] });
    const dates = myDates.map(d => d.date);
    const events = await prisma.schedule.findMany({ where: { date: { in: dates } }, include: { soldier: true, dutyType: true }, orderBy: { date: 'asc' } });
    res.json(events);
  } catch (e) { res.status(500).json({ message: 'Помилка' }); }
});

// Генерація V5
app.post('/api/schedule/generate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) return res.status(400).json({ message: 'Вкажіть місяць/рік' });
    const soldiers = await prisma.soldier.findMany({ where: { status: 'ACTIVE' } });
    const duties = await prisma.dutyType.findMany();
    if (soldiers.length === 0 || duties.length === 0) return res.status(400).json({ message: 'Недостатньо даних' });

    const lastDutyDates: { [id: number]: Date } = {};
    const genStart = new Date(year, month - 1, 1);
    const recent = await prisma.schedule.groupBy({ by: ['soldierId'], _max: { date: true }, where: { date: { lt: genStart } } });
    const defDate = new Date('2000-01-01');
    soldiers.forEach(s => { const f = recent.find(r => r.soldierId === s.id); lastDutyDates[s.id] = f?._max.date || defDate; });

    const daysInMonth = new Date(year, month, 0).getDate();
    const newEntries = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const current = new Date(year, month - 1, day);
      for (const duty of duties) {
        const allowed = duty.allowedRanks.map(r => r.toLowerCase());
        let eligible = soldiers.slice();
        if (allowed.length > 0) eligible = eligible.filter(s => allowed.includes(s.rank.toLowerCase()));
        if (eligible.length === 0) continue;

        const fourDaysAgo = new Date(current); fourDaysAgo.setDate(current.getDate() - 3);
        // Сортуємо: спочатку ті, хто відпочив > 4 днів, потім за давністю
        const available = eligible.sort((a, b) => {
            const aRested = lastDutyDates[a.id] < fourDaysAgo;
            const bRested = lastDutyDates[b.id] < fourDaysAgo;
            if (aRested && !bRested) return -1;
            if (!aRested && bRested) return 1;
            return lastDutyDates[a.id].getTime() - lastDutyDates[b.id].getTime();
        });
        
        const selected = available[0];
        if (selected) {
          newEntries.push({ date: current, soldierId: selected.id, dutyTypeId: duty.id });
          lastDutyDates[selected.id] = current;
        }
      }
    }
    await prisma.schedule.deleteMany({ where: { date: { gte: genStart, lte: new Date(year, month - 1, daysInMonth) } } });
    await prisma.schedule.createMany({ data: newEntries });
    res.status(201).json({ message: 'Графік згенеровано!' });
  } catch (e: any) { res.status(500).json({ message: 'Помилка', error: e.message }); }
});

app.listen(PORT, () => { console.log(`✅ Server is running on http://localhost:${PORT}`); });