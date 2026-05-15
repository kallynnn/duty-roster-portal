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

export const MILITARY_POSITIONS = [
  'Курсант',
  'Командир відділення',
  'Заступник командира взводу',
  'Командир взводу',
  'Заступник командира роти',
  'Командир роти',
  // Старшина — окрема роль, бачить всю роту і затверджує заміни
  'Старшина роти',
  'Черговий роти',
  'Черговий підрозділу',
  'Черговий КПП',
  'Черговий по штабу',
  'Черговий по гуртожитку',
  'Пожежний',
];

// Посади які отримують роль STARSHYNA при реєстрації
export const STARSHYNA_POSITIONS = ['Старшина роти'];

// Посади які отримують роль COMMANDER при реєстрації
export const COMMANDER_POSITIONS = [
  'Командир відділення',
  'Заступник командира взводу',
  'Командир взводу',
  'Заступник командира роти',
  'Командир роти',
];

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