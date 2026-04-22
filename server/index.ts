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
    body('email', 'Будь ласка, введіть коректний email').isEmail(),
    body('password', 'Пароль має бути мінімум 6 символів').isLength({ min: 6 }),
  ], async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
      
      const { email, password, name, rank, phoneNumber, position } = req.body;
      
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) return res.status(400).json({ message: 'Користувач з таким email вже існує' });
      
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // БЕЗПЕЧНА ПЕРЕВІРКА ПОСАДИ (щоб не було помилки 500)
      let userRole: Role = 'SOLDIER'; 
      const safePosition = position || 'Командир'; // Якщо фронтенд не передав посаду
      if (safePosition.toLowerCase().includes('командир')) userRole = 'COMMANDER'; 
      
      const user = await prisma.user.create({
        data: {
          email, 
          password: hashedPassword, 
          role: userRole, 
          soldier: { 
            create: { 
              name, 
              rank: rank || 'Сержант', 
              position: safePosition, 
              phoneNumber: phoneNumber || 'Не вказано', // Захист від порожнього телефону
              status: 'ACTIVE' 
            } 
          }
        }, 
        include: { soldier: true }
      });
      res.status(201).json({ message: 'Користувач успішно створений' });
    } catch (error) { 
      console.error("ПОМИЛКА РЕЄСТРАЦІЇ:", error); // Тепер ми побачимо точну причину в терміналі!
      res.status(500).json({ message: 'Щось пішло не так на сервері...' }); 
    }
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

// Солдати (CRUD)
app.get('/api/soldiers', authMiddleware, async (req: Request, res: Response) => {
  try {
    // 1. Знаходимо профіль того, хто зараз залогінений
    // @ts-ignore
    const currentUserId = req.user.userId;
    const currentCommander = await prisma.soldier.findUnique({ where: { userId: currentUserId } });

    if (!currentCommander) return res.status(404).json({ message: 'Профіль не знайдено' });

    // 2. Будуємо "фільтр" (where clause) залежно від його посади
    let filter = {};

    if (currentCommander.position.includes('Командир роти')) {
      // Бачить усю свою роту (всі взводи і відділення всередині неї)
      filter = { company: currentCommander.company };
      
    } else if (currentCommander.position.includes('Командир взводу')) {
      // Бачить тільки свій взвод (у своїй роті)
      filter = { company: currentCommander.company, platoon: currentCommander.platoon };
      
    } else if (currentCommander.position.includes('Командир відділення')) {
      // Бачить тільки своє відділення
      filter = { company: currentCommander.company, platoon: currentCommander.platoon, squad: currentCommander.squad };
      
    } else {
      // Якщо це вище керівництво (наприклад, Комбат) - бачать усіх
      // Або якщо це звичайний солдат, можна взагалі заборонити доступ до списку
    }

    // 3. Робимо запит до БД із цим фільтром
    const soldiers = await prisma.soldier.findMany({ 
  where: filter,
  include: {
    user: { // Додаємо зв'язок з користувачем
      select: {
        email: true // Беремо тільки email
      }
    }
  },
  orderBy: { name: 'asc' } 
});

    res.json(soldiers);
  } catch (error) { 
    res.status(500).json({ message: 'Помилка отримання списку солдат' }); 
  }
});
// ===================================================
// === МАРШРУТ: ОСОБИСТИЙ ГРАФІК КУРСАНТА
// ===================================================
// ===================================================
// === МАРШРУТ: ОСОБИСТИЙ КАБІНЕТ (З ПІДЛЕГЛИМИ)
// ===================================================
app.get('/api/schedule/my', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id || (req as any).user.userId;

    const soldier = await prisma.soldier.findFirst({ where: { userId: userId } });
    if (!soldier) return res.status(404).json({ message: 'Профіль не знайдено' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Власні наряди користувача
    const mySchedules = await prisma.schedule.findMany({
      where: { soldierId: soldier.id, date: { gte: today } },
      include: { dutyType: true },
      orderBy: { date: 'asc' }
    });

    // 2. ЛОГІКА КОМАНДИРА: Шукаємо підлеглих
    let subordinatesSchedules: any[] = [];
    let isCommander = false;
    let commandLevel = '';

    const pos = soldier.position?.toLowerCase() || '';

    // Якщо це Командир відділення
    if (pos.includes('командир відділення') && soldier.platoon && soldier.squad) {
      isCommander = true;
      commandLevel = 'Відділення';
      const subordinates = await prisma.soldier.findMany({
        where: { platoon: soldier.platoon, squad: soldier.squad, id: { not: soldier.id } }
      });
      const subIds = subordinates.map(s => s.id);
      
      subordinatesSchedules = await prisma.schedule.findMany({
        where: { soldierId: { in: subIds }, date: { gte: today } },
        include: { dutyType: true, soldier: true },
        orderBy: { date: 'asc' }
      });
    } 
    // Якщо це Командир взводу або ЗКВ
    else if ((pos.includes('командир взводу') || pos.includes('заступник командира взводу')) && soldier.platoon) {
      isCommander = true;
      commandLevel = 'Взвод';
      const subordinates = await prisma.soldier.findMany({
        where: { platoon: soldier.platoon, id: { not: soldier.id } }
      });
      const subIds = subordinates.map(s => s.id);

      subordinatesSchedules = await prisma.schedule.findMany({
        where: { soldierId: { in: subIds }, date: { gte: today } },
        include: { dutyType: true, soldier: true },
        orderBy: { date: 'asc' }
      });
    }

    // Відправляємо на фронтенд усе разом
    res.json({ 
      soldier, 
      schedules: mySchedules, 
      isCommander, 
      commandLevel,
      subordinatesSchedules 
    });
  } catch (error) {
    console.error("Помилка кабінету:", error);
    res.status(500).json({ message: 'Помилка отримання даних' });
  }
});


// ===================================================
// === СЕКРЕТНИЙ МАРШРУТ ДЛЯ ІНІЦІАЛІЗАЦІЇ НАРЯДІВ ===
// ===================================================
app.get('/api/duties/init', async (req: Request, res: Response) => {
  try {
    // Групи звань для зручності
    const sergeants = ['Молодший сержант', 'Сержант', 'Старший сержант'];
    const cadets = ['Курсант', 'Солдат', 'Старший солдат'];
    const all = [...sergeants, ...cadets];

    const defaultDuties = [
      { name: 'Черговий курсу', personnelCount: 1, allowedRanks: sergeants },
      { name: 'Днювальний курсу', personnelCount: 2, allowedRanks: cadets },
      { name: 'Черговий КПП', personnelCount: 1, allowedRanks: sergeants },
      { name: 'Помічник чергового КПП', personnelCount: 2, allowedRanks: cadets },
      { name: 'Черговий посту з пропускними функціями', personnelCount: 1, allowedRanks: sergeants },
      { name: 'Помічник чергового посту...', personnelCount: 2, allowedRanks: cadets },
      { name: 'Днювальні парку', personnelCount: 2, allowedRanks: cadets },
      { name: 'Старший черговий підрозділу', personnelCount: 1, allowedRanks: sergeants },
      { name: 'Черговий підрозділ у складі', personnelCount: 7, allowedRanks: all },
      { name: 'Черговий гуртожитку', personnelCount: 1, allowedRanks: all },
      { name: 'Пожежний наряд', personnelCount: 3, allowedRanks: all },
      { name: 'Черговий навч. корпусу №1', personnelCount: 1, allowedRanks: all },
      { name: 'Днювальний навч. корпусу №1', personnelCount: 1, allowedRanks: cadets },
      { name: 'Черговий навч. корпусу №2', personnelCount: 1, allowedRanks: all },
      { name: 'Днювальний навч. корпусу №2', personnelCount: 1, allowedRanks: cadets },
      { name: 'Посильні штабу', personnelCount: 2, allowedRanks: cadets },
    ];

    await prisma.dutyType.deleteMany(); // Очищаємо старі тестові наряди
    
    for (const duty of defaultDuties) {
      await prisma.dutyType.create({ data: duty });
    }

    res.json({ message: 'Всі статутні наряди успішно завантажені!' });
  } catch (error) {
    res.status(500).json({ message: 'Помилка ініціалізації' });
  }
});


// ===================================================
// === НОВИЙ МАРШРУТ: МАСОВИЙ ІМПОРТ ЗІ СТВОРЕННЯМ АКАУНТІВ ===
// ===================================================
app.post('/api/soldiers/bulk', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { text } = req.body; // Отримуємо просто текст з іменами (кожен з нового рядка)
    if (!text) return res.status(400).json({ message: 'Порожній список' });

    // Розбиваємо текст на рядки та прибираємо порожні
    const names = text.split('\n').map((n: string) => n.trim()).filter((n: string) => n.length > 0);
    
    let createdCount = 0;
    const defaultPassword = await bcrypt.hash('viti2026', 12); // Стандартний пароль для всіх

    // Словник для перекладу ПІБ в email
    const translit = (str: string) => {
        const ukr: any = {'а':'a', 'б':'b', 'в':'v', 'г':'h', 'д':'d', 'е':'e', 'є':'ye', 'ж':'zh', 'з':'z', 'и':'y', 'і':'i', 'ї':'yi', 'й':'y', 'к':'k', 'л':'l', 'м':'m', 'н':'n', 'о':'o', 'п':'p', 'р':'r', 'с':'s', 'т':'t', 'у':'u', 'ф':'f', 'х':'kh', 'ц':'ts', 'ч':'ch', 'ш':'sh', 'щ':'shch', 'ь':'', 'ю':'yu', 'я':'ya', ' ':'_', '.':''};
        return str.toLowerCase().split('').map(char => ukr[char] || char).join('');
    };

    for (const name of names) {
        // Генеруємо email: "Іванов І.І." -> "ivanov_i_i@viti.edu.ua"
        const email = `${translit(name)}@viti.edu.ua`;
        
        // Перевіряємо, чи немає вже такого користувача
        const existing = await prisma.user.findUnique({ where: { email } });
        
        if (!existing) {
            // Створюємо і Користувача (для входу), і Солдата (для графіка) одночасно
            await prisma.user.create({
                data: {
                    email,
                    password: defaultPassword,
                    role: 'SOLDIER',
                    soldier: {
                        create: {
                            name: name,
                            rank: 'Курсант',       // Звання за замовчуванням
                            position: 'Студент',
                            phoneNumber: 'Не вказано',
                            status: 'ACTIVE'
                        }
                    }
                }
            });
            createdCount++;
        }
    }

    res.status(201).json({ message: `Успішно створено профілів: ${createdCount} (Пароль: viti2026)` });
  } catch (error) {
    console.error("ПОМИЛКА МАСОВОГО ІМПОРТУ:", error);
    res.status(500).json({ message: 'Помилка на сервері під час імпорту' });
  }
});
app.patch('/api/soldiers/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try { const { id } = req.params; const { status } = req.body; 
  const updated = await prisma.soldier.update({ where: { id: parseInt(id) }, data: { status } }); res.json(updated); } catch (e) { res.status(500).json({ message: 'Помилка' }); }
});
// ОНОВЛЕННЯ ДАНИХ СОЛДАТА
// server/index.ts

app.put('/api/soldiers/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // 1. Обов'язково дістаємо ці два поля з тіла запиту
    const { name, rank, position, phoneNumber, status, platoon, squad } = req.body;

    const updatedSoldier = await prisma.soldier.update({
      where: { id: Number(id) },
      data: {
        name,
        rank,
        position,
        phoneNumber,
        status,
        // 2. Обов'язково записуємо їх у базу
        // Ми додаємо перевірку String(), бо в базі це рядки, а з фронта може прийти число
        platoon: platoon ? String(platoon) : null,
        squad: squad ? String(squad) : null
      }
    });

    res.json(updatedSoldier);
  } catch (error) {
    console.error("Помилка оновлення:", error);
    res.status(500).json({ message: 'Помилка при збереженні в базу' });
  }
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


// ===================================================
// === API для генерації (V8 - Рандом + Ротація з пам'яттю)
// ===================================================
app.post('/api/schedule/generate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { month, year } = req.body; 
    if (!month || !year) return res.status(400).json({ message: 'Будь ласка, вкажіть місяць та рік' });

    // Отримуємо всіх курсантів (тепер тут автоматично є і lastDutyTypeId з бази)
    const activeSoldiers = await prisma.soldier.findMany({ where: { status: 'ACTIVE' } });
    const duties = await prisma.dutyType.findMany(); 
    if (activeSoldiers.length === 0 || duties.length === 0) return res.status(400).json({ message: 'Недостатньо даних' });

    const lastDutyDates: { [id: number]: Date } = {};
    const genStart = new Date(year, month - 1, 1);
    const recent = await prisma.schedule.groupBy({ by: ['soldierId'], _max: { date: true }, where: { date: { lt: genStart } } });
    const defDate = new Date('2000-01-01');
    
    activeSoldiers.forEach((s: any) => { 
      const f = recent.find((r: any) => r.soldierId === s.id); 
      lastDutyDates[s.id] = f?._max.date || defDate; 
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    const newEntries: any[] = []; 

    const shuffle = (array: any[]) => {
      let currentIndex = array.length, randomIndex;
      while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
      }
      return array;
    };

    for (let day = 1; day <= daysInMonth; day++) {
      const current = new Date(year, month - 1, day);
      const shuffledDuties = shuffle([...duties]);
      
      for (const duty of shuffledDuties) {
        const allowed = duty.allowedRanks.map((r: any) => r.toLowerCase());
        
        for (let i = 0; i < duty.personnelCount; i++) {
          let eligible = shuffle([...activeSoldiers]);
          
          if (allowed.length > 0) {
            eligible = eligible.filter((s: any) => allowed.includes(s.rank.toLowerCase()));
          }
          
          // <--- НОВЕ: ТУТ МИ ДОДАЛИ ПЕРЕВІРКУ НА lastDutyTypeId
          eligible = eligible.filter((s: any) => 
            !newEntries.some(e => e.date.getTime() === current.getTime() && e.soldierId === s.id) &&
            s.lastDutyTypeId !== duty.id // Заборона ставити на той самий пост!
          );

          if (eligible.length === 0) continue;

          const fourDaysAgo = new Date(current); 
          fourDaysAgo.setDate(current.getDate() - 3);
          
          const available = eligible.sort((a: any, b: any) => {
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

            // <--- НОВЕ: Оновлюємо "пам'ять" солдата
            // 1. Оновлюємо локально для наступних днів у циклі
            const soldierIndex = activeSoldiers.findIndex((s: any) => s.id === selected.id);
            if (soldierIndex !== -1) {
                activeSoldiers[soldierIndex].lastDutyTypeId = duty.id;
            }
            
            // 2. Зберігаємо назавжди в базу даних
            await prisma.soldier.update({
              where: { id: selected.id },
              data: { lastDutyTypeId: duty.id }
            });
          }
        }
      }
    }
    await prisma.schedule.deleteMany({ where: { date: { gte: genStart, lte: new Date(year, month - 1, daysInMonth) } } });
    await prisma.schedule.createMany({ data: newEntries });
    res.status(201).json({ message: 'Графік згенеровано!' });
  } catch (e: any) { 
    res.status(500).json({ message: 'Помилка генерації', error: e.message }); 
  }
});
// ===================================================
// === РУЧНА ЗАМІНА В КАЛЕНДАРІ (Зміна чергового)
// ===================================================
app.put('/api/schedule/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newSoldierId } = req.body;

    if (!newSoldierId) {
      return res.status(400).json({ message: 'Не вказано нового військовослужбовця' });
    }

    // Оновлюємо запис у базі
    const updatedSchedule = await prisma.schedule.update({
      where: { id: Number(id) },
      data: { soldierId: Number(newSoldierId) }
    });

    res.json({ message: 'Заміну успішно виконано!', schedule: updatedSchedule });
  } catch (error) {
    console.error("Помилка при заміні в графіку:", error);
    res.status(500).json({ message: 'Не вдалося виконати заміну' });
  }
});
// ===================================================
// === НОВИЙ МАРШРУТ: ІМПОРТ З EXCEL / CSV ФАЙЛУ ===
// ===================================================
app.post('/api/soldiers/import-excel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { soldiers } = req.body; // Приймаємо дані з таблиці

    if (!soldiers || !Array.isArray(soldiers) || soldiers.length === 0) {
      return res.status(400).json({ message: 'Файл порожній або має невірний формат' });
    }

    let createdCount = 0;
    const defaultPassword = await bcrypt.hash('viti2026', 12); 

    // Словник транслітерації (той самий)
    const translit = (str: string) => {
        const ukr: any = {'а':'a','б':'b','в':'v','г':'h','д':'d','е':'e','є':'ye','ж':'zh','з':'z','и':'y','і':'i','ї':'yi','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'','ю':'yu','я':'ya',' ':'_','.':''};
        return str.toLowerCase().split('').map(char => ukr[char] || char).join('');
    };

    for (const row of soldiers) {
      // Шукаємо колонки за назвами (як в Excel)
      const name = row['ПІБ'] || row['Name'];
      const rank = row['Звання'] || row['Rank'] || 'Курсант';
      const position = row['Посада'] || row['Position'] || 'Курсант';

      if (!name) continue; // Пропускаємо порожні рядки

      const email = `${translit(name.trim())}@viti.edu.ua`;
      const existing = await prisma.user.findUnique({ where: { email } });

      if (!existing) {
        await prisma.user.create({
            data: {
                email,
                password: defaultPassword,
                role: 'SOLDIER',
                soldier: {
                    create: {
                        name: name.trim(),
                        rank: rank.trim(),
                        position: position.trim(),
                        phoneNumber: 'Не вказано',
                        status: 'ACTIVE'
                    }
                }
            }
        });
        createdCount++;
      }
    }

    res.status(201).json({ message: `Успішно оброблено файл. Створено профілів: ${createdCount}` });
  } catch (error) {
    console.error("ПОМИЛКА EXCEL ІМПОРТУ:", error);
    res.status(500).json({ message: 'Помилка обробки файлу на сервері' });
  }
});
// ===================================================
// === НОВИЙ МАРШРУТ: МАСОВИЙ ІМПОРТ КУРСАНТІВ =======
// ===================================================
app.post('/api/soldiers/bulk', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { soldiers } = req.body; // Очікуємо масив об'єктів [{ name: "Іванов І.І.", rank: "курсант" }, ...]
    
    if (!soldiers || !Array.isArray(soldiers) || soldiers.length === 0) {
      return res.status(400).json({ message: 'Немає даних для імпорту' });
    }

    // Форматуємо дані під нашу базу
    const dataToInsert = soldiers.map((s: any) => ({
      name: s.name,
      rank: s.rank || 'курсант',
      position: 'Не вказано',
      phoneNumber: 'Не вказано',
      status: 'ACTIVE'
    }));

    // createMany дозволяє записати весь масив за один запит у базу
    const created = await prisma.soldier.createMany({
      data: dataToInsert,
      skipDuplicates: true // Якщо раптом будуть дублікати, просто пропускаємо
    });

    res.status(201).json({ message: `Успішно імпортовано ${created.count} осіб!` });
  } catch (error) {
    console.error("ПОМИЛКА ІМПОРТУ:", error);
    res.status(500).json({ message: 'Помилка масового імпорту на сервері' });
  }
});

app.listen(PORT, () => { console.log(`✅ Server is running on http://localhost:${PORT}`); });
// Update for deployment