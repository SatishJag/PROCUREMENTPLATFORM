import { decide, routeApproval } from './approvals.ts';
import { AuditLog, sha256 } from './audit.ts';
import { parseCsv, toCsv } from './csv.ts';
import { alias, evaluate, SCORE_MAX, technical, validateCriteria } from './evaluation.ts';
import { checkBudget, recommend, ROUTES } from './intake.ts';
import { daysBetween, health, schedule } from './planning.ts';
import { eligibility, REQUIRED_DOCS } from './suppliers.ts';
import type {
  Award, BidLine, BoqLine, Contract, Criterion, Exclusion, Lot, Package, Project, Requisition,
  Role, SourcingEvent, Supplier, SupplierDoc, User,
} from './types.ts';
import { flows, guard, next } from './workflow.ts';

export interface Seed { users: User[]; projects: Project[]; suppliers: Supplier[]; packages: Package[]; fx: Record<string, number> }

const APPROVERS: Role[] = ['procurement_manager', 'budget_owner', 'legal', 'executive'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Milestones still ahead of a package given how far it has got.
const remaining = (p: Package) => {
  const award = p.schedule.milestones.findIndex(m => m.name === 'Award');
  return p.schedule.milestones.slice(p.status === 'planned' ? 0 : p.status === 'sourcing' ? award : award + 1);
};

export function boqFromCsv(text: string): BoqLine[] {
  return parseCsv(text).map((r, i) => {
    const qty = Number(r.qty);
    if (!r.lot || !r.item || !(qty > 0)) throw new Error(`BOQ row ${i + 2}: needs lot, item and a positive qty`);
    return { id: r.id || `L${i + 1}`, lotId: r.lot, item: r.item, unit: r.unit || 'nr', qty };
  });
}

// One service object = one auditable Source-to-Contract workflow. Every command
// checks role/project scope, moves the state machine, and writes the audit chain.
// ponytail: in-memory store. Swap the Maps for Postgres when the API layer lands; command signatures stay.
export class Platform {
  users: Map<string, User>;
  projects: Map<string, Project>;
  suppliers: Map<string, Supplier>;
  packages: Map<string, Package>;
  requisitions = new Map<string, Requisition>();
  events = new Map<string, SourcingEvent>();
  awards = new Map<string, Award>();
  contracts = new Map<string, Contract>();
  fx: Record<string, number>;
  audit = new AuditLog();
  clock: () => string;
  #seq = 0;

  constructor(seed: Seed, clock = () => new Date().toISOString()) {
    const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map(x => [x.id, structuredClone(x)]));
    this.users = byId(seed.users);
    this.projects = byId(seed.projects);
    this.suppliers = byId(seed.suppliers);
    this.packages = byId(seed.packages);
    this.fx = seed.fx;
    this.clock = clock;
  }

  get today() { return this.clock().slice(0, 10); }

  // ---------- Guided intake → requisition → package ----------

  intake(user: User, input: { projectId: string; costCode: string; title: string; description: string; amount: number; needBy: string }) {
    guard(user, ['requester', 'buyer'], { projectId: input.projectId });
    if (!(input.amount > 0)) throw new Error('Amount must be positive');
    if (!ISO_DATE.test(input.needBy) || input.needBy <= this.today) throw new Error('Need-by must be a future YYYY-MM-DD date');
    const project = this.#get(this.projects, input.projectId, 'Project');
    const recommendation = recommend(`${input.title} ${input.description}`, input.amount);
    const req: Requisition = {
      ...input,
      id: this.#id('PR'),
      requesterId: user.id,
      status: next(flows.requisition, 'draft', 'submit', user),
      recommendation,
      budget: checkBudget(project, input.costCode, input.amount),
      schedule: schedule(input.needBy, recommendation.route, recommendation.leadTimeWeeks, recommendation.prequal, this.today),
    };
    this.requisitions.set(req.id, req);
    this.#log(user, 'requisition.submitted', req.id, { amount: req.amount, category: recommendation.category, route: recommendation.route });
    return req;
  }

  decideRequisition(user: User, id: string, decision: 'approve' | 'reject', reason = '') {
    const req = this.#get(this.requisitions, id, 'Requisition');
    guard(user, ['budget_owner'], { projectId: req.projectId });
    if (user.id === req.requesterId) throw new Error('Segregation of duties: cannot approve your own requisition');
    if (decision === 'reject' && !reason.trim()) throw new Error('A rejection needs a reason');
    if (decision === 'approve') {
      req.budget = checkBudget(this.#get(this.projects, req.projectId, 'Project'), req.costCode, req.amount);
      if (!req.budget.ok) throw new Error(`Budget shortfall of AED ${req.budget.shortfall.toLocaleString('en')}: raise a budget transfer first`);
    }
    req.status = next(flows.requisition, req.status, decision, user);
    this.#log(user, `requisition.${req.status}`, req.id, { reason });
    if (decision === 'reject') return { requisition: req };
    const r = req.recommendation;
    const pkg: Package = {
      id: this.#id('PKG'), requisitionId: req.id, requesterId: req.requesterId, projectId: req.projectId, costCode: req.costCode,
      title: req.title, category: r.category, estimate: req.amount, needBy: req.needBy, route: r.route, longLead: r.longLead,
      schedule: req.schedule, status: 'planned',
    };
    this.packages.set(pkg.id, pkg);
    this.#log(user, 'package.created', pkg.id, { requisition: req.id, route: pkg.route, longLead: pkg.longLead });
    return { requisition: req, package: pkg };
  }

  // ---------- Supplier onboarding and qualification ----------

  registerSupplier(user: User, docs: SupplierDoc[]) {
    const s = this.#get(this.suppliers, user.supplierId ?? '', 'Supplier');
    s.status = next(flows.supplier, s.status, 'register', user) as Supplier['status'];
    s.docs = docs;
    this.#log(user, 'supplier.registered', s.id, { docs: docs.map(d => d.type) });
    return s;
  }

  qualifySupplier(user: User, supplierId: string, action: 'qualify' | 'reject' | 'suspend' | 'reinstate', note = '') {
    const s = this.#get(this.suppliers, supplierId, 'Supplier');
    if (action === 'qualify') {
      const missing = REQUIRED_DOCS.filter(t => !s.docs.some(d => d.type === t && d.expires >= this.today));
      if (missing.length) throw new Error(`Cannot qualify: missing or expired ${missing.join(', ')}`);
    }
    s.status = next(flows.supplier, s.status, action, user) as Supplier['status'];
    this.#log(user, `supplier.${s.status}`, s.id, { note });
    return s;
  }

  // ---------- Sourcing events (RFQ / RFP / ITT) ----------

  createEvent(user: User, packageId: string, setup: {
    title?: string; lots: Lot[]; boq: BoqLine[]; criteria: Criterion[]; techWeight: number; techThreshold: number;
    quorum: number; blind?: boolean; evaluators: string[]; invite: string[]; closesAt: string;
  }) {
    const pkg = this.#get(this.packages, packageId, 'Package');
    guard(user, ['buyer'], { projectId: pkg.projectId });
    if (pkg.status !== 'planned') throw new Error(`Package is already ${pkg.status}`);
    validateCriteria(setup.criteria);
    if (!(setup.techWeight >= 0 && setup.techWeight <= 1)) throw new Error('Technical weight must be between 0 and 1');
    if (!setup.boq.length || setup.boq.some(l => !setup.lots.some(lot => lot.id === l.lotId) || !(l.qty > 0))) {
      throw new Error('Every BOQ line needs a known lot and a positive quantity');
    }
    if (setup.evaluators.some(id => !this.users.get(id)?.roles.includes('technical_evaluator'))) throw new Error('Evaluators must hold the technical evaluator role');
    if (setup.evaluators.length < setup.quorum) throw new Error('Committee is smaller than the quorum');
    if (new Set(setup.invite).size !== setup.invite.length) throw new Error('Duplicate invitees');
    const blocked = setup.invite
      .map(id => ({ id, ...eligibility(this.#get(this.suppliers, id, 'Supplier'), pkg.category, this.today) }))
      .filter(e => !e.eligible);
    if (blocked.length) throw new Error(`Ineligible bidders: ${blocked.map(b => `${b.id} (${b.blockers.join('; ')})`).join(', ')}`);
    const { minBidders } = ROUTES.find(r => r.route === pkg.route)!;
    if (setup.invite.length < minBidders) throw new Error(`${pkg.route} needs at least ${minBidders} eligible bidders`);

    const ev: SourcingEvent = {
      id: this.#id('EV'), packageId, type: pkg.route, title: setup.title ?? pkg.title, status: 'draft',
      lots: setup.lots, boq: setup.boq, criteria: setup.criteria, techWeight: setup.techWeight, techThreshold: setup.techThreshold,
      quorum: setup.quorum, blind: setup.blind ?? false, evaluators: setup.evaluators, invited: setup.invite, closesAt: setup.closesAt,
      bids: [], scores: [], moderations: [], clarifications: [], declarations: {},
    };
    this.events.set(ev.id, ev);
    pkg.status = 'sourcing';
    this.#log(user, 'event.created', ev.id, { package: pkg.id, type: ev.type, invited: ev.invited, criteria: ev.criteria, techWeight: ev.techWeight });
    return ev;
  }

  publish(user: User, eventId: string) {
    const ev = this.#event(user, eventId);
    if (ev.closesAt <= this.clock()) throw new Error('Closing time must be in the future');
    ev.status = next(flows.event, ev.status, 'publish', user) as SourcingEvent['status'];
    this.#log(user, 'event.published', ev.id, { closesAt: ev.closesAt, invited: ev.invited });
    return ev;
  }

  clarify(user: User, eventId: string, question: string) {
    const ev = this.#event(user, eventId);
    const supplierId = this.#bidder(user, ev);
    if (ev.status !== 'open') throw new Error('Clarifications are only accepted while the event is open');
    const c = { id: this.#id('CL'), supplierId, question };
    ev.clarifications.push(c);
    this.#log(user, 'clarification.asked', ev.id, c);
    return c;
  }

  // Answers go to every invited bidder; an extension is issued as an addendum.
  answer(user: User, eventId: string, clarificationId: string, answer: string, extendTo?: string) {
    const ev = this.#event(user, eventId);
    guard(user, ['buyer']);
    const c = ev.clarifications.find(x => x.id === clarificationId);
    if (!c) throw new Error(`Clarification ${clarificationId} not found`);
    c.answer = answer;
    if (extendTo) {
      if (extendTo <= ev.closesAt) throw new Error('An extension must move the closing time later');
      ev.status = next(flows.event, ev.status, 'extend', user) as SourcingEvent['status'];
      ev.closesAt = c.extendedTo = extendTo;
    }
    this.#log(user, extendTo ? 'addendum.issued' : 'clarification.answered', ev.id, { clarificationId, extendTo });
    return c;
  }

  // Supplier portal view: own bid only, anonymised Q&A.
  portal(user: User, eventId: string) {
    const ev = this.#event(user, eventId);
    const supplierId = this.#bidder(user, ev);
    return {
      id: ev.id, title: ev.title, type: ev.type, status: ev.status, closesAt: ev.closesAt, lots: ev.lots, boq: ev.boq,
      clarifications: ev.clarifications.filter(c => c.answer).map(({ question, answer, extendedTo }) => ({ question, answer, extendedTo })),
      myBid: ev.bids.find(b => b.supplierId === supplierId) ?? null,
    };
  }

  submitBid(user: User, eventId: string, input: { currency: string; lines: BidLine[]; exclusions?: Omit<Exclusion, 'addBack'>[]; deviations?: string[] }) {
    const ev = this.#event(user, eventId);
    const supplierId = this.#bidder(user, ev);
    if (ev.status !== 'open' || this.clock() > ev.closesAt) throw new Error('Bidding is closed');
    if (!this.fx[input.currency]) throw new Error(`Unsupported currency ${input.currency}`);
    for (const l of input.lines) {
      if (!ev.boq.some(b => b.id === l.lineId) || !(l.rate >= 0) || !(l.amount >= 0)) throw new Error(`Invalid bid line ${l.lineId}`);
    }
    if (new Set(input.lines.map(l => l.lineId)).size !== input.lines.length) throw new Error('Each BOQ line can be priced once');
    if (!input.lines.some(l => l.rate > 0)) throw new Error('A bid must price at least one line');
    const exclusions = (input.exclusions ?? []).map(({ lotId, description }) => {
      if (!ev.lots.some(l => l.id === lotId)) throw new Error(`Unknown lot ${lotId}`);
      return { lotId, description };
    });
    const prev = ev.bids.find(b => b.supplierId === supplierId);
    const bid = {
      id: prev?.id ?? this.#id('BID'), supplierId, currency: input.currency, lines: input.lines, exclusions,
      deviations: input.deviations ?? [], version: (prev?.version ?? 0) + 1, submittedAt: this.clock(),
    };
    if (prev) ev.bids[ev.bids.indexOf(prev)] = bid;
    else ev.bids.push(bid);
    // Sealed: the trail holds a fingerprint of the bid, not its prices.
    this.#log(user, 'bid.submitted', ev.id, { supplierId, version: bid.version, seal: sha256(bid) });
    return { id: bid.id, version: bid.version };
  }

  closeBids(user: User, eventId: string) {
    const ev = this.#event(user, eventId);
    if (this.clock() < ev.closesAt) throw new Error(`Bids close at ${ev.closesAt}`);
    ev.status = next(flows.event, ev.status, 'close', user) as SourcingEvent['status'];
    this.#log(user, 'event.closed', ev.id, { bids: ev.bids.map(b => ({ supplierId: b.supplierId, seal: sha256(b) })) });
    return ev;
  }

  // ---------- Technical envelope ----------

  openTechnical(user: User, eventId: string) {
    const ev = this.#event(user, eventId);
    if (!ev.bids.length) throw new Error('No bids received');
    ev.status = next(flows.event, ev.status, 'open_technical', user) as SourcingEvent['status'];
    this.#log(user, 'technical.opened', ev.id);
    return ev;
  }

  // What an evaluator sees: deviations and references, never prices.
  technicalPack(user: User, eventId: string) {
    const ev = this.#event(user, eventId);
    guard(user, ['technical_evaluator', 'procurement_manager']);
    if (ev.status === 'draft' || ev.status === 'open' || ev.status === 'closed') throw new Error('Technical envelope is not open yet');
    return {
      criteria: ev.criteria,
      bidders: ev.bids.map(b => ({
        ref: ev.blind ? alias(ev, b.supplierId) : b.supplierId,
        name: ev.blind ? alias(ev, b.supplierId) : this.suppliers.get(b.supplierId)!.name,
        deviations: b.deviations,
        exclusions: b.exclusions.map(x => x.description),
      })),
    };
  }

  declareConflicts(user: User, eventId: string, conflictedSupplierIds: string[]) {
    const ev = this.#event(user, eventId);
    if (!ev.evaluators.includes(user.id)) throw new Error(`${user.name} is not on the evaluation committee`);
    ev.declarations[user.id] = conflictedSupplierIds;
    this.#log(user, 'conflict.declared', ev.id, { conflicts: conflictedSupplierIds });
  }

  score(user: User, eventId: string, bidderRef: string, criterionId: string, score: number, comment?: string) {
    const ev = this.#event(user, eventId);
    guard(user, ['technical_evaluator']);
    if (ev.status !== 'technical') throw new Error('Technical scoring is not open');
    if (!ev.evaluators.includes(user.id)) throw new Error(`${user.name} is not on the evaluation committee`);
    const conflicts = ev.declarations[user.id];
    if (!conflicts) throw new Error('Declare conflicts of interest before scoring');
    const supplierId = this.#resolve(ev, bidderRef);
    if (conflicts.includes(supplierId)) throw new Error('Conflict declared: you cannot score this bidder');
    this.#checkScore(ev, criterionId, score);
    ev.scores = ev.scores.filter(s => !(s.evaluatorId === user.id && s.supplierId === supplierId && s.criterionId === criterionId));
    ev.scores.push({ evaluatorId: user.id, supplierId, criterionId, score, comment });
    this.#log(user, 'score.recorded', ev.id, { supplierId, criterionId, score, comment });
  }

  // Consensus meeting outcome overrides the individual median for one criterion.
  moderate(user: User, eventId: string, bidderRef: string, criterionId: string, score: number, note: string) {
    const ev = this.#event(user, eventId);
    guard(user, ['procurement_manager']);
    if (ev.status !== 'technical') throw new Error('Technical scoring is not open');
    if (!note.trim()) throw new Error('Moderation needs a note of the consensus reached');
    const supplierId = this.#resolve(ev, bidderRef);
    this.#checkScore(ev, criterionId, score);
    ev.moderations = ev.moderations.filter(m => !(m.supplierId === supplierId && m.criterionId === criterionId));
    ev.moderations.push({ supplierId, criterionId, score, note, by: user.id });
    this.#log(user, 'score.moderated', ev.id, { supplierId, criterionId, score, note });
  }

  completeTechnical(user: User, eventId: string) {
    const ev = this.#event(user, eventId);
    const results = technical(ev);
    const open = results.flatMap(t => t.flags.map(f => `${alias(ev, t.supplierId)}: ${f}`));
    if (open.length) throw new Error(`Technical envelope cannot be signed off:\n- ${open.join('\n- ')}`);
    ev.status = next(flows.event, ev.status, 'complete_technical', user) as SourcingEvent['status'];
    this.#log(user, 'technical.completed', ev.id, results.map(({ supplierId, score, qualified }) => ({ supplierId, score, qualified })));
    return results;
  }

  // ---------- Commercial envelope, evaluation and award ----------

  loadExclusion(user: User, eventId: string, supplierId: string, index: number, addBackAED: number) {
    const ev = this.#event(user, eventId);
    guard(user, ['commercial_evaluator', 'buyer']);
    if (ev.status !== 'commercial') throw new Error('Commercial envelope is not open');
    const x = ev.bids.find(b => b.supplierId === supplierId)?.exclusions[index];
    if (!x) throw new Error('Exclusion not found');
    if (!(addBackAED >= 0)) throw new Error('Add-back must be zero or more');
    x.addBack = addBackAED;
    this.#log(user, 'exclusion.loaded', ev.id, { supplierId, exclusion: x.description, addBackAED });
  }

  evaluation(user: User, eventId: string) {
    const ev = this.#event(user, eventId);
    guard(user, ['buyer', 'procurement_manager', 'commercial_evaluator', 'auditor', ...APPROVERS]);
    if (!['commercial', 'approval', 'awarded'].includes(ev.status)) {
      throw new Error('Commercial envelope is sealed until the technical evaluation is signed off');
    }
    return evaluate(ev, this.fx);
  }

  recommend(user: User, eventId: string, scenarioId: string, justification = '') {
    const ev = this.#event(user, eventId);
    const result = this.evaluation(user, eventId);
    const unpriced = ev.bids
      .filter(b => result.ranking.some(r => r.supplierId === b.supplierId))
      .flatMap(b => b.exclusions.filter(x => x.addBack === undefined).map(x => `${b.supplierId}: ${x.description}`));
    if (unpriced.length) throw new Error(`Price these exclusions first: ${unpriced.join('; ')}`);
    const scenario = result.scenarios.find(s => s.id === scenarioId);
    if (!scenario) throw new Error(`Unknown scenario ${scenarioId}`);
    if (scenario.deviation && !justification.trim()) throw new Error('Deviating from the best-value ranking needs a justification');
    const pkg = this.#get(this.packages, ev.packageId, 'Package');
    const budget = checkBudget(this.#get(this.projects, pkg.projectId, 'Project'), pkg.costCode, scenario.value);
    ev.status = next(flows.event, ev.status, 'recommend', user) as SourcingEvent['status'];
    const award: Award = {
      id: this.#id('AW'), eventId, scenario: scenario.id, allocations: scenario.allocations, value: scenario.value,
      justification, deviation: scenario.deviation, recommendedBy: user.id,
      steps: routeApproval(scenario.value, { overBudget: !budget.ok, deviation: scenario.deviation }), status: 'pending',
    };
    this.awards.set(award.id, award);
    this.#log(user, 'award.recommended', award.id, { eventId, scenario: scenario.id, value: award.value, route: award.steps.map(s => s.role) });
    return award;
  }

  decideAward(user: User, awardId: string, decision: 'approved' | 'rejected', comment = '') {
    const award = this.#get(this.awards, awardId, 'Award');
    const ev = this.#event(user, award.eventId);
    const pkg = this.#get(this.packages, ev.packageId, 'Package');
    guard(user, APPROVERS, { projectId: pkg.projectId });
    decide(award, user, decision, comment, this.clock(), [pkg.requesterId ?? '', ...ev.evaluators]);
    this.#log(user, `award.${decision}`, award.id, { comment });
    if (award.status === 'rejected') {
      ev.status = next(flows.event, ev.status, 'reject', user) as SourcingEvent['status'];
    } else if (award.status === 'approved') {
      ev.status = next(flows.event, ev.status, 'award', user) as SourcingEvent['status'];
      const project = this.#get(this.projects, pkg.projectId, 'Project');
      project.committed[pkg.costCode] = (project.committed[pkg.costCode] ?? 0) + award.value;
      Object.assign(pkg, { status: 'awarded', awardedValue: award.value });
      const contracts = award.allocations.map(a => {
        const c: Contract = { id: this.#id('CT'), awardId, supplierId: a.supplierId, lotIds: a.lotIds, value: a.value, status: 'draft' };
        this.contracts.set(c.id, c);
        return c.id;
      });
      const regrets = ev.bids.map(b => b.supplierId).filter(id => !award.allocations.some(a => a.supplierId === id));
      this.#log(user, 'event.awarded', ev.id, { value: award.value, contracts, regrets });
    }
    return award;
  }

  // ---------- Dashboards, registers, audit ----------

  dashboard(user: User) {
    const today = this.today;
    const sees = (projectId: string) => this.#sees(user, projectId);
    const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
    const packages = [...this.packages.values()].filter(p => sees(p.projectId)).map(p => ({
      ...p, ...(p.status === 'awarded' ? { floatDays: 0, health: 'on_track' as const } : health(remaining(p), today)),
    }));
    const open = packages.filter(p => p.status !== 'awarded');
    const awarded = packages.filter(p => p.status === 'awarded');
    return {
      pipeline: { planned: packages.filter(p => p.status === 'planned').length, sourcing: packages.filter(p => p.status === 'sourcing').length, awarded: awarded.length },
      valueInPipeline: sum(open.map(p => p.estimate)),
      atRisk: open.filter(p => p.health !== 'on_track').map(p => ({ id: p.id, title: p.title, health: p.health, floatDays: p.floatDays })),
      longLead: open.filter(p => p.longLead).length,
      savings: { baseline: sum(awarded.map(p => p.estimate)), awarded: sum(awarded.map(p => p.awardedValue ?? 0)), saved: sum(awarded.map(p => p.estimate - (p.awardedValue ?? 0))) },
      myApprovals: [
        ...[...this.requisitions.values()].filter(r => r.status === 'submitted' && user.roles.includes('budget_owner') && sees(r.projectId)).map(r => ({ type: 'requisition', id: r.id, value: r.amount })),
        ...[...this.awards.values()].filter(a => a.status === 'pending' && user.roles.includes(a.steps.find(s => !s.decision)!.role) && sees(this.#projectOf(a.eventId))).map(a => ({ type: 'award', id: a.id, value: a.value })),
      ],
      expiringDocs: [...this.suppliers.values()].flatMap(s => s.docs
        .filter(d => daysBetween(today, d.expires) <= 30)
        .map(d => ({ supplier: s.name, doc: d.type, expires: d.expires, expired: d.expires < today }))),
      budget: [...this.projects.values()].filter(p => sees(p.id)).flatMap(p => Object.entries(p.budgets).map(([costCode, budget]) => {
        const committed = p.committed[costCode] ?? 0;
        return { project: p.id, costCode, budget, committed, available: budget - committed };
      })),
      audit: this.audit.verify(),
    };
  }

  exportPackages(user: User) {
    guard(user, ['buyer', 'procurement_manager', 'auditor']);
    return toCsv([...this.packages.values()].filter(p => this.#sees(user, p.projectId)).map(p => ({
      id: p.id, title: p.title, category: p.category, route: p.route, estimate: p.estimate, awarded: p.awardedValue ?? '',
      status: p.status, longLead: p.longLead ? 'yes' : 'no', needBy: p.needBy,
      next: remaining(p)[0]?.name ?? '',
    })));
  }

  history(user: User, entity: string) {
    guard(user, ['auditor', 'procurement_manager', 'admin']);
    return this.audit.for(entity);
  }

  // ---------- internals ----------

  #id(prefix: string) { return `${prefix}-${String(++this.#seq).padStart(4, '0')}`; }

  #log(user: User, action: string, entity: string, data: unknown = {}) { this.audit.append(user.id, action, entity, data, this.clock()); }

  #get<T>(map: Map<string, T>, id: string, what: string): T {
    const x = map.get(id);
    if (!x) throw new Error(`${what} ${id} not found`);
    return x;
  }

  #sees(user: User, projectId: string) { return user.projects.includes('*') || user.projects.includes(projectId); }

  #projectOf(eventId: string) { return this.#get(this.packages, this.#get(this.events, eventId, 'Event').packageId, 'Package').projectId; }

  // Event lookup with project scoping for staff; suppliers are scoped by invitation instead.
  #event(user: User, id: string) {
    const ev = this.#get(this.events, id, 'Event');
    if (!user.roles.includes('supplier')) guard(user, user.roles, { projectId: this.#projectOf(id) });
    return ev;
  }

  #bidder(user: User, ev: SourcingEvent) {
    guard(user, ['supplier']);
    if (!user.supplierId || !ev.invited.includes(user.supplierId)) throw new Error('Not invited to this event');
    return user.supplierId;
  }

  #checkScore(ev: SourcingEvent, criterionId: string, score: number) {
    const c = ev.criteria.find(x => x.id === criterionId);
    if (!c) throw new Error(`Unknown criterion ${criterionId}`);
    if (c.gate ? score !== 0 && score !== 1 : !(score >= 0 && score <= SCORE_MAX)) {
      throw new Error(c.gate ? 'Gate criteria are scored 1 (pass) or 0 (fail)' : `Scores run 0 to ${SCORE_MAX}`);
    }
  }

  #resolve(ev: SourcingEvent, ref: string) {
    const bid = ev.bids.find(b => b.supplierId === ref || alias(ev, b.supplierId) === ref);
    if (!bid) throw new Error(`Unknown bidder ${ref}`);
    return bid.supplierId;
  }
}
