// Small local controls this screen needs and the design system does not have yet (see the report: Select, Check, Tabs, Tags, Icon).
import { useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { control, Field } from '../../ui/Field';

export const useMedia = (q: string) => useSyncExternalStore(
  cb => { const m = matchMedia(q); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
  () => matchMedia(q).matches,
);
export const useDesktop = () => useMedia('(min-width: 768px)');

export const sel = 'h-11 md:h-10 ' + control;
/** Compact variants for table cells. */
export const cell = 'h-9 rounded-ctl border border-control bg-white px-2 text-ink hover:border-primary disabled:cursor-not-allowed disabled:opacity-50';

export function Select({ label, value, onChange, options, placeholder, hint, error, aria, className = '' }: { aria?: string; label: string; value: string; onChange: (v: string) => void; options: [string, string][]; placeholder?: string; hint?: string; error?: string; className?: string }) {
  return (
    <Field label={label} hint={hint} error={error}>
      <select value={value} aria-label={label ? undefined : aria} aria-invalid={!!error || undefined} onChange={e => onChange(e.target.value)} className={`${sel} ${className}`}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Field>
  );
}

export function Check({ label, checked, onChange, hint, disabled }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  return (
    <label className="on-light flex min-h-11 cursor-pointer items-start gap-3 py-1.5 text-ink has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-[4px] accent-(--color-primary)" />
      <span className="grid"><span className="font-medium">{label}</span>{hint && <span className="text-ink-soft">{hint}</span>}</span>
    </label>
  );
}

/** Free-text list: Enter or Add appends, the x removes. */
export function Tags({ label, values, onChange, hint }: { label: string; values: string[]; onChange: (v: string[]) => void; hint?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => { const t = draft.trim(); if (t && !values.includes(t)) onChange([...values, t]); setDraft(''); };
  return (
    <div className="on-light grid gap-1.5 text-ink">
      <span className="font-medium">{label}</span>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {values.map(v => (
            <li key={v} className="flex items-center gap-1 rounded-full border border-line bg-primary-soft py-0.5 pl-3 pr-1">
              {v}
              <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter(x => x !== v))} className="grid size-7 place-items-center rounded-full text-ink-soft transition-transform hover:bg-white hover:text-ink active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50">
                <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} aria-label={`Add to ${label}`} placeholder="Type and press Enter" className={`${sel} min-w-0 flex-1`} />
        <button type="button" onClick={add} disabled={!draft.trim()} className="h-11 rounded-ctl border border-primary px-4 font-semibold text-primary transition-transform hover:bg-primary-soft active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 md:h-10">Add</button>
      </div>
      {hint && <span className="text-ink-soft">{hint}</span>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: [T, string][]; value: T; onChange: (v: T) => void; label: string }) {
  const key = (e: KeyboardEvent) => {
    const i = tabs.findIndex(t => t[0] === value), d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault(); const n = tabs[(i + d + tabs.length) % tabs.length][0]; onChange(n);
    requestAnimationFrame(() => document.getElementById(`tab-${n}`)?.focus());
  };
  return (
    <div role="tablist" aria-label={label} onKeyDown={key} className="glass on-dark flex gap-1 overflow-x-auto p-1">
      {tabs.map(([id, text]) => (
        <button key={id} id={`tab-${id}`} type="button" role="tab" aria-selected={id === value} aria-controls="tab-panel" tabIndex={id === value ? 0 : -1} onClick={() => onChange(id)}
          className={`relative h-11 shrink-0 whitespace-nowrap rounded-ctl px-4 font-medium tracking-[0.01em] transition-transform duration-200 active:scale-[0.97] ${id === value ? 'bg-white/12 text-on-night' : 'text-on-night-soft hover:bg-white/[0.07] hover:text-on-night'}`}>
          {text}
          {id === value && <span aria-hidden className="absolute inset-x-4 bottom-1 h-px bg-gold" />}
        </button>
      ))}
    </div>
  );
}

const paths = {
  clock: 'M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z', up: 'M12 19V6M6 11l6-6 6 6', file: 'M7 3h7l4 4v14H7zM14 3v4h4', bell: 'M6 16V11a6 6 0 1112 0v5l2 2H4zM10 21h4',
  users: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 3-5 6-5s6 2 6 5M16 5a3 3 0 010 6M18 15c2 .6 3 2 3 5', check: 'M5 12l5 5 9-10', warn: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  err: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 8v5M12 16h.01', up2: 'M6 15l6-6 6 6', down2: 'M6 9l6 6 6-6', plus: 'M12 5v14M5 12h14', branch: 'M6 4v8a4 4 0 004 4h8M6 4L4 6M6 4l2 2M18 16l-2-2M18 16l-2 2',
  back: 'M15 5l-7 7 7 7', lock: 'M6 11h12v9H6zM8 11V8a4 4 0 118 0v3', grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
};
export const Ic = ({ n, className = 'size-4' }: { n: keyof typeof paths; className?: string }) => (
  <svg aria-hidden viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[n]} /></svg>
);

/** Icon-only button with a visible name on hover and for screen readers. 44px on touch, 40 from md. */
export function IconBtn({ label, n, onClick, disabled }: { label: string; n: keyof typeof paths; onClick: () => void; disabled?: boolean }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid size-11 place-items-center rounded-ctl border border-control text-primary transition-transform hover:bg-primary-soft active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 md:size-10"><Ic n={n} /></button>;
}
