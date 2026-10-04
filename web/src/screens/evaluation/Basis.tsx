import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { call, getUser } from '../../api';
import { Ic } from '../../ui/bits';
import { n2 } from './lib';
import { Reason } from './parts';

// Shape of evaluation.scoreBasis (core modules/evaluation.ts): the written basis behind each criterion score.
export type Basis = { id: string; name: string; weight: number; gate: boolean; marks: { evaluator: string; score: number; comment?: string }[]; moderation?: { score: number; note: string } }[];

export const useBasis = (eventId: string, ref: string) =>
  useQuery({ queryKey: ['basis', getUser(), eventId, ref], retry: false, queryFn: () => call<Basis>('evaluation', 'scoreBasis', eventId, ref) });

const show = (b: Basis[number], v: number) => (b.gate ? (v ? 'Pass' : 'Fail') : n2(v));

function Why({ b, consensus }: { b: Basis[number]; consensus?: number }) {
  const spread = b.marks.length ? `${b.marks.length} evaluator${b.marks.length > 1 ? 's' : ''}` : '';
  return (
    <div className="grid gap-3 rounded-ctl border border-(--hair) p-3">
      {b.moderation
        ? <p><span className="eyebrow">Set by committee consensus, {show(b, b.moderation.score)}</span><span className="mt-1 block">{b.moderation.note}</span></p>
        : consensus !== undefined && spread && <p className="soft">Consensus {show(b, consensus)} is the median of {spread}.</p>}
      {b.marks.length === 0
        ? <p className="soft">No scores recorded for this criterion yet.</p>
        : <ul className="grid gap-2">{b.marks.map((m, i) => (
          <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3">
            <span className="numeral min-w-10 text-section font-semibold">{show(b, m.score)}</span>
            <span className="grid"><span className="eyebrow">{m.evaluator}</span>{m.comment ? <span>{m.comment}</span> : <span className="soft">No written basis recorded.</span>}</span>
          </li>))}</ul>}
    </div>
  );
}

/** One row per criterion; the info button opens the basis (who scored what, and why). `consensus` adds the agreed value and a bar. */
export function BasisList({ eventId, bidderRef, consensus }: { eventId: string; bidderRef: string; consensus?: Record<string, number> }) {
  const q = useBasis(eventId, bidderRef);
  const [open, setOpen] = useState<string | null>(null);
  if (q.isPending) return <div aria-busy className="h-24 animate-pulse rounded-ctl bg-(--hair)" />;
  if (!q.data) return <Reason>{(q.error as Error).message}</Reason>;
  return (
    <ul className="grid gap-3">
      {q.data.map(b => {
        const v = consensus?.[b.id], isOpen = open === b.id;
        return (
          <li key={b.id} className="grid gap-1">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">{b.name}{b.gate && <span className="soft"> (gate)</span>}</span>
              <span className="flex items-center gap-1">
                <span className="numeral font-medium">{v !== undefined ? show(b, v) : <span className="soft">{b.marks.length} scored</span>}</span>
                <button type="button" aria-expanded={isOpen} aria-label={`Basis for ${b.name}${v !== undefined ? `, scored ${show(b, v)}` : ''}`} title="On what basis was this scored?" onClick={() => setOpen(isOpen ? null : b.id)}
                  className={`grid size-11 place-items-center rounded-full text-(--sec) transition-transform hover:bg-primary-soft active:scale-[0.97] md:size-9 ${isOpen ? 'bg-primary-soft' : ''}`}><Ic n="info" className="size-5" /></button>
              </span>
            </div>
            {v !== undefined && !b.gate && <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-primary-soft"><span className="grow-x block h-full origin-left rounded-full bg-peri" style={{ transform: `scaleX(${v / 10})` }} /></span>}
            {isOpen && <Why b={b} consensus={v} />}
          </li>
        );
      })}
    </ul>
  );
}
