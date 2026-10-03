import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { call, getUser } from '../../api';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { control, Field, Input } from '../../ui/Field';
import { Ic, Select } from '../../ui/bits';
import { Money } from '../../ui/Money';
import { PageHeader } from '../../ui/PageHeader';
import { Section } from '../../ui/Section';
import { StatusChip } from '../../ui/StatusChip';
import { facts, stageLabel, stageTone, toIso, useHistory, when, type EventRow, type Found, type Created, type Twin } from './data';
import { Back, ErrorNote, Sheet, StageActions, StageRail } from './parts';

export function Detail({ ev, twin, onBack }: { ev: EventRow; twin: Twin; onBack: () => void }) {
  const qc = useQueryClient();
  const history = useHistory(ev.id);
  const f = facts(history.data);
  const made = qc.getQueryData<Created>(['created', ev.id]); // the full setup, kept only for events created in this session: no read command returns it
  const category = String(ev.pkg?.meta?.category ?? '');
  const search = useQuery({ queryKey: ['search', getUser(), category], enabled: !!category, queryFn: () => call<Found[]>('suppliers', 'search', category) });
  const [answering, setAnswering] = useState<string>();
  const sealed = ev.status === 'draft' || ev.status === 'open';
  const closes = f.closesAt ?? made?.closesAt;
  const invitedIds = f.created?.invited ?? made?.invited ?? ev.invited.map(s => s.id);
  const criteria = f.created?.criteria ?? made?.criteria;
  const techWeight = f.created?.techWeight ?? made?.techWeight;
  const name = (id: string) => ev.invited.find(s => s.id === id)?.label ?? twin.nodes.find(n => n.id === id)?.label ?? search.data?.find(s => s.id === id)?.name ?? id;

  return (
    <>
      <Back onClick={onBack}>All events</Back>
      <PageHeader
        eyebrow={ev.pkg ? `Package ${ev.pkg.id}, ${ev.pkg.meta?.category ?? ''}` : 'Sample data'}
        title={ev.title}
        chip={<>
          <StatusChip tone={stageTone(ev.status)}>{stageLabel(ev.status)}</StatusChip>
          <StatusChip>{ev.type}</StatusChip>
          <span className="font-code self-center text-label soft">{ev.id}</span>
        </>}
        figures={[
          { label: 'Package estimate', big: true, value: ev.pkg?.value !== undefined ? <Money value={ev.pkg.value} big /> : '-' },
          { label: 'Bids received', value: ev.bids ?? <span className="inline-flex items-center gap-2 text-section"><Ic n="lock" className="size-5 text-(--gold)" />Sealed</span> },
          { label: 'Invited', value: invitedIds.length || '-' },
          { label: 'Closes', value: closes ? <>{closes.slice(0, 10)}<span className="soft text-label"> {closes.slice(11, 16)} UTC</span></> : <span className="soft text-section">{ev.status === 'draft' ? 'On publish' : 'Not shown'}</span> },
        ]}
        action={<StageActions ev={ev} onExtend={() => setAnswering('')} sticky />}
      />
      <StageRail status={ev.status} />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[3fr_2fr]">
        <Card i={1}>
          <h2 className="text-section font-semibold">Invited suppliers</h2>
          <p className="soft">Eligibility is the engine's check for this category today.</p>
          {search.error && <p className="soft mt-2">Eligibility check unavailable: {(search.error as Error).message}</p>}
          {!invitedIds.length && <p className="soft mt-3">Invitations are visible to your role once the event is published.</p>}
          <ul className="mt-2 divide-y divide-(--hair)">
            {invitedIds.map(id => {
              const s = search.data?.find(x => x.id === id);
              return (
                <li key={id} className="grid gap-1.5 py-3">
                  <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{name(id)}</span>
                    {s && <StatusChip tone={s.eligible ? (s.warnings.length ? 'warning' : 'success') : 'danger'}>{s.eligible ? (s.warnings.length ? 'Eligible, with warning' : 'Eligible') : 'Blocked'}</StatusChip>}</span>
                  <span className="soft flex flex-wrap gap-x-4"><span className="font-code text-label">{id}</span>{s && <span>{s.risk} risk</span>}{s && <span>performance {s.performance}</span>}</span>
                  {s?.blockers.map(b => <span key={b} className="font-medium text-(--bad)">{b}</span>)}
                  {s?.warnings.map(w => <span key={w} className="text-(--warn)">{w}</span>)}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card i={2}>
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-section font-semibold">Clarifications</h2><p className="soft">Answers go to every invited bidder. Askers stay sealed.</p></div>
            <Button variant="secondary" onClick={() => setAnswering('')}>Answer</Button></div>
          {history.error && <p className="soft mt-3">The question list needs audit access: {(history.error as Error).message}. You can still answer by reference.</p>}
          {!history.error && !f.clarifications.length && <p className="soft mt-3">No bidder has asked a question.</p>}
          <ul className="mt-2 divide-y divide-(--hair)">
            {f.clarifications.map(c => (
              <li key={c.id} className="grid gap-1.5 py-3">
                <span className="flex items-center justify-between gap-2"><span className="font-code text-label">{c.id}</span>
                  {c.answered ? <StatusChip tone="success">{c.extendTo ? 'Answered, deadline extended' : 'Answered'}</StatusChip> : <Button variant="text" onClick={() => setAnswering(c.id)}>Answer</Button>}</span>
                <span>{c.question}</span>
                {c.extendTo && <span className="soft">New closing time {when(c.extendTo)}</span>}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card i={3} className="grid gap-2">
        <Section title="Bid seals" meta={sealed ? 'Sealed' : `${f.seals.length || ev.bids || 0} on record`} defaultOpen={!sealed}>
          {sealed
            ? <p className="soft flex items-center gap-3"><Ic n="lock" className="size-5 text-(--gold)" />Bids are sealed until the event closes. Neither the count, the bidders nor the prices are shown, and the audit trail holds a fingerprint of each bid, never its prices.</p>
            : f.seals.length
              ? <ul className="divide-y divide-(--hair)">{f.seals.map(s => <li key={s.seal} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5"><Ic n="lock" className="size-4 text-(--gold)" /><span>Sealed bid, version {s.version}</span><span className="soft">{when(s.at)}</span><span className="font-code text-label md:ml-auto">seal {s.seal.slice(0, 16)}</span></li>)}</ul>
              : <p className="soft">{ev.bids ?? 0} sealed bids received. Seal fingerprints need audit access.</p>}
        </Section>
        <div className="gold-rule" />
        <Section title="Evaluation set-up" meta={criteria ? `${criteria.length} criteria` : 'Not exposed to your role'}>
          {criteria ? (
            <div className="grid gap-4">
              <ul className="grid gap-2.5">
                {criteria.map(c => (
                  <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
                    <span><span className="font-code mr-2 text-label">{c.id}</span>{c.name}</span>
                    <span className="numeral text-section">{c.gate ? 'Gate' : `${c.weight}%`}</span>
                    {!c.gate && <span aria-hidden className="col-span-2 h-1 rounded-full bg-(--hair)"><i className="block h-full rounded-full bg-(--series)" style={{ width: `${c.weight}%` }} /></span>}
                  </li>
                ))}
              </ul>
              <p className="soft">{techWeight !== undefined && <>Technical weight {Math.round(techWeight * 100)}%, commercial {Math.round((1 - techWeight) * 100)}%. </>}{made && <>Threshold {made.techThreshold}, quorum {made.quorum}, {made.blind ? 'blind' : 'named'} evaluation, {made.evaluators.length} evaluators, {made.lots.length} lots, {made.boq.length} BOQ lines.</>}</p>
            </div>
          ) : <p className="soft">No read command returns the set-up to this role. Managers and auditors see it from the audit trail.</p>}
        </Section>
        <div className="gold-rule" />
        <Section title="Audit trail" meta={history.data ? `${history.data.length - (sealed ? f.seals.length : 0)} entries` : undefined}>
          {history.error ? <p className="soft">{(history.error as Error).message}</p> : (
            <ol className="divide-y divide-(--hair)">{(history.data ?? []).filter(h => !(sealed && h.action === 'bid.submitted')).map(h => <li key={h.seq} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5"><span className="font-code text-label">#{h.seq}</span><span className="font-medium">{h.action}</span><span className="soft">{when(h.at)}</span><span className="font-code text-label md:ml-auto">{h.hash.slice(0, 12)}</span></li>)}</ol>
          )}
        </Section>
      </Card>

      <Answer ev={ev} open={answering !== undefined} preset={answering ?? ''} open_={f.clarifications.filter(c => !c.answered).map(c => c.id)} onClose={() => setAnswering(undefined)} />
    </>
  );
}

/** Buyer answer, with an optional new closing time (issued as an addendum). Engine errors stay in the dialog. */
function Answer({ ev, open, preset, open_, onClose }: { ev: EventRow; open: boolean; preset: string; open_: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [id, setId] = useState(''), [text, setText] = useState(''), [ext, setExt] = useState('');
  const chosen = id || preset || open_[0] || '';
  const m = useMutation({
    mutationFn: () => call('sourcing', 'answer', ev.id, chosen, text, ext ? toIso(ext) : undefined),
    onSuccess: () => { qc.invalidateQueries(); setText(''); setExt(''); setId(''); onClose(); },
  });
  return (
    <Sheet title="Answer a clarification" open={open} onClose={() => { m.reset(); onClose(); }}>
      <form id="answer-form" className="grid gap-4" onSubmit={e => { e.preventDefault(); m.mutate(); }}>
        {open_.length
          ? <Select label="Question" value={chosen} onChange={setId} options={open_.map(c => [c, c])} />
          : <Field label="Clarification reference" hint="For example CL-0001. Your role cannot list the questions."><Input required value={chosen} onChange={e => setId(e.target.value)} placeholder="CL-0001" className="font-code" /></Field>}
        <Field label="Answer"><textarea required rows={3} value={text} onChange={e => setText(e.target.value)} className={control} /></Field>
        <Field label="New closing time (optional, UTC)" hint="Issues an addendum to every invited bidder."><Input type="datetime-local" value={ext} onChange={e => setExt(e.target.value)} /></Field>
        {m.error && <ErrorNote>{(m.error as Error).message}</ErrorNote>}
        <div className="flex justify-end gap-3"><Button variant="text" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={m.isPending} onClick={() => (document.getElementById('answer-form') as HTMLFormElement).requestSubmit()}>Send answer</Button></div>
      </form>
    </Sheet>
  );
}
