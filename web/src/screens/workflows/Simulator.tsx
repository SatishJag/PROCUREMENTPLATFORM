import { Card } from '../../ui/Card';
import { Input, Field } from '../../ui/Field';
import { StatusChip } from '../../ui/StatusChip';
import { Check, Ic, Select } from './bits';
import { CATEGORIES, COUNTRIES, PEOPLE, PROJECTS, aed, type Workflow } from './fixtures';
import { resolve, ruleName, stageName, type Input as In, type Issue, type Sim } from './logic';

type SP = { wf: Workflow; input: In; set: (p: Partial<In>) => void; sim: Sim; show: boolean; setShow: (v: boolean) => void };

/** "Test this workflow": inputs in, the route and the plain-language reasons out. The same result lights the canvas. */
export function Simulator({ wf, input, set, sim, show, setShow }: SP) {
  const route = wf.kind === 'route';
  return (
    <Card as="div" className="grid gap-5" aria-label="Test this workflow">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-section font-semibold">Test this workflow</h3>
        <Check label="Show the route on the canvas" checked={show} onChange={setShow} />
      </div>
      <div className="grid gap-5">
        <div className="grid content-start gap-3 sm:grid-cols-3">
          <Field label="Value (AED)"><Input type="number" min={0} step={10000} inputMode="numeric" value={input.value} onChange={e => set({ value: Math.max(0, Number(e.target.value) || 0) })} /></Field>
          <Select label="Category" value={input.category} onChange={category => set({ category })} options={CATEGORIES.map(c => [c, c])} />
          <Select label="Requester" value={input.requester} onChange={requester => set({ requester })} options={PEOPLE.map(p => [p.id, p.name])} />
          <Select label="Project" value={input.project} onChange={project => set({ project })} options={PROJECTS.map(c => [c, c])} />
          <Select label="Country or entity" value={input.country} onChange={country => set({ country })} options={COUNTRIES.map(c => [c, c])} />
          <div className="grid content-end sm:col-span-1">
            <Check label="Over budget" checked={input.overBudget} onChange={overBudget => set({ overBudget })} />
            <Check label="Deviates from ranking" checked={input.deviation} onChange={deviation => set({ deviation })} />
          </div>
        </div>
        <div className="grid content-start gap-4 border-t border-line pt-5" aria-live="polite">
          <div className="flex items-end gap-6">
            <div>
              <p className="eyebrow">{route ? 'Route chosen' : 'Approval steps'}</p>
              <p className="numeral text-[3.25rem] leading-none text-primary">{route ? sim.chain.length ? stageName(wf, sim.chain[0]) : 'None' : sim.steps}</p>
            </div>
            {!route && sim.hours > 0 && <div><p className="eyebrow">Within SLA</p><p className="numeral text-[1.5rem] leading-none">{sim.hours}<span className="ml-1 text-body font-normal text-ink-soft">hours</span></p></div>}
          </div>
          {!route && sim.chain.length > 0 && (
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5" aria-label="Route">
              {sim.chain.map((id, n) => (
                <li key={id} className="flex items-center gap-2">
                  {n > 0 && <Ic n="back" className="size-3 rotate-180 text-ink-soft" />}
                  <span className="rounded-full border border-primary/30 bg-primary-soft px-3 py-0.5 font-medium text-primary">{resolve(wf.stages.find(s => s.id === id)!.approver).label || stageName(wf, id)}</span>
                </li>
              ))}
            </ol>
          )}
          {sim.flags.map(f => <p key={f} role="alert" className="flex gap-2 rounded-ctl bg-danger-soft p-3 font-medium text-danger"><Ic n="warn" className="mt-0.5 size-4" />{f}</p>)}
          <div>
            <p className="eyebrow mb-1.5">Why</p>
            {sim.matched.length ? (
              <ul className="grid gap-1.5">
                {sim.matched.map(m => <li key={m.rule.id} className="text-ink-soft"><b className="font-semibold text-ink">Rule {m.n}, {ruleName(wf, m.rule)}.</b> {m.why.charAt(0).toUpperCase() + m.why.slice(1)}. Route: {m.rule.chain.map(c => stageName(wf, c)).join(', ')}.</li>)}
              </ul>
            ) : <p className="text-ink-soft">No rule matched these inputs.</p>}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Blocking errors and warnings from the safeguards, plus the controls the engine always enforces. */
export function Safeguards({ list, onPick, kind }: { list: Issue[]; onPick: (i: Issue) => void; kind: Workflow['kind'] }) {
  const errors = list.filter(i => i.level === 'error'), warns = list.filter(i => i.level === 'warning');
  const row = (i: Issue, tone: 'danger' | 'warning') => (
    <li key={i.text}>
      <button type="button" disabled={!i.stage && !i.rule} onClick={() => onPick(i)} className="flex w-full items-start gap-2.5 rounded-ctl p-2 text-left transition-transform hover:bg-primary-soft active:scale-[0.99] disabled:cursor-default disabled:hover:bg-transparent">
        <span className={`mt-0.5 ${tone === 'danger' ? 'text-danger' : 'text-warning'}`}><Ic n={tone === 'danger' ? 'err' : 'warn'} /></span>
        <span><b className={`font-semibold ${tone === 'danger' ? 'text-danger' : 'text-warning'}`}>{tone === 'danger' ? 'Blocks publishing. ' : 'Check. '}</b>{i.text}</span>
      </button>
    </li>
  );
  return (
    <Card as="div" className="grid gap-3 !p-4 md:!p-5" aria-label="Safeguards">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-section font-semibold">Safeguards</h3>
        <StatusChip tone={errors.length ? 'danger' : 'success'}>{errors.length ? `${errors.length} blocking` : 'Nothing blocking'}</StatusChip>
        {warns.length > 0 && <StatusChip tone="warning">{warns.length} to check</StatusChip>}
      </div>
      {list.length > 0 && <ul className="grid gap-0.5">{errors.map(i => row(i, 'danger'))}{warns.map(i => row(i, 'warning'))}</ul>}
      <ul className="grid gap-1.5 border-t border-line pt-3 text-ink-soft">
        {['A requester can never approve their own request.', 'The same person can never approve twice in one route.', ...(kind === 'approval' ? ['Every route must reach an approver whose limit covers the value.'] : [])].map(t => <li key={t} className="flex items-start gap-2.5"><span className="mt-0.5 text-success"><Ic n="check" /></span>{t}</li>)}
      </ul>
    </Card>
  );
}
