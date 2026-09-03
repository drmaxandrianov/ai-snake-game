// Tiny WebAudio synth for arcade blips — no assets, lazily unlocked on first gesture.

let ctx: AudioContext | null = null;
let muted = loadMuted();

function loadMuted(): boolean {
  try {
    return localStorage.getItem('serpent.muted') === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('serpent.muted', m ? '1' : '0');
  } catch {
    /* noop */
  }
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  if (!ctx) {
    const AC = w.AudioContext ?? w.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function blip(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  slideTo?: number,
  delay = 0
) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  } catch {
    /* audio is decoration — never break the game */
  }
}

export const sfx = {
  /** Pitch rises as the snake grows — subtle urgency. */
  eat(apples: number) {
    const f = 430 * Math.pow(1.045, Math.min(apples, 16));
    blip(f, 0.09, 'square', 0.05);
    blip(f * 1.5, 0.12, 'sine', 0.045, undefined, 0.035);
  },
  die() {
    blip(300, 0.38, 'sawtooth', 0.06, 58);
    blip(150, 0.5, 'triangle', 0.055, 42, 0.05);
  },
  start() {
    blip(392, 0.09, 'square', 0.045);
    blip(523, 0.09, 'square', 0.045, undefined, 0.09);
    blip(659, 0.16, 'square', 0.05, undefined, 0.18);
  },
  pause() {
    blip(340, 0.09, 'triangle', 0.05, 250);
  },
  resume() {
    blip(250, 0.09, 'triangle', 0.05, 400);
  },
  count(final: boolean) {
    blip(final ? 880 : 440, final ? 0.2 : 0.08, 'square', 0.045);
  },
  turn() {
    blip(230, 0.045, 'sine', 0.028);
  },
};
