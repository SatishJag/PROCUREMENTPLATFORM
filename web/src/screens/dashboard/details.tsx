import { Money } from '../../ui/Money';
import { StatusChip } from '../../ui/StatusChip';
import { Table, type Column } from '../../ui/Table';
import { Zoomable } from '../../ui/Zoomable';
import { Bar, FloatBar, Funnel, Timeline, minus } from './charts';
import type { Dash } from './Dashboard';
import { useRegister, type Pkg } from './register';

const h3 = 'text-section font-semibold';
const Limited = ({ message }: { message: string }) => <p className="soft rounded-ctl border border-(--hair) bg-porcelain-dim p-4">Package register unavailable to you: {message}</p>;

/** Pipeline panel: the deciding number, the funnel, a zoomable delivery timeline and the full package register. */
export function PipelineDetail({ d }: { d: Dash }) {
  const reg = useRegister();
  const risk = (id: string) => d.atRisk.find(a => a.id === id);
  const cols: Column<Pkg>[] = [
    { key: 'id', header: 'Package', cell: p => <><span className="font-code text-label">{p.id}</span><br />{p.title}</> },
    { key: 'cat', header: 'Category', cell: p => p.category },
    { key: 'route', header: 'Route', cell: p => p.route },
    { key: 'st', header: 'Status', cell: p => <StatusChip tone={p.status === 'awarded' ? 'success' : 'neutral'}>{p.status}</StatusChip> },
    { key: 'need', header: 'Need by', mono: true, cell: p => p.needBy },
    { key: 'float', header: 'Float', cell: p => p.status === 'awarded' ? 'Awarded' : risk(p.id) ? <StatusChip tone="danger">{minus(risk(p.id)!.floatDays)} days</StatusChip> : <StatusChip tone="success">On track</StatusChip> },
    { key: 'est', header: 'Estimate', align: 'right', cell: p => <Money value={p.estimate} /> },
    { key: 'awd', header: 'Awarded', align: 'right', cell: p => p.awarded === null ? <span className="soft">pending</span> : <Money value={p.awarded} /> },
    { key: 'next', header: 'Next step', cell: p => p.next || <span className="soft">none</span> },
  ];
  return (
    <div className="grid gap-8">
      <div className="grid items-end gap-6 md:grid-cols-[auto_1fr]">
        <div>
          <p className="eyebrow">Value in pipeline</p>
          <p className="numeral mt-1 text-[2.5rem] leading-none md:text-display"><Money value={d.valueInPipeline} big /></p>
        </div>
        <div className="max-w-md"><Funnel {...d.pipeline} bare /></div>
      </div>
      {reg.error && <Limited message={(reg.error as Error).message} />}
      {reg.data && reg.data.length > 0 && (
        <>
          <section className="grid gap-3">
            <h3 className={h3}>Delivery timeline</h3>
            <Zoomable label="Delivery timeline" className="h-[26rem]">{k => <Timeline pkgs={reg.data} atRisk={d.atRisk} k={k} />}</Zoomable>
            <p className="soft">Each lane runs to the package's need-by date. Scroll, pinch or drag; more detail appears as you zoom in.</p>
          </section>
          <section className="grid gap-3">
            <h3 className={h3}>Package register</h3>
            <Table caption="Package register" columns={cols} rows={reg.data} rowKey={p => p.id} />
          </section>
        </>
      )}
    </div>
  );
}

export function SavingsDetail({ d }: { d: Dash }) {
  const reg = useRegister();
  const awarded = reg.data?.filter(p => p.status === 'awarded') ?? [];
  const pending = d.myApprovals.filter(a => a.type === 'award');
  return (
    <div className="grid gap-8">
      <div>
        <p className="eyebrow">Saved against estimate</p>
        <p className="numeral mt-1 text-[2.5rem] leading-none text-(--ok) md:text-display"><Money value={d.savings.saved} big /></p>
      </div>
      <div className="grid max-w-xl gap-4">
        <Bar label="Estimate" value={d.savings.baseline} max={d.savings.baseline} tone="bg-peri" />
        <Bar label="Awarded" value={d.savings.awarded} max={d.savings.baseline} tone="bg-primary" />
      </div>
      {awarded.length > 0 && (
        <section className="grid gap-3">
          <h3 className={h3}>Awarded packages</h3>
          <Table caption="Awarded packages" rowKey={p => p.id} rows={awarded} columns={[
            { key: 'id', header: 'Package', cell: p => <><span className="font-code text-label">{p.id}</span><br />{p.title}</> },
            { key: 'est', header: 'Estimate', align: 'right', cell: p => <Money value={p.estimate} /> },
            { key: 'awd', header: 'Awarded', align: 'right', cell: p => <Money value={p.awarded ?? 0} /> },
          ]} />
        </section>
      )}
      {reg.error && <Limited message={(reg.error as Error).message} />}
      {pending.map(a => (
        <p key={a.id} className="rounded-ctl border border-(--hair) bg-porcelain-dim p-4">
          <span className="font-code text-label">{a.id}</span> is waiting for approval at <Money value={a.value} className="font-medium" />. It is not counted in these savings until it is approved.
        </p>
      ))}
    </div>
  );
}

export function RiskDetail({ d }: { d: Dash }) {
  const reg = useRegister();
  const worst = Math.max(...d.atRisk.map(r => Math.abs(r.floatDays)), 1);
  const rows = [...d.atRisk].sort((a, b) => a.floatDays - b.floatDays);
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <p className="eyebrow">Worst float</p>
        <p className="numeral text-[2.5rem] leading-none text-(--bad) md:text-display">{minus(rows[0]?.floatDays ?? 0)}<span className="ml-2 text-section font-medium tracking-normal">days</span></p>
      </div>
      {reg.error && <Limited message={(reg.error as Error).message} />}
      <ul className="grid gap-5">
        {rows.map(r => {
          const p = reg.data?.find(x => x.id === r.id);
          return (
            <li key={r.id} className="grid gap-2 border-b border-(--hair) pb-5 last:border-0 md:grid-cols-[1fr_16rem] md:items-center md:gap-8">
              <div className="grid gap-1">
                <p className="font-medium">{r.title}</p>
                <p className="soft flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-code text-label">{r.id}</span>{p && <>need by <span className="font-code text-label">{p.needBy}</span>{p.longLead && <StatusChip tone="warning">Long lead</StatusChip>}<span>next: {p.next || 'none'}</span></>}</p>
              </div>
              <div className="grid gap-1.5">
                <p className="flex items-baseline justify-between"><StatusChip tone={r.health === 'late' ? 'danger' : 'warning'}>{r.health.replace('_', ' ')}</StatusChip><span className="numeral text-[1.625rem]">{minus(r.floatDays)} <span className="soft text-body font-normal">days</span></span></p>
                <FloatBar days={r.floatDays} worst={worst} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
