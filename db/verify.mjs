// Applies db/schema/*.sql to PGlite (Postgres in WASM) and checks the rules. Run: PGLITE=<path to pglite dist/index.js> node db/verify.mjs
import { readFileSync, readdirSync } from 'node:fs';
const { PGlite } = await import(process.env.PGLITE ?? '@electric-sql/pglite');
const dir = new URL('./schema/', import.meta.url);
const db = new PGlite();
for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(new URL(f, dir), 'utf8'));

let bad = 0;
const ok = (name, cond) => { if (!cond) bad++; console.log(cond ? 'ok  ' : 'FAIL', name); };
const fails = async (name, sql, re) => {
  try { await db.exec(sql); ok(name, false); } catch (e) { await db.exec('ROLLBACK').catch(() => {}); ok(`${name} -> ${e.message.slice(0, 70)}`, re.test(e.message)); }
};
const one = async q => (await db.query(q)).rows[0];

await db.exec(`
INSERT INTO project VALUES ('P-1','DC1','Site',10,'{}','{}');
INSERT INTO app_user (id,name,roles,approval_limit) VALUES ('u-pm','Pat','{project_manager}',NULL),('u-fin','Fin','{finance}',100000),('u-exe','Eve','{executive}',9000000);
INSERT INTO supplier VALUES ('S-1','Acme','AE','{civil}','qualified','[]','low',false,80);
INSERT INTO award VALUES ('AW-1','EV-1','base','[]',5000000,'j',false,'u-pm','[]','approved');
INSERT INTO contract VALUES ('C-1','AW-1','S-1','{}',5000000,'draft');
INSERT INTO contract_terms (id,retention_pct,retention_cap,advance_amount,advance_recovery_pct,vat_pct,wht_pct,revised_value) VALUES ('C-1',5,250000,500000,10,5,0,5000000);
INSERT INTO ap_ipc (id,contract_id,project_id,supplier_id,certified_by,staged_at,message_id,ipc_ref,version,period_from,period_to,tax_invoice_no,invoice_date,status,
  gross,retention,advance_recovery,deductions,net_before_tax,vat,wht,net_payable)
 VALUES ('IPC-1','C-1','P-1','S-1','u-pm',now(),'m-1','R1',1,'2026-09-01','2026-09-30','TX-1','2026-09-30','validated',1000000,50000,100000,20000,830000,41500,0,871500);
INSERT INTO ap_ipc_line VALUES ('IPC-1',1,'B1','W1','CC1','Piling','m3',0,1000,1000);`);
const pos = await one('SELECT * FROM v_contract_position');
ok('position pending: certified 0, pending 1,000,000, remaining 5,000,000', +pos.cumulative_certified === 0 && +pos.pending_certified === 1e6 && +pos.remaining_commitment === 5e6);

const inv = `INSERT INTO ap_invoice (id,ipc_id,contract_id,project_id,supplier_id,tax_invoice_no,invoice_date,gross,retention,advance_recovery,deductions,net_before_tax,vat,wht,net_payable,status,prepared_by,certified_by,approved_by)
 VALUES ('INV-1','IPC-1','C-1','P-1','S-1','TX-1','2026-09-30',1000000,50000,100000,20000,830000,41500,0,871500,'approval_required','u-fin','u-pm',NULL);`;
const jrnl = (lines, id = 'JE-1', inv = 'INV-1') => `BEGIN; INSERT INTO ap_journal (id,invoice_id,ipc_id,contract_id,project_id,date,status) VALUES ('${id}','${inv}','IPC-1','C-1','P-1','2026-09-30','pending_transfer');
 INSERT INTO ap_journal_line VALUES ${lines}; COMMIT;`;
const good = `('${'JE-1'}',1,'1410','WIP',1000000,0),('JE-1',2,'1520','Tax',41500,0),('JE-1',3,'2210','Ret',0,50000),('JE-1',4,'1430','Adv',0,100000),('JE-1',5,'4910','Ded',0,20000),('JE-1',6,'2110','AP',0,871500)`;
await db.exec(inv); ok('invoice inserts', true);

await fails('unbalanced journal fails at commit', jrnl(`('JE-1',1,'1410','WIP',1000,0),('JE-1',2,'2110','AP',0,999)`), /does not balance/);
await fails('journal line with both dr and cr', jrnl(`('JE-1',1,'1410','WIP',5,5)`), /violates check/);
await fails('journal without lines fails at commit', `BEGIN; INSERT INTO ap_journal (id,invoice_id,ipc_id,contract_id,project_id,date,status) VALUES ('JE-1','INV-1','IPC-1','C-1','P-1','2026-09-30','pending_transfer'); COMMIT;`, /does not balance/);
await db.exec(jrnl(good)); ok('balanced journal inserts', true);
await fails('second journal for the invoice', jrnl(`('JE-2',1,'1410','WIP',5,0),('JE-2',2,'2110','AP',0,5)`, 'JE-2'), /unique|duplicate/);
await fails('duplicate message_id', `INSERT INTO ap_ipc (id,contract_id,project_id,supplier_id,certified_by,staged_at,message_id,status,errors,raw) VALUES ('IPC-2','C-1','P-1','S-1','u-pm',now(),'m-1','validation_failed','{x}','{}')`, /message_id/);
await fails('duplicate live ipc_ref+version', `INSERT INTO ap_ipc (id,contract_id,project_id,supplier_id,certified_by,staged_at,message_id,ipc_ref,version,period_from,period_to,status,gross,retention,advance_recovery,deductions,net_before_tax,vat,wht,net_payable) VALUES ('IPC-2','C-1','P-1','S-1','u-pm',now(),'m-2','R1',1,'2026-09-01','2026-09-30','validated',1,0,0,0,1,0,0,1)`, /ap_ipc_live/);
await db.exec(`INSERT INTO ap_ipc (id,contract_id,project_id,supplier_id,certified_by,staged_at,message_id,ipc_ref,version,period_from,period_to,status) VALUES ('IPC-3','C-1','P-1','S-1','u-pm',now(),'m-3','R2',1,'2026-09-01','2026-09-30','staged')`);
await fails('duplicate tax invoice (case/space variant, real)', inv.replace("'INV-1'", "'INV-2'").replace("'TX-1'", "' tx-1 '").replace("'IPC-1'", "'IPC-3'").replace("'2026-09-30'", "'2026-09-29'"), /ap_invoice_tax_no/);
await fails('second invoice for the same IPC', inv.replace("'INV-1'", "'INV-2'").replace("'TX-1'", "'TX-9'").replace("'2026-09-30'", "'2026-09-29'"), /ipc_id/);
await fails('self-approval (preparer)', 'UPDATE ap_invoice SET approved_by = prepared_by, status = \'approved\'', /violates check/);
await fails('self-approval (certifier)', 'UPDATE ap_invoice SET approved_by = certified_by, status = \'approved\'', /violates check/);
await fails('wrong net payable', `UPDATE ap_invoice SET net_payable = 871000`, /violates check/);
await db.exec(`UPDATE ap_invoice SET approved_by = 'u-exe', status = 'approved'`); ok('approval by another user', true);

await db.exec(`UPDATE contract_terms SET certified = 1000000, retained = 50000, advance_recovered = 100000; UPDATE ap_ipc SET status = 'accounted' WHERE id = 'IPC-1'; UPDATE ap_invoice SET status = 'accounted'`);
const p2 = await one('SELECT * FROM v_contract_position');
ok('position accounted: remaining 4,000,000, retention 50,000, advance balance 400,000, pending 0', +p2.remaining_commitment === 4e6 && +p2.retention_balance === 5e4 && +p2.advance_balance === 4e5 && +p2.pending_certified === 0);
await fails('retained above cap', `UPDATE contract_terms SET retained = 250000.01`, /violates check/);
await fails('transferred without batch', `UPDATE ap_journal SET status = 'transferred'`, /violates check/);
ok('v_gl_pending has 6 lines', (await db.query('SELECT 1 FROM v_gl_pending')).rows.length === 6);
await db.exec(`INSERT INTO ap_gl_batch VALUES ('GL-1','u-fin',now()); UPDATE ap_journal SET status = 'transferred', batch_id = 'GL-1'`); ok('journal transfers with a batch', true);
await fails('transferred journal update', `UPDATE ap_journal SET date = '2026-01-01'`, /transferred/);
await fails('transferred line update', `UPDATE ap_journal_line SET dr = dr + 1 WHERE line_no = 1`, /transferred/);
await fails('transferred line delete', `DELETE FROM ap_journal_line`, /transferred/);
ok('v_gl_pending empty after export', (await db.query('SELECT 1 FROM v_gl_pending')).rows.length === 0);
await db.exec('UPDATE ap_invoice SET invoice_date = current_date - 95');
ok('aging bucket 90+ holds the open invoice', +(await one('SELECT d90_plus FROM v_ap_aging')).d90_plus === 871500);

await db.exec(`INSERT INTO ap_setting VALUES ('cfg','2026-08-31'); UPDATE ap_setting SET closed_through = '2026-09-30'`);
await fails('closed_through decreases', `UPDATE ap_setting SET closed_through = '2026-09-29'`, /cannot be reopened/);
await fails('audit event update', `INSERT INTO audit_event VALUES (1,'t','a','x','e','{}','GENESIS','h'); UPDATE audit_event SET actor = 'z'`, /append-only/);
console.log(bad ? `${bad} FAILED` : 'all passed'); process.exit(bad ? 1 : 0);
