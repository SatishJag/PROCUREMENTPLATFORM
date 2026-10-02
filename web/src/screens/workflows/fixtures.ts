// Sample configuration for the Workflow Console. UI only: nothing here is read from, or written to, the engine.
// People and limits are the fictional DC1 seed (sample/seed.ts). The Award bands and the Sourcing route bands are the engine's real ones.

export const DEMO_TODAY = '2026-10-02';
export const CEILING = 100_000_000; // the highest approval limit in the sample (Rashid Khan); bands with no upper bound are checked against it

export type Role = { id: string; label: string; limit: number | null };
export const ROLES: Role[] = [
  { id: 'procurement_manager', label: 'Procurement manager', limit: 500_000 },
  { id: 'budget_owner', label: 'Budget owner', limit: 5_000_000 },
  { id: 'legal', label: 'Legal counsel', limit: null },
  { id: 'executive', label: 'Executive', limit: CEILING },
  { id: 'buyer', label: 'Buyer', limit: null },
  { id: 'technical_evaluator', label: 'Technical evaluator', limit: null },
  { id: 'commercial_evaluator', label: 'Commercial evaluator', limit: null },
];
export type Person = { id: string; name: string; roles: string[]; designation: string; limit: number | null };
export const PEOPLE: Person[] = [
  { id: 'u-omar', name: 'Omar Siddiqui', roles: ['requester'], designation: 'Site Engineer', limit: null },
  { id: 'u-priya', name: 'Priya Raman', roles: ['buyer'], designation: 'Senior Buyer', limit: null },
  { id: 'u-daniel', name: 'Daniel Okafor', roles: ['procurement_manager'], designation: 'Head of Procurement', limit: 500_000 },
  { id: 'u-fatima', name: 'Fatima Al Mansoori', roles: ['budget_owner'], designation: 'Finance Lead, DC1', limit: 5_000_000 },
  { id: 'u-rashid', name: 'Rashid Khan', roles: ['executive'], designation: 'Managing Director', limit: CEILING },
  { id: 'u-hana', name: 'Hana Kobayashi', roles: ['technical_evaluator'], designation: 'Mechanical Engineer', limit: null },
  { id: 'u-marco', name: 'Marco Bianchi', roles: ['technical_evaluator'], designation: 'Electrical Engineer', limit: null },
  { id: 'u-aisha', name: 'Aisha Rahman', roles: ['technical_evaluator'], designation: 'Controls Engineer', limit: null },
  { id: 'u-tom', name: 'Tom Weller', roles: ['commercial_evaluator'], designation: 'Commercial Analyst', limit: null },
];
export const DESIGNATIONS = ['Head of Procurement', 'Finance Lead, DC1', 'Managing Director', 'Senior Buyer'];
export const GROUPS: { id: string; label: string; people: string[] }[] = [
  { id: 'technical_panel', label: 'Technical evaluation panel', people: ['u-hana', 'u-marco', 'u-aisha'] },
  { id: 'compliance_desk', label: 'Supplier compliance desk', people: ['u-priya'] },
];
export const CATEGORIES = ['Generators', 'Mechanical / Cooling', 'Electrical / UPS', 'Electrical / MV Switchgear', 'IT / Structured Cabling', 'Professional services'];
export const PROJECTS = ['DC1', 'DC2 (sample)'];
export const COUNTRIES = ['AE', 'SA', 'DE', 'US'];

export type ApproverKind = 'role' | 'person' | 'designation' | 'line_manager' | 'group';
export const KINDS: [ApproverKind, string][] = [['role', 'Role'], ['person', 'Named person'], ['designation', 'Designation'], ['line_manager', 'Line manager'], ['group', 'Group']];

export type Stage = {
  id: string; name: string;
  approver: { kind: ApproverKind; value: string };
  parallelWithPrev: boolean; quorum: 'any' | 'all';
  limit: number | null; // overrides the approver's own authority limit
  slaHours: number; escalateTo: string; escalateAfter: number; // escalateTo: a role id, '' for none
  delegateTo: string; // person id used when the approver is out of office
  email: boolean; inApp: boolean;
  forms: string[]; fields: string[]; validations: string[]; badges: string[];
};
export type Rule = {
  id: string; name: string; enabled: boolean; effect: 'set' | 'add'; // set: the first matching rule picks the chain. add: every matching rule adds tiers.
  min: number; max: number | null; // amount band, exclusive lower bound (0 includes zero), inclusive upper bound
  person: string; designation: string; project: string; category: string; country: string; // '' means any
  overBudget: boolean; deviation: boolean; chain: string[]; // stage ids
};
export type Kind = 'approval' | 'review' | 'route'; // approval: authority limits apply. review: no amounts. route: one branch is chosen, not a chain.
export type Workflow = { id: string; name: string; kind: Kind; summary: string; owner: string; version: number; effective: string; edited: string; editedBy: string; stages: Stage[]; rules: Rule[] };
export type Version = { v: number; effective: string; by: string; at: string; reason: string; snapshot?: Workflow };
export type Entry = { published: Workflow | null; draft: Workflow | null; history: Version[] };
export type LogItem = { at: string; who: string; wf: string; text: string; reason: string };
export type Delegation = { id: string; from: string; to: string; start: string; end: string; scope: string };
export type NoticeRow = { id: string; event: string; email: boolean; inApp: boolean; to: string; subject: string };
export type Store = { entries: Record<string, Entry>; log: LogItem[]; delegations: Delegation[]; notices: NoticeRow[] };

const stage = (id: string, name: string, kind: ApproverKind, value: string, o: Partial<Stage> = {}): Stage => ({
  id, name, approver: { kind, value }, parallelWithPrev: false, quorum: 'any', limit: null, slaHours: 24, escalateTo: '', escalateAfter: 24,
  delegateTo: '', email: true, inApp: true, forms: [], fields: [], validations: [], badges: [], ...o,
});
const rule = (id: string, name: string, chain: string[], o: Partial<Rule> = {}): Rule => ({
  id, name, enabled: true, effect: 'set', min: 0, max: null, person: '', designation: '', project: '', category: '', country: '', overBudget: false, deviation: false, chain, ...o,
});
const wf = (id: string, name: string, kind: Kind, owner: string, version: number, effective: string, edited: string, editedBy: string, summary: string, stages: Stage[], rules: Rule[]): Workflow =>
  ({ id, name, kind, summary, owner, version, effective, edited, editedBy, stages, rules });

const award = wf('award', 'Award approval', 'approval', 'Daniel Okafor', 3, '2026-03-01', '2026-09-18', 'Daniel Okafor', 'Delegation of authority for award recommendations, by value, budget position and ranking.', [
  stage('pm', 'Procurement manager review', 'role', 'procurement_manager', { escalateTo: 'budget_owner', forms: ['Award recommendation report', 'Evaluation summary'], fields: ['Recommended supplier'], validations: ['Scenario saved before approval'] }),
  stage('bo', 'Budget owner approval', 'role', 'budget_owner', { slaHours: 48, escalateTo: 'executive', escalateAfter: 48, validations: ['Value within committed budget'] }),
  stage('exec', 'Executive approval', 'role', 'executive', { slaHours: 72, forms: ['Award report'], validations: ['Deviation reason recorded when ranking is overridden'] }),
], [
  rule('r1', 'Up to AED 500,000', ['pm'], { max: 500_000 }),
  rule('r2', 'AED 500,000 to 5,000,000', ['pm', 'bo'], { min: 500_000, max: 5_000_000 }),
  rule('r3', 'Above AED 5,000,000', ['pm', 'bo', 'exec'], { min: 5_000_000 }),
  rule('r4', 'Over budget adds the budget owner', ['bo'], { effect: 'add', overBudget: true }),
  rule('r5', 'Deviation from best-value ranking adds the executive', ['exec'], { effect: 'add', deviation: true }),
]);
const awardDraft: Workflow = {
  ...structuredClone(award), version: 4, edited: '2026-10-01', editedBy: 'Daniel Okafor',
  stages: [award.stages[0], { ...award.stages[1], slaHours: 36 }, stage('legal', 'Legal review', 'role', 'legal', { slaHours: 48, escalateTo: 'executive', escalateAfter: 48, forms: ['Draft terms review'] }), award.stages[2]],
  rules: [...award.rules, rule('r6', 'Professional services need legal review', ['legal'], { effect: 'add', category: 'Professional services' })],
};
const awardOld = (cut: number): Workflow => ({ ...structuredClone(award), version: cut === 3_000_000 ? 2 : 1, rules: award.rules.map(r => r.id === 'r2' ? { ...r, max: cut, name: 'AED 500,000 to 3,000,000' } : r.id === 'r3' ? { ...r, min: cut, name: 'Above AED 3,000,000' } : r) });

const sourcing = wf('sourcing', 'Sourcing route selection', 'route', 'Daniel Okafor', 4, '2026-02-01', '2026-08-30', 'Daniel Okafor', 'Picks the sourcing method, bidder count and envelopes from the package value and category.', [
  stage('direct', 'Direct PO', 'role', 'buyer', { slaHours: 0, badges: ['1 bidder'] }),
  stage('rfq', 'RFQ', 'role', 'buyer', { slaHours: 0, parallelWithPrev: true, badges: ['3 bidders', '1 envelope'] }),
  stage('rfp', 'RFP', 'role', 'buyer', { slaHours: 0, parallelWithPrev: true, badges: ['3 bidders', '2 envelopes'] }),
  stage('itt', 'ITT', 'role', 'buyer', { slaHours: 0, parallelWithPrev: true, badges: ['4 bidders', '2 envelopes'] }),
], [
  rule('r1', 'Professional services: quality-based selection (RFP)', ['rfp'], { category: 'Professional services' }),
  rule('r2', 'Up to AED 50,000', ['direct'], { max: 50_000 }),
  rule('r3', 'AED 50,000 to 500,000', ['rfq'], { min: 50_000, max: 500_000 }),
  rule('r4', 'AED 500,000 to 5,000,000', ['rfp'], { min: 500_000, max: 5_000_000 }),
  rule('r5', 'Above AED 5,000,000', ['itt'], { min: 5_000_000 }),
]);

const requisition = wf('requisition', 'Requisition approval', 'approval', 'Fatima Al Mansoori', 5, '2026-06-01', '2026-05-20', 'Fatima Al Mansoori', 'Who must approve a requisition before it becomes a sourcing package.', [
  stage('lm', 'Line manager review', 'line_manager', 'requester', { escalateTo: 'budget_owner' }),
  stage('bo', 'Budget owner approval', 'role', 'budget_owner', { slaHours: 48, escalateTo: 'executive', escalateAfter: 48 }),
  stage('pm', 'Procurement manager approval', 'role', 'procurement_manager', { escalateTo: 'budget_owner' }),
  stage('exec', 'Executive approval', 'role', 'executive', { slaHours: 72 }),
], [
  rule('r1', 'Up to AED 250,000', ['lm', 'bo'], { max: 250_000 }),
  rule('r2', 'AED 250,000 to 5,000,000', ['lm', 'bo', 'pm'], { min: 250_000, max: 5_000_000 }),
  rule('r3', 'Above AED 5,000,000', ['lm', 'bo', 'exec'], { min: 5_000_000 }),
  rule('r4', 'Over budget adds the executive', ['exec'], { effect: 'add', overBudget: true }),
]);

const supplier = wf('supplier', 'Supplier qualification', 'review', 'Priya Raman', 2, '2026-02-10', '2026-02-02', 'Priya Raman', 'Checks a supplier before it may be invited to bid. Technical review is parallel to financial standing.', [
  stage('cmp', 'Compliance check', 'group', 'compliance_desk', { slaHours: 48, escalateTo: 'procurement_manager', escalateAfter: 48, forms: ['Trade licence', 'Insurance certificate', 'Tax registration'], validations: ['Sanctions screening clear', 'Documents in date'] }),
  stage('tech', 'Technical capability review', 'group', 'technical_panel', { slaHours: 72, escalateTo: 'procurement_manager', escalateAfter: 72, quorum: 'all', forms: ['Capability statement'] }),
  stage('fin', 'Financial standing review', 'role', 'commercial_evaluator', { slaHours: 72, parallelWithPrev: true, escalateTo: 'procurement_manager', escalateAfter: 72, forms: ['Audited accounts'] }),
  stage('pm', 'Approval to qualify', 'role', 'procurement_manager', { slaHours: 24 }),
], [
  rule('r1', 'Critical categories need technical review', ['cmp', 'tech', 'fin', 'pm'], { category: 'Electrical / MV Switchgear' }),
  rule('r2', 'Mechanical and cooling need technical review', ['cmp', 'tech', 'fin', 'pm'], { category: 'Mechanical / Cooling' }),
  rule('r3', 'All other categories', ['cmp', 'fin', 'pm']),
]);

const contract = wf('contract', 'Contract approval', 'approval', 'Daniel Okafor', 3, '2026-04-15', '2026-07-04', 'Rashid Khan', 'Approval of a drafted contract before signature, with legal review first.', [
  stage('legal', 'Legal review', 'role', 'legal', { slaHours: 72, escalateTo: 'executive', escalateAfter: 72, forms: ['Draft contract', 'Redline summary'] }),
  stage('pm', 'Procurement manager approval', 'role', 'procurement_manager', { escalateTo: 'budget_owner' }),
  stage('bo', 'Budget owner approval', 'role', 'budget_owner', { slaHours: 48, escalateTo: 'executive', escalateAfter: 48 }),
  stage('exec', 'Executive approval', 'role', 'executive', { slaHours: 72 }),
], [
  rule('r1', 'Up to AED 500,000', ['legal', 'pm'], { max: 500_000 }),
  rule('r2', 'AED 500,000 to 5,000,000', ['legal', 'pm', 'bo'], { min: 500_000, max: 5_000_000 }),
  rule('r3', 'Above AED 5,000,000', ['legal', 'pm', 'bo', 'exec'], { min: 5_000_000 }),
]);
const contractDraft: Workflow = {
  ...structuredClone(contract), version: 4, edited: '2026-10-01', editedBy: 'Daniel Okafor',
  stages: contract.stages.map(s => s.id === 'legal' ? { ...s, slaHours: 48 } : s),
  rules: contract.rules.map(r => r.id === 'r2' ? { ...r, min: 450_000, name: 'AED 450,000 to 5,000,000' } : r),
};

const variation = wf('variation', 'Variation order approval', 'approval', 'Fatima Al Mansoori', 1, '', '2026-09-29', 'Fatima Al Mansoori', 'Approval of changes to an awarded contract. New, not yet published.', [
  stage('pm', 'Procurement manager review', 'role', 'procurement_manager', { escalateTo: 'budget_owner', forms: ['Variation request', 'Cost impact'] }),
  stage('bo', 'Budget owner approval', 'role', 'budget_owner', { slaHours: 48, escalateTo: 'executive', escalateAfter: 48 }),
  stage('exec', 'Executive approval', 'role', 'executive', { slaHours: 72 }),
], [
  rule('r1', 'Up to AED 100,000', ['pm'], { max: 100_000 }),
  rule('r2', 'AED 100,000 to 1,000,000', ['pm', 'bo'], { min: 100_000, max: 1_000_000 }),
  rule('r3', 'Above AED 1,000,000', ['pm', 'bo', 'exec'], { min: 1_000_000 }),
]);

const ver = (v: number, effective: string, by: string, at: string, reason: string, snapshot?: Workflow): Version => ({ v, effective, by, at, reason, snapshot });
const pub = (w: Workflow, h: Version[], d: Workflow | null = null): Entry => ({ published: w, draft: d, history: h });

export const seed = (): Store => structuredClone({
  entries: {
    requisition: pub(requisition, [ver(5, '2026-06-01', 'Fatima Al Mansoori', '2026-05-20', 'Add the over-budget executive step', requisition), ver(4, '2025-11-01', 'Fatima Al Mansoori', '2025-10-24', 'Raise the first band to AED 250,000')]),
    sourcing: pub(sourcing, [ver(4, '2026-02-01', 'Daniel Okafor', '2026-01-22', 'Quality-based selection for professional services', sourcing), ver(3, '2025-09-01', 'Daniel Okafor', '2025-08-18', 'Add the ITT route above AED 5,000,000')]),
    award: pub(award, [ver(3, '2026-03-01', 'Daniel Okafor', '2026-02-20', 'Deviation from ranking adds the executive', award), ver(2, '2025-12-01', 'Rashid Khan', '2025-11-20', 'Earlier band at AED 3,000,000', awardOld(3_000_000)), ver(1, '2025-06-01', 'Rashid Khan', '2025-05-15', 'First release', awardOld(2_000_000))], awardDraft),
    supplier: pub(supplier, [ver(2, '2026-02-10', 'Priya Raman', '2026-02-02', 'Parallel technical and financial review', supplier), ver(1, '2025-06-01', 'Priya Raman', '2025-05-12', 'First release')]),
    contract: pub(contract, [ver(3, '2026-04-15', 'Daniel Okafor', '2026-04-02', 'Legal review moves to the first step', contract), ver(2, '2025-10-01', 'Daniel Okafor', '2025-09-14', 'Add executive tier')], contractDraft),
    variation: { published: null, draft: variation, history: [] },
  },
  log: [
    { at: '2026-10-01', who: 'Daniel Okafor', wf: 'Award approval', text: 'Draft v4 saved: legal review stage and a professional services rule', reason: 'Legal asked to see all consultancy awards' },
    { at: '2026-10-01', who: 'Daniel Okafor', wf: 'Contract approval', text: 'Draft v4 saved: legal SLA 72 to 48 hours, second band starts at AED 450,000', reason: 'Align with the new contract SLA' },
    { at: '2026-09-29', who: 'Fatima Al Mansoori', wf: 'Variation order approval', text: 'Draft v1 created', reason: 'Variations were approved by email' },
    { at: '2026-05-20', who: 'Fatima Al Mansoori', wf: 'Requisition approval', text: 'Published v5', reason: 'Add the over-budget executive step' },
    { at: '2026-02-20', who: 'Daniel Okafor', wf: 'Award approval', text: 'Published v3', reason: 'Deviation from ranking adds the executive' },
  ],
  delegations: [
    { id: 'd1', from: 'u-fatima', to: 'u-daniel', start: '2026-10-12', end: '2026-10-23', scope: 'Award approval, Requisition approval' },
    { id: 'd2', from: 'u-rashid', to: 'u-fatima', start: '2026-11-02', end: '2026-11-13', scope: 'All approval workflows' },
  ],
  notices: [
    { id: 'n1', event: 'Task assigned', email: true, inApp: true, to: 'Approver', subject: 'Action needed: {request} awaits your decision' },
    { id: 'n2', event: 'Reminder at 75% of the SLA', email: true, inApp: true, to: 'Approver', subject: 'Reminder: {request} is due in {hours} hours' },
    { id: 'n3', event: 'SLA breached, escalated', email: true, inApp: true, to: 'Escalation target and process owner', subject: 'Escalated: {request} passed its SLA at {stage}' },
    { id: 'n4', event: 'Approved', email: false, inApp: true, to: 'Requester', subject: '{request} was approved by {approver}' },
    { id: 'n5', event: 'Rejected, with reason', email: true, inApp: true, to: 'Requester and process owner', subject: '{request} was rejected: {reason}' },
  ],
});

export const aed = (n: number) => `AED ${n.toLocaleString('en')}`;
