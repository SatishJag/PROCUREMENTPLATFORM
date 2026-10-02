import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRef, useState } from 'react';
// Colour changes are instant; only transform animates. Height 44 on touch, 40 from md.
const base = 'relative inline-flex h-11 md:h-10 items-center justify-center whitespace-nowrap rounded-ctl px-4 font-semibold transition-transform duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100';
const look = {
    primary: 'bg-(--btn-bg) text-(--btn-fg) shadow-e1 hover:bg-(--btn-hover)',
    secondary: 'border-2 border-(--sec) text-(--sec) hover:bg-(--sec-hover)',
    destructive: 'border-2 border-danger text-danger hover:bg-danger-soft',
    text: 'px-2 text-(--sec) underline underline-offset-4 hover:bg-(--sec-hover)',
};
export function Button({ variant = 'secondary', loading, onClick, onReason, children, className = '', disabled, ...rest }) {
    const dialog = useRef(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const ask = variant === 'destructive' && onReason;
    return (_jsxs(_Fragment, { children: [_jsxs("button", { ...rest, type: "button", disabled: disabled || loading, "aria-busy": loading || undefined, onClick: () => (ask ? dialog.current?.showModal() : onClick?.()), className: `${base} ${look[variant]} ${className}`, children: [_jsx("span", { className: loading ? 'invisible' : '', children: children }), loading && _jsx("span", { "aria-hidden": true, className: "spin absolute size-4 rounded-full border-2 border-current border-t-transparent" })] }), ask && (_jsx("dialog", { ref: dialog, "aria-label": `Reason for: ${children}`, className: "font-ui m-auto w-[min(26rem,calc(100vw-2rem))] rounded-card bg-card p-6 text-ink shadow-e3 backdrop:bg-ink/50", children: _jsxs("form", { onSubmit: async (e) => {
                        e.preventDefault();
                        const reason = String(new FormData(e.currentTarget).get('reason') ?? '');
                        setBusy(true);
                        setError('');
                        try {
                            await onReason(reason);
                            dialog.current?.close();
                        }
                        catch (x) {
                            setError(x.message);
                        }
                        setBusy(false);
                    }, className: "grid gap-4", children: [_jsxs("label", { className: "grid min-w-0 gap-2", children: [_jsxs("span", { className: "text-section font-semibold", children: [children, ": give a reason"] }), _jsx("textarea", { name: "reason", required: true, rows: 3, className: "w-full rounded-ctl border-2 border-control bg-card p-3 text-body" })] }), error && _jsx("p", { role: "alert", className: "rounded-ctl bg-danger-soft p-3 text-danger", children: error }), _jsxs("div", { className: "flex justify-end gap-3", children: [_jsx(Button, { variant: "text", onClick: () => dialog.current?.close(), children: "Cancel" }), _jsxs("button", { type: "submit", disabled: busy, "aria-busy": busy || undefined, className: `${base} ${look.destructive}`, children: [_jsx("span", { className: busy ? 'invisible' : '', children: children }), busy && _jsx("span", { "aria-hidden": true, className: "spin absolute size-4 rounded-full border-2 border-current border-t-transparent" })] })] })] }) }))] }));
}
