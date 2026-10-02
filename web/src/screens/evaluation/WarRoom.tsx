import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { call } from '../../api';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Field, control } from '../../ui/Field';
import { useDesktop } from '../../ui/bits';
import { FocusCard } from '../../ui/FocusCard';
import { Money } from '../../ui/Money';
import { Section } from '../../ui/Section';
import { StatusChip } from '../../ui/StatusChip';
import { Table } from '../../ui/Table';
import { Zoomable } from '../../ui/Zoomable';
import { BidderDetail, ExclusionForm, exclusionsOf, idxOf, rankOf, techOf, TileFace, whyNot, type Ctx } from './Bidder';
import { Insight } from './Insight';
import { aliasAt, mil, n2, NIGHT, SERIES, short, weighting, type Scenario } from './lib';
import { Badge, DarkSelect, Reason } from './parts';

const Panel = ({ i, title, note, children, className = '' }: { i: number; title: string; note?: string; children: React.ReactNode; className?: string }) => (
  <Card glass i={i} className={`grid content-start gap-4 ${className}`}>
    <header className="grid gap-1"><h2 className="text-section font-semibold">{title}</h2>{note && <p className="soft">{note}</p>}</header>
    {children}
  </Card>
);

// ---------- Value map: technical score against normalised price, on a pan-and-zoom canvas ----------
const W = 860, H = 430, L = 84, R = 40, T = 30, B = 56;
function ValueMap({ c, sel, onSel }: { c: Ctx; sel: string; onSel: (id: string) => void }) {
  const pts = c.r.normalized.map((n, i) => ({ n, i, t: techOf(c, n.supplierId)?.score ?? 0, rk: rankOf(c, n.supplierId) }));
  const xs = pts.map(p => p.t), ys = pts.map(p => p.n.total);
  const x0 = Math.floor((Math.min(...xs) - 8) / 10) * 10, x1 = Math.min(100, Math.ceil((Math.max(...xs) + 4) / 10) * 10);
  const lo = Math.min(...ys), hi = Math.max(...ys), pad = (hi - lo || lo * 0.1) * 0.25, y0 = lo - pad, y1 = hi + pad;
  const px = (t: number) => L + ((t - x0) / (x1 - x0)) * (W - L - R), py = (v: number) => T + ((v - y0) / (y1 - y0)) * (H - T - B);
  const xt = Array.from({ length: (x1 - x0) / 10 + 1 }, (_, k) => x0 + k * 10), yt = [0, 1, 2, 3].map(k => y0 + ((y1 - y0) * k) / 3);
  const lead = c.r.ranking[0]?.supplierId;
  return (
    <Zoomable label="Value map of bidders" min={0.5} max={3} className="h-[27rem]">
      {k => (
        <div className="relative" style={{ width: W, height: H }}>
          <svg width={W} height={H} aria-hidden className="absolute inset-0">
            <defs><radialGradient id="vm-glow" cx="100%" cy="0%" r="90%"><stop offset="0" stopColor="#d4b46a" stopOpacity="0.2" /><stop offset="1" stopColor="#d4b46a" stopOpacity="0" /></radialGradient></defs>
            <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="url(#vm-glow)" />
            {xt.map(t => <g key={t}><line x1={px(t)} x2={px(t)} y1={T} y2={H - B} stroke="#fff" strokeOpacity="0.1" /><text x={px(t)} y={H - B + 22} textAnchor="middle" fill="#b4b3d9" fontSize="12" className="font-code">{t}</text></g>)}
            {yt.map(v => <g key={v}><line x1={L} x2={W - R} y1={py(v)} y2={py(v)} stroke="#fff" strokeOpacity="0.1" /><text x={L - 12} y={py(v) + 4} textAnchor="end" fill="#b4b3d9" fontSize="12" className="font-code">{(v / 1e6).toFixed(1)}</text></g>)}
            <text x={(L + W - R) / 2} y={H - 10} textAnchor="middle" fill="#b4b3d9" fontSize="12" letterSpacing="1.6">TECHNICAL SCORE</text>
            <text transform={`translate(18 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" fill="#b4b3d9" fontSize="12" letterSpacing="1.6">NORMALISED PRICE, AED M (CHEAPER IS HIGHER)</text>
            <text x={W - R - 8} y={T + 20} textAnchor="end" fill="#d4b46a" fontSize="12" letterSpacing="1.6">STRONGER AND CHEAPER</text>
          </svg>
          {pts.map(p => {
            const x = px(p.t), y = py(p.n.total), right = x < W - 260, on = sel === p.n.supplierId;
            return (
              <div key={p.n.supplierId}>
                <button type="button" onClick={() => onSel(p.n.supplierId)} aria-pressed={on} aria-label={`${aliasAt(p.i)}, ${c.names(p.n.supplierId)}: technical ${n2(p.t)}, AED ${mil(p.n.total)}, ${p.rk ? 'ranked' : 'not ranked'}`}
                  className={`absolute grid size-11 place-items-center rounded-full text-body font-semibold transition-transform duration-200 hover:scale-110 active:scale-95 ${p.rk ? '' : 'border-2 border-dashed border-on-night-soft !bg-night-deep text-on-night-soft'}`}
                  style={{ left: x - 22, top: y - 22, background: SERIES[p.i % SERIES.length], color: NIGHT, boxShadow: on ? '0 0 0 3px #14123f, 0 0 0 5px #d4b46a, 0 0 28px 6px rgb(212 180 106 / 0.45)' : '0 6px 18px rgb(6 5 30 / 0.5)' }}>
                  {String.fromCharCode(65 + p.i)}
                </button>
                <div className={`pointer-events-none absolute w-52 ${right ? '' : 'text-right'}`} style={{ top: y - 20, left: right ? x + 30 : x - 30 - 208 }}>
                  <p className="truncate font-medium">{short(c.names(p.n.supplierId))}{p.n.supplierId === lead && <span className="eyebrow ml-2 !text-(--gold)">Leader</span>}</p>
                  <p className="numeral text-section leading-5">AED {mil(p.n.total)}</p>
                  {k > 1.35 && <p className="soft">{p.rk ? `Combined ${n2(p.rk.combined)}` : 'Not ranked'}, {p.n.adjustments.length} adj., {p.n.anomalies.length} anom.</p>}
                  {k > 1.35 && !p.rk && <p className="text-(--warn)">{whyNot(techOf(c, p.n.supplierId))}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Zoomable>
  );
}

function Readout({ c, id }: { c: Ctx; id: string }) {
  const n = c.r.normalized.find(x => x.supplierId === id);
  if (!n) return null;
  const rk = rankOf(c, id), t = techOf(c, id), i = idxOf(c, id);
  const open = () => document.querySelector<HTMLButtonElement>(`#bt-${id} button[aria-label^="Zoom in"]`)?.click();
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-(--hair) pt-4">
      <span className="flex items-center gap-3"><Badge i={i} dim={!rk} /><span className="grid"><span className="font-medium">{aliasAt(i)}, {c.names(id)}</span><span className="soft">{rk ? `Ranked ${c.r.ranking.indexOf(rk) + 1} of ${c.r.ranking.length}` : whyNot(t)}</span></span></span>
      <dl className="flex flex-wrap gap-x-6 gap-y-2">{[['Technical', t && n2(t.score)], ['Commercial', rk && n2(rk.commercial)], ['Combined', rk && n2(rk.combined)], ['Adjustments', n.adjustments.length], ['Anomalies', n.anomalies.length]].filter(x => x[1] !== undefined && x[1] !== null).map(([k, v]) => <div key={k as string}><dt className="eyebrow">{k}</dt><dd className="numeral text-section">{v}</dd></div>)}</dl>
      <span className="ml-auto"><Button variant="secondary" onClick={open}>Open line view</Button></span>
    </div>
  );
}

// ---------- Ranking ----------
function Ranking({ c, sel, onSel }: { c: Ctx; sel: string; onSel: (id: string) => void }) {
  const rest = c.r.normalized.filter(n => !rankOf(c, n.supplierId));
  const cheapest = Math.min(...c.r.normalized.map(n => n.total));
  return (
    <div className="grid gap-3">
      <ol className="grid gap-2">
        {c.r.ranking.map((x, k) => {
          const i = idxOf(c, x.supplierId), on = sel === x.supplierId;
          return (
            <li key={x.supplierId}><button type="button" onClick={() => onSel(x.supplierId)} aria-pressed={on}
              className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-card border p-3 text-left transition-transform duration-200 hover:bg-white/[0.06] active:scale-[0.99] ${on ? 'border-gold bg-white/[0.08]' : 'border-white/10'}`}>
              <span className="numeral w-6 text-section text-(--gold)">{k + 1}</span>
              <span className="flex min-w-0 items-center gap-2"><Badge i={i} size="size-7" /><span className="truncate font-medium">{c.names(x.supplierId)}</span></span>
              <span className="numeral text-[1.75rem] leading-none">{n2(x.combined)}</span>
              <span />
              <span className="grid gap-1.5">
                {([['Technical', x.technical], ['Commercial', x.commercial]] as const).map(([k2, v]) => (
                  <span key={k2} className="grid grid-cols-[5.5rem_1fr_3.25rem] items-center gap-2"><span className="soft">{k2}</span>
                    <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-white/10"><span className="grow-x block h-full origin-left rounded-full" style={{ transform: `scaleX(${v / 100})`, background: SERIES[i % SERIES.length] }} /></span>
                    <span className="numeral text-right">{n2(v)}</span></span>))}
              </span>
              <span className="soft self-end text-right">combined</span>
            </button></li>
          );
        })}
      </ol>
      {rest.map(n => {
        const i = idxOf(c, n.supplierId), on = sel === n.supplierId;
        return (
          <button key={n.supplierId} type="button" onClick={() => onSel(n.supplierId)} aria-pressed={on} className={`grid gap-1.5 rounded-card border border-dashed p-3 text-left transition-transform duration-200 hover:bg-white/[0.06] active:scale-[0.99] ${on ? 'border-gold' : 'border-white/25'}`}>
            <span className="flex items-center gap-2"><Badge i={i} size="size-7" dim /><span className="truncate font-medium">{c.names(n.supplierId)}</span><span className="ml-auto"><StatusChip tone="danger">Not ranked</StatusChip></span></span>
            <span className="soft">{whyNot(techOf(c, n.supplierId))}: technical {n2(techOf(c, n.supplierId)?.score ?? 0)}.{n.total === cheapest ? ' It carries the lowest price, but price cannot lift a bid that failed technical.' : ''}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Price ladder: submitted currency to normalised AED ----------
function Ladder({ c, onSel }: { c: Ctx; onSel: (id: string) => void }) {
  const rows = [...c.r.normalized].sort((a, b) => a.total - b.total), max = Math.max(...rows.map(n => n.total));
  return (
    <ul className="grid gap-4">
      {rows.map(n => {
        const i = idxOf(c, n.supplierId), rk = rankOf(c, n.supplierId);
        return (
          <li key={n.supplierId}><button type="button" onClick={() => onSel(n.supplierId)} className="grid w-full gap-2 rounded-ctl py-1 text-left transition-transform duration-200 hover:bg-white/[0.05] active:scale-[0.995]">
            <span className="flex items-center gap-2"><Badge i={i} size="size-6" dim={!rk} /><span className="min-w-0 flex-1 truncate font-medium">{c.names(n.supplierId)}</span><Money value={n.total} className="numeral text-section" /></span>
            <span aria-hidden className="block h-3 overflow-hidden rounded-full bg-white/10">
              <span className="grow-x block h-full origin-left rounded-full" style={{ transform: `scaleX(${n.total / max})`, background: rk ? SERIES[i % SERIES.length] : `repeating-linear-gradient(135deg, ${SERIES[i % SERIES.length]}55 0 6px, transparent 6px 12px)` }} />
            </span>
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1 soft">
              {n.currency !== 'AED' && <span>{n.currency} {n.submitted.toLocaleString('en')} submitted, converted to AED</span>}
              {n.adjustments.length > 0 && <span>{n.adjustments.length} adjustment{n.adjustments.length > 1 ? 's' : ''}</span>}
              {n.anomalies.length > 0 && <span className="text-(--warn)">{n.anomalies.length} anomal{n.anomalies.length > 1 ? 'ies' : 'y'}</span>}
              {!rk && <span className="text-(--bad)">Not ranked</span>}
            </span>
          </button></li>
        );
      })}
    </ul>
  );
}

// ---------- Sensitivity: who wins at every technical weighting ----------
function Sensitivity({ c }: { c: Ctx }) {
  const b = c.r.sensitivity, w = weighting(c.r.ranking);
  const edge = (k: number) => (k + 1 < b.length ? (b[k].to + b[k + 1].from) / 2 : 100), start = (k: number) => (k === 0 ? 0 : edge(k - 1));
  return (
    <div className="grid gap-4">
      <div className="relative pb-6 pt-8">
        <div role="img" aria-label={b.map(x => `${c.names(x.winner)} wins from ${x.from} to ${x.to} percent technical weight`).join('. ')} className="flex h-9 overflow-hidden rounded-ctl border border-white/15">
          {b.map((x, k) => <span key={x.winner + x.from} className="grid min-w-0 place-items-center overflow-hidden text-label font-semibold" style={{ width: `${edge(k) - start(k)}%`, background: SERIES[idxOf(c, x.winner) % SERIES.length], color: NIGHT }}>{edge(k) - start(k) > 14 ? String.fromCharCode(65 + idxOf(c, x.winner)) : ''}</span>)}
        </div>
        {w !== undefined && <span className="absolute top-0 grid -translate-x-1/2 justify-items-center" style={{ left: `${w}%` }}><span className="eyebrow !text-(--gold)">This event {w}%</span><span aria-hidden className="h-8 w-px bg-gold" /></span>}
        <div aria-hidden className="absolute inset-x-0 bottom-0 flex justify-between font-code text-label text-(--soft)"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100% technical weight</span></div>
      </div>
      <ul className="grid gap-1.5">
        {b.map((x, k) => <li key={x.winner + x.from} className="flex items-center gap-2"><Badge i={idxOf(c, x.winner)} size="size-6" /><span><span className="font-medium">{c.names(x.winner)}</span> <span className="soft">wins from {x.from}% to {x.to}%</span></span></li>)}
      </ul>
      <p className="soft">{b.length > 1 ? `The leader changes between ${b[0].to}% and ${b[1].from}% technical weight. ${w !== undefined && w >= b[1].from ? 'This event sits above that point.' : 'This event sits below that point.'}` : 'No weighting between 0% and 100% changes the leader.'}</p>
    </div>
  );
}

// ---------- Scenarios ----------
function Scenarios({ c, scn, onPick, canPick }: { c: Ctx; scn: string; onPick: (id: string) => void; canPick: boolean }) {
  const best = c.r.scenarios.find(s => s.id === 'best_value') ?? c.r.scenarios[0], max = Math.max(...c.r.scenarios.map(s => s.value));
  return (
    <div className="grid gap-5">
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
        {c.r.scenarios.map((s, k) => {
          const d = s.value - best.value, on = scn === s.id;
          return (
            <Card as="li" key={s.id} i={k} className={`grid content-start gap-3 ${on ? 'outline outline-2 outline-offset-2 outline-gold' : ''}`}>
              <div className="flex items-start justify-between gap-3"><h3 className="text-section font-semibold">{s.label}</h3>{s.id === 'best_value' && <StatusChip tone="success">Best value</StatusChip>}</div>
              <p className="numeral text-[2rem] leading-none"><Money value={s.value} big /></p>
              <p className="soft">{d === 0 ? 'The reference for comparison.' : <>{d < 0 ? 'Saves ' : 'Costs '}<Money value={Math.abs(d)} className="font-medium text-(--fg)" /> {d < 0 ? 'against' : 'over'} best value.</>}</p>
              <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-primary-soft"><span className="grow-x block h-full origin-left rounded-full bg-peri" style={{ transform: `scaleX(${s.value / max})` }} /></span>
              <ul className="grid gap-1.5">{s.allocations.map(a => <li key={a.supplierId} className="flex items-center gap-2"><Badge i={idxOf(c, a.supplierId)} size="size-6" /><span className="min-w-0 flex-1 truncate">{c.names(a.supplierId)}</span><span className="font-code text-label">{a.lotIds.join(' ')}</span></li>)}</ul>
              {s.deviation && <p className="flex items-start gap-2"><StatusChip tone="warning">Deviation</StatusChip><span className="soft">Differs from the best-value ranking. The engine asks for a written justification.</span></p>}
              {canPick && <div><Button variant="secondary" onClick={() => onPick(s.id)} aria-pressed={on}>{on ? 'Selected' : 'Select scenario'}</Button></div>}
            </Card>
          );
        })}
      </ul>
      <Card glass className="!p-4">
        <Section title="Compare side by side" meta={`${c.r.scenarios.length} scenarios`}>
          <Table caption="Award scenarios" rowKey={s => s.id} rows={c.r.scenarios} columns={[
            { key: 'l', header: 'Scenario', cell: s => s.label },
            { key: 'v', header: 'Value, AED', align: 'right', cell: s => <span className="numeral">{n2(s.value)}</span> },
            { key: 'd', header: 'Against best value', align: 'right', cell: s => <span className="numeral">{s.value === best.value ? '0.00' : n2(s.value - best.value)}</span> },
            { key: 'a', header: 'Allocation', cell: s => s.allocations.map(a => `${aliasAt(idxOf(c, a.supplierId))} ${a.lotIds.join('+')}`).join(', ') },
            { key: 'x', header: 'Deviation', cell: s => (s.deviation ? 'Yes, justify' : 'No') },
          ]} />
        </Section>
      </Card>
    </div>
  );
}

export function RecommendDialog({ open, onClose, eventId, scenarios, scn, onDone }: { open: boolean; onClose: () => void; eventId: string; scenarios: Scenario[]; scn: string; onDone: (awardId: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const qc = useQueryClient();
  const [pick, setPick] = useState(scn), [why, setWhy] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { const d = ref.current!; if (open && !d.open) { setPick(scn); setErr(''); d.showModal(); } if (!open && d.open) d.close(); }, [open, scn]);
  const s = scenarios.find(x => x.id === pick);
  const run = async () => {
    setBusy(true); setErr('');
    try { const a = await call<{ id: string }>('awards', 'recommend', eventId, pick, why); onDone(a.id); await qc.invalidateQueries(); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <dialog ref={ref} aria-label="Recommend award" onClose={onClose} onClick={e => { if (e.target === ref.current) onClose(); }} className="zoom-panel card on-light m-auto w-[min(30rem,calc(100vw-2rem))] p-6 shadow-e3">
      <div className="grid gap-4">
        <h2 className="text-section font-semibold">Recommend award</h2>
        <p className="soft">This starts the approval route. The engine checks open exclusions, budget and deviation, and sets the approvers.</p>
        <Field label="Scenario"><select value={pick} onChange={e => setPick(e.target.value)} className={`h-11 md:h-10 ${control} [color-scheme:light]`}>{scenarios.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></Field>
        {s && <p className="flex flex-wrap items-center gap-2"><Money value={s.value} className="numeral text-section" />{s.deviation && <StatusChip tone="warning">Deviation, justification needed</StatusChip>}</p>}
        <Field label="Justification" hint="Required when the scenario deviates from the best-value ranking."><textarea rows={3} value={why} onChange={e => setWhy(e.target.value)} className={control} /></Field>
        {err && <Reason>{err}</Reason>}
        <div className="flex justify-end gap-3"><Button variant="text" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={run}>Recommend award</Button></div>
      </div>
    </dialog>
  );
}

export function WarRoom({ c, scn, onPick, canPick }: { c: Ctx; scn: string; onPick: (id: string) => void; canPick: boolean }) {
  const desktop = useDesktop();
  const [sel, setSel] = useState(c.r.ranking[0]?.supplierId ?? c.r.normalized[0]?.supplierId ?? '');
  const open = c.r.normalized.flatMap(n => exclusionsOf(c, n).filter(x => !x.value).map(x => ({ n, x })));
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      {open.length > 0 && (
        <Card i={0} className="grid gap-3 border-l-4 !border-l-(--warn)">
          <div className="flex flex-wrap items-center gap-3"><h2 className="text-section font-semibold">Exclusions to price</h2><StatusChip tone="warning">{open.length} open</StatusChip></div>
          <p className="soft">A bidder excluded scope from its price. The commercial evaluator loads the add-back so bids compare like for like. The engine will not recommend an award while ranked bidders have unpriced exclusions.</p>
          <div className="grid gap-3 md:grid-cols-2">{open.map(({ n, x }) => <div key={n.supplierId + x.desc} className="grid gap-2"><span className="flex items-center gap-2"><Badge i={idxOf(c, n.supplierId)} size="size-6" /><span className="font-medium">{c.names(n.supplierId)}</span></span><ExclusionForm c={c} n={n} x={x} /></div>)}</div>
        </Card>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {desktop
          ? <Panel i={1} title="Value map" note="Technical score against normalised price. Scroll or pinch to zoom, drag to pan; zoom in for flags."><ValueMap c={c} sel={sel} onSel={setSel} /><Readout c={c} id={sel} /></Panel>
          : <Panel i={1} title="Normalised totals" note="Each bid converted to AED and adjusted like for like."><Ladder c={c} onSel={setSel} /></Panel>}
        <Panel i={2} title="Combined ranking" note={`${weighting(c.r.ranking) ?? ''}${weighting(c.r.ranking) !== undefined ? '% technical, ' + (100 - weighting(c.r.ranking)!) + '% commercial. ' : ''}Only technically qualified bids are ranked.`}><Ranking c={c} sel={sel} onSel={setSel} /></Panel>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
        {desktop && <Panel i={3} title="Normalised totals" note="Each bid converted to AED and adjusted like for like."><Ladder c={c} onSel={setSel} /></Panel>}
        <Panel i={4} title="Sensitivity to the weighting" note="Who leads at every technical weighting, in 5% steps."><Sensitivity c={c} /></Panel>
      </div>

      <section aria-label="Bidders" className="grid gap-3">
        <h2 className="text-section font-semibold">Bidders</h2>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {c.r.normalized.map((n, k) => (
            <div key={n.supplierId} id={`bt-${n.supplierId}`} className="grid"><FocusCard i={k} title={aliasAt(k)} note={`Line-level view of ${c.names(n.supplierId)}`} detail={<BidderDetail c={c} n={n} />}><TileFace c={c} n={n} /></FocusCard></div>
          ))}
        </div>
      </section>

      <section aria-label="Award scenarios" className="grid gap-3">
        <h2 className="text-section font-semibold">Award scenarios</h2>
        <Scenarios c={c} scn={scn} onPick={onPick} canPick={canPick} />
      </section>

      <Insight c={c} />
    </div>
  );
}
