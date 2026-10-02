import { useState, type CSSProperties } from 'react';
import { Zoomable } from '../../ui/Zoomable';
import { Ic } from './bits';
import { aed } from './fixtures';
import { columns, edgeLabel, kindLabel, limitOf, resolve, role } from './logic';
import type { Stage, Workflow } from './fixtures';

const H = 128, GAP0 = 68, GX = 24, PAD = 24, PH = 30; // node height, vertical gap between steps, gap between parallel nodes, padding, start/end pill height

/** Level of detail from the live zoom scale: the same node shows more as you zoom in. */
const level = (k: number) => (k < 0.6 ? 0 : k < 1.2 ? 1 : 2);

/** What a stage node says, by level. Shared by the canvas node and the mobile stage card. */
export function StageBody({ s, wf, lv, step, tag }: { s: Stage; wf: Workflow; lv: number; step?: number; tag?: string }) {
  const lim = limitOf(s), a = resolve(s.approver), chip = 'inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-label text-on-night-soft';
  return (
    <>
      {tag && <span className="eyebrow !text-(--gold) !leading-none">{tag}</span>}
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

/** Top-to-bottom flow: one row per step, parallel stages side by side, conditions on the connectors. */
export function Canvas({ wf, sel, onSel, route }: Props) {
  const [k, setK] = useState(1), lv = level(k);
  const rows = columns(wf), wide = Math.max(1, ...rows.map(r => r.length)), W = wide > 2 ? 196 : 320, GAP = wide > 2 ? 100 : GAP0;
  const width = PAD * 2 + wide * W + (wide - 1) * GX, cx = width / 2;
  const rowY = (j: number) => PAD + PH + GAP + j * (H + GAP), endY = rowY(rows.length), height = endY + PH + PAD;
  const pos = new Map<string, { x: number; y: number }>();
  rows.forEach((r, j) => r.forEach((s, i) => pos.set(s.id, { x: cx - (r.length * W + (r.length - 1) * GX) / 2 + i * (W + GX), y: rowY(j) })));
  const live = (id: string) => !route || route.has(id), sig = wf.stages.map(s => s.id + s.parallelWithPrev).join();
  const steps = new Map<string, number>(); let n = 0;
  if (route) rows.forEach(r => { const hit = r.filter(s => route.has(s.id)); if (hit.length) { n++; hit.forEach(s => steps.set(s.id, n)); } });

  // Connectors: start to the first row, row to next row (all pairs), last row to the end. A route that skips a row gets a dotted bypass.
  type P = { x: number; y: number; id?: string };
  type E = { a: P; b: P; on: boolean; cond: boolean };
  const edges: E[] = [], at = (id: string): P => ({ ...pos.get(id)!, id });
  const start: P = { x: cx - W / 2, y: PAD - H + PH }, end: P = { x: cx - W / 2, y: endY };
  for (let j = 0; j <= rows.length; j++) {
    const from = j ? rows[j - 1].map(s => at(s.id)) : [start], to = j < rows.length ? rows[j].map(s => at(s.id)) : [end];
    for (const b of to) for (const a of from) edges.push({ a, b, on: !route || ((a.id ? route.has(a.id) : true) && (b.id ? route.has(b.id) : true)), cond: !!(b.id && edgeLabel(wf, b.id)) });
  }
  const lastLive = (j: number) => { for (let i = j; i >= 0; i--) if (rows[i].some(s => live(s.id))) return i; return -1; };
  const bypass = route ? rows.flatMap((r, j) => { const p = lastLive(j - 1); return r.some(s => route.has(s.id)) && p >= 0 && p < j - 1 ? [{ p, j }] : []; }) : [];
  const pills = rows.flat().map(s => ({ s, label: edgeLabel(wf, s.id), ...pos.get(s.id)! })).filter(p => p.label);

  return (
    <div style={{ '--ch': `${Math.max(320, Math.min(height + 8, 880))}px` } as CSSProperties}>
    <Zoomable key={sig} label={`${wf.name} flow`} min={0.3} max={2.4} onScale={setK} className="h-(--ch) bg-gradient-to-b from-night to-night-deep">
      <div className="relative" style={{ width, height }}>
        <svg width={width} height={height} className="pointer-events-none absolute inset-0" aria-hidden>
          <defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0l8 4-8 4z" fill="currentColor" /></marker></defs>
          {edges.map((e, i) => {
            const x1 = e.a.x + W / 2, y1 = e.a.y + H, x2 = e.b.x + W / 2, dy = (e.b.y - y1) * 0.5;
            return <path key={i} d={`M${x1} ${y1}C${x1} ${y1 + dy} ${x2} ${e.b.y - dy} ${x2} ${e.b.y - 3}`} fill="none" markerEnd="url(#ah)" stroke="currentColor" strokeWidth={route && e.on ? 2.5 : 1.5} strokeDasharray={e.cond ? '5 5' : undefined} className={route && e.on ? 'text-gold' : 'text-on-night-soft'} opacity={route ? (e.on ? 1 : 0.25) : 0.6} />;
          })}
          {bypass.map(b => <path key={b.j} d={`M${cx - W / 2 - 14} ${rowY(b.p) + H}V${rowY(b.j)}`} stroke="currentColor" strokeWidth="2.5" strokeDasharray="2 6" strokeLinecap="round" className="text-gold" fill="none" />)}
        </svg>
        {([[PAD, 'Request submitted', 'branch'], [endY, 'Approved', 'check']] as const).map(([y, t, ic]) => (
          <span key={t} className="eyebrow absolute flex items-center gap-2 whitespace-nowrap rounded-full border border-gold/60 bg-night-raised px-3 !text-on-night" style={{ left: cx, top: y, height: PH, transform: 'translateX(-50%)' }}><Ic n={ic} className="size-3.5 text-gold" />{t}</span>
        ))}
        {pills.map(p => (
          <span key={p.s.id} className={`absolute max-w-[21rem] -translate-x-1/2 -translate-y-1/2 rounded-full border bg-night-deep px-3 py-1 text-center text-label leading-tight transition-opacity ${live(p.s.id) ? 'border-gold/60 text-on-night' : 'border-white/10 text-on-night-soft opacity-40'}`} style={{ left: p.x + W / 2, top: p.y - GAP / 2, maxWidth: wide > 2 ? W : undefined }}>{p.label}</span>
        ))}
        {rows.flatMap(r => r.map(s => {
          const p = pos.get(s.id)!, on = live(s.id), picked = s.id === sel;
          const tag = r.length > 1 ? (wf.kind === 'route' ? 'Choose one route' : s.quorum === 'all' || r.some(x => x.quorum === 'all') ? 'Parallel, all approve' : 'Parallel, any one') : undefined;
          return (
            <button key={s.id} type="button" aria-pressed={picked} aria-label={`${s.name}, ${resolve(s.approver).label || 'no approver'}`} onClick={() => onSel(s.id)} style={{ left: p.x, top: p.y, width: W, height: H }}
              className={`absolute grid content-start gap-1.5 overflow-hidden rounded-card border p-3 text-left transition-[transform,opacity] duration-300 hover:-translate-y-0.5 active:scale-[0.98] ${picked ? 'border-accent bg-night-raised shadow-[0_0_0_2px_rgb(245_184_0/0.55),0_18px_40px_rgb(6_5_30/0.5)]' : route && on ? 'border-gold bg-night-raised shadow-[0_0_0_1px_rgb(212_180_106/0.6),0_0_36px_rgb(212_180_106/0.22)]' : 'border-white/15 bg-gradient-to-b from-night-raised to-night shadow-[0_14px_30px_rgb(6_5_30/0.45)] hover:border-gold/60'} ${route && !on ? 'opacity-45' : ''}`}>
              <StageBody s={s} wf={wf} lv={lv} step={steps.get(s.id)} tag={tag} />
            </button>
          );
        }))}
      </div>
    </Zoomable>
    </div>
  );
}
