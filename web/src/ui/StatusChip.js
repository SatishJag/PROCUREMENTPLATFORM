import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const tones = {
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    neutral: 'bg-primary-soft text-primary',
};
// Dot colour is a second cue next to the label; on the dark header the chip turns glass (see tokens.css).
const dots = { success: 'var(--dot-ok)', warning: 'var(--color-accent)', danger: 'var(--dot-bad)', neutral: 'currentColor' };
export function StatusChip({ tone = 'neutral', children }) {
    return (_jsxs("span", { className: `chip inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 font-semibold ${tones[tone]}`, children: [_jsx("span", { "aria-hidden": true, className: "size-2 rounded-full", style: { background: dots[tone] } }), children] }));
}
