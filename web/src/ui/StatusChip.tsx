import type { ReactNode } from 'react';

export type Tone = 'success' | 'warning' | 'danger' | 'neutral';

/** Colour plus a dot plus the label: never colour alone. Reads the surface context (see app.css). */
export function StatusChip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`chip tone-${tone}`}><i aria-hidden />{children}</span>;
}
