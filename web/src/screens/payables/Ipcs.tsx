import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { call } from '../../api';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Money } from '../../ui/Money';
import { Section } from '../../ui/Section';
import { StatusChip } from '../../ui/StatusChip';
import { Ic } from '../../ui/bits';
import { bad, ipcTone, period, useFeedback, useIpc, who, words, type Invoice, type IpcRow } from './data';
import { ErrorNote, Panel, Rows, Waterfall } from './parts';

const open = (r: IpcRow, go: (id: string) => void) => (
  <button type="button" onClick={() => go(r.id)} aria-label={`Open IPC ${r.ipcRef} version ${r.version}`} className="inline-flex min-h-11 items-center gap-2 rounded-ctl pr-2 text-left font-medium text-(--sec) hover:underline hover:underline-offset-4 active:scale-[0.97] md:min-h-9">
    <span className="font-code text-label">{r.ipcRef}</span><span className="soft">v{r.version}</span>
  </button>
);
const status = (r: IpcRow) => <StatusChip tone={ipcTone[r.status] ?? 'neutral'}>{words(r.status)}</StatusChip>;
const failure = (r: IpcRow) => r.status === 'validation_failed' && r.errors[0] && <p className="mt-1 max-w-72 whitespace-normal font-medium text-(--bad)">{r.errors[0]}{r.errors.length > 1 && ` (+${r.errors.length - 1} more)`}</p>;

export function IpcTab({ rows, name, go }: { rows: IpcRow[]; name: (contractId: string) => string; go: (id: string) => void }) {
  if (!rows.length) return <Card glass><p className="soft">No certified IPC has arrived from the PMIS yet.</p></Card>;
  return (
    <Card>
      <h2 className="mb-4 text-section font-semibold">Certified IPCs from the PMIS</h2>
      <Rows caption="Certified IPCs" rows={rows} rowKey={r => r.id} columns={[
        { key: 'r', header: 'IPC', cell: r => open(r, go) },
        { key: 'c', header: 'Contract and supplier', cell: r => <><span className="font-code text-label">{r.contractId}</span> <span className="soft">{name(r.contractId)}</span></> },
        { key: 'p', header: 'Period', cell: period },
        { key: 'n', header: 'Net payable', align: 'right', cell: r => r.calc ? <Money value={r.calc.netPayable} /> : <span className="soft">Not calculated</span> },
        { key: 's', header: 'Status', cell: r => <>{status(r)}{failure(r)}</> },
      ]} card={r => (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">{open(r, go)}{status(r)}</div>
          <p className="soft">{name(r.contractId)}, <span className="font-code text-label">{r.contractId}</span></p>
          <p className="soft numeral">{period(r)}</p>
          {r.calc && <Money value={r.calc.netPayable} className="numeral text-section" />}
          {failure(r)}
        </>
      )} />
    </Card>
  );
}

export function IpcPanel({ id, name, onClose, openInvoice }: { id: string; name: (contractId: string) => string; onClose: () => void; openInvoice: (id: string) => void }) {
  const qc = useQueryClient();
  const ipc = useIpc(id), fb = useFeedback(id);
  const [err, setErr] = useState('');
  const done = { onSuccess: () => qc.invalidateQueries(), onError: (e: Error) => setErr(e.message) };
  const create = useMutation({ mutationFn: () => call<Invoice>('payables', 'createInvoice', id), ...done, onSuccess: inv => { qc.invalidateQueries(); openInvoice(inv.id); } });
  const withdraw = useMutation({ mutationFn: (reason: string) => call('payables', 'withdrawIpc', id, reason), ...done });
  const i = ipc.data, f = fb.data;
  const ready = i?.status === 'validated';
  return (
    <Panel open title={i ? `IPC ${i.ipcRef}, version ${i.version}` : 'IPC'} note={i && <>{name(i.contractId)}, <span className="font-code text-label">{i.contractId}</span>, {period(i)}. Certified by {who(i.certifiedBy)}.</>}
      chips={i && <StatusChip tone={ipcTone[i.status] ?? 'neutral'}>{words(i.status)}</StatusChip>} onClose={onClose}
      footer={i && (
        <>
          {err && <div className="min-w-0 flex-1 max-md:basis-full"><ErrorNote>{err}</ErrorNote></div>}
          <div className="flex flex-wrap items-center gap-3 md:ml-auto">
            {i.invoiceId && <Button variant="secondary" onClick={() => openInvoice(i.invoiceId!)}>Open invoice {i.invoiceId}</Button>}
            {ready && <Button variant="destructive" onReason={async r => { setErr(''); await withdraw.mutateAsync(r); onClose(); }}>Withdraw IPC</Button>}
            {ready && <Button variant="primary" loading={create.isPending} onClick={() => { setErr(''); create.mutate(); }}>Create invoice</Button>}
          </div>
          {!ready && !i.invoiceId && <p className="soft">{i.status === 'validation_failed' ? 'The engine refused this IPC, so no invoice can be created. The certifier restages a corrected version.' : `Nothing to do while the IPC is ${words(i.status).toLowerCase()}.`}</p>}
        </>
      )}>
      {ipc.error && <ErrorNote>{bad(ipc.error)}</ErrorNote>}
      {!i && !ipc.error && <div aria-busy className="h-64 animate-pulse rounded-ctl bg-(--hair)" />}
      {i && (
        <>
          <div className="grid gap-1">
            <p className="eyebrow">Net payable</p>
            {i.calc ? <Money value={i.calc.netPayable} className="numeral text-[2.25rem] leading-none md:text-[3rem]" /> : <p className="soft">No amount: the engine stopped before calculating.</p>}
          </div>
          {i.errors.length > 0 && <div className="grid gap-2" role="alert"><p className="font-semibold text-(--bad)">The engine refused this IPC</p><ul className="grid gap-1.5">{i.errors.map(e => <li key={e} className="flex gap-2 text-(--bad)"><Ic n="err" className="mt-0.5 size-4" />{e}</li>)}</ul></div>}
          {i.calc && <div className="grid gap-3"><h3 className="text-section font-semibold">Gross to net payable</h3><Waterfall c={i.calc} /></div>}
          <div className="grid gap-1 rounded-ctl border border-(--hair) p-4">
            <p className="eyebrow">PMIS status feedback</p>
            {f ? <p>Status <span className="font-medium">{words(f.status)}</span>{f.invoiceId && <>, invoice <span className="font-code text-label">{f.invoiceId}</span> is <span className="font-medium">{words(f.invoiceStatus ?? '').toLowerCase()}</span></>}. {f.errors.length ? `${f.errors.length} validation error${f.errors.length > 1 ? 's' : ''} returned to the PMIS.` : 'No validation errors returned.'}</p> : <p className="soft">{fb.error ? bad(fb.error) : 'Loading.'}</p>}
          </div>
          <Section title="Lines" meta={`${i.lines.length} BOQ line${i.lines.length > 1 ? 's' : ''}`} defaultOpen>
            <Rows caption="IPC lines" rows={i.lines} rowKey={l => l.boqItem + l.wbs} columns={[
              { key: 'b', header: 'BOQ', mono: true, cell: l => l.boqItem }, { key: 'w', header: 'WBS', mono: true, cell: l => l.wbs }, { key: 'k', header: 'Cost code', mono: true, cell: l => l.costCode },
              { key: 'd', header: 'Description', cell: l => l.description }, { key: 'u', header: 'UoM', cell: l => l.uom },
              { key: 'pq', header: 'Previous qty', align: 'right', cell: l => l.prevQty.toLocaleString('en') }, { key: 'cq', header: 'This period', align: 'right', cell: l => l.currQty.toLocaleString('en') },
              { key: 'r', header: 'Rate', align: 'right', cell: l => <Money value={l.rate} /> },
            ]} card={l => <><p><span className="font-code text-label">{l.boqItem}</span> {l.description}</p><p className="soft"><span className="font-code text-label">{l.wbs} {l.costCode}</span></p><p className="soft numeral">{l.currQty.toLocaleString('en')} {l.uom} this period at <Money value={l.rate} /></p></>} />
          </Section>
          <Section title="Variations and deductions" meta={`${i.variations.length} variation${i.variations.length === 1 ? '' : 's'}, ${i.adjustments.otherDeductions?.length ?? 0} deduction${i.adjustments.otherDeductions?.length === 1 ? '' : 's'}`}>
            <ul className="divide-y divide-(--hair)">
              {i.variations.map(v => <li key={v.ref} className="flex justify-between gap-4 py-2"><span>Variation <span className="font-code text-label">{v.ref}</span></span><Money value={v.amount} /></li>)}
              {i.adjustments.materialOnSite !== undefined && <li className="flex justify-between gap-4 py-2"><span>Material on site</span><Money value={i.adjustments.materialOnSite} /></li>}
              {i.adjustments.retention !== undefined && <li className="flex justify-between gap-4 py-2"><span>Retention stated by the certifier</span><Money value={i.adjustments.retention} /></li>}
              {i.adjustments.advanceRecovery !== undefined && <li className="flex justify-between gap-4 py-2"><span>Advance recovery stated by the certifier</span><Money value={i.adjustments.advanceRecovery} /></li>}
              {i.adjustments.otherDeductions?.map(d => <li key={d.type} className="flex justify-between gap-4 py-2"><span>Deduction, {d.type}</span><Money value={d.amount} /></li>)}
            </ul>
            {!i.variations.length && !i.adjustments.otherDeductions?.length && <p className="soft">None on this IPC. Retention and advance follow the contract rule.</p>}
          </Section>
          <Section title="Attachments" meta={`${i.attachments.length} file${i.attachments.length === 1 ? '' : 's'}`}>
            <ul className="grid gap-1.5">{i.attachments.map(a => <li key={a.name} className="flex items-center gap-2"><Ic n="file" className="size-4 text-(--gold)" />{a.name}<span className="soft">{words(a.type)}</span></li>)}</ul>
            {i.taxInvoiceNo && <p className="soft mt-2">Tax invoice <span className="font-code text-label">{i.taxInvoiceNo}</span></p>}
          </Section>
        </>
      )}
    </Panel>
  );
}
