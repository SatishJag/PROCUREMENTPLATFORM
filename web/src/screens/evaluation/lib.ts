// Shapes of what evaluation.* and reporting.twin return (core modules/evaluation.ts). The browser only reads and formats them.
export type Crit = { id: string; name: string; weight: number; gate?: boolean };
export type Pack = { criteria: Crit[]; bidders: { ref: string; name: string; deviations: string[]; exclusions: string[] }[] };
export type Tech = { supplierId: string; score: number; complete: boolean; gatesPassed: boolean; qualified: boolean; flags: string[]; consensus: Record<string, number> };
export type Norm = { supplierId: string; currency: string; submitted: number; total: number; lots: Record<string, number>; adjustments: string[]; anomalies: string[] };
export type Ranked = { supplierId: string; technical: number; commercial: number; combined: number; total: number };
export type Alloc = { supplierId: string; lotIds: string[]; value: number };
export type Scenario = { id: string; label: string; allocations: Alloc[]; value: number; deviation: boolean };
export type Results = { technical: Tech[]; normalized: Norm[]; ranking: Ranked[]; sensitivity: { from: number; to: number; winner: string }[]; scenarios: Scenario[] };
export type TwinNode = { id: string; kind: string; label: string; status?: string; meta?: Record<string, unknown> };

export type Insight =
  | { source: 'engine'; notice: string; engine: Results }
  | {
    source: 'ai'; id: string; model: string; inputHash: string; summary: string; internalOnly: true; dropped: number; scenarioNotes: string[];
    risks: { severity: 'low' | 'medium' | 'high'; supplierId: string; text: string; evidenceRef: string }[];
    engineAnomalies: { ref: string; supplierId: string; text: string }[]; uncitedAnomalies: string[];
  };

export const letter = (i: number) => String.fromCharCode(65 + i);
// ponytail: the engine's alias is "Bidder " + letter of the bid's position; results come back in that order. Display only.
export const aliasAt = (i: number) => `Bidder ${letter(i)}`;
/** One colour per bidder (tokens --color-series-1..6, defined with the stage tokens); identity is also carried by the letter and name, never colour alone. */
export const series = (i: number) => `var(--color-series-${(i % 6) + 1})`;
export const ON_SERIES = 'var(--color-on-series)';

export const n2 = (v: number) => v.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const mil = (v: number) => `${(v / 1e6).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`;

/** The ranking blends technical and commercial by the event's weighting, which the engine does not return; read it back from one row. */
export function weighting(r: Ranked[]) {
  const row = r.find(x => Math.abs(x.technical - x.commercial) > 1);
  return row ? Math.round(((row.commercial - row.combined) / (row.commercial - row.technical)) * 100) : undefined;
}

export const lines = (e: string) => e.split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2));
/** "Bidder A: Delivery programme: evaluators disagree (5, 6, 9), moderate to consensus" */
export function blocker(l: string) {
  const m = l.match(/^(.+?): (.+?): (.+)$/);
  const kind = !m ? 'other' : /\d+ of \d+ scores in/.test(m[3]) ? 'missing' : /disagree/.test(m[3]) ? 'disagree' : /evidence/.test(m[3]) ? 'evidence' : 'other';
  return { bidder: m?.[1] ?? '', criterion: m?.[2] ?? '', msg: m?.[3] ?? l, kind, raw: l };
}
export type Blocker = ReturnType<typeof blocker>;

export const short = (n: string) => n.split(' ').slice(0, 2).join(' ');
