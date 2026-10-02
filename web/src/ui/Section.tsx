import type { ReactNode } from 'react';

/** Collapsible supporting detail (native details/summary, keyboard and screen-reader ready). Chevron turns by transform, content fades in. */
export function Section({ title, meta, defaultOpen, children }: { title: string; meta?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-ctl py-2 text-section font-semibold hover:text-(--gold) [&::-webkit-details-marker]:hidden">
        <svg aria-hidden viewBox="0 0 24 24" className="size-4 shrink-0 text-(--gold) transition-transform duration-300 group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
        {title}
        {meta && <span className="soft ml-auto text-body font-normal">{meta}</span>}
      </summary>
      <div className="enter pt-2">{children}</div>
    </details>
  );
}
