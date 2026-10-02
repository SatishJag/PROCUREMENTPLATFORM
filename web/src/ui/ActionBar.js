import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { call, getUser } from '../api';
import { Button } from './Button';
const destructive = /^(reject|suspend|withdraw)/;
const words = (a) => a.charAt(0).toUpperCase() + a.slice(1).replace(/_/g, ' ');
/** Buttons come only from the engine's `actions` command. First non-destructive action is the primary; the rest are outlined. */
export function ActionBar({ module, id, run, labels = {}, sticky }) {
    const qc = useQueryClient();
    const [blocked, setBlocked] = useState('');
    const actions = useQuery({ queryKey: ['actions', getUser(), module, id], queryFn: () => call(module, 'actions', id) });
    const m = useMutation({
        mutationFn: (v) => run(v.action, v.reason ?? ''),
        onSuccess: () => { setBlocked(''); qc.invalidateQueries(); },
        onError: e => setBlocked(e.message),
    });
    const list = actions.data ?? [];
    const primary = list.find(a => !destructive.test(a));
    const ordered = [...list.filter(a => a !== primary), ...(primary ? [primary] : [])];
    const reason = blocked || actions.error?.message || (actions.isSuccess && !list.length ? 'Nothing for you to do on this item.' : '');
    return (_jsxs("div", { className: `flex flex-wrap items-center gap-3 ${sticky ? 'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:flex-nowrap max-md:border-t max-md:border-line max-md:bg-card/90 max-md:p-3 max-md:shadow-e3 max-md:backdrop-blur' : ''}`, children: [reason && (_jsx("p", { role: blocked ? 'alert' : undefined, className: `min-w-0 flex-1 max-md:basis-full ${blocked ? 'font-medium text-danger' : 'text-ink-soft'}`, children: reason })), ordered.map(a => {
                const pending = m.isPending && m.variables?.action === a;
                const label = labels[a] ?? words(a);
                return destructive.test(a)
                    ? _jsx(Button, { variant: "destructive", disabled: m.isPending, onReason: r => m.mutateAsync({ action: a, reason: r }), children: label }, a)
                    : _jsx(Button, { variant: a === primary ? 'primary' : 'secondary', loading: pending, disabled: m.isPending, onClick: () => m.mutate({ action: a }), className: sticky && a === primary ? 'max-md:flex-1' : '', children: label }, a);
            })] }));
}
