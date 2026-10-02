import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { call } from '../../api';
import { Button } from '../../ui/Button';
import { Field, Input } from '../../ui/Field';
import { Select } from '../../ui/bits';

// The engine's register command takes the signed-in supplier's documents only: name, country and categories are fixed at invitation.
// The types below are the ones qualification checks. ponytail: a fixed list, read it from the engine if it ever exposes one.
const TYPES: [string, string][] = [['trade_licence', 'Trade licence'], ['insurance', 'Insurance'], ['tax_certificate', 'Tax certificate']];
type Row = { key: number; type: string; expires: string };

/** Primary or secondary button that opens the registration form. Engine errors (wrong role, wrong status) are shown in the form. */
export function RegisterDialog({ variant = 'primary' }: { variant?: 'primary' | 'secondary' }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const qc = useQueryClient();
  const seq = useRef(1);
  const [rows, setRows] = useState<Row[]>([{ key: 0, type: 'trade_licence', expires: '' }]);
  const m = useMutation({
    mutationFn: () => call('suppliers', 'register', rows.map(({ type, expires }) => ({ type, expires }))),
    onSuccess: () => qc.invalidateQueries(),
  });
  const set = (key: number, patch: Partial<Row>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const close = () => { dlg.current?.close(); m.reset(); };
  const used = new Set(rows.map(r => r.type));

  return (
    <>
      <div className={variant === 'primary' ? 'bar-sticky' : ''}>
        <Button variant={variant} onClick={() => dlg.current?.showModal()} className="max-md:w-full">Register supplier</Button>
      </div>
      <dialog ref={dlg} aria-label="Register supplier documents" onClose={() => m.reset()} className="zoom-panel card on-light m-auto max-h-[calc(100dvh-1.5rem)] w-[min(34rem,calc(100vw-1.5rem))] overflow-auto p-6 shadow-e3 md:p-8">
        {m.isSuccess ? (
          <div className="grid gap-4">
            <h2 className="text-section font-semibold">Documents submitted</h2>
            <p className="soft">Your registration is with the procurement manager for qualification. The engine recorded it in the audit trail.</p>
            <div className="flex justify-end"><Button variant="primary" onClick={close}>Close</Button></div>
          </div>
        ) : (
          <form ref={form} onSubmit={e => { e.preventDefault(); m.mutate(); }} className="grid gap-5">
            <header className="grid gap-1">
              <h2 className="text-section font-semibold">Register supplier documents</h2>
              <p className="soft">Name, country and categories are set when a supplier is invited. Registration adds the documents the qualification check reads, each with its expiry date.</p>
            </header>
            <ul className="grid gap-4">
              {rows.map((r, n) => (
                <li key={r.key} className="grid gap-3 rounded-ctl border border-(--hair) p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <Select label="Document type" value={r.type} onChange={type => set(r.key, { type })} options={TYPES} />
                  <Field label="Expiry date"><Input type="date" required value={r.expires} onChange={e => set(r.key, { expires: e.target.value })} /></Field>
                  {rows.length > 1 && <Button variant="text" onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))} aria-label={`Remove document ${n + 1}`} className="justify-self-start sm:justify-self-end">Remove</Button>}
                </li>
              ))}
            </ul>
            <Button variant="text" disabled={used.size === TYPES.length} onClick={() => setRows(rs => [...rs, { key: seq.current++, type: TYPES.find(t => !used.has(t[0]))![0], expires: '' }])} className="justify-self-start">Add another document</Button>
            {m.error && <p role="alert" className="rounded-ctl bg-danger-soft p-3 font-medium text-danger">{(m.error as Error).message}</p>}
            <div className="flex justify-end gap-3">
              <Button variant="text" onClick={close}>Cancel</Button>
              <Button variant="primary" loading={m.isPending} onClick={() => form.current?.requestSubmit()}>Submit documents</Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
