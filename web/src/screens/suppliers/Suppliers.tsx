import { useQueries } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { call, getUser } from '../../api';
import { ActionBar } from '../../ui/ActionBar';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Field, Input } from '../../ui/Field';
import { Num } from '../../ui/Money';
import { PageHeader } from '../../ui/PageHeader';
import { StatusChip } from '../../ui/StatusChip';
import { Select } from '../../ui/bits';
import { alerts, useDirectory, words, type DocFlag, type Sup } from './data';
import { RegisterDialog } from './Register';
import { SupplierCard } from './SupplierCard';

const STATUSES = ['invited', 'registered', 'qualified', 'suspended', 'rejected'].map(s => [s, words(s)] as [string, string]);
const RISKS = ['low', 'medium', 'high'].map(s => [s, words(s)] as [string, string]);
const labels = { qualify: 'Qualify supplier', reject: 'Reject supplier', reinstate: 'Reinstate supplier', suspend: 'Suspend supplier' };
const destructive = /^(reject|suspend|withdraw)/;

export function Suppliers() {
  const q = useDirectory();
  const all = q.data?.suppliers ?? [];
  // Which supplier waits on this user is the engine's answer (suppliers.actions), asked per supplier. ponytail: one call each, fine for a sample register.
  const acts = useQueries({ queries: all.map(s => ({ queryKey: ['actions', getUser(), 'suppliers', s.id], queryFn: () => call<string[]>('suppliers', 'actions', s.id) })) });
  const queue = all.filter((_, i) => acts[i]?.data?.some(a => !destructive.test(a)));
  const first = queue[0];

  const [text, setText] = useState('');
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState('');
  const [risk, setRisk] = useState('');
  const shown = useMemo(() => {
    const t = text.trim().toLowerCase();
    return all.filter(s => (!t || `${s.name} ${s.id} ${s.country ?? ''}`.toLowerCase().includes(t)) && (!cat || s.categories.includes(cat)) && (!status || s.status === status) && (!risk || s.risk === risk))
      .sort((a, b) => alerts(b) - alerts(a) || a.name.localeCompare(b.name));
  }, [all, text, cat, status, risk]);
  const filtered = !!(text || cat || status || risk);

  const sample = <StatusChip tone="neutral">Sample data, fictional suppliers</StatusChip>;
  if (q.error) return (
    <>
      <PageHeader eyebrow="Project DC1" title="Suppliers" chip={sample} action={<RegisterDialog />} />
      <Card glass i={1} role="alert" className="grid max-w-2xl gap-2">
        <h2 className="text-section font-semibold">The directory is not open to your role</h2>
        <p className="font-medium text-(--bad)">{(q.error as Error).message}</p>
        <p className="soft">Supplier-portal users see their own registration only. Switch role in the top bar to browse the register.</p>
      </Card>
    </>
  );
  if (!q.data) return <div aria-busy className="h-96 animate-pulse rounded-hero bg-white/5" />;

  const d = q.data;
  const docAlerts = d.suppliers.reduce((n, s) => n + alerts(s), 0);
  const waiting = d.suppliers.filter(s => s.status === 'registered' || s.status === 'invited').length;
  // Registration is the supplier's own step (no engine `actions` entry), so for browsing roles it is a quiet secondary; the header primary is the engine's next step.
  const register = <RegisterDialog variant="secondary" />;

  return (
    <>
      <PageHeader
        eyebrow="Project DC1"
        title="Suppliers"
        chip={<>
          {docAlerts > 0 && <StatusChip tone="warning">{docAlerts} document alert{docAlerts > 1 ? 's' : ''}</StatusChip>}
          {sample}
        </>}
        figures={[
          { label: 'Qualified suppliers', big: true, value: <Num value={d.suppliers.filter(s => s.status === 'qualified').length} animate /> },
          { label: 'Awaiting qualification', value: <Num value={waiting} animate /> },
          { label: 'Document alerts', value: <Num value={docAlerts} animate /> },
        ]}
        visual={<Mix suppliers={d.suppliers} />}
        action={first
          ? <div className="grid justify-items-end gap-2 max-md:justify-items-stretch">
              <ActionBar module="suppliers" id={first.id} labels={labels} run={(a, r) => call('suppliers', 'qualify', first.id, a, r)} sticky />
              <p className="soft">{first.name} is waiting for you{queue.length > 1 ? `, and ${queue.length - 1} more` : ''}.</p>
            </div>
          : undefined}
      />

      <Card glass i={1} aria-labelledby="watch" className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="watch" className="text-section font-semibold">Compliance watch</h2>
          <p className="soft">Documents expired or expiring within 30 days, as the engine reports them.</p>
        </div>
        {d.flags.length === 0 && <p className="soft">No supplier document is expired or expires within 30 days.</p>}
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {d.flags.map(f => <Watch key={f.supplier + f.doc} f={f} onShow={() => { setText(f.supplier); setCat(''); setStatus(''); setRisk(''); }} />)}
        </ul>
      </Card>

      <Card i={2} aria-label="Directory filters" className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <Field label="Search"><Input type="search" value={text} onChange={e => setText(e.target.value)} placeholder="Name, ID or country" /></Field>
          <Select label="Category" value={cat} onChange={setCat} placeholder="All categories" options={d.categories.map(c => [c, c])} />
          <Select label="Status" value={status} onChange={setStatus} placeholder="All statuses" options={STATUSES} />
          <Select label="Risk" value={risk} onChange={setRisk} placeholder="All risk levels" options={RISKS} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="soft">Showing <span className="font-medium text-(--fg)">{shown.length}</span> of {all.length} suppliers, documents with alerts first.</p>
          <div className="flex items-center gap-3">
            {filtered && <Button variant="text" onClick={() => { setText(''); setCat(''); setStatus(''); setRisk(''); }}>Clear filters</Button>}
            {register}
          </div>
        </div>
        {d.notes.length > 0 && <p className="soft" role="status">{d.notes[0]} Performance and eligibility need that role.</p>}
      </Card>

      {shown.length === 0 && <Card glass className="soft">No supplier matches these filters.</Card>}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((s: Sup, i) => <SupplierCard key={s.id} s={s} i={i + 3} />)}
      </div>
    </>
  );
}

function Watch({ f, onShow }: { f: DocFlag; onShow: () => void }) {
  return (
    <li className="grid gap-1.5 rounded-ctl border border-(--hair) bg-white/[0.04] px-4 py-3">
      <p className="flex items-baseline justify-between gap-3"><span className="min-w-0 truncate font-medium">{f.supplier}</span><Button variant="text" onClick={onShow} aria-label={`Show ${f.supplier}`} className="shrink-0 !px-1">Show</Button></p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusChip tone={f.expired ? 'danger' : 'warning'}>{f.expired ? 'Expired' : 'Expiring'}</StatusChip>
        <span className="soft">{words(f.doc)}, <span className="font-code text-label text-(--fg)">{f.expires}</span></span>
      </p>
    </li>
  );
}

/** The register at a glance, counted from the rows shown: risk bars grow by transform; status counts beside them. */
function Mix({ suppliers }: { suppliers: Sup[] }) {
  const risks = (['low', 'medium', 'high'] as const).map(r => [r, suppliers.filter(s => s.risk === r).length] as const);
  const tone = { low: 'bg-(--ok)', medium: 'bg-(--warn)', high: 'bg-(--bad)' };
  return (
    <Card glass i={2} aria-label="Register at a glance" className="grid gap-4">
      <p className="eyebrow">Risk across {suppliers.length} suppliers</p>
      <ul className="grid gap-3">
        {risks.map(([r, n]) => (
          <li key={r} className="grid grid-cols-[4.5rem_1fr_1.5rem] items-center gap-3">
            <span className="soft">{words(r)}</span>
            <span role="img" aria-label={`${n} of ${suppliers.length}`} className="h-2 overflow-hidden rounded-full bg-white/10"><span className={`grow-x block h-full origin-left rounded-full ${tone[r]}`} style={{ transform: `scaleX(${n / (suppliers.length || 1)})` }} /></span>
            <span className="numeral text-right text-section">{n}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
