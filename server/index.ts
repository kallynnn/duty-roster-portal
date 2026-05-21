import "dotenv/config";
import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { authMiddleware } from './auth.middleware';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);
const app       = express();
const prisma    = new PrismaClient();
const PORT      = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

const getPythonCmd = (): string => process.platform === 'win32' ? 'python' : 'python3';

// =============================================
// === RBAC — права доступу за ролями ===
// =============================================

// Посади → ролі (використовується тільки на onboarding)
const POSITION_TO_ROLE: Record<string, Role> = {
  'Курсант':              'CADET',
  'Командир відділення':  'SQUAD_COMMANDER',
  'Командир групи':       'GROUP_COMMANDER',
  'Старшина курсу':       'COURSE_SERGEANT',
  'Начальник курсу':      'COURSE_HEAD',
  'Начальник факультету': 'FACULTY_HEAD',
};

// Які ролі потребують секретного коду
const ROLES_REQUIRING_CODE: Role[] = ['COURSE_SERGEANT', 'COURSE_HEAD', 'FACULTY_HEAD'];

// Invite codes зберігаються в .env
const INVITE_CODES: Record<string, string> = {
  COURSE_SERGEANT: process.env.INVITE_CODE_COURSE_SERGEANT || '',
  COURSE_HEAD:     process.env.INVITE_CODE_COURSE_HEAD     || '',
  FACULTY_HEAD:    process.env.INVITE_CODE_FACULTY_HEAD    || '',
};

// Перевірки прав
const canApproveSwaps     = (role: string) => ['COURSE_SERGEANT', 'COURSE_HEAD', 'FACULTY_HEAD', 'ADMIN'].includes(role);
const canGenerateSchedule = (role: string) => ['COURSE_SERGEANT', 'ADMIN'].includes(role);
const canManualSwap       = (role: string) => ['COURSE_SERGEANT', 'ADMIN'].includes(role);
const canViewDashboard    = (role: string) => ['SQUAD_COMMANDER', 'GROUP_COMMANDER', 'COURSE_SERGEANT', 'COURSE_HEAD', 'FACULTY_HEAD', 'ADMIN'].includes(role);

const DUTY_POINT_MAP: Record<string, { point: string; section: 'duties' | 'fire' | 'day'; is_senior?: boolean }> = {
  'Черговий курсу':                         { point: '1.1',  section: 'duties' },
  'Днювальний курсу':                       { point: '1.2',  section: 'duties' },
  'Черговий КПП':                           { point: '1.4',  section: 'duties' },
  'Помічник чергового КПП':                 { point: '1.5',  section: 'duties' },
  'Черговий посту з пропускними функціями': { point: '1.6',  section: 'duties' },
  'Помічник чергового посту...':            { point: '1.7',  section: 'duties' },
  'Старший черговий підрозділу':            { point: '1.8',  section: 'duties' },
  'Днювальні парку':                        { point: '1.9',  section: 'duties' },
  'Черговий підрозділ у складі':            { point: '1.15', section: 'duties', is_senior: true },
  'Черговий гуртожитку':                    { point: '1.16', section: 'duties' },
  'Пожежний наряд':                         { point: '2.2',  section: 'fire'   },
  'Черговий навч. корпусу №1':              { point: '3.1',  section: 'day'    },
  'Днювальний навч. корпусу №1':            { point: '3.2',  section: 'day'    },
  'Черговий навч. корпусу №2':              { point: '3.3',  section: 'day'    },
  'Днювальний навч. корпусу №2':            { point: '3.4',  section: 'day'    },
  'Посильні штабу':                         { point: '3.5',  section: 'day'    },
};

// ===================================================
// === ПУБЛІЧНІ API ===
// ===================================================

app.get('/api/statistics/summary', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const s = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const e7   = new Date(s); e7.setDate(s.getDate() + 7);
    const e30  = new Date(s); e30.setDate(s.getDate() + 30);
    const e365 = new Date(s); e365.setDate(s.getDate() + 365);
    const thisWeekCount  = await prisma.schedule.count({ where: { date: { gte: s, lt: e7   } } });
    const thisMonthCount = await prisma.schedule.count({ where: { date: { gte: s, lt: e30  } } });
    const thisYearCount  = await prisma.schedule.count({ where: { date: { gte: s, lt: e365 } } });
    const allMonthDuties = await prisma.schedule.findMany({ where: { date: { gte: s, lt: e30 } }, include: { soldier: { select: { name: true } } } });
    const counts: { [name: string]: number } = {};
    allMonthDuties.forEach(d => { if (d.soldier) counts[d.soldier.name] = (counts[d.soldier.name] || 0) + 1; });
    const leaderboard = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count }));
    res.json({ thisWeekCount, thisMonthCount, thisYearCount, leaderboard });
  } catch { res.status(500).json({ message: 'Помилка отримання статистики' }); }
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
    const { email, password, name, rank, phoneNumber } = req.body;
    if (await prisma.user.findUnique({ where: { email } }))
      return res.status(400).json({ message: 'Користувач з таким email вже існує' });
    const hashedPassword = await bcrypt.hash(password, 12);
    // Всі нові юзери — CADET + isFirstLogin=true; роль видається після onboarding
    await prisma.user.create({
      data: {
        email, password: hashedPassword, role: 'CADET', isFirstLogin: true,
        soldier: { create: { name, rank: rank || 'Курсант', position: 'Курсант', phoneNumber: phoneNumber || 'Не вказано', status: 'ACTIVE' } }
      },
      include: { soldier: true }
    });
    res.status(201).json({ message: 'Користувач успішно створений' });
  } catch (error) { console.error("ПОМИЛКА РЕЄСТРАЦІЇ:", error); res.status(500).json({ message: 'Щось пішло не так на сервері...' }); }
});

app.post('/api/auth/login', [
  body('email', 'Введіть коректний email').normalizeEmail().isEmail(),
  body('password', 'Введіть пароль').exists(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array(), message: 'Помилка валідації' });
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !await bcrypt.compare(password, user.password))
      return res.status(400).json({ message: 'Невірний email або пароль' });
    const token = jwt.sign({ userId: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET as string, { expiresIn: '8h' });
    res.json({ token, userId: user.id, role: user.role, isFirstLogin: user.isFirstLogin });
  } catch { res.status(500).json({ message: 'Щось пішло не так...' }); }
});

app.get('/api/auth/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, include: { soldier: true } });
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });
    res.json({ id: user.id, email: user.email, role: user.role, isFirstLogin: user.isFirstLogin, soldier: user.soldier });
  } catch { res.status(500).json({ message: 'Помилка отримання даних профілю' }); }
});

// Оновлення власного профілю (пошта, телефон, дата народження)
app.patch('/api/profile/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!;
    const { email, phoneNumber, birthDate } = req.body;

    // Оновлюємо email якщо передано
    if (email) {
      const trimmed = email.trim().toLowerCase();
      const existing = await prisma.user.findFirst({ where: { email: trimmed, NOT: { id: userId } } });
      if (existing) return res.status(400).json({ message: 'Цей email вже використовується' });
      await prisma.user.update({ where: { id: userId }, data: { email: trimmed } });
    }

    // Оновлюємо дані солдата якщо передано
    const soldierData: Record<string, unknown> = {};
    if (phoneNumber !== undefined) soldierData.phoneNumber = phoneNumber.trim() || 'Не вказано';
    if (birthDate   !== undefined) soldierData.birthDate   = birthDate ? new Date(birthDate) : null;

    if (Object.keys(soldierData).length > 0) {
      await prisma.soldier.updateMany({ where: { userId }, data: soldierData });
    }

    // Повертаємо оновлені дані
    const updated = await prisma.user.findUnique({
      where: { id: userId },
      include: { soldier: true },
    });
    res.json({ message: 'Профіль оновлено', user: updated });
  } catch (error) {
    console.error('ПОМИЛКА ОНОВЛЕННЯ ПРОФІЛЮ:', error);
    res.status(500).json({ message: 'Помилка збереження профілю' });
  }
});

// ===================================================
// === ONBOARDING ===
// ===================================================

app.post('/api/auth/onboarding', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!;
    const { position, inviteCode } = req.body;

    if (!position || !POSITION_TO_ROLE[position]) {
      return res.status(400).json({ message: 'Оберіть коректну посаду' });
    }

    const targetRole: Role = POSITION_TO_ROLE[position];

    // Якщо роль потребує коду — перевіряємо
    if (ROLES_REQUIRING_CODE.includes(targetRole)) {
      const expectedCode = INVITE_CODES[targetRole];
      if (!inviteCode || inviteCode.trim() !== expectedCode) {
        return res.status(403).json({ message: 'Невірний секретний код доступу' });
      }
    }

    // Оновлюємо user: роль + isFirstLogin = false
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: targetRole, isFirstLogin: false },
    });

    // Оновлюємо position в Soldier
    await prisma.soldier.updateMany({
      where: { userId },
      data: { position },
    });

    // Повертаємо новий токен з оновленою роллю
    const newToken = jwt.sign(
      { userId: updatedUser.id, role: updatedUser.role, email: updatedUser.email },
      process.env.JWT_SECRET as string,
      { expiresIn: '8h' }
    );

    res.json({ message: 'Профіль налаштовано', token: newToken, role: updatedUser.role, isFirstLogin: false });
  } catch (error) {
    console.error('ПОМИЛКА ONBOARDING:', error);
    res.status(500).json({ message: 'Помилка при налаштуванні профілю' });
  }
});

// ===================================================
// === СОЛДАТИ ===
// ===================================================

app.get('/api/soldiers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, role } = req.user!;
    const commander = await prisma.soldier.findUnique({ where: { userId } });
    if (!commander) return res.status(404).json({ message: 'Профіль не знайдено' });

    let filter: Record<string, unknown> = {};
    if (role === 'ADMIN' || role === 'FACULTY_HEAD') {
      filter = {}; // бачить всіх
    } else if (role === 'COURSE_SERGEANT' || role === 'COURSE_HEAD') {
      filter = { company: commander.company }; // весь курс
    } else if (role === 'GROUP_COMMANDER') {
      filter = { company: commander.company, platoon: commander.platoon }; // своя група
    } else if (role === 'SQUAD_COMMANDER') {
      filter = { company: commander.company, platoon: commander.platoon, squad: commander.squad }; // своє відділення
    }

    res.json(await prisma.soldier.findMany({ where: filter, include: { user: { select: { email: true } } }, orderBy: { name: 'asc' } }));
  } catch { res.status(500).json({ message: 'Помилка отримання списку солдат' }); }
});

// Список активних солдатів для вибору замінника
app.get('/api/soldiers/all-active', authMiddleware, async (req: Request, res: Response) => {
  try {
    res.json(await prisma.soldier.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true, rank: true, position: true }, orderBy: { name: 'asc' } }));
  } catch { res.status(500).json({ message: 'Помилка' }); }
});

app.get('/api/schedule/my', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, role } = req.user!;
    const soldier = await prisma.soldier.findFirst({ where: { userId } });
    if (!soldier) return res.status(404).json({ message: 'Профіль не знайдено' });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const mySchedules = await prisma.schedule.findMany({
      where: { soldierId: soldier.id, date: { gte: today } },
      include: { dutyType: true }, orderBy: { date: 'asc' }
    });

    let subordinatesSchedules: object[] = [];
    let isCommander = false;
    let commandLevel = '';
    const pos = soldier.position?.toLowerCase() || '';

    if (role === 'FACULTY_HEAD' || role === 'ADMIN') {
      isCommander = true; commandLevel = 'Факультет';
      const subs = await prisma.soldier.findMany({ where: { id: { not: soldier.id } } });
      subordinatesSchedules = await prisma.schedule.findMany({
        where: { soldierId: { in: subs.map(s => s.id) }, date: { gte: today } },
        include: { dutyType: true, soldier: true }, orderBy: { date: 'asc' }
      });
    } else if (role === 'COURSE_HEAD' || role === 'COURSE_SERGEANT') {
      isCommander = true; commandLevel = 'Курс';
      const subs = await prisma.soldier.findMany({ where: { company: soldier.company, id: { not: soldier.id } } });
      subordinatesSchedules = await prisma.schedule.findMany({
        where: { soldierId: { in: subs.map(s => s.id) }, date: { gte: today } },
        include: { dutyType: true, soldier: true }, orderBy: { date: 'asc' }
      });
    } else if (role === 'GROUP_COMMANDER') {
      isCommander = true; commandLevel = 'Група';
      const subs = await prisma.soldier.findMany({ where: { company: soldier.company, platoon: soldier.platoon, id: { not: soldier.id } } });
      subordinatesSchedules = await prisma.schedule.findMany({
        where: { soldierId: { in: subs.map(s => s.id) }, date: { gte: today } },
        include: { dutyType: true, soldier: true }, orderBy: { date: 'asc' }
      });
    } else if (role === 'SQUAD_COMMANDER') {
      isCommander = true; commandLevel = 'Відділення';
      const subs = await prisma.soldier.findMany({ where: { company: soldier.company, platoon: soldier.platoon, squad: soldier.squad, id: { not: soldier.id } } });
      subordinatesSchedules = await prisma.schedule.findMany({
        where: { soldierId: { in: subs.map(s => s.id) }, date: { gte: today } },
        include: { dutyType: true, soldier: true }, orderBy: { date: 'asc' }
      });
    }

    res.json({ soldier, schedules: mySchedules, isCommander, commandLevel, subordinatesSchedules });
  } catch (error) { console.error("Помилка кабінету:", error); res.status(500).json({ message: 'Помилка отримання даних' }); }
});

app.get('/api/duties/init', authMiddleware, async (req: Request, res: Response) => {
  try {
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
    await prisma.dutyType.deleteMany();
    for (const duty of defaultDuties) await prisma.dutyType.create({ data: duty });
    res.json({ message: 'Всі статутні наряди успішно завантажені!' });
  } catch { res.status(500).json({ message: 'Помилка ініціалізації' }); }
});

// Транслітерація прізвища для email: тільки перше слово імені, спрощена схема
const translitSurname = (fullName: string): string => {
  const surname = fullName.trim().split(' ')[0];
  const map: Record<string, string> = {
    'а':'a','б':'b','в':'v','г':'h','д':'d','е':'e','є':'e',
    'ж':'zh','з':'z','и':'y','і':'i','ї':'i','й':'y',
    'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p',
    'р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh',
    'ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'','ю':'yu','я':'ya',
    "'": '', '’': '',
  };
  return surname.toLowerCase().split('').map(c => map[c] !== undefined ? map[c] : c).join('');
};

app.post('/api/soldiers/bulk', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { text, platoon, company, squad } = req.body;
    if (!text)    return res.status(400).json({ message: 'Порожній список' });
    if (!platoon) return res.status(400).json({ message: 'Вкажіть номер взводу (наприклад: 221)' });

    const names: string[] = text.split('\n').map((n: string) => n.trim()).filter((n: string) => n.length > 0);
    let createdCount = 0;
    const skipped: string[] = [];
    const defaultPassword = await bcrypt.hash('viti2026', 12);

    // Відстежуємо дублікати прізвищ у цьому імпорті
    const surnameCount: Record<string, number> = {};

    for (const name of names) {
      const base = translitSurname(name);
      surnameCount[base] = (surnameCount[base] || 0) + 1;
      const suffix = surnameCount[base] > 1 ? String(surnameCount[base]) : '';
      const email = `${base}${platoon}${suffix}@viti.edu.ua`;

      if (await prisma.user.findUnique({ where: { email } })) {
        skipped.push(name); continue;
      }
      await prisma.user.create({
        data: {
          email, password: defaultPassword, role: 'CADET', isFirstLogin: false,
          soldier: { create: {
            name, rank: 'Курсант', position: 'Курсант', phoneNumber: 'Не вказано', status: 'ACTIVE',
            platoon: String(platoon),
            company: company ? String(company) : null,
            squad:   squad   ? String(squad)   : null,
          }},
        },
      });
      createdCount++;
    }

    const msg = `Створено: ${createdCount}. Пароль: viti2026.${skipped.length ? ` Пропущено (вже існують): ${skipped.join(', ')}` : ''}`;
    res.status(201).json({ message: msg, created: createdCount, skipped });
  } catch (error) { console.error("ПОМИЛКА МАСОВОГО ІМПОРТУ:", error); res.status(500).json({ message: 'Помилка на сервері під час імпорту' }); }
});

// Додавання одного військовослужбовця
app.post('/api/soldiers', authMiddleware, [
  body('name', 'Введіть ПІБ').notEmpty(),
  body('rank', 'Введіть звання').notEmpty(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    const { name, rank, position, phoneNumber, status, platoon, squad } = req.body;
    const soldier = await prisma.soldier.create({
      data: {
        name,
        rank,
        position: position || 'Курсант',
        phoneNumber: phoneNumber || 'Не вказано',
        status: status || 'ACTIVE',
        platoon: platoon || null,
        squad: squad || null,
      }
    });
    res.status(201).json(soldier);
  } catch (error) {
    console.error('Помилка додавання солдата:', error);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

app.patch('/api/soldiers/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try { res.json(await prisma.soldier.update({ where: { id: parseInt(req.params.id) }, data: { status: req.body.status } })); }
  catch { res.status(500).json({ message: 'Помилка' }); }
});

app.put('/api/soldiers/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, rank, position, phoneNumber, status, platoon, squad } = req.body;
    res.json(await prisma.soldier.update({ where: { id: Number(req.params.id) }, data: { name, rank, position, phoneNumber, status, platoon: platoon ? String(platoon) : null, squad: squad ? String(squad) : null } }));
  } catch (error) { console.error("Помилка оновлення:", error); res.status(500).json({ message: 'Помилка при збереженні в базу' }); }
});

app.delete('/api/soldiers/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const soldierId = parseInt(req.params.id);
    await prisma.schedule.deleteMany({ where: { soldierId } });
    await prisma.soldier.delete({ where: { id: soldierId } });
    res.json({ message: 'Видалено' });
  } catch { res.status(500).json({ message: 'Помилка видалення' }); }
});

// ===================================================
// === ВИДИ НАРЯДІВ ===
// ===================================================

app.get('/api/duty-types', authMiddleware, async (req: Request, res: Response) => {
  try { res.json(await prisma.dutyType.findMany({ orderBy: { name: 'asc' } })); }
  catch { res.status(500).json({ message: 'Помилка' }); }
});

app.post('/api/duty-types', authMiddleware, [body('name').notEmpty()], async (req: Request, res: Response) => {
  try { res.status(201).json(await prisma.dutyType.create({ data: { name: req.body.name, description: req.body.description, allowedRanks: req.body.allowedRanks || [] } })); }
  catch { res.status(500).json({ message: 'Помилка' }); }
});

app.put('/api/duty-types/:id', authMiddleware, async (req: Request, res: Response) => {
  try { res.json(await prisma.dutyType.update({ where: { id: parseInt(req.params.id) }, data: { name: req.body.name, description: req.body.description, allowedRanks: req.body.allowedRanks } })); }
  catch { res.status(500).json({ message: 'Помилка' }); }
});

app.delete('/api/duty-types/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const dutyTypeId = parseInt(req.params.id);
    await prisma.schedule.deleteMany({ where: { dutyTypeId } });
    await prisma.dutyType.delete({ where: { id: dutyTypeId } });
    res.json({ message: 'Видалено' });
  } catch { res.status(500).json({ message: 'Помилка' }); }
});

// ===================================================
// === ГРАФІК ===
// ===================================================

app.get('/api/schedule', authMiddleware, async (req: Request, res: Response) => {
  try { res.json(await prisma.schedule.findMany({ include: { soldier: true, dutyType: true }, orderBy: { date: 'asc' } })); }
  catch { res.status(500).json({ message: 'Помилка' }); }
});

app.get('/api/statistics/my-summary', authMiddleware, async (req: Request, res: Response) => {
  try {
    const soldier = await prisma.soldier.findUnique({ where: { userId: req.user!.userId } });
    if (!soldier) return res.status(404).json({ message: 'Солдата не знайдено' });
    const today = new Date(); const s = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const e7   = new Date(s); e7.setDate(s.getDate() + 7);
    const e30  = new Date(s); e30.setDate(s.getDate() + 30);
    const e365 = new Date(s); e365.setDate(s.getDate() + 365);
    res.json({
      thisWeekCount:  await prisma.schedule.count({ where: { soldierId: soldier.id, date: { gte: s, lt: e7   } } }),
      thisMonthCount: await prisma.schedule.count({ where: { soldierId: soldier.id, date: { gte: s, lt: e30  } } }),
      thisYearCount:  await prisma.schedule.count({ where: { soldierId: soldier.id, date: { gte: s, lt: e365 } } }),
    });
  } catch { res.status(500).json({ message: 'Помилка' }); }
});

app.get('/api/schedule/duty-map', authMiddleware, async (req: Request, res: Response) => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const parts   = dateStr.split('-').map(Number);
    const dayStart = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    const dayEnd   = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
    const items = await prisma.schedule.findMany({
      where: { date: { gte: dayStart, lte: dayEnd } },
      include: {
        soldier: { select: { id: true, name: true, rank: true, platoon: true, squad: true, company: true, status: true } },
        dutyType: { select: { name: true } },
      },
      orderBy: [{ soldier: { platoon: 'asc' } }, { soldier: { name: 'asc' } }],
    });
    res.json(items);
  } catch { res.status(500).json({ message: 'Помилка' }); }
});

app.get('/api/schedule/my-schedule', authMiddleware, async (req: Request, res: Response) => {
  try {
    const soldier = await prisma.soldier.findUnique({ where: { userId: req.user!.userId } });
    if (!soldier) return res.status(404).json({ message: 'Солдата не знайдено' });
    res.json(await prisma.schedule.findMany({
      where: { soldierId: soldier.id },
      include: { soldier: true, dutyType: true },
      orderBy: { date: 'asc' }
    }));
  } catch { res.status(500).json({ message: 'Помилка' }); }
});

app.post('/api/schedule/generate', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!canGenerateSchedule(req.user!.role)) return res.status(403).json({ message: 'Недостатньо прав для генерації графіку' });
    const { month, year } = req.body;
    if (!month || !year) return res.status(400).json({ message: 'Будь ласка, вкажіть місяць та рік' });
    const activeSoldiers = await prisma.soldier.findMany({ where: { status: 'ACTIVE' } });
    const duties = await prisma.dutyType.findMany();
    if (activeSoldiers.length === 0 || duties.length === 0) return res.status(400).json({ message: 'Недостатньо даних' });
    const genStart = new Date(year, month - 1, 1);
    const recent = await prisma.schedule.groupBy({ by: ['soldierId'], _max: { date: true }, where: { date: { lt: genStart } } });
    const defDate = new Date('2000-01-01');
    const lastDutyDates: { [id: number]: Date } = {};
    activeSoldiers.forEach(s => { const f = recent.find(r => r.soldierId === s.id); lastDutyDates[s.id] = f?._max.date || defDate; });
    const daysInMonth = new Date(year, month, 0).getDate();
    const newEntries: { date: Date; soldierId: number; dutyTypeId: number }[] = [];
    const shuffle = <T>(arr: T[]): T[] => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const localLast: { [id: number]: number | null } = {};
    activeSoldiers.forEach(s => { localLast[s.id] = s.lastDutyTypeId ?? null; });
    const finalLast = new Map<number, number>();
    for (let day = 1; day <= daysInMonth; day++) {
      const current = new Date(year, month - 1, day);
      for (const duty of shuffle(duties)) {
        const allowed = duty.allowedRanks.map(r => r.toLowerCase());
        for (let i = 0; i < duty.personnelCount; i++) {
          let eligible = shuffle(activeSoldiers);
          if (allowed.length > 0) eligible = eligible.filter(s => allowed.includes(s.rank.toLowerCase()));
          eligible = eligible.filter(s => !newEntries.some(e => e.date.getTime() === current.getTime() && e.soldierId === s.id) && localLast[s.id] !== duty.id);
          if (eligible.length === 0) continue;
          const fourAgo = new Date(current); fourAgo.setDate(current.getDate() - 3);
          const available = eligible.sort((a, b) => { const aR = lastDutyDates[a.id] < fourAgo, bR = lastDutyDates[b.id] < fourAgo; if (aR && !bR) return -1; if (!aR && bR) return 1; return lastDutyDates[a.id].getTime() - lastDutyDates[b.id].getTime(); });
          const sel = available[0];
          if (sel) { newEntries.push({ date: current, soldierId: sel.id, dutyTypeId: duty.id }); lastDutyDates[sel.id] = current; localLast[sel.id] = duty.id; finalLast.set(sel.id, duty.id); }
        }
      }
    }
    await prisma.schedule.deleteMany({ where: { date: { gte: genStart, lte: new Date(year, month - 1, daysInMonth) } } });
    await prisma.schedule.createMany({ data: newEntries });
    await Promise.all(Array.from(finalLast.entries()).map(([id, lastDutyTypeId]) => prisma.soldier.update({ where: { id }, data: { lastDutyTypeId } })));
    res.status(201).json({ message: 'Графік згенеровано!' });
  } catch (e: unknown) { res.status(500).json({ message: 'Помилка генерації', error: e instanceof Error ? e.message : 'Невідома помилка' }); }
});

app.put('/api/schedule/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!canManualSwap(req.user!.role)) return res.status(403).json({ message: 'Недостатньо прав для ручної заміни' });
    const { newSoldierId } = req.body;
    if (!newSoldierId) return res.status(400).json({ message: 'Не вказано нового військовослужбовця' });
    res.json({ message: 'Заміну успішно виконано!', schedule: await prisma.schedule.update({ where: { id: Number(req.params.id) }, data: { soldierId: Number(newSoldierId) } }) });
  } catch (error) { console.error("Помилка при заміні:", error); res.status(500).json({ message: 'Не вдалося виконати заміну' }); }
});

app.post('/api/soldiers/import-excel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { soldiers } = req.body;
    if (!soldiers || !Array.isArray(soldiers) || soldiers.length === 0) return res.status(400).json({ message: 'Файл порожній або має невірний формат' });
    let createdCount = 0;
    const defaultPassword = await bcrypt.hash('viti2026', 12);
    const translit = (str: string) => { const ukr: Record<string, string> = { 'а':'a','б':'b','в':'v','г':'h','д':'d','е':'e','є':'ye','ж':'zh','з':'z','и':'y','і':'i','ї':'yi','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'','ю':'yu','я':'ya',' ':'_','.':'' }; return str.toLowerCase().split('').map(c => ukr[c] || c).join(''); };
    for (const row of soldiers) {
      const name = row['ПІБ'] || row['Name']; if (!name) continue;
      const email = `${translit(name.trim())}@viti.edu.ua`;
      if (!await prisma.user.findUnique({ where: { email } })) {
        await prisma.user.create({ data: { email, password: defaultPassword, role: 'CADET', isFirstLogin: false, soldier: { create: { name: name.trim(), rank: (row['Звання']||row['Rank']||'Курсант').trim(), position: (row['Посада']||row['Position']||'Курсант').trim(), phoneNumber: 'Не вказано', status: 'ACTIVE' } } } });
        createdCount++;
      }
    }
    res.status(201).json({ message: `Успішно оброблено файл. Створено профілів: ${createdCount}` });
  } catch (error) { console.error("ПОМИЛКА EXCEL ІМПОРТУ:", error); res.status(500).json({ message: 'Помилка обробки файлу на сервері' }); }
});

// ===================================================
// === ЗАПИТИ НА ЗАМІНУ (SwapRequest) ===
// ===================================================

app.post('/api/swap-requests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { scheduleId, targetSoldierId } = req.body;
    if (!scheduleId || !targetSoldierId) return res.status(400).json({ message: 'Вкажіть наряд і замінника' });
    const requester = await prisma.soldier.findUnique({ where: { userId: req.user!.userId } });
    if (!requester) return res.status(404).json({ message: 'Ваш профіль не знайдено' });
    const schedule = await prisma.schedule.findUnique({ where: { id: Number(scheduleId) } });
    if (!schedule) return res.status(404).json({ message: 'Наряд не знайдено' });
    if (schedule.soldierId !== requester.id) return res.status(403).json({ message: 'Цей наряд не ваш' });
    const existing = await prisma.swapRequest.findFirst({ where: { scheduleId: Number(scheduleId), status: 'PENDING' } });
    if (existing) return res.status(400).json({ message: 'Запит на цей наряд вже надіслано' });
    const swapRequest = await prisma.swapRequest.create({
      data: { scheduleId: Number(scheduleId), requesterId: requester.id, targetSoldierId: Number(targetSoldierId), status: 'PENDING' },
      include: { schedule: { include: { dutyType: true } }, requester: { select: { name: true, rank: true } }, targetSoldier: { select: { name: true, rank: true } } }
    });
    res.status(201).json({ message: 'Запит на заміну надіслано', swapRequest });
  } catch (error) { console.error('ПОМИЛКА SWAP REQUEST:', error); res.status(500).json({ message: 'Помилка надсилання запиту' }); }
});

app.get('/api/swap-requests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, role } = req.user!;
    const soldier = await prisma.soldier.findUnique({ where: { userId } });
    if (!soldier) return res.status(404).json({ message: 'Профіль не знайдено' });
    // Командир, Адмін і Старшина бачать всі PENDING запити
    const where = canApproveSwaps(role)
      ? { status: 'PENDING' }
      : { OR: [{ requesterId: soldier.id }, { targetSoldierId: soldier.id }] };
    const requests = await prisma.swapRequest.findMany({
      where,
      include: { schedule: { include: { dutyType: true } }, requester: { select: { name: true, rank: true } }, targetSoldier: { select: { name: true, rank: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (error) { console.error('ПОМИЛКА GET SWAP REQUESTS:', error); res.status(500).json({ message: 'Помилка отримання запитів' }); }
});

app.patch('/api/swap-requests/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { role } = req.user!;
    if (!canApproveSwaps(role)) return res.status(403).json({ message: 'Недостатньо прав для затвердження замін' });
    const { action } = req.body;
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ message: 'Вкажіть дію: approve або reject' });
    const swapRequest = await prisma.swapRequest.findUnique({ where: { id: Number(req.params.id) }, include: { schedule: true } });
    if (!swapRequest) return res.status(404).json({ message: 'Запит не знайдено' });
    if (swapRequest.status !== 'PENDING') return res.status(400).json({ message: 'Запит вже оброблено' });
    if (action === 'approve') {
      await prisma.schedule.update({ where: { id: swapRequest.scheduleId }, data: { soldierId: swapRequest.targetSoldierId } });
      await prisma.swapRequest.update({ where: { id: Number(req.params.id) }, data: { status: 'APPROVED' } });
      res.json({ message: 'Заміну схвалено. Графік оновлено.' });
    } else {
      await prisma.swapRequest.update({ where: { id: Number(req.params.id) }, data: { status: 'REJECTED' } });
      res.json({ message: 'Запит відхилено.' });
    }
  } catch (error) { console.error('ПОМИЛКА PATCH SWAP REQUEST:', error); res.status(500).json({ message: 'Помилка обробки запиту' }); }
});

// ===================================================
// === PDF ГЕНЕРАЦІЯ НАКАЗУ ===
// ===================================================

app.post('/api/schedule/export-pdf', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ message: 'Вкажіть дату' });
    const dateStr = date.toString().split('T')[0];
    const scheduleItems = await prisma.schedule.findMany({
      where: { date: { gte: new Date(`${dateStr}T00:00:00.000Z`), lte: new Date(`${dateStr}T23:59:59.999Z`) } },
      include: { soldier: { select: { name: true, rank: true, platoon: true } }, dutyType: { select: { name: true } } },
      orderBy: { dutyTypeId: 'asc' }
    });
    if (scheduleItems.length === 0) return res.status(404).json({ message: `На дату ${dateStr} нарядів не знайдено` });
    const commander = await prisma.soldier.findUnique({ where: { userId: req.user!.userId } });
    const dutyGroups: Record<string, any[]> = {};
    scheduleItems.forEach(item => { if (!dutyGroups[item.dutyType.name]) dutyGroups[item.dutyType.name] = []; dutyGroups[item.dutyType.name].push({ name: item.soldier.name, rank: item.soldier.rank, group: item.soldier.platoon || '221' }); });
    const duties: any[] = [], fireDuties: any[] = [], dayDuties: any[] = [];
    Object.entries(dutyGroups).forEach(([typeName, soldiers]) => {
      const mapping = DUTY_POINT_MAP[typeName];
      const entry = { duty_type: typeName, point: mapping?.point || '1.0', is_senior: mapping?.is_senior || false, soldiers };
      if (mapping?.section === 'fire') fireDuties.push(entry); else if (mapping?.section === 'day') dayDuties.push(entry); else duties.push(entry);
    });
    const sp = (a: any, b: any) => parseFloat(a.point) - parseFloat(b.point);
    duties.sort(sp); fireDuties.sort(sp); dayDuties.sort(sp);
    const pdfData = { date: dateStr, commander_rank: commander?.rank || 'Полковник', commander_name: commander?.name || '', institute_name: 'Військового інституту телекомунікацій та інформатизації імені Героїв Крут', duties, fire_duties: fireDuties, day_duties: dayDuties };
    const tmpDir = os.tmpdir(), ts = Date.now();
    const jsonFile = path.join(tmpDir, `order_data_${ts}.json`);
    const outputFile = path.join(tmpDir, `order_${dateStr.replace(/-/g, '')}_${ts}.pdf`);
    const scriptPath = path.resolve(__dirname, 'generate_order.py');
    if (!fs.existsSync(scriptPath)) return res.status(500).json({ message: `Скрипт не знайдено: ${scriptPath}` });
    fs.writeFileSync(jsonFile, JSON.stringify(pdfData, null, 2), 'utf-8');
    const pythonCmd = getPythonCmd();
    try { await execAsync(`"${pythonCmd}" "${scriptPath}" "${jsonFile}" "${outputFile}"`); }
    catch (pyError: any) { if (process.platform === 'win32') { try { await execAsync(`py "${scriptPath}" "${jsonFile}" "${outputFile}"`); } catch { throw pyError; } } else throw pyError; }
    finally { if (fs.existsSync(jsonFile)) fs.unlinkSync(jsonFile); }
    if (!fs.existsSync(outputFile)) return res.status(500).json({ message: 'PDF файл не було створено' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Nakaz_${dateStr.split('-').reverse().join('_')}.pdf"`);
    const fileStream = fs.createReadStream(outputFile);
    fileStream.pipe(res);
    fileStream.on('end', () => { if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile); });
    fileStream.on('error', () => { if (!res.headersSent) res.status(500).json({ message: 'Помилка читання PDF' }); });
  } catch (error: any) { console.error('ПОМИЛКА PDF ГЕНЕРАЦІЇ:', error); if (!res.headersSent) res.status(500).json({ message: 'Не вдалося згенерувати PDF', error: error.message }); }
});

app.listen(PORT, () => { console.log(`✅ Server is running on http://localhost:${PORT}`); });