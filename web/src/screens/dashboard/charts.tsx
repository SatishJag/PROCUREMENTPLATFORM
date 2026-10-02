import { useRef, type PointerEvent } from 'react';
import { Money, Num } from '../../ui/Money';
import type { Dash } from './Dashboard';

/** Score bar: fill grows by transform from the left. */
export function Bar({ label, value, max, tone }: { label?: string; value: number; max: number; tone: string }) {
  const r = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div className="grid gap-1">
      {label && <span className="flex justify-between"><span>{label}</span><Money value={value} className="font-semibold" /></span>}
      <div role="img" aria-label={`${Math.round(r * 100)} percent`} className="h-2.5 overflow-hidden rounded-full bg-primary-soft">
        <div className={`grow-x h-full origin-left rounded-full ${tone}`} style={{ transform: `scaleX(${r})` }} />
      </div>
    </div>
  );
}

const stages = [['Planned', 'var(--color-peri)'], ['Sourcing', 'var(--color-primary)'], ['Awarded', 'var(--color-accent)']] as const;

/** Funnel: each level is how many packages reached that stage or beyond. */
export function Funnel({ planned, sourcing, awarded }: Dash['pipeline']) {
  const counts = [planned, sourcing, awarded];
  const reach = [planned + sourcing + awarded, sourcing + awarded, awarded];
  const w = (n: number) => Math.max((n / (reach[0] || 1)) * 220, 16);
  const levels = [...reach.map(w), w(reach[2]) * 0.6];
  return (
    <div className="grid gap-4">
      <svg viewBox="0 0 240 128" role="img" aria-label={`${planned} planned, ${sourcing} in sourcing, ${awarded} awarded`} className="w-full">
        {stages.map(([name, fill], i) => {
          const [a, b, y] = [levels[i] / 2, levels[i + 1] / 2, i * 43 + 2];
          return <polygon key={name} className="rise" style={{ ['--i' as string]: i + 2 }} fill={fill} points={`${120 - a},${y} ${120 + a},${y} ${120 + b},${y + 40} ${120 - b},${y + 40}`} />;
        })}
      </svg>
      <ul className="grid gap-1">
        {stages.map(([name, fill], i) => (
          <li key={name} className="flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-sm" style={{ background: fill }} />
            <span className="flex-1">{name}</span>
            <Num value={counts[i]} animate className="font-semibold" />
          </li>
        ))}
      </ul>
    </div>
  );
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const rest = 'rotateX(9deg) rotateY(-15deg)';

/** Tilted two-layer preview of the award view, built from the same dashboard data. Leans toward the pointer. */
export function Preview({ d }: { d: Dash }) {
  const tilt = useRef<HTMLDivElement>(null);
  const lean = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced() || !tilt.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const [x, y] = [(e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5];
    tilt.current.style.transform = `rotateX(${9 - y * 12}deg) rotateY(${-15 + x * 16}deg)`;
  };
  const top = [...d.budget].sort((a, b) => b.committed - a.committed).slice(0, 3);
  return (
    <div aria-hidden className="h-64 [perspective:1100px]" onPointerMove={lean} onPointerLeave={() => tilt.current && (tilt.current.style.transform = rest)}>
      <div ref={tilt} className="relative h-full transition-transform duration-300 ease-out [transform-style:preserve-3d]" style={{ transform: rest }}>
        <div className="absolute inset-x-6 top-0 grid gap-3 rounded-card border border-white/25 bg-white/10 p-4 backdrop-blur-md [transform:translateZ(-50px)_translate(34px,-14px)]">
          <span className="font-semibold text-on-hero-soft">Budget committed</span>
          {top.map(b => (
            <div key={b.costCode} className="flex items-center gap-3">
              <span className="font-code w-20 text-on-hero-soft">{b.costCode}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/20"><div className="h-full origin-left rounded-full bg-accent" style={{ transform: `scaleX(${b.committed / b.budget})` }} /></div>
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 grid gap-3 rounded-card bg-card p-5 text-ink shadow-e3 [transform:translateZ(40px)]">
          <span className="font-semibold">Latest award</span>
          <Bar value={d.savings.baseline} max={d.savings.baseline} tone="bg-peri" />
          <Bar value={d.savings.awarded} max={d.savings.baseline} tone="bg-primary" />
          <span className="flex justify-between"><span className="text-ink-soft">Saved</span><Money value={d.savings.saved} className="text-section font-semibold text-success" /></span>
        </div>
      </div>
    </div>
  );
}
