import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { call, getUser } from '../../api';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Tabs } from '../../ui/bits';
import { Money, Num } from '../../ui/Money';
import { PageHeader } from '../../ui/PageHeader';
import { StatusChip, type Tone } from '../../ui/StatusChip';
import type { Ctx } from './Bidder';
import { short, weighting, type Pack, type Results, type TwinNode } from './lib';
import { DarkSelect, Envelope, LinkBtn, Reason } from './parts';
import { Technical, useScoring } from './Technical';
import { RecommendDialog, WarRoom } from './WarRoom';

const STATUS: Record<string, [string, Tone]> = {
  closed: ['Bids closed', 'neutral'], technical: ['Technical scoring', 'warning'], commercial: ['Commercial open', 'success'], approval: ['Award in approval', 'success'], awarded: ['Awarded', 'success'],
};
const KEY = 'evaluation.event';

export function Evaluation() {
  const twin = useQuery({ queryKey: ['twin', getUser()], queryFn: () => call<{ nodes: TwinNode[] }>('reporting', 'twin') });
  if (twin.isPending) return <div aria-busy className="h-96 animate-pulse rounded-hero bg-white/5" />;
  return <Body key={getUser()} nodes={twin.data?.nodes ?? []} twinError={(twin.error as Error | null)?.message} />;
}

function Body({ nodes, twinError }: { nodes: TwinNode[]; twinError?: string }) {
  const user = getUser();
  const events = nodes.filter(n => n.kind === 'event');
  const [picked, setPicked] = useState(localStorage.getItem(KEY) ?? '');
  const id = picked || (events.find(e => ['technical', 'commercial', 'approval'].includes(e.status ?? '')) ?? events[0])?.id || '';
  const node = events.find(e => e.id === id);
  const names = (sid: string) => nodes.find(n => n.id === sid && n.kind === 'supplier')?.label ?? sid;

  const pack = useQuery({ queryKey: ['pack', user, id], enabled: !!id, queryFn: () => call<Pack>('evaluation', 'technicalPack', id) });
  const res = useQuery({ queryKey: ['results', user, id], enabled: !!id, queryFn: () => call<Results>('evaluation', 'results', id) });
  const acts = useQuery({ queryKey: ['actions', user, 'sourcing', id], enabled: !!id, queryFn: () => call<string[]>('sourcing', 'actions', id) });
  const s = useScoring(id);
  const [tab, setTab] = useState<'technical' | 'commercial' | null>(null);
  const [scn, setScn] = useState('best_value');
  const [dlg, setDlg] = useState(false);
  const [done, setDone] = useState('');

  const pick = (v: string) => { localStorage.setItem(KEY, v); setPicked(v); setTab(null); };
  const [typed, setTyped] = useState(picked);

  const picker = (events.length > 1 || twinError) && (
    <div className="glass flex flex-wrap items-end gap-3 p-3">
      {events.length > 1 && <div className="min-w-0 flex-1 md:max-w-xl"><DarkSelect label="Sourcing event" value={id} onChange={pick} options={events.map(e => [e.id, `${e.id}, ${e.label} (${STATUS[e.status ?? '']?.[0] ?? e.status})`])} /></div>}
      {twinError && (
        <form className="flex min-w-0 flex-1 flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); if (typed.trim()) pick(typed.trim()); }}>
          <label className="grid min-w-0 flex-1 gap-1.5 md:max-w-sm"><span className="eyebrow">Event reference</span>
            <input value={typed} onChange={e => setTyped(e.target.value)} placeholder="EV-0003" className="h-11 w-full rounded-ctl border border-white/30 bg-night-deep px-3 font-code text-on-night [color-scheme:dark] placeholder:text-on-night-soft hover:border-gold md:h-10" /></label>
          <Button variant="secondary" onClick={() => typed.trim() && pick(typed.trim())}>Open event</Button>
          <p className="soft basis-full">Your role cannot list events: {twinError}</p>
        </form>
      )}
    </div>
  );

  if (!id) return <>{picker}<Card glass><h1 className="text-section font-semibold">Evaluation</h1><p className="soft mt-1">Enter the reference of the event you evaluate to begin.</p></Card></>;
  if (pack.isPending || res.isPending || acts.isPending) return <>{picker}<div aria-busy className="h-96 animate-pulse rounded-hero bg-white/5" /></>;

  const r = res.data, packErr = (pack.error as Error | null)?.message, locked = (res.error as Error | null)?.message;
  const active = tab ?? (r ? 'commercial' : 'technical');
  const actions = acts.data ?? [];
  const sign = actions.includes('complete_technical'), recommend = actions.includes('recommend');
  const status = node?.status ?? (r ? 'commercial' : pack.data ? 'technical' : '');
  const [stLabel, stTone] = STATUS[status] ?? ['Evaluation', 'neutral' as Tone];
  const c: Ctx | undefined = r && { r, eventId: id, pack: pack.data, names };
  const best = r?.scenarios.find(x => x.id === 'best_value') ?? r?.scenarios[0];
  const w = r && weighting(r.ranking);

  const figures = active === 'commercial' && r
    ? [
      { label: best ? 'Best-value award' : 'Lowest normalised bid', big: true, value: <Money value={best?.value ?? Math.min(...r.normalized.map(n => n.total))} animate big /> },
      { label: 'Qualified', value: <>{r.ranking.length}<span className="soft text-body"> of {r.normalized.length} bids</span></> },
      ...(w !== undefined ? [{ label: 'Technical / commercial', value: `${w} / ${100 - w}` }] : []),
      ...(r.ranking[0] ? [{ label: 'Leading bid', value: <span className="text-[1.25rem]">{short(names(r.ranking[0].supplierId))}</span> }] : []),
    ]
    : [
      { label: 'Sealed bids', big: true, value: <Num value={pack.data?.bidders.length ?? Number(node?.meta?.bids ?? 0)} animate /> },
      ...(pack.data ? [{ label: 'Criteria', value: pack.data.criteria.length }, { label: 'Gates', value: pack.data.criteria.filter(x => x.gate).length }] : []),
    ];

  const action = active === 'technical'
    ? (
      <div className="bar-sticky flex flex-wrap items-center justify-end gap-3">
        {s.dirty === 0 && !sign && pack.data && <p className="soft min-w-0 flex-1 max-md:basis-full">Enter a score to save it.</p>}
        {!pack.data && <p className="soft min-w-0 flex-1 max-md:basis-full">Nothing for you to do until the envelope opens to you.</p>}
        {pack.data && (!sign || s.dirty > 0) && <Button variant={sign ? 'secondary' : 'primary'} loading={s.saving} disabled={s.dirty === 0} onClick={() => s.save(pack.data!)} className={!sign ? 'max-md:flex-1' : ''}>Save scores</Button>}
        {pack.data && sign && <Button variant="primary" loading={s.signing} onClick={s.signOff} className="max-md:flex-1">Sign off technical</Button>}
      </div>
    )
    : (
      <div className="bar-sticky flex flex-wrap items-center justify-end gap-3">
        {!recommend && <p className="soft min-w-0 flex-1 max-md:basis-full">{r ? 'Nothing for you to do on this event.' : locked}</p>}
        {!recommend && r && <LinkBtn href="#/awards">Open awards</LinkBtn>}
        {recommend && r && <Button variant="primary" onClick={() => setDlg(true)} className="max-md:flex-1">Recommend award</Button>}
      </div>
    );

  return (
    <>
      {picker}
      <PageHeader
        eyebrow="Evaluation, sample data"
        title={node?.label ?? `Event ${id}`}
        chip={<>
          <StatusChip tone={stTone}>{stLabel}</StatusChip>
          <StatusChip tone="neutral">{id}</StatusChip>
          {active === 'technical' ? <StatusChip tone="neutral">Blind: bidder names sealed</StatusChip> : r ? <StatusChip tone="success">Technical signed off, envelope open</StatusChip> : <StatusChip tone="danger">Commercial envelope sealed</StatusChip>}
        </>}
        figures={figures}
        action={action}
      />
      {done && <Card glass i={0} role="status" className="flex flex-wrap items-center gap-3 !border-gold/50"><StatusChip tone="success">Recommended</StatusChip><span>Award <span className="font-code">{done}</span> is routed to its approvers.</span><LinkBtn href="#/awards">Open awards</LinkBtn></Card>}

      <Tabs label="Evaluation envelope" value={active} onChange={setTab} tabs={[['technical', 'Technical'], ['commercial', r ? 'Commercial' : 'Commercial, sealed']]} />
      <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${active}`} className="grid gap-6">
        {active === 'technical' && <Technical chair={sign} id={id} pack={pack.data} packError={packErr} s={s} results={r} names={names} />}
        {active === 'commercial' && c && <WarRoom c={c} scn={scn} onPick={setScn} canPick={recommend} />}
        {active === 'commercial' && !c && (
          <Card glass i={1} className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
            <Envelope className="w-44 justify-self-center" />
            <div className="grid gap-2"><p className="eyebrow !text-(--gold)">Sealed envelope</p><h2 className="text-section font-semibold">Prices stay sealed until technical sign-off</h2><Reason>{locked}</Reason><p className="soft">Blind aliases and the conflict-of-interest declarations hold until then. Nobody sees a price early.</p></div>
          </Card>
        )}
      </div>
      {r && <RecommendDialog open={dlg} onClose={() => setDlg(false)} eventId={id} scenarios={r.scenarios} scn={scn} onDone={a => { setDlg(false); setDone(a); }} />}
    </>
  );
}
