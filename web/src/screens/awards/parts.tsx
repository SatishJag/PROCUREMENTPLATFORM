import type { CSSProperties, ReactNode } from 'react';
import { Money } from '../../ui/Money';
import { StatusChip } from '../../ui/StatusChip';
import { Ic } from '../../ui/bits';
import { holder, stamp, who, words, type Results, type Row, type Step } from './data';
import type { Allocation } from '@satishjag/procurement-core/types';

// Semantic series tokens from the surface context (app.css), so any theme and either surface recolours them.
const tones = ['var(--series)', 'var(--gold)', 'var(--neutral)', 'var(--soft)'];

/** One segment per supplier, width by the engine's allocation value. Colour plus a legend with names and values, never colour alone. */
export function Split({ allocs, name, lots }: { allocs: Allocation[]; name: (id: string) => string; lots?: boolean }) {
  const total = allocs.reduce((s, a) => s + a.value, 0) || 1;
  const tone = tones;
  return (
    <div className="grid gap-3">
      <div role="img" aria-label={allocs.map(a => `${name(a.supplierId)} ${Math.round((a.value / total) * 100)} percent`).join(', ')} className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        {allocs.map((a, i) => <div key={a.supplierId} className="grow-x h-full origin-left" style={{ width: `${(a.value / total) * 100}%`, background: tone[i % 4] }} />)}
      </div>
      <ul className="grid gap-1.5">
        {allocs.map((a, i) => (
          <li key={a.supplierId} className="flex items-baseline gap-2">
            <span aria-hidden className="size-2.5 shrink-0 translate-y-px rounded-full" style={{ background: tone[i % 4] }} />
            <span className="min-w-0 flex-1 font-medium">{name(a.supplierId)}</span>
            {lots && <span className="soft font-code text-label">{a.lotIds.join(' ')}</span>}
            <span className="soft numeral !font-normal">{Math.round((a.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const state = (s: Step, current: boolean) => (s.decision === 'approved' ? 'done' : s.decision === 'rejected' ? 'rejected' : current ? 'current' : 'waiting');

/** The approval route as a stepper: role, who decided, decision, comment, time, and the engine's reason for the step when known. */
export function Route({ steps, pending }: { steps: Step[]; pending: boolean }) {
  const at = pending ? steps.findIndex(s => !s.decision) : -1;
  return (
    <ol aria-label="Approval route" className="grid gap-6 md:grid-cols-[repeat(var(--n),minmax(0,1fr))] md:gap-4" style={{ '--n': steps.length } as CSSProperties}>
      {steps.map((s, i) => {
        const k = state(s, i === at);
        return (
          <li key={s.role} aria-current={k === 'current' ? 'step' : undefined} className="relative grid grid-cols-[2.75rem_minmax(0,1fr)] content-start gap-x-3 md:grid-cols-1 md:gap-y-3">
            {i < steps.length - 1 && <span aria-hidden className={`absolute left-[1.375rem] top-11 -bottom-6 w-px md:bottom-auto md:left-14 md:right-[-1rem] md:top-[1.375rem] md:h-px md:w-auto ${k === 'done' ? 'bg-(--gold)' : 'border-l border-dashed border-(--soft) md:border-l-0 md:border-t'}`} />}
            <span className="relative grid size-11 place-items-center">
              {k === 'current' && <span aria-hidden className="absolute inset-0 animate-ping rounded-full border border-(--btn-bg) opacity-40" />}
              <span className={`relative grid size-11 place-items-center rounded-full border text-section font-medium ${k === 'done' ? 'border-(--gold) bg-(--gold) text-(--btn-fg)' : k === 'rejected' ? 'border-(--bad) bg-(--bad) text-(--btn-fg)' : k === 'current' ? 'border-(--btn-bg) bg-(--btn-bg)/15 text-(--btn-bg) ring-4 ring-(--btn-bg)/15' : 'border-dashed border-(--soft) text-(--soft)'}`}>
                {k === 'done' ? <Ic n="check" className="size-5" /> : k === 'rejected' ? <Ic n="err" className="size-5" /> : i + 1}
              </span>
            </span>
            <div className="grid min-w-0 content-start gap-1.5">
              <p className="eyebrow">Step {i + 1}{k === 'current' ? ', now' : ''}</p>
              <p className="text-section font-semibold">{words(s.role)}</p>
              {s.decision ? (
                <>
                  <p className="font-medium">{words(s.decision)} by {who(s.by)}</p>
                  <p className="soft numeral !font-normal">{s.at && stamp(s.at)}</p>
                  {s.comment && <p className="soft">&ldquo;{s.comment}&rdquo;</p>}
                </>
              ) : <p className="soft">{k === 'current' ? `Waiting on ${holder(s.role) ?? words(s.role)}` : 'Waits for the step before'}</p>}
              {s.reason && <p className="soft border-l border-(--gold) pl-3">{s.reason}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Who is next and whether it is me. The refusal text is the engine's own, shown whole. */
export function Banner({ icon, title, children, tone }: { icon: 'clock' | 'check' | 'err' | 'lock'; title: ReactNode; children?: ReactNode; tone: 'success' | 'warning' | 'danger' | 'neutral' }) {
  return (
    <div className="glass flex items-start gap-4 p-4 md:p-5" role="status">
      <span className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-full tone-${tone} chip !p-0`}><Ic n={icon} className="size-5" /></span>
      <div className="grid min-w-0 gap-1">
        <p className="text-section font-semibold">{title}</p>
        {children && <div className="soft">{children}</div>}
      </div>
    </div>
  );
}

/** The controls the engine enforces on this award, with their live state. Rule text is static; names and counts come from the trail. */
export function Controls({ recommender, decided, pending, next }: { recommender?: string; decided: string[]; pending: boolean; next?: string }) {
  const rows: [string, string, ReactNode][] = [
    ['Sequence', 'Approvers act in order; a later role cannot act early.', pending ? (next ? `Now: ${words(next)}` : 'Now: the next open step') : 'Complete'],
    ['Segregation of duties', 'The recommender, the requester, evaluators and anyone who has already decided cannot approve.', recommender ? `Recommended by ${who(recommender)}${decided.length ? `. Decided: ${decided.map(who).join(', ')}` : ''}` : 'Names are in the audit trail, which your role cannot read'],
    ['Authority limit', 'The final approver needs an approval limit that covers the award value.', 'Checked by the engine on the last step'],
    ['Reasons', 'A rejection needs a written reason. It is recorded with the name of the person.', 'Asked before the engine is called'],
  ];
  return (
    <ul className="divide-y divide-(--hair)">
      {rows.map(([t, rule, live]) => (
        <li key={t} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 py-3 first:pt-0 last:pb-0">
          <Ic n="lock" className="mt-0.5 size-4 text-(--gold)" />
          <p className="font-medium">{t}</p>
          <span />
          <p className="soft">{rule}</p>
          <span />
          <p className="font-medium text-(--fg)">{live}</p>
        </li>
      ))}
    </ul>
  );
}

/** Audit chain rows for this award: sequence, action, actor, time, short hash and the hash it links to. */
export function Trail({ rows }: { rows: Row[] }) {
  return (
    <ol className="grid gap-0 divide-y divide-(--hair)">
      {rows.map(r => (
        <li key={r.seq} className="grid gap-x-4 gap-y-1 py-3 md:grid-cols-[3.5rem_minmax(0,1fr)_auto] md:items-baseline">
          <span className="font-code text-label text-(--soft)">#{r.seq}</span>
          <span className="min-w-0"><span className="font-medium">{words(r.action.replace('.', ': '))}</span> <span className="soft">by {who(r.actor)}, {stamp(r.at)}</span></span>
          <span className="soft font-code text-label">{r.hash.slice(0, 8)} <span aria-hidden>&larr;</span><span className="sr-only">links to</span> {r.prev.slice(0, 8)}</span>
        </li>
      ))}
    </ol>
  );
}

/** Supplier lines of the engine's ranking and normalisation for the zoomed allocation card. */
export function Evidence({ r, name, picked }: { r: Results; name: (id: string) => string; picked: Allocation[] }) {
  return (
    <div className="grid gap-5">
      {r.ranking.map(x => {
        const n = r.normalized.find(y => y.supplierId === x.supplierId)!, pick = picked.find(a => a.supplierId === x.supplierId);
        return (
          <section key={x.supplierId} aria-label={name(x.supplierId)} className="grid gap-2 border-b border-(--hair) pb-5 last:border-0 last:pb-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-section font-semibold">{name(x.supplierId)}</h3>
              {pick && <StatusChip tone="success">Awarded {pick.lotIds.join(', ')}</StatusChip>}
              <Money value={n.total} className="numeral ml-auto text-section" />
            </div>
            <p className="soft numeral !font-normal">Technical {x.technical}, commercial {x.commercial}, combined {x.combined}. Submitted in {n.currency}.{pick && <> Awarded <Money value={pick.value} /> of the bid total.</>}</p>
            {[...n.adjustments.map(t => [t, false] as const), ...n.anomalies.map(t => [t, true] as const)].map(([t, bad]) => (
              <p key={t} className="flex gap-2"><Ic n={bad ? 'warn' : 'file'} className={`mt-0.5 size-4 ${bad ? 'text-(--warn)' : 'text-(--soft)'}`} /><span>{t}</span></p>
            ))}
          </section>
        );
      })}
    </div>
  );
}
