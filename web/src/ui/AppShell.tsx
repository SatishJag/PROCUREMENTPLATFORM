import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { getUser, setUser } from '../api';

// ponytail: the sample users, copied from sample/seed.ts. Replace with the signed-in session (Entra ID) or a users command.
const USERS = [
  ['u-omar', 'Omar Siddiqui', 'Requester'], ['u-priya', 'Priya Raman', 'Buyer'], ['u-daniel', 'Daniel Okafor', 'Procurement manager'],
  ['u-hana', 'Hana Kobayashi', 'Technical evaluator'], ['u-tom', 'Tom Weller', 'Commercial evaluator'], ['u-fatima', 'Fatima Al Mansoori', 'Budget owner'],
  ['u-rashid', 'Rashid Khan', 'Executive'], ['u-grace', 'Grace Lindqvist', 'Auditor'], ['u-falcon', 'Falcon bid desk', 'Supplier'],
] as const;
const initials = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('');

export type NavItem = { to: string; label: string; icon: keyof typeof icons; soon?: boolean };
const icons = {
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  intake: 'M4 13l2-8h12l2 8v6H4zM4 13h5l1 2h4l1-2h5',
  sourcing: 'M3 5h18l-7 8v6l-4 2v-8z',
  evaluation: 'M12 3v18M5 7h14M5 7l-3 7a3 3 0 006 0zM19 7l-3 7a3 3 0 006 0z',
  awards: 'M12 14a6 6 0 100-12 6 6 0 000 12zM8.5 13L7 22l5-3 5 3-1.5-9',
  suppliers: 'M4 21V7l8-4 8 4v14M9 21v-6h6v6M9 10h.01M15 10h.01',
};
const Icon = ({ name }: { name: NavItem['icon'] }) => (
  <svg aria-hidden viewBox="0 0 24 24" className="size-[1.125rem] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={icons[name]} /></svg>
);

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const cls = `relative flex h-11 items-center gap-3 whitespace-nowrap rounded-ctl px-3 font-medium tracking-[0.01em] transition-transform duration-200 active:scale-[0.97] ${active ? 'bg-white/10 text-on-night' : 'text-on-night-soft hover:bg-white/[0.07] hover:text-on-night'}`;
  const mark = active && <span aria-hidden className="absolute inset-y-2 left-0 w-px bg-gold max-lg:hidden" />;
  return item.soon
    ? <span aria-disabled="true" title="This screen is not built yet" className={`${cls} cursor-not-allowed opacity-55`}><Icon name={item.icon} />{item.label}<span className="eyebrow ml-auto max-lg:hidden">Soon</span></span>
    : <a href={`#${item.to}`} aria-current={active ? 'page' : undefined} className={cls}>{mark}<Icon name={item.icon} />{item.label}</a>;
}

/** Role switcher: a labelled menu button, not a bare select. Arrow keys move, Enter picks, Esc closes and returns focus. */
function UserMenu({ onPick }: { onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const user = USERS.find(u => u[0] === getUser()) ?? USERS[2];
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    root.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); return; }
    const items = Array.from(root.current!.querySelectorAll<HTMLElement>('[role=menuitemradio]')), at = items.indexOf(document.activeElement as HTMLElement);
    const to = e.key === 'ArrowDown' ? at + 1 : e.key === 'ArrowUp' ? at - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : -2;
    if (to === -2) return;
    e.preventDefault(); items[(to + items.length) % items.length]?.focus();
  };
  return (
    <div ref={root} className="relative" onKeyDown={key}>
      <button ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)} className="glass flex h-11 items-center gap-3 !rounded-full py-1 pl-1 pr-4 text-left transition-transform duration-200 hover:bg-white/10 active:scale-[0.97] md:h-12">
        <span aria-hidden className="grid size-9 place-items-center rounded-full border border-gold/60 bg-night-raised text-label font-semibold tracking-wider text-gold">{initials(user[1])}</span>
        <span className="grid min-w-0 leading-tight"><span className="eyebrow max-sm:hidden">Signed in as</span><span className="truncate font-medium">{user[1]}<span className="soft max-sm:hidden font-normal">, {user[2]}</span></span></span>
        <svg aria-hidden viewBox="0 0 24 24" className={`size-4 shrink-0 text-gold transition-transform duration-300 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div role="menu" aria-label="Switch role" className="enter absolute right-0 top-full z-40 mt-2 grid w-[min(22rem,calc(100vw-2rem))] gap-0.5 rounded-card border border-gold/30 bg-night-deep/95 p-1.5 shadow-e3 backdrop-blur-xl">
          {USERS.map(([id, name, role]) => (
            <button key={id} type="button" role="menuitemradio" aria-checked={id === user[0]} onClick={() => { onPick(id); setOpen(false); trigger.current?.focus(); }}
              className="flex min-h-11 items-center gap-3 rounded-ctl px-3 text-left transition-transform duration-150 hover:bg-white/10 active:scale-[0.98] aria-checked:bg-white/10">
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-gold opacity-0 [[aria-checked=true]>&]:opacity-100" />
              <span className="grid"><span className="font-medium">{name}</span><span className="soft text-label">{role}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell({ nav, route, children }: { nav: NavItem[]; route: string; children: ReactNode }) {
  const qc = useQueryClient();
  const [, bump] = useState(0);
  return (
    <div className="stage on-dark min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col gap-1 border-r border-gold/20 bg-night-deep/70 p-4 backdrop-blur-xl lg:flex">
        <div className="mb-8 flex items-center gap-3 px-2 pt-3">
          <span aria-hidden className="grid size-9 place-items-center rounded-full border border-gold/70 text-section font-light text-gold">P</span>
          <span className="text-section font-medium tracking-[0.04em]">Procurement</span>
        </div>
        <p className="eyebrow mb-2 px-3">Workspace</p>
        <nav aria-label="Modules" className="grid gap-1">{nav.map(n => <NavLink key={n.to} item={n} active={n.to === route} />)}</nav>
        <div className="gold-rule mt-auto" />
        <p className="soft flex items-center gap-2 px-3 pt-3"><span aria-hidden className="size-1.5 rounded-full bg-gold" />Sample data, project DC1</p>
      </aside>

      <div className="lg:pl-64">
        <div className="mx-auto flex max-w-[84rem] items-center justify-between gap-3 px-4 pt-4 md:px-10 md:pt-6">
          <span className="flex items-center gap-2 text-section font-medium tracking-[0.04em] lg:invisible"><span aria-hidden className="grid size-8 place-items-center rounded-full border border-gold/70 font-light text-gold">P</span><span className="max-sm:hidden">Procurement</span></span>
          <UserMenu onPick={id => { setUser(id); bump(n => n + 1); qc.resetQueries(); }} />
        </div>
        <nav aria-label="Modules" className="glass mx-4 mt-3 flex gap-1 overflow-x-auto p-1 lg:hidden">{nav.map(n => <NavLink key={n.to} item={n} active={n.to === route} />)}</nav>
        <main key={route} className="enter mx-auto grid max-w-[84rem] grid-cols-[minmax(0,1fr)] gap-8 px-4 pb-32 pt-6 md:px-10 md:pt-8 lg:pb-16">{children}</main>
      </div>
    </div>
  );
}
