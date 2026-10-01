import type { Allocation, Bid, Criterion, SourcingEvent } from './types.ts';

// The evaluation engine: technical consensus, commercial normalization,
// combined ranking, weight sensitivity and award scenarios. Pure functions.

export const SCORE_MAX = 10;
const SPREAD_LIMIT = 3;           // max points between evaluators before consensus moderation
const OUTLIER_RATE = 0.4;         // unit rate ±40% from the median of all bidders
const LOW_BID = 0.8;              // total under 80% of the median total
const NEAR_IDENTICAL = 0.005;     // totals within 0.5% of each other

// ponytail: money as 2dp floats rounded per line. Move to integer fils if it ever feeds a ledger.
const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toLocaleString('en', { maximumFractionDigits: 2 });
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const alias = (ev: SourcingEvent, supplierId: string) =>
  `Bidder ${String.fromCharCode(65 + ev.bids.findIndex(b => b.supplierId === supplierId))}`;

export function validateCriteria(criteria: Criterion[]) {
  if (criteria.some(c => !c.gate && !(c.weight > 0))) throw new Error('Every scored criterion needs a positive weight');
  const total = criteria.filter(c => !c.gate).reduce((s, c) => s + c.weight, 0);
  if (Math.abs(total - 100) > 1e-9) throw new Error(`Scored criteria weights must total 100 (got ${total})`);
}

export interface TechResult {
  supplierId: string;
  score: number;            // 0..100 weighted
  complete: boolean;
  gatesPassed: boolean;
  qualified: boolean;       // complete, gates passed, above threshold
  flags: string[];          // anything blocking sign-off of the technical envelope
  consensus: Record<string, number>;
}

export function technical(ev: SourcingEvent): TechResult[] {
  return ev.bids.map(({ supplierId }) => {
    const flags: string[] = [];
    const consensus: Record<string, number> = {};
    let score = 0, complete = true, gatesPassed = true;
    for (const c of ev.criteria) {
      const marks = ev.scores.filter(s =>
        s.supplierId === supplierId && s.criterionId === c.id && !ev.declarations[s.evaluatorId]?.includes(supplierId));
      const moderated = ev.moderations.find(m => m.supplierId === supplierId && m.criterionId === c.id);
      if (!moderated) {
        if (marks.length < ev.quorum) {
          complete = false;
          flags.push(`${c.name}: ${marks.length} of ${ev.quorum} scores in`);
          continue;
        }
        const values = marks.map(m => m.score);
        const split = c.gate ? new Set(values).size > 1 : Math.max(...values) - Math.min(...values) > SPREAD_LIMIT;
        if (split) flags.push(`${c.name}: evaluators disagree (${values.join(', ')}), moderate to consensus`);
        for (const m of marks) {
          const needsWhy = c.gate ? m.score === 0 : m.score <= 2 || m.score >= 9;
          if (needsWhy && !m.comment?.trim()) flags.push(`${c.name}: score ${m.score} by ${m.evaluatorId} needs evidence`);
        }
      }
      const value = moderated?.score ?? median(marks.map(m => m.score));
      consensus[c.id] = value;
      if (c.gate) gatesPassed &&= value >= 1;
      else score += (value / SCORE_MAX) * c.weight;
    }
    score = r2(score);
    return { supplierId, score, complete, gatesPassed, qualified: complete && gatesPassed && score >= ev.techThreshold, flags, consensus };
  });
}

export interface Normalized {
  supplierId: string;
  currency: string;
  submitted: number;              // as stated, bid currency
  total: number;                  // normalized, AED
  lots: Record<string, number>;   // normalized, AED
  adjustments: string[];
  anomalies: string[];
}

// Like-for-like pricing: arithmetic correction, FX to AED, scope-gap loading,
// exclusion add-backs, then outlier and collusion-risk indicators.
export function normalize(ev: SourcingEvent, fx: Record<string, number>): Normalized[] {
  const toAED = (b: Bid) => {
    if (!fx[b.currency]) throw new Error(`No FX rate for ${b.currency}`);
    return fx[b.currency];
  };
  const rates = new Map(ev.boq.map(line => [line.id, ev.bids.flatMap(b => {
    const l = b.lines.find(x => x.lineId === line.id);
    return l && l.rate > 0 ? [{ supplierId: b.supplierId, rate: l.rate * toAED(b) }] : [];
  })]));

  const out = ev.bids.map((b): Normalized => {
    const fxr = toAED(b);
    const adjustments: string[] = [];
    const anomalies: string[] = [];
    const lots: Record<string, number> = Object.fromEntries(ev.lots.map(l => [l.id, 0]));
    let submitted = 0;
    for (const line of ev.boq) {
      const priced = b.lines.find(l => l.lineId === line.id);
      submitted += priced?.amount ?? 0;
      const lineRates = rates.get(line.id)!;
      let aed: number;
      if (priced && priced.rate > 0) {
        const correct = r2(priced.rate * line.qty);
        if (Math.abs(correct - priced.amount) >= 0.01) {
          adjustments.push(`${line.item}: arithmetic corrected ${fmt(priced.amount)} → ${fmt(correct)} ${b.currency} (rate governs)`);
        }
        aed = correct * fxr;
        if (lineRates.length >= 3) {
          const dev = (priced.rate * fxr) / median(lineRates.map(x => x.rate)) - 1;
          if (Math.abs(dev) > OUTLIER_RATE) anomalies.push(`${line.item}: unit rate ${dev > 0 ? '+' : ''}${Math.round(dev * 100)}% vs median`);
        }
      } else {
        const competing = lineRates.filter(x => x.supplierId !== b.supplierId).map(x => x.rate);
        aed = competing.length ? Math.max(...competing) * line.qty : 0;
        adjustments.push(competing.length
          ? `${line.item}: not priced, loaded at highest competing rate (+AED ${fmt(aed)})`
          : `${line.item}: priced by no bidder, cannot load`);
      }
      lots[line.lotId] += aed;
    }
    for (const x of b.exclusions) {
      if (x.addBack === undefined) anomalies.push(`Exclusion "${x.description}": add-back not yet priced`);
      else {
        lots[x.lotId] += x.addBack;
        adjustments.push(`Exclusion "${x.description}": add-back AED ${fmt(x.addBack)}`);
      }
    }
    for (const k in lots) lots[k] = r2(lots[k]);
    const total = r2(Object.values(lots).reduce((s, v) => s + v, 0));
    return { supplierId: b.supplierId, currency: b.currency, submitted: r2(submitted), total, lots, adjustments, anomalies };
  });

  const mid = median(out.map(n => n.total));
  for (const n of out) {
    if (out.length >= 3 && n.total < mid * LOW_BID) n.anomalies.push(`Total ${Math.round((1 - n.total / mid) * 100)}% below median: abnormally low`);
    for (const o of out) {
      if (o !== n && Math.abs(o.total - n.total) / mid <= NEAR_IDENTICAL) n.anomalies.push(`Total within 0.5% of ${o.supplierId}: collusion-risk indicator`);
    }
  }
  return out;
}

export interface Ranked { supplierId: string; technical: number; commercial: number; combined: number; total: number }

// Commercial score = lowest compliant price / this price × 100, only for technically qualified bids.
export function rank(tech: TechResult[], norm: Normalized[], techWeight: number): Ranked[] {
  const pool = tech.filter(t => t.qualified).map(t => ({ t, n: norm.find(n => n.supplierId === t.supplierId)! }));
  const lowest = Math.min(...pool.map(p => p.n.total));
  return pool
    .map(({ t, n }) => {
      const commercial = r2((lowest / n.total) * 100);
      return { supplierId: t.supplierId, technical: t.score, commercial, combined: r2(techWeight * t.score + (1 - techWeight) * commercial), total: n.total };
    })
    .sort((a, b) => b.combined - a.combined || a.total - b.total);
}

// Which bidder wins across the full range of technical weightings (5% steps).
export function sensitivity(tech: TechResult[], norm: Normalized[]) {
  const bands: { from: number; to: number; winner: string }[] = [];
  for (let w = 0; w <= 100; w += 5) {
    const winner = rank(tech, norm, w / 100)[0]?.supplierId;
    if (!winner) break;
    const last = bands.at(-1);
    if (last?.winner === winner) last.to = w;
    else bands.push({ from: w, to: w, winner });
  }
  return bands;
}

export interface Scenario { id: string; label: string; allocations: Allocation[]; value: number; deviation: boolean }

export function scenarios(ev: SourcingEvent, ranking: Ranked[], norm: Normalized[]): Scenario[] {
  if (!ranking.length) return [];
  const allLots = ev.lots.map(l => l.id);
  const single = (supplierId: string): Allocation[] =>
    [{ supplierId, lotIds: allLots, value: norm.find(n => n.supplierId === supplierId)!.total }];
  const qualified = norm.filter(n => ranking.some(r => r.supplierId === n.supplierId));
  const split = new Map<string, Allocation>();
  for (const lot of allLots) {
    const best = qualified.reduce((a, b) => (b.lots[lot] < a.lots[lot] ? b : a));
    const a = split.get(best.supplierId) ?? { supplierId: best.supplierId, lotIds: [], value: 0 };
    a.lotIds.push(lot);
    a.value = r2(a.value + best.lots[lot]);
    split.set(best.supplierId, a);
  }
  const cheapest = [...ranking].sort((a, b) => a.total - b.total)[0].supplierId;
  const candidates = [
    { id: 'best_value', label: 'Best value, single award', allocations: single(ranking[0].supplierId) },
    { id: 'lowest_price', label: 'Lowest compliant price, single award', allocations: single(cheapest) },
    { id: 'split_by_lot', label: 'Split award, lowest compliant price per lot', allocations: [...split.values()] },
  ];
  const seen = new Set<string>();
  return candidates
    .filter(c => {
      const key = JSON.stringify(c.allocations.map(a => [a.supplierId, a.lotIds]));
      return !seen.has(key) && seen.add(key);
    })
    .map(c => ({
      ...c,
      value: r2(c.allocations.reduce((s, a) => s + a.value, 0)),
      deviation: c.allocations.some(a => a.supplierId !== ranking[0].supplierId),
    }));
}

export function evaluate(ev: SourcingEvent, fx: Record<string, number>) {
  const tech = technical(ev);
  const norm = normalize(ev, fx);
  const ranking = rank(tech, norm, ev.techWeight);
  return { technical: tech, normalized: norm, ranking, sensitivity: sensitivity(tech, norm), scenarios: scenarios(ev, ranking, norm) };
}
