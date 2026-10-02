import { useQuery } from '@tanstack/react-query';
import type { Supplier } from '@satishjag/procurement-core/types';
import { call, getUser } from '../../api';

// The engine has no "list suppliers" read, so the directory is composed from three reads it does have:
// reporting.twin (profile: status, risk, country, categories), suppliers.search per category (performance and eligibility reasons)
// and reporting.dashboard (documents expiring or expired). Each source may refuse a role; the screen shows what remains.
// ponytail: swap for one suppliers.list / suppliers.get command when the engine adds it.
type TwinNode = { id: string; kind: string; label: string; status?: Supplier['status']; meta?: Record<string, string | number> };
type Hit = { id: string; name: string; performance: number; risk: Supplier['risk']; eligible: boolean; blockers: string[]; warnings: string[] };
export type DocFlag = { supplier: string; doc: string; expires: string; expired: boolean };

export type Sup = {
  id: string; name: string; status: Supplier['status']; risk: Supplier['risk']; country?: string; categories: string[];
  performance?: number; sanctioned?: boolean; missing: string[]; flags: DocFlag[];
  elig: { category: string; eligible: boolean; blockers: string[]; warnings: string[] }[];
};
export type Directory = { suppliers: Sup[]; categories: string[]; flags: DocFlag[]; notes: string[] };

const settle = <T,>(p: Promise<T>) => p.then(v => ({ v, e: '' }), (e: Error) => ({ v: undefined as T | undefined, e: e.message }));
const uniq = (xs: string[]) => [...new Set(xs)];

export async function loadDirectory(): Promise<Directory> {
  const [twin, dash] = await Promise.all([
    settle(call<{ nodes: TwinNode[] }>('reporting', 'twin')),
    settle(call<{ expiringDocs: DocFlag[] }>('reporting', 'dashboard')),
  ]);
  if (!twin.v) throw new Error(twin.e);
  const nodes = twin.v.nodes;
  const sup = nodes.filter(n => n.kind === 'supplier');
  // ponytail: the twin joins categories with ', '; fine while no category name contains a comma.
  const categories = uniq([...sup.flatMap(n => String(n.meta?.category ?? '').split(', ')), ...nodes.filter(n => n.kind === 'package').map(n => String(n.meta?.category ?? ''))].filter(Boolean)).sort();
  const searches = await Promise.all(categories.map(async c => ({ c, ...(await settle(call<Hit[]>('suppliers', 'search', c))) })));
  const flags = dash.v?.expiringDocs ?? [];
  const byId = new Map<string, Sup>();
  const get = (id: string, name: string): Sup => {
    if (!byId.has(id)) byId.set(id, { id, name, status: 'qualified', risk: 'low', categories: [], missing: [], flags: flags.filter(f => f.supplier === name), elig: [] });
    return byId.get(id)!;
  };
  for (const n of sup) {
    const s = get(n.id, n.label);
    s.status = n.status ?? s.status; s.risk = (n.meta?.risk as Sup['risk']) ?? s.risk; s.country = String(n.meta?.country ?? ''); s.categories = String(n.meta?.category ?? '').split(', ').filter(Boolean);
  }
  const twinIds = new Set(sup.map(n => n.id));
  for (const { c, v } of searches) for (const h of v ?? []) {
    const s = get(h.id, h.name);
    s.performance = h.performance; s.risk = h.risk; s.elig.push({ category: c, eligible: h.eligible, blockers: h.blockers, warnings: h.warnings });
    if (!s.categories.includes(c)) s.categories.push(c);
    // The engine states these as sentences; read them verbatim, never recompute them.
    if (h.blockers.includes('Sanctions screening hit')) s.sanctioned = true; else s.sanctioned ??= false;
    for (const b of h.blockers) {
      const st = /^Supplier status is (\w+)$/.exec(b)?.[1]; if (st && !twinIds.has(h.id)) s.status = st as Sup['status'];
      const m = /^Missing (\w+)$/.exec(b)?.[1]; if (m && !s.missing.includes(m)) s.missing.push(m);
    }
  }
  const notes = uniq(searches.filter(s => s.e).map(s => s.e));
  return { suppliers: [...byId.values()].sort((a, b) => a.name.localeCompare(b.name)), categories, flags, notes };
}

export const useDirectory = () => useQuery({ queryKey: ['suppliers-directory', getUser()], queryFn: loadDirectory });

export type Audit = { seq: number; at: string; actor: string; action: string; hash: string; data: { note?: string } };
export const useHistory = (id: string) => useQuery({ queryKey: ['supplier-history', getUser(), id], queryFn: () => call<Audit[]>('reporting', 'history', id) });

export const words = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
export const alerts = (s: Sup) => s.flags.length + s.missing.length;
