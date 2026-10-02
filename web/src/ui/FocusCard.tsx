import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Button } from './Button';

type Props = {
  title: string;
  /** One line under the title, in the card and in the zoomed panel. */
  note?: string;
  /** What the card shows at rest. Keep it glanceable and non-interactive. */
  children: ReactNode;
  /** The full panel: tables, timelines, evidence. Mounted only while open. */
  detail: ReactNode;
  i?: number;
  className?: string;
};

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = 'cubic-bezier(0.16, 0.8, 0.2, 1)';

/**
 * A dashboard card that zooms in to a full panel. The card's rectangle morphs into the panel through the View Transitions API
 * (shared `view-transition-name`); without it, a transform + opacity FLIP does the same. Esc, the Zoom out button or the backdrop returns.
 * The panel is a native modal dialog: focus is trapped, the page behind is inert, focus returns to the card.
 */
export function FocusCard({ title, note, children, detail, i = 0, className = '' }: Props) {
  const name = 'fc-' + useId().replace(/[^a-z0-9]/gi, '');
  const dlg = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [named, setNamed] = useState(false); // the shared name exists only during a morph, so other cards never join the transition

  // Morph between the two states. `swap` must be synchronous so the browser can capture the new state.
  const morph = (to: boolean) => {
    const d = dlg.current!, c = card.current!;
    const swap = () => { flushSync(() => setOpen(to)); if (to) d.showModal(); else d.close(); };
    const vt = (document as Document & { startViewTransition?: (cb: () => void) => unknown }).startViewTransition;
    if (reduced()) return swap();
    if (vt) {
      flushSync(() => setNamed(true));
      const t = vt.call(document, swap) as { finished: Promise<unknown> };
      return void t.finished.finally(() => setNamed(false));
    }
    // Fallback: FLIP with transform and opacity only.
    if (to) {
      const from = c.getBoundingClientRect(); swap();
      const end = d.getBoundingClientRect();
      d.animate([{ transform: `translate(${from.left - end.left}px, ${from.top - end.top}px) scale(${from.width / end.width}, ${from.height / end.height})`, opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: ease });
    } else {
      const end = c.getBoundingClientRect(), from = d.getBoundingClientRect();
      d.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${end.left - from.left}px, ${end.top - from.top}px) scale(${end.width / from.width}, ${end.height / from.height})`, opacity: 0 }], { duration: 420, easing: ease }).onfinish = swap;
    }
  };

  return (
    <>
      <section
        ref={card}
        aria-label={title}
        style={{ '--i': i, viewTransitionName: named && !open ? name : 'none' } as CSSProperties}
        className={`rise card on-light lift group relative flex flex-col gap-4 p-5 md:p-6 ${className}`}
      >
        <header className="grid gap-1">
          <h2 className="text-section font-semibold">{title}</h2>
          {note && <p className="soft">{note}</p>}
        </header>
        {children}
        {/* Stretched button: the whole card is the target, and it is a real, labelled control. */}
        <button type="button" onClick={() => morph(true)} aria-label={`Zoom in on ${title}`} className="mt-auto inline-flex min-h-11 items-center gap-2 self-start rounded-ctl pr-2 font-medium text-(--sec) after:absolute after:inset-0 after:rounded-[inherit] hover:underline hover:underline-offset-4 active:scale-[0.97]">
          Zoom in
          <svg aria-hidden viewBox="0 0 24 24" className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14l-6 6m0 0h5m-5 0v-5M14 10l6-6m0 0h-5m5 0v5" /></svg>
        </button>
      </section>

      <dialog
        ref={dlg}
        aria-label={title}
        style={{ viewTransitionName: named && open ? name : 'none' }}
        onCancel={e => { e.preventDefault(); morph(false); }}
        onClick={e => { if (e.target === dlg.current) morph(false); }}
        className="zoom-panel card on-light m-auto h-[min(54rem,calc(100dvh-1.5rem))] w-[min(76rem,calc(100vw-1.5rem))] max-w-none overflow-hidden p-0 shadow-e3"
      >
        {open && (
          <div className="flex h-full flex-col">
            <header className="flex items-start justify-between gap-4 border-b border-(--hair) px-5 py-4 md:px-8 md:py-5">
              <div className="grid gap-1">
                <h2 className="text-section font-semibold">{title}</h2>
                {note && <p className="soft">{note}</p>}
              </div>
              <Button variant="secondary" autoFocus onClick={() => morph(false)}>Zoom out</Button>
            </header>
            <div className="min-h-0 flex-1 overflow-auto px-5 py-5 md:px-8 md:py-6">{detail}</div>
          </div>
        )}
      </dialog>
    </>
  );
}
