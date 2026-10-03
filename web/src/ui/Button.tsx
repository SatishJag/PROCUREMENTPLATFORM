import { useRef, useState, type ButtonHTMLAttributes } from 'react';
import { Field, control } from './Field';

type Variant = 'primary' | 'secondary' | 'destructive' | 'text';
type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  variant?: Variant;
  loading?: boolean;
  onClick?: () => unknown;
  /** Destructive only: asks for a reason in a dialog, then calls this. A throw shows the engine message in the dialog. */
  onReason?: (reason: string) => unknown;
};

// Colour changes are instant; only transform animates. Height 44 on touch, 40 from md.
const base = 'relative inline-flex h-11 md:h-10 items-center justify-center whitespace-nowrap rounded-btn px-5 font-semibold tracking-[0.01em] transition-transform duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100';
const look: Record<Variant, string> = {
  primary: 'bg-(--btn-bg) text-(--btn-fg) shadow-btn hover:bg-(--btn-hover)',
  secondary: 'border border-(--sec) text-(--sec) hover:bg-(--sec-hover)',
  destructive: 'border border-(--bad) text-(--bad) hover:bg-(--bad-hover)',
  text: 'px-2 text-(--sec) underline underline-offset-4 hover:bg-(--sec-hover)',
};

export function Button({ variant = 'secondary', loading, onClick, onReason, children, className = '', disabled, ...rest }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ask = variant === 'destructive' && onReason;
  return (
    <>
      <button
        {...rest}
        type="button"
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        onClick={() => (ask ? dialog.current?.showModal() : onClick?.())}
        className={`${base} ${look[variant]} ${className}`}
      >
        <span className={loading ? 'invisible' : ''}>{children}</span>
        {loading && <span aria-hidden className="spin absolute size-4 rounded-full border-2 border-current border-t-transparent" />}
      </button>
      {ask && (
        <dialog ref={dialog} aria-label={`Reason for: ${children}`} className="zoom-panel card on-light m-auto w-[min(26rem,calc(100vw-2rem))] p-6 shadow-e3">
          <form
            onSubmit={async e => {
              e.preventDefault();
              const reason = String(new FormData(e.currentTarget).get('reason') ?? '');
              setBusy(true); setError('');
              try { await onReason(reason); dialog.current?.close(); } catch (x) { setError((x as Error).message); }
              setBusy(false);
            }}
            className="grid gap-4"
          >
            <Field label={`${children}: give a reason`} hint="Recorded in the audit trail with your name.">
              <textarea name="reason" required rows={3} className={control} />
            </Field>
            {error && <p role="alert" className="rounded-ctl bg-danger-soft p-3 text-danger">{error}</p>}
            <div className="flex justify-end gap-3">
              <Button variant="text" onClick={() => dialog.current?.close()}>Cancel</Button>
              <button type="submit" disabled={busy} aria-busy={busy || undefined} className={`${base} ${look.destructive}`}>
                <span className={busy ? 'invisible' : ''}>{children}</span>
                {busy && <span aria-hidden className="spin absolute size-4 rounded-full border-2 border-current border-t-transparent" />}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
