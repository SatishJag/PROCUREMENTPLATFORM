import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recommend } from '../modules/intake.ts';
import { schedule } from '../modules/planning.ts';

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
