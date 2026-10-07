import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { call } from '../../api';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Money } from '../../ui/Money';
import { PageHeader } from '../../ui/PageHeader';
import { StatusChip } from '../../ui/StatusChip';
import { Tabs } from '../../ui/bits';
import { ContractTab } from './Contracts';
import { actionsQuery, bad, download, useContracts, useInvoices, useIpcs, useJournals, type Batch } from './data';
import { InvoicePanel, InvoiceTab } from './Invoices';
import { IpcPanel, IpcTab } from './Ipcs';
import { JournalTab, type Exported } from './Journals';
import { ErrorNote } from './parts';

type Tab = 'ipcs' | 'invoices' | 'journals' | 'contracts';
type Sel = { t: 'ipc' | 'inv'; id: string } | null;
const r2 = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Construction accounts payable: certified IPC to approved invoice to subledger journal to GL export. Every rule (segregation of duties, limits, closed periods) is the engine's. */
export function Payables() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('invoices');
  const [sel, setSel] = useState<Sel>(null);
  const [exported, setExported] = useState<Exported | 'none'>();
  const [alert, setAlert] = useState('');
  const ipcs = useIpcs(), invs = useInvoices(), js = useJournals(), cts = useContracts();
  const I = ipcs.data ?? [], V = invs.data ?? [], J = js.data ?? [], C = cts.data ?? [];
  const live = V.filter(v => ['approval_required', 'approved', 'on_hold'].includes(v.status));
  const acts = useQueries({ queries: live.map(v => actionsQuery(v.id)) });
  const can = (a: string) => live.filter((_, i) => acts[i]?.data?.includes(a));
  const exp = useMutation({
    mutationFn: () => call<Batch>('payables', 'exportJournals'),
    onSuccess: b => { setAlert(''); setExported(b.batchId ? b : 'none'); setTab('journals'); if (b.batchId) download(`${b.batchId}.csv`, b.csv); qc.invalidateQueries(); },
    onError: e => setAlert(e.message),
  });

  const name = (cid: string) => C.find(c => c.id === cid)?.supplierName ?? cid;
  const awaiting = V.filter(v => v.status === 'approval_required'), held = V.filter(v => v.status === 'on_hold');
  const ready = I.filter(i => i.status === 'validated'), pend = J.filter(j => j.status === 'pending_transfer');
  const pendValue = r2(pend.map(j => V.find(v => v.id === j.invoiceId)?.calc.netPayable ?? 0));
  const toApprove = can('approve'), toAccount = can('account'), toRelease = can('release');
  const open = (t: Tab, s: Sel) => { setTab(t); setSel(s); };
  const exportIt = { label: 'Export to GL', run: () => exp.mutate() };
  const primary = (tab === 'journals' && pend.length ? exportIt : undefined)
    ?? (toApprove.length ? { label: `Review ${plural(toApprove.length, 'invoice')}`, run: () => open('invoices', { t: 'inv', id: toApprove[0].id }) } : undefined)
    ?? (toAccount.length ? { label: `Account ${plural(toAccount.length, 'invoice')}`, run: () => open('invoices', { t: 'inv', id: toAccount[0].id }) } : undefined)
    ?? (toRelease.length ? { label: 'Release hold', run: () => open('invoices', { t: 'inv', id: toRelease[0].id }) } : undefined)
    ?? (pend.length ? exportIt : undefined)
    ?? (ready.length ? { label: 'Create invoice', run: () => open('ipcs', { t: 'ipc', id: ready[0].id }) } : undefined);

  const failed = invs.error ?? ipcs.error;
  const loading = !failed && (invs.isPending || ipcs.isPending);
  return (
    <>
      <PageHeader
        eyebrow="Project DC1, sample data"
        title="Payables"
        chip={failed ? undefined : <>
          <StatusChip tone={awaiting.length ? 'warning' : 'neutral'}>{plural(awaiting.length, 'invoice')} awaiting approval</StatusChip>
          {held.length > 0 && <StatusChip tone="danger">{held.length} on hold</StatusChip>}
          {pend.length > 0 && <StatusChip tone="warning">{plural(pend.length, 'journal')} to export</StatusChip>}
          {primary && <StatusChip tone="success">Waiting on you</StatusChip>}
        </>}
        figures={failed ? [] : [
          { label: `Awaiting approval, ${plural(awaiting.length, 'invoice')}`, big: true, value: <Money value={r2(awaiting.map(v => v.calc.netPayable))} big animate /> },
          { label: `Ready to invoice, ${ready.length}`, value: <Money value={r2(ready.map(i => i.calc?.netPayable ?? 0))} /> },
          { label: `Accounted, not exported, ${pend.length}`, value: <Money value={pendValue} /> },
          { label: `On hold, ${held.length}`, value: <Money value={r2(held.map(v => v.calc.netPayable))} /> },
        ]}
        action={primary
          ? <div className="bar-sticky"><Button variant="primary" loading={exp.isPending && primary === exportIt} onClick={primary.run} className="max-md:flex-1">{primary.label}</Button></div>
          : !failed && !loading && <p className="soft self-center">Nothing is waiting on you. Switch role in the top bar to see another queue.</p>}
      />
      {failed && <Card glass role="alert" className="text-(--bad)"><p className="font-semibold">The engine did not show payables to your role.</p><p className="mt-1">{bad(failed)}</p></Card>}
      {loading && <div aria-busy className="h-96 animate-pulse rounded-hero bg-(--hair)" />}
      {alert && <ErrorNote>{alert}</ErrorNote>}
      {!failed && !loading && (
        <>
          <Tabs label="Payables sections" value={tab} onChange={setTab} tabs={[['ipcs', 'Certified IPCs'], ['invoices', 'Invoices'], ['journals', 'Journals and GL'], ['contracts', 'Contracts']]} />
          <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="enter grid gap-6">
            {tab === 'ipcs' && <IpcTab rows={I} name={name} go={id => setSel({ t: 'ipc', id })} />}
            {tab === 'invoices' && <InvoiceTab rows={V} name={name} go={id => setSel({ t: 'inv', id })} />}
            {tab === 'journals' && (js.error ? <ErrorNote>{bad(js.error)}</ErrorNote> : <JournalTab rows={J} exported={exported} />)}
            {tab === 'contracts' && (cts.error ? <ErrorNote>{bad(cts.error)}</ErrorNote> : <ContractTab rows={C} />)}
          </div>
        </>
      )}
      {sel?.t === 'ipc' && <IpcPanel id={sel.id} name={name} onClose={() => setSel(null)} openInvoice={id => setSel({ t: 'inv', id })} />}
      {sel?.t === 'inv' && <InvoicePanel inv={V.find(v => v.id === sel.id)} name={name} onClose={() => setSel(null)} openIpc={id => setSel({ t: 'ipc', id })} />}
    </>
  );
}
