// Pure client-side logic over the fixture rules: routing, safeguards, band coverage, diff and canvas layout.
// Preview only. The engine's own routing (awards.ts, intake.ts) is not called and is not changed by anything here.
import { aed, CEILING, DESIGNATIONS, GROUPS, PEOPLE, ROLES, type Rule, type Stage, type Workflow } from './fixtures';

export const person = (id: string) => PEOPLE.find(p => p.id === id);
export const role = (id: string) => ROLES.find(r => r.id === id);

/** Who an approver resolves to: a label, the people behind it (for segregation of duties) and the authority limit it carries. */
export function resolve(a: Stage['approver']): { label: string; people: string[]; limit: number | null } {
  const v = a.value;
  if (a.kind === 'role') return { label: role(v)?.label ?? '', people: PEOPLE.filter(p => p.roles.includes(v)).map(p => p.id), limit: role(v)?.limit ?? null };
  if (a.kind === 'person') { const p = person(v); return { label: p?.name ?? '', people: p ? [p.id] : [], limit: p?.limit ?? null }; }
  if (a.kind === 'designation') { const ps = PEOPLE.filter(p => p.designation === v); return { label: DESIGNATIONS.includes(v) ? v : '', people: ps.map(p => p.id), limit: ps.reduce<number | null>((m, p) => p.limit == null ? m : Math.max(m ?? 0, p.limit), null) }; }
  if (a.kind === 'group') { const g = GROUPS.find(x => x.id === v); return { label: g?.label ?? '', people: g?.people ?? [], limit: null }; }
  return { label: "Requester's line manager", people: [], limit: null };
}
export const limitOf = (s: Stage) => s.limit ?? resolve(s.approver).limit;
export const kindLabel = (k: Stage['approver']['kind']) => ({ role: 'Role', person: 'Person', designation: 'Designation', line_manager: 'Line manager', group: 'Group' })[k];

// ---------- rules ----------
const amountText = (r: Rule) => (r.min === 0 && r.max == null ? '' : r.max == null ? `value above ${aed(r.min)}` : r.min === 0 ? `value up to ${aed(r.max)}` : `value ${aed(r.min)} to ${aed(r.max)}`);
const otherParts = (r: Rule) => [
  r.person && `requester ${person(r.person)?.name}`, r.designation && `requester is ${r.designation}`, r.project && `project ${r.project}`,
  r.category && `category ${r.category}`, r.country && `country ${r.country}`, r.overBudget && 'over budget', r.deviation && 'deviation from best-value ranking',
].filter(Boolean) as string[];
export const condText = (r: Rule) => [amountText(r), ...otherParts(r)].filter(Boolean).join(', ') || 'every request';
export const isGeneric = (r: Rule) => r.enabled && r.effect === 'set' && otherParts(r).length === 0;
export const ruleName = (wf: Workflow, r: Rule) => r.name || `Rule ${wf.rules.indexOf(r) + 1}`;
export const stageName = (wf: Workflow, id: string) => wf.stages.find(s => s.id === id)?.name ?? id;

/** The condition shown on the canvas edge into a stage, derived from the rules that route to it. '' means always. */
export function edgeLabel(wf: Workflow, id: string): string {
  const mine = wf.rules.filter(r => r.enabled && r.chain.includes(id));
  if (!mine.length) return 'no rule routes here';
  const bands = mine.filter(isGeneric).sort((a, b) => a.min - b.min).reduce<[number, number | null][]>((out, r) => {
    const last = out.at(-1);
    if (last && last[1] != null && r.min <= last[1]) last[1] = r.max == null ? null : Math.max(last[1], r.max); else out.push([r.min, r.max]);
    return out;
  }, []);
  const parts = bands.map(([min, max]) => amountText({ min, max } as Rule)).filter(Boolean);
  if (bands.some(([min, max]) => min === 0 && max == null)) return '';
  return [...parts, ...mine.filter(r => !isGeneric(r)).map(condText)].join(' or ');
}

type Seg = { from: number; to: number | null; rules: Rule[] };
/** Amount coverage across rules that use only a band: where no rule applies (gap) or several do (overlap). */
export function coverage(wf: Workflow): Seg[] {
  const g = wf.rules.filter(isGeneric);
  if (!g.length) return [];
  const pts = [...new Set([0, ...g.map(r => r.min), ...g.flatMap(r => r.max == null ? [] : [r.max])])].sort((a, b) => a - b);
  return pts.map((from, i) => {
    const to = pts[i + 1] ?? null;
    return { from, to, rules: g.filter(r => r.min <= from && (r.max == null || (to != null && r.max >= to))) };
  });
}
const span = (s: Seg) => s.to == null ? `above ${aed(s.from)}` : `${aed(s.from)} to ${aed(s.to)}`;

export type Issue = { level: 'error' | 'warning'; text: string; stage?: string; rule?: string };
export function issues(wf: Workflow): Issue[] {
  const out: Issue[] = [], err = (text: string, o: Partial<Issue> = {}) => out.push({ level: 'error', text, ...o }), warn = (text: string, o: Partial<Issue> = {}) => out.push({ level: 'warning', text, ...o });
  if (!wf.stages.length) err('This workflow has no stages.');
  for (const s of wf.stages) if (!resolve(s.approver).label) err(`"${s.name}" has no approver. Choose a ${kindLabel(s.approver.kind).toLowerCase()}.`, { stage: s.id });
  // Segregation of duties: one person may not hold two steps of the same route.
  const holds = new Map<string, string[]>();
  if (wf.kind !== 'route') for (const s of wf.stages) for (const p of new Set(resolve(s.approver).people)) holds.set(p, [...(holds.get(p) ?? []), s.name]);
  for (const [p, names] of holds) if (names.length > 1) err(`Segregation of duties: ${person(p)?.name} would approve twice ("${names.join('" and "')}"). One person may hold only one step.`, { stage: wf.stages.find(s => s.name === names[1])?.id });
  const enabled = wf.rules.filter(r => r.enabled);
  if (!enabled.length) err('No rule routes requests. Add a rule in the authority matrix.');
  for (const r of enabled) {
    const n = ruleName(wf, r), chain = wf.stages.filter(s => r.chain.includes(s.id));
    if (!chain.length) { err(`"${n}" routes to no stage.`, { rule: r.id }); continue; }
    if (wf.kind === 'approval' && r.effect === 'set') {
      const top = r.max ?? CEILING, best = chain.reduce((m, s) => Math.max(m, limitOf(s) ?? 0), 0);
      if (best < top) err(`Authority limit: "${n}" reaches ${aed(top)}, but the highest approver in its route is limited to ${aed(best)}.`, { rule: r.id });
    }
  }
  enabled.filter(r => r.effect === 'set').forEach((r, i, all) => {
    const hide = all.slice(0, i).find(e => isGeneric(e) && e.min <= r.min && (e.max == null || (r.max != null && e.max >= r.max)));
    if (hide) warn(`Unreachable rule: "${ruleName(wf, r)}" never matches because "${ruleName(wf, hide)}" above it already covers its whole band.`, { rule: r.id });
  });
  for (const s of coverage(wf)) {
    if (!s.rules.length) err(`Gap: values ${span(s)} match no rule, so those requests would have no route.`);
    else if (s.rules.length > 1) warn(`Overlap: values ${span(s)} match "${s.rules.map(r => ruleName(wf, r)).join('" and "')}". The first rule in priority wins.`, { rule: s.rules[1].id });
  }
  for (const s of wf.stages) if (!enabled.some(r => r.chain.includes(s.id))) warn(`"${s.name}" is not used by any rule, so no request reaches it.`, { stage: s.id });
  return out;
}

// ---------- simulator ----------
export type Input = { value: number; category: string; project: string; requester: string; country: string; overBudget: boolean; deviation: boolean };
export const defaultInput: Input = { value: 1_200_000, category: 'Mechanical / Cooling', project: 'DC1', requester: 'u-omar', country: 'AE', overBudget: false, deviation: false };
export type Sim = { chain: string[]; matched: { rule: Rule; n: number; why: string }[]; flags: string[]; hours: number; steps: number };

const hit = (r: Rule, i: Input) => r.enabled
  && (r.min === 0 ? i.value >= 0 : i.value > r.min) && (r.max == null || i.value <= r.max)
  && (!r.person || r.person === i.requester) && (!r.designation || person(i.requester)?.designation === r.designation)
  && (!r.project || r.project === i.project) && (!r.category || r.category === i.category) && (!r.country || r.country === i.country)
  && (!r.overBudget || i.overBudget) && (!r.deviation || i.deviation);

export function simulate(wf: Workflow, i: Input): Sim {
  const first = wf.rules.findIndex(r => r.effect === 'set' && hit(r, i));
  const hits = [...(first >= 0 ? [first] : []), ...wf.rules.flatMap((r, n) => r.effect === 'add' && hit(r, i) ? [n] : [])];
  const matched = hits.map(n => ({ rule: wf.rules[n], n: n + 1, why: wf.rules[n].effect === 'set' ? `first matching rule: ${condText(wf.rules[n])}` : `adds a tier: ${condText(wf.rules[n])}` }));
  const ids = new Set(matched.flatMap(m => m.rule.chain));
  const chain = wf.stages.filter(s => ids.has(s.id)).map(s => s.id), stages = wf.stages.filter(s => ids.has(s.id)), flags: string[] = [];
  if (first < 0) flags.push(`No rule matches ${aed(i.value)}, so this request has no route. Fix the gap in the authority matrix.`);
  if (wf.kind !== 'route') for (const s of stages) if (resolve(s.approver).people.includes(i.requester)) flags.push(`Segregation of duties: ${person(i.requester)?.name} is the requester and the approver at "${s.name}". The step must go to an alternate approver.`);
  if (wf.kind === 'approval' && stages.length && Math.max(...stages.map(s => limitOf(s) ?? 0)) < i.value) flags.push(`No approver in this route has authority for ${aed(i.value)}.`);
  // Parallel stages overlap in time: a column costs its slowest stage.
  const cols = columns(wf).map(c => c.filter(s => ids.has(s.id))).filter(c => c.length);
  return { chain, matched, flags, hours: wf.kind === 'route' ? 0 : cols.reduce((t, c) => t + Math.max(...c.map(s => s.slaHours)), 0), steps: wf.kind === 'route' ? Math.min(1, chain.length) : cols.length };
}

// ---------- layout ----------
/** Consecutive stages flagged parallel share one column. */
export function columns(wf: Workflow): Stage[][] {
  return wf.stages.reduce<Stage[][]>((cols, s, i) => { if (i && s.parallelWithPrev) cols[cols.length - 1].push(s); else cols.push([s]); return cols; }, []);
}

// ---------- diff ----------
export type Change = { kind: 'added' | 'removed' | 'changed'; text: string };
const stageFields: [keyof Stage, string, (s: Stage) => string][] = [
  ['name', 'name', s => s.name], ['approver', 'approver', s => resolve(s.approver).label || 'none'], ['parallelWithPrev', 'order', s => s.parallelWithPrev ? 'parallel with previous' : 'sequential'],
  ['quorum', 'quorum', s => s.quorum === 'all' ? 'all approvers' : 'any one approver'], ['limit', 'authority limit', s => { const l = limitOf(s); return l == null ? 'none' : aed(l); }],
  ['slaHours', 'SLA', s => `${s.slaHours} hours`], ['escalateTo', 'escalation', s => s.escalateTo ? `${role(s.escalateTo)?.label} after ${s.escalateAfter} hours` : 'none'],
  ['delegateTo', 'out-of-office delegate', s => person(s.delegateTo)?.name ?? 'none'], ['email', 'email', s => s.email ? 'on' : 'off'], ['inApp', 'in-app notice', s => s.inApp ? 'on' : 'off'],
  ['forms', 'documents', s => s.forms.join(', ') || 'none'], ['fields', 'custom fields', s => s.fields.join(', ') || 'none'], ['validations', 'validation rules', s => s.validations.join(', ') || 'none'],
];
const ruleText = (wf: Workflow, r: Rule) => `${ruleName(wf, r)} (${r.effect === 'set' ? 'sets the route' : 'adds tiers'}; when ${condText(r)}; route ${r.chain.map(c => stageName(wf, c)).join(', ') || 'none'})`;

export function diff(a: Workflow | null, b: Workflow): Change[] {
  if (!a) return [{ kind: 'added', text: `New workflow with ${b.stages.length} stages and ${b.rules.length} rules.` }];
  const out: Change[] = [], add = (kind: Change['kind'], text: string) => out.push({ kind, text });
  const same = <T,>(x: T, y: T) => JSON.stringify(x) === JSON.stringify(y);
  for (const s of b.stages) {
    const o = a.stages.find(x => x.id === s.id);
    if (!o) { add('added', `Stage "${s.name}" added, approver ${resolve(s.approver).label || 'none'}.`); continue; }
    for (const [k, label, show] of stageFields) if (!same(o[k], s[k]) && show(o) !== show(s)) add('changed', `Stage "${s.name}": ${label} ${show(o)} to ${show(s)}.`);
  }
  for (const s of a.stages) if (!b.stages.some(x => x.id === s.id)) add('removed', `Stage "${s.name}" removed.`);
  const keep = a.stages.map(s => s.id).filter(id => b.stages.some(s => s.id === id));
  if (!same(keep, b.stages.map(s => s.id).filter(id => keep.includes(id)))) add('changed', 'Stage order changed.');
  for (const r of b.rules) {
    const o = a.rules.find(x => x.id === r.id);
    if (!o) add('added', `Rule ${ruleText(b, r)} added.`);
    else if (!same(o, r)) add('changed', `Rule ${ruleName(a, o)}: ${o.enabled !== r.enabled ? (r.enabled ? 'enabled' : 'disabled') + '; ' : ''}was ${ruleText(a, o)}, now ${ruleText(b, r)}.`);
  }
  for (const r of a.rules) if (!b.rules.some(x => x.id === r.id)) add('removed', `Rule ${ruleName(a, r)} removed.`);
  const common = a.rules.map(r => r.id).filter(id => b.rules.some(r => r.id === id));
  if (!same(common, b.rules.map(r => r.id).filter(id => common.includes(id)))) add('changed', 'Rule priority order changed.');
  return out;
}
