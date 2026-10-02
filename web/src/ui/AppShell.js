import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getUser, setUser } from '../api';
// ponytail: the sample users, copied from sample/seed.ts. Replace with the signed-in session (Entra ID) or a users command.
const USERS = [
    ['u-omar', 'Omar Siddiqui', 'Requester'], ['u-priya', 'Priya Raman', 'Buyer'], ['u-daniel', 'Daniel Okafor', 'Procurement manager'],
    ['u-hana', 'Hana Kobayashi', 'Technical evaluator'], ['u-tom', 'Tom Weller', 'Commercial evaluator'], ['u-fatima', 'Fatima Al Mansoori', 'Budget owner'],
    ['u-rashid', 'Rashid Khan', 'Executive'], ['u-grace', 'Grace Lindqvist', 'Auditor'], ['u-falcon', 'Falcon bid desk', 'Supplier'],
];
const icons = {
    dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
    intake: 'M4 13l2-8h12l2 8v6H4zM4 13h5l1 2h4l1-2h5',
    sourcing: 'M3 5h18l-7 8v6l-4 2v-8z',
    evaluation: 'M12 3v18M5 7h14M5 7l-3 7a3 3 0 006 0zM19 7l-3 7a3 3 0 006 0z',
    awards: 'M12 14a6 6 0 100-12 6 6 0 000 12zM8.5 13L7 22l5-3 5 3-1.5-9',
    suppliers: 'M4 21V7l8-4 8 4v14M9 21v-6h6v6M9 10h.01M15 10h.01',
};
const Icon = ({ name }) => (_jsx("svg", { "aria-hidden": true, viewBox: "0 0 24 24", className: "size-5 shrink-0", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: icons[name] }) }));
function NavLink({ item, active }) {
    const cls = `flex h-11 items-center gap-3 whitespace-nowrap rounded-ctl px-3 font-medium transition-transform duration-150 active:scale-[0.97] ${active ? 'bg-white/14 text-white' : 'text-on-hero-soft hover:bg-white/10 hover:text-white'}`;
    return item.soon
        ? _jsxs("span", { "aria-disabled": "true", title: "Screen not built yet", className: `${cls} cursor-not-allowed opacity-60`, children: [_jsx(Icon, { name: item.icon }), item.label] })
        : _jsxs("a", { href: `#${item.to}`, "aria-current": active ? 'page' : undefined, className: cls, children: [_jsx(Icon, { name: item.icon }), item.label, active && _jsx("span", { "aria-hidden": true, className: "ml-auto size-2 rounded-full bg-accent" })] });
}
export function AppShell({ nav, route, children }) {
    const qc = useQueryClient();
    const [uid, setUid] = useState(getUser());
    const user = USERS.find(u => u[0] === uid) ?? USERS[2];
    return (_jsxs("div", { className: "canvas min-h-dvh", children: [_jsxs("aside", { className: "on-dark fixed inset-y-0 left-0 z-20 hidden w-64 flex-col gap-1 bg-hero p-4 lg:flex", style: { background: 'linear-gradient(180deg, #2d2a7a, #1b1858)' }, children: [_jsxs("div", { className: "mb-6 flex items-center gap-3 px-2 pt-2 text-white", children: [_jsx("span", { "aria-hidden": true, className: "grid size-9 place-items-center rounded-ctl bg-accent font-bold text-on-accent", children: "P" }), _jsx("span", { className: "text-section font-semibold tracking-tight", children: "Procurement" })] }), _jsx("nav", { "aria-label": "Modules", className: "grid gap-1", children: nav.map(n => _jsx(NavLink, { item: n, active: n.to === route }, n.to)) }), _jsx("p", { className: "mt-auto px-3 text-on-hero-soft", children: "Sample data, project DC1" })] }), _jsxs("div", { className: "lg:pl-64", children: [_jsxs("div", { className: "mx-auto flex max-w-[84rem] items-center justify-between gap-3 px-4 pt-4 md:px-8", children: [_jsx("span", { className: "text-section font-semibold tracking-tight lg:invisible", children: "Procurement" }), _jsx("label", { className: "flex min-w-0 items-center gap-3", children: _jsx("select", { "aria-label": "Signed in as", value: uid, onChange: e => { setUser(e.target.value); setUid(e.target.value); qc.resetQueries(); }, className: "h-11 w-full max-w-[16rem] min-w-0 rounded-ctl border-2 border-control bg-card px-3 font-medium shadow-e1 hover:border-primary md:h-10 md:max-w-none md:w-auto", children: USERS.map(([id, name, role]) => _jsxs("option", { value: id, children: [name, " (", role, ")"] }, id)) }) })] }), _jsx("nav", { "aria-label": "Modules", className: "on-dark mx-4 mt-3 flex gap-1 overflow-x-auto rounded-card bg-hero p-1 lg:hidden", children: nav.map(n => _jsx(NavLink, { item: n, active: n.to === route }, n.to)) }), _jsx("main", { className: "mx-auto max-w-[84rem] px-4 pb-28 pt-4 md:px-8 lg:pb-12", children: children }, route)] })] }));
}
