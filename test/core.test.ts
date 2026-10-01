import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from '../demo.ts';
import { decide, routeApproval } from '../core/approvals.ts';
import { AuditLog } from '../core/audit.ts';
import { parseCsv, toCsv } from '../core/csv.ts';
import { normalize, rank, technical, validateCriteria } from '../core/evaluation.ts';
import { recommend } from '../core/intake.ts';
import { schedule } from '../core/planning.ts';
import type { Award, SourcingEvent, User } from '../core/types.ts';

const quiet = () => {};

test('end-to-end: intake to awarded contracts, audit chain intact', () => {
  const { p, ev, award, result } = run(quiet);
  assert.equal(ev.status, 'awarded');
  assert.equal(award.status, 'approved');
  assert.deepEqual(result.ranking.map(r => r.supplierId), ['SUP-MER', 'SUP-NWD', 'SUP-FAL']); // Al Noor below threshold
  assert.equal(award.value, 35_447_750);
  assert.equal(p.projects.get('DC1')!.committed['26-32-00'], 35_447_750);
  assert.equal(p.contracts.size, 2);
  assert.deepEqual(p.audit.verify(), { ok: true });
});

test('normalization: arithmetic correction, FX, scope-gap loading, low-bid and collusion flags', () => {
  const ev = {
    lots: [{ id: 'L1', name: 'Lot 1' }],
    boq: [{ id: 'A', lotId: 'L1', item: 'Item A', unit: 'nr', qty: 10 }, { id: 'B', lotId: 'L1', item: 'Item B', unit: 'nr', qty: 1 }],
    bids: [
      { supplierId: 'S1', currency: 'AED', lines: [{ lineId: 'A', rate: 100, amount: 900 }, { lineId: 'B', rate: 50, amount: 50 }], exclusions: [] },
      { supplierId: 'S2', currency: 'USD', lines: [{ lineId: 'A', rate: 30, amount: 300 }], exclusions: [] },
      { supplierId: 'S3', currency: 'AED', lines: [{ lineId: 'A', rate: 100, amount: 1000 }, { lineId: 'B', rate: 30, amount: 30 }], exclusions: [{ lotId: 'L1', description: 'Freight', addBack: 20 }] },
      { supplierId: 'S4', currency: 'AED', lines: [{ lineId: 'A', rate: 40, amount: 400 }, { lineId: 'B', rate: 40, amount: 40 }], exclusions: [] },
    ],
  } as unknown as SourcingEvent;
  const [s1, s2, s3, s4] = normalize(ev, { AED: 1, USD: 3.5 });
  assert.equal(s1.total, 1050);                 // 900 corrected to 1000 (rate governs) + 50
  assert.match(s1.adjustments[0], /arithmetic corrected/);
  assert.equal(s2.total, 1100);                 // 30 USD × 10 × 3.5 = 1050, + B loaded at highest other rate 50
  assert.equal(s3.total, 1050);                 // 1000 + 30 + 20 exclusion add-back
  assert.equal(s4.total, 440);
  assert.ok(s4.anomalies.some(a => /abnormally low/.test(a)));
  assert.ok(s4.anomalies.some(a => /unit rate -60%/.test(a)));
  assert.ok(s1.anomalies.some(a => /collusion-risk/.test(a)));  // S1 and S3 land on the same total
  assert.equal(s2.anomalies.length, 0);
});

test('technical: gates disqualify, quorum and evidence are enforced, ranking uses lowest compliant price', () => {
  const ev = {
    criteria: [{ id: 'G', name: 'HSE', weight: 0, gate: true }, { id: 'Q', name: 'Quality', weight: 100 }],
    techThreshold: 50, quorum: 2, moderations: [], declarations: {},
    bids: [{ supplierId: 'S1' }, { supplierId: 'S2' }, { supplierId: 'S3' }],
    scores: [
      ...['e1', 'e2'].flatMap(e => [{ evaluatorId: e, supplierId: 'S1', criterionId: 'G', score: 1 }, { evaluatorId: e, supplierId: 'S1', criterionId: 'Q', score: 8 }]),
      ...['e1', 'e2'].flatMap(e => [{ evaluatorId: e, supplierId: 'S2', criterionId: 'G', score: 0, comment: 'No HSE plan' }, { evaluatorId: e, supplierId: 'S2', criterionId: 'Q', score: 7 }]),
      { evaluatorId: 'e1', supplierId: 'S3', criterionId: 'G', score: 1 }, { evaluatorId: 'e1', supplierId: 'S3', criterionId: 'Q', score: 10 },
    ],
  } as unknown as SourcingEvent;
  const [s1, s2, s3] = technical(ev);
  assert.equal(s1.score, 80);
  assert.equal(s1.qualified, true);
  assert.equal(s2.gatesPassed, false);
  assert.equal(s2.qualified, false);
  assert.equal(s3.complete, false);              // one evaluator, quorum 2
  const ranking = rank([s1, s2], [{ supplierId: 'S1', total: 200 }, { supplierId: 'S2', total: 100 }] as never, 0.5);
  assert.deepEqual(ranking.map(r => [r.supplierId, r.commercial]), [['S1', 100]]); // S2's cheaper price ignored: failed gate
  assert.throws(() => validateCriteria([{ id: 'a', name: 'a', weight: 60 }, { id: 'b', name: 'b', weight: 30 }]), /total 100/);
});

test('approvals: DOA bands, conditional steps, sequence, segregation of duties, authority limit', () => {
  assert.deepEqual(routeApproval(400_000).map(s => s.role), ['procurement_manager']);
  assert.deepEqual(routeApproval(400_000, { overBudget: true, deviation: true }).map(s => s.role), ['procurement_manager', 'budget_owner', 'executive']);
  const award = { value: 2_000_000, status: 'pending', recommendedBy: 'buyer', steps: routeApproval(2_000_000) } as Award;
  const pm: User = { id: 'pm', name: 'PM', roles: ['procurement_manager'], projects: ['*'] };
  const bo: User = { id: 'bo', name: 'BO', roles: ['budget_owner'], projects: ['*'], approvalLimit: 1_000_000 };
  assert.throws(() => decide(award, bo, 'approved', '', 't', []), /Awaiting procurement_manager/);
  assert.throws(() => decide(award, pm, 'approved', '', 't', ['pm']), /Segregation of duties/);
  decide(award, pm, 'approved', '', 't', []);
  assert.throws(() => decide(award, bo, 'approved', '', 't', []), /authority limit/);
  assert.throws(() => decide(award, bo, 'rejected', ' ', 't', []), /needs a reason/);
  decide(award, bo, 'rejected', 'Over market', 't', []);
  assert.equal(award.status, 'rejected');
});

test('intake and planning: route by value and category, backward schedule', () => {
  assert.equal(recommend('Office stationery', 20_000).route, 'Direct PO');
  assert.equal(recommend('Commissioning agent advisory services', 200_000).route, 'RFP');
  const r = recommend('UPS batteries replacement', 3_000_000);
  assert.equal(r.category, 'Electrical / UPS');
  assert.equal(r.longLead, true);
  const s = schedule('2027-06-30', 'RFQ', 10, false, '2026-10-01');
  assert.deepEqual(s.milestones.map(m => m.date), ['2027-03-17', '2027-03-31', '2027-04-07', '2027-04-21', '2027-06-30']);
  assert.equal(s.health, 'on_track');
});

test('audit: tampering with any event breaks the chain', () => {
  const log = new AuditLog();
  log.append('u1', 'bid.submitted', 'EV-1', { total: 100 }, '2026-10-01T00:00:00Z');
  log.append('u2', 'award.approved', 'AW-1', { value: 100 }, '2026-10-02T00:00:00Z');
  assert.deepEqual(log.verify(), { ok: true });
  (log.events[0].data as { total: number }).total = 90;
  assert.deepEqual(log.verify(), { ok: false, brokenAt: 1 });
});

test('csv: quotes, commas, newlines round-trip; formulas neutralised', () => {
  const rows = [{ item: 'Panel, "MV"\nType 2', qty: 4, note: '=HYPERLINK("x")' }];
  const csv = toCsv(rows);
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
  assert.deepEqual(parseCsv(csv), [{ item: 'Panel, "MV"\nType 2', qty: '4', note: `'=HYPERLINK("x")` }]);
});
