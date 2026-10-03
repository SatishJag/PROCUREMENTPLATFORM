import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Package, Requisition } from '@satishjag/procurement-core/types';
import { useState } from 'react';
import { call, getUser } from '../../api';
import { ActionBar } from '../../ui/ActionBar';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Money } from '../../ui/Money';
import { PageHeader } from '../../ui/PageHeader';
import { StatusChip } from '../../ui/StatusChip';
import { Ic } from '../../ui/bits';
import { Boq } from './Boq';
import { Case } from './Case';
import { amountOf, blank, BudgetLines, Form, validate, type Draft } from './Form';
import { decided, health, type Dash, type Entry } from './model';
import { signed } from './Timeline';

const labels = { approve: 'Approve request', reject: 'Reject request' };
const SAVED = 'intake-session';

/** This session's requests. The engine has no requisition list, so they live in the tab (sessionStorage survives a reload, not a new tab). */
function useSession() {
  const [list, set] = useState<Entry[]>(() => JSON.parse(sessionStorage.getItem(SAVED) ?? '[]'));
  const update = (fn: (l: Entry[]) => Entry[]) => set(cur => { const n = fn(cur); sessionStorage.setItem(SAVED, JSON.stringify(n)); return n; });
  const record = (id: string, patch: Partial<Entry>) => update(cur => cur.some(e => e.id === id) ? cur.map(e => e.id === id ? { ...e, ...patch } : e) : [{ id, value: patch.req?.amount ?? 0, ...patch }, ...cur]);
  return [list, record] as const;
}

export function Intake() {
  const qc = useQueryClient();
  const dash = useQuery({ queryKey: ['dashboard', getUser()], queryFn: () => call<Dash>('reporting', 'dashboard') });
  const twin = useQuery({ queryKey: ['twin', getUser()], queryFn: () => call<{ nodes: { id: string; kind: string; label: string }[] }>('reporting', 'twin') });
  const [session, record] = useSession();
  const [sel, setSel] = useState('');
  const [raw, setDraft] = useState<Draft>(blank);
  const [tried, setTried] = useState(false);

  const budgets = dash.data?.budget ?? [];
  const names = Object.fromEntries((twin.data?.nodes ?? []).filter(n => n.kind === 'project').map(n => [n.id, n.label]));
  const waiting = (dash.data?.myApprovals ?? []).filter(a => a.type === 'requisition');
  const known = new Map(session.map(e => [e.id, e]));
  const queue: Entry[] = [...waiting.map(w => known.get(w.id) ?? { id: w.id, value: w.value }), ...session.filter(e => !waiting.some(w => w.id === e.id))];
  const active = sel || waiting[0]?.id || 'new';
  const entry = active === 'new' ? undefined : queue.find(e => e.id === active);
  const show = (id: string) => { setSel(id); window.scrollTo({ top: 0 }); };

  const only = [...new Set(budgets.map(b => b.project))];
  const draft = { ...raw, projectId: raw.projectId || (only.length === 1 ? only[0] : '') }; // one project: no choice to make
  const errors = validate(draft);
  const submit = useMutation({
    mutationFn: () => call<Requisition>('intake', 'submit', { projectId: draft.projectId, costCode: draft.costCode, title: draft.title.trim(), description: draft.description.trim(), amount: amountOf(draft.amount), needBy: draft.needBy }),
    onSuccess: r => { record(r.id, { id: r.id, value: r.amount, req: r }); setDraft(blank); setTried(false); show(r.id); qc.invalidateQueries(); },
  });
  const go = () => {
    setTried(true);
    if (Object.keys(errors).length) return void requestAnimationFrame(() => document.querySelector<HTMLElement>('#intake-form [aria-invalid=true]')?.focus());
    submit.mutate();
  };
  const decide = (id: string) => async (action: string, reason: string) => {
    const r = await call<{ requisition: Requisition; package?: Package }>('intake', 'decide', id, action, reason);
    setSel(id); // the queue entry disappears once decided; stay on it to show the outcome
    record(id, { req: r.requisition, pkg: r.package, value: r.requisition.amount, reason: action === 'reject' ? reason : undefined });
  };
  // Same query key and function as ActionBar's, so the cache is shared: the header knows whether the engine offers this user anything.
  const actions = useQuery({ queryKey: ['actions', getUser(), 'intake', active], enabled: !!entry, queryFn: () => call<string[]>('intake', 'actions', active) });

  if (dash.error) return <Card glass className="text-(--bad)" role="alert">{(dash.error as Error).message}</Card>;
  if (!dash.data) return <div aria-busy className="h-96 animate-pulse rounded-hero bg-white/5" />;

  const r = entry?.req, status = r?.status ?? 'submitted';
  const line = budgets.find(b => b.project === draft.projectId && b.costCode === draft.costCode);
  const [dTone, dLabel] = decided[status];
  const project = r?.projectId ?? draft.projectId;

  const header = entry ? (
    <PageHeader
      eyebrow={`Requisition ${entry.id}${project ? `, project ${project}` : ''}, sample data`}
      title={r?.title ?? `Requisition ${entry.id}`}
      chip={<StatusChip tone={dTone}>{dLabel}</StatusChip>}
      figures={[
        { label: 'Requested value', big: true, value: <Money value={r?.amount ?? entry.value} animate big /> },
        ...(r ? [{ label: 'Route', value: r.recommendation.route }, { label: 'Float', value: <span>{signed(r.schedule.floatDays)}<span className="soft text-label"> d</span></span> }, { label: 'Calendar', value: <span className="text-body"><StatusChip tone={health[r.schedule.health][0]}>{health[r.schedule.health][1]}</StatusChip></span> }] : []),
      ]}
      action={actions.data?.length
        ? <ActionBar module="intake" id={entry.id} labels={labels} run={decide(entry.id)} sticky />
        : (
          <div className="bar-sticky flex flex-wrap items-center gap-3 lg:justify-end">
            {actions.isSuccess && <p className="soft min-w-0 flex-1 max-md:basis-full lg:flex-none">{status === 'submitted' ? 'Nothing for you to do on this item.' : 'Decided. Nothing more to do here.'}</p>}
            <Button variant="primary" onClick={() => show('new')} className="max-md:flex-1">New request</Button>
          </div>
        )}
    />
  ) : (
    <PageHeader
      eyebrow={`Project ${draft.projectId || 'DC1'}, sample data`}
      title="New purchase request"
      chip={<StatusChip tone="neutral">Not yet submitted</StatusChip>}
      figures={line ? [
        { label: `Available in ${line.costCode}`, big: true, value: <Money value={line.available} animate big /> },
        { label: 'Budget', value: <Money value={line.budget} /> },
        { label: 'Committed', value: <Money value={line.committed} /> },
      ] : []}
      action={
        <div className="bar-sticky flex flex-wrap items-center gap-3 lg:justify-end">
          {submit.error && <p role="alert" className="min-w-0 flex-1 font-medium text-(--bad) max-md:basis-full">{submit.error.message}</p>}
          <Button variant="primary" loading={submit.isPending} onClick={go} className="max-md:flex-1">Submit request</Button>
        </div>
      }
    />
  );

  return (
    <>
      {header}

      <nav aria-label="Requests" className="glass on-dark flex items-center gap-2 overflow-x-auto p-2">
        <button type="button" aria-current={active === 'new' ? 'page' : undefined} onClick={() => show('new')} className={`inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 font-medium transition-transform active:scale-[0.97] ${active === 'new' ? 'border-(--gold) bg-white/10' : 'border-(--hair) hover:bg-white/[0.07]'}`}><Ic n="plus" />New request</button>
        {queue.map(e => (
          <button key={e.id} type="button" aria-current={active === e.id ? 'page' : undefined} onClick={() => show(e.id)} className={`inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 transition-transform active:scale-[0.97] ${active === e.id ? 'border-(--gold) bg-white/10' : 'border-(--hair) hover:bg-white/[0.07]'}`}>
            <span className="font-code text-label">{e.id}</span>
            {e.value > 0 && <span className="numeral"><Money value={e.value} /></span>}
            <span className="soft">{waiting.some(w => w.id === e.id) ? 'waiting on you' : decided[e.req?.status ?? 'submitted'][1].toLowerCase()}</span>
          </button>
        ))}
        <p className="soft ml-auto hidden pl-4 xl:block">No requisition list exists in the engine: this shows requests submitted in this session and those waiting on you.</p>
      </nav>

      {entry ? <Case e={entry} /> : (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <Form draft={draft} set={setDraft} errors={tried ? errors : {}} budgets={budgets} names={names} onSubmit={go} />
            <BudgetLines budgets={budgets} draft={draft} set={setDraft} />
          </div>
          <Boq budgets={budgets} projectId={draft.projectId} />
        </>
      )}
      <p className="soft xl:hidden">No requisition list exists in the engine: the strip above shows requests submitted in this session and those waiting on you.</p>
    </>
  );
}
