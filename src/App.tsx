import SnakeGame from './components/SnakeGame';

const FLIES = [
  { top: '16%', left: '10%', s: 5, c: '#ffc964', d: '7s', delay: '0s' },
  { top: '28%', left: '86%', s: 4, c: '#7ef0a6', d: '9s', delay: '-2s' },
  { top: '64%', left: '6%', s: 4, c: '#7ef0a6', d: '8s', delay: '-4s' },
  { top: '78%', left: '90%', s: 6, c: '#ffc964', d: '10s', delay: '-1s' },
  { top: '12%', left: '58%', s: 3, c: '#ff8a70', d: '11s', delay: '-6s' },
  { top: '88%', left: '38%', s: 4, c: '#ffc964', d: '9.5s', delay: '-3s' },
  { top: '44%', left: '94%', s: 3, c: '#7ef0a6', d: '8.5s', delay: '-5s' },
  { top: '52%', left: '3%', s: 5, c: '#ff8a70', d: '12s', delay: '-7s' },
];

export default function App() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#0a1712]">
      {/* ambient layered background */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div className="bg-grid-anim absolute inset-0" />
        <div className="absolute -top-44 -left-44 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(126,240,166,0.1),transparent_65%)]" />
        <div className="absolute -right-52 -bottom-52 h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(circle,rgba(255,201,100,0.08),transparent_65%)]" />
        <div className="absolute top-1/3 right-1/4 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(255,107,82,0.055),transparent_70%)]" />
        {FLIES.map((f, i) => (
          <span
            key={i}
            className="firefly"
            style={{
              top: f.top,
              left: f.left,
              width: f.s,
              height: f.s,
              backgroundColor: f.c,
              boxShadow: `0 0 ${f.s * 2.5}px ${f.c}`,
              animationDuration: f.d,
              animationDelay: f.delay,
              opacity: 0.55,
            }}
          />
        ))}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_52%,rgba(4,10,7,0.72))]" />
      </div>

      <SnakeGame />
    </div>
  );
}
