import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { call } from '../../api';
import { Button } from '../../ui/Button';
import { Field, control } from '../../ui/Field';
import { Ic } from '../../ui/bits';
import { Money } from '../../ui/Money';
import { StatusChip } from '../../ui/StatusChip';
import { aliasAt, n2, SERIES, type Norm, type Pack, type Ranked, type Results, type Tech } from './lib';
import { Badge, Reason } from './parts';

export type Ctx = { r: Results; eventId: string; pack?: Pack; names: (id: string) => string };
export const idxOf = (c: Ctx, id: string) => c.r.normalized.findIndex(n => n.supplierId === id);
export const rankOf = (c: Ctx, id: string): Ranked | undefined => c.r.ranking.find(x => x.supplierId === id);
export const techOf = (c: Ctx, id: string): Tech | undefined => c.r.technical.find(x => x.supplierId === id);
export const whyNot = (t?: Tech) => !t ? 'No technical result' : !t.complete ? 'Technical scoring incomplete' : !t.gatesPassed ? 'Failed a gate criterion' : 'Below the technical threshold';

// The engine returns exclusions only as adjustment or anomaly lines. Read them back, with the index loadExclusion needs.
// ponytail: index comes from the technical pack when this role can read it, else line order; ask core to return exclusions with index and add-back.
const EXC = /^Exclusion "(.+)": (?:add-back not yet priced|add-back AED ([\d,.]+))$/;
export function exclusionsOf(c: Ctx, n: Norm) {
  const all = [...n.adjustments, ...n.anomalies].flatMap(l => { const m = l.match(EXC); return m ? [{ desc: m[1], value: m[2] }] : []; });
  const listed = c.pack?.bidders[idxOf(c, n.supplierId)]?.exclusions;
  return all.map((x, i) => ({ ...x, index: listed ? Math.max(listed.indexOf(x.desc), 0) : i }));
}

export function ExclusionForm({ c, n, x }: { c: Ctx; n: Norm; x: ReturnType<typeof exclusionsOf>[number] }) {
  const qc = useQueryClient();
  const [v, setV] = useState(x.value?.replace(/,/g, '') ?? '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true); setErr('');
    try { await call('evaluation', 'loadExclusion', c.eventId, n.supplierId, x.index, Number(v)); await qc.invalidateQueries(); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="grid gap-2 rounded-ctl border border-(--hair) p-3">
      <p className="flex flex-wrap items-center gap-2"><span className="font-medium">{x.desc}</span><StatusChip tone={x.value ? 'success' : 'warning'}>{x.value ? 'Priced' : 'Not priced'}</StatusChip></p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1"><Field label="Add-back, AED"><input type="number" min={0} step="any" inputMode="decimal" value={v} onChange={e => setV(e.target.value)} className={`h-11 md:h-10 ${control} text-right [color-scheme:light]`} /></Field></div>
        <Button variant="secondary" loading={busy} disabled={v === ''} onClick={run}>{x.value ? 'Reprice add-back' : 'Load add-back'}</Button>
      </div>
      {err && <Reason>{err}</Reason>}
    </div>
  );
}

/** What the zoomed-out tile shows. */
export function TileFace({ c, n }: { c: Ctx; n: Norm }) {
  const i = idxOf(c, n.supplierId), rk = rankOf(c, n.supplierId), t = techOf(c, n.supplierId);
  const place = rk ? c.r.ranking.indexOf(rk) + 1 : 0;
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3"><Badge i={i} size="size-10" dim={!rk} /><div className="grid min-w-0"><span className="truncate font-medium">{c.names(n.supplierId)}</span><span className="font-code text-label text-(--soft)">{n.supplierId}</span></div></div>
      <p className="grid"><span className="eyebrow">Normalised total</span><Money value={n.total} className="numeral text-[1.5rem] leading-tight" /></p>
      <dl className="grid grid-cols-3 gap-2">
        {[['Technical', t && n2(t.score)], ['Commercial', rk ? n2(rk.commercial) : 'Not ranked'], ['Combined', rk ? n2(rk.combined) : 'Not ranked']].map(([k, v]) => <div key={k}><dt className="eyebrow !tracking-[0.08em]">{k}</dt><dd className={`numeral ${rk || k === 'Technical' ? 'text-section' : 'soft text-body'}`}>{v}</dd></div>)}
      </dl>
      <p className="flex flex-wrap gap-2">
        <StatusChip tone={rk ? 'success' : 'danger'}>{rk ? `Ranked ${place}` : 'Not ranked'}</StatusChip>
        {n.adjustments.length > 0 && <StatusChip tone="neutral">{n.adjustments.length} adjustment{n.adjustments.length > 1 ? 's' : ''}</StatusChip>}
        {n.anomalies.length > 0 && <StatusChip tone="warning">{n.anomalies.length} anomal{n.anomalies.length > 1 ? 'ies' : 'y'}</StatusChip>}
      </p>
    </div>
  );
}

const Stat = ({ k, children }: { k: string; children: React.ReactNode }) => <div className="grid gap-1"><dt className="eyebrow">{k}</dt><dd className="numeral text-[1.5rem] leading-none">{children}</dd></div>;

/** The zoomed panel: everything the engine says about one bidder, line by line. */
export function BidderDetail({ c, n }: { c: Ctx; n: Norm }) {
  const i = idxOf(c, n.supplierId), rk = rankOf(c, n.supplierId), t = techOf(c, n.supplierId);
  const maxLot = Math.max(...Object.values(n.lots), 1);
  const inScn = c.r.scenarios.filter(s => s.allocations.some(a => a.supplierId === n.supplierId));
  const exc = exclusionsOf(c, n);
  const crit = (id: string) => c.pack?.criteria.find(x => x.id === id);
  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center gap-3"><Badge i={i} size="size-11" dim={!rk} /><div className="grid"><span className="text-section font-semibold">{aliasAt(i)}, {c.names(n.supplierId)}</span><span className="font-code text-label text-(--soft)">{n.supplierId}</span></div>
        <StatusChip tone={rk ? 'success' : 'danger'}>{rk ? `Ranked ${c.r.ranking.indexOf(rk) + 1} of ${c.r.ranking.length}` : whyNot(t)}</StatusChip></div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-4">
        <div className="col-span-2"><dt className="eyebrow">Normalised total</dt><dd className="numeral mt-1 text-[2.5rem] leading-none md:text-[3rem]"><Money value={n.total} big /></dd></div>
        <Stat k={`Submitted, ${n.currency}`}>{n.submitted.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Stat>
        <Stat k="Technical">{t ? n2(t.score) : ''}</Stat>
        {rk && <Stat k="Commercial">{n2(rk.commercial)}</Stat>}
        {rk && <Stat k="Combined">{n2(rk.combined)}</Stat>}
      </dl>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="grid content-start gap-3"><h3 className="text-section font-semibold">Price by lot, AED</h3>
          <ul className="grid gap-3">{Object.entries(n.lots).map(([lot, v]) => (
            <li key={lot} className="grid gap-1"><span className="flex items-baseline justify-between"><span className="font-code text-label">{lot}</span><Money value={v} className="font-medium" /></span>
              <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-primary-soft"><span className="grow-x block h-full origin-left rounded-full" style={{ transform: `scaleX(${v / maxLot})`, background: SERIES[i % SERIES.length] }} /></span></li>))}</ul>
        </section>
        {t && <section className="grid content-start gap-3"><h3 className="text-section font-semibold">Technical consensus</h3>
          <ul className="grid gap-3">{Object.entries(t.consensus).map(([id, v]) => (
            <li key={id} className="grid gap-1"><span className="flex items-baseline justify-between gap-3"><span>{crit(id)?.name ?? <span className="font-code text-label">{id}</span>}{crit(id)?.gate && <span className="soft"> (gate)</span>}</span><span className="numeral font-medium">{crit(id)?.gate ? (v ? 'Pass' : 'Fail') : n2(v)}</span></span>
              {!crit(id)?.gate && <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-primary-soft"><span className="grow-x block h-full origin-left rounded-full bg-peri" style={{ transform: `scaleX(${v / 10})` }} /></span>}</li>))}</ul>
        </section>}
      </div>

      <section className="grid gap-3"><h3 className="text-section font-semibold">Adjustments, line by line</h3>
        {n.adjustments.length === 0 ? <p className="soft">The engine made no adjustments to this bid.</p> :
          <ul className="grid gap-2">{n.adjustments.map(a => <li key={a} className="flex gap-3 rounded-ctl border border-(--hair) p-3"><Ic n="check" className="mt-0.5 text-(--gold)" /><span>{a}</span></li>)}</ul>}
      </section>
      <section className="grid gap-3"><h3 className="text-section font-semibold">Anomalies the engine flagged</h3>
        {n.anomalies.length === 0 ? <p className="soft">None.</p> :
          <ul className="grid gap-2">{n.anomalies.map(a => <li key={a} className="flex gap-3 rounded-ctl bg-danger-soft/60 p-3"><Ic n="warn" className="mt-0.5 text-(--bad)" /><span>{a}</span></li>)}</ul>}
      </section>
      {exc.length > 0 && <section className="grid gap-3"><h3 className="text-section font-semibold">Exclusions</h3><div className="grid gap-3 md:grid-cols-2">{exc.map(x => <ExclusionForm key={x.desc} c={c} n={n} x={x} />)}</div></section>}
      <section className="grid gap-3"><h3 className="text-section font-semibold">In the award scenarios</h3>
        {inScn.length === 0 ? <p className="soft">Not allocated in any scenario{rk ? '.' : ': not ranked, so not eligible.'}</p> :
          <ul className="grid gap-2 md:grid-cols-3">{inScn.map(s => { const a = s.allocations.find(x => x.supplierId === n.supplierId)!; return (
            <li key={s.id} className="grid gap-1 rounded-ctl border border-(--hair) p-3"><span className="font-medium">{s.label}</span><span className="soft">Lots {a.lotIds.join(', ')}</span><Money value={a.value} className="numeral text-section" />{s.deviation && <StatusChip tone="warning">Deviates from best value</StatusChip>}</li>); })}</ul>}
      </section>
    </div>
  );
}
