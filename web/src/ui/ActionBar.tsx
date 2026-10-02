import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { call, getUser } from '../api';
import { Button } from './Button';

type Props = {
  /** Module whose `actions(id)` command says what this user may do now. */
  module: string;
  id: string;
  /** Performs the action, e.g. `(a, reason) => call('awards', 'decide', id, a, reason)`. Engine errors become the visible reason. */
  run: (action: string, reason: string) => Promise<unknown>;
  /** Action name to button text, verb + object, e.g. `{ approved: 'Approve award' }`. Defaults to the action name. */
  labels?: Record<string, string>;
  /** Fixed to the bottom on mobile (long forms, entity screens). */
  sticky?: boolean;
};

const destructive = /^(reject|suspend|withdraw)/;
const words = (a: string) => a.charAt(0).toUpperCase() + a.slice(1).replace(/_/g, ' ');

/** Buttons come only from the engine's `actions` command. First non-destructive action is the primary; the rest are outlined. */
export function ActionBar({ module, id, run, labels = {}, sticky }: Props) {
  const qc = useQueryClient();
  const [blocked, setBlocked] = useState('');
  const actions = useQuery({ queryKey: ['actions', getUser(), module, id], queryFn: () => call<string[]>(module, 'actions', id) });
  const m = useMutation({
    mutationFn: (v: { action: string; reason?: string }) => run(v.action, v.reason ?? ''),
    onSuccess: () => { setBlocked(''); qc.invalidateQueries(); },
    onError: e => setBlocked(e.message),
  });
  const list = actions.data ?? [];
  const primary = list.find(a => !destructive.test(a));
  const ordered = [...list.filter(a => a !== primary), ...(primary ? [primary] : [])];
  const reason = blocked || (actions.error as Error | null)?.message || (actions.isSuccess && !list.length ? 'Nothing for you to do on this item.' : '');

  return (
    <div className={`flex flex-wrap items-center gap-3 ${sticky ? 'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:flex-nowrap max-md:border-t max-md:border-line max-md:bg-card/90 max-md:p-3 max-md:shadow-e3 max-md:backdrop-blur' : ''}`}>
      {reason && (
        <p role={blocked ? 'alert' : undefined} className={`min-w-0 flex-1 max-md:basis-full ${blocked ? 'font-medium text-danger' : 'text-ink-soft'}`}>{reason}</p>
      )}
      {ordered.map(a => {
        const pending = m.isPending && m.variables?.action === a;
        const label = labels[a] ?? words(a);
        return destructive.test(a)
          ? <Button key={a} variant="destructive" disabled={m.isPending} onReason={r => m.mutateAsync({ action: a, reason: r })}>{label}</Button>
          : <Button key={a} variant={a === primary ? 'primary' : 'secondary'} loading={pending} disabled={m.isPending} onClick={() => m.mutate({ action: a })} className={sticky && a === primary ? 'max-md:flex-1' : ''}>{label}</Button>;
      })}
    </div>
  );
}
