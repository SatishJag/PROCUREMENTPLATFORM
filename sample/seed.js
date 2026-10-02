import { planning } from '@satishjag/procurement-core';
// Sample data: a fictional 24 MW data-centre programme. All names are invented.
const SEEDED_ON = '2026-10-01';
const GEN = 'Electrical / Generators';
const valid = (until = '2028-06-30') => [
    { type: 'trade_licence', expires: until },
    { type: 'insurance', expires: until },
    { type: 'tax_certificate', expires: until },
];
const users = [
    { id: 'u-omar', name: 'Omar Siddiqui', roles: ['requester'], projects: ['DC1'] },
    { id: 'u-priya', name: 'Priya Raman', roles: ['buyer'], projects: ['DC1'] },
    { id: 'u-daniel', name: 'Daniel Okafor', roles: ['procurement_manager'], projects: ['*'], approvalLimit: 500_000 },
    { id: 'u-hana', name: 'Hana Kobayashi', roles: ['technical_evaluator'], projects: ['DC1'] },
    { id: 'u-marco', name: 'Marco Bianchi', roles: ['technical_evaluator'], projects: ['DC1'] },
    { id: 'u-aisha', name: 'Aisha Rahman', roles: ['technical_evaluator'], projects: ['DC1'] },
    { id: 'u-tom', name: 'Tom Weller', roles: ['commercial_evaluator'], projects: ['DC1'] },
    { id: 'u-fatima', name: 'Fatima Al Mansoori', roles: ['budget_owner'], projects: ['DC1'], approvalLimit: 5_000_000 },
    { id: 'u-rashid', name: 'Rashid Khan', roles: ['executive'], projects: ['*'], approvalLimit: 100_000_000 },
    { id: 'u-grace', name: 'Grace Lindqvist', roles: ['auditor'], projects: ['*'] },
    { id: 'u-falcon', name: 'Falcon bid desk', roles: ['supplier'], projects: [], supplierId: 'SUP-FAL' },
    { id: 'u-northwind', name: 'Northwind bid desk', roles: ['supplier'], projects: [], supplierId: 'SUP-NWD' },
    { id: 'u-alnoor', name: 'Al Noor bid desk', roles: ['supplier'], projects: [], supplierId: 'SUP-ALN' },
    { id: 'u-meridian', name: 'Meridian bid desk', roles: ['supplier'], projects: [], supplierId: 'SUP-MER' },
];
const suppliers = [
    { id: 'SUP-FAL', name: 'Falcon Gensets FZE', country: 'AE', categories: [GEN], status: 'qualified', docs: valid(), risk: 'low', sanctioned: false, performance: 82 },
    { id: 'SUP-NWD', name: 'Northwind Power Industries GmbH', country: 'DE', categories: [GEN], status: 'qualified', docs: valid(), risk: 'medium', sanctioned: false, performance: 77 },
    {
        id: 'SUP-ALN', name: 'Al Noor Electromechanical LLC', country: 'AE', categories: [GEN, 'Mechanical / Cooling'], status: 'qualified',
        docs: [...valid().filter(d => d.type !== 'insurance'), { type: 'insurance', expires: '2026-10-20' }], risk: 'medium', sanctioned: false, performance: 71,
    },
    { id: 'SUP-MER', name: 'Meridian Energy Systems Inc', country: 'US', categories: [GEN], status: 'qualified', docs: valid(), risk: 'low', sanctioned: false, performance: 85 },
    {
        id: 'SUP-DUN', name: 'Dune Thermal Solutions', country: 'AE', categories: [GEN, 'Mechanical / Cooling'], status: 'qualified',
        docs: [...valid().filter(d => d.type !== 'trade_licence'), { type: 'trade_licence', expires: '2026-08-31' }], risk: 'low', sanctioned: false, performance: 74,
    },
    { id: 'SUP-CST', name: 'Coastline Power Trading', country: 'AE', categories: [GEN], status: 'registered', docs: valid(), risk: 'high', sanctioned: false, performance: 0 },
];
const pkg = (p) => {
    const { leadWeeks, prequal, ...rest } = p;
    return { ...rest, longLead: leadWeeks >= 26, schedule: planning.schedule(p.needBy, p.route, leadWeeks, prequal, SEEDED_ON) };
};
const packages = [
    pkg({ id: 'PKG-CHW', projectId: 'DC1', costCode: '23-64-00', title: 'Chilled water plant, 6 x 1,800 kW chillers', category: 'Mechanical / Cooling', estimate: 31_500_000, needBy: '2027-09-15', route: 'ITT', status: 'sourcing', leadWeeks: 40, prequal: true }),
    pkg({ id: 'PKG-UPS', projectId: 'DC1', costCode: '26-33-00', title: 'UPS systems, 2N, 12 x 1,200 kVA', category: 'Electrical / UPS', estimate: 20_800_000, needBy: '2027-04-30', route: 'ITT', status: 'awarded', awardedValue: 19_400_000, leadWeeks: 26, prequal: true }),
    pkg({ id: 'PKG-CAB', projectId: 'DC1', costCode: '27-10-00', title: 'Structured cabling and containment, data halls 1-2', category: 'IT / Structured Cabling', estimate: 4_200_000, needBy: '2027-01-20', route: 'RFP', status: 'planned', leadWeeks: 10, prequal: false }),
    pkg({ id: 'PKG-MV', projectId: 'DC1', costCode: '26-11-00', title: 'MV switchgear and 6 x 3 MVA transformers', category: 'Electrical / MV Switchgear', estimate: 16_900_000, needBy: '2027-12-01', route: 'ITT', status: 'planned', leadWeeks: 36, prequal: true }),
];
const projects = [{
        id: 'DC1', name: 'Data Centre DC1, Phase 1', site: 'Dubai South (sample)', capacityMW: 24,
        budgets: { '26-32-00': 48_000_000, '23-64-00': 36_000_000, '26-33-00': 22_000_000, '26-11-00': 18_000_000, '27-10-00': 6_500_000, '01-41-00': 3_000_000 },
        committed: { '26-33-00': 19_400_000, '01-41-00': 1_150_000 },
    }];
export function demoSeed() {
    return {
        tables: { users, suppliers, packages, projects },
        fx: { AED: 1, USD: 3.6725, EUR: 4.28 }, // AED per unit, sample rates
    };
}
