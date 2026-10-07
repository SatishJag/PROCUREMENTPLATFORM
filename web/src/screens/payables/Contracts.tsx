import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { call } from '../../api';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Field, Input } from '../../ui/Field';
import { Money } from '../../ui/Money';
import { Section } from '../../ui/Section';
import { StatusChip } from '../../ui/StatusChip';
import { bad, type ContractRow } from './data';
import { ErrorNote } from './parts';

const FIELDS = [
  ['retentionPct', 'Retention, %'], ['retentionCap', 'Retention cap, AED'], ['advanceAmount', 'Advance paid, AED'], ['advanceRecoveryPct', 'Advance recovery per IPC, %'],
  ['vatPct', 'VAT, %'], ['whtPct', 'Withholding tax, %'], ['revisedValue', 'Revised contract value, AED'],
] as const;

function TermsForm({ c }: { c: ContractRow }) {
  const qc = useQueryClient(), form = useRef<HTMLFormElement>(null);
  const t = c.terms;
  const m = useMutation({
    mutationFn: (f: FormData) => call('payables', 'setTerms', c.id, { ...Object.fromEntries(FIELDS.map(([k]) => [k, Number(f.get(k))])), variationRef: String(f.get('variationRef') ?? '') || undefined }),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <form ref={form} key={JSON.stringify(t)} onSubmit={e => { e.preventDefault(); m.mutate(new FormData(e.currentTarget)); }} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(([k, l]) => <Field key={k} label={l}><Input name={k} type="number" inputMode="decimal" step="any" min="0" required defaultValue={t?.[k] ?? (k === 'revisedValue' ? c.value : '')} /></Field>)}
        <Field label="Variation reference" hint="Needed to raise the value above the awarded amount."><Input name="variationRef" /></Field>
      </div>
      {m.error && <ErrorNote>{bad(m.error)}</ErrorNote>}
      {m.isSuccess && <p role="status" className="soft">Terms saved.</p>}
      <div><Button variant="primary" loading={m.isPending} onClick={() => form.current?.requestSubmit()}>Save terms</Button></div>
    </form>
  );
}

function Commitment({ c }: { c: ContractRow & { position: NonNullable<ContractRow['position']> } }) {
  const p = c.position, tot = p.revisedValue || 1;
  const parts: [string, number, string, number][] = [['Certified and accounted', p.cumulativeCertified, 'var(--series)', p.cumulativeCertified], ['Pending, not yet accounted', p.pendingCertified, 'var(--gold)', p.pendingCertified], ['Remaining commitment, pending included', p.remainingCommitment, 'var(--hair)', p.remainingCommitment - p.pendingCertified]];
  return (
    <div className="grid gap-3">
      <div role="img" aria-label={parts.map(([l, , , w]) => `${l} ${Math.round((w / tot) * 100)} percent`).join(', ')} className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        {parts.map(([l, , col, w]) => <div key={l} className="h-full" style={{ width: `${Math.max(0, (w / tot) * 100)}%`, background: col }} />)}
      </div>
      <ul className="grid gap-1.5">
        {parts.map(([l, v, col]) => (
          <li key={l} className="flex items-baseline gap-2"><span aria-hidden className="size-2.5 shrink-0 translate-y-px rounded-full border border-(--hair)" style={{ background: col }} /><span className="flex-1">{l}</span><Money value={v} /></li>
        ))}
      </ul>
    </div>
  );
}

export function ContractTab({ rows }: { rows: ContractRow[] }) {
  if (!rows.length) return <Card glass><p className="soft">No contract is visible to you yet. Contracts appear once an award is approved.</p></Card>;
  return (
    <ul className="grid gap-6 lg:grid-cols-2">
      {rows.map((c, i) => (
        <Card as="li" key={c.id} i={i} className="grid content-start gap-5">
          <div className="grid gap-1">
            <p className="flex flex-wrap items-center gap-2"><span className="font-code text-label font-medium">{c.id}</span>{c.terms ? <StatusChip tone="success">Terms set</StatusChip> : <StatusChip tone="warning">Needs financial terms</StatusChip>}</p>
            <h3 className="text-section font-semibold">{c.supplierName ?? c.supplierId}</h3>
          </div>
          <div className="grid gap-1">
            <p className="eyebrow">{c.position && c.position.revisedValue !== c.value ? 'Revised value' : 'Contract value'}</p>
            <Money value={c.position?.revisedValue ?? c.value} className="numeral text-[2rem] leading-none" />
            {c.position && c.position.revisedValue !== c.value && <p className="soft">Awarded <Money value={c.value} /></p>}
          </div>
          {c.position && c.terms ? (
            <>
              <Commitment c={c as ContractRow & { position: NonNullable<ContractRow['position']> }} />
              <dl className="grid grid-cols-2 gap-4 border-t border-(--hair) pt-4">
                <div><dt className="eyebrow">Retention held</dt><dd className="numeral mt-1"><Money value={c.position.retentionBalance} /></dd><dd className="soft">cap <Money value={c.terms.retentionCap} />, {c.terms.retentionPct}%</dd></div>
                <div><dt className="eyebrow">Advance balance</dt><dd className="numeral mt-1"><Money value={c.position.advanceBalance} /></dd><dd className="soft">of <Money value={c.terms.advanceAmount} />, recovered at {c.terms.advanceRecoveryPct}%</dd></div>
              </dl>
              <Section title="Revise financial terms" meta={`VAT ${c.terms.vatPct}%, WHT ${c.terms.whtPct}%`}><TermsForm c={c} /></Section>
            </>
          ) : (
            <div className="grid gap-3 border-t border-(--hair) pt-4"><h4 className="text-section font-semibold">Set financial terms</h4><p className="soft">No IPC can be processed for this contract until finance sets retention, advance, VAT and withholding tax.</p><TermsForm c={c} /></div>
          )}
        </Card>
      ))}
    </ul>
  );
}
