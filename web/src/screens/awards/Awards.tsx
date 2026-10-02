import { useQueries } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { call, getUser } from '../../api';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Money, Num } from '../../ui/Money';
import { PageHeader } from '../../ui/PageHeader';
import { StatusChip } from '../../ui/StatusChip';
import { Detail } from './Detail';
import { Recommend } from './Recommend';
import { linked, stepsOf, useActions, useHistory, useResults, useTwin, words, type Node, type Twin } from './data';
import { Split } from './parts';

type View = { t: 'list' } | { t: 'award'; id: string } | { t: 'rec'; id: string };

/** Awards: the list of awards and events ready to recommend, then the detail and the recommend flow. Selection is local state because the router only knows top-level routes. */
export function Awards() {
  const [view, setView] = useState<View>({ t: 'list' });
  useEffect(() => window.scrollTo(0, 0), [view]);
  const list = () => setView({ t: 'list' });
  if (view.t === 'award') return <Detail id={view.id} onBack={list} onRecommend={id => setView({ t: 'rec', id })} />;
  if (view.t === 'rec') return <Recommend eventId={view.id} onBack={list} onDone={a => setView({ t: 'award', id: a.id })} />;
  return <List open={id => setView({ t: 'award', id })} recommend={id => setView({ t: 'rec', id })} />;
}

function List({ open, recommend }: { open: (id: string) => void; recommend: (id: string) => void }) {
  const twin = useTwin();
  const t = twin.data;
  const awards = t?.nodes.filter(n => n.kind === 'award') ?? [];
  const ready = t?.nodes.filter(n => n.kind === 'event' && n.status === 'commercial') ?? [];
  const mine = useQueries({ queries: awards.filter(a => a.status === 'pending').map(a => ({ queryKey: ['actions', getUser(), 'awards', a.id], queryFn: () => call<string[]>('awards', 'actions', a.id) })) });
  const canRec = useQueries({ queries: ready.map(e => ({ queryKey: ['actions', getUser(), 'sourcing', e.id], queryFn: () => call<string[]>('sourcing', 'actions', e.id) })) });
  if (twin.error) return <Card glass className="text-(--bad)" role="alert">{(twin.error as Error).message}</Card>;
  if (!t) return <div aria-busy className="h-96 animate-pulse rounded-hero bg-white/5" />;

  const pending = awards.filter(a => a.status === 'pending'), approved = awards.filter(a => a.status === 'approved');
  const sum = (xs: Node[]) => xs.reduce((s, a) => s + (a.value ?? 0), 0);
  const waiting = pending.find((_, i) => mine[i]?.data?.length);
  const recId = ready.find((_, i) => canRec[i]?.data?.includes('recommend'))?.id;
  const primary = waiting ? { label: 'Review award', go: () => open(waiting.id) } : recId ? { label: 'Recommend award', go: () => recommend(recId) } : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Project DC1, sample data"
        title="Awards"
        chip={<>
          <StatusChip tone={pending.length ? 'warning' : 'neutral'}>{pending.length} pending approval</StatusChip>
          <StatusChip tone="success">{approved.length} approved</StatusChip>
          {ready.length > 0 && <StatusChip>{ready.length} ready to recommend</StatusChip>}
          {waiting && <StatusChip tone="success">Waiting on you</StatusChip>}
        </>}
        figures={[
          { label: 'Value awaiting approval', big: true, value: <Money value={sum(pending)} big animate /> },
          { label: 'Approved value', value: <Money value={sum(approved)} /> },
          { label: 'Awards', value: <Num value={awards.length} /> },
        ]}
        action={primary
          ? <div className="bar-sticky"><Button variant="primary" onClick={primary.go} className="max-md:flex-1">{primary.label}</Button></div>
          : <p className="soft self-center">Nothing is waiting on you. Switch role in the top bar to see another queue.</p>}
      />

      {ready.length > 0 && (
        <section aria-label="Ready to recommend" className="grid gap-4">
          <h2 className="text-section font-semibold">Ready to recommend</h2>
          <ul className="grid gap-6 lg:grid-cols-2">
            {ready.map((e, i) => (
              <Card as="li" key={e.id} i={i + 1} className="grid content-start gap-3">
                <p className="eyebrow flex items-center gap-2"><span className="font-code normal-case tracking-normal text-(--fg)">{e.id}</span><StatusChip tone="warning">Commercial evaluation</StatusChip></p>
                <p className="text-section font-semibold">{e.label}</p>
                <p className="soft">{e.meta?.bids !== undefined ? `${e.meta.bids} bids received. ` : ''}The commercial envelope is open and the engine has scenarios to compare.</p>
                {canRec[i]?.data?.includes('recommend')
                  ? <div><Button variant="secondary" onClick={() => recommend(e.id)}>Compare scenarios</Button></div>
                  : <p className="soft">Your role cannot recommend this award.</p>}
              </Card>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Awards" className="grid gap-4">
        <h2 className="text-section font-semibold">All awards</h2>
        {awards.length === 0 && <Card glass><p className="soft">No award has been recommended yet.</p></Card>}
        <ul className="grid gap-6 lg:grid-cols-2">
          {awards.map((a, i) => <AwardCard key={a.id} a={a} t={t} i={i + 2} open={() => open(a.id)} />)}
        </ul>
      </section>
    </>
  );
}

function AwardCard({ a, t, i, open }: { a: Node; t: Twin; i: number; open: () => void }) {
  const event = linked(t, 'event-award', undefined, a.id)[0];
  const pkg = event && linked(t, 'package-event', undefined, event.id)[0];
  const results = useResults(event?.id), hist = useHistory(a.id), mine = useActions(a.id);
  const sid = hist.data?.find(r => r.action === 'award.recommended')?.data.scenario ?? a.label.replace('Award ', '');
  const scenario = results.data?.scenarios.find(s => s.id === sid);
  const steps = stepsOf(hist.data);
  const name = (id: string) => t.nodes.find(n => n.id === id)?.label ?? id;
  const value = a.value ?? scenario?.value;
  return (
    <Card as="li" i={i} lift className="relative grid content-start gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-code text-label">{a.id}</span>
        <StatusChip tone={a.status === 'approved' ? 'success' : a.status === 'rejected' ? 'danger' : 'warning'}>{a.status === 'pending' ? 'Pending approval' : words(a.status ?? '')}</StatusChip>
        {a.status === 'pending' && mine.data?.length ? <StatusChip tone="success">Waiting on you</StatusChip> : null}
      </div>
      <div className="grid gap-1">
        <h3 className="text-section font-semibold">{scenario?.label ?? words(sid)}</h3>
        <p className="soft">{pkg?.label}</p>
      </div>
      {value === undefined ? <p className="soft">Value is shown to your role once approved.</p> : <Money value={value} className="numeral text-[2.25rem] leading-none" />}
      {scenario && <Split allocs={scenario.allocations} name={name} />}
      {steps && (
        <ol aria-label="Approval route" className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {steps.map((s, k) => (
            <li key={s.role} className="flex items-center gap-2">
              {k > 0 && <span aria-hidden className="h-px w-5 bg-(--gold) opacity-60" />}
              <span className={`soft flex items-center gap-1.5 ${s.decision === 'approved' ? '!text-(--ok)' : s.decision === 'rejected' ? '!text-(--bad)' : ''}`}>
                <span aria-hidden className={`size-2.5 rounded-full border ${s.decision ? 'border-transparent bg-current' : 'border-current'}`} />
                {words(s.role)}{s.decision && <span className="sr-only"> {s.decision}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      <div>
        <Button variant="secondary" onClick={open} className="!static after:absolute after:inset-0 after:rounded-[inherit]">{mine.data?.length ? 'Review award' : 'Open award'}</Button>
      </div>
    </Card>
  );
}
