import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, useEffect, useState, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
// Only the weights in use, latin subset, served from the bundle (no third-party font requests).
import '@fontsource/ibm-plex-sans/latin-300.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-condensed/latin-400.css';
import '@fontsource/ibm-plex-sans-condensed/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './styles/app.css';
import { AppShell, type NavItem } from './ui/AppShell';
import { Dashboard } from './screens/dashboard/Dashboard';
import { Awards } from './screens/awards/Awards';
import { Evaluation } from './screens/evaluation/Evaluation';
import { Intake } from './screens/intake/Intake';
import { Sourcing } from './screens/sourcing/Sourcing';
import { Suppliers } from './screens/suppliers/Suppliers';
import { Payables } from './screens/payables/Payables';
import { Workflows } from './screens/workflows/Workflows';

const nav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/intake', label: 'Intake', icon: 'intake' },
  { to: '/sourcing', label: 'Sourcing', icon: 'sourcing' },
  { to: '/evaluation', label: 'Evaluation', icon: 'evaluation' },
  { to: '/awards', label: 'Awards', icon: 'awards' },
  { to: '/suppliers', label: 'Suppliers', icon: 'suppliers' },
  { to: '/payables', label: 'Payables', icon: 'payables' },
  { to: '/workflows', label: 'Workflows', icon: 'workflows', group: 'Administration' },
];
const screens: Record<string, ComponentType> = { '/': Dashboard, '/intake': Intake, '/sourcing': Sourcing, '/evaluation': Evaluation, '/awards': Awards, '/suppliers': Suppliers, '/payables': Payables, '/workflows': Workflows };

const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
const path = () => location.hash.slice(1) || '/';

function App() {
  const [route, setRoute] = useState(path());
  useEffect(() => { const f = () => setRoute(path()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  const Screen = screens[route] ?? Dashboard;
  return <AppShell nav={nav} route={screens[route] ? route : '/'}><Screen /></AppShell>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={client}><App /></QueryClientProvider></StrictMode>);
