import type { Award } from '@satishjag/procurement-core/types';
import { call } from '../../api';
import { ActionBar } from '../../ui/ActionBar';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { FocusCard } from '../../ui/FocusCard';
import { Money } from '../../ui/Money';
import { PageHeader } from '../../ui/PageHeader';
import { Section } from '../../ui/Section';
import { StatusChip } from '../../ui/StatusChip';
import { Table } from '../../ui/Table';
import { Ic } from '../../ui/bits';
import { holder, known, linked, stamp, stepsOf, useHistory, useResults, useTurn, useTwin, who, words, type Scenario } from './data';
import { Banner, Controls, Evidence, Route, Split, Trail } from './parts';

const labels = { approved: 'Approve award', rejected: 'Reject award' };

export function Detail({ id, onBack, onRecommend }: { id: string; onBack: () => void; onRecommend: (eventId: string) => void }) {
  const twin = useTwin(), hist = useHistory(id);
  const node = twin.data?.nodes.find(n => n.id === id);
  const event = twin.data && linked(twin.data, 'event-award', undefined, id)[0];
  const pkg = twin.data && event && linked(twin.data, 'package-event', undefined, event.id)[0];
  const contracts = (twin.data && linked(twin.data, 'award-contract', id)) ?? [];
  const results = useResults(event?.id);
  const rows = hist.data;
  const rec = rows?.find(r => r.action === 'award.recommended');
  const full = known.get(id);
  const scenario: Scenario | undefined = results.data?.scenarios.find(s => s.id === (rec?.data.scenario ?? full?.scenario ?? node?.label.replace('Award ', '')));
  const steps = stepsOf(rows, full);
  const status = node?.status ?? full?.status ?? 'pending';
  const pending = status === 'pending';
  const turn = useTurn(id, pending, `${rows?.length}`);
  const name = (sid: string) => twin.data?.nodes.find(n => n.id === sid)?.label ?? sid;
  const value = node?.value ?? scenario?.value ?? full?.value;
  const allocs = full?.allocations ?? scenario?.allocations ?? [];
  const next = steps?.find(s => !s.decision);
  const decided = steps?.filter(s => s.by).map(s => s.by!) ?? [];
  const last = steps?.at(-1);
  const rejected = steps?.find(s => s.decision === 'rejected');

  if (twin.error) return <Card glass className="text-(--bad)" role="alert">{(twin.error as Error).message}</Card>;
  if (!node) return <div aria-busy className="h-96 animate-pulse rounded-hero bg-white/5" />;

  const run = async (a: string, reason: string) => { const aw = await call<Award>('awards', 'decide', id, a, reason); known.set(id, aw); return aw; };

  return (
    <>
      <div className="-mb-4"><Button variant="text" onClick={onBack} className="!-ml-2">&larr; All awards</Button></div>
      <PageHeader
        eyebrow={pkg ? `${pkg.label}, sample data` : 'Award, sample data'}
        title={`Award ${id}`}
        chip={<>
          <StatusChip tone={status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning'}>{status === 'pending' ? 'Pending approval' : words(status)}</StatusChip>
          {scenario && <StatusChip>{scenario.label}</StatusChip>}
          {scenario?.deviation && <StatusChip tone="warning">Deviates from best value</StatusChip>}
        </>}
        figures={[
          { label: 'Award value', big: true, value: value === undefined ? <span className="soft text-section">Not shown to your role until approved</span> : <Money value={value} big animate /> },
          { label: 'Suppliers', value: allocs.length || '-' },
          ...(steps ? [{ label: 'Steps decided', value: `${steps.filter(s => s.decision).length} of ${steps.length}` }] : []),
        ]}
        action={<ActionBar module="awards" id={id} labels={labels} run={run} sticky />}
        visual={allocs.length > 0 && <div className="glass p-5"><p className="eyebrow mb-3">Allocation</p><Split dark allocs={allocs} name={name} /></div>}
      />

      {status === 'approved' && <Banner tone="success" icon="check" title={`Approved${last?.at ? `, ${stamp(last.at)}` : ''}`}>{last?.by ? `Final approval by ${who(last.by)}. ` : ''}{contracts.length} contract draft{contracts.length === 1 ? '' : 's'} created from this award.</Banner>}
      {status === 'rejected' && (
        <Banner tone="danger" icon="err" title={`Rejected${rejected?.by ? ` by ${who(rejected.by)}` : ''}`}>
          {rejected?.comment && <p>&ldquo;{rejected.comment}&rdquo;</p>}
          {event?.status === 'commercial' && <p className="pt-1">The event is back in commercial evaluation. <button type="button" onClick={() => onRecommend(event.id)} className="font-medium underline underline-offset-4 hover:text-(--fg)">Recommend again</button></p>}
        </Banner>
      )}
      {pending && turn.data && (turn.data.mine
        ? <Banner tone="success" icon="check" title="It is your turn">{next ? `You are the ${words(next.role)} on this route. ` : ''}Approve or reject with the buttons above. A rejection asks for a reason first.</Banner>
        : <Banner tone="neutral" icon="lock" title={next ? `Waiting on ${holder(next.role) ?? words(next.role)}, ${words(next.role)}` : 'Waiting on another approver'}>
          <p><span className="font-medium text-(--fg)">You are not the current approver.</span> The engine says: &ldquo;{turn.data.why}&rdquo;</p>
        </Banner>)}

      {steps ? (
        <Card glass i={1}>
          <h2 className="mb-5 text-section font-semibold">Approval route</h2>
          <Route steps={steps} pending={pending} />
          {steps.some(s => !s.reason) && <p className="soft mt-5 border-t border-(--hair) pt-4">The engine states why each step exists in the award record. This view has it after a recommendation or decision made here.</p>}
        </Card>
      ) : hist.error && (
        <Card glass i={1}><h2 className="text-section font-semibold">Approval route</h2><p className="soft mt-2">The route and decisions come from the audit trail. The engine says: &ldquo;{(hist.error as Error).message}&rdquo;</p></Card>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="grid gap-6">
          <FocusCard i={2} title="Allocation by supplier and lot" note="What the recommended scenario awards, and the evidence behind each bidder" detail={results.data ? <Evidence r={results.data} name={name} picked={allocs.map(a => a.supplierId)} /> : <p className="soft">Evidence needs the commercial results.</p>}>
            {allocs.length === 0 && <p className="soft">{results.error ? (results.error as Error).message : 'Loading the allocation.'}</p>}
            <div className="lg:hidden"><Split allocs={allocs} name={name} /></div>
            <ul className="divide-y divide-(--hair)">
              {allocs.map(a => (
                <li key={a.supplierId} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                  <span className="min-w-0 flex-1 font-medium max-sm:basis-full">{name(a.supplierId)}</span>
                  <span className="flex gap-1.5">{a.lotIds.map(l => <span key={l} className="rounded-full border border-(--hair) px-2 font-code text-label">{l}</span>)}</span>
                  <Money value={a.value} className="numeral text-section" />
                </li>
              ))}
            </ul>
          </FocusCard>
          {full?.justification && (
            <Card i={3}><h2 className="text-section font-semibold">Rationale</h2><p className="mt-2">{full.justification}</p><p className="soft mt-2">Written by {who(full.recommendedBy)}.</p></Card>
          )}
          {contracts.length > 0 && (
            <Card i={3}>
              <h2 className="text-section font-semibold">Contract drafts created</h2>
              <ul className="mt-3 divide-y divide-(--hair)">
                {contracts.map(c => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                    <Ic n="file" className="size-5 text-(--gold)" />
                    <span className="font-code text-label">{c.id}</span>
                    <span className="min-w-0 flex-1 font-medium">{twin.data && linked(twin.data, 'contract-supplier', c.id)[0]?.label}</span>
                    <StatusChip>{words(c.status ?? 'draft')}</StatusChip>
                    {c.value !== undefined && <Money value={c.value} className="numeral text-section" />}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <Card i={3}>
          <h2 className="mb-3 text-section font-semibold">Controls on this award</h2>
          <Controls recommender={rec?.actor ?? full?.recommendedBy} decided={decided} pending={pending} next={next?.role} />
        </Card>
      </div>

      {results.data && (
        <Card i={4}>
          <Section title="Scenarios considered" meta="From the commercial evaluation" defaultOpen={!!scenario?.deviation}>
            <Table caption="Award scenarios" rowKey={s => s.id} rows={results.data.scenarios} columns={[
              { key: 's', header: 'Scenario', cell: s => <span className={s.id === scenario?.id ? 'font-semibold' : ''}>{s.label}{s.id === scenario?.id && ' (chosen)'}</span> },
              { key: 'v', header: 'Value', align: 'right', cell: s => <Money value={s.value} /> },
              { key: 'd', header: 'Against best value', align: 'right', cell: s => { const d = Math.round((results.data!.scenarios[0].value - s.value) * 100) / 100; return d === 0 ? 'Reference' : <span className={d > 0 ? 'text-(--ok)' : 'text-(--bad)'}>{d > 0 ? 'Saves ' : 'Costs '}<Money value={Math.abs(d)} /></span>; } },
              { key: 'x', header: 'Flag', cell: s => s.deviation ? 'Deviates from best value' : 'Follows best value' },
            ]} />
          </Section>
        </Card>
      )}
      {rows && rows.length > 0 && (
        <Card i={5}>
          <Section title="Audit chain events" meta={`${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}, hash-linked`} defaultOpen={status !== 'pending'}><Trail rows={rows} /></Section>
        </Card>
      )}
    </>
  );
}
