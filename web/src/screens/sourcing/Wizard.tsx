import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { call, getUser } from '../../api';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { control, Field, Input } from '../../ui/Field';
import { Check, Ic } from '../../ui/bits';
import { Money } from '../../ui/Money';
import { PageHeader } from '../../ui/PageHeader';
import { StatusChip } from '../../ui/StatusChip';
import { Table } from '../../ui/Table';
import { plannedPackages, projectOfPackage, toIso, type BoqLine, type Created, type Criterion, type Found, type Lot, type Twin } from './data';
import { Back, ErrorNote } from './parts';

// ponytail: sample directory of technical evaluators (from sample/seed.ts); the engine checks the role on create. Replace with a users command.
const EVALUATORS: [string, string][] = [['u-hana', 'Hana Kobayashi'], ['u-marco', 'Marco Bianchi'], ['u-aisha', 'Aisha Rahman']];
const SAMPLE_BOQ = `id,lot,item,unit,qty
G1,L1,2.5 MVA diesel generator set incl. enclosure,nr,12
G2,L1,"Installation, testing and commissioning",lot,1
F1,L2,Bulk fuel storage 2 x 100 m3 incl. polishing,lot,1
F2,L2,Synchronisation and paralleling panels,nr,4`;
const SAMPLE_CRITERIA: Criterion[] = [
  { id: 'C0', name: 'HSE prequalification', weight: 0, gate: true }, { id: 'C1', name: 'Technical compliance', weight: 40 },
  { id: 'C2', name: 'Delivery programme', weight: 25 }, { id: 'C3', name: 'Data-centre experience', weight: 20 }, { id: 'C4', name: 'After-sales and spares', weight: 15 },
];
const STEPS = ['Package', 'Scope', 'Evaluation', 'Suppliers', 'Timeline'];

export function Wizard({ twin, pkgId, onBack, onDone }: { twin: Twin; pkgId?: string; onBack: () => void; onDone: (id: string) => void }) {
  const qc = useQueryClient();
  const planned = plannedPackages(twin);
  const [step, setStep] = useState(0);
  const [pkg, setPkg] = useState(pkgId ?? planned[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [csv, setCsv] = useState(''), [boq, setBoq] = useState<BoqLine[]>([]), [lots, setLots] = useState<Lot[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>(SAMPLE_CRITERIA);
  const [tw, setTw] = useState(40), [threshold, setThreshold] = useState(65), [quorum, setQuorum] = useState(2), [blind, setBlind] = useState(true);
  const [evaluators, setEvaluators] = useState<string[]>(['u-hana', 'u-marco', 'u-aisha']);
  const [invite, setInvite] = useState<string[]>([]);
  const [closes, setCloses] = useState('');
  const p = twin.nodes.find(n => n.id === pkg);
  const category = String(p?.meta?.category ?? '');
  const toggle = (xs: string[], x: string) => (xs.includes(x) ? xs.filter(y => y !== x) : [...xs, x]);

  const upload = useMutation({
    mutationFn: () => call<{ lines: BoqLine[]; lots: Lot[] }>('intake', 'uploadBoq', { projectId: projectOfPackage(twin, pkg), name: `${p?.label ?? pkg} BOQ`, csvText: csv }),
    onSuccess: r => { setBoq(r.lines); setLots(r.lots); },
  });
  const search = useQuery({ queryKey: ['search', getUser(), category], enabled: !!category && step >= 3, queryFn: () => call<Found[]>('suppliers', 'search', category) });
  const create = useMutation({
    mutationFn: () => call<Created>('sourcing', 'create', pkg, { title: title || undefined, lots, boq, criteria, techWeight: tw / 100, techThreshold: threshold, quorum, blind, evaluators, invite, closesAt: toIso(closes) }),
    onSuccess: ev => { qc.setQueryData(['created', ev.id], ev); qc.invalidateQueries({ queryKey: ['twin'] }); onDone(ev.id); },
  });
  const err = create.error ? (create.error as Error).message : '';
  const scored = criteria.filter(c => !c.gate).reduce((s, c) => s + (Number(c.weight) || 0), 0);
  const setCrit = (i: number, c: Partial<Criterion>) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, ...c } : x)));

  const last = step === STEPS.length - 1;
  const hold = step === 0 && !pkg ? 'Choose a package first.' : step === 1 && !boq.length ? 'Check the BOQ first: the engine reads it and builds the lots.' : last && !closes ? 'Set a closing time.' : '';
  const go = () => (last ? create.mutate() : setStep(step + 1));

  return (
    <>
      <Back onClick={onBack}>All events</Back>
      <PageHeader
        eyebrow={p ? `Package ${p.id}, ${category}` : 'Sample data'}
        title="Create sourcing event"
        chip={<><StatusChip>Step {step + 1} of {STEPS.length}: {STEPS[step]}</StatusChip>{p && <StatusChip>{String(p.meta?.route)}</StatusChip>}</>}
        figures={[{ label: 'Package estimate', big: true, value: p?.value !== undefined ? <Money value={p.value} big /> : '-' }]}
        action={
          <div className="bar-sticky flex flex-wrap items-center justify-end gap-3">
            {hold && <p className="soft min-w-0 flex-1 basis-full max-md:order-first md:order-last md:text-right">{hold}</p>}
            {step > 0 && <Button variant="text" onClick={() => setStep(step - 1)}>Back</Button>}
            <Button variant="primary" disabled={!!hold} loading={create.isPending} onClick={go} className="max-md:flex-1">{last ? 'Create event' : 'Continue'}</Button>
          </div>
        }
      />

      <ol aria-label="Steps" className="glass on-dark grid grid-cols-5 p-4">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? 'step' : undefined} className="relative grid justify-items-center gap-2">
            {i > 0 && <span aria-hidden className={`absolute right-1/2 top-[0.6875rem] h-px w-full ${i <= step ? 'bg-gold' : 'bg-white/20'}`} />}
            <span className={`relative grid size-6 place-items-center rounded-full border ${i === step ? 'border-accent bg-accent text-on-accent shadow-[0_0_0_5px_rgb(245_184_0/0.18)]' : i < step ? 'border-gold bg-gold text-night' : 'border-white/30 bg-night-deep'}`}>{i < step ? <Ic n="check" className="size-3.5" /> : <span className="text-label font-semibold">{i + 1}</span>}</span>
            <span className={`text-center text-label max-md:hidden ${i === step ? 'font-semibold' : 'soft'}`}>{s}</span>
          </li>
        ))}
      </ol>

      {err && <ErrorNote>{err}</ErrorNote>}

      {step === 0 && (
        <Card className="grid gap-4">
          <div><h2 className="text-section font-semibold">Planned package</h2><p className="soft">Only packages the plan has released can start an event.</p></div>
          {!planned.length && <p className="soft">No planned package is waiting.</p>}
          <div role="radiogroup" aria-label="Planned package" className="grid gap-3 md:grid-cols-2">
            {planned.map(x => (
              <label key={x.id} className={`grid cursor-pointer gap-1.5 rounded-card border p-4 transition-transform has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-ring active:scale-[0.99] ${pkg === x.id ? 'border-primary bg-primary-soft' : 'border-line hover:border-primary'}`}>
                <input type="radio" name="pkg" checked={pkg === x.id} onChange={() => { setPkg(x.id); setBoq([]); }} className="sr-only" />
                <span className="flex items-center justify-between gap-2"><span className="font-code text-label">{x.id}</span><StatusChip tone={x.health === 'late' ? 'warning' : 'neutral'}>{x.meta?.route}</StatusChip></span>
                <span className="font-medium">{x.label}</span>
                <span className="soft">{x.meta?.category}{x.value !== undefined && <>, <Money value={x.value} /></>}</span>
              </label>
            ))}
          </div>
          <Field label="Event title (optional)" hint="Defaults to the package title."><Input value={title} onChange={e => setTitle(e.target.value)} /></Field>
        </Card>
      )}

      {step === 1 && (
        <Card className="grid gap-4">
          <div><h2 className="text-section font-semibold">Scope: lots and BOQ</h2><p className="soft">Paste the BOQ as CSV with the columns id, lot, item, unit, qty. The engine reads it and builds the lots; checking stores it as a BOQ template.</p></div>
          <Field label="BOQ (CSV)"><textarea rows={7} value={csv} onChange={e => { setCsv(e.target.value); setBoq([]); upload.reset(); }} spellCheck={false} className={`${control} font-code text-label`} placeholder={'id,lot,item,unit,qty\nG1,L1,Item description,nr,12'} /></Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" disabled={!csv.trim()} loading={upload.isPending} onClick={() => upload.mutate()}>Check BOQ</Button>
            <Button variant="text" onClick={() => { setCsv(SAMPLE_BOQ); setBoq([]); }}>Load sample BOQ</Button>
          </div>
          {upload.error && <ErrorNote>{(upload.error as Error).message}</ErrorNote>}
          {boq.length > 0 && (
            <div className="grid gap-4">
              <p className="flex items-center gap-2 font-medium text-(--ok)"><Ic n="check" />{boq.length} lines in {lots.length} lots accepted by the engine.</p>
              <div className="grid gap-3 md:grid-cols-2">{lots.map((l, i) => <Field key={l.id} label={`Lot ${l.id} name`}><Input value={l.name} onChange={e => setLots(lots.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></Field>)}</div>
              <Table caption="Parsed BOQ" rowKey={r => r.id} rows={boq} columns={[
                { key: 'id', header: 'Line', cell: r => r.id, mono: true }, { key: 'lot', header: 'Lot', cell: r => r.lotId, mono: true }, { key: 'item', header: 'Item', cell: r => r.item },
                { key: 'unit', header: 'Unit', cell: r => r.unit }, { key: 'qty', header: 'Qty', cell: r => r.qty, align: 'right' },
              ]} />
            </div>
          )}
        </Card>
      )}

      {step === 2 && (
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <Card className="grid content-start gap-4">
            <div><h2 className="text-section font-semibold">Criteria and weights</h2><p className="soft">Sample starting point for generator packages. A gate is pass or fail and carries no weight.</p></div>
            <ul className="grid gap-4">
              {criteria.map((c, i) => (
                <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_5.5rem_auto] items-end gap-x-3 gap-y-2 border-b border-(--hair) pb-4 last:border-0 last:pb-0">
                  <Field label={`${c.id} name`}><Input value={c.name} onChange={e => setCrit(i, { name: e.target.value })} /></Field>
                  <Field label="Weight"><Input type="number" min={0} inputMode="decimal" disabled={c.gate} value={c.gate ? 0 : c.weight} onChange={e => setCrit(i, { weight: Number(e.target.value) })} className="text-right" /></Field>
                  <Button variant="text" aria-label={`Remove ${c.id}`} onClick={() => setCriteria(criteria.filter((_, j) => j !== i))}>Remove</Button>
                  <div className="col-span-3"><Check label="Gate (pass or fail)" checked={!!c.gate} onChange={g => setCrit(i, { gate: g, weight: 0 })} /></div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="secondary" onClick={() => setCriteria([...criteria, { id: `C${criteria.length}`, name: 'New criterion', weight: 0 }])}>Add criterion</Button>
              <p className="numeral text-section">Scored total <span className="font-medium">{scored}</span></p>
            </div>
          </Card>
          <Card className="grid content-start gap-4">
            <h2 className="text-section font-semibold">Thresholds and committee</h2>
            <Field label="Technical share of the final score (%)"><Input type="number" min={0} max={100} value={tw} onChange={e => setTw(Number(e.target.value))} /></Field>
            <Field label="Minimum technical score"><Input type="number" min={0} max={100} value={threshold} onChange={e => setThreshold(Number(e.target.value))} /></Field>
            <Field label="Quorum (scores per criterion)"><Input type="number" min={1} value={quorum} onChange={e => setQuorum(Number(e.target.value))} /></Field>
            <Check label="Blind evaluation" hint="Evaluators see Bidder A, B, C instead of names." checked={blind} onChange={setBlind} />
            <fieldset className="grid gap-1"><legend className="mb-1 font-medium">Technical evaluators</legend>
              {EVALUATORS.map(([id, n]) => <Check key={id} label={n} checked={evaluators.includes(id)} onChange={() => setEvaluators(toggle(evaluators, id))} />)}
            </fieldset>
          </Card>
        </div>
      )}

      {step === 3 && (
        <Card className="grid gap-4">
          <div><h2 className="text-section font-semibold">Invite suppliers</h2><p className="soft">Suppliers in {category || 'the category'}, eligible first. The engine's checks show beside each one; ticking a blocked supplier shows the engine refuse it on create.</p></div>
          {search.isPending && <p className="soft">Checking eligibility…</p>}
          {search.error && <ErrorNote>{(search.error as Error).message}</ErrorNote>}
          {search.data && !search.data.length && <p className="soft">No supplier in the sample data is qualified for this category.</p>}
          <ul className="divide-y divide-(--hair)">
            {search.data?.map(s => {
              const refused = err.match(new RegExp(`${s.id} \\(([^)]*)\\)`))?.[1];
              return (
                <li key={s.id} className="grid gap-1 py-1">
                  <Check checked={invite.includes(s.id)} onChange={() => setInvite(toggle(invite, s.id))} label={
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">{s.name}<StatusChip tone={s.eligible ? (s.warnings.length ? 'warning' : 'success') : 'danger'}>{s.eligible ? (s.warnings.length ? 'Eligible, with warning' : 'Eligible') : 'Blocked'}</StatusChip></span>}
                    hint={`${s.id}, ${s.risk} risk, performance ${s.performance}`} />
                  <div className="grid gap-0.5 pl-8">
                    {s.blockers.map(b => <span key={b} className="font-medium text-(--bad)">{b}</span>)}
                    {s.warnings.map(w => <span key={w} className="text-(--warn)">{w}</span>)}
                    {refused && <span className="font-medium text-(--bad)">Engine on create: {refused}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="soft">{invite.length} selected.</p>
        </Card>
      )}

      {step === 4 && (
        <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
          <Card className="grid content-start gap-4">
            <h2 className="text-section font-semibold">Closing time</h2>
            <Field label="Bids close (UTC)" hint="Publishing needs a closing time in the future."><Input type="datetime-local" value={closes} onChange={e => setCloses(e.target.value)} className="[color-scheme:light]" /></Field>
          </Card>
          <Card>
            <h2 className="text-section font-semibold">Review</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {([
                ['Package', pkg], ['Lots and BOQ', `${lots.length} lots, ${boq.length} lines`], ['Scored weights', `${scored} across ${criteria.filter(c => !c.gate).length} criteria`],
                ['Final score split', `${tw}% technical, ${100 - tw}% commercial`], ['Threshold, quorum', `${threshold}, ${quorum}`], ['Evaluation', blind ? 'Blind' : 'Named'],
                ['Evaluators', evaluators.map(e => EVALUATORS.find(x => x[0] === e)?.[1]).join(', ') || 'None'], ['Invited', invite.length ? invite.join(', ') : 'None'],
              ] as const).map(([k, v]) => <div key={k}><dt className="eyebrow">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>)}
            </dl>
            <p className="soft mt-4">The event is created as a draft. Publishing it is a separate step.</p>
          </Card>
        </div>
      )}
    </>
  );
}
