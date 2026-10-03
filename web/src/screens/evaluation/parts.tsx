import type { ReactNode } from 'react';
import { ON_SERIES, series } from './lib';

/** Bidder identity: letter in the bidder's colour. The name always sits beside it. */
export const Badge = ({ i, dim, size = 'size-8' }: { i: number; dim?: boolean; size?: string }) => (
  <span aria-hidden className={`${size} grid shrink-0 place-items-center rounded-full text-label font-semibold ${dim ? 'border border-dashed border-(--soft) text-(--soft)' : ''}`} style={dim ? undefined : { background: series(i), color: ON_SERIES }}>
    {String.fromCharCode(65 + i)}
  </span>
);

/** Native select that reads on the stage (ui/bits Select is porcelain only). */
export function DarkSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="eyebrow">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className="h-11 w-full min-w-0 rounded-ctl border border-(--soft) bg-stage px-3 text-(--fg) [color-scheme:dark] hover:border-(--gold) md:h-10">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

/** Text link styled as the tertiary action. */
export const LinkBtn = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} className="inline-flex min-h-11 items-center rounded-ctl px-2 font-semibold text-(--sec) underline underline-offset-4 transition-transform hover:bg-(--sec-hover) active:scale-[0.97] md:min-h-10">{children}</a>
);

/** A sealed envelope: gold seal on a raised fold. Used wherever the engine keeps something closed. */
export function Envelope({ className = 'w-40' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 160 110" className={className} fill="none">
      <rect x="6" y="14" width="148" height="88" rx="8" className="fill-stage-raised stroke-stage-mark" strokeOpacity="0.6" />
      <path d="M8 18l72 48 72-48" className="stroke-stage-mark" strokeOpacity="0.55" />
      <path d="M8 100l56-44M152 100L96 56" className="stroke-stage-mark" strokeOpacity="0.25" />
      <circle cx="80" cy="66" r="15" className="fill-stage-mark" />
      <circle cx="80" cy="66" r="10.5" className="stroke-stage" strokeOpacity="0.45" />
      <path d="M75 66h10M80 61v10" className="stroke-stage" strokeOpacity="0.6" strokeLinecap="round" />
    </svg>
  );
}

export const Reason = ({ children, tone = 'bad' }: { children: ReactNode; tone?: 'bad' | 'soft' }) => (
  <p role={tone === 'bad' ? 'alert' : undefined} className={`whitespace-pre-line break-words ${tone === 'bad' ? 'font-medium text-(--bad)' : 'soft'}`}>{children}</p>
);
