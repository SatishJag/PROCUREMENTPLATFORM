import { useState } from 'react';
import { Zoomable } from '../../ui/Zoomable';
import { Ic } from './bits';
import { aed } from './fixtures';
import { columns, edgeLabel, kindLabel, limitOf, resolve, role } from './logic';
import type { Stage, Workflow } from './fixtures';

const W = 208, H = 152, GX = 112, GY = 28, PAD = 28, D = 40; // node, column gap, row gap, padding, start/end disc

/** Level of detail from the live zoom scale: the same node shows more as you zoom in. */
const level = (k: number) => (k < 0.8 ? 0 : k < 1.4 ? 1 : 2);

/** What a stage node says, by level. Shared by the canvas node and the mobile stage card. */
export function StageBody({ s, wf, lv, step }: { s: Stage; wf: Workflow; lv: number; step?: number }) {
  const lim = limitOf(s), a = resolve(s.approver), chip = 'inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-label text-on-night-soft';
  return (
    <>
      <span className="flex items-start gap-2">
        {step != null && <span aria-label={`Step ${step}`} className="grid size-6 shrink-0 place-items-center rounded-full bg-gold text-label font-semibold text-night">{step}</span>}
        <span className={`font-semibold leading-tight tracking-[-0.005em] ${lv === 0 ? 'text-[1.2rem]' : 'text-[0.95rem]'}`}>{s.name}</span>
      </span>
      <span className={`block truncate text-on-night-soft ${lv === 0 ? 'text-[0.95rem]' : 'text-body'}`}>{kindLabel(s.approver.kind)}: {a.label || <b className="font-semibold text-(--bad)">none chosen</b>}</span>
      {lv >= 1 && (
        <span className="flex flex-wrap gap-1">
          {s.slaHours > 0 && <span className={chip}><Ic n="clock" className="size-3" />{s.slaHours}h SLA</span>}
          {s.escalateTo && <span className={chip}><Ic n="up" className="size-3" />{role(s.escalateTo)?.label} after {s.escalateAfter}h</span>}
          {lim != null && wf.kind === 'approval' && <span className={chip}>Limit {aed(lim)}</span>}
          {s.quorum === 'all' && <span className={chip}><Ic n="users" className="size-3" />All approve</span>}
          {s.badges.map(b => <span key={b} className={chip}>{b}</span>)}
        </span>
      )}
      {lv >= 2 && (
        <span className="flex flex-wrap gap-1">
          {s.forms.length > 0 && <span className={chip}><Ic n="file" className="size-3" />{s.forms.length} document{s.forms.length > 1 ? 's' : ''}</span>}
          {s.fields.length > 0 && <span className={chip}>{s.fields.length} field{s.fields.length > 1 ? 's' : ''}</span>}
          {s.validations.length > 0 && <span className={chip}>{s.validations.length} check{s.validations.length > 1 ? 's' : ''}</span>}
          {(s.email || s.inApp) && <span className={chip}><Ic n="bell" className="size-3" />{[s.email && 'Email', s.inApp && 'In-app'].filter(Boolean).join(' and ')}</span>}
        </span>
      )}
    </>
  );
}

type Props = { wf: Workflow; sel: string; onSel: (id: string) => void; route: Set<string> | null };

export function Canvas({ wf, sel, onSel, route }: Props) {
  const [k, setK] = useState(1), lv = level(k);
  const cols = columns(wf), tall = Math.max(1, ...cols.map(c => c.length)), height = PAD * 2 + 22 + tall * H + (tall - 1) * GY, mid = height / 2 + 11;
  const colX = (j: number) => PAD + D + GX + j * (W + GX), endX = colX(cols.length) - 0;
  const pos = new Map<string, { x: number; y: number }>();
  cols.forEach((c, j) => c.forEach((s, i) => pos.set(s.id, { x: colX(j), y: mid - (c.length * H + (c.length - 1) * GY) / 2 + i * (H + GY) })));
  const width = endX + D + PAD, sig = wf.stages.map(s => s.id + s.parallelWithPrev).join();
  const live = (id: string) => !route || route.has(id);
  const steps = new Map<string, number>(); let n = 0;
  if (route) cols.forEach(c => { const hit = c.filter(s => route.has(s.id)); if (hit.length) { n++; hit.forEach(s => steps.set(s.id, n)); } });

  // Edges: disc to first column, column to next column (all pairs), last column to the end disc. A route that skips a column gets a bypass edge.
  type E = { x1: number; y1: number; x2: number; y2: number; to?: string; on: boolean; cond: boolean };
  const edges: E[] = [], sx = PAD + D, ex = endX;
  const lastLive = (j: number) => { for (let i = j; i >= 0; i--) if (cols[i].some(s => live(s.id))) return i; return -1; };
  const link = (from: { x: number; y: number; id?: string }[] | null, j: number) => {
    const tos = j < cols.length ? cols[j].map(s => ({ ...pos.get(s.id)!, id: s.id })) : [{ x: ex, y: mid - H / 2, id: undefined }];
    const srcs: { x: number; y: number; id?: string }[] = from ?? [{ x: sx - W, y: mid - H / 2 }];
    for (const t of tos) for (const f of srcs) edges.push({ x1: from ? f.x + W : sx, y1: f.y + H / 2, x2: t.x, y2: t.y + H / 2, to: t.id, on: !route || ((f.id ? route.has(f.id) : true) && (t.id ? route.has(t.id) : true)), cond: !!(t.id && edgeLabel(wf, t.id)) });
  };
  for (let j = 0; j <= cols.length; j++) link(j ? cols[j - 1].map(s => ({ ...pos.get(s.id)!, id: s.id })) : null, j);
  const pills = cols.flat().map(s => ({ s, label: edgeLabel(wf, s.id), ...pos.get(s.id)! }));
  const bypass = route ? cols.flatMap((c, j) => { const p = lastLive(j - 1); return c.some(s => route.has(s.id)) && p < j - 1 && p >= 0 ? [{ p, j }] : []; }) : [];

  const body = (
    <div className="relative" style={{ width, height }}>
      <svg width={width} height={height} className="pointer-events-none absolute inset-0" aria-hidden>
        <defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0l8 4-8 4z" fill="currentColor" /></marker></defs>
        {edges.map((e, i) => {
          const dx = (e.x2 - e.x1) * 0.5;
          return <path key={i} d={`M${e.x1} ${e.y1}C${e.x1 + dx} ${e.y1} ${e.x2 - dx} ${e.y2} ${e.x2 - 2} ${e.y2}`} fill="none" markerEnd="url(#ah)" strokeWidth={route && e.on ? 2.5 : 1.5} strokeDasharray={e.cond ? '5 5' : undefined} className={route && e.on ? 'text-gold' : 'text-on-night-soft'} stroke="currentColor" opacity={route && !e.on ? 0.25 : route ? 1 : 0.6} />;
        })}
        {bypass.map(b => <path key={b.j} d={`M${colX(b.p) + W} ${mid}H${colX(b.j) - 2}`} stroke="currentColor" strokeWidth="2.5" strokeDasharray="2 6" strokeLinecap="round" className="text-gold" fill="none" />)}
      </svg>
      {[[PAD, 'Request'], [ex, 'Approved']].map(([x, t]) => (
        <span key={t} className="absolute grid place-items-center gap-1 text-center" style={{ left: x as number, top: mid - D / 2, width: D }}>
          <span aria-hidden className="size-10 rounded-full border border-gold/70 bg-night-raised shadow-[0_0_24px_rgb(212_180_106/0.2)]"><Ic n={t === 'Request' ? 'branch' : 'check'} className="m-2.5 size-5 text-gold" /></span>
          <span className="eyebrow whitespace-nowrap">{t}</span>
        </span>
      ))}
      {cols.map((c, j) => c.length > 1 && (
        <span key={j} className="eyebrow absolute whitespace-nowrap !text-(--gold)" style={{ left: colX(j), top: pos.get(c[0].id)!.y - 22 }}>
          {wf.kind === 'route' ? 'Choose one route' : c.some(s => s.quorum === 'all') ? 'Parallel, all must approve' : 'Parallel, any one approves'}
        </span>
      ))}
      {pills.filter(p => p.label).map(p => (
        <span key={p.s.id} className={`absolute max-w-[7.75rem] -translate-x-1/2 -translate-y-1/2 rounded-full border bg-night-deep px-2.5 py-1 text-center text-[0.6875rem] leading-tight transition-opacity ${live(p.s.id) ? 'border-gold/60 text-on-night' : 'border-white/10 text-on-night-soft opacity-40'}`} style={{ left: p.x - GX / 2, top: p.y + H / 2 }}>{p.label}</span>
      ))}
      {cols.flat().map(s => {
        const p = pos.get(s.id)!, on = live(s.id), picked = s.id === sel;
        return (
          <button key={s.id} type="button" aria-pressed={picked} aria-label={`${s.name}, ${resolve(s.approver).label || 'no approver'}`} onClick={() => onSel(s.id)} style={{ left: p.x, top: p.y, width: W, height: H }}
            className={`absolute grid content-start gap-2 overflow-hidden rounded-card border p-3 text-left transition-[transform,opacity] duration-300 hover:-translate-y-0.5 active:scale-[0.98] ${picked ? 'border-accent bg-night-raised shadow-[0_0_0_2px_rgb(245_184_0/0.55),0_18px_40px_rgb(6_5_30/0.5)]' : route && on ? 'border-gold bg-night-raised shadow-[0_0_0_1px_rgb(212_180_106/0.6),0_0_36px_rgb(212_180_106/0.22)]' : 'border-white/15 bg-gradient-to-b from-night-raised to-night shadow-[0_14px_30px_rgb(6_5_30/0.45)] hover:border-gold/60'} ${route && !on ? 'opacity-45' : ''}`}>
            <StageBody s={s} wf={wf} lv={lv} step={steps.get(s.id)} />
          </button>
        );
      })}
    </div>
  );
  return (
    <Zoomable key={sig} label={`${wf.name} flow`} min={0.3} max={2.4} onScale={setK} className="h-[28rem] bg-gradient-to-b from-night to-night-deep">
      {body}
    </Zoomable>
  );
}

