import { daysBetween } from './planning.ts';
import type { Supplier } from './types.ts';

export const REQUIRED_DOCS = ['trade_licence', 'insurance', 'tax_certificate'];
const EXPIRY_WARNING_DAYS = 30;

// Can this supplier be invited to a sourcing event in this category today?
export function eligibility(s: Supplier, category: string, today: string) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (s.sanctioned) blockers.push('Sanctions screening hit');
  if (s.status !== 'qualified') blockers.push(`Supplier status is ${s.status}`);
  if (!s.categories.includes(category)) blockers.push(`Not qualified for ${category}`);
  for (const type of REQUIRED_DOCS) {
    const doc = s.docs.find(d => d.type === type);
    if (!doc) blockers.push(`Missing ${type}`);
    else if (doc.expires < today) blockers.push(`${type} expired ${doc.expires}`);
    else if (daysBetween(today, doc.expires) <= EXPIRY_WARNING_DAYS) warnings.push(`${type} expires ${doc.expires}`);
  }
  if (s.risk === 'high') warnings.push('High risk rating: mitigation plan required');
  return { eligible: blockers.length === 0, blockers, warnings };
}

// Supplier discovery: everyone in the category, eligible first, then by performance.
export function discover(suppliers: Supplier[], category: string, today: string) {
  return suppliers
    .filter(s => s.categories.includes(category))
    .map(s => ({ id: s.id, name: s.name, performance: s.performance, risk: s.risk, ...eligibility(s, category, today) }))
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.performance - a.performance);
}
