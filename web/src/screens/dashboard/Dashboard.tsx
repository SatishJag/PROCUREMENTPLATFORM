import { useQuery } from '@tanstack/react-query';
import { call, getUser } from '../../api';
import { ActionBar } from '../../ui/ActionBar';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { FocusCard } from '../../ui/FocusCard';
import { Money, Num } from '../../ui/Money';
import { PageHeader } from '../../ui/PageHeader';
import { Section } from '../../ui/Section';
import { StatusChip } from '../../ui/StatusChip';
import { Bar, FloatBar, Funnel, Gauge, GlassBudget, minus } from './charts';
import { PipelineDetail, RiskDetail, SavingsDetail } from './details';

// Shape of the engine's reporting.dashboard result (modules/reporting.ts).
export type Dash = {
  pipeline: { planned: number; sourcing: number; awarded: number };
  valueInPipeline: number;
  atRisk: { id: string; title: string; health: string; floatDays: number }[];
  longLead: number;
  savings: { baseline: number; awarded: number; saved: number };
  myApprovals: { type: 'requisition' | 'award'; id: string; value: number }[];
  expiringDocs: { supplier: string; doc: string; expires: string; expired: boolean }[];
  budget: { project: string; costCode: string; budget: number; committed: number; available: number }[];
  audit: { ok: boolean };
};
type Approval = Dash['myApprovals'][number];
type AuditRow = { seq: number; action: string; hash: string; data: { scenario?: string; route?: string[] } };

// Row actions come from each module's `actions` command; only names and labels live here.
const approval = {
  requisition: { module: 'intake', noun: 'Requisition', labels: { approve: 'Approve requisition', reject: 'Reject requisition' } },
  award: { module: 'awards', noun: 'Award', labels: { approved: 'Approve award', rejected: 'Reject award' } },
};
const words = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
const decide = (a: Approval) => (act: string, reason: string) => call(approval[a.type].module, 'decide', a.id, act, reason);
const ActionFor = ({ a, sticky }: { a: Approval; sticky?: boolean }) => <ActionBar module={approval[a.type].module} id={a.id} labels={approval[a.type].labels} run={decide(a)} sticky={sticky} />;

/** The audit trail of one entity: only managers, auditors and admins may read it, so a refusal just means no evidence line. */
const useAudit = (id?: string) => useQuery({ queryKey: ['audit', getUser(), id], enabled: !!id, queryFn: () => call<AuditRow[]>('reporting', 'history', id) });

export function Dashboard() {
  const q = useQuery({ queryKey: ['dashboard', getUser()], queryFn: () => call<Dash>('reporting', 'dashboard') });
  const first = q.data?.myApprovals[0];
  const audit = useAudit(first?.id);
  if (q.error) return <Card glass className="text-(--bad)" role="alert">{(q.error as Error).message}</Card>;
  if (!q.data) return <div aria-busy className="h-96 animate-pulse rounded-hero bg-white/5" />;
  const d = q.data;
  const waiting = d.myApprovals.length;
  const head = audit.data?.at(-1);

  return (
    <>
      <PageHeader
        eyebrow="Project DC1, sample data"
        title="Project dashboard"
        chip={<>
          <StatusChip tone={d.audit.ok ? 'success' : 'danger'}>{d.audit.ok ? 'Audit chain verified' : 'Audit chain broken'}</StatusChip>
          {d.atRisk.length > 0 && <StatusChip tone="warning">{d.atRisk.length} package{d.atRisk.length > 1 ? 's' : ''} at risk</StatusChip>}
          {waiting > 0 && <StatusChip tone="neutral">{waiting} waiting on you</StatusChip>}
        </>}
        figures={[
          { label: 'Value in pipeline', big: true, value: <Money value={d.valueInPipeline} animate big /> },
          { label: 'Saved against estimate', value: <Money value={d.savings.saved} animate /> },
          { label: 'Long-lead packages', value: <Num value={d.longLead} animate /> },
        ]}
        action={first
          ? <div className="grid justify-items-end gap-2 max-md:justify-items-stretch"><ActionFor a={first} sticky />{waiting > 1 && <a href="#my-actions" className="soft underline underline-offset-4 hover:text-(--fg)">and {waiting - 1} more waiting</a>}</div>
          : <div className="flex items-center gap-4 max-md:flex-col max-md:items-stretch"><span className="soft">Nothing is waiting on you.</span><Button variant="secondary" onClick={() => document.getElementById('pipeline')?.scrollIntoView({ behavior: 'smooth' })}>View pipeline</Button></div>}
        visual={<GlassBudget d={d} />}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-3">
        <FocusCard i={1} title="Pipeline" note="Packages reaching each stage" detail={<PipelineDetail d={d} />} className="scroll-mt-6" >
          <span id="pipeline" className="sr-only" />
          <Funnel {...d.pipeline} />
        </FocusCard>
        <FocusCard i={2} title="Savings" note="Awarded value against the estimate" detail={<SavingsDetail d={d} />}>
          <Bar label="Estimate" value={d.savings.baseline} max={d.savings.baseline} tone="bg-peri" />
          <Bar label="Awarded" value={d.savings.awarded} max={d.savings.baseline} tone="bg-primary" />
          <p className="flex items-baseline justify-between border-t border-(--hair) pt-3"><span className="eyebrow">Saved</span><Money value={d.savings.saved} animate className="numeral text-[1.625rem] text-(--ok)" /></p>
        </FocusCard>
        <FocusCard i={3} title="At risk" note="Open packages with negative or low float" detail={<RiskDetail d={d} />}>
          {d.atRisk.length === 0 && <p className="soft">Every open package has float.</p>}
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
            {[...d.atRisk].sort((a, b) => a.floatDays - b.floatDays).slice(0, 3).map(r => (
              <li key={r.id} className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
                <span className="flex items-baseline justify-between gap-3"><span className="min-w-0 truncate font-medium">{r.title}</span><span className="numeral shrink-0 text-section">{minus(r.floatDays)}<span className="soft text-label"> d</span></span></span>
                <span className="soft flex items-center gap-2"><span className="font-code text-label">{r.id}</span></span>
                <FloatBar days={r.floatDays} worst={Math.max(...d.atRisk.map(x => Math.abs(x.floatDays)))} />
              </li>
            ))}
          </ul>
        </FocusCard>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[3fr_2fr]">
        <Card id="my-actions" i={4} className="scroll-mt-6 self-start">
          <h2 className="text-section font-semibold">My actions</h2>
          {waiting === 0 && <p className="soft mt-2">Nothing is waiting on you. Switch role in the top bar to see another queue.</p>}
          <ul className="mt-2 divide-y divide-(--hair)">
            {d.myApprovals.map(a => <ActionRow key={a.id} a={a} />)}
          </ul>
        </Card>
        <div className="grid content-start gap-6">
          <Card i={5}>
            <h2 className="text-section font-semibold">Expiring documents</h2>
            {d.expiringDocs.length === 0 && <p className="soft mt-2">No supplier document expires within 30 days.</p>}
            <ul className="mt-2 divide-y divide-(--hair)">
              {d.expiringDocs.map(x => (
                <li key={x.supplier + x.doc} className="grid gap-1.5 py-3">
                  <span className="font-medium">{x.supplier}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusChip tone={x.expired ? 'danger' : 'warning'}>{x.expired ? 'Expired' : 'Expiring'}</StatusChip>
                    <span className="soft">{x.doc.replace('_', ' ')}, <span className="font-code text-label">{x.expires}</span></span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card i={6} className="flex items-start gap-4">
            <svg aria-hidden viewBox="0 0 24 24" className={`size-9 shrink-0 ${d.audit.ok ? 'text-(--ok)' : 'text-(--bad)'}`} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />{d.audit.ok && <path d="M8.5 12l2.5 2.5 4.5-5" />}</svg>
            <div className="grid gap-1">
              <h2 className="text-section font-semibold">Audit chain</h2>
              <p className="soft">{d.audit.ok ? 'Every entry links to the one before it. The chain was verified when this page loaded.' : 'The chain failed verification. Escalate to the auditor.'}</p>
              {head && <p className="soft">Latest entry on <span className="font-code text-label">{first?.id}</span>: #{head.seq} {head.action}, hash <span className="font-code text-label text-(--fg)">{head.hash.slice(0, 8)}</span></p>}
            </div>
          </Card>
        </div>
      </div>

      <Card i={7}>
        <Section title="Budget by cost code" meta="Committed against budget" defaultOpen>
          <ul className="grid gap-5 pt-3">
            {d.budget.map(b => (
              <li key={b.project + b.costCode} className="grid gap-2 md:grid-cols-[9rem_1fr_16rem] md:items-center md:gap-6">
                <span className="font-code text-label">{b.project} {b.costCode}</span>
                <Gauge value={b.committed} max={b.budget} label={`${b.project} ${b.costCode}`} />
                <span className="soft grid md:text-right"><span><Money value={b.available} className="font-medium text-(--fg)" /> free</span><span>of <Money value={b.budget} /></span></span>
              </li>
            ))}
          </ul>
        </Section>
      </Card>
    </>
  );
}

function ActionRow({ a }: { a: Approval }) {
  const k = approval[a.type];
  const audit = useAudit(a.type === 'award' ? a.id : undefined);
  const rec = audit.data?.find(r => r.action === 'award.recommended');
  return (
    <li className="grid gap-4 py-5 md:grid-cols-[1fr_auto] md:items-center">
      <div className="grid gap-2">
        <p className="eyebrow">{k.noun} <span className="font-code normal-case tracking-normal text-(--fg)">{a.id}</span></p>
        <Money value={a.value} className="numeral text-[1.875rem] leading-none" />
        {rec?.data.scenario && <p className="soft">Scenario: {words(rec.data.scenario)}</p>}
      </div>
      <ActionFor a={a} />
      {rec?.data.route && (
        <ol aria-label="Approval route" className="flex flex-wrap items-center gap-x-3 gap-y-2 md:col-span-2">
          {rec.data.route.map((r, i) => (
            <li key={r} className="flex items-center gap-3">
              {i > 0 && <span aria-hidden className="h-px w-8 bg-(--gold) opacity-60" />}
              <span className="grid size-6 place-items-center rounded-full border border-(--gold) text-label font-medium text-(--gold)">{i + 1}</span>
              <span>{words(r)}</span>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}
