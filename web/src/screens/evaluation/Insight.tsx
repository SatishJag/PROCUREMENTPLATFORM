import { useState } from 'react';
import { call } from '../../api';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Ic } from '../../ui/bits';
import { StatusChip } from '../../ui/StatusChip';
import { idxOf, type Ctx } from './Bidder';
import { n2, type Insight as Out } from './lib';
import { Badge, Reason } from './parts';

/** Resolve a citable ref ("adj:SUP-X:0", "anom:...", "rank:...", "scn:...") back to the engine's own line. */
function cited(c: Ctx, ref: string) {
  const [kind, id, k] = ref.split(':');
  const n = c.r.normalized.find(x => x.supplierId === id);
  if (kind === 'adj') return n?.adjustments[Number(k)];
  if (kind === 'anom') return n?.anomalies[Number(k)];
  if (kind === 'rank') { const r = c.r.ranking.find(x => x.supplierId === id); return r && `Ranking: technical ${n2(r.technical)}, commercial ${n2(r.commercial)}, combined ${n2(r.combined)}`; }
  if (kind === 'scn') return c.r.scenarios.find(s => s.id === id)?.label;
}
const sev = { high: 'danger', medium: 'warning', low: 'neutral' } as const;
const Who = ({ c, id }: { c: Ctx; id: string }) => { const i = idxOf(c, id); return <span className="flex items-center gap-2">{i >= 0 && <Badge i={i} size="size-6" />}<span className="font-medium">{c.names(id)}</span></span>; };

/** Advisory second opinion from insight.analyzeBids. On click only, because a model call can cost money. The engine's anomalies always sit beside it. */
export function Insight({ c }: { c: Ctx }) {
  const [out, setOut] = useState<Out | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const ask = async () => {
    setBusy(true); setErr('');
    try { setOut(await call<Out>('insight', 'analyzeBids', c.eventId)); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const anomalies = c.r.normalized.flatMap(n => n.anomalies.map(text => ({ supplierId: n.supplierId, text, ref: '' })));
  const eng = out?.source === 'ai' ? out.engineAnomalies : anomalies;
  const uncited = out?.source === 'ai' ? new Set(out.uncitedAnomalies) : new Set<string>();

  return (
    <Card glass i={6} className="grid gap-5 !border-gold/40">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <p className="eyebrow !text-(--gold)">Advisory only</p>
          <h2 className="text-section font-semibold">Second opinion, the engine decides</h2>
          <p className="soft max-w-3xl">A read of the engine's own results, with the evidence it relies on. It cannot approve, award or change anything, and it only sees what you can already see.</p>
        </div>
        <Button variant="secondary" loading={busy} onClick={ask}>{out ? 'Ask again' : 'Get second opinion'}</Button>
      </header>
      {err && <Reason>{err}</Reason>}

      {out?.source === 'engine' && (
        <p className="flex flex-wrap items-center gap-3 rounded-ctl border border-white/15 p-3"><StatusChip tone="neutral">Source: engine, rule-based</StatusChip><span className="soft">{out.notice}</span></p>
      )}
      {out?.source === 'ai' && (
        <div className="grid gap-3">
          <p className="flex flex-wrap items-center gap-2"><StatusChip tone="neutral">Source: AI</StatusChip><StatusChip tone="neutral">Model {out.model}</StatusChip><StatusChip tone="warning">Internal buyer note, never share with bidders</StatusChip><span className="soft">Input fingerprint <span className="font-code text-label text-(--fg)">{out.inputHash.slice(0, 12)}</span>, logged in the audit trail.</span></p>
          <p className="max-w-3xl text-section font-light leading-7">{out.summary}</p>
        </div>
      )}

      {(out || anomalies.length > 0) && (
        <div className={`grid gap-6 ${out?.source === 'ai' ? 'lg:grid-cols-2' : ''}`}>
          {out?.source === 'ai' && (
            <section className="grid content-start gap-3"><h3 className="text-section font-semibold">What the AI flags</h3>
              {out.risks.length === 0 && <p className="soft">No risk was raised with valid evidence.</p>}
              <ul className="grid gap-3">{out.risks.map(r => (
                <li key={r.evidenceRef + r.text} className="grid gap-2 rounded-card border border-white/15 p-3">
                  <span className="flex flex-wrap items-center gap-2"><StatusChip tone={sev[r.severity]}>{r.severity[0].toUpperCase() + r.severity.slice(1)}</StatusChip><Who c={c} id={r.supplierId} /></span>
                  <span>{r.text}</span>
                  <span className="soft flex items-start gap-2 border-t border-(--hair) pt-2"><Ic n="file" className="mt-0.5" /><span>Evidence <span className="font-code text-label text-(--fg)">{r.evidenceRef}</span>: {cited(c, r.evidenceRef) ?? 'not found in the current results'}</span></span>
                </li>))}</ul>
              {out.dropped > 0 && <p className="soft">{out.dropped} suggested risk{out.dropped > 1 ? 's were' : ' was'} discarded because the evidence cited did not match the engine's output.</p>}
              {out.scenarioNotes.length > 0 && <div className="grid gap-1.5"><h4 className="eyebrow">Scenario notes</h4><ul className="grid gap-1.5">{out.scenarioNotes.map(t => <li key={t} className="flex gap-2"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-(--gold)" />{t}</li>)}</ul></div>}
            </section>
          )}
          <section className="grid content-start gap-3"><h3 className="text-section font-semibold">What the engine flagged, verbatim</h3>
            {eng.length === 0 && <p className="soft">The engine raised no anomalies on any bid.</p>}
            <ul className="grid gap-2">{eng.map(a => (
              <li key={a.supplierId + a.text} className="grid gap-1.5 rounded-card border border-white/15 p-3">
                <span className="flex flex-wrap items-center gap-2"><Who c={c} id={a.supplierId} />{a.ref && uncited.has(a.ref) && <StatusChip tone="warning">Not mentioned by the AI</StatusChip>}</span>
                <span className="flex items-start gap-2"><Ic n="warn" className="mt-0.5 text-(--warn)" />{a.text}</span>
              </li>))}</ul>
            {out?.source === 'ai' && uncited.size > 0 && <p className="soft">{uncited.size} engine anomal{uncited.size > 1 ? 'ies are' : 'y is'} not covered by the AI. Read them yourself: the engine is the record.</p>}
          </section>
        </div>
      )}
    </Card>
  );
}
