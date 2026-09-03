import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  COLS,
  DIFFICULTIES,
  DIFF_ORDER,
  createState,
  effectiveInterval,
  loadBest,
  loadDiff,
  queueDirection,
  saveBest,
  saveDiff,
  stepGame,
  type BestMap,
  type DiffKey,
  type GameState,
  type Phase,
  type Vec,
} from '../game/engine';
import { draw, makeFX, spawnEatFX, type FX } from '../game/render';
import { isMuted, setMuted, sfx } from '../game/audio';

const CD_STEP = 560; // ms per countdown digit
const BOARD_W = 'min(92vw, 58dvh, 540px)';

const DIRS: Record<string, Vec> = {
  arrowup: { x: 0, y: -1 },
  arrowdown: { x: 0, y: 1 },
  arrowleft: { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

/* ---------- tiny inline icons ---------- */

function IconPlay({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.53.85l10.2-6.5a1 1 0 0 0 0-1.7L9.53 4.65A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

function IconPause({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1.2" />
      <rect x="14" y="5" width="4" height="14" rx="1.2" />
    </svg>
  );
}

function IconRestart({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function IconSound({ on, className = 'h-4 w-4' }: { on: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" fill="currentColor" stroke="none" />
      {on ? (
        <>
          <path d="M15 9.5a4 4 0 0 1 0 5" />
          <path d="M17.5 7a8 8 0 0 1 0 10" />
        </>
      ) : (
        <path d="m15.5 9.5 5 5m0-5-5 5" />
      )}
    </svg>
  );
}

function IconTrophy({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8m-4-4v4M7 4h10v6a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4a3 3 0 0 0 3 5m10-5h3a3 3 0 0 1-3 5" />
    </svg>
  );
}

function IconChevron({ className = 'h-6 w-6', rotate = 0 }: { className?: string; rotate?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={{ transform: `rotate(${rotate}deg)` }} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 14 6-6 6 6" />
    </svg>
  );
}

function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#12281f" stroke="#2c4a3a" />
      <path
        d="M9 23c0 2.8 2.2 5 5 5h4c2.8 0 5-2.2 5-5s-2.2-5-5-5h-4c-2.8 0-5-2.2-5-5s2.2-5 5-5h4c2.8 0 5 2.2 5 5"
        fill="none"
        stroke="#7ef0a6"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="24.4" cy="13" r="1.9" fill="#ffc964" />
    </svg>
  );
}

/* ---------- small building blocks ---------- */

function DifficultyPicker({ value, onChange }: { value: DiffKey; onChange: (d: DiffKey) => void }) {
  return (
    <div className="flex rounded-lg border border-[#2c4a3a] bg-[#0d211a] p-1" role="radiogroup" aria-label="Difficulty">
      {DIFF_ORDER.map((k) => {
        const d = DIFFICULTIES[k];
        const active = k === value;
        return (
          <button
            key={k}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(k)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-all duration-150 sm:px-4 ${
              active ? 'shadow-[0_2px_10px_-2px_rgba(0,0,0,0.6)]' : 'text-[#8fb3a0] hover:text-[#e9f5ec]'
            }`}
            style={active ? { backgroundColor: d.accent, color: '#08130d' } : undefined}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

function DPad({ onDir, onCenter, center }: { onDir: (d: Vec) => void; onCenter: () => void; center: 'play' | 'pause' }) {
  const btn =
    'flex h-14 w-16 items-center justify-center rounded-xl border border-[#2c4a3a] bg-[#12281f]/90 text-[#bcd8c6] transition-transform duration-75 select-none active:scale-90 active:bg-[#1b3a2c] active:text-[#e9f5ec]';
  return (
    <div className="grid grid-cols-3 gap-2" onContextMenu={(e) => e.preventDefault()}>
      <div />
      <button type="button" aria-label="Move up" className={btn} onPointerDown={(e) => { e.preventDefault(); onDir({ x: 0, y: -1 }); }}>
        <IconChevron />
      </button>
      <div />
      <button type="button" aria-label="Move left" className={btn} onPointerDown={(e) => { e.preventDefault(); onDir({ x: -1, y: 0 }); }}>
        <IconChevron rotate={-90} />
      </button>
      <button
        type="button"
        aria-label={center === 'play' ? 'Start or resume' : 'Pause'}
        className={`${btn} ${center === 'play' ? 'border-[#7ef0a6]/60 text-[#7ef0a6]' : 'border-[#ffc964]/60 text-[#ffc964]'}`}
        onPointerDown={(e) => { e.preventDefault(); onCenter(); }}
      >
        {center === 'play' ? <IconPlay className="h-6 w-6" /> : <IconPause className="h-6 w-6" />}
      </button>
      <button type="button" aria-label="Move right" className={btn} onPointerDown={(e) => { e.preventDefault(); onDir({ x: 1, y: 0 }); }}>
        <IconChevron rotate={90} />
      </button>
      <div />
      <button type="button" aria-label="Move down" className={btn} onPointerDown={(e) => { e.preventDefault(); onDir({ x: 0, y: 1 }); }}>
        <IconChevron rotate={180} />
      </button>
      <div />
    </div>
  );
}

function Stat({ label, children, align = 'left' }: { label: string; children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <div className={`flex flex-col ${align === 'right' ? 'items-end text-right' : 'items-start'}`}>
      <span className="text-[10px] font-semibold tracking-[0.22em] text-[#6f9484] uppercase">{label}</span>
      <span className="leading-tight">{children}</span>
    </div>
  );
}

/* ---------- the game ---------- */

export default function SnakeGame() {
  const [phase, setPhase] = useState<Phase>('menu');
  const [difficulty, setDifficultyState] = useState<DiffKey>(() => loadDiff());
  const [score, setScore] = useState(0);
  const [len, setLen] = useState(4);
  const [best, setBest] = useState<BestMap>(() => loadBest());
  const [muted, setMutedState] = useState<boolean>(() => isMuted());
  const [countdown, setCountdown] = useState(3);
  const [showGo, setShowGo] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const [coarse] = useState<boolean>(() => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<GameState | null>(null);
  if (gameRef.current === null) gameRef.current = createState();

  const phaseRef = useRef<Phase>('menu');
  const diffRef = useRef<DiffKey>(difficulty);
  const scoreRef = useRef(0);
  const bestRef = useRef(best);
  const accRef = useRef(0);
  const tRef = useRef(0);
  const cdEndRef = useRef(0);
  const lastCountRef = useRef(3);
  const fxRef = useRef<FX>(makeFX());
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const goTimerRef = useRef<number | null>(null);
  const deathTimerRef = useRef<number | null>(null);

  const goPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const setDifficulty = useCallback((d: DiffKey) => {
    diffRef.current = d;
    setDifficultyState(d);
    saveDiff(d);
  }, []);

  const start = useCallback(() => {
    gameRef.current = createState();
    scoreRef.current = 0;
    accRef.current = 0;
    tRef.current = 0;
    lastCountRef.current = 4;
    fxRef.current = makeFX();
    if (deathTimerRef.current !== null) window.clearTimeout(deathTimerRef.current);
    setScore(0);
    setLen(4);
    setIsNewBest(false);
    setCountdown(3);
    cdEndRef.current = performance.now() + CD_STEP * 3;
    goPhase('countdown');
    sfx.start();
  }, [goPhase]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === 'playing') {
      goPhase('paused');
      sfx.pause();
    } else if (phaseRef.current === 'paused') {
      goPhase('playing');
      sfx.resume();
    }
  }, [goPhase]);

  const toggleMute = useCallback(() => {
    setMutedState((m) => {
      const nm = !m;
      setMuted(nm);
      return nm;
    });
  }, []);

  const handleDirInput = useCallback(
    (d: Vec) => {
      const ph = phaseRef.current;
      if (ph === 'menu' || ph === 'over') {
        start();
        queueDirection(gameRef.current!, d); // queue on the fresh state created by start()
      } else if (ph === 'countdown' || ph === 'playing') {
        queueDirection(gameRef.current!, d);
      } else if (ph === 'paused') {
        togglePause();
        queueDirection(gameRef.current!, d);
      }
    },
    [start, togglePause]
  );

  /* ----- main loop ----- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = gameRef.current!;
      const ph = phaseRef.current;
      const diff = DIFFICULTIES[diffRef.current];
      const fx = fxRef.current;

      if (ph === 'countdown') {
        const remain = cdEndRef.current - now;
        const digit = Math.max(1, Math.ceil(remain / CD_STEP));
        if (digit !== lastCountRef.current) {
          lastCountRef.current = digit;
          setCountdown(digit);
          sfx.count(false);
        }
        if (remain <= 0) {
          accRef.current = 0;
          tRef.current = 0;
          goPhase('playing');
          sfx.count(true);
          setShowGo(true);
          if (goTimerRef.current !== null) window.clearTimeout(goTimerRef.current);
          goTimerRef.current = window.setTimeout(() => setShowGo(false), 620);
        }
      }

      if (ph === 'playing' && !g.dead) {
        accRef.current += dt * 1000;
        const interval = effectiveInterval(diff, g.apples);
        let guard = 0;
        while (accRef.current >= interval && guard++ < 4 && !g.dead) {
          accRef.current -= interval;
          const res = stepGame(g);
          if (res.ate) {
            const pts = 10 * diff.mult;
            scoreRef.current += pts;
            setScore(scoreRef.current);
            setLen(g.snake.length);
            const cell = canvas.width / COLS;
            const head = g.snake[0];
            spawnEatFX(fx, (head.x + 0.5) * cell, (head.y + 0.5) * cell, cell, pts);
            sfx.eat(g.apples);
            if (typeof navigator.vibrate === 'function') navigator.vibrate(12);
          }
          if (res.died) {
            g.dead = true;
            fx.flash = 1;
            fx.shake = 12;
            sfx.die();
            if (typeof navigator.vibrate === 'function') navigator.vibrate([30, 40, 60]);
            deathTimerRef.current = window.setTimeout(() => {
              if (phaseRef.current !== 'playing') return;
              const sc = scoreRef.current;
              const dk = diffRef.current;
              const nb = sc > bestRef.current[dk];
              if (nb) {
                const next = { ...bestRef.current, [dk]: sc };
                bestRef.current = next;
                saveBest(next);
                setBest(next);
              }
              setIsNewBest(nb);
              goPhase('over');
            }, 750);
            break;
          }
        }
        tRef.current = Math.min(1, accRef.current / effectiveInterval(diff, g.apples));
      }

      draw(ctx, canvas.width, {
        g,
        t: ph === 'playing' || ph === 'paused' || (ph === 'over' && g.dead) ? tRef.current : ph === 'countdown' ? 0 : tRef.current,
        time: now,
        dt,
        fx,
        phase: ph,
      });
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [goPhase]);

  /* ----- keyboard ----- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const lower = e.key.toLowerCase();
      const dir = DIRS[lower];
      const ph = phaseRef.current;

      if (dir) {
        e.preventDefault();
        if (ph === 'paused') {
          togglePause();
          queueDirection(gameRef.current!, dir);
        } else if (ph === 'menu') {
          handleDirInput(dir);
        } else if (ph === 'countdown' || ph === 'playing') {
          queueDirection(gameRef.current!, dir);
        }
        return; // pressing arrows on the "over" screen waits for an explicit restart
      }

      if (lower === ' ' || lower === 'enter') {
        e.preventDefault();
        if (ph === 'menu' || ph === 'over') start();
        else if (ph === 'playing' || ph === 'paused') togglePause();
        else if (ph === 'countdown') togglePause();
        return;
      }
      if (lower === 'p' || lower === 'escape') {
        if (ph === 'playing' || ph === 'paused') togglePause();
        return;
      }
      if (lower === 'r') {
        if (ph !== 'menu') start();
        return;
      }
      if (lower === 'm') {
        toggleMute();
        return;
      }
      if (lower === '1' || lower === '2' || lower === '3') {
        setDifficulty(DIFF_ORDER[Number(lower) - 1]);
        sfx.turn();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [start, togglePause, toggleMute, handleDirInput, setDifficulty]);

  /* ----- auto-pause when the tab hides ----- */
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && phaseRef.current === 'playing') togglePause();
    };
    const onBlur = () => {
      if (phaseRef.current === 'playing') togglePause();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('blur', onBlur);
    };
  }, [togglePause]);

  useEffect(() => {
    return () => {
      if (goTimerRef.current !== null) window.clearTimeout(goTimerRef.current);
      if (deathTimerRef.current !== null) window.clearTimeout(deathTimerRef.current);
    };
  }, []);

  /* ----- touch: swipe to steer, tap to start/resume ----- */
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchRef.current;
    touchRef.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (Math.max(adx, ady) > 24) {
      const d: Vec = adx > ady ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
      handleDirInput(d);
    } else {
      const ph = phaseRef.current;
      if (ph === 'menu' || ph === 'over') start();
      else if (ph === 'paused') togglePause();
    }
  };

  const diff = DIFFICULTIES[difficulty];
  const bestShown = Math.max(best[difficulty], score);
  const totalBest = best.chill + best.classic + best.turbo;

  const iconBtn =
    'flex h-10 w-10 items-center justify-center rounded-lg border border-[#2c4a3a] bg-[#12281f] text-[#bcd8c6] transition-all duration-150 hover:border-[#3d6650] hover:text-[#e9f5ec] active:scale-90 disabled:opacity-35 disabled:pointer-events-none';

  return (
    <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center px-4 pb-8 pt-5 sm:pt-7">
      {/* ---------- header ---------- */}
      <header className="mb-5 flex w-full items-center justify-between gap-3" style={{ width: BOARD_W, maxWidth: '100%' }}>
        <div className="flex items-center gap-3">
          <LogoMark />
          <div className="leading-none">
            <div className="font-display text-lg tracking-wide text-[#e9f5ec]">
              SERPENT<span className="text-[#7ef0a6]">.</span>
            </div>
            <div className="mt-1 text-[10px] font-semibold tracking-[0.3em] text-[#6f9484] uppercase">modern snake</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-lg border border-[#2c4a3a] bg-[#0d211a] px-3 py-2 text-[#ffc964] sm:flex">
            <IconTrophy className="h-4 w-4" />
            <span className="font-display text-sm tabular-nums">{totalBest}</span>
          </div>
          <button type="button" className={iconBtn} onClick={toggleMute} aria-label={muted ? 'Unmute (M)' : 'Mute (M)'} title={muted ? 'Unmute (M)' : 'Mute (M)'}>
            <IconSound on={!muted} />
          </button>
        </div>
      </header>

      {/* ---------- HUD ---------- */}
      <div className="mb-3 flex w-full items-end justify-between" style={{ width: BOARD_W, maxWidth: '100%' }}>
        <Stat label="Score">
          <span key={score} className="anim-pop font-display text-4xl text-[#ffc964] tabular-nums sm:text-5xl">
            {score}
          </span>
        </Stat>
        <div className="flex items-end gap-5">
          <Stat label="Best" align="right">
            <span className={`font-display text-xl tabular-nums sm:text-2xl ${score > best[difficulty] && score > 0 ? 'text-[#7ef0a6]' : 'text-[#e9f5ec]'}`}>
              {bestShown}
            </span>
          </Stat>
          <Stat label="Length" align="right">
            <span className="font-display text-xl text-[#8fb3a0] tabular-nums sm:text-2xl">{len}</span>
          </Stat>
          <Stat label="Speed" align="right">
            <span className="flex items-center gap-1.5 font-display text-xl sm:text-2xl" style={{ color: diff.accent }}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: diff.accent }} />
              {diff.label}
            </span>
          </Stat>
        </div>
      </div>

      {/* ---------- board ---------- */}
      <div
        className="relative aspect-square touch-none overflow-hidden rounded-xl shadow-[0_0_0_1px_rgba(126,240,166,0.16),0_30px_90px_-24px_rgba(0,0,0,0.9),0_0_70px_-24px_rgba(126,240,166,0.35)] select-none"
        style={{ width: BOARD_W }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {/* menu */}
        {phase === 'menu' && (
          <div className="anim-rise absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-[rgba(6,15,11,0.82)] p-6 text-center backdrop-blur-[2px]">
            <div>
              <div className="mb-2 text-[10px] font-bold tracking-[0.4em] text-[#6f9484] uppercase">Serpent Arcade</div>
              <h1 className="title-shadow font-display text-6xl text-[#e9f5ec] sm:text-7xl">SNAKE</h1>
            </div>
            <p className="max-w-[260px] text-sm leading-relaxed text-[#8fb3a0]">
              Eat apples. Grow long. Whatever you do — <span className="text-[#ff8a70]">don&apos;t bite yourself.</span>
            </p>
            <DifficultyPicker value={difficulty} onChange={(d) => { setDifficulty(d); sfx.turn(); }} />
            <button
              type="button"
              onClick={start}
              className="flex items-center gap-3 rounded-lg bg-[#7ef0a6] px-9 py-3 font-display text-lg text-[#07130c] shadow-[0_6px_0_#2f8f5b,0_14px_36px_-10px_rgba(126,240,166,0.55)] transition-all duration-100 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-1 active:shadow-[0_2px_0_#2f8f5b]"
            >
              <IconPlay className="h-5 w-5" /> START
            </button>
            <div className="text-xs text-[#6f9484]">{coarse ? 'Swipe the board to steer · tap to start' : 'or press any arrow key'}</div>
          </div>
        )}

        {/* countdown */}
        {phase === 'countdown' && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
            <div className="text-[10px] font-bold tracking-[0.4em] text-[#8fb3a0] uppercase">Get ready</div>
            <div key={countdown} className="anim-big-pop title-shadow font-display text-8xl text-[#ffc964]">
              {countdown}
            </div>
          </div>
        )}

        {/* GO! flash */}
        {showGo && phase === 'playing' && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="anim-big-pop title-shadow font-display text-7xl text-[#7ef0a6]">GO!</div>
          </div>
        )}

        {/* paused */}
        {phase === 'paused' && (
          <div className="anim-rise absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-[rgba(6,15,11,0.78)] p-6 text-center backdrop-blur-[2px]">
            <div className="anim-blink title-shadow font-display text-5xl text-[#7ef0a6]">PAUSED</div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePause}
                className="flex items-center gap-2 rounded-lg bg-[#7ef0a6] px-6 py-2.5 font-display text-base text-[#07130c] shadow-[0_5px_0_#2f8f5b] transition-all duration-100 hover:brightness-110 active:translate-y-1 active:shadow-[0_1px_0_#2f8f5b]"
              >
                <IconPlay className="h-4 w-4" /> RESUME
              </button>
              <button
                type="button"
                onClick={start}
                className="flex items-center gap-2 rounded-lg border border-[#2c4a3a] bg-[#12281f] px-6 py-2.5 font-display text-base text-[#bcd8c6] transition-all duration-100 hover:border-[#3d6650] hover:text-[#e9f5ec] active:translate-y-0.5"
              >
                <IconRestart className="h-4 w-4" /> RESTART
              </button>
            </div>
            <div className="text-xs text-[#6f9484]">{coarse ? 'Tap the board to resume' : 'Space to resume · R to restart'}</div>
          </div>
        )}

        {/* game over */}
        {phase === 'over' && (
          <div className="anim-rise absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[rgba(6,15,11,0.85)] p-6 text-center backdrop-blur-[2px]">
            <h2 className="title-shadow-coral font-display text-4xl text-[#ff6b52] sm:text-5xl">GAME OVER</h2>
            {isNewBest && (
              <div className="anim-badge rounded-md bg-[#ffc964] px-3 py-1.5 font-display text-sm text-[#241703] shadow-[0_4px_0_#9c7420]">
                NEW BEST!
              </div>
            )}
            <div className="flex items-center gap-8">
              <Stat label="Score">
                <span className="font-display text-4xl text-[#ffc964] tabular-nums">{score}</span>
              </Stat>
              <Stat label="Best" align="right">
                <span className="font-display text-4xl text-[#7ef0a6] tabular-nums">{bestShown}</span>
              </Stat>
            </div>
            <div className="text-xs text-[#8fb3a0]">
              Length {len} · {diff.label} speed · {len - 4} apples
            </div>
            <button
              type="button"
              onClick={start}
              className="mt-1 flex items-center gap-3 rounded-lg bg-[#7ef0a6] px-8 py-3 font-display text-lg text-[#07130c] shadow-[0_6px_0_#2f8f5b,0_14px_36px_-10px_rgba(126,240,166,0.55)] transition-all duration-100 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-1 active:shadow-[0_2px_0_#2f8f5b]"
            >
              <IconRestart className="h-5 w-5" /> PLAY AGAIN
            </button>
            <div className="text-xs text-[#6f9484]">{coarse ? 'Tap the board to run it back' : 'Enter or R to restart'}</div>
          </div>
        )}
      </div>

      {/* ---------- controls row ---------- */}
      <div className="mt-4 flex w-full flex-wrap items-center justify-between gap-3" style={{ width: BOARD_W, maxWidth: '100%' }}>
        <DifficultyPicker value={difficulty} onChange={(d) => { setDifficulty(d); sfx.turn(); }} />
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={iconBtn}
            onClick={togglePause}
            disabled={phase !== 'playing' && phase !== 'paused'}
            aria-label={phase === 'paused' ? 'Resume (Space)' : 'Pause (Space)'}
            title={phase === 'paused' ? 'Resume (Space)' : 'Pause (Space)'}
          >
            {phase === 'paused' ? <IconPlay /> : <IconPause />}
          </button>
          <button
            type="button"
            className={iconBtn}
            onClick={start}
            disabled={phase === 'menu'}
            aria-label="Restart (R)"
            title="Restart (R)"
          >
            <IconRestart />
          </button>
        </div>
      </div>

      {/* ---------- hints / d-pad ---------- */}
      {coarse ? (
        <div className="mt-5 flex flex-col items-center gap-3">
          <DPad
            onDir={handleDirInput}
            onCenter={() => {
              const ph = phaseRef.current;
              if (ph === 'menu' || ph === 'over') start();
              else if (ph === 'playing' || ph === 'paused') togglePause();
            }}
            center={phase === 'playing' ? 'pause' : 'play'}
          />
          <p className="text-xs text-[#6f9484]">Swipe the board or use the pad</p>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[#8fb3a0]">
          <span className="flex items-center gap-1.5">
            <span className="keycap">↑ ↓ ← →</span>
            <span className="text-[#6f9484]">/</span>
            <span className="keycap">WASD</span> move
          </span>
          <span className="flex items-center gap-1.5">
            <span className="keycap">Space</span> pause
          </span>
          <span className="flex items-center gap-1.5">
            <span className="keycap">R</span> restart
          </span>
          <span className="flex items-center gap-1.5">
            <span className="keycap">1–3</span> speed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="keycap">M</span> sound
          </span>
        </div>
      )}

      <footer className="mt-6 text-center text-[11px] text-[#4f6f60]">
        {diff.blurb} · apples speed you up · high scores are kept per speed, right here in your browser
      </footer>
    </div>
  );
}
