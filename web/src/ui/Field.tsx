import type { InputHTMLAttributes, ReactNode } from 'react';

/** Shared look for native controls: 4.6:1 border, visible hover, focus-visible ring from the global rule. */
export const control = 'w-full rounded-ctl border border-control bg-card [color-scheme:light] px-3 py-2 text-ink placeholder:text-ink-soft hover:border-primary disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger';

/** Label above, hint or error below. Pass the control as children, with `className={control}`. The error is announced. */
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="on-light grid min-w-0 gap-1.5 text-ink">
      <span className="font-medium">{label}</span>
      {children}
      {error ? <span role="alert" className="font-medium text-danger">{error}</span> : hint && <span className="text-ink-soft">{hint}</span>}
    </label>
  );
}

export const Input = ({ className = '', ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`h-11 md:h-10 ${control} ${className}`} />;
