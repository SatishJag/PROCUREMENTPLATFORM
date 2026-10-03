import type { Schedule } from '@satishjag/procurement-core/types';
import { Zoomable } from '../../ui/Zoomable';
import { useDesktop } from '../../ui/bits';

const DAY = 864e5;
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const minus = (n: number) => (n < 0 ? '−' : '') + Math.abs(n);
export const signed = minus;

const W = 840, H = 270, PAD = 100, STEP_Y = 80, RULER_Y = 202;

/**
 * The engine's milestones, drawn twice: as a sequence (top) and to scale in calendar time (bottom).
 * "Today" is the engine's own: float is measured from today to the first milestone, so today = first milestone minus float.
 * Semantic zoom: gaps appear at 100%, ruler dates at 160%.
 */
function Chart({ s, k }: { s: Schedule; k: number }) {
  const ms = s.milestones, n = ms.length;
  const t0 = Date.parse(ms[0].date), t1 = Date.parse(ms[n - 1].date), today = t0 - s.floatDays * DAY;
  const lo = Math.min(t0, today), hi = Math.max(t1, today);
  const rx = (t: number) => PAD + ((t - lo) / (hi - lo || 1)) * (W - 2 * PAD);
  const sx = (i: number) => PAD + (i * (W - 2 * PAD)) / (n - 1);
  const late = s.floatDays < 0;
  const todayIso = new Date(today).toISOString().slice(0, 10);
  const mono = { fontFamily: 'var(--font-code)' };
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Schedule with ${n} milestones, float ${minus(s.floatDays)} days`} className="block">
      <text x="8" y={STEP_Y + 4} className="fill-(--soft)" fontSize="11" letterSpacing="1.6">SEQUENCE</text>
      <text x="8" y={RULER_Y + 4} className="fill-(--soft)" fontSize="11" letterSpacing="1.6">TO SCALE</text>

      <line x1={sx(0)} x2={sx(n - 1)} y1={STEP_Y} y2={STEP_Y} stroke="var(--gold)" strokeOpacity=".55" />
      {ms.map((m, i) => {
        const x = sx(i), last = i === n - 1, first = i === 0;
        return (
          <g key={m.name}>
            {i > 0 && k >= 1 && <text x={(sx(i - 1) + x) / 2} y={STEP_Y - 10} textAnchor="middle" fontSize="13" className="fill-(--soft)">{`+${days(ms[i - 1].date, m.date)} d`}</text>}
            <path d={`M${x} ${STEP_Y + 9}C${x} ${(STEP_Y + RULER_Y) / 2 + 12} ${rx(Date.parse(m.date))} ${(STEP_Y + RULER_Y) / 2 - 12} ${rx(Date.parse(m.date))} ${RULER_Y - 5}`} fill="none" stroke="var(--gold)" strokeOpacity=".28" />
            <circle cx={x} cy={STEP_Y} r="8" className={last ? undefined : 'fill-stage'} fill={last ? 'var(--gold)' : undefined} stroke="var(--gold)" strokeWidth="1.5" />
            {first && late && <circle cx={x} cy={STEP_Y} r="12" fill="none" stroke="var(--bad)" strokeWidth="1.5" />}
            <text x={x} y={STEP_Y - 30} textAnchor="middle" fontSize="15" fontWeight="500" className="fill-(--fg)">{m.name}</text>
            <text x={x} y={STEP_Y + 32} textAnchor="middle" fontSize="13.5" className="fill-(--soft)" style={mono}>{m.date}</text>
            <circle cx={rx(Date.parse(m.date))} cy={RULER_Y} r="4" fill="var(--gold)" />
            {k >= 1.6 && <text x={rx(Date.parse(m.date))} y={RULER_Y + (i % 2 ? 40 : 24)} textAnchor="middle" fontSize="12" className="fill-(--soft)" style={mono}>{m.date}</text>}
          </g>
        );
      })}

      <line x1={rx(lo)} x2={rx(hi)} y1={RULER_Y} y2={RULER_Y} stroke="var(--gold)" strokeOpacity=".55" />
      {late && <line x1={rx(t0)} x2={rx(today)} y1={RULER_Y} y2={RULER_Y} stroke="var(--bad)" strokeWidth="4" strokeLinecap="round" />}
      <g>
        <line x1={rx(today)} x2={rx(today)} y1={RULER_Y - 26} y2={RULER_Y + 14} stroke={late ? 'var(--bad)' : 'var(--ok)'} strokeWidth="2" strokeDasharray="3 3" />
        <text x={rx(today)} y={RULER_Y - 32} textAnchor="middle" fontSize="13" fontWeight="600" fill={late ? 'var(--bad)' : 'var(--ok)'}>Today</text>
        <text x={rx(today)} y={H - 6} textAnchor="middle" fontSize="12" className="fill-(--soft)" style={mono}>{todayIso}</text>
      </g>
    </svg>
  );
}

/** Desktop: a zoomable night canvas. Mobile: a vertical list (a 960px canvas fitted to 350px is unreadable; pinch still works on desktop-sized tablets). */
export function Timeline({ s }: { s: Schedule }) {
  const desktop = useDesktop();
  const list = (
    <ol aria-label="Milestones" className={desktop ? 'sr-only' : 'grid'}>
      {s.milestones.map((m, i) => (
        <li key={m.name} className="grid grid-cols-[6.5rem_1fr] items-baseline gap-3 border-b border-(--hair) py-2.5 last:border-0">
          <span className="font-code text-label">{m.date}</span>
          <span className="flex items-baseline justify-between gap-2"><span className="font-medium">{m.name}</span><span className="soft">{i ? `+${days(s.milestones[i - 1].date, m.date)} d` : s.floatDays < 0 ? `${minus(s.floatDays)} d float` : `${s.floatDays} d from today`}</span></span>
        </li>
      ))}
    </ol>
  );
  if (!desktop) return list;
  return (
    <>
      <Zoomable label="Delivery schedule" min={0.5} max={3} className="!min-h-[17rem]">{k => <Chart s={s} k={k} />}</Zoomable>
      {list}
    </>
  );
}
