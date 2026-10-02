import { jsx as _jsx } from "react/jsx-runtime";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import { AppShell } from './ui/AppShell';
import { Dashboard } from './screens/dashboard/Dashboard';
// Module screen instances: build the screen, then replace `soon` with its component in `screens`.
const nav = [
    { to: '/', label: 'Dashboard', icon: 'dashboard' },
    { to: '/intake', label: 'Intake', icon: 'intake', soon: true },
    { to: '/sourcing', label: 'Sourcing', icon: 'sourcing', soon: true },
    { to: '/evaluation', label: 'Evaluation', icon: 'evaluation', soon: true },
    { to: '/awards', label: 'Awards', icon: 'awards', soon: true },
    { to: '/suppliers', label: 'Suppliers', icon: 'suppliers', soon: true },
];
const screens = { '/': Dashboard };
const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
const path = () => location.hash.slice(1) || '/';
function App() {
    const [route, setRoute] = useState(path());
    useEffect(() => { const f = () => setRoute(path()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
    const Screen = screens[route] ?? Dashboard;
    return _jsx(AppShell, { nav: nav, route: screens[route] ? route : '/', children: _jsx(Screen, {}) });
}
createRoot(document.getElementById('root')).render(_jsx(StrictMode, { children: _jsx(QueryClientProvider, { client: client, children: _jsx(App, {}) }) }));
