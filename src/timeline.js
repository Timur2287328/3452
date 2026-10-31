// Единая партитура мультика: реплики, события и кривые, общие для физики, 3D, субтитров и звука.
// Время «сцены» (tm) — секунды внутри истории, 3…75. Хук 0–3 с проигрывает сцену по своей карте (hookMap).

export const FPS = 24;
export const DURATION = 75;

export const clamp01 = k => Math.min(1, Math.max(0, k));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = k => { k = clamp01(k); return k * k * (3 - 2 * k); };
export const span = (t, a, b) => clamp01((t - a) / (b - a));

// [кто, начало, конец, текст]
export const DIALOG = [
  ['ty', 6.5, 8.6, 'Придумай идею для 3D-мультика. Чтоб там был наш диалог.'],
  ['claude', 8.95, 9.5, 'Пришли фото.'],
  ['ty', 9.6, 10.2, 'Сейчас пришлю.'],
  ['ty', 10.4, 11.5, 'Вот, изучи это видео.'],
  ['claude', 12.7, 14.1, 'Изучил. Можно так же.'],
  ['ty', 14.3, 15.4, 'Более оригинально.'],
  ['claude', 18.8, 20.0, 'Вот три варианта.'],
  ['ty', 20.6, 21.2, 'Один.'],
  ['ty', 22.6, 24.0, 'И добавь резиновую уточку.'],
  ['claude', 24.1, 24.7, 'Зачем?'],
  ['ty', 24.8, 25.6, 'Для души.'],
  ...Array.from({ length: 8 }, (_, i) => ['ty', 26.8 + i * 0.55, 27.2 + i * 0.55, 'ок']),
  ['claude', 32.6, 34.2, 'Можно я что-нибудь выброшу?'],
  ['ty', 34.25, 35.3, 'Ничего! Всё важное!'],
  ['claude', 35.5, 36.8, 'Даже «ок» номер тридцать семь?'],
  ['ty', 37.6, 38.3, '…Особенно его.'],
  ['claude', 38.6, 39.1, 'Ой.'],
  ['ty', 39.3, 40.4, 'Подожди, я ещё не…'],
  ['claude', 44.4, 45.6, 'Привет! Чем могу помочь?'],
  ['ty', 45.8, 48.4, 'Мы. Весь вечер. Придумывали мультик.'],
  ['claude', 49.7, 52.2, 'Тут написано: «Хочет мультик. Фото: обещано».'],
  ['ty', 52.4, 54.4, 'А лампочки? Три двери? Уточка?'],
  ['claude', 54.6, 56.8, '…Не влезло.'],
  ['claude', 65.6, 67.0, 'А. Точно. Для души.'],
  ['claude', 69.6, 71.2, 'Фото так и не пришло.'],
];

export const T = {
  ideaDrop: 4.3,
  doorOpen: 4.8, tyWalk: [5.0, 6.6], doorClose: 6.4,
  hourglass: 10.2,
  laptop: 11.5, dodge: [11.8, 12.2],
  bulbs: [15.6, 16.6, 17.6],
  doorsGrow: [19.6, 19.85, 20.1], doorGrowDur: 0.45,
  portal: [21.3, 22.2],
  duck: 25.7,
  oks: 26.8, okStep: 0.55,
  weight: 31.6,
  squash: [26.8, 31.9],
  puff: 36.9,
  simEnd: 38.3,
  alarm: 38.3,
  press: { drop: 39.6, hit: 40.6, lift: 41.6, gone: 42.8 },
  swap: 41.1,
  lift: [48.6, 49.6], spin: [54.6, 56.2],
  pocket: [57.4, 58.4], showDuck: [58.4, 59.1], squeeze: 59.4,
  flash: 59.7, crack: [59.8, 60.3], burst: 60.3,
  write: [66.9, 68.1],
  desk: 68.6, black: 71.6,
};

// Карта хука: 0–1.9 с — пресс падает (сцена 38.7→40.6), стоп-кадр со вспышкой, затем перемотка назад к 3 с.
export function hookMap(t) {
  if (t < 1.9) return 38.7 + t;
  if (t < 2.2) return T.press.hit;
  const k = span(t, 2.2, 3.0);
  return lerp(T.press.hit, 3.0, 1 - (1 - k) ** 3);
}
export const sceneTime = t => (t < 3 ? hookMap(t) : t);

// Claude: смещение при уклонении от ноутбука и сплющивание под кучей (общая кривая и для коллайдера, и для меша).
export const claudeX = tm => lerp(-0.5, 0.25, smooth(span(tm, ...T.dodge)));
export const CLAUDE_Z = 0.6;
export const SQUASHED = 0.38;
export function claudeBaseSY(tm) {
  if (tm < T.swap) return lerp(1, SQUASHED, smooth(span(tm, ...T.squash)));
  if (tm < T.burst) return 1;
  return lerp(1, SQUASHED, smooth(span(tm, T.burst, T.burst + 5.2)));
}

// Ты: идёт от двери к своему месту.
export const TY_HOME = [1.5, 0.8], TY_DOOR = [-1.3, -1.9];

// Уровень контекста: ступени [время, %], каждая переходит плавно за 0.4 с.
const CTX_STEPS = [[3, 0], [4.9, 5], [12.5, 20], [16.2, 25], [17.2, 30], [18.2, 40],
  [T.doorsGrow[0] + 0.3, 50], [T.doorsGrow[1] + 0.3, 55], [T.doorsGrow[2] + 0.3, 60], [26.4, 70],
  ...Array.from({ length: 8 }, (_, i) => [T.oks + i * T.okStep + 0.5, 72 + (i + 1) * 23 / 8]),
  [32.3, 97], [T.alarm, 100], [T.swap + 0.2, 3]];
export function contextAt(tm) {
  if (tm >= T.burst) return lerp(3, 97, smooth(span(tm, T.burst, T.burst + 5.2)));
  let v = 0, prev = 0;
  for (const [at, p] of CTX_STEPS) {
    if (tm < at) break;
    prev = v; v = lerp(prev, p, smooth((tm - at) / 0.4));
    if (tm - at >= 0.4) v = p;
  }
  return v;
}

// Песочные часы «сейчас…» сыплют весь ролик, к финалу песок кончается.
export const sandAt = tm => span(tm, T.hourglass, 70);

// Пресс: высота центра плиты.
export function plateY(tm) {
  const p = T.press;
  if (tm < p.drop) return 8.5;
  if (tm < p.hit) return lerp(8.5, 0.27, span(tm, p.drop, p.hit) ** 2);
  if (tm < p.lift) return 0.27;
  return lerp(0.27, 8.5, span(tm, p.lift, p.gone) ** 2);
}

// Моргание по фиксированному расписанию.
const BLINKS = [];
for (let t = 2; t < 90; t = t + 2 + ((t * 7919) % 3)) BLINKS.push(t);
export const blinking = t => BLINKS.some(b => t >= b && t < b + 0.14);

export const lineAt = t => DIALOG.find(([, a, b]) => t >= a && t < b) || null;
export const talking = (who, t) => DIALOG.some(([w, a, b]) => w === who && t >= a && t < b);
