import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '../../ui/Button';
import { Field, control } from '../../ui/Field';
import { Money } from '../../ui/Money';
import { Table, type Column } from '../../ui/Table';
import { Select } from '../../ui/bits';
import { bad, people, type Calc } from './data';

export const ErrorNote = ({ children }: { children: ReactNode }) => <p role="alert" className="rounded-ctl bg-(--bad-hover) p-3 font-medium text-(--bad)">{children}</p>;

/** Wide native modal for a row's detail: header, scrolling body, action footer. Content mounts only while open. Esc, backdrop or Close returns. */
export function Panel({ title, note, chips, open, onClose, footer, children }: { title: string; note?: ReactNode; chips?: ReactNode; open: boolean; onClose: () => void; footer?: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current!; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  return (
    <dialog ref={ref} aria-label={title} onClose={onClose} onClick={e => { if (e.target === ref.current) onClose(); }} className="zoom-panel card on-light m-auto h-[min(56rem,calc(100dvh-1.5rem))] w-[min(64rem,calc(100vw-1.5rem))] max-w-none overflow-hidden p-0 shadow-e3">
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-(--hair) px-5 py-4 md:px-8 md:py-5">
            <div className="grid min-w-0 gap-2">
              <h2 className="text-section font-semibold">{title}</h2>
              {note && <p className="soft">{note}</p>}
              {chips && <div className="flex flex-wrap gap-2">{chips}</div>}
            </div>
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </header>
          <div className="grid min-h-0 flex-1 content-start gap-6 overflow-auto px-5 py-5 md:px-8 md:py-6">{children}</div>
          {footer && <footer className="flex flex-wrap items-center gap-3 border-t border-(--hair) px-5 py-4 md:px-8">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

/** Dense table from md, one card per row on a phone. */
export function Rows<T>({ caption, columns, rows, rowKey, card }: { caption: string; columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; card: (r: T) => ReactNode }) {
  return (
    <>
      <div className="max-md:hidden"><Table caption={caption} columns={columns} rows={rows} rowKey={rowKey} /></div>
      <ul aria-label={caption} className="grid gap-3 md:hidden">{rows.map(r => <li key={rowKey(r)} className="grid gap-2 rounded-ctl border border-(--hair) p-4">{card(r)}</li>)}</ul>
    </>
  );
}

/** Gross to net payable as a floating-bar waterfall. Every figure is the engine's `calc`; only the bar positions are drawn here. */
export function Waterfall({ c }: { c: Calc }) {
  const steps: [string, number, 'total' | 'less' | 'add'][] = [
    ['Gross certified', c.gross, 'total'], ['Retention', -c.retention, 'less'], ['Advance recovery', -c.advanceRecovery, 'less'], ['Other deductions', -c.deductions, 'less'],
    ['Net before tax', c.netBeforeTax, 'total'], ['VAT', c.vat, 'add'], ['Withholding tax', -c.wht, 'less'], ['Net payable', c.netPayable, 'total'],
  ];
  let run = 0;
  const bars = steps.map(([label, v, kind]) => {
    const from = kind === 'total' ? 0 : run, to = kind === 'total' ? v : run + v;
    run = kind === 'total' ? v : to;
    return { label, v, kind, lo: Math.min(from, to), hi: Math.max(from, to) };
  });
  const max = Math.max(...bars.map(b => b.hi)) || 1;
  const fill = { total: 'var(--series)', less: 'var(--gold)', add: 'var(--neutral)' };
  return (
    <ol aria-label="Gross to net payable" className="grid gap-3">
      {bars.map(b => (
        <li key={b.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 md:grid-cols-[9.5rem_minmax(0,1fr)_11rem]">
          <span className={`${b.kind === 'total' ? 'font-semibold' : 'soft'}`}>{b.label}</span>
          <svg role="img" aria-label={`${b.label} ${b.v}`} viewBox="0 0 100 10" preserveAspectRatio="none" className="col-span-2 row-start-2 h-3 w-full md:col-span-1 md:col-start-2 md:row-start-1">
            <rect x="0" y="4.5" width="100" height="1" style={{ fill: 'var(--hair)' }} />
            <rect x={(b.lo / max) * 100} y={b.kind === 'total' ? 0 : 1.5} width={Math.max(((b.hi - b.lo) / max) * 100, 0.6)} height={b.kind === 'total' ? 10 : 7} rx="1" style={{ fill: fill[b.kind] }} />
          </svg>
          <span className={`numeral col-start-2 row-start-1 text-right md:col-start-3 ${b.kind === 'total' ? '!font-medium' : ''}`}>{b.kind === 'less' && b.v !== 0 ? '- ' : b.kind === 'add' && b.v !== 0 ? '+ ' : ''}<Money value={Math.abs(b.v)} /></span>
        </li>
      ))}
    </ol>
  );
}

type F = { name: string; label: string; kind?: 'area' | 'person'; hint?: string };

/** A button that collects named fields, then calls the engine. Engine errors stay in the dialog, whole. */
export function AskDialog({ label, title, fields, onSubmit, primary }: { label: string; title: string; fields: F[]; onSubmit: (v: Record<string, string>) => Promise<unknown>; primary?: boolean }) {
  const dlg = useRef<HTMLDialogElement>(null), form = useRef<HTMLFormElement>(null);
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [owner, setOwner] = useState('');
  const wantsPeople = fields.some(f => f.kind === 'person');
  const list = useQuery({ ...people(), enabled: wantsPeople });
  return (
    <>
      <Button variant={primary ? 'primary' : 'secondary'} className={primary ? 'max-md:w-full' : ''} onClick={() => dlg.current?.showModal()}>{label}</Button>
      <dialog ref={dlg} aria-label={title} onClose={() => { setErr(''); setOwner(''); }} className="zoom-panel card on-light m-auto w-[min(28rem,calc(100vw-2rem))] p-6 shadow-e3">
        <form ref={form} className="grid gap-4" onSubmit={async e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget), v = Object.fromEntries(fields.map(x => [x.name, String(x.kind === 'person' ? owner : f.get(x.name) ?? '')]));
          setBusy(true); setErr('');
          try { await onSubmit(v); dlg.current?.close(); } catch (x) { setErr(bad(x)); }
          setBusy(false);
        }}>
          <h2 className="text-section font-semibold">{title}</h2>
          {fields.map(f => f.kind === 'person'
            ? <Select key={f.name} label={f.label} hint={f.hint} value={owner} onChange={setOwner} placeholder="Choose a person" options={(list.data ?? []).map(p => [p.id, p.name] as [string, string])} error={list.error ? bad(list.error) : undefined} />
            : <Field key={f.name} label={f.label} hint={f.hint}><textarea name={f.name} rows={2} className={control} /></Field>)}
          {err && <ErrorNote>{err}</ErrorNote>}
          <div className="flex justify-end gap-3">
            <Button variant="text" onClick={() => dlg.current?.close()}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => form.current?.requestSubmit()}>{label}</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
