import { useRef, type PointerEvent } from 'react';
import { Money, Num } from '../../ui/Money';
import type { Dash } from './Dashboard';
import type { Pkg } from './register';

/** Solid bar: the fill grows by transform from the left. */
export function Bar({ label, value, max, tone }: { label?: string; value: number; max: number; tone: string }) {
  const r = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div className="grid gap-1.5">
      {label && <span className="flex items-baseline justify-between"><span className="soft">{label}</span><Money value={value} className="font-medium" /></span>}
      <div role="img" aria-label={`${Math.round(r * 100)} percent`} className="h-2 overflow-hidden rounded-full bg-primary-soft">
        <div className={`grow-x h-full origin-left rounded-full ${tone}`} style={{ transform: `scaleX(${r})` }} />
      </div>
    </div>
  );
}

/** Gold hairline gauge: the hairline is the whole budget, the heavier gold stroke is what is committed. Reads the surface context. */
export function Gauge({ value, max, label }: { value: number; max: number; label: string }) {
  const r = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div role="img" aria-label={`${label}: ${Math.round(r * 100)} percent committed`} className="relative h-4">
      <div className="absolute inset-x-0 top-1/2 h-px bg-(--gold) opacity-40" />
      <div className="absolute right-0 top-0.5 h-3 w-px bg-(--gold) opacity-60" />
      <div className="grow-x absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 origin-left rounded-full bg-(--gold)" style={{ transform: `translateY(-50%) scaleX(${r})` }} />
    </div>
  );
}

const stages = [["Planned", "var(--color-peri)"], ["Sourcing", "var(--color-primary)"], ["Awarded", "var(--color-award)"]] as const;

/** Funnel: each level is how many packages reached that stage or beyond. */
export function Funnel({ planned, sourcing, awarded, bare }: Dash['pipeline'] & { bare?: boolean }) {
  const counts = [planned, sourcing, awarded];
  const reach = [planned + sourcing + awarded, sourcing + awarded, awarded];
  const w = (n: number) => Math.max((n / (reach[0] || 1)) * 220, 16);
  const levels = [...reach.map(w), w(reach[2]) * 0.6];
  return (
    <div className="grid gap-4">
      {!bare && <svg viewBox="0 0 240 128" role="img" aria-label={`${planned} planned, ${sourcing} in sourcing, ${awarded} awarded`} className="w-full">
        {stages.map(([name, fill], i) => {
          const [a, b, y] = [levels[i] / 2, levels[i + 1] / 2, i * 43 + 2];
          return <polygon key={name} className="rise" style={{ ['--i' as string]: i + 2 }} fill={fill} points={`${120 - a},${y} ${120 + a},${y} ${120 + b},${y + 40} ${120 - b},${y + 40}`} />;
        })}
      </svg>}
      <ul className="grid gap-2">
        {stages.map(([name, fill], i) => (
          <li key={name} className="flex items-baseline gap-3 border-b border-(--hair) pb-2 last:border-0">
            <span aria-hidden className="size-2 translate-y-[-1px] rounded-full" style={{ background: fill }} />
            <span className="soft flex-1">{name}</span>
            <Num value={counts[i]} animate className="numeral text-[1.625rem] leading-none" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Float in days: the fill is this package's share of the worst float shown. Red is late, green has float. */
export function FloatBar({ days, worst }: { days: number; worst: number }) {
  const r = worst > 0 ? Math.min(Math.abs(days) / worst, 1) : 0;
  return (
    <div role="img" aria-label={`${days} days float`} className="relative h-1.5 rounded-full bg-primary-soft">
      <div className={`grow-x absolute inset-0 origin-left rounded-full ${days < 0 ? 'bg-danger' : 'bg-success'}`} style={{ transform: `scaleX(${r})` }} />
    </div>
  );
}
export const minus = (n: number) => (n < 0 ? '−' : '') + Math.abs(n);

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const rest = 'rotateX(8deg) rotateY(-14deg)';

/** Header visual: budget gauges on tilted glass, with a second pane behind for depth. Leans toward the pointer. */
export function GlassBudget({ d }: { d: Dash }) {
  const tilt = useRef<HTMLDivElement>(null);
  const lean = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced() || !tilt.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const [x, y] = [(e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5];
    tilt.current.style.transform = `rotateX(${8 - y * 10}deg) rotateY(${-14 + x * 14}deg)`;
  };
  const top = [...d.budget].sort((a, b) => b.budget - a.budget).slice(0, 4);
  return (
    <div aria-hidden className="h-72 [perspective:1200px]" onPointerMove={lean} onPointerLeave={() => tilt.current && (tilt.current.style.transform = rest)}>
      <div ref={tilt} className="relative h-full transition-transform duration-500 ease-out [transform-style:preserve-3d]" style={{ transform: rest }}>
        <div className="glass feature absolute inset-x-8 top-0 h-56 [transform:translateZ(-60px)_translate(30px,-12px)]" />
        <div className="glass feature absolute inset-x-0 bottom-0 grid gap-4 p-5 [transform:translateZ(30px)]">
          <div className="flex items-baseline justify-between"><span className="eyebrow">Budget committed</span><span className="eyebrow !text-(--gold)">DC1</span></div>
          {top.map(b => (
            <div key={b.costCode} className="grid gap-1">
              <div className="flex justify-between"><span className="font-code text-label">{b.costCode}</span><span className="soft text-label"><Money value={b.committed} /> of <Money value={b.budget} /></span></div>
              <Gauge value={b.committed} max={b.budget} label={b.costCode} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const DAY = 86400000;
const t = (d: string) => Date.parse(d);
const month = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Delivery timeline: every open package is a lane that runs to its need-by date. Detail grows with the zoom scale (semantic zoom). */
export function Timeline({ pkgs, atRisk, k }: { pkgs: Pkg[]; atRisk: Dash['atRisk']; k: number }) {
  const rows = [...pkgs].sort((a, b) => t(a.needBy) - t(b.needBy));
  const [t0, t1] = [t(rows[0].needBy) - 60 * DAY, t(rows[rows.length - 1].needBy) + 30 * DAY];
  const [W, X0, X1, H] = [1000, 56, 940, 92];
  const x = (ms: number) => X0 + ((ms - t0) / (t1 - t0)) * (X1 - X0);
  const ticks: number[] = [], s0 = new Date(t0);
  for (let m = s0.getUTCMonth() + 1; Date.UTC(s0.getUTCFullYear(), m, 1) < t1; m++) ticks.push(Date.UTC(s0.getUTCFullYear(), m, 1));
  const quarter = (m: number) => new Date(m).getUTCMonth() % 3 === 0;
  return (
    <div className="relative" style={{ width: W, height: rows.length * H + 56 }}>
      {ticks.map(m => (
        <div key={m} className="absolute top-0 bottom-0 border-l border-dashed border-(--hair)" style={{ left: x(m) }}>
          {quarter(m) && <span className="eyebrow absolute left-2 top-3 whitespace-nowrap">{month.format(m)}</span>}
        </div>
      ))}
      {rows.map((p, i) => {
        const r = atRisk.find(a => a.id === p.id), px = x(t(p.needBy)), left = px > 620, color = p.status === 'awarded' ? 'var(--gold)' : r ? 'var(--bad)' : 'var(--fg)';
        return (
          <div key={p.id} className="absolute inset-x-0" style={{ top: 48 + i * H, height: H }}>
            <div className="absolute top-8 h-px" style={{ left: X0, width: px - X0, backgroundImage: `linear-gradient(90deg, transparent, ${color})`, opacity: 0.7 }} />
            <span className="absolute top-8 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-(--hair)" style={{ left: px, background: color }} />
            <div className={`absolute top-1 grid w-60 gap-0.5 ${left ? 'text-right' : ''}`} style={left ? { right: W - px + 14 } : { left: px + 14 }}>
              <span className="font-code text-label">{p.id}<span className="soft"> · {p.needBy}</span></span>
              {k >= 0.9 && <span className="font-medium leading-snug">{p.title}</span>}
              {k >= 1.5 && <span className="soft"><Money value={p.estimate} />{r ? ` · float ${minus(r.floatDays)} days` : ''}</span>}
              {k >= 1.5 && <span className="soft">Next: {p.next || 'none'}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
