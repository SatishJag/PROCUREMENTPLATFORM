import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef } from 'react';
import { Money, Num } from '../../ui/Money';
/** Score bar: fill grows by transform from the left. */
export function Bar({ label, value, max, tone }) {
    const r = max > 0 ? Math.min(value / max, 1) : 0;
    return (_jsxs("div", { className: "grid gap-1", children: [label && _jsxs("span", { className: "flex justify-between", children: [_jsx("span", { children: label }), _jsx(Money, { value: value, className: "font-semibold" })] }), _jsx("div", { role: "img", "aria-label": `${Math.round(r * 100)} percent`, className: "h-2.5 overflow-hidden rounded-full bg-primary-soft", children: _jsx("div", { className: `grow-x h-full origin-left rounded-full ${tone}`, style: { transform: `scaleX(${r})` } }) })] }));
}
const stages = [['Planned', 'var(--color-peri)'], ['Sourcing', 'var(--color-primary)'], ['Awarded', 'var(--color-accent)']];
/** Funnel: each level is how many packages reached that stage or beyond. */
export function Funnel({ planned, sourcing, awarded }) {
    const counts = [planned, sourcing, awarded];
    const reach = [planned + sourcing + awarded, sourcing + awarded, awarded];
    const w = (n) => Math.max((n / (reach[0] || 1)) * 220, 16);
    const levels = [...reach.map(w), w(reach[2]) * 0.6];
    return (_jsxs("div", { className: "grid gap-4", children: [_jsx("svg", { viewBox: "0 0 240 128", role: "img", "aria-label": `${planned} planned, ${sourcing} in sourcing, ${awarded} awarded`, className: "w-full", children: stages.map(([name, fill], i) => {
                    const [a, b, y] = [levels[i] / 2, levels[i + 1] / 2, i * 43 + 2];
                    return _jsx("polygon", { className: "rise", style: { ['--i']: i + 2 }, fill: fill, points: `${120 - a},${y} ${120 + a},${y} ${120 + b},${y + 40} ${120 - b},${y + 40}` }, name);
                }) }), _jsx("ul", { className: "grid gap-1", children: stages.map(([name, fill], i) => (_jsxs("li", { className: "flex items-center gap-2", children: [_jsx("span", { "aria-hidden": true, className: "size-3 rounded-sm", style: { background: fill } }), _jsx("span", { className: "flex-1", children: name }), _jsx(Num, { value: counts[i], animate: true, className: "font-semibold" })] }, name))) })] }));
}
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const rest = 'rotateX(9deg) rotateY(-15deg)';
/** Tilted two-layer preview of the award view, built from the same dashboard data. Leans toward the pointer. */
export function Preview({ d }) {
    const tilt = useRef(null);
    const lean = (e) => {
        if (reduced() || !tilt.current)
            return;
        const r = e.currentTarget.getBoundingClientRect();
        const [x, y] = [(e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5];
        tilt.current.style.transform = `rotateX(${9 - y * 12}deg) rotateY(${-15 + x * 16}deg)`;
    };
    const top = [...d.budget].sort((a, b) => b.committed - a.committed).slice(0, 3);
    return (_jsx("div", { "aria-hidden": true, className: "h-64 [perspective:1100px]", onPointerMove: lean, onPointerLeave: () => tilt.current && (tilt.current.style.transform = rest), children: _jsxs("div", { ref: tilt, className: "relative h-full transition-transform duration-300 ease-out [transform-style:preserve-3d]", style: { transform: rest }, children: [_jsxs("div", { className: "absolute inset-x-6 top-0 grid gap-3 rounded-card border border-white/25 bg-white/10 p-4 backdrop-blur-md [transform:translateZ(-50px)_translate(34px,-14px)]", children: [_jsx("span", { className: "font-semibold text-on-hero-soft", children: "Budget committed" }), top.map(b => (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "font-code w-20 text-on-hero-soft", children: b.costCode }), _jsx("div", { className: "h-2 flex-1 overflow-hidden rounded-full bg-white/20", children: _jsx("div", { className: "h-full origin-left rounded-full bg-accent", style: { transform: `scaleX(${b.committed / b.budget})` } }) })] }, b.costCode)))] }), _jsxs("div", { className: "absolute inset-x-0 bottom-0 grid gap-3 rounded-card bg-card p-5 text-ink shadow-e3 [transform:translateZ(40px)]", children: [_jsx("span", { className: "font-semibold", children: "Latest award" }), _jsx(Bar, { value: d.savings.baseline, max: d.savings.baseline, tone: "bg-peri" }), _jsx(Bar, { value: d.savings.awarded, max: d.savings.baseline, tone: "bg-primary" }), _jsxs("span", { className: "flex justify-between", children: [_jsx("span", { className: "text-ink-soft", children: "Saved" }), _jsx(Money, { value: d.savings.saved, className: "text-section font-semibold text-success" })] })] })] }) }));
}
