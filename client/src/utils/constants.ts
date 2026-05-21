export const MILITARY_RANKS = [
  'Солдат',
  'Старший солдат',
  'Молодший сержант',
  'Сержант',
  'Старший сержант',
  'Лейтенант',
  'Старший лейтенант',
  'Капітан',
  'Майор',
  'Підполковник',
  'Полковник',
];

// Посади відповідають ролям у системі RBAC.
// Використовуються в OnboardingPage після першого входу.
export const MILITARY_POSITIONS = [
  'Курсант',
  'Командир відділення',
  'Командир групи',
  'Старшина курсу',
  'Начальник курсу',
  'Начальник факультету',
] as const;

export type MilitaryPosition = typeof MILITARY_POSITIONS[number];

// Залишаємо для зворотньої сумісності (більше не використовуються в реєстрації)
export const STARSHYNA_POSITIONS: string[] = [];
export const COMMANDER_POSITIONS: string[] = [];

export const SOLDIER_STATUS = {
  ACTIVE: 'ACTIVE',
  LEAVE:  'LEAVE',
  SICK:   'SICK',
} as const;

export type SoldierStatus = typeof SOLDIER_STATUS[keyof typeof SOLDIER_STATUS];

export const SOLDIER_STATUS_LABELS: Record<SoldierStatus, string> = {
  [SOLDIER_STATUS.ACTIVE]: 'В строю',
  [SOLDIER_STATUS.LEAVE]:  'Відпустка',
  [SOLDIER_STATUS.SICK]:   'Хворий',
};