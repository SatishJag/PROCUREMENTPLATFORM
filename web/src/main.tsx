import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, useEffect, useState, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import { AppShell, type NavItem } from './ui/AppShell';
import { Dashboard } from './screens/dashboard/Dashboard';

// Module screen instances: build the screen, then replace `soon` with its component in `screens`.
const nav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/intake', label: 'Intake', icon: 'intake', soon: true },
  { to: '/sourcing', label: 'Sourcing', icon: 'sourcing', soon: true },
  { to: '/evaluation', label: 'Evaluation', icon: 'evaluation', soon: true },
  { to: '/awards', label: 'Awards', icon: 'awards', soon: true },
  { to: '/suppliers', label: 'Suppliers', icon: 'suppliers', soon: true },
];
const screens: Record<string, ComponentType> = { '/': Dashboard };

const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
const path = () => location.hash.slice(1) || '/';

function App() {
  const [route, setRoute] = useState(path());
  useEffect(() => { const f = () => setRoute(path()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  const Screen = screens[route] ?? Dashboard;
  return <AppShell nav={nav} route={screens[route] ? route : '/'}><Screen /></AppShell>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={client}><App /></QueryClientProvider></StrictMode>);
