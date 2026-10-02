import type { ReactNode } from 'react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Field';
import { StatusChip } from '../../ui/StatusChip';
import { Table } from '../../ui/Table';
import { Check, Ic, IconBtn, Lbl, cell } from './bits';
import { CATEGORIES, COUNTRIES, DESIGNATIONS, PEOPLE, PROJECTS, type Rule, type Workflow } from './fixtures';
import { coverage, issues, ruleName, type Sim } from './logic';

type Props = { wf: Workflow; canEdit: boolean; why: string; sim: Sim; edit: (fn: (w: Workflow) => Workflow, note?: { text: string; reason: string }) => void };
const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));

/** Where the amount bands leave a gap or overlap, drawn as a strip so it cannot be missed. */
function Coverage({ wf }: { wf: Workflow }) {
  const segs = coverage(wf);
  if (!segs.length) return <p className="text-ink-soft">No amount-only rules, so there are no bands to check.</p>;
  return (
    <ol className="grid grid-flow-col auto-cols-[minmax(7.5rem,1fr)] gap-1 overflow-x-auto pb-1" aria-label="Amount band coverage">
      {segs.map(s => {
        const bad = !s.rules.length, over = s.rules.length > 1;
        return (
          <li key={s.from} className="grid min-w-[7.5rem] gap-1.5">
            <span className={`grid min-h-12 content-center rounded-ctl border px-2 py-1.5 text-label font-medium leading-tight ${bad ? 'border-danger bg-danger-soft text-danger [background-image:repeating-linear-gradient(135deg,transparent_0_6px,rgb(179_38_30/0.14)_6px_8px)]' : over ? 'border-warning bg-[#fbefd3] text-warning' : 'border-primary/30 bg-primary-soft text-primary'}`}>
              {bad ? 'Gap: no rule' : over ? `Overlap: ${s.rules.length} rules` : ruleName(wf, s.rules[0])}
            </span>
            <span className="text-label text-ink-soft">{s.to == null ? `above ${s.from.toLocaleString('en')}` : `${s.from.toLocaleString('en')} to ${s.to.toLocaleString('en')}`}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Matrix({ wf, canEdit, why, sim, edit }: Props) {
  const set = (id: string, p: Partial<Rule>) => edit(w => ({ ...w, rules: w.rules.map(r => r.id === id ? { ...r, ...p } : r) }));
  const move = (i: number, d: -1 | 1) => edit(w => { const r = [...w.rules]; [r[i], r[i + d]] = [r[i + d], r[i]]; return { ...w, rules: r }; });
  const add = () => edit(w => ({ ...w, rules: [...w.rules, { id: `r${Date.now().toString(36)}`, name: 'New rule', enabled: true, effect: 'set', min: 0, max: null, person: '', designation: '', project: '', category: '', country: '', overBudget: false, deviation: false, chain: [] }] }));
  const del = (r: Rule) => (reason: string) => edit(w => ({ ...w, rules: w.rules.filter(x => x.id !== r.id) }), { text: `Rule "${ruleName(wf, r)}" removed from the draft`, reason });
  const matched = new Set(sim.matched.map(m => m.rule.id)), list = issues(wf);
  const opts = (xs: string[]): [string, string][] => xs.map(x => [x, x]);
  const sl = (label: string, v: string, f: (v: string) => void, o: [string, string][], ph = 'Any') => <select aria-label={label} value={v} onChange={e => f(e.target.value)} className={`${cell} w-full md:min-w-32`}><option value="">{ph}</option>{o.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>;

  const fields = (r: Rule, i: number): Record<string, ReactNode> => ({
    n: <div className="flex items-center gap-1"><span className="font-code w-5 text-label font-medium">{i + 1}</span><IconBtn label="Raise priority" n="up2" disabled={i === 0} onClick={() => move(i, -1)} /><IconBtn label="Lower priority" n="down2" disabled={i === wf.rules.length - 1} onClick={() => move(i, 1)} /></div>,
    on: <Check aria={`Rule ${i + 1} enabled`} checked={r.enabled} onChange={enabled => set(r.id, { enabled })} />,
    name: <div className="grid gap-1 md:min-w-60"><Input aria-label={`Rule ${i + 1} name`} value={r.name} onChange={e => set(r.id, { name: e.target.value })} />{matched.has(r.id) && <span><StatusChip tone="success">Matches the test inputs</StatusChip></span>}</div>,
    effect: <div className="md:min-w-36">{sl('Effect', r.effect, v => set(r.id, { effect: v as Rule['effect'] }), [['set', 'Sets the route'], ['add', 'Adds tiers']], '')}</div>,
    min: <div className="md:w-32"><Input aria-label="Amount above (AED)" type="number" min={0} step={1000} value={r.min} onChange={e => set(r.id, { min: num(e.target.value) })} /></div>,
    max: <div className="md:w-32"><Input aria-label="Amount up to (AED)" type="number" min={0} step={1000} placeholder="No limit" value={r.max ?? ''} onChange={e => set(r.id, { max: e.target.value === '' ? null : num(e.target.value) })} /></div>,
    person: sl('Requester', r.person, person => set(r.id, { person }), PEOPLE.map(p => [p.id, p.name])),
    designation: sl('Designation', r.designation, designation => set(r.id, { designation }), opts(DESIGNATIONS)),
    project: sl('Project', r.project, project => set(r.id, { project }), opts(PROJECTS)),
    category: sl('Category', r.category, category => set(r.id, { category }), opts(CATEGORIES)),
    country: sl('Country or entity', r.country, country => set(r.id, { country }), opts(COUNTRIES)),
    overBudget: <Check aria="Over budget" checked={r.overBudget} onChange={overBudget => set(r.id, { overBudget })} />,
    deviation: <Check aria="Deviation from ranking" checked={r.deviation} onChange={deviation => set(r.id, { deviation })} />,
    chain: (
      <div className="flex flex-wrap gap-1.5 md:min-w-[24rem]" role="group" aria-label={`Rule ${i + 1} route`}>
        {wf.stages.map(s => {
          const on = r.chain.includes(s.id);
          return <button key={s.id} type="button" aria-pressed={on} onClick={() => set(r.id, { chain: on ? r.chain.filter(c => c !== s.id) : [...r.chain, s.id] })} className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-label font-medium transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'border-primary bg-primary-soft text-primary' : 'border-control text-ink-soft hover:border-primary hover:text-primary'}`}>{on && <Ic n="check" className="size-3" />}{s.name}</button>;
        })}
      </div>
    ),
    del: <Button variant="destructive" onReason={del(r)} className="!h-9 !px-3">Remove rule</Button>,
  });
  const heads: [string, string, boolean?][] = [['n', 'Priority'], ['on', 'On'], ['name', 'Rule'], ['effect', 'Effect'], ['min', 'Amount above'], ['max', 'Amount up to'], ['person', 'Requester'], ['designation', 'Designation'], ['project', 'Project'], ['category', 'Category'], ['country', 'Country'], ['overBudget', 'Over budget'], ['deviation', 'Deviation'], ['chain', 'Routes to'], ['del', '']];
  const gaps = list.filter(i => /^(Gap|Overlap|Unreachable)/.test(i.text) || i.rule);

  return (
    <div className="grid gap-5">
      <Card as="div" className="grid gap-4" aria-label="Amount bands">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h3 className="text-section font-semibold">Amount bands</h3>
          <span className="text-ink-soft">First matching rule sets the route. Rules marked "Adds tiers" then add approvers. Checked across rules that use only an amount.</span>
        </div>
        <Coverage wf={wf} />
        {gaps.length > 0 && (
          <ul className="grid gap-1.5">
            {gaps.map(i => <li key={i.text} className={`flex items-start gap-2.5 ${i.level === 'error' ? 'text-danger' : 'text-warning'}`}><Ic n={i.level === 'error' ? 'err' : 'warn'} className="mt-0.5 size-4" /><span><b className="font-semibold">{i.level === 'error' ? 'Blocks publishing. ' : 'Check. '}</b>{i.text}</span></li>)}
          </ul>
        )}
      </Card>
      <Card as="div" className="grid gap-4" aria-label="Routing rules">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="mr-auto text-section font-semibold">Routing rules for {wf.name}</h3>
          {!canEdit && <span className="flex items-center gap-2 text-ink-soft"><Ic n="lock" />{why}</span>}
          <Button onClick={add} disabled={!canEdit}><Lbl n="plus">Add rule</Lbl></Button>
        </div>
        <fieldset disabled={!canEdit} className="min-w-0 border-0 p-0">
          <div className="max-md:hidden">
            <Table caption={`Routing rules for ${wf.name}, in priority order`} rows={wf.rules} rowKey={r => r.id}
              columns={heads.map(([k, h]) => ({ key: k, header: h, cell: (r: Rule) => fields(r, wf.rules.indexOf(r))[k] }))} />
          </div>
          <ol className="grid gap-4 md:hidden">
            {wf.rules.map((r, i) => {
              const f = fields(r, i);
              return (
                <li key={r.id} className="grid gap-3 rounded-card border border-line bg-white p-4">
                  <div className="flex items-center justify-between gap-2"><span className="eyebrow !text-(--gold)">Priority {i + 1}</span><div className="flex gap-2">{f.on}{f.n}</div></div>
                  {f.name}{f.effect}
                  <div className="grid grid-cols-2 gap-3"><label className="grid gap-1.5 font-medium">Above (AED){f.min}</label><label className="grid gap-1.5 font-medium">Up to (AED){f.max}</label></div>
                  <div className="grid grid-cols-2 gap-3">
                    {([['person', 'Requester'], ['designation', 'Designation'], ['project', 'Project'], ['category', 'Category'], ['country', 'Country']] as const).map(([k, h]) => <label key={k} className="grid gap-1.5 font-medium">{h}{f[k]}</label>)}
                  </div>
                  <div className="flex flex-wrap gap-x-5"><span className="flex items-center gap-1">{f.overBudget}Over budget</span><span className="flex items-center gap-1">{f.deviation}Deviation</span></div>
                  <div className="grid gap-1.5"><span className="font-medium">Routes to</span>{f.chain}</div>
                  <div>{f.del}</div>
                </li>
              );
            })}
          </ol>
        </fieldset>
      </Card>
    </div>
  );
}

