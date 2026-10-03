import { useState } from 'react';
import type { Award } from '@satishjag/procurement-core/types';
import { call } from '../../api';
import { ActionBar } from '../../ui/ActionBar';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Field, control } from '../../ui/Field';
import { Money } from '../../ui/Money';
import { PageHeader } from '../../ui/PageHeader';
import { Section } from '../../ui/Section';
import { StatusChip } from '../../ui/StatusChip';
import { Table } from '../../ui/Table';
import { known, useResults, useTwin } from './data';
import { Evidence, Split } from './parts';

/** Buyer flow: pick one of the engine's scenarios, give the rationale, call awards.recommend. The engine returns the route. */
export function Recommend({ eventId, onBack, onDone }: { eventId: string; onBack: () => void; onDone: (a: Award) => void }) {
  const twin = useTwin(), results = useResults(eventId);
  const [pick, setPick] = useState('best_value'), [why, setWhy] = useState('');
  const event = twin.data?.nodes.find(n => n.id === eventId);
  const name = (id: string) => twin.data?.nodes.find(n => n.id === id)?.label ?? id;
  const r = results.data;
  if (results.error) return <Card glass className="text-(--bad)" role="alert">{(results.error as Error).message}<div className="mt-3"><Button variant="secondary" onClick={onBack}>All awards</Button></div></Card>;
  if (!r || !event) return <div aria-busy className="h-96 animate-pulse rounded-hero bg-(--hair)" />;
  const best = r.scenarios[0], chosen = r.scenarios.find(s => s.id === pick) ?? best;
  const saving = (s: typeof best) => Math.round((best.value - s.value) * 100) / 100;

  const run = async (_: string) => { const a = await call<Award>('awards', 'recommend', eventId, chosen.id, why); known.set(a.id, a); onDone(a); return a; };

  return (
    <>
      <div className="-mb-4"><Button variant="text" onClick={onBack} className="!-ml-2">&larr; All awards</Button></div>
      <PageHeader
        eyebrow={`${event.label}, sample data`}
        title="Recommend an award"
        chip={<><StatusChip tone="warning">Commercial evaluation</StatusChip><StatusChip>{eventId}</StatusChip>{chosen.deviation && <StatusChip tone="warning">Deviates from best value</StatusChip>}</>}
        figures={[
          { label: 'Chosen scenario value', big: true, value: <Money value={chosen.value} big animate /> },
          { label: chosen === best ? 'Reference scenario' : saving(chosen) >= 0 ? 'Saves against best value' : 'Costs more than best value', value: chosen === best ? 'Best value' : <Money value={Math.abs(saving(chosen))} /> },
          { label: 'Qualified bidders', value: r.ranking.length },
        ]}
        action={<ActionBar module="sourcing" id={eventId} labels={{ recommend: 'Recommend award' }} run={run} sticky />}
        visual={<div className="glass p-5"><p className="eyebrow mb-3">Chosen allocation</p><Split allocs={chosen.allocations} name={name} /></div>}
      />

      <fieldset className="grid gap-4 lg:grid-cols-[repeat(var(--n),minmax(0,1fr))]" style={{ '--n': r.scenarios.length } as React.CSSProperties}>
        <legend className="mb-3 text-section font-semibold">Choose a scenario</legend>
        {r.scenarios.map((s, i) => (
          <Card as="div" key={s.id} i={i + 1} lift className={`relative grid content-start gap-3 has-[:checked]:ring-2 has-[:checked]:ring-(--gold) has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-(--ring)`}>
            <label className="grid cursor-pointer gap-3 after:absolute after:inset-0">
              <input type="radio" name="scenario" value={s.id} checked={pick === s.id} onChange={() => setPick(s.id)} className="sr-only" />
              <span className="flex items-center gap-2"><span aria-hidden className={`grid size-5 place-items-center rounded-full border ${pick === s.id ? 'border-(--gold)' : 'border-control'}`}>{pick === s.id && <span className="size-2.5 rounded-full bg-(--gold)" />}</span><span className="font-semibold">{s.label}</span></span>
              <Money value={s.value} className="numeral text-[1.75rem] leading-none" />
              <span className={`font-medium ${s === best ? 'soft' : saving(s) >= 0 ? 'text-(--ok)' : 'text-(--bad)'}`}>
                {s === best ? 'Reference: the best-value ranking' : <>{saving(s) >= 0 ? 'Saves ' : 'Costs '}<Money value={Math.abs(saving(s))} /> against best value</>}
              </span>
            </label>
            <Split lots allocs={s.allocations} name={name} />
            {s.deviation && <StatusChip tone="warning">Deviates: needs a justification</StatusChip>}
          </Card>
        ))}
      </fieldset>

      <Card i={4} className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:gap-8">
        <Field label="Rationale" hint={chosen.deviation ? 'Required: this scenario deviates from the best-value ranking.' : 'Shown to every approver on the route.'}>
          <textarea value={why} onChange={e => setWhy(e.target.value)} rows={4} className={control} />
        </Field>
        <p className="soft self-end">The engine checks that every exclusion is priced, checks the budget, and routes the award by value and deviation. The route it returns appears on the next screen.</p>
      </Card>

      <Card i={5}>
        <Section title="Bid ranking and evidence" meta="Technical and commercial, from the engine">
          <div className="grid gap-5">
            <Table caption="Bid ranking" rowKey={x => x.supplierId} rows={r.ranking} columns={[
              { key: 'n', header: 'Bidder', cell: x => <span className="font-medium">{name(x.supplierId)}</span> },
              { key: 't', header: 'Technical', align: 'right', cell: x => x.technical },
              { key: 'c', header: 'Commercial', align: 'right', cell: x => x.commercial },
              { key: 'b', header: 'Combined', align: 'right', cell: x => <span className="font-semibold">{x.combined}</span> },
              { key: 'v', header: 'Normalised total', align: 'right', cell: x => <Money value={x.total} /> },
            ]} />
            <Evidence r={r} name={name} picked={chosen.allocations} />
          </div>
        </Section>
      </Card>
    </>
  );
}
