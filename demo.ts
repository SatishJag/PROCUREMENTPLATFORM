// End-to-end walkthrough: intake → plan → ITT → bids → technical → commercial → award → audit.
// Run: npm run demo
import { fileURLToPath } from 'node:url';
import { boqFromCsv, Platform } from './core/platform.ts';
import { demoSeed } from './core/seed.ts';

export function run(print: (...a: unknown[]) => void = console.log) {
  let now = '2026-10-01T09:00:00Z';
  const p = new Platform(demoSeed(), () => now);
  const u = (id: string) => p.users.get(id)!;
  const aed = (n: number) => `AED ${n.toLocaleString('en', { maximumFractionDigits: 0 })}`;
  const name = (id: string) => p.suppliers.get(id)!.name;
  const step = (title: string) => print(`\n▸ ${title}`);
  const expectError = (fn: () => unknown) => { try { fn(); } catch (e) { return print(`  ✗ blocked: ${(e as Error).message.split('\n').join('\n    ')}`); } throw new Error('expected a control to block this'); };

  step('Guided intake');
  const req = p.intake(u('u-omar'), {
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
  const { package: pkg } = p.decideRequisition(u('u-fatima'), req.id, 'approve');

  step('Sourcing event (ITT, two lots, BOQ imported from Excel CSV)');
  const boq = boqFromCsv([
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
  expectError(() => p.createEvent(u('u-priya'), pkg!.id, { ...setup, invite: ['SUP-FAL', 'SUP-NWD', 'SUP-MER', 'SUP-DUN'] }));
  const ev = p.createEvent(u('u-priya'), pkg!.id, { ...setup, invite: ['SUP-FAL', 'SUP-NWD', 'SUP-ALN', 'SUP-MER'] });
  p.publish(u('u-priya'), ev.id);
  print(`  ${ev.id} published to ${ev.invited.map(name).join(', ')}`);

  step('Clarification → addendum with bid extension');
  const q = p.clarify(u('u-alnoor'), ev.id, 'Is load bank testing part of Lot 1?');
  p.answer(u('u-priya'), ev.id, q.id, 'Yes. Addendum 1 adds it to G2; closing extended.', '2027-01-05T12:00:00Z');
  print(`  Portal view for Falcon: ${JSON.stringify(p.portal(u('u-falcon'), ev.id).clarifications)}`);

  step('Sealed bids');
  now = '2026-12-15T10:00:00Z';
  const line = (lineId: string, rate: number, qty: number, amount = rate * qty) => ({ lineId, rate, amount });
  p.submitBid(u('u-falcon'), ev.id, { currency: 'AED', lines: [line('G1', 2_350_000, 12), line('G2', 1_450_000, 1), line('F1', 2_900_000, 1), line('F2', 1_150_000, 4, 4_500_000)], exclusions: [{ lotId: 'L2', description: 'Fuel first fill' }] });
  p.submitBid(u('u-northwind'), ev.id, { currency: 'EUR', lines: [line('G1', 520_000, 12), line('F1', 760_000, 1), line('F2', 255_000, 4)], deviations: ['Alternative alternator brand (approved-equal requested)'] });
  p.submitBid(u('u-alnoor'), ev.id, { currency: 'AED', lines: [line('G1', 2_050_000, 12), line('G2', 1_100_000, 1), line('F1', 2_450_000, 1), line('F2', 480_000, 4)] });
  p.submitBid(u('u-meridian'), ev.id, { currency: 'USD', lines: [line('G1', 690_000, 12), line('G2', 420_000, 1), line('F1', 760_000, 1), line('F2', 300_000, 4)] });
  expectError(() => p.evaluation(u('u-priya'), ev.id));
  now = '2027-01-05T12:00:01Z';
  p.closeBids(u('u-priya'), ev.id);
  p.openTechnical(u('u-priya'), ev.id);
  print(`  Evaluators see: ${p.technicalPack(u('u-hana'), ev.id).bidders.map(b => b.name).join(', ')}`);

  step('Technical evaluation (blind, conflict declared, consensus)');
  p.declareConflicts(u('u-hana'), ev.id, []);
  p.declareConflicts(u('u-marco'), ev.id, []);
  p.declareConflicts(u('u-aisha'), ev.id, ['SUP-ALN']);
  expectError(() => p.score(u('u-aisha'), ev.id, 'SUP-ALN', 'C1', 7));
  const marks: Record<string, Record<string, number[]>> = { // criterion → [hana, marco, aisha]
    'SUP-MER': { C1: [9, 9, 8], C2: [8, 7, 8], C3: [9, 9, 9], C4: [8, 8, 7] },
    'SUP-FAL': { C1: [8, 7, 8], C2: [7, 7, 6], C3: [7, 8, 7], C4: [8, 7, 8] },
    'SUP-NWD': { C1: [8, 8, 7], C2: [5, 6, 9], C3: [6, 7, 6], C4: [7, 7, 7] },
    'SUP-ALN': { C1: [6, 5], C2: [6, 6], C3: [4, 5], C4: [6, 5] },
  };
  const evaluators = [u('u-hana'), u('u-marco'), u('u-aisha')];
  for (const [supplierId, byCriterion] of Object.entries(marks)) {
    for (const [i, e] of evaluators.entries()) {
      if (supplierId === 'SUP-ALN' && e.id === 'u-aisha') continue;
      p.score(e, ev.id, supplierId, 'C0', 1);
      for (const [c, scores] of Object.entries(byCriterion)) {
        const comment = scores[i] >= 9 && !(e.id === 'u-hana' && c === 'C3') ? 'Exceeds spec; evidence in technical submission vol. 2' : undefined;
        p.score(e, ev.id, supplierId, c, scores[i], comment);
      }
    }
  }
  expectError(() => p.completeTechnical(u('u-daniel'), ev.id));
  p.score(u('u-hana'), ev.id, 'SUP-MER', 'C3', 9, 'Four comparable hyperscale references verified');
  p.moderate(u('u-daniel'), ev.id, 'SUP-NWD', 'C2', 6, 'Committee agreed 6: factory slot letter covers 8 of 12 sets');
  for (const t of p.completeTechnical(u('u-daniel'), ev.id)) print(`  ${name(t.supplierId)}: ${t.score} ${t.qualified ? 'qualified' : 'below threshold'}`);

  step('Commercial evaluation (envelope opens)');
  p.loadExclusion(u('u-tom'), ev.id, 'SUP-FAL', 0, 260_000);
  const result = p.evaluation(u('u-tom'), ev.id);
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
  const award = p.recommend(u('u-priya'), ev.id, 'split_by_lot', `Lot 1 to lowest compliant bidder, Lot 2 with best-value bidder: saves ${aed(best - split.value)} against a single best-value award`);
  print(`  ${award.id} ${aed(award.value)} routed to: ${award.steps.map(s => `${s.role} (${s.reason})`).join(' → ')}`);
  expectError(() => p.decideAward(u('u-rashid'), award.id, 'approved'));
  p.decideAward(u('u-daniel'), award.id, 'approved', 'Endorsed');
  p.decideAward(u('u-fatima'), award.id, 'approved', 'Within budget');
  p.decideAward(u('u-rashid'), award.id, 'approved', 'Approved');
  print(`  Award ${award.status}; event ${ev.status}; contracts ${[...p.contracts.values()].map(c => `${c.id} ${name(c.supplierId)} ${aed(c.value)}`).join(', ')}`);

  step('Dashboard and audit');
  const d = p.dashboard(u('u-daniel'));
  print(`  Pipeline ${JSON.stringify(d.pipeline)}, value in pipeline ${aed(d.valueInPipeline)}, long-lead ${d.longLead}`);
  print(`  At risk: ${d.atRisk.map(a => `${a.title} (${a.health}, ${a.floatDays}d)`).join('; ') || 'none'}`);
  print(`  Savings vs estimate: ${aed(d.savings.saved)} on ${aed(d.savings.baseline)}`);
  print(`  Expiring documents: ${d.expiringDocs.map(x => `${x.supplier} ${x.doc} ${x.expires}`).join('; ')}`);
  print(`  Audit chain: ${p.audit.events.length} events, verify=${JSON.stringify(d.audit)}, head ${p.audit.events.at(-1)!.hash.slice(0, 16)}…`);
  print(`  Package register CSV:\n${p.exportPackages(u('u-daniel')).replace('﻿', '').split('\r\n').map(l => '    ' + l).join('\n')}`);
  return { p, ev, award, result };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) run();
