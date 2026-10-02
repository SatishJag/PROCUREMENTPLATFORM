import { useMutation } from '@tanstack/react-query';
import type { Requisition } from '@satishjag/procurement-core/types';
import { call } from '../../api';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Money } from '../../ui/Money';
import { StatusChip } from '../../ui/StatusChip';
import { health, type Entry, type Second } from './model';
import { signed, Timeline } from './Timeline';

const pct = (c: number) => `${Math.round(c * 100)}%`;
const Eyebrow = ({ children }: { children: React.ReactNode }) => <p className="eyebrow">{children}</p>;
const Mono = ({ children }: { children: React.ReactNode }) => <span className="font-code text-label">{children}</span>;

/** Where the request is: submitted, decided by the budget owner, package created. */
export function Track({ e }: { e: Entry }) {
  const status = e.req?.status ?? 'submitted';
  const steps = [
    { name: 'Submitted', sub: e.req ? e.req.requesterId : 'by the requester', state: 'done' },
    { name: 'Budget owner decides', sub: status === 'submitted' ? 'Waiting' : status === 'approved' ? 'Approved' : 'Rejected', state: status === 'submitted' ? 'now' : status === 'approved' ? 'done' : 'bad' },
    { name: 'Package created', sub: e.pkg ? e.pkg.id : status === 'rejected' ? 'Not created' : 'After approval', state: e.pkg ? 'done' : 'todo' },
  ];
  return (
    <ol aria-label="Progress" className="glass on-dark grid grid-cols-3 gap-2 p-4 md:p-5">
      {steps.map((s, i) => (
        <li key={s.name} className="rise grid gap-2" style={{ '--i': i } as React.CSSProperties} aria-current={s.state === 'now' ? 'step' : undefined}>
          <span className="flex items-center gap-2">
            <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-full border text-label font-semibold ${s.state === 'done' ? 'border-(--gold) bg-(--gold) text-on-accent' : s.state === 'now' ? 'border-(--gold) text-(--gold)' : s.state === 'bad' ? 'border-(--bad) text-(--bad)' : 'border-(--hair) text-(--soft)'}`}>{s.state === 'done' ? '✓' : s.state === 'bad' ? '×' : i + 1}</span>
            <span aria-hidden className={`h-px flex-1 ${i === 2 ? 'opacity-0' : s.state === 'done' ? 'bg-(--gold)' : 'bg-(--hair)'}`} />
          </span>
          <span className="grid"><span className="font-medium max-sm:text-label">{s.name}</span><span className="soft max-sm:text-label"><span className={s.sub.startsWith('PKG') || s.sub.startsWith('u-') ? 'font-code' : ''}>{s.sub}</span></span></span>
        </li>
      ))}
    </ol>
  );
}

/** What the engine created or decided. */
export function Outcome({ e }: { e: Entry }) {
  if (e.req?.status === 'approved' && e.pkg) {
    const p = e.pkg, [tone, label] = health[p.schedule.health];
    return (
      <Card i={1} className="grid gap-4 !border-(--gold)/70 md:grid-cols-[1fr_auto] md:items-center">
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2"><StatusChip tone="success">Package created</StatusChip><Mono>{p.id}</Mono></div>
          <h2 className="text-section font-semibold">{p.title}</h2>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-5">
            {[['Estimate', <Money value={p.estimate} />], ['Route', p.route], ['Status', p.status], ['Needed on site', <Mono>{p.needBy}</Mono>], ['Float', <StatusChip tone={tone}>{signed(p.schedule.floatDays)} d, {label}</StatusChip>]].map(([k, v]) => (
              <div key={String(k)}><dt className="eyebrow">{k}</dt><dd className="mt-1 font-medium">{v}</dd></div>
            ))}
          </dl>
        </div>
        <a href="#/sourcing" className="min-h-11 rounded-ctl px-2 py-2 font-medium text-(--sec) underline underline-offset-4 hover:bg-(--sec-hover) active:scale-[0.97]">Open in Sourcing</a>
      </Card>
    );
  }
  if (e.req?.status === 'rejected') {
    return (
      <Card i={1} className="grid gap-2 !border-danger/50">
        <div className="flex flex-wrap items-center gap-2"><StatusChip tone="danger">Rejected</StatusChip><span className="soft">No package was created.</span></div>
        <p><span className="eyebrow mr-2">Reason</span>{e.reason ?? 'Recorded in the audit trail.'}</p>
      </Card>
    );
  }
  return null;
}

const Verdicts = ({ v, label }: { v: Second['engine']; label: string }) => (
  <div className="grid content-start gap-3">
    <Eyebrow>{label}</Eyebrow>
    <p className="text-section font-semibold">{v.category}</p>
    <div className="grid gap-1.5" role="img" aria-label={`Confidence ${pct(v.confidence)}`}>
      <span className="flex items-baseline justify-between"><span className="soft">Confidence</span><span className="numeral text-[1.5rem] leading-none">{pct(v.confidence)}</span></span>
      <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-primary-soft ring-1 ring-(--hair)"><span className="grow-x block h-full origin-left bg-primary" style={{ width: pct(v.confidence) }} /></span>
    </div>
    <ul aria-label={`${label} evidence`} className="flex flex-wrap gap-1.5">
      {v.evidence.length ? v.evidence.map(x => <li key={x} className="rounded-full border border-(--hair) bg-primary-soft px-2.5 py-0.5 font-code text-label">{x}</li>) : <li className="soft">No keyword or phrase matched.</li>}
    </ul>
  </div>
);

/** Rule-based classification beside the optional second opinion. The engine decides; the AI is advisory and shown with its evidence. */
export function Category({ e }: { e: Entry }) {
  const so = useMutation({ mutationFn: () => call<Second>('insight', 'classifyRequisition', e.id) });
  const r = e.req?.recommendation, d = so.data;
  const engine = r ? { category: r.category, confidence: r.confidence, evidence: r.evidence } : d?.engine;
  return (
    <Card i={2}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4"><h2 className="text-section font-semibold">Category</h2><span className="soft">Rule-based classifier, the engine decides</span></div>
      <div className="mt-4 grid gap-6 md:grid-cols-2 md:gap-8">
        {engine ? <Verdicts v={engine} label="Engine" /> : <p className="soft">The engine has no read command for a requisition, so the saved classification is not shown here. Run the second opinion to see the engine's category for this request.</p>}
        <div className="grid content-start gap-3 md:border-l md:border-(--hair) md:pl-8">
          <Eyebrow>Second opinion, the engine decides</Eyebrow>
          {!d && (
            <>
              <p className="soft">An independent read of the same text. It never approves, awards or changes anything, and the engine's category stays the record.</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" loading={so.isPending} onClick={() => so.mutate()}>Second opinion</Button>
                {so.error && <p role="alert" className="min-w-0 flex-1 font-medium text-(--bad)">{so.error.message}</p>}
              </div>
            </>
          )}
          {d?.source === 'ai' && d.ai && (
            <div className="enter grid gap-3">
              <div className="flex flex-wrap gap-2"><StatusChip tone="neutral">AI second opinion</StatusChip><StatusChip tone={d.agrees ? 'success' : 'warning'}>{d.agrees ? 'Agrees with the engine' : 'Differs from the engine: review the evidence'}</StatusChip></div>
              <Verdicts v={d.ai} label={`AI${d.model ? `, ${d.model}` : ''}`} />
              <p><span className="eyebrow mr-2">Rationale</span>{d.ai.rationale}</p>
            </div>
          )}
          {d?.source === 'engine' && (
            <div className="enter grid gap-3">
              <div className="flex flex-wrap gap-2"><StatusChip tone="neutral">Source: engine</StatusChip><StatusChip tone="warning">No AI opinion</StatusChip></div>
              <p>{d.notice}</p>
              <p className="soft">The rule-based result on the left is all that is available.</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

const Envelope = ({ n }: { n: 1 | 2 }) => (
  <span aria-hidden className="flex gap-1.5 text-primary">
    {Array.from({ length: n }, (_, i) => (
      <svg key={i} viewBox="0 0 32 24" className="h-6 w-8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"><rect x="2" y="3" width="28" height="18" rx="2" /><path d="M2 5l14 10L30 5" /></svg>
    ))}
  </span>
);

export function RouteCard({ r }: { r: Requisition['recommendation'] }) {
  return (
    <Card i={3}>
      <h2 className="text-section font-semibold">Procurement route</h2>
      <p className="numeral mt-3 text-[2.25rem] leading-none">{r.route}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {r.prequal && <StatusChip tone="warning">Prequalification required</StatusChip>}
        {r.longLead && <StatusChip tone="warning">Long lead, {r.leadTimeWeeks} weeks</StatusChip>}
        {!r.prequal && !r.longLead && <StatusChip tone="success">No prequalification</StatusChip>}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-(--hair) pt-4">
        <div><dt className="eyebrow">Minimum bidders</dt><dd className="numeral mt-1 text-[1.5rem] leading-none">{r.minBidders}</dd></div>
        <div><dt className="eyebrow">Envelopes</dt><dd className="mt-1 flex items-center gap-2"><Envelope n={r.envelopes} /><span className="numeral text-[1.5rem] leading-none">{r.envelopes}</span></dd></div>
      </dl>
      <div className="mt-4 border-t border-(--hair) pt-4">
        <Eyebrow>Why the engine chose it</Eyebrow>
        <ul className="mt-2 grid gap-2">{r.reasons.map(x => <li key={x} className="flex gap-2"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-(--gold)" />{x}</li>)}</ul>
      </div>
    </Card>
  );
}

/** Budget check as the engine returned it at submit; the engine checks again when the budget owner approves. */
export function BudgetCard({ r }: { r: Requisition }) {
  const b = r.budget, used = Math.min(100, (b.committed / b.budget) * 100), ask = Math.min(100 - used, (r.amount / b.budget) * 100);
  return (
    <Card i={4}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-section font-semibold">Budget check</h2><StatusChip tone={b.ok ? 'success' : 'danger'}>{b.ok ? 'Within budget' : 'Shortfall'}</StatusChip></div>
      <p className="soft mt-1">Cost code <Mono>{r.costCode}</Mono></p>
      <div className="mt-4" role="img" aria-label={`Committed ${Math.round(used)} percent, this request ${ask.toFixed(1)} percent of budget`}>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-primary-soft ring-1 ring-(--hair)">
          <span className="bg-primary" style={{ width: `${used}%` }} />
          <span className={`${b.ok ? 'bg-(--gold)' : 'bg-danger'} grow-x origin-left`} style={{ width: `${Math.max(ask, 0.8)}%` }} />
        </div>
      </div>
      <dl className="mt-4 grid gap-2">
        {[['Budget', b.budget], ['Committed', b.committed], ['Available', b.available], ['This request', r.amount]].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 border-b border-(--hair) pb-2 last:border-0"><dt className="soft">{k}</dt><dd className={`numeral font-medium ${k === 'Available' ? 'text-[1.25rem]' : ''}`}><Money value={v as number} /></dd></div>
        ))}
      </dl>
      {!b.ok && <p role="status" className="mt-3 font-medium text-danger">Shortfall of <Money value={b.shortfall} />. The engine checks again at approval.</p>}
    </Card>
  );
}

export function ScheduleCard({ r }: { r: Requisition }) {
  const s = r.schedule, [tone, label] = health[s.health];
  return (
    <Card i={5}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1"><h2 className="text-section font-semibold">Sourcing calendar</h2><p className="soft">Planned backwards from the need-by date <Mono>{r.needBy}</Mono></p></div>
        <div className="flex items-center gap-4">
          <div className="text-right"><Eyebrow>Float</Eyebrow><p className="numeral text-[1.875rem] leading-none">{signed(s.floatDays)}<span className="soft text-body"> days</span></p></div>
          <StatusChip tone={tone}>{label}</StatusChip>
        </div>
      </div>
      {s.floatDays < 0 && <p className="mt-3 text-danger">The first milestone is already {Math.abs(s.floatDays)} days behind today, so the engine marks this calendar late.</p>}
      <div className="mt-4"><Timeline s={s} /></div>
      <p className="soft mt-3 hidden md:block">Scroll or pinch to zoom, drag to pan, Fit to reset.</p>
    </Card>
  );
}

export function Case({ e }: { e: Entry }) {
  const r = e.req;
  return (
    <>
      <Track e={e} />
      <Outcome e={e} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-3">
        <div className="grid min-w-0 content-start gap-6 lg:col-span-2">
          <Category key={e.id} e={e} />
          {r && <ScheduleCard r={r} />}
        </div>
        {r && (
          <div className="grid min-w-0 content-start gap-6">
            <RouteCard r={r.recommendation} />
            <BudgetCard r={r} />
          </div>
        )}
      </div>
    </>
  );
}
