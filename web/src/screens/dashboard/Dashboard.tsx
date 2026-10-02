import { useQuery } from '@tanstack/react-query';
import { call, getUser } from '../../api';
import { ActionBar } from '../../ui/ActionBar';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Money, Num } from '../../ui/Money';
import { PageHeader } from '../../ui/PageHeader';
import { StatusChip } from '../../ui/StatusChip';
import { Bar, Funnel, Preview } from './charts';

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

// Row actions come from each module's `actions` command; only names and labels live here.
const approval = {
  requisition: { module: 'intake', noun: 'Requisition', labels: { approve: 'Approve requisition', reject: 'Reject requisition' } },
  award: { module: 'awards', noun: 'Award', labels: { approved: 'Approve award', rejected: 'Reject award' } },
};
const title = 'text-section font-semibold';

export function Dashboard() {
  const q = useQuery({ queryKey: ['dashboard', getUser()], queryFn: () => call<Dash>('reporting', 'dashboard') });
  if (q.error) return <Card className="text-danger" role="alert">{(q.error as Error).message}</Card>;
  if (!q.data) return <div aria-busy className="h-80 animate-pulse rounded-hero bg-primary-soft" />;
  const d = q.data;
  const waiting = d.myApprovals.length;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Project dashboard"
        chip={<>
          <StatusChip tone={d.audit.ok ? 'success' : 'danger'}>{d.audit.ok ? 'Audit chain verified' : 'Audit chain broken'}</StatusChip>
          {d.atRisk.length > 0 && <StatusChip tone="warning">{d.atRisk.length} package{d.atRisk.length > 1 ? 's' : ''} at risk</StatusChip>}
        </>}
        figures={[
          { label: 'Value in pipeline', big: true, value: <Money value={d.valueInPipeline} animate /> },
          { label: 'Saved against estimate', value: <Money value={d.savings.saved} animate /> },
          { label: 'Long-lead packages', value: <Num value={d.longLead} animate /> },
        ]}
        action={
          <div className="flex items-center gap-3 max-md:flex-col max-md:items-stretch">
            {!waiting && <span className="text-on-hero-soft">Nothing is waiting on you</span>}
            <Button variant="primary" disabled={!waiting} onClick={() => document.getElementById('my-actions')?.scrollIntoView({ behavior: 'smooth' })}>Review actions</Button>
          </div>
        }
        visual={<Preview d={d} />}
      />

      <div className="relative z-10 -mt-14 grid gap-6 px-1 md:px-6 lg:grid-cols-3">
        <Card i={1} lift className="grid content-start gap-3">
          <h2 className={title}>Pipeline</h2>
          <p className="text-ink-soft">Packages reaching each stage</p>
          <Funnel {...d.pipeline} />
        </Card>
        <Card i={2} lift className="grid content-start gap-3">
          <h2 className={title}>Savings</h2>
          <p className="text-ink-soft">Awarded value against the estimate</p>
          <Bar label="Estimate" value={d.savings.baseline} max={d.savings.baseline} tone="bg-peri" />
          <Bar label="Awarded" value={d.savings.awarded} max={d.savings.baseline} tone="bg-primary" />
          <p className={title}>Saved <Money value={d.savings.saved} animate className="text-success" /></p>
        </Card>
        <Card i={3} lift className="grid content-start gap-3">
          <h2 className={title}>At risk</h2>
          {d.atRisk.length === 0 && <p className="text-ink-soft">Every open package has float.</p>}
          <ul className="grid gap-3">
            {d.atRisk.map(r => (
              <li key={r.id} className="grid gap-1">
                <span className="font-medium">{r.title}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <StatusChip tone={r.health === 'late' ? 'danger' : 'warning'}>{r.health.replace('_', ' ')}</StatusChip>
                  <span className="text-ink-soft"><span className="font-code">{r.id}</span>, float <Num value={r.floatDays} className="font-semibold text-ink" /> days</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 px-1 md:px-6 lg:grid-cols-[3fr_2fr]">
        <Card id="my-actions" i={4} className="scroll-mt-4">
          <h2 className={title}>My actions</h2>
          {waiting === 0 && <p className="mt-2 text-ink-soft">Nothing is waiting on you. Switch role in the top bar to see another queue.</p>}
          <ul className="mt-3 divide-y divide-line">
            {d.myApprovals.map(a => {
              const k = approval[a.type];
              return (
                <li key={a.id} className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <p className="font-medium">{k.noun} <span className="font-code">{a.id}</span></p>
                    <Money value={a.value} className="text-ink-soft" />
                  </div>
                  <ActionBar module={k.module} id={a.id} labels={k.labels} run={(act, reason) => call(k.module, 'decide', a.id, act, reason)} />
                </li>
              );
            })}
          </ul>
        </Card>
        <Card i={5}>
          <h2 className={title}>Expiring documents</h2>
          {d.expiringDocs.length === 0 && <p className="mt-2 text-ink-soft">No supplier document expires within 30 days.</p>}
          <ul className="mt-3 divide-y divide-line">
            {d.expiringDocs.map(x => (
              <li key={x.supplier + x.doc} className="grid gap-1 py-3">
                <span className="font-medium">{x.supplier}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <StatusChip tone={x.expired ? 'danger' : 'warning'}>{x.expired ? 'Expired' : 'Expiring'}</StatusChip>
                  <span className="text-ink-soft">{x.doc.replace('_', ' ')}, <span className="font-code">{x.expires}</span></span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <details open className="px-1 md:px-6">
        <summary className={`${title} cursor-pointer rounded-ctl px-1 py-2`}>Budget by cost code</summary>
        <Card i={6} className="mt-2 grid gap-4">
          {d.budget.map(b => (
            <div key={b.project + b.costCode} className="grid gap-1 md:grid-cols-[8rem_1fr_14rem] md:items-center md:gap-4">
              <span className="font-code">{b.project} {b.costCode}</span>
              <Bar value={b.committed} max={b.budget} tone="bg-primary" />
              <span className="text-ink-soft md:text-right"><Money value={b.available} className="font-semibold text-ink" /> free</span>
            </div>
          ))}
        </Card>
      </details>
    </div>
  );
}
