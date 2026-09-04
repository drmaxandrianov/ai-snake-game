export interface Vec {
  x: number;
  y: number;
}

export const COLS = 21;
export const ROWS = 21;

export type DiffKey = 'chill' | 'classic' | 'turbo';

export interface Difficulty {
  key: DiffKey;
  label: string;
  interval: number; // base ms per grid step
  mult: number; // score multiplier
  accent: string;
  blurb: string;
}

export const DIFFICULTIES: Record<DiffKey, Difficulty> = {
  chill: { key: 'chill', label: 'Chill', interval: 168, mult: 1, accent: '#7ef0a6', blurb: '×1 pts' },
  classic: { key: 'classic', label: 'Classic', interval: 118, mult: 2, accent: '#ffc964', blurb: '×2 pts' },
  turbo: { key: 'turbo', label: 'Turbo', interval: 84, mult: 3, accent: '#ff6b52', blurb: '×3 pts' },
};

export const DIFF_ORDER: DiffKey[] = ['chill', 'classic', 'turbo'];

export type Phase = 'menu' | 'countdown' | 'playing' | 'paused' | 'over';

export interface GameState {
  snake: Vec[]; // head first
  prevSnake: Vec[];
  dir: Vec;
  queue: Vec[];
  food: Vec | null;
  foodSeed: number;
  apples: number;
  dead: boolean;
}

export function createState(): GameState {
  const cy = Math.floor(ROWS / 2);
  const cx = Math.floor(COLS / 2);
  const snake: Vec[] = [
    { x: cx + 1, y: cy },
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
  const g: GameState = {
    snake,
    prevSnake: snake.map((p) => ({ ...p })),
    dir: { x: 1, y: 0 },
    queue: [],
    food: null,
    foodSeed: Math.random() * 10,
    apples: 0,
    dead: false,
  };
  g.food = spawnFood(g.snake);
  return g;
}

export function spawnFood(snake: Vec[]): Vec | null {
  const taken = new Set(snake.map((s) => `${s.x},${s.y}`));
  const empties: Vec[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!taken.has(`${x},${y}`)) empties.push({ x, y });
    }
  }
  if (empties.length === 0) return null;
  return empties[Math.floor(Math.random() * empties.length)];
}

export function queueDirection(g: GameState, d: Vec) {
  const last = g.queue.length > 0 ? g.queue[g.queue.length - 1] : g.dir;
  if (d.x === -last.x && d.y === -last.y) return; // no 180° reversal
  if (d.x === last.x && d.y === last.y) return; // no duplicates
  if (g.queue.length < 2) g.queue.push(d);
}

export interface StepResult {
  died: boolean;
  ate: boolean;
}

export function stepGame(g: GameState): StepResult {
  while (g.queue.length > 0) {
    const d = g.queue.shift()!;
    const isReverse = d.x === -g.dir.x && d.y === -g.dir.y;
    const isSame = d.x === g.dir.x && d.y === g.dir.y;
    if (!isReverse && !isSame) {
      g.dir = d;
      break;
    }
  }
  g.prevSnake = g.snake.map((p) => ({ ...p }));
  const head = g.snake[0];
  const nh = { x: head.x + g.dir.x, y: head.y + g.dir.y };
  if (nh.x < 0 || nh.y < 0 || nh.x >= COLS || nh.y >= ROWS) {
    return { died: true, ate: false };
  }
  const eating = g.food !== null && nh.x === g.food.x && nh.y === g.food.y;
  const body = eating ? g.snake : g.snake.slice(0, -1);
  if (body.some((s) => s.x === nh.x && s.y === nh.y)) {
    return { died: true, ate: false };
  }
  g.snake = [nh, ...body];
  if (eating) {
    g.apples += 1;
    g.food = spawnFood(g.snake);
    g.foodSeed = Math.random() * 10;
  }
  return { died: false, ate: eating };
}

/** Snake speeds up slightly with every apple, floored so it stays playable. */
export function effectiveInterval(diff: Difficulty, apples: number): number {
  return Math.max(diff.interval * 0.58, diff.interval - apples * 2.4);
}

// ---------- high scores (per difficulty, persisted) ----------

const LS_KEY = 'serpent.best.v1';
export type BestMap = Record<DiffKey, number>;

export function loadBest(): BestMap {
  const fallback: BestMap = { chill: 0, classic: 0, turbo: 0 };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<BestMap>;
    return {
      chill: Number(p.chill) || 0,
      classic: Number(p.classic) || 0,
      turbo: Number(p.turbo) || 0,
    };
  } catch {
    return fallback;
  }
}

export function saveBest(map: BestMap) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — play on without persistence */
  }
}

const LS_DIFF = 'serpent.diff.v1';

export function loadDiff(): DiffKey {
  try {
    const d = localStorage.getItem(LS_DIFF);
    if (d === 'chill' || d === 'classic' || d === 'turbo') return d;
  } catch {
    /* noop */
  }
  return 'classic';
}

export function saveDiff(d: DiffKey) {
  try {
    localStorage.setItem(LS_DIFF, d);
  } catch {
    /* noop */
  }
}
