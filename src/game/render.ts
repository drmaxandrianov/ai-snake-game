import { COLS, ROWS, type GameState, type Phase } from './engine';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export interface Ring {
  x: number;
  y: number;
  t: number;
}

export interface FloatText {
  x: number;
  y: number;
  t: number;
  text: string;
  color: string;
}

export interface FX {
  particles: Particle[];
  rings: Ring[];
  texts: FloatText[];
  shake: number;
  flash: number;
}

export const makeFX = (): FX => ({ particles: [], rings: [], texts: [], shake: 0, flash: 0 });

export interface DrawOpts {
  g: GameState;
  t: number; // 0..1 interpolation between prevSnake and snake
  time: number; // ms
  dt: number; // seconds
  fx: FX;
  phase: Phase;
}

const MINT: [number, number, number] = [158, 242, 188];
const DEEP: [number, number, number] = [24, 98, 64];

function mix(a: [number, number, number], b: [number, number, number], k: number): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

function rgba(c: [number, number, number], a: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

/** Burst of confetti + ring + floating "+pts" text at a pixel position. */
export function spawnEatFX(fx: FX, px: number, py: number, cell: number, points: number) {
  const colors = ['#ffc964', '#7ef0a6', '#ff8a70'];
  const s = cell / 28;
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (55 + Math.random() * 165) * s;
    fx.particles.push({
      x: px,
      y: py,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 46 * s,
      life: 0,
      max: 0.45 + Math.random() * 0.35,
      color: colors[i % 3],
      size: (2 + Math.random() * 2.6) * s,
    });
  }
  fx.rings.push({ x: px, y: py, t: 0 });
  fx.texts.push({ x: px, y: py - cell * 0.55, t: 0, text: `+${points}`, color: '#ffc964' });
  if (fx.particles.length > 170) fx.particles.splice(0, fx.particles.length - 170);
}

export function draw(ctx: CanvasRenderingContext2D, size: number, o: DrawOpts) {
  const { g, time, dt, fx } = o;
  const cell = size / COLS;

  ctx.save();

  // decay + apply screen shake
  fx.shake *= Math.exp(-6 * dt);
  if (fx.shake > 0.05) {
    const m = fx.shake * cell * 0.035;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }

  // ---- board ----
  ctx.fillStyle = '#0c1e17';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(126,240,166,0.03)';
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (((x + y) & 1) === 0) ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }

  const vg = ctx.createRadialGradient(size / 2, size / 2, size * 0.22, size / 2, size / 2, size * 0.74);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(3,10,7,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, size, size);

  // inner border + gold viewfinder corner brackets
  const off = cell * 0.18;
  ctx.strokeStyle = 'rgba(126,240,166,0.16)';
  ctx.lineWidth = Math.max(1.5, cell * 0.055);
  ctx.strokeRect(off, off, size - off * 2, size - off * 2);

  ctx.strokeStyle = 'rgba(255,201,100,0.85)';
  ctx.lineWidth = Math.max(2, cell * 0.1);
  ctx.lineCap = 'round';
  const bl = cell * 1.15;
  const b = cell * 0.18;
  ctx.beginPath();
  ctx.moveTo(b, b + bl);
  ctx.lineTo(b, b);
  ctx.lineTo(b + bl, b);
  ctx.moveTo(size - b - bl, b);
  ctx.lineTo(size - b, b);
  ctx.lineTo(size - b, b + bl);
  ctx.moveTo(size - b, size - b - bl);
  ctx.lineTo(size - b, size - b);
  ctx.lineTo(size - b - bl, size - b);
  ctx.moveTo(b + bl, size - b);
  ctx.lineTo(b, size - b);
  ctx.lineTo(b, size - b - bl);
  ctx.stroke();

  // ---- food ----
  if (g.food) {
    const pulse = 1 + Math.sin(time / 260 + g.foodSeed) * 0.07;
    const fxp = (g.food.x + 0.5) * cell;
    const fyp = (g.food.y + 0.5) * cell;
    const r = cell * 0.34 * pulse;

    const glow = ctx.createRadialGradient(fxp, fyp, r * 0.2, fxp, fyp, r * 2.7);
    glow.addColorStop(0, 'rgba(255,98,70,0.32)');
    glow.addColorStop(1, 'rgba(255,98,70,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(fxp, fyp, r * 2.7, 0, Math.PI * 2);
    ctx.fill();

    const bg = ctx.createRadialGradient(fxp - r * 0.35, fyp - r * 0.4, r * 0.15, fxp, fyp, r);
    bg.addColorStop(0, '#ff9a7c');
    bg.addColorStop(0.55, '#f4603f');
    bg.addColorStop(1, '#d13a24');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(fxp, fyp, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#8a5a33';
    ctx.lineWidth = Math.max(1.5, cell * 0.07);
    ctx.beginPath();
    ctx.moveTo(fxp, fyp - r);
    ctx.quadraticCurveTo(fxp + r * 0.12, fyp - r * 1.5, fxp + r * 0.32, fyp - r * 1.55);
    ctx.stroke();

    ctx.save();
    ctx.translate(fxp + r * 0.5, fyp - r * 1.22);
    ctx.rotate(-0.6);
    ctx.fillStyle = '#7ef0a6';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.42, r * 0.19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(fxp - r * 0.35, fyp - r * 0.38, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- snake ----
  const prev = g.prevSnake.length > 0 ? g.prevSnake : g.snake;
  const pts = g.snake.map((c, i) => {
    const p = prev[Math.min(i, prev.length - 1)];
    return {
      x: (p.x + (c.x - p.x) * o.t + 0.5) * cell,
      y: (p.y + (c.y - p.y) * o.t + 0.5) * cell,
    };
  });

  if (pts.length > 0) {
    const bodyAlpha = o.phase === 'menu' ? 0.85 : 1;
    ctx.globalAlpha = bodyAlpha;

    // soft drop shadow
    ctx.save();
    ctx.translate(cell * 0.07, cell * 0.11);
    ctx.strokeStyle = 'rgba(2,8,5,0.32)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = cell * 0.68;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.restore();

    // mint under-glow following the head
    const hgx = pts[0].x;
    const hgy = pts[0].y;
    const hg = ctx.createRadialGradient(hgx, hgy, 0, hgx, hgy, cell * 2.4);
    hg.addColorStop(0, rgba(MINT, g.dead ? 0.04 : 0.11));
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(hgx - cell * 2.4, hgy - cell * 2.4, cell * 4.8, cell * 4.8);

    // body: tail → head, tapering width, mint → deep-green gradient
    const n = pts.length;
    ctx.lineCap = 'round';
    for (let i = n - 1; i >= 1; i--) {
      const k = (i - 1) / Math.max(1, n - 1);
      ctx.strokeStyle = rgba(mix(MINT, DEEP, Math.min(1, k * 1.05)), 1);
      ctx.lineWidth = cell * (0.74 - 0.3 * k);
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i - 1].x, pts[i - 1].y);
      ctx.stroke();
    }

    // head
    const hd = pts[0];
    const dir = g.dir;
    const hr = cell * 0.42;
    const hgrad = ctx.createRadialGradient(
      hd.x - dir.x * hr * 0.3,
      hd.y - dir.y * hr * 0.3,
      hr * 0.1,
      hd.x,
      hd.y,
      hr
    );
    hgrad.addColorStop(0, '#d9ffe6');
    hgrad.addColorStop(0.5, rgba(MINT, 1));
    hgrad.addColorStop(1, rgba(mix(MINT, DEEP, 0.28), 1));
    ctx.fillStyle = hgrad;
    ctx.beginPath();
    ctx.arc(hd.x, hd.y, hr, 0, Math.PI * 2);
    ctx.fill();

    // tongue flick every couple of seconds while alive
    if (!g.dead && time % 2400 < 220) {
      ctx.strokeStyle = '#ff6b52';
      ctx.lineWidth = Math.max(1.5, cell * 0.06);
      const mx = hd.x + dir.x * hr;
      const my = hd.y + dir.y * hr;
      const tx = hd.x + dir.x * (hr + cell * 0.3);
      const ty = hd.y + dir.y * (hr + cell * 0.3);
      const px = -dir.y;
      const py = dir.x;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(tx, ty);
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + dir.x * cell * 0.1 + px * cell * 0.08, ty + dir.y * cell * 0.1 + py * cell * 0.08);
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + dir.x * cell * 0.1 - px * cell * 0.08, ty + dir.y * cell * 0.1 - py * cell * 0.08);
      ctx.stroke();
    }

    // eyes (X eyes when dead)
    const ex = -dir.y;
    const ey = dir.x;
    const eo = cell * 0.17;
    const fo = cell * 0.13;
    for (const s of [1, -1]) {
      const cx = hd.x + dir.x * fo + ex * eo * s;
      const cy = hd.y + dir.y * fo + ey * eo * s;
      if (g.dead) {
        ctx.strokeStyle = '#08251a';
        ctx.lineWidth = Math.max(1.5, cell * 0.06);
        const xr = cell * 0.09;
        ctx.beginPath();
        ctx.moveTo(cx - xr, cy - xr);
        ctx.lineTo(cx + xr, cy + xr);
        ctx.moveTo(cx + xr, cy - xr);
        ctx.lineTo(cx - xr, cy + xr);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#f4fbf6';
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.115, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0b2b1e';
        ctx.beginPath();
        ctx.arc(cx + dir.x * cell * 0.045, cy + dir.y * cell * 0.045, cell * 0.058, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- fx: rings, particles, floating texts ----
  for (let i = fx.rings.length - 1; i >= 0; i--) {
    const r = fx.rings[i];
    r.t += dt / 0.45;
    if (r.t >= 1) {
      fx.rings.splice(i, 1);
      continue;
    }
    ctx.strokeStyle = `rgba(255,201,100,${(1 - r.t) * 0.8})`;
    ctx.lineWidth = Math.max(1, cell * 0.09 * (1 - r.t));
    ctx.beginPath();
    ctx.arc(r.x, r.y, cell * (0.4 + r.t * 1.35), 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = fx.particles.length - 1; i >= 0; i--) {
    const p = fx.particles[i];
    p.life += dt;
    if (p.life >= p.max) {
      fx.particles.splice(i, 1);
      continue;
    }
    p.vy += cell * 15 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    ctx.globalAlpha = 1 - p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  for (let i = fx.texts.length - 1; i >= 0; i--) {
    const ft = fx.texts[i];
    ft.t += dt / 0.8;
    if (ft.t >= 1) {
      fx.texts.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = 1 - ft.t * ft.t;
    ctx.fillStyle = ft.color;
    ctx.font = `700 ${Math.round(cell * 0.62)}px "Space Grotesk", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ft.text, ft.x, ft.y - ft.t * cell * 1.15);
  }
  ctx.globalAlpha = 1;

  // ---- death flash ----
  if (fx.flash > 0.01) {
    fx.flash *= Math.exp(-3.1 * dt);
    ctx.fillStyle = `rgba(255,72,48,${fx.flash * 0.32})`;
    ctx.fillRect(0, 0, size, size);
  }

  ctx.restore();
}
