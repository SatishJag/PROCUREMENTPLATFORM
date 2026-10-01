import type { BudgetCheck, Project, Recommendation, Route } from './types.ts';

// Category taxonomy with typical manufacturing + delivery lead times (weeks).
// ponytail: keyword classifier. Swap for an LLM classifier later; keep the
// { category, confidence, evidence } output so callers do not change.
export const CATEGORIES = [
  { name: 'Electrical / Generators', leadWeeks: 52, keywords: ['generator', 'generators', 'genset', 'gensets', 'diesel', 'standby power'] },
  { name: 'Mechanical / Cooling', leadWeeks: 40, keywords: ['chiller', 'chillers', 'crah', 'cooling', 'hvac', 'air handling'] },
  { name: 'Electrical / MV Switchgear', leadWeeks: 36, keywords: ['switchgear', 'rmu', 'transformer', 'transformers', 'mv panel'] },
  { name: 'Electrical / UPS', leadWeeks: 26, keywords: ['ups', 'battery', 'batteries', 'uninterruptible'] },
  { name: 'IT / Structured Cabling', leadWeeks: 10, keywords: ['cabling', 'fibre', 'fiber', 'rack', 'racks', 'containment'] },
  { name: 'Civil Works', leadWeeks: 6, keywords: ['concrete', 'excavation', 'rebar', 'civil', 'foundation', 'foundations'] },
  { name: 'Professional Services', leadWeeks: 2, services: true, keywords: ['consultant', 'consultancy', 'design', 'survey', 'advisory', 'commissioning agent'] },
];
const GENERAL = { name: 'General', leadWeeks: 4, services: false, keywords: [] as string[] };

// Procurement route by value (AED). First match wins. Admin-configurable.
export const ROUTES: { upTo: number; route: Route; minBidders: number; envelopes: 1 | 2 }[] = [
  { upTo: 50_000, route: 'Direct PO', minBidders: 1, envelopes: 1 },
  { upTo: 500_000, route: 'RFQ', minBidders: 3, envelopes: 1 },
  { upTo: 5_000_000, route: 'RFP', minBidders: 3, envelopes: 2 },
  { upTo: Infinity, route: 'ITT', minBidders: 4, envelopes: 2 },
];
const LONG_LEAD_WEEKS = 26;

export function classify(text: string) {
  const hits = CATEGORIES.map(c => ({
    c,
    evidence: c.keywords.filter(k => new RegExp(`\\b${k}\\b`, 'i').test(text)),
  })).sort((a, b) => b.evidence.length - a.evidence.length);
  const best = hits[0];
  const total = hits.reduce((s, h) => s + h.evidence.length, 0);
  if (!best.evidence.length) return { category: GENERAL, confidence: 0, evidence: [] };
  // Two distinct keyword hits with no competing category = full confidence.
  const confidence = Math.min(1, best.evidence.length / 2) * (best.evidence.length / total);
  return { category: best.c, confidence: Math.round(confidence * 100) / 100, evidence: best.evidence.map(k => `matched "${k}"`) };
}

export function recommend(text: string, amount: number): Recommendation {
  const { category, confidence, evidence } = classify(text);
  let rule = ROUTES.find(r => amount <= r.upTo)!;
  const reasons = [`Value AED ${amount.toLocaleString('en')} falls in the ${rule.route} band`];
  if (category.services && rule.envelopes === 1 && amount > ROUTES[0].upTo) {
    rule = ROUTES.find(r => r.route === 'RFP')!;
    reasons.push('Professional services use quality-based selection (RFP)');
  }
  const longLead = category.leadWeeks >= LONG_LEAD_WEEKS;
  if (longLead) reasons.push(`Long-lead category (${category.leadWeeks} weeks): prequalify and plan backwards from need date`);
  return {
    category: category.name,
    confidence,
    evidence,
    route: rule.route,
    minBidders: rule.minBidders,
    envelopes: rule.envelopes,
    prequal: rule.route === 'ITT' || longLead,
    longLead,
    leadTimeWeeks: category.leadWeeks,
    reasons,
  };
}

export function checkBudget(project: Project, costCode: string, amount: number): BudgetCheck {
  const budget = project.budgets[costCode];
  if (budget === undefined) throw new Error(`Cost code ${costCode} is not in ${project.name}'s budget`);
  const committed = project.committed[costCode] ?? 0;
  const available = budget - committed;
  return { ok: amount <= available, budget, committed, available, shortfall: Math.max(0, amount - available) };
}
