import { call } from '../../api';
import { ActionBar } from '../../ui/ActionBar';
import { FocusCard } from '../../ui/FocusCard';
import { Section } from '../../ui/Section';
import { StatusChip, type Tone } from '../../ui/StatusChip';
import { alerts, useHistory, words, type Sup } from './data';

const statusTone: Record<Sup['status'], Tone> = { qualified: 'success', registered: 'neutral', invited: 'neutral', suspended: 'warning', rejected: 'danger' };
const riskTone: Record<Sup['risk'], Tone> = { low: 'success', medium: 'warning', high: 'danger' };
const labels = { qualify: 'Qualify supplier', reject: 'Reject supplier', suspend: 'Suspend supplier', reinstate: 'Reinstate supplier' };
const doc = (d: string) => words(d);

/** Three steps: how much risk the engine rated. Shape plus label, never colour alone. */
function RiskSteps({ risk }: { risk: Sup['risk'] }) {
  const n = { low: 1, medium: 2, high: 3 }[risk];
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="flex gap-0.5">{[1, 2, 3].map(i => <i key={i} className={`h-3 w-1.5 rounded-sm ${i <= n ? 'bg-(--tone)' : 'bg-(--hair)'}`} style={{ ['--tone' as string]: `var(--${risk === 'low' ? 'ok' : risk === 'medium' ? 'warn' : 'bad'})` }} />)}</span>
      <StatusChip tone={riskTone[risk]}>{words(risk)} risk</StatusChip>
    </span>
  );
}

/** Performance as a display numeral over a gold gauge that grows by transform. */
function Performance({ value, big }: { value?: number; big?: boolean }) {
  if (value === undefined) return <p className="soft">Performance is shown to buyers and managers.</p>;
  return (
    <div className="grid gap-1.5">
      <p className="eyebrow">Performance score</p>
      <p className={`numeral leading-none ${big ? 'text-[3.25rem] md:text-display' : 'text-[2rem]'}`}>{value}<span className="soft text-label"> / 100</span></p>
      <div role="img" aria-label={`${value} out of 100`} className="h-[3px] rounded-full bg-(--hair)">
        <div className="grow-x h-full origin-left rounded-full bg-(--gold)" style={{ transform: `scaleX(${value / 100})` }} />
      </div>
    </div>
  );
}

export function DocHealth({ s }: { s: Sup }) {
  const expired = s.flags.filter(f => f.expired), expiring = s.flags.filter(f => !f.expired);
  if (!alerts(s)) return <StatusChip tone="success">No document alerts</StatusChip>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {expired.length > 0 && <StatusChip tone="danger">{expired.length} expired</StatusChip>}
      {expiring.length > 0 && <StatusChip tone="warning">{expiring.length} expiring</StatusChip>}
      {s.missing.length > 0 && <StatusChip tone="danger">{s.missing.length} missing</StatusChip>}
    </span>
  );
}

export function SupplierCard({ s, i }: { s: Sup; i: number }) {
  return (
    <FocusCard i={i} title={s.name} note={s.categories.join(', ')} detail={<Detail s={s} />}>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <StatusChip tone={statusTone[s.status]}>{words(s.status)}</StatusChip>
        <RiskSteps risk={s.risk} />
      </p>
      <Performance value={s.performance} />
      <div className="grid gap-2 border-t border-(--hair) pt-3">
        <span className="soft flex items-baseline justify-between"><span className="font-code text-label">{s.id}</span>{s.country && <span className="eyebrow">{s.country}</span>}</span>
        <div><DocHealth s={s} /></div>
      </div>
    </FocusCard>
  );
}

function Detail({ s }: { s: Sup }) {
  const hist = useHistory(s.id);
  return (
    <div className="grid gap-8">
      <div className="grid gap-3 rounded-ctl border border-(--hair) bg-porcelain-dim/60 p-4">
        <p className="eyebrow">Next step for you</p>
        <ActionBar module="suppliers" id={s.id} labels={labels} run={(action, reason) => call('suppliers', 'qualify', s.id, action, reason)} />
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_1fr_1fr]">
        <Performance value={s.performance} big />
        <dl className="grid content-start gap-4">
          <div><dt className="eyebrow">Status</dt><dd className="mt-1"><StatusChip tone={statusTone[s.status]}>{words(s.status)}</StatusChip></dd></div>
          <div><dt className="eyebrow">Risk rating</dt><dd className="mt-1"><RiskSteps risk={s.risk} /></dd></div>
        </dl>
        <dl className="grid content-start gap-4">
          <div>
            <dt className="eyebrow">Sanctions screening</dt>
            <dd className="mt-1">{s.sanctioned === undefined ? <span className="soft">Shown to buyers and managers.</span> : <StatusChip tone={s.sanctioned ? 'danger' : 'success'}>{s.sanctioned ? 'Screening hit' : 'No hit'}</StatusChip>}</dd>
          </div>
          <div><dt className="eyebrow">Supplier ID</dt><dd className="mt-1"><span className="font-code text-label">{s.id}</span>{s.country && <span>, {s.country}</span>}</dd></div>
        </dl>
      </div>

      <section className="grid gap-3">
        <h3 className="text-section font-semibold">Documents</h3>
        {alerts(s) === 0 && <p className="soft">The engine reports no expired, expiring (within 30 days){s.elig.length ? ' or missing' : ''} document. Dates beyond 30 days are not returned.</p>}
        <ul className="divide-y divide-(--hair)">
          {s.flags.map(f => (
            <li key={f.doc} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
              <span className="sm:min-w-40 font-medium">{doc(f.doc)}</span>
              <StatusChip tone={f.expired ? 'danger' : 'warning'}>{f.expired ? 'Expired' : 'Expiring'}</StatusChip>
              <span className="soft">{f.expired ? 'expired' : 'expires'} <span className="font-code text-label text-(--fg)">{f.expires}</span></span>
            </li>
          ))}
          {s.missing.map(m => (
            <li key={m} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
              <span className="sm:min-w-40 font-medium">{doc(m)}</span><StatusChip tone="danger">Missing</StatusChip>
            </li>
          ))}
        </ul>
      </section>

      <Section title="Eligibility by category" meta={s.elig.length ? `${s.elig.length} categor${s.elig.length > 1 ? 'ies' : 'y'}` : undefined} defaultOpen>
        {s.elig.length === 0 && <p className="soft">Eligibility is computed by the engine for buyers and managers.</p>}
        <ul className="grid gap-4">
          {s.elig.map(e => (
            <li key={e.category} className="grid gap-1.5">
              <span className="flex flex-wrap items-center gap-3"><span className="font-medium">{e.category}</span><StatusChip tone={e.eligible ? 'success' : 'danger'}>{e.eligible ? 'Eligible to invite' : 'Not eligible'}</StatusChip></span>
              {e.blockers.map(b => <span key={b} className="text-(--bad)">Blocked: {b}</span>)}
              {e.warnings.map(w => <span key={w} className="text-(--warn)">Warning: {w}</span>)}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Status history" meta="Audit trail">
        {hist.error && <p className="soft" role="status">{(hist.error as Error).message}</p>}
        {hist.data?.length === 0 && <p className="soft">No status change has been recorded for this supplier yet.</p>}
        <ol className="grid gap-3">
          {hist.data?.map(h => (
            <li key={h.seq} className="grid gap-0.5 border-l border-(--gold) pl-4">
              <span className="font-medium">{words(h.action.replace('supplier.', ''))} <span className="soft font-normal">by {h.actor}</span></span>
              <span className="soft"><span className="font-code text-label">{h.at}</span>, entry {h.seq}, hash <span className="font-code text-label">{h.hash.slice(0, 8)}</span>{h.data?.note ? `, reason: ${h.data.note}` : ''}</span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
