// End-to-end walkthrough: intake → plan → ITT → bids → technical → commercial → award → audit.
// Run: npm run demo. Every call is module.command(platform, user, ...args).
import { fileURLToPath } from 'node:url';
import { awards, createPlatform, evaluation, intake, payables, reporting, sourcing } from '@satishjag/procurement-core';
import type { Contract, User } from '@satishjag/procurement-core/types';
import { demoSeed } from './seed.ts';

// stopAt returns the platform early so the UI can start in any workflow state (server env DEMO_STAGE).
export type Stage = 'package' | 'draft' | 'bids' | 'technical' | 'commercial' | 'award' | 'payables';
export function run(print: (...a: unknown[]) => void = console.log, stopAt?: Stage) {
  let now = '2026-10-01T09:00:00Z';
  const p = createPlatform(demoSeed(), () => now);
  const u = (id: string) => p.users.get(id)!;
  const aed = (n: number) => `AED ${n.toLocaleString('en', { maximumFractionDigits: 0 })}`;
  const name = (id: string) => p.suppliers.get(id)!.name;
  const step = (title: string) => print(`\n▸ ${title}`);
  const expectError = (fn: () => unknown) => { try { fn(); } catch (e) { return print(`  ✗ blocked: ${(e as Error).message.split('\n').join('\n    ')}`); } throw new Error('expected a control to block this'); };

  step('Guided intake');
  const req = intake.submit(p, u('u-omar'), {
    projectId: 'DC1', costCode: '26-32-00', amount: 38_500_000, needBy: '2028-02-01',
    title: 'Standby diesel generators, Phase 1',
    description: 'Supply, install and commission 12 x 2.5 MVA generator sets with bulk fuel system and synchronisation panels for data halls 1-4.',
  });
  const r = req.recommendation;
  print(`  ${req.id}: ${r.category} (confidence ${r.confidence}, ${r.evidence.join(', ')})`);
  print(`  Route ${r.route}, ${r.minBidders}+ bidders, ${r.envelopes} envelopes, prequal ${r.prequal}. ${r.reasons.join('. ')}`);
  print(`  Budget: ${aed(req.budget.available)} available, ok=${req.budget.ok}. Plan float ${req.schedule.floatDays} days (${req.schedule.health})`);
  for (const m of req.schedule.milestones) print(`    ${m.date}  ${m.name}`);

  step('Budget owner approval → package');
  const { package: pkg } = intake.decide(p, u('u-fatima'), req.id, 'approve');
  if (stopAt === 'package') return { p } as never;

  step('Sourcing event (ITT, two lots, BOQ imported from Excel CSV)');
  const boq = sourcing.boqFromCsv([
    'id,lot,item,unit,qty',
    'G1,L1,2.5 MVA diesel generator set incl. enclosure,nr,12',
    'G2,L1,"Installation, testing and commissioning",lot,1',
    'F1,L2,Bulk fuel storage 2 x 100 m3 incl. polishing,lot,1',
    'F2,L2,Synchronisation and paralleling panels,nr,4',
  ].join('\n'));
  const setup = {
    lots: [{ id: 'L1', name: 'Generator sets' }, { id: 'L2', name: 'Fuel system and synchronisation' }],
    boq,
    criteria: [
      { id: 'C0', name: 'HSE prequalification', weight: 0, gate: true },
      { id: 'C1', name: 'Technical compliance', weight: 40 },
      { id: 'C2', name: 'Delivery programme', weight: 25 },
      { id: 'C3', name: 'Data-centre experience', weight: 20 },
      { id: 'C4', name: 'After-sales and spares', weight: 15 },
    ],
    techWeight: 0.4, techThreshold: 65, quorum: 2, blind: true,
    evaluators: ['u-hana', 'u-marco', 'u-aisha'],
    closesAt: '2026-12-22T12:00:00Z',
  };
  expectError(() => sourcing.create(p, u('u-priya'), pkg!.id, { ...setup, invite: ['SUP-FAL', 'SUP-NWD', 'SUP-MER', 'SUP-DUN'] }));
  const ev = sourcing.create(p, u('u-priya'), pkg!.id, { ...setup, invite: ['SUP-FAL', 'SUP-NWD', 'SUP-ALN', 'SUP-MER'] });
  if (stopAt === 'draft') return { p } as never;
  sourcing.publish(p, u('u-priya'), ev.id);
  print(`  ${ev.id} published to ${ev.invited.map(name).join(', ')}`);

  step('Clarification → addendum with bid extension');
  const q = sourcing.clarify(p, u('u-alnoor'), ev.id, 'Is load bank testing part of Lot 1?');
  sourcing.answer(p, u('u-priya'), ev.id, q.id, 'Yes. Addendum 1 adds it to G2; closing extended.', '2027-01-05T12:00:00Z');
  print(`  Portal view for Falcon: ${JSON.stringify(sourcing.portal(p, u('u-falcon'), ev.id).clarifications)}`);

  step('Sealed bids');
  now = '2026-12-15T10:00:00Z';
  const line = (lineId: string, rate: number, qty: number, amount = rate * qty) => ({ lineId, rate, amount });
  sourcing.submitBid(p, u('u-falcon'), ev.id, { currency: 'AED', lines: [line('G1', 2_350_000, 12), line('G2', 1_450_000, 1), line('F1', 2_900_000, 1), line('F2', 1_150_000, 4, 4_500_000)], exclusions: [{ lotId: 'L2', description: 'Fuel first fill' }] });
  sourcing.submitBid(p, u('u-northwind'), ev.id, { currency: 'EUR', lines: [line('G1', 520_000, 12), line('F1', 760_000, 1), line('F2', 255_000, 4)], deviations: ['Alternative alternator brand (approved-equal requested)'] });
  sourcing.submitBid(p, u('u-alnoor'), ev.id, { currency: 'AED', lines: [line('G1', 2_050_000, 12), line('G2', 1_100_000, 1), line('F1', 2_450_000, 1), line('F2', 480_000, 4)] });
  sourcing.submitBid(p, u('u-meridian'), ev.id, { currency: 'USD', lines: [line('G1', 690_000, 12), line('G2', 420_000, 1), line('F1', 760_000, 1), line('F2', 300_000, 4)] });
  expectError(() => evaluation.results(p, u('u-priya'), ev.id));
  if (stopAt === 'bids') return { p } as never;
  now = '2027-01-05T12:00:01Z';
  sourcing.close(p, u('u-priya'), ev.id);
  evaluation.openTechnical(p, u('u-priya'), ev.id);
  print(`  Evaluators see: ${evaluation.technicalPack(p, u('u-hana'), ev.id).bidders.map(b => b.name).join(', ')}`);
  if (stopAt === 'technical') return { p } as never;

  step('Technical evaluation (blind, conflict declared, consensus)');
  evaluation.declareConflicts(p, u('u-hana'), ev.id, []);
  evaluation.declareConflicts(p, u('u-marco'), ev.id, []);
  evaluation.declareConflicts(p, u('u-aisha'), ev.id, ['SUP-ALN']);
  expectError(() => evaluation.score(p, u('u-aisha'), ev.id, 'SUP-ALN', 'C1', 7));
  const marks: Record<string, Record<string, number[]>> = { // criterion → [hana, marco, aisha]
    'SUP-MER': { C1: [9, 9, 8], C2: [8, 7, 8], C3: [9, 9, 9], C4: [8, 8, 7] },
    'SUP-FAL': { C1: [8, 7, 8], C2: [7, 7, 6], C3: [7, 8, 7], C4: [8, 7, 8] },
    'SUP-NWD': { C1: [8, 8, 7], C2: [5, 6, 9], C3: [6, 7, 6], C4: [7, 7, 7] },
    'SUP-ALN': { C1: [6, 5], C2: [6, 6], C3: [4, 5], C4: [6, 5] },
  };
  const evaluators = [u('u-hana'), u('u-marco'), u('u-aisha')];
  // The written basis behind each mark. One string = every evaluator cites the same finding; an array is one per evaluator.
  const why: Record<string, Record<string, string | string[]>> = {
    'SUP-MER': {
      C1: 'Meets the full 2.5 MVA specification; type-test certificates attached for all 12 sets',
      C2: 'Factory slots confirmed for all 12 sets; 14-month delivery with float on the critical path',
      C3: 'Two comparable hyperscale sites verified with the reference owners',
      C4: 'Regional spares depot and a 4-hour call-out commitment in the offer',
    },
    'SUP-FAL': {
      C1: 'Compliant with the specification; two minor deviations on enclosure noise rating, both acceptable',
      C2: ['Programme is credible but commissioning is about 3 weeks tight', 'Delivery relies on a single factory slot with little float', 'Commissioning overlaps the hall 3 handover; some risk'],
      C3: 'Three data-centre references, one comparable in scale',
      C4: 'Local spares stock held; response time stated as next business day',
    },
    'SUP-NWD': {
      C1: 'Alternative alternator brand proposed; the performance data supports equivalence',
      C2: ['Factory slot letter covers only 8 of the 12 sets; the rest is unconfirmed', 'Delivery of the last 4 sets is unsupported; programme looks optimistic', 'Strong programme if the slot letter holds; vendor delivered early on a past project'],
      C3: 'One data-centre reference; the others are industrial plants',
      C4: 'Standard warranty and spares list; no local depot',
    },
    'SUP-ALN': {
      C1: 'Several items unconfirmed; the synchronisation panel interface is not detailed',
      C2: 'Programme has no commissioning plan for the fuel system',
      C3: 'No data-centre experience; references are commercial buildings',
      C4: 'Generic spares offer with no response-time commitment',
    },
  };
  for (const [supplierId, byCriterion] of Object.entries(marks)) {
    for (const [i, e] of evaluators.entries()) {
      if (supplierId === 'SUP-ALN' && e.id === 'u-aisha') continue;
      evaluation.score(p, e, ev.id, supplierId, 'C0', 1, 'HSE prequalification certificate verified and in date');
      for (const [c, scores] of Object.entries(byCriterion)) {
        const w = why[supplierId][c];
        evaluation.score(p, e, ev.id, supplierId, c, scores[i], Array.isArray(w) ? w[i] : w);
      }
    }
  }
  expectError(() => evaluation.completeTechnical(p, u('u-daniel'), ev.id));
  evaluation.score(p, u('u-hana'), ev.id, 'SUP-MER', 'C3', 9, 'Four comparable hyperscale references verified');
  evaluation.moderate(p, u('u-daniel'), ev.id, 'SUP-NWD', 'C2', 6, 'Committee agreed 6: factory slot letter covers 8 of 12 sets');
  for (const t of evaluation.completeTechnical(p, u('u-daniel'), ev.id)) print(`  ${name(t.supplierId)}: ${t.score} ${t.qualified ? 'qualified' : 'below threshold'}`);
  if (stopAt === 'commercial') return { p } as never;

  step('Commercial evaluation (envelope opens)');
  evaluation.loadExclusion(p, u('u-tom'), ev.id, 'SUP-FAL', 0, 260_000);
  const result = evaluation.results(p, u('u-tom'), ev.id);
  for (const n of result.normalized) {
    print(`  ${name(n.supplierId)}: submitted ${n.currency} ${n.submitted.toLocaleString('en')} → normalized ${aed(n.total)}`);
    for (const a of [...n.adjustments, ...n.anomalies]) print(`    · ${a}`);
  }
  print('  Ranking (40% technical / 60% commercial):');
  for (const x of result.ranking) print(`    ${name(x.supplierId)}: tech ${x.technical}, commercial ${x.commercial}, combined ${x.combined}`);
  print(`  Sensitivity: ${result.sensitivity.map(b => `${b.from}-${b.to}% → ${name(b.winner)}`).join('; ')}`);
  for (const s of result.scenarios) print(`  Scenario ${s.id}: ${aed(s.value)} ${s.allocations.map(a => `${name(a.supplierId)} [${a.lotIds}]`).join(' + ')}${s.deviation ? ' (deviation)' : ''}`);

  step('Award recommendation and approval routing');
  const best = result.scenarios[0].value;
  const split = result.scenarios.find(s => s.id === 'split_by_lot')!;
  const award = awards.recommend(p, u('u-priya'), ev.id, 'split_by_lot', `Lot 1 to lowest compliant bidder, Lot 2 with best-value bidder: saves ${aed(best - split.value)} against a single best-value award`);
  print(`  ${award.id} ${aed(award.value)} routed to: ${award.steps.map(s => `${s.role} (${s.reason})`).join(' → ')}`);
  if (stopAt === 'award') return { p, ev, award, result }; // live state: an award waiting on its approvers
  expectError(() => awards.decide(p, u('u-rashid'), award.id, 'approved'));
  awards.decide(p, u('u-daniel'), award.id, 'approved', 'Endorsed');
  awards.decide(p, u('u-fatima'), award.id, 'approved', 'Within budget');
  awards.decide(p, u('u-rashid'), award.id, 'approved', 'Approved');
  print(`  Award ${award.status}; event ${ev.status}; contracts ${[...p.table<Contract>('contracts').values()].map(c => `${c.id} ${name(c.supplierId)} ${aed(c.value)}`).join(', ')}`);

  if (stopAt === 'payables') { payablesFlow(p, u, () => now, t => { now = t; }); return { p, ev, award, result }; }

  step('Dashboard and audit');
  const d = reporting.dashboard(p, u('u-daniel'));
  print(`  Pipeline ${JSON.stringify(d.pipeline)}, value in pipeline ${aed(d.valueInPipeline)}, long-lead ${d.longLead}`);
  print(`  At risk: ${d.atRisk.map(a => `${a.title} (${a.health}, ${a.floatDays}d)`).join('; ') || 'none'}`);
  print(`  Savings vs estimate: ${aed(d.savings.saved)} on ${aed(d.savings.baseline)}`);
  print(`  Expiring documents: ${d.expiringDocs.map(x => `${x.supplier} ${x.doc} ${x.expires}`).join('; ')}`);
  print(`  Audit chain: ${p.audit.events.length} events, verify=${JSON.stringify(d.audit)}, head ${p.audit.events.at(-1)!.hash.slice(0, 16)}…`);
  print(`  Package register CSV:\n${reporting.exportPackages(p, u('u-daniel')).replace('﻿', '').split('\r\n').map(l => '    ' + l).join('\n')}`);
  return { p, ev, award, result };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) run();

// Payables state for the UI: terms set, IPCs in every status, invoices waiting, held, accounted and exported.
function payablesFlow(p: ReturnType<typeof createPlatform>, u: (id: string) => User, _now: () => string, setNow: (t: string) => void) {
  const cts = [...p.table<Contract>('contracts').values()].sort((a, b) => b.value - a.value);
  const [big, small] = cts;
  const [ravi, nadia, karim, rashid] = ['u-ravi', 'u-nadia', 'u-karim', 'u-rashid'].map(u);
  setNow('2027-03-01T09:00:00Z');
  for (const c of cts) payables.setTerms(p, nadia, c.id, { retentionPct: 5, retentionCap: c.value * 0.1, advanceAmount: c.value * 0.1, advanceRecoveryPct: 20, vatPct: 5, whtPct: 0, revisedValue: c.value });
  let n = 0;
  const ipc = (c: Contract, share: number, o: Partial<Parameters<typeof payables.stageIpc>[3]> = {}) => {
    n++;
    const gross = Math.round(c.value * share);
    return payables.stageIpc(p, ravi, c.id, {
      messageId: `PMIS-${n}`, ipcRef: `IPC-${String(n).padStart(2, '0')}`, version: 1, periodFrom: '2027-01-01', periodTo: '2027-01-31', taxInvoiceNo: `TI-${1000 + n}`,
      lines: [{ boqItem: 'G1', wbs: 'DC1-1.1', costCode: '26-32-00', description: 'Works certified to date, this period', uom: 'lot', prevQty: 0, currQty: 1, rate: gross }],
      variations: [], adjustments: { otherDeductions: [{ type: 'Utilities', amount: Math.round(gross * 0.01) }] },
      attachments: [{ type: 'ipc', name: `IPC-${n}.pdf` }, { type: 'tax_invoice', name: `TI-${1000 + n}.pdf` }], ...o,
    });
  };
  const accountIt = (id: string) => { const inv = payables.createInvoice(p, nadia, id); payables.approveInvoice(p, karim, inv.id, 'Within certified value'); return payables.account(p, nadia, inv.id); };
  accountIt(ipc(big, 0.04).id);
  payables.exportJournals(p, nadia);                      // first batch goes to the corporate GL
  setNow('2027-03-05T09:00:00Z');
  accountIt(ipc(big, 0.03, { periodFrom: '2027-02-01', periodTo: '2027-02-28' }).id);   // accounted, waiting for the next export
  const waiting = payables.createInvoice(p, nadia, ipc(big, 0.28, { periodFrom: '2027-03-01', periodTo: '2027-03-31' }).id); // above Karim's limit: needs an executive
  void waiting; void rashid;
  ipc(big, 0.02, { periodFrom: '2027-04-01', periodTo: '2027-04-30' });                  // validated, no invoice yet
  ipc(big, 0.9, { periodFrom: '2027-05-01', periodTo: '2027-05-31' });                   // fails: beyond the contract value
  const held = payables.createInvoice(p, nadia, ipc(small, 0.06).id);
  payables.hold(p, karim, held.id, { reason: 'Insurance certificate expired on 28 Feb', ownerId: 'u-ravi', releaseCondition: 'Renewed certificate uploaded' });
}
