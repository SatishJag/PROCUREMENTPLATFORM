import { Card } from '../../ui/Card';
import { control, Field, Input } from '../../ui/Field';
import { Money } from '../../ui/Money';
import { Select } from '../../ui/bits';
import type { Budget } from './model';

export type Draft = { projectId: string; costCode: string; amount: string; needBy: string; title: string; description: string };
export const blank: Draft = { projectId: '', costCode: '', amount: '', needBy: '', title: '', description: '' };
// Sample text so a demo can start in one click. The engine classifies and routes it like any other request.
export const example: Omit<Draft, 'projectId' | 'costCode'> = { title: 'Standby diesel generators, data hall 1', description: 'Supply and install four 2.5 MW diesel generators with fuel day tanks for the standby power plant.', amount: '3200000', needBy: '2027-09-01' };

export const amountOf = (s: string) => Number(s.replace(/,/g, ''));

/** Required-field checks at the form edge only. Need-by in the future, cost code in the budget and role rules stay with the engine and show as returned. */
export function validate(d: Draft) {
  const e: Partial<Record<keyof Draft, string>> = {};
  if (!d.projectId) e.projectId = 'Choose a project';
  if (!d.costCode) e.costCode = 'Choose a cost code';
  if (!d.title.trim()) e.title = 'Give the request a title';
  if (!(amountOf(d.amount) > 0)) e.amount = 'Enter an amount above zero';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.needBy)) e.needBy = 'Pick the date it is needed on site';
  return e;
}

type Props = { draft: Draft; set: (d: Draft) => void; errors: ReturnType<typeof validate>; budgets: Budget[]; names: Record<string, string>; onSubmit: () => void };

export function Form({ draft, set, errors, budgets, names, onSubmit }: Props) {
  const projects = [...new Set(budgets.map(b => b.project))];
  const lines = budgets.filter(b => b.project === draft.projectId);
  const line = lines.find(b => b.costCode === draft.costCode);
  const up = (k: keyof Draft) => (v: string) => set({ ...draft, [k]: v });
  const amount = amountOf(draft.amount);
  return (
    <Card i={1} as="div">
      <form id="intake-form" noValidate onSubmit={e => { e.preventDefault(); onSubmit(); }} className="grid gap-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-section font-semibold">Request details</h2>
          <button type="button" onClick={() => set({ ...draft, ...example })} className="soft min-h-11 rounded-ctl px-1 underline underline-offset-4 hover:text-(--fg) active:scale-[0.97] md:min-h-0">Fill with sample request</button>
        </div>
        <div className="grid items-start gap-5 md:grid-cols-2">
          <Select label="Project" value={draft.projectId} onChange={v => set({ ...draft, projectId: v, costCode: '' })} placeholder="Choose a project" error={errors.projectId} options={projects.map(p => [p, names[p] ? `${p}, ${names[p]}` : p])} />
          <Select
            label="Cost code" value={draft.costCode} onChange={up('costCode')} placeholder={draft.projectId ? 'Choose a cost code' : 'Choose a project first'} error={errors.costCode}
            options={lines.map(b => [b.costCode, b.costCode])}
            hint={line ? `AED ${line.available.toLocaleString('en')} available of ${line.budget.toLocaleString('en')}` : 'Budget lines come from the engine'}
          />
          <Field label="Amount (AED)" error={errors.amount} hint={amount > 0 ? undefined : 'Estimated value including all lines'}>
            <Input inputMode="decimal" value={draft.amount} onChange={e => up('amount')(e.target.value)} aria-invalid={!!errors.amount || undefined} placeholder="e.g. 3,200,000" autoComplete="off" />
            {amount > 0 && <span className="text-ink-soft"><Money value={amount} /></span>}
          </Field>
          <Field label="Need-by date" error={errors.needBy} hint="Required on site. The engine plans the sourcing calendar backwards from it.">
            <Input type="date" value={draft.needBy} onChange={e => up('needBy')(e.target.value)} aria-invalid={!!errors.needBy || undefined} />
          </Field>
        </div>
        <Field label="Title" error={errors.title}>
          <Input value={draft.title} onChange={e => up('title')(e.target.value)} aria-invalid={!!errors.title || undefined} placeholder="What are you buying?" maxLength={140} />
        </Field>
        <Field label="Description" hint="Name the equipment or service. The classifier reads the title and this text, and shows what it matched.">
          <textarea rows={4} value={draft.description} onChange={e => up('description')(e.target.value)} className={control} placeholder="Scope, quantities, anything a buyer must know" />
        </Field>
      </form>
    </Card>
  );
}

/** Every budget line of the chosen project, from the engine; picking one fills the cost code. */
export function BudgetLines({ budgets, draft, set }: { budgets: Budget[]; draft: Draft; set: (d: Draft) => void }) {
  const amount = amountOf(draft.amount);
  const lines = budgets.filter(b => !draft.projectId || b.project === draft.projectId);
  return (
    <Card i={2} className="self-start">
      <h2 className="text-section font-semibold">Budget lines</h2>
      <p className="soft mt-1">Committed against budget, from the engine. Choose one to fill the cost code.</p>
      <ul className="mt-3 grid gap-1">
        {lines.map(b => {
          const on = b.project === draft.projectId && b.costCode === draft.costCode;
          const used = Math.min(100, (b.committed / b.budget) * 100), ask = on && amount > 0 ? Math.min(100 - used, (amount / b.budget) * 100) : 0;
          return (
            <li key={b.project + b.costCode}>
              <button type="button" aria-pressed={on} onClick={() => set({ ...draft, projectId: b.project, costCode: b.costCode })}
                className={`grid min-h-11 w-full gap-1.5 rounded-ctl border px-3 py-2 text-left transition-transform duration-200 hover:bg-primary-soft active:scale-[0.99] ${on ? 'border-(--gold) bg-primary-soft' : 'border-transparent'}`}>
                <span className="flex items-baseline justify-between gap-3"><span className="font-code text-label">{b.costCode}</span><span className="numeral text-body font-medium"><Money value={b.available} /></span></span>
                <span aria-hidden className="relative flex h-1.5 overflow-hidden rounded-full bg-primary-soft ring-1 ring-(--hair)">
                  <span className="bg-primary" style={{ width: `${used}%` }} />
                  <span className={amount > b.available && on ? 'bg-danger' : 'bg-(--gold)'} style={{ width: `${ask}%` }} />
                </span>
              </button>
            </li>
          );
        })}
        {!lines.length && <li className="soft">No budget lines were returned for this project.</li>}
      </ul>
      <p className="soft mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-label"><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-primary" />Committed</span><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-(--gold)" />This request</span></p>
    </Card>
  );
}
