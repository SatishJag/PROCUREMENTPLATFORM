import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Field';
import { StatusChip } from '../../ui/StatusChip';
import { Table } from '../../ui/Table';
import { Check, Ic, Select, cell } from '../../ui/bits';
import { DEMO_TODAY, PEOPLE, aed, type Delegation, type NoticeRow, type Store } from './fixtures';
import { person } from './logic';

type Common = { store: Store; setStore: (f: (s: Store) => Store) => void; canEdit: boolean; why: string };
const approvers = PEOPLE.filter(p => p.limit != null).map(p => [p.id, `${p.name}, limit ${aed(p.limit!)}`] as [string, string]);

function problem(d: Delegation): { tone: 'danger' | 'warning' | 'success'; text: string } {
  const a = person(d.from), b = person(d.to);
  if (d.from === d.to) return { tone: 'danger', text: 'A person cannot delegate to themselves.' };
  if (d.end < d.start) return { tone: 'danger', text: 'The end date is before the start date.' };
  if (a && b && (b.limit ?? 0) < (a.limit ?? 0)) return { tone: 'warning', text: `${b.name} acts within their own limit of ${aed(b.limit ?? 0)}. Requests above it go to the next tier.` };
  return { tone: 'success', text: 'Delegate covers the full authority limit.' };
}

export function Delegation({ store, setStore, canEdit, why }: Common) {
  const set = (id: string, p: Partial<Delegation>) => setStore(s => ({ ...s, delegations: s.delegations.map(d => d.id === id ? { ...d, ...p } : d) }));
  const add = () => setStore(s => ({ ...s, delegations: [...s.delegations, { id: `d${Date.now().toString(36)}`, from: 'u-daniel', to: 'u-fatima', start: DEMO_TODAY, end: DEMO_TODAY, scope: 'All approval workflows' }] }));
  const del = (d: Delegation) => (reason: string) => setStore(s => ({ ...s, delegations: s.delegations.filter(x => x.id !== d.id), log: [{ at: DEMO_TODAY, who: 'You (demo)', wf: 'Delegation', text: `Delegation from ${person(d.from)?.name} to ${person(d.to)?.name} removed`, reason }, ...s.log] }));
  return (
    <Card as="div" className="grid gap-4" aria-label="Delegation of authority">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto"><h3 className="text-section font-semibold">Out-of-office delegation</h3><p className="text-ink-soft">A delegate approves within their own authority limit, never the delegator's. Segregation of duties still applies.</p></div>
        {!canEdit && <span className="flex items-center gap-2 text-ink-soft"><Ic n="lock" />{why}</span>}
        <Button variant="primary" onClick={add} disabled={!canEdit}>Add delegation</Button>
      </div>
      <fieldset disabled={!canEdit} className="min-w-0 border-0 p-0">
        <Table caption="Delegations" rows={store.delegations} rowKey={d => d.id} columns={[
          { key: 'from', header: 'Delegator', cell: d => <Select label="" aria="Delegator" value={d.from} onChange={v => set(d.id, { from: v })} options={approvers} className="min-w-52" /> },
          { key: 'to', header: 'Delegate', cell: d => <Select label="" aria="Delegate" value={d.to} onChange={v => set(d.id, { to: v })} options={approvers} className="min-w-52" /> },
          { key: 'start', header: 'From', cell: d => <input type="date" aria-label="From" value={d.start} onChange={e => set(d.id, { start: e.target.value })} className={cell} /> },
          { key: 'end', header: 'To', cell: d => <input type="date" aria-label="To" value={d.end} onChange={e => set(d.id, { end: e.target.value })} className={cell} /> },
          { key: 'scope', header: 'Applies to', cell: d => <div className="min-w-56"><Input aria-label="Applies to" value={d.scope} onChange={e => set(d.id, { scope: e.target.value })} /></div> },
          { key: 'check', header: 'Check', cell: d => { const p = problem(d); return <div className="grid w-72 gap-1"><span><StatusChip tone={p.tone}>{p.tone === 'success' ? 'Valid' : p.tone === 'warning' ? 'Capped' : 'Blocked'}</StatusChip></span><span className="text-ink-soft">{p.text}</span></div>; } },
          { key: 'x', header: '', cell: d => <Button variant="destructive" onReason={del(d)} className="!h-9 !px-3">Remove</Button> },
        ]} />
      </fieldset>
    </Card>
  );
}

const sample: Record<string, string> = { '{request}': 'Chilled water plant award', '{hours}': '6', '{stage}': 'Budget owner approval', '{approver}': 'Fatima Al Mansoori', '{reason}': 'Budget not confirmed' };
const fill = (t: string) => Object.entries(sample).reduce((s, [k, v]) => s.replaceAll(k, v), t);

export function Notifications({ store, setStore, canEdit, why }: Common) {
  const set = (id: string, p: Partial<NoticeRow>) => setStore(s => ({ ...s, notices: s.notices.map(n => n.id === id ? { ...n, ...p } : n) }));
  return (
    <Card as="div" className="grid gap-4" aria-label="Notifications">
      <div><h3 className="text-section font-semibold">Notifications</h3><p className="text-ink-soft">Which event tells whom, and where. Stages can switch email and in-app notices off for themselves.</p></div>
      {!canEdit && <p className="flex items-center gap-2 text-ink-soft"><Ic n="lock" />{why}</p>}
      <fieldset disabled={!canEdit} className="min-w-0 border-0 p-0">
        <Table caption="Notification events" rows={store.notices} rowKey={n => n.id} columns={[
          { key: 'event', header: 'Event', cell: n => <span className="font-medium">{n.event}</span> },
          { key: 'to', header: 'Sent to', cell: n => n.to },
          { key: 'email', header: 'Email', cell: n => <Check aria={`Email for ${n.event}`} checked={n.email} onChange={email => set(n.id, { email })} /> },
          { key: 'inApp', header: 'In-app', cell: n => <Check aria={`In-app for ${n.event}`} checked={n.inApp} onChange={inApp => set(n.id, { inApp })} /> },
          { key: 'subject', header: 'Subject template', cell: n => <Input aria-label={`Subject for ${n.event}`} value={n.subject} onChange={e => set(n.id, { subject: e.target.value })} className="min-w-72" /> },
          { key: 'preview', header: 'Preview with sample data', cell: n => <span className="text-ink-soft">{fill(n.subject)}</span> },
        ]} />
      </fieldset>
    </Card>
  );
}
