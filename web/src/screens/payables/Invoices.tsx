import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { call } from '../../api';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Field';
import { Money } from '../../ui/Money';
import { Section } from '../../ui/Section';
import { StatusChip } from '../../ui/StatusChip';
import { Ic } from '../../ui/bits';
import { actionsQuery, bad, invLabel, invTone, role, who, words, type Hold, type Invoice } from './data';
import { AskDialog, ErrorNote, Panel, Rows, Waterfall } from './parts';

const chip = (r: Invoice) => <StatusChip tone={invTone[r.status] ?? 'neutral'}>{invLabel[r.status] ?? words(r.status)}</StatusChip>;
const open = (r: Invoice, go: (id: string) => void) => (
  <button type="button" onClick={() => go(r.id)} aria-label={`Open invoice ${r.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-ctl pr-2 font-code text-label font-medium text-(--sec) hover:underline hover:underline-offset-4 active:scale-[0.97] md:min-h-9">{r.id}</button>
);
const held = (r: Invoice) => r.status === 'on_hold' && r.holds.at(-1) && <p className="mt-1 max-w-64 whitespace-normal text-(--soft)">{r.holds.at(-1)!.reason}</p>;

export function InvoiceTab({ rows, name, go }: { rows: Invoice[]; name: (contractId: string) => string; go: (id: string) => void }) {
  if (!rows.length) return <Card glass><p className="soft">No invoice yet. Finance creates one from a validated IPC.</p></Card>;
  return (
    <Card>
      <h2 className="mb-4 text-section font-semibold">AP invoices</h2>
      <Rows caption="AP invoices" rows={rows} rowKey={r => r.id} columns={[
        { key: 'i', header: 'Invoice', cell: r => open(r, go) },
        { key: 's', header: 'Supplier', cell: r => name(r.contractId) },
        { key: 'p', header: 'IPC', mono: true, cell: r => r.ipcId },
        { key: 'd', header: 'Dated', cell: r => r.invoiceDate },
        { key: 'n', header: 'Net payable', align: 'right', cell: r => <Money value={r.calc.netPayable} /> },
        { key: 't', header: 'State', cell: r => <>{chip(r)}{held(r)}{r.approvedBy && <p className="soft mt-1">Approved by {who(r.approvedBy)}</p>}</> },
      ]} card={r => (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">{open(r, go)}{chip(r)}</div>
          <p className="soft">{name(r.contractId)}, dated {r.invoiceDate}</p>
          <Money value={r.calc.netPayable} className="numeral text-section" />
          {held(r)}
        </>
      )} />
    </Card>
  );
}

const run = { approve: 'approveInvoice', reject: 'rejectInvoice', hold: 'hold', release: 'releaseHold', account: 'account' } as Record<string, string>;
const label = { approve: 'Approve invoice', reject: 'Reject invoice', hold: 'Place hold', release: 'Release hold', account: 'Account invoice' } as Record<string, string>;

/** Buttons come from `payables.actions`; segregation of duties, authority limits and closed periods come back from the command and are shown as its reason. */
function Actions({ id }: { id: string }) {
  const qc = useQueryClient();
  const acts = useQuery(actionsQuery(id));
  const [msg, setMsg] = useState<{ bad: boolean; text: string }>({ bad: false, text: '' });
  const [comment, setComment] = useState('');
  const m = useMutation({
    mutationFn: ({ a, args }: { a: string; args: unknown[] }) => call('payables', run[a], id, ...args),
    onSuccess: (_, v) => { setMsg({ bad: false, text: `${label[v.a]}: done.` }); qc.invalidateQueries(); },
    onError: e => setMsg({ bad: true, text: e.message }),
  });
  const go = (a: string, ...args: unknown[]) => { setMsg({ bad: false, text: '' }); return m.mutateAsync({ a, args }); };
  const list = acts.data ?? [];
  const primary = list.find(a => a !== 'reject' && a !== 'hold');
  const reason = acts.error ? bad(acts.error) : acts.isSuccess && !list.length ? 'Nothing for you to do on this invoice.' : '';
  return (
    <>
      {(msg.text || reason) && <p role={msg.bad ? 'alert' : 'status'} className={`min-w-0 flex-1 max-md:basis-full ${msg.bad ? 'font-medium text-(--bad)' : 'soft'}`}>{msg.text || reason}</p>}
      <div className="flex flex-wrap items-center gap-3 md:ml-auto">
        {list.includes('approve') && <Input aria-label="Approval comment, optional" placeholder="Approval comment, optional" value={comment} onChange={e => setComment(e.target.value)} className="md:w-64" />}
        {list.includes('hold') && <AskDialog label="Place hold" title="Place a hold" fields={[{ name: 'reason', label: 'Reason' }, { name: 'owner', label: 'Hold owner', kind: 'person', hint: 'The owner, or an executive other than you, can release it.' }, { name: 'releaseCondition', label: 'Release condition' }]}
          onSubmit={v => go('hold', { reason: v.reason, ownerId: v.owner, releaseCondition: v.releaseCondition })} />}
        {list.includes('reject') && <Button variant="destructive" onReason={r => go('reject', r)}>Reject invoice</Button>}
        {primary === 'release'
          ? <AskDialog primary label="Release hold" title="Release the hold" fields={[{ name: 'comment', label: 'Comment', hint: 'How the release condition was met. Recorded with your name.' }]} onSubmit={v => go('release', v.comment)} />
          : primary && <Button variant="primary" loading={m.isPending && m.variables?.a === primary} disabled={m.isPending} className="max-md:w-full" onClick={() => go(primary, ...(primary === 'approve' ? [comment] : [])).catch(() => {})}>{label[primary]}</Button>}
      </div>
    </>
  );
}

const Step = ({ done, children }: { done: boolean; children: React.ReactNode }) => (
  <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3">
    <span aria-hidden className={`mt-0.5 grid size-7 place-items-center rounded-full border ${done ? 'border-(--gold) bg-(--gold) text-(--btn-fg)' : 'border-dashed border-(--soft) text-(--soft)'}`}>{done ? <Ic n="check" className="size-4" /> : <Ic n="clock" className="size-4" />}</span>
    <div className="grid gap-0.5">{children}</div>
  </li>
);
const Person = ({ id }: { id?: string }) => <span className="font-medium">{who(id)}<span className="soft font-normal">{role(id) && `, ${role(id)}`}</span></span>;

function Trail({ inv }: { inv: Invoice }) {
  const rej = inv.status === 'rejected', hold = inv.status === 'on_hold';
  return (
    <ol aria-label="Approval trail" className="grid gap-4">
      <Step done><p>Certified by <Person id={inv.certifiedBy} /></p><p className="soft">IPC <span className="font-code text-label">{inv.ipcId}</span>, certified in the PMIS</p></Step>
      <Step done><p>Prepared by <Person id={inv.preparedBy} /></p><p className="soft">Invoice dated {inv.invoiceDate}</p></Step>
      {rej ? <Step done><p className="font-medium text-(--bad)">Rejected</p><p>&ldquo;{inv.rejectedReason}&rdquo;</p></Step>
        : inv.approvedBy ? <Step done><p>Approved by <Person id={inv.approvedBy} /></p>{inv.approvalComment && <p className="soft">&ldquo;{inv.approvalComment}&rdquo;</p>}</Step>
          : <Step done={false}><p className="font-medium">{hold ? 'Approval paused by the hold' : 'Awaiting approval'}</p><p className="soft">{hold ? 'A released invoice is approved afresh.' : 'Needs an approver who did not prepare or certify it, with authority for this amount.'}</p></Step>}
      {!rej && <Step done={!!inv.journalId}><p className={inv.journalId ? '' : 'font-medium'}>{inv.journalId ? <>Accounted, journal <span className="font-code text-label">{inv.journalId}</span></> : 'Not accounted yet'}</p></Step>}
    </ol>
  );
}

function Holds({ holds }: { holds: Hold[] }) {
  return (
    <ul className="grid gap-4">
      {holds.map((h, k) => (
        <li key={k} className="grid gap-1 rounded-ctl border border-(--hair) p-4">
          <p className="flex flex-wrap items-center gap-2"><StatusChip tone={h.releasedBy ? 'neutral' : 'danger'}>{h.releasedBy ? 'Released' : 'Active hold'}</StatusChip><span className="font-medium">{h.reason}</span></p>
          <p className="soft">Placed by {who(h.placedBy)} on {h.placedOn}. Owner <span className="font-medium text-(--fg)">{who(h.ownerId)}</span>.</p>
          <p>Release condition: {h.releaseCondition}</p>
          <p className="soft">Release authority: {h.releaseAuthority}.</p>
          {h.releasedBy && <p className="soft">Released by {who(h.releasedBy)} on {h.releasedOn}: &ldquo;{h.releaseComment}&rdquo;</p>}
        </li>
      ))}
    </ul>
  );
}

export function InvoicePanel({ inv, name, onClose, openIpc }: { inv: Invoice | undefined; name: (contractId: string) => string; onClose: () => void; openIpc: (id: string) => void }) {
  return (
    <Panel open title={inv ? `Invoice ${inv.id}` : 'Invoice'} note={inv && <>{name(inv.contractId)}, <span className="font-code text-label">{inv.contractId}</span>{inv.taxInvoiceNo && <>, tax invoice <span className="font-code text-label">{inv.taxInvoiceNo}</span></>}</>}
      chips={inv && chip(inv)} onClose={onClose} footer={inv && <Actions id={inv.id} />}>
      {!inv && <ErrorNote>This invoice is not in your list.</ErrorNote>}
      {inv && (
        <>
          <div className="grid gap-1">
            <p className="eyebrow">Net payable</p>
            <Money value={inv.calc.netPayable} className="numeral text-[2.25rem] leading-none md:text-[3rem]" />
            <button type="button" onClick={() => openIpc(inv.ipcId)} className="mt-1 min-h-11 justify-self-start rounded-ctl px-1 font-medium text-(--sec) underline underline-offset-4 hover:bg-(--sec-hover) active:scale-[0.97] md:min-h-9">View IPC {inv.ipcId}</button>
          </div>
          <div className="grid gap-3"><h3 className="text-section font-semibold">Approval trail</h3><Trail inv={inv} /></div>
          {inv.holds.length > 0 && <div className="grid gap-3"><h3 className="text-section font-semibold">Holds</h3><Holds holds={inv.holds} /></div>}
          <Section title="Gross to net payable" meta="Engine calculation"><Waterfall c={inv.calc} /></Section>
        </>
      )}
    </Panel>
  );
}
