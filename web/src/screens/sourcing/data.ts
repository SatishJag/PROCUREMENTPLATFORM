import { useQuery } from '@tanstack/react-query';
import { call, getUser } from '../../api';
import type { Tone } from '../../ui/StatusChip';

// Shapes of what the engine returns (reporting.twin, reporting.history, suppliers.search, sourcing.portal). Nothing is computed here.
export type TwinNode = { id: string; kind: string; label: string; status?: string; value?: number; health?: string; meta?: Record<string, string | number> };
export type Twin = { nodes: TwinNode[]; edges: { from: string; to: string; kind: string }[]; activity: { at: string; type: string; ref: string; actor: string }[] };
export type Audit = { seq: number; at: string; actor: string; action: string; entity: string; data: Record<string, unknown>; hash: string };
export type Criterion = { id: string; name: string; weight: number; gate?: boolean };
export type Lot = { id: string; name: string };
export type BoqLine = { id: string; lotId: string; item: string; unit: string; qty: number };
export type Found = { id: string; name: string; performance: number; risk: string; eligible: boolean; blockers: string[]; warnings: string[] };
export type Portal = {
  id: string; title: string; type: string; status: string; closesAt: string; lots: Lot[]; boq: BoqLine[];
  clarifications: { question: string; answer: string; extendedTo?: string }[];
  myBid: null | { id: string; currency: string; lines: unknown[]; exclusions: unknown[]; deviations: string[]; version: number; submittedAt: string }; // prices are never rendered
};
export type Setup = { title?: string; lots: Lot[]; boq: BoqLine[]; criteria: Criterion[]; techWeight: number; techThreshold: number; quorum: number; blind: boolean; evaluators: string[]; invite: string[]; closesAt: string };
export type Created = Setup & { id: string }; // sourcing.create returns the whole event
export type EventRow = { id: string; title: string; status: string; type: string; bids?: number; pkg?: TwinNode; invited: TwinNode[]; award?: TwinNode };

// The sourcing lifecycle in order (engine: eventFlow). Labels are presentation only.
export const STAGES: [string, string][] = [['draft', 'Draft'], ['open', 'Open for bids'], ['closed', 'Closed'], ['technical', 'Technical'], ['commercial', 'Commercial'], ['approval', 'Approval'], ['awarded', 'Awarded']];
export const stageLabel = (s: string) => STAGES.find(x => x[0] === s)?.[1] ?? s;
export const stageTone = (s: string): Tone => (s === 'open' ? 'success' : s === 'awarded' ? 'success' : s === 'draft' ? 'neutral' : 'warning');

export const when = (iso?: string) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : '');
/** Browser datetime-local value to the engine's ISO form (UTC, same shape as the sample data). */
export const toIso = (local: string) => (local ? `${local}:00Z` : '');

export const useTwin = () => useQuery({ queryKey: ['twin', getUser()], queryFn: () => call<Twin>('reporting', 'twin') });
/** The audit trail of one entity: managers, auditors and admins only, so a refusal is expected for other roles. */
export const useHistory = (id?: string) => useQuery({ queryKey: ['history', getUser(), id], enabled: !!id, queryFn: () => call<Audit[]>('reporting', 'history', id) });

export function eventsOf(t: Twin): EventRow[] {
  const node = (id: string) => t.nodes.find(n => n.id === id);
  return t.nodes.filter(n => n.kind === 'event').map(n => ({
    id: n.id, title: n.label, status: n.status ?? 'draft', type: String(n.meta?.type ?? ''), bids: typeof n.meta?.bids === 'number' ? n.meta.bids : undefined,
    pkg: node(t.edges.find(e => e.to === n.id && e.kind === 'package-event')?.from ?? ''),
    invited: t.edges.filter(e => e.from === n.id && e.kind === 'event-supplier').map(e => node(e.to)!).filter(Boolean),
    award: node(t.edges.find(e => e.from === n.id && e.kind === 'event-award')?.to ?? ''),
  }));
}
export const plannedPackages = (t: Twin) => t.nodes.filter(n => n.kind === 'package' && n.status === 'planned');
export const projectOfPackage = (t: Twin, id: string) => t.edges.find(e => e.to === id && e.kind === 'budget-package')?.from.split(':')[0] ?? '';

/** Facts the audit trail holds about an event, for the roles that may read it. */
export function facts(h: Audit[] = []) {
  const created = h.find(x => x.action === 'event.created')?.data as undefined | { invited?: string[]; criteria?: Criterion[]; techWeight?: number };
  const published = h.find(x => x.action === 'event.published')?.data as undefined | { closesAt?: string };
  const asked = h.filter(x => x.action === 'clarification.asked').map(x => x.data as { id: string; question: string });
  const done = h.filter(x => x.action === 'clarification.answered' || x.action === 'addendum.issued').map(x => x.data as { clarificationId: string; extendTo?: string });
  const closesAt = [...done].reverse().find(d => d.extendTo)?.extendTo ?? published?.closesAt;
  return {
    created, closesAt, seals: h.filter(x => x.action === 'bid.submitted').map(x => ({ at: x.at, ...(x.data as { version: number; seal: string }) })),
    clarifications: asked.map(a => ({ ...a, answered: done.some(d => d.clarificationId === a.id), extendTo: done.find(d => d.clarificationId === a.id)?.extendTo })),
  };
}

export const money = (n: number) => n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
