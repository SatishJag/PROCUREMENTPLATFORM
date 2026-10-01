import type { ApprovalStep, Award, Role, User } from './types.ts';

// Delegation-of-authority matrix (AED). First band that covers the value wins.
export const DOA: { upTo: number; chain: Role[] }[] = [
  { upTo: 500_000, chain: ['procurement_manager'] },
  { upTo: 5_000_000, chain: ['procurement_manager', 'budget_owner'] },
  { upTo: Infinity, chain: ['procurement_manager', 'budget_owner', 'executive'] },
];
const ORDER: Role[] = ['procurement_manager', 'budget_owner', 'legal', 'executive'];

// Conditional routing on value, budget position and deviation from the recommendation.
export function routeApproval(value: number, { overBudget = false, deviation = false } = {}): ApprovalStep[] {
  const band = DOA.find(d => value <= d.upTo)!;
  const steps: ApprovalStep[] = band.chain.map(role => ({ role, reason: `Authority matrix: AED ${value.toLocaleString('en')}` }));
  const add = (role: Role, reason: string) => {
    const step = steps.find(s => s.role === role);
    if (step) step.reason += `; ${reason}`;
    else steps.push({ role, reason });
  };
  if (overBudget) add('budget_owner', 'Exceeds available budget');
  if (deviation) add('executive', 'Deviates from best-value ranking');
  return steps.sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role));
}

// Sequential approval with segregation of duties and authority limits.
export function decide(
  award: Award, user: User, decision: 'approved' | 'rejected', comment: string, at: string,
  conflicted: string[], // requester, evaluators: may not approve their own outcome
) {
  if (award.status !== 'pending') throw new Error(`Award is already ${award.status}`);
  const step = award.steps.find(s => !s.decision)!;
  if (!user.roles.includes(step.role)) throw new Error(`Awaiting ${step.role}, not ${user.name}`);
  if (conflicted.includes(user.id) || award.recommendedBy === user.id || award.steps.some(s => s.by === user.id)) {
    throw new Error(`Segregation of duties: ${user.name} cannot approve this award`);
  }
  const last = step === award.steps.at(-1);
  if (decision === 'approved' && last && (user.approvalLimit ?? 0) < award.value) {
    throw new Error(`${user.name}'s authority limit is below AED ${award.value.toLocaleString('en')}`);
  }
  if (decision === 'rejected' && !comment.trim()) throw new Error('A rejection needs a reason');
  Object.assign(step, { decision, by: user.id, at, comment });
  award.status = decision === 'rejected' ? 'rejected' : last ? 'approved' : 'pending';
  return award;
}
