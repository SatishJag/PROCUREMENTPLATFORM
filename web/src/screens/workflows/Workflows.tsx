// Workflow Console: UI-only preview of spec section 6. State lives here (React state seeded from fixtures.ts); nothing calls the engine.
import { useMemo, useState } from 'react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { PageHeader } from '../../ui/PageHeader';
import { StatusChip } from '../../ui/StatusChip';
import { Select, Tabs } from './bits';
import { Delegation, Notifications } from './Admin';
import { Editor } from './Editor';
import { DEMO_TODAY, seed, type Entry, type Rule, type Stage, type Store, type Workflow } from './fixtures';
import { defaultInput, columns, diff, issues, simulate, type Input } from './logic';
import { Matrix } from './Matrix';
import { PublishDialog, Versions } from './Versions';

type Tab = 'workflows' | 'matrix' | 'delegation' | 'notices' | 'versions';
type Persona = 'super' | 'owner' | 'viewer';
const PERSONAS: Record<Persona, { label: string; who: string }> = {
  super: { label: 'Super user', who: 'Super user (demo)' },
  owner: { label: 'Process owner, Daniel Okafor', who: 'Daniel Okafor (demo)' },
  viewer: { label: 'Auditor, Grace Lindqvist', who: 'Grace Lindqvist (demo)' },
};
const live = (e: Entry) => e.draft ?? e.published!;

/** A thumbnail of the flow: one disc per stage, parallel stages stacked. */
function Mini({ wf }: { wf: Workflow }) {
  const cols = columns(wf), tall = Math.max(1, ...cols.map(c => c.length)), gap = 34, h = tall * 18 + 10;
  const at = (j: number, i: number, n: number) => [14 + j * gap, h / 2 + (i - (n - 1) / 2) * 18] as const;
  return (
    <svg aria-hidden viewBox={`0 0 ${Math.max(cols.length * gap + 4, 60)} ${h}`} height={h} className="text-gold-deep">
      {cols.slice(1).flatMap((c, j) => cols[j].flatMap((_, a) => c.map((__, b) => { const [x1, y1] = at(j, a, cols[j].length), [x2, y2] = at(j + 1, b, c.length); return <line key={`${j}${a}${b}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeOpacity=".5" />; })))}
      {cols.flatMap((c, j) => c.map((s, i) => { const [x, y] = at(j, i, c.length); return <circle key={s.id} cx={x} cy={y} r="5" fill="var(--color-porcelain)" stroke="currentColor" strokeWidth="1.5" />; }))}
    </svg>
  );
}

export function Workflows() {
  const [store, setStore] = useState<Store>(seed);
  const [tab, setTab] = useState<Tab>('workflows');
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeId, setActive] = useState('award');
  const [persona, setPersona] = useState<Persona>('super');
  const [input, setInputState] = useState<Input>(defaultInput);
  const [show, setShow] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState('');

  const ids = Object.keys(store.entries);
  const entry = store.entries[activeId] ?? store.entries[ids[0]], wf = live(entry), hasDraft = !!entry.draft;
  const who = PERSONAS[persona].who;
  const canEdit = persona === 'super' || (persona === 'owner' && wf.owner === 'Daniel Okafor');
  const why = persona === 'viewer' ? 'Auditors can view workflows but not change them.' : `Process owners edit only their own workflows. ${wf.name} is owned by ${wf.owner}.`;
  const list = useMemo(() => issues(wf), [wf]), errors = list.filter(i => i.level === 'error');
  const sim = useMemo(() => simulate(wf, input), [wf, input]);
  const changes = useMemo(() => (hasDraft ? diff(entry.published, entry.draft!) : []), [entry, hasDraft]);
  const drafts = ids.filter(i => store.entries[i].draft), blocking = drafts.reduce((n, i) => n + issues(store.entries[i].draft!).filter(x => x.level === 'error').length, 0);

  /** Every edit lands in a draft; the first edit of a published workflow clones it as the next version. */
  const edit = (fn: (w: Workflow) => Workflow, note?: { text: string; reason: string }) => {
    setNotice('');
    setStore(s => {
      const e = s.entries[activeId], base = e.draft ?? { ...structuredClone(e.published!), version: e.published!.version + 1 };
      return { ...s, entries: { ...s.entries, [activeId]: { ...e, draft: { ...fn(base), edited: DEMO_TODAY, editedBy: who } } }, log: note ? [{ at: DEMO_TODAY, who, wf: base.name, ...note }, ...s.log] : s.log };
    });
  };
  const publish = (date: string, reason: string) => {
    setStore(s => {
      const e = s.entries[activeId], d = e.draft!, p = { ...d, effective: date, edited: DEMO_TODAY, editedBy: who };
      return { ...s, entries: { ...s.entries, [activeId]: { published: p, draft: null, history: [{ v: d.version, effective: date, by: who, at: DEMO_TODAY, reason, snapshot: p }, ...e.history] } }, log: [{ at: DEMO_TODAY, who, wf: d.name, text: `Published v${d.version}, effective ${date} (local demo)`, reason }, ...s.log] };
    });
    setPublishing(false); setNotice('Published locally (demo)');
  };
  const rollback = (v: number, reason: string) => {
    setStore(s => {
      const e = s.entries[activeId], snap = e.history.find(h => h.v === v)!.snapshot!, next = e.published!.version + 1, p = { ...structuredClone(snap), version: next, effective: DEMO_TODAY, edited: DEMO_TODAY, editedBy: who };
      return { ...s, entries: { ...s.entries, [activeId]: { published: p, draft: null, history: [{ v: next, effective: DEMO_TODAY, by: who, at: DEMO_TODAY, reason: `Rolled back to v${v}: ${reason}`, snapshot: p }, ...e.history] } }, log: [{ at: DEMO_TODAY, who, wf: p.name, text: `Rolled back to v${v}, now v${next} (local demo)`, reason }, ...s.log] };
    });
    setNotice('Rolled back locally (demo)');
  };
  const discard = (reason: string) => {
    setStore(s => ({ ...s, entries: { ...s.entries, [activeId]: { ...s.entries[activeId], draft: null } }, log: [{ at: DEMO_TODAY, who, wf: wf.name, text: `Draft v${wf.version} discarded`, reason }, ...s.log] }));
    setNotice('');
  };
  const create = () => {
    const id = `w${Date.now().toString(36)}`, stage: Stage = { id: 's1', name: 'Approval', approver: { kind: 'role', value: '' }, parallelWithPrev: false, quorum: 'any', limit: null, slaHours: 24, escalateTo: '', escalateAfter: 24, delegateTo: '', email: true, inApp: true, forms: [], fields: [], validations: [], badges: [] };
    const rule: Rule = { id: 'r1', name: 'Every request', enabled: true, effect: 'set', min: 0, max: null, person: '', designation: '', project: '', category: '', country: '', overBudget: false, deviation: false, chain: ['s1'] };
    const w: Workflow = { id, name: 'New workflow', kind: 'review', summary: 'A new workflow. Pick its approver, then add rules and stages.', owner: PERSONAS[persona].who.replace(' (demo)', ''), version: 1, effective: '', edited: DEMO_TODAY, editedBy: who, stages: [stage], rules: [rule] };
    setStore(s => ({ ...s, entries: { ...s.entries, [id]: { published: null, draft: w, history: [] } }, log: [{ at: DEMO_TODAY, who, wf: w.name, text: 'Draft v1 created', reason: 'Started from a blank workflow' }, ...s.log] }));
    setActive(id); setOpenId(id); setTab('workflows'); setNotice('');
  };
  const open = (id: string) => { setActive(id); setOpenId(id); setNotice(''); };
  const reset = () => { setStore(seed()); setOpenId(null); setActive('award'); setTab('workflows'); setInputState(defaultInput); setPersona('super'); setNotice(''); };

  const inLibrary = tab === 'workflows' && !openId, workflowTab = tab === 'workflows' || tab === 'matrix' || tab === 'versions';
  const blockReason = !canEdit ? why : !hasDraft ? 'Nothing to publish yet. Change a stage or a rule to start a draft.' : errors.length ? `${errors.length} blocking error${errors.length > 1 ? 's' : ''}: fix ${errors.length > 1 ? 'them' : 'it'} to publish.` : '';
  const action = inLibrary
    ? <div className="bar-sticky flex items-center gap-3 lg:justify-end"><Button variant="primary" onClick={create} disabled={persona === 'viewer'} className="max-md:flex-1">New workflow</Button></div>
    : workflowTab && (
      <div className="bar-sticky flex flex-wrap items-center gap-3 lg:justify-end">
        {blockReason && <p className={`min-w-0 flex-1 max-md:basis-full ${errors.length && hasDraft ? 'font-medium text-(--bad)' : 'soft'}`} role={errors.length && hasDraft ? 'alert' : undefined}>{blockReason}</p>}
        <Button variant="primary" disabled={!!blockReason} onClick={() => setPublishing(true)} className="max-md:flex-1">Publish workflow</Button>
      </div>
    );

  return (
    <>
      <p className="glass flex flex-wrap items-center gap-x-4 gap-y-1 !rounded-ctl py-2 pl-4 pr-2 md:pr-3" role="note">
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-gold" />
        <span className="soft min-w-0 flex-1">Preview: sample configuration, not connected to the engine.</span>
        <Button variant="text" onClick={reset}>Reset demo</Button>
      </p>
      <PageHeader
        eyebrow="Administration, Workflows"
        title="Workflow console"
        chip={<>
          <StatusChip tone="neutral">Preview, sample data</StatusChip>
          {!inLibrary && workflowTab && <StatusChip tone={hasDraft ? 'warning' : 'success'}>{wf.name}, {hasDraft ? `draft v${wf.version}` : `published v${wf.version}`}</StatusChip>}
          {notice && <span role="status"><StatusChip tone="success">{notice}</StatusChip></span>}
        </>}
        figures={[{ label: 'Workflows live', value: ids.filter(i => store.entries[i].published).length, big: true }, { label: 'Drafts', value: drafts.length }, { label: 'Blocking errors in drafts', value: blocking }]}
        action={action || undefined}
      />
      <Tabs label="Workflow console" value={tab} onChange={setTab} tabs={[['workflows', 'Workflows'], ['matrix', 'Authority matrix'], ['delegation', 'Delegation'], ['notices', 'Notifications'], ['versions', 'Versions']]} />
      <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="grid gap-5">
        {(tab === 'matrix' || tab === 'versions') && (
          <div className="max-w-sm"><Select label="Workflow" value={activeId} onChange={setActive} options={ids.map(i => [i, live(store.entries[i]).name])} /></div>
        )}
        {inLibrary && (
          <>
            <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Workflows">
              {ids.map((id, n) => {
                const e = store.entries[id], w = live(e), bad = e.draft ? issues(e.draft).filter(x => x.level === 'error').length : 0;
                return (
                  <Card key={id} as="li" lift i={n} className="grid content-start gap-3">
                    <div className="flex flex-wrap gap-2">
                      {e.published && <StatusChip tone="success">Published v{e.published.version}</StatusChip>}
                      {e.draft && <StatusChip tone="warning">Draft v{e.draft.version}</StatusChip>}
                      {bad > 0 && <StatusChip tone="danger">{bad} blocking</StatusChip>}
                    </div>
                    <h3 className="text-section font-semibold"><button type="button" onClick={() => open(id)} aria-label={`Open ${w.name}`} className="text-left after:absolute after:inset-0 after:rounded-card after:content-['']">{w.name}</button></h3>
                    <p className="text-ink-soft">{w.summary}</p>
                    <Mini wf={w} />
                    <dl className="grid grid-cols-3 gap-3 border-t border-line pt-3">
                      {([['Effective', e.published?.effective || 'Not published'], ['Owner', w.owner], ['Last edited', w.edited]] as const).map(([k, v]) => <div key={k}><dt className="eyebrow">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>)}
                    </dl>
                  </Card>
                );
              })}
            </ul>
            <Card as="div" i={ids.length} className="grid gap-4" aria-label="Permissions">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><h3 className="text-section font-semibold">Who can change a workflow</h3><p className="text-ink-soft">Try each view. Controls switch off with the reason beside them.</p></div>
                <div className="w-full sm:w-72"><Select label="Preview as" value={persona} onChange={v => setPersona(v as Persona)} options={Object.entries(PERSONAS).map(([k, v]) => [k, v.label])} /></div>
              </div>
              <dl className="grid gap-3 md:grid-cols-3">
                {([['Super user', 'View, edit, publish and roll back every workflow.', 'super'], ['Process owner', 'View every workflow. Edit, publish and roll back the workflows they own.', 'owner'], ['Approvers and auditors', 'View only. They cannot change a workflow.', 'viewer']] as const).map(([k, v, p]) => (
                  <div key={k} className={`rounded-card border p-4 ${persona === p ? 'border-primary bg-primary-soft' : 'border-line bg-white'}`}><dt className="font-semibold">{k}</dt><dd className="mt-1 text-ink-soft">{v}</dd></div>
                ))}
              </dl>
            </Card>
          </>
        )}
        {tab === 'workflows' && openId && <Editor key={activeId} wf={wf} hasDraft={hasDraft} canEdit={canEdit} why={why} back={() => setOpenId(null)} edit={edit} input={input} setInput={p => setInputState(i => ({ ...i, ...p }))} show={show} setShow={setShow} />}
        {tab === 'matrix' && <Matrix wf={wf} canEdit={canEdit} why={why} sim={sim} edit={edit} />}
        {tab === 'delegation' && <Delegation store={store} setStore={setStore} canEdit={persona !== 'viewer'} why="Auditors can view delegations but not change them." />}
        {tab === 'notices' && <Notifications store={store} setStore={setStore} canEdit={persona !== 'viewer'} why="Auditors can view notifications but not change them." />}
        {tab === 'versions' && <Versions entry={entry} changes={changes} canEdit={canEdit} why={why} log={store.log} discard={discard} rollback={rollback} />}
      </div>
      <PublishDialog open={publishing} onClose={() => setPublishing(false)} name={wf.name} version={wf.version} errors={errors} warnings={list.length - errors.length} changes={changes.length} publish={publish} />
    </>
  );
}
