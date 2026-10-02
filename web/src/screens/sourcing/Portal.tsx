import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { call, getUser } from '../../api';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { control, Field, Input } from '../../ui/Field';
import { Ic, Select, Tags } from '../../ui/bits';
import { PageHeader } from '../../ui/PageHeader';
import { Section } from '../../ui/Section';
import { StatusChip } from '../../ui/StatusChip';
import { Table } from '../../ui/Table';
import { stageLabel, stageTone, when, type Portal } from './data';
import { Back, ErrorNote, Sheet } from './parts';

const usePortal = (id: string, enabled = true) => useQuery({ queryKey: ['portal', getUser(), id], enabled, retry: false, queryFn: () => call<Portal>('sourcing', 'portal', id) });
const bidChip = (p: Portal) => p.myBid ? <StatusChip tone="success">Sealed bid v{p.myBid.version} received</StatusChip> : <StatusChip tone="neutral">No bid yet</StatusChip>;

/** Supplier desk. No command lists invitations, so this probes the first event references; any other reference can be typed in. */
// ponytail: probes EV-0001 to EV-0008. Replace with an invitations command on the engine.
const PROBE = Array.from({ length: 8 }, (_, i) => `EV-${String(i + 1).padStart(4, '0')}`);

export function SupplierPortal({ reason }: { reason: string }) {
  const [id, setId] = useState(''), [typed, setTyped] = useState('');
  const probes = useQueries({ queries: PROBE.map(e => ({ queryKey: ['portal', getUser(), e], retry: false, queryFn: () => call<Portal>('sourcing', 'portal', e) })) });
  if (id) return <PortalEvent id={id} onBack={() => setId('')} />;
  const found = probes.map(q => q.data).filter((x): x is Portal => !!x);
  const waiting = probes.some(q => q.isPending);
  return (
    <>
      <PageHeader
        eyebrow="Supplier portal, sample data"
        title="Your invitations"
        chip={<StatusChip tone={found.length ? 'success' : 'neutral'}>{waiting ? 'Looking for invitations' : `${found.length} invitation${found.length === 1 ? '' : 's'}`}</StatusChip>}
        figures={[{ label: 'Open for bids', big: true, value: found.filter(f => f.status === 'open').length }, { label: 'Bids sealed', value: found.filter(f => f.myBid).length }]}
      />
      {!waiting && !found.length && <Card className="grid gap-2"><h2 className="text-section font-semibold">No invitation found</h2><p className="soft">This sign-in is not invited to a sourcing event. The engine says: {reason}</p></Card>}
      <ul className="grid gap-4 md:grid-cols-2">
        {found.map((p, i) => (
          <li key={p.id}>
            <button type="button" onClick={() => setId(p.id)} style={{ '--i': i } as never} className="rise card on-light lift grid w-full gap-3 p-5 text-left active:scale-[0.99] md:p-6">
              <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-code text-label">{p.id}</span><StatusChip tone={stageTone(p.status)}>{p.status === 'open' ? 'Open for bids' : stageLabel(p.status)}</StatusChip></span>
              <span className="text-section font-semibold">{p.title}</span>
              <span className="soft flex flex-wrap gap-x-4"><span>{p.type}</span><span>Closes {when(p.closesAt)}</span></span>
              <span className="justify-self-start">{bidChip(p)}</span>
            </button>
          </li>
        ))}
      </ul>
      <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); setId(typed.trim()); }}>
        <div className="on-dark grid gap-1.5"><label htmlFor="ref" className="font-medium">Another event reference</label><input id="ref" value={typed} onChange={e => setTyped(e.target.value)} placeholder="EV-0001" className={`h-11 w-56 font-code md:h-10 ${control}`} /></div>
        <Button variant="secondary" disabled={!typed.trim()} onClick={() => setId(typed.trim())}>Open event</Button>
      </form>
    </>
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function PortalEvent({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const q = usePortal(id);
  const [revising, setRevising] = useState(false), [asking, setAsking] = useState(false), [question, setQuestion] = useState('');
  const [currency, setCurrency] = useState('AED');
  const [rates, setRates] = useState<Record<string, string>>({}), [amounts, setAmounts] = useState<Record<string, string>>({});
  const [excl, setExcl] = useState<{ lotId: string; description: string }[]>([]), [deviations, setDeviations] = useState<string[]>([]);
  const reset = () => { setRates({}); setAmounts({}); setExcl([]); setDeviations([]); setRevising(false); };

  const p = q.data;
  const submit = useMutation({
    mutationFn: () => call('sourcing', 'submitBid', id, {
      currency, deviations,
      lines: p!.boq.filter(l => Number(rates[l.id]) > 0).map(l => ({ lineId: l.id, rate: Number(rates[l.id]), amount: Number(amounts[l.id] ?? round2(Number(rates[l.id]) * l.qty)) })),
      exclusions: excl.filter(x => x.description.trim()),
    }),
    onSuccess: () => { reset(); qc.invalidateQueries({ queryKey: ['portal'] }); },
  });
  const ask = useMutation({
    mutationFn: () => call('sourcing', 'clarify', id, question),
    onSuccess: () => { setQuestion(''); setAsking(false); qc.invalidateQueries({ queryKey: ['portal'] }); },
  });

  if (q.isPending) return <div aria-busy className="h-96 animate-pulse rounded-hero bg-white/5" />;
  if (!p) return <><Back onClick={onBack}>Your invitations</Back><ErrorNote>{(q.error as Error).message}</ErrorNote></>;
  const open = p.status === 'open';
  const form = open && (!p.myBid || revising);
  const closes = p.closesAt;

  return (
    <>
      <Back onClick={onBack}>Your invitations</Back>
      <PageHeader
        eyebrow="Supplier portal, sample data"
        title={p.title}
        chip={<><StatusChip tone={stageTone(p.status)}>{open ? 'Open for bids' : stageLabel(p.status)}</StatusChip><StatusChip>{p.type}</StatusChip>{bidChip(p)}<span className="font-code self-center text-label soft">{p.id}</span></>}
        figures={[
          { label: 'Bids close, UTC', big: true, value: <>{closes.slice(0, 10)}<span className="text-[0.3em] tracking-wider opacity-70"> {closes.slice(11, 16)}</span></> },
          { label: 'Lots', value: p.lots.length }, { label: 'BOQ lines', value: p.boq.length },
        ]}
        action={
          <div className="bar-sticky flex flex-wrap items-center justify-end gap-3">
            {!open && <p className="soft min-w-0 flex-1 basis-full max-md:order-first md:order-last md:text-right">Bidding is not open for this event.</p>}
            {submit.error && <p role="alert" className="min-w-0 flex-1 font-medium text-(--bad) basis-full max-md:order-first md:order-last md:text-right">{(submit.error as Error).message}</p>}
            {open && <Button variant="secondary" onClick={() => setAsking(true)}>Ask a question</Button>}
            {form && <Button variant="primary" loading={submit.isPending} onClick={() => (document.getElementById('bid-form') as HTMLFormElement).requestSubmit()} className="max-md:flex-1">{revising ? 'Submit revision' : 'Submit bid'}</Button>}
            {open && !form && <Button variant="primary" onClick={() => setRevising(true)} className="max-md:flex-1">Revise bid</Button>}
          </div>
        }
      />

      {p.myBid && !revising && (
        <Card i={1} className="grid gap-4 md:grid-cols-[auto_1fr] md:gap-6">
          <span aria-hidden className="grid size-16 place-items-center rounded-full border border-(--gold) bg-primary-soft text-(--gold)"><Ic n="lock" className="size-8" /></span>
          <div className="grid gap-3">
            <div><h2 className="text-section font-semibold">Seal receipt</h2><p className="soft">Your bid is sealed. Prices are never shown back, and stay sealed until technical evaluation is complete.</p></div>
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-3">
              {([['Bid', p.myBid.id], ['Version', `v${p.myBid.version}`], ['Received', when(p.myBid.submittedAt)], ['Currency', p.myBid.currency], ['Lines priced', p.myBid.lines.length], ['Exclusions, deviations', `${p.myBid.exclusions.length}, ${p.myBid.deviations.length}`]] as const)
                .map(([k, v]) => <div key={k}><dt className="eyebrow">{k}</dt><dd className="mt-0.5 font-medium numeral">{k === 'Bid' ? <span className="font-code text-body">{v}</span> : v}</dd></div>)}
            </dl>
            {open && <p className="soft">A revised bid replaces this one in full until bidding closes.</p>}
          </div>
        </Card>
      )}

      {form && (
        <Card i={1} className="grid gap-5">
          <div><h2 className="text-section font-semibold">{revising ? 'Revised bid' : 'Your bid'}</h2><p className="soft">Price the lines you offer; leave the rest blank. The amount defaults to rate times quantity and can be set directly. {revising && 'This replaces your sealed bid in full.'}</p></div>
          <form id="bid-form" onSubmit={e => { e.preventDefault(); submit.mutate(); }} className="grid gap-6">
            <div className="max-w-40"><Select label="Currency" value={currency} onChange={setCurrency} options={[['AED', 'AED'], ['USD', 'USD'], ['EUR', 'EUR']]} /></div>
            {p.lots.map(lot => (
              <fieldset key={lot.id} className="grid gap-3">
                <legend className="mb-1 text-section font-semibold"><span className="font-code mr-2 text-label">{lot.id}</span>{lot.name}</legend>
                <ul className="grid gap-4">
                  {p.boq.filter(l => l.lotId === lot.id).map(l => (
                    <li key={l.id} className="grid gap-x-4 gap-y-2 border-b border-(--hair) pb-4 last:border-0 md:grid-cols-[minmax(0,1fr)_11rem_12rem] md:items-end">
                      <span><span className="font-code mr-2 text-label">{l.id}</span>{l.item}<span className="soft block">{l.qty} {l.unit}</span></span>
                      <Field label={`Rate (${currency})`}><Input type="number" min={0} step="any" inputMode="decimal" value={rates[l.id] ?? ''} onChange={e => setRates({ ...rates, [l.id]: e.target.value })} className="text-right" /></Field>
                      <Field label={`Amount (${currency})`}><Input type="number" min={0} step="any" inputMode="decimal" value={amounts[l.id] ?? (Number(rates[l.id]) > 0 ? String(round2(Number(rates[l.id]) * l.qty)) : '')} onChange={e => setAmounts({ ...amounts, [l.id]: e.target.value })} className="text-right" /></Field>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ))}
            <fieldset className="grid gap-3">
              <legend className="mb-1 text-section font-semibold">Exclusions</legend>
              {excl.map((x, i) => (
                <div key={i} className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end">
                  <Select label="Lot" value={x.lotId} onChange={v => setExcl(excl.map((y, j) => (j === i ? { ...y, lotId: v } : y)))} options={p.lots.map(l => [l.id, `${l.id} ${l.name}`])} />
                  <Field label="What is excluded"><Input value={x.description} onChange={e => setExcl(excl.map((y, j) => (j === i ? { ...y, description: e.target.value } : y)))} /></Field>
                  <Button variant="text" onClick={() => setExcl(excl.filter((_, j) => j !== i))}>Remove</Button>
                </div>
              ))}
              <div><Button variant="secondary" onClick={() => setExcl([...excl, { lotId: p.lots[0]?.id ?? '', description: '' }])}>Add exclusion</Button></div>
            </fieldset>
            <Tags label="Deviations" values={deviations} onChange={setDeviations} hint="Anything in your offer that departs from the tender documents." />
          </form>
        </Card>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[3fr_2fr]">
        <Card i={2} className="grid gap-2">
          <h2 className="text-section font-semibold">Clarifications</h2>
          <p className="soft">Answers go to every invited bidder. Questions are anonymous.</p>
          {!p.clarifications.length && <p className="soft mt-2">No clarification has been answered yet.</p>}
          <ul className="divide-y divide-(--hair)">
            {p.clarifications.map((c, i) => (
              <li key={i} className="grid gap-1 py-3"><span className="eyebrow">Question</span><span>{c.question}</span><span className="eyebrow mt-1">Answer</span><span className="font-medium">{c.answer}</span>
                {c.extendedTo && <span className="mt-1 font-medium text-(--warn)">Deadline extended to {when(c.extendedTo)}</span>}</li>
            ))}
          </ul>
        </Card>
        <Card i={3}>
          <Section title="Scope of supply" meta={`${p.boq.length} lines`}>
            <Table caption="Bill of quantities" rowKey={r => r.id} rows={p.boq} columns={[
              { key: 'id', header: 'Line', cell: r => r.id, mono: true }, { key: 'item', header: 'Item', cell: r => r.item },
              { key: 'unit', header: 'Unit', cell: r => r.unit }, { key: 'qty', header: 'Qty', cell: r => r.qty, align: 'right' },
            ]} />
          </Section>
        </Card>
      </div>

      <Sheet title="Ask a question" open={asking} onClose={() => { ask.reset(); setAsking(false); }}>
        <form id="ask-form" className="grid gap-4" onSubmit={e => { e.preventDefault(); ask.mutate(); }}>
          <Field label="Your question" hint="The buyer's answer goes to every invited bidder. Your name is not shown."><textarea required rows={4} value={question} onChange={e => setQuestion(e.target.value)} className={control} /></Field>
          {ask.error && <ErrorNote>{(ask.error as Error).message}</ErrorNote>}
          <div className="flex justify-end gap-3"><Button variant="text" onClick={() => setAsking(false)}>Cancel</Button>
            <Button variant="primary" loading={ask.isPending} onClick={() => (document.getElementById('ask-form') as HTMLFormElement).requestSubmit()}>Send question</Button></div>
        </form>
      </Sheet>
    </>
  );
}
