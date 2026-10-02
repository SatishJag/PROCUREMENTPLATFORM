import type { Tone } from '../../ui/StatusChip';
import type { Package, Requisition } from '@satishjag/procurement-core/types';

// Slices of reporting.dashboard that Intake reads (the full shape lives with the Dashboard screen).
export type Budget = { project: string; costCode: string; budget: number; committed: number; available: number };
export type Dash = { budget: Budget[]; myApprovals: { type: 'requisition' | 'award'; id: string; value: number }[] };

/** One requisition in this session. `req` is missing for items that only came from the dashboard queue: the engine has no read command for a requisition. */
export type Entry = { id: string; value: number; req?: Requisition; pkg?: Package; reason?: string };

type Verdict = { category: string; confidence: number; evidence: string[] };
/** insight.classifyRequisition: `source` is "engine" when AI is off (then only `engine` and `notice` come back) or "ai". */
export type Second = { source: 'engine' | 'ai'; notice?: string; model?: string; engine: Verdict; ai?: Verdict & { rationale: string }; agrees?: boolean };

export const health = { on_track: ['success', 'On track'], at_risk: ['warning', 'At risk'], late: ['danger', 'Late'] } as const;
export const decided: Record<string, readonly [Tone, string]> = { submitted: ['neutral', 'Awaiting budget owner'], approved: ['success', 'Approved'], rejected: ['danger', 'Rejected'] };
