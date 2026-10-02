import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { call, getUser } from '../../api';
import { Button } from '../../ui/Button';
import { Ic } from '../../ui/bits';
import { Money } from '../../ui/Money';
import { StatusChip } from '../../ui/StatusChip';
import { Zoomable } from '../../ui/Zoomable';
import { STAGES, stageLabel, stageTone, type EventRow, type TwinNode } from './data';

/** Native modal dialog: focus is trapped, Esc closes, the page behind is inert. Mounted content resets on every open. */
export function Sheet({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current!; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  return (
    <dialog ref={ref} aria-label={title} onClose={onClose} onClick={e => { if (e.target === ref.current) onClose(); }} className="zoom-panel card on-light m-auto max-h-[calc(100dvh-1.5rem)] w-[min(34rem,calc(100vw-1.5rem))] overflow-auto p-5 shadow-e3 md:p-6">
      {open && <div className="grid gap-4"><h2 className="text-section font-semibold">{title}</h2>{children}</div>}
    </dialog>
  );
}

export const ErrorNote = ({ children }: { children: ReactNode }) => <p role="alert" className="rounded-ctl bg-danger-soft p-3 font-medium text-danger">{children}</p>;

export function Back({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className="on-dark soft -ml-2 inline-flex min-h-11 items-center gap-1.5 justify-self-start rounded-ctl px-2 font-medium transition-transform hover:text-(--fg) active:scale-[0.97]"><Ic n="back" />{children}</button>;
}

/** Seven stages in order: finished stages gold, the current one amber, the rest hollow. Only the current label shows on a phone. */
export function StageRail({ status }: { status: string }) {
  const at = STAGES.findIndex(s => s[0] === status);
  return (
    <div className="glass on-dark p-4 md:p-5">
      <ol aria-label="Sourcing lifecycle" className="grid grid-cols-7">
        {STAGES.map(([id, label], i) => {
          const done = i < at, cur = i === at;
          return (
            <li key={id} aria-current={cur ? 'step' : undefined} className="relative grid justify-items-center gap-2">
              {i > 0 && <span aria-hidden className={`absolute right-1/2 top-[0.6875rem] h-px w-full ${i <= at ? 'bg-gold' : 'bg-white/20'}`} />}
              <span className={`relative grid size-6 place-items-center rounded-full border ${cur ? 'border-accent bg-accent text-on-accent shadow-[0_0_0_5px_rgb(245_184_0/0.18)]' : done ? 'border-gold bg-gold text-night' : 'border-white/30 bg-night-deep'}`}>
                {done ? <Ic n="check" className="size-3.5" /> : <span className="text-label font-semibold">{i + 1}</span>}
              </span>
              <span className={`text-center text-label max-md:hidden ${cur ? 'font-semibold text-(--fg)' : done ? 'text-(--fg)' : 'soft'}`}>{label}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center font-medium md:hidden">Stage {at + 1} of {STAGES.length}: {stageLabel(status)}</p>
    </div>
  );
}

const Meter = ({ status }: { status: string }) => {
  const at = STAGES.findIndex(s => s[0] === status);
  return <span aria-hidden className="flex gap-1">{STAGES.map((s, i) => <i key={s[0]} className={`h-1 flex-1 rounded-full ${i < at ? 'bg-(--gold)' : i === at ? 'bg-(--btn-bg)' : 'bg-(--hair)'}`} />)}</span>;
};

/** Porcelain event card (mobile list). The whole card opens the event. */
export function EventCard({ ev, i, onOpen }: { ev: EventRow; i: number; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} style={{ '--i': i } as never} className="rise card on-light lift grid gap-3 p-5 text-left active:scale-[0.99]">
      <span className="flex items-center justify-between gap-3"><span className="font-code text-label">{ev.id}</span><StatusChip tone={stageTone(ev.status)}>{stageLabel(ev.status)}</StatusChip></span>
      <span className="text-section font-semibold">{ev.title}</span>
      <Meter status={ev.status} />
      <span className="soft flex flex-wrap gap-x-4">
        <span>{ev.type}</span>
        <span>{ev.bids === undefined ? 'Bids sealed' : `${ev.bids} bid${ev.bids === 1 ? '' : 's'}`}</span>
        {ev.pkg?.value !== undefined && <Money value={ev.pkg.value} />}
      </span>
    </button>
  );
}

const LANES: [string, string][] = [['planned', 'Ready to source'], ...STAGES];

/** Pipeline map: pan and zoom. Zoomed out, cards show the reference and stage; zoomed in, the full card (semantic zoom). */
export function Lanes({ events, planned, onOpen, onCreate }: { events: EventRow[]; planned: TwinNode[]; onOpen: (id: string) => void; onCreate: (pkg: string) => void }) {
  const [k, setK] = useState(1);
  const far = k < 0.62;
  return (
    <Zoomable label="Sourcing pipeline map" min={0.35} max={2} onScale={setK} className="h-[22rem]">
      <div className="flex gap-3 p-5">
        {LANES.map(([id, label]) => {
          const evs = events.filter(e => e.status === id);
          const pk = id === 'planned' ? planned : [];
          return (
            <section key={id} aria-label={label} className="w-44 shrink-0">
              <h3 className="eyebrow mb-3 flex items-center justify-between !text-[0.8125rem]"><span>{label}</span><span className="numeral text-[1rem] !font-medium">{evs.length + pk.length}</span></h3>
              <div className="gold-rule mb-3" />
              <div className="grid gap-3">
                {pk.map(p => (
                  <article key={p.id} className="glass grid gap-2 border-dashed p-4">
                    <span className="font-code text-label soft">{p.id}</span>
                    <span className={`font-medium ${far ? 'text-[1.375rem] leading-tight' : ''}`}>{p.label}</span>
                    {!far && p.value !== undefined && <Money value={p.value} className="soft" />}
                    <Button variant="secondary" onClick={() => onCreate(p.id)} className={far ? '!h-12 !text-[1.125rem]' : ''}>Create event</Button>
                  </article>
                ))}
                {evs.map(e => (
                  <button key={e.id} type="button" onClick={() => onOpen(e.id)} className="glass lift grid gap-2 border-gold/40 p-4 text-left transition-transform active:scale-[0.98]">
                    <span className={`font-code ${far ? 'text-[1.25rem]' : 'text-label'}`}>{e.id}</span>
                    <span className={`font-medium ${far ? 'text-[1.375rem] leading-tight' : ''}`}>{e.title}</span>
                    <span className="soft flex gap-3"><span className={far ? 'text-[1.125rem]' : ''}>{e.type}</span><span className={far ? 'text-[1.125rem]' : ''}>{e.bids === undefined ? 'Bids sealed' : `${e.bids} bids`}</span></span>
                    {!far && <span className="soft">{e.invited.length ? `${e.invited.length} invited` : 'Invitations not published'}</span>}
                  </button>
                ))}
                {!evs.length && !pk.length && <p aria-hidden className="rounded-card border border-dashed border-white/15 p-4 text-center text-white/30">empty</p>}
              </div>
            </section>
          );
        })}
      </div>
    </Zoomable>
  );
}

// Buttons come from sourcing.actions. Names the engine returns map to a label and a handler; some belong to other screens.
// ponytail: local stand-in for ActionBar, which makes the first engine action the primary ('extend' would win over 'close'). Fold into ActionBar with an `order` prop.
const GO = (hash: string) => () => { location.hash = hash; return Promise.resolve(); };
type Step = { label: string; run: (id: string) => Promise<unknown> };
const STEPS: Record<string, Step> = {
  publish: { label: 'Publish event', run: id => call('sourcing', 'publish', id) },
  close: { label: 'Close bids', run: id => call('sourcing', 'close', id) },
  open_technical: { label: 'Open technical', run: id => call('evaluation', 'openTechnical', id) },
  complete_technical: { label: 'Open evaluation', run: GO('/evaluation') },
  recommend: { label: 'Open evaluation', run: GO('/evaluation') },
  award: { label: 'Review award', run: GO('/awards') },
  reject: { label: 'Review award', run: GO('/awards') },
};

export function StageActions({ ev, onExtend, sticky }: { ev: EventRow; onExtend: () => void; sticky?: boolean }) {
  const qc = useQueryClient();
  const [blocked, setBlocked] = useState('');
  const q = useQuery({ queryKey: ['actions', getUser(), 'sourcing', ev.id], queryFn: () => call<string[]>('sourcing', 'actions', ev.id) });
  const m = useMutation({ mutationFn: (a: string) => STEPS[a].run(ev.id), onSuccess: () => { setBlocked(''); qc.invalidateQueries(); }, onError: e => setBlocked(e.message) });
  const list = q.data ?? [];
  const steps = [...new Map(list.filter(a => STEPS[a]).map(a => [STEPS[a].label, a])).values()];
  const decided = !list.length && (ev.status === 'approval' || ev.status === 'awarded');
  const reason = blocked || (q.error as Error | null)?.message || (q.isSuccess && !list.length && !decided ? 'Nothing for you to do on this item.' : '');
  return (
    <div className={`flex flex-wrap items-center justify-end gap-3 ${sticky ? 'bar-sticky' : ''}`}>
      {reason && <p role={blocked ? 'alert' : undefined} className={`min-w-0 flex-1 basis-full max-md:order-first md:order-last md:text-right ${blocked ? 'font-medium text-(--bad)' : 'soft'}`}>{reason}</p>}
      {list.includes('extend') && <Button variant="secondary" onClick={onExtend}>Extend deadline</Button>}
      {decided && <Button variant="primary" onClick={() => GO('/awards')()} className="max-md:flex-1">Open awards</Button>}
      {steps.map((a, i) => <Button key={a} variant={i === steps.length - 1 ? 'primary' : 'secondary'} loading={m.isPending && m.variables === a} disabled={m.isPending} onClick={() => m.mutate(a)} className={i === steps.length - 1 ? 'max-md:flex-1' : ''}>{STEPS[a].label}</Button>)}
    </div>
  );
}
