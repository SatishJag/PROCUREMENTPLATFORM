import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

// Theme ids match the [data-theme] blocks in styles/tokens.css. Each swatch carries its own data-theme, so it reads that
// theme's --sw-* tokens (canvas, panel, card, accent); no colour is written here.
const THEMES = [
  ['midnight', 'Midnight and gold', 'Midnight canvas, champagne hairlines'],
  ['indigo', 'Indigo and amber', 'Light blue-white, deep indigo'],
  ['coral', 'Coral', 'Warm grey, rounded cards, coral'],
  ['periwinkle', 'Periwinkle and ink', 'Periwinkle with near-black panels'],
] as const;
type Id = (typeof THEMES)[number][0];
const KEY = 'theme';

const Swatch = ({ id }: { id: Id }) => (
  <span aria-hidden data-theme={id} className="grid size-9 shrink-0 grid-cols-2 grid-rows-2 overflow-hidden rounded-full ring-1 ring-(--hair)">
    <i className="bg-(--sw-canvas)" /><i className="bg-(--sw-panel)" /><i className="bg-(--sw-card)" /><i className="bg-(--sw-accent)" />
  </span>
);

/** Theme menu: a labelled menu button like the role switcher. Arrow keys move, Enter picks, Esc closes. The choice is stored
 *  in localStorage and applied to <html data-theme>; index.html applies it before first paint. */
export function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState<Id>(() => THEMES.find(t => t[0] === document.documentElement.dataset.theme)?.[0] ?? 'midnight');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    root.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  const pick = (t: Id) => {
    setId(t); setOpen(false); trigger.current?.focus();
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(KEY, t); } catch { /* storage blocked: the theme still applies for this visit */ }
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--chrome').trim());
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); return; }
    const items = Array.from(root.current!.querySelectorAll<HTMLElement>('[role=menuitemradio]')), at = items.indexOf(document.activeElement as HTMLElement);
    const to = e.key === 'ArrowDown' ? at + 1 : e.key === 'ArrowUp' ? at - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : -2;
    if (to === -2) return;
    e.preventDefault(); items[(to + items.length) % items.length]?.focus();
  };
  const cur = THEMES.find(t => t[0] === id)!;
  return (
    <div ref={root} className="relative" onKeyDown={key}>
      <button ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`Theme: ${cur[1]}`} onClick={() => setOpen(o => !o)} className="glass flex h-11 items-center gap-2 !rounded-full py-1 pl-1 pr-3 transition-transform duration-200 hover:bg-(--wash)/10 active:scale-[0.97] md:h-12 md:pr-4">
        <Swatch id={id} />
        <span className="font-medium max-md:hidden">Theme</span>
      </button>
      {open && (
        <div role="menu" aria-label="Choose a theme" className="enter absolute right-0 top-full z-40 mt-2 grid w-[min(21rem,calc(100vw-2rem))] gap-0.5 rounded-card border border-gold/30 bg-night-raised p-1.5 shadow-e3">
          {THEMES.map(([t, name, note]) => (
            <button key={t} type="button" role="menuitemradio" aria-checked={t === id} onClick={() => pick(t)} className="flex min-h-14 items-center gap-3 rounded-ctl px-2 text-left transition-transform duration-150 hover:bg-(--wash)/10 active:scale-[0.98] aria-checked:bg-(--wash)/10">
              <Swatch id={t} />
              <span className="grid"><span className="font-medium">{name}</span><span className="soft text-label">{note}</span></span>
              <svg aria-hidden viewBox="0 0 24 24" className="ml-auto size-4 shrink-0 text-(--gold) opacity-0 [[aria-checked=true]>&]:opacity-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
