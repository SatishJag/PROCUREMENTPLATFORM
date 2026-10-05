-- Same arithmetic as contractPosition() in payables.ts. Open IPCs (validated, invoiced) still consume headroom.
CREATE VIEW v_contract_position AS
SELECT t.id AS contract_id, t.revised_value, t.certified AS cumulative_certified,
  coalesce(p.gross, 0)::aed AS pending_certified, (t.revised_value - t.certified)::aed AS remaining_commitment,
  t.retained AS retention_balance, (t.advance_amount - t.advance_recovered)::aed AS advance_balance
FROM contract_terms t
LEFT JOIN (SELECT contract_id, sum(gross) AS gross FROM ap_ipc WHERE status IN ('validated','invoiced') GROUP BY contract_id) p ON p.contract_id = t.id;

-- No payments exist yet (phase 2), so every non-rejected invoice is open. Age is measured from invoice date to the database date.
CREATE VIEW v_ap_aging AS
SELECT supplier_id,
  coalesce(sum(net_payable) FILTER (WHERE age <= 30), 0)::aed AS d0_30,
  coalesce(sum(net_payable) FILTER (WHERE age BETWEEN 31 AND 60), 0)::aed AS d31_60,
  coalesce(sum(net_payable) FILTER (WHERE age BETWEEN 61 AND 90), 0)::aed AS d61_90,
  coalesce(sum(net_payable) FILTER (WHERE age > 90), 0)::aed AS d90_plus,
  sum(net_payable)::aed AS total
FROM (SELECT supplier_id, net_payable, current_date - invoice_date AS age FROM ap_invoice WHERE status <> 'rejected') o
GROUP BY supplier_id;

-- Rows of the next GL export CSV (columns as in csvOf; batch is assigned at export).
CREATE VIEW v_gl_pending AS
SELECT j.id AS journal, j.date, l.account, l.name, l.dr AS debit, l.cr AS credit, j.invoice_id AS invoice, j.ipc_id AS ipc, j.contract_id AS contract, j.project_id AS project
FROM ap_journal j JOIN ap_journal_line l ON l.journal_id = j.id
WHERE j.status = 'pending_transfer' ORDER BY j.id, l.line_no;
