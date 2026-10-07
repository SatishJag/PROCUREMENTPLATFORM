import { useMutation } from '@tanstack/react-query';
import { call } from '../../api';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { StatusChip } from '../../ui/StatusChip';
import { Ic } from '../../ui/bits';
import { bad, download, type Batch, type Journal } from './data';
import { ErrorNote } from './parts';

const n2 = (n: number) => (n ? n.toLocaleString('en', { minimumFractionDigits: 2 }) : '');
const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

/** What the last export returned, shown beside the journals it moved. `null` batchId means nothing was pending. */
export type Exported = Batch | undefined;

function JournalCard({ j, i }: { j: Journal; i: number }) {
  const dr = sum(j.lines.map(l => l.dr)), cr = sum(j.lines.map(l => l.cr)), ok = dr === cr;
  return (
    <Card as="li" i={i} className="grid gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-code text-label font-medium">{j.id}</span>
        <StatusChip tone={j.status === 'transferred' ? 'success' : 'warning'}>{j.status === 'transferred' ? 'Transferred' : 'Pending transfer'}</StatusChip>
        <StatusChip tone={ok ? 'success' : 'danger'}>{ok ? 'Balanced' : 'Out of balance'}</StatusChip>
        <span className="soft ml-auto numeral">Invoice <span className="font-code text-label">{j.invoiceId}</span>, {j.date}{j.batchId && <>, batch <span className="font-code text-label">{j.batchId}</span></>}</span>
      </div>
      <div className="overflow-x-auto rounded-ctl border border-(--hair)">
        <table className="w-full min-w-[22rem] border-collapse font-dense text-body">
          <caption className="sr-only">Journal {j.id}, amounts in AED</caption>
          <thead><tr>{['Account', 'Name', 'Debit', 'Credit'].map((h, k) => <th key={h} scope="col" className={`eyebrow border-b border-(--hair) bg-(--head) px-3 py-2 font-semibold ${k > 1 ? '!text-right' : 'text-left'}`}>{h}</th>)}</tr></thead>
          <tbody>
            {j.lines.map(l => (
              <tr key={l.account} className="border-b border-(--hair)">
                <td className="px-3 py-2 font-code text-label">{l.account}</td><td className="px-3 py-2">{l.name}</td>
                <td className="numeral px-3 py-2 text-right !font-normal">{n2(l.dr)}</td><td className="numeral px-3 py-2 text-right !font-normal">{n2(l.cr)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="font-semibold"><th scope="row" colSpan={2} className="px-3 py-2 text-left">Total, AED</th><td className="numeral px-3 py-2 text-right !font-semibold">{n2(dr)}</td><td className="numeral px-3 py-2 text-right !font-semibold">{n2(cr)}</td></tr></tfoot>
        </table>
      </div>
      <p className="soft flex items-center gap-2"><Ic n={ok ? 'check' : 'warn'} className="size-4 text-(--gold)" />{ok ? 'Debits equal credits. The engine refuses to account an unbalanced journal.' : 'Debits differ from credits.'}</p>
    </Card>
  );
}

export function JournalTab({ rows, exported }: { rows: Journal[]; exported: Exported | 'none' }) {
  const again = useMutation({ mutationFn: (id: string) => call<Batch>('payables', 'getBatch', id), onSuccess: b => download(`${b.batchId}.csv`, b.csv) });
  const batches = [...new Set(rows.filter(j => j.batchId).map(j => j.batchId!))];
  const sorted = [...rows].sort((a, b) => Number(a.status === 'transferred') - Number(b.status === 'transferred'));
  return (
    <div className="grid gap-6">
      {exported && (
        <Card glass role="status" className="flex items-start gap-3">
          <Ic n="check" className="mt-0.5 size-5 text-(--gold)" />
          {exported === 'none' || !exported.batchId
            ? <p>Nothing was pending, so no batch was created.</p>
            : <p><span className="font-semibold">Batch <span className="font-code text-label">{exported.batchId}</span> exported</span>, {exported.count} journal{exported.count === 1 ? '' : 's'}. The CSV was downloaded; download it again below if needed.</p>}
        </Card>
      )}
      {batches.length > 0 && (
        <Card>
          <h2 className="mb-3 text-section font-semibold">GL batches</h2>
          <ul className="divide-y divide-(--hair)">
            {batches.map(b => (
              <li key={b} className="flex flex-wrap items-center gap-3 py-2 first:pt-0 last:pb-0">
                <span className="font-code text-label font-medium">{b}</span><span className="soft">{rows.filter(j => j.batchId === b).length} journal{rows.filter(j => j.batchId === b).length === 1 ? '' : 's'}, transferred</span>
                <Button variant="secondary" className="ml-auto" loading={again.isPending && again.variables === b} onClick={() => again.mutate(b)}>Download {b}</Button>
              </li>
            ))}
          </ul>
          {again.error && <div className="mt-3"><ErrorNote>{bad(again.error)}</ErrorNote></div>}
        </Card>
      )}
      <section aria-label="Subledger journals" className="grid gap-4">
        <h2 className="text-section font-semibold">Subledger journals for the corporate GL</h2>
        {!rows.length && <Card glass><p className="soft">No invoice has been accounted yet, so there are no journals.</p></Card>}
        <ul className="grid gap-6 xl:grid-cols-2">{sorted.map((j, i) => <JournalCard key={j.id} j={j} i={i} />)}</ul>
        <p className="soft">Subledger journals are exported, never posted here. The corporate ERP keeps the general ledger.</p>
      </section>
    </div>
  );
}
