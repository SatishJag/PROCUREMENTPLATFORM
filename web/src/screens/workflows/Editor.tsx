import { useState } from 'react';
import { Button } from '../../ui/Button';
import { StatusChip } from '../../ui/StatusChip';
import { Ic, Lbl, useDesktop } from '../../ui/bits';
import { Canvas, StageBody } from './Canvas';
import type { Input as In, Issue } from './logic';
import { edgeLabel, issues as check, simulate } from './logic';
import type { Stage, Workflow } from './fixtures';
import { Inspector } from './Inspector';
import { Safeguards, Simulator } from './Simulator';

type Props = {
  wf: Workflow; hasDraft: boolean; canEdit: boolean; why: string; back: () => void;
  edit: (fn: (w: Workflow) => Workflow, note?: { text: string; reason: string }) => void;
  input: In; setInput: (p: Partial<In>) => void; show: boolean; setShow: (v: boolean) => void;
};

export function Editor({ wf, hasDraft, canEdit, why, back, edit, input, setInput, show, setShow }: Props) {
  const desktop = useDesktop();
  const [selId, setSel] = useState(wf.stages[0]?.id ?? '');
  const s = wf.stages.find(x => x.id === selId) ?? wf.stages[0];
  const sim = simulate(wf, input), list = check(wf), route = show ? new Set(sim.chain) : null;
  const patch = (p: Partial<Stage>) => edit(w => ({ ...w, stages: w.stages.map(x => x.id === s.id ? { ...x, ...p } : x) }));
  const add = () => {
    const id = `s${Date.now().toString(36)}`, at = Math.max(wf.stages.indexOf(s) + 1, 0);
    const n: Stage = { id, name: 'New stage', approver: { kind: 'role', value: '' }, parallelWithPrev: false, quorum: 'any', limit: null, slaHours: 24, escalateTo: '', escalateAfter: 24, delegateTo: '', email: true, inApp: true, forms: [], fields: [], validations: [], badges: [] };
    edit(w => ({ ...w, stages: [...w.stages.slice(0, at), n, ...w.stages.slice(at)] }));
    setSel(id);
  };
  const move = (d: -1 | 1) => edit(w => {
    const i = w.stages.findIndex(x => x.id === s.id), j = i + d, st = [...w.stages];
    [st[i], st[j]] = [st[j], st[i]];
    return { ...w, stages: st };
  });
  const remove = (reason: string) => {
    const i = wf.stages.indexOf(s);
    edit(w => ({ ...w, stages: w.stages.filter(x => x.id !== s.id), rules: w.rules.map(r => ({ ...r, chain: r.chain.filter(c => c !== s.id) })) }), { text: `Stage "${s.name}" removed from the draft`, reason });
    setSel(wf.stages[i + 1]?.id ?? wf.stages[i - 1]?.id ?? '');
  };
  const setRule = (rid: string, on: boolean) => edit(w => ({ ...w, rules: w.rules.map(r => r.id === rid ? { ...r, chain: on ? [...r.chain, s.id] : r.chain.filter(c => c !== s.id) } : r) }));
  const pick = (i: Issue) => { if (i.stage) setSel(i.stage); };
  const inspector = s && <Inspector key={s.id} wf={wf} s={s} canEdit={canEdit} why={why} patch={patch} setRule={setRule} move={move} remove={remove} />;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
      <div className="grid min-w-0 gap-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Button variant="text" onClick={back}><Lbl n="back">All workflows</Lbl></Button>
          <h2 className="text-section font-semibold">{wf.name}</h2>
          <StatusChip tone={hasDraft ? 'warning' : 'success'}>{hasDraft ? `Draft v${wf.version}` : `Published v${wf.version}`}</StatusChip>
          <span className="ml-auto"><Button onClick={add} disabled={!canEdit}><Lbl n="plus">Add stage</Lbl></Button></span>
        </div>
        {!canEdit && <p className="soft flex items-center gap-2"><Ic n="lock" />{why}</p>}
        {desktop ? <Canvas wf={wf} sel={s?.id ?? ''} onSel={setSel} route={route} /> : (
          <ol className="on-dark grid gap-0" aria-label="Stages">
            {wf.stages.map((x, i) => {
              const on = !route || route.has(x.id), label = edgeLabel(wf, x.id);
              return (
                <li key={x.id} className="grid gap-3">
                  <div className="relative ml-4 border-l border-gold/40 pb-4 pl-5">
                    <span className="absolute -left-[0.4rem] top-0 h-3 w-3 rounded-full border border-gold bg-night" aria-hidden />
                    <span className="eyebrow !text-(--gold) block pb-2">{x.parallelWithPrev && i ? 'Parallel with the previous stage' : label ? `When ${label}` : 'Always'}</span>
                    <button type="button" aria-pressed={x.id === s?.id} onClick={() => setSel(x.id)} className={`grid w-full gap-2 rounded-card border p-4 text-left transition-[transform,opacity] active:scale-[0.99] ${x.id === s?.id ? 'border-accent bg-night-raised shadow-[0_0_0_2px_rgb(245_184_0/0.5)]' : on && route ? 'border-gold bg-night-raised' : 'border-white/15 bg-gradient-to-b from-night-raised to-night'} ${on ? '' : 'opacity-45'}`}>
                      <StageBody s={x} wf={wf} lv={2} step={route && on ? sim.chain.indexOf(x.id) + 1 : undefined} />
                    </button>
                  </div>
                  {x.id === s?.id && <div className="on-light -mt-1 pb-3">{inspector}</div>}
                </li>
              );
            })}
          </ol>
        )}
        <Simulator wf={wf} input={input} set={setInput} sim={sim} show={show} setShow={setShow} />
      </div>
      <div className="grid gap-5">
        {desktop && (inspector ?? <p className="soft">This workflow has no stages. Add one to start.</p>)}
        <Safeguards list={list} onPick={pick} kind={wf.kind} />
      </div>
    </div>
  );
}
