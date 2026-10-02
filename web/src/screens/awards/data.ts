import { useQuery } from '@tanstack/react-query';
import type { Allocation, Award } from '@satishjag/procurement-core/types';
import { call, getUser } from '../../api';

// Shapes of the engine results this screen reads (reporting.twin, reporting.history, evaluation.results). Nothing is computed here.
export type Node = { id: string; kind: string; label: string; status?: string; value?: number; meta?: Record<string, string | number> };
export type Twin = { nodes: Node[]; edges: { from: string; to: string; kind: string }[]; activity: unknown[] };
export type Row = { seq: number; at: string; actor: string; action: string; entity: string; data: Record<string, any>; prev: string; hash: string };
export type Scenario = { id: string; label: string; allocations: Allocation[]; value: number; deviation: boolean };
export type Results = {
  technical: { supplierId: string; score: number; qualified: boolean; flags: string[] }[];
  normalized: { supplierId: string; currency: string; submitted: number; total: number; lots: Record<string, number>; adjustments: string[]; anomalies: string[] }[];
  ranking: { supplierId: string; technical: number; commercial: number; combined: number; total: number }[];
  sensitivity: { from: number; to: number; winner: string }[];
  scenarios: Scenario[];
};
export type Step = { role: string; reason?: string; decision?: 'approved' | 'rejected'; by?: string; at?: string; comment?: string };

// ponytail: the sample people, copied from sample/seed.ts, because there is no users endpoint. Replace with a users command or the Entra session.
const PEOPLE: Record<string, [string, string]> = {
  'u-omar': ['Omar Siddiqui', 'requester'], 'u-priya': ['Priya Raman', 'buyer'], 'u-daniel': ['Daniel Okafor', 'procurement_manager'],
  'u-hana': ['Hana Kobayashi', 'technical_evaluator'], 'u-tom': ['Tom Weller', 'commercial_evaluator'], 'u-fatima': ['Fatima Al Mansoori', 'budget_owner'],
  'u-rashid': ['Rashid Khan', 'executive'], 'u-grace': ['Grace Lindqvist', 'auditor'],
};
export const who = (id?: string) => (id && PEOPLE[id]?.[0]) || id || 'Unknown';
export const holder = (role: string) => Object.values(PEOPLE).find(p => p[1] === role)?.[0];
export const words = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
export const stamp = (iso: string) => iso.replace('T', ' ').slice(0, 16);

export const useTwin = () => useQuery({ queryKey: ['twin', getUser()], queryFn: () => call<Twin>('reporting', 'twin') });
export const useResults = (eventId?: string) => useQuery({ queryKey: ['results', getUser(), eventId], enabled: !!eventId, queryFn: () => call<Results>('evaluation', 'results', eventId) });
/** Only managers, auditors and admins may read an entity's trail; other roles get the engine's refusal. */
export const useHistory = (id: string) => useQuery({ queryKey: ['history', getUser(), id], queryFn: () => call<Row[]>('reporting', 'history', id) });
export const useActions = (id: string) => useQuery({ queryKey: ['actions', getUser(), 'awards', id], queryFn: () => call<string[]>('awards', 'actions', id) });

/** Is it my turn, and if not, why not, in the engine's words. `awards.decide` rejects with the role, segregation and sequence checks
 * before it reads the reason, and a reject with no reason always throws before any change, so this is a dry run that cannot mutate.
 * ponytail: replace with a read-only `awards.check` command; the "needs a reason" message is the engine's way of saying "you may act". */
export const useTurn = (id: string, pending: boolean, stamp: string) => useQuery({
  queryKey: ['turn', getUser(), id, stamp], enabled: pending,
  queryFn: async () => {
    try { await call('awards', 'decide', id, 'rejected', ''); return { mine: false, why: '' }; } catch (e) {
      const m = (e as Error).message;
      return m === 'A rejection needs a reason' ? { mine: true, why: '' } : { mine: false, why: m };
    }
  },
});

/** Awards the screen has seen in full (recommend and decide return the whole award, reasons included); history alone only has roles.
 * ponytail: session memory, replace with an `awards.get` command. */
export const known = new Map<string, Award>();

export const linked = (t: Twin, kind: string, from?: string, to?: string) =>
  t.edges.filter(e => e.kind === kind && (from ? e.from === from : e.to === to)).map(e => t.nodes.find(n => n.id === (from ? e.to : e.from))).filter((n): n is Node => !!n);

/** The route as steps: the engine's own award when known, with decisions from the audit trail (fresher) layered on top. */
export function stepsOf(rows: Row[] | undefined, award?: Award): Step[] | undefined {
  const rec = rows?.find(r => r.action === 'award.recommended');
  if (!rec) return award?.steps;
  const done = rows!.filter(r => r.action === 'award.decision');
  return (rec.data.route as string[]).map((role, i) => ({
    role, reason: award?.steps[i]?.reason,
    ...(done[i] ? { decision: done[i].data.decision, by: done[i].actor, at: done[i].at, comment: done[i].data.comment } : {}),
  }));
}
