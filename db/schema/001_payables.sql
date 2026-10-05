-- Construction AP, phase 1. Mirrors core modules/payables.ts (tables contract_terms, ap_ipcs, ap_invoices, ap_journals, ap_settings).
-- Not stored (derived): Ipc.invoiceId = ap_invoice.ipc_id, Invoice.journalId = ap_journal.invoice_id.

CREATE TABLE contract_terms (
  id text PRIMARY KEY REFERENCES contract, -- contract id
  retention_pct pct NOT NULL, retention_cap aed NOT NULL CHECK (retention_cap >= 0),
  advance_amount aed NOT NULL CHECK (advance_amount >= 0), advance_recovery_pct pct NOT NULL,
  vat_pct pct NOT NULL, wht_pct pct NOT NULL, revised_value aed NOT NULL CHECK (revised_value > 0),
  -- accounted position, owned by the engine
  certified aed NOT NULL DEFAULT 0 CHECK (certified >= 0), retained aed NOT NULL DEFAULT 0 CHECK (retained >= 0),
  advance_recovered aed NOT NULL DEFAULT 0 CHECK (advance_recovered >= 0),
  CHECK (certified <= revised_value), CHECK (retained <= retention_cap), CHECK (advance_recovered <= advance_amount)
);

-- Technically invalid payloads (see technicalErrors) cannot fit typed columns: the app stores them in raw and leaves typed
-- columns and child rows empty. A payload that passed technical validation always fills them.
CREATE TABLE ap_ipc (
  id text PRIMARY KEY,
  contract_id text NOT NULL REFERENCES contract, project_id text NOT NULL REFERENCES project, supplier_id text NOT NULL REFERENCES supplier,
  certified_by text NOT NULL REFERENCES app_user, staged_at timestamptz NOT NULL,
  message_id text NOT NULL UNIQUE, -- global: a resend is recognised by stageIpc
  ipc_ref text, version integer CHECK (version >= 1), period_from date, period_to date,
  tax_invoice_no text CHECK (btrim(tax_invoice_no) <> ''), invoice_date date,
  adj_material_on_site aed CHECK (adj_material_on_site >= 0), adj_retention aed CHECK (adj_retention >= 0), adj_advance_recovery aed CHECK (adj_advance_recovery >= 0),
  status text NOT NULL CHECK (status IN ('staged','validated','validation_failed','invoiced','rejected','withdrawn','accounted')),
  errors text[] NOT NULL DEFAULT '{}',
  gross aed, retention aed CHECK (retention >= 0), advance_recovery aed CHECK (advance_recovery >= 0), deductions aed CHECK (deductions >= 0),
  net_before_tax aed, vat aed CHECK (vat >= 0), wht aed CHECK (wht >= 0), net_payable aed,
  raw jsonb,
  UNIQUE (id, contract_id, project_id, supplier_id, certified_by),
  CHECK (raw IS NOT NULL OR (ipc_ref IS NOT NULL AND version IS NOT NULL AND period_from IS NOT NULL AND period_to IS NOT NULL)),
  CHECK (period_from <= period_to),
  CHECK ((status = 'validation_failed') = (cardinality(errors) > 0)),
  CHECK (num_nonnulls(gross, retention, advance_recovery, deductions, net_before_tax, vat, wht, net_payable) IN (0, 8)),
  CHECK (status NOT IN ('validated','invoiced','accounted','rejected','withdrawn') OR gross IS NOT NULL),
  CHECK (abs(net_before_tax - (gross - retention - advance_recovery - deductions)) <= 0.01
     AND abs(net_payable - (net_before_tax + vat - wht)) <= 0.01)
);
CREATE UNIQUE INDEX ap_ipc_live ON ap_ipc (contract_id, ipc_ref, version) WHERE status IN ('validated','invoiced','accounted');
CREATE INDEX ap_ipc_project_status ON ap_ipc (project_id, status);
CREATE INDEX ap_ipc_contract ON ap_ipc (contract_id);

-- Quantities and rates are unconstrained numeric: the engine rounds money per line, not the inputs.
CREATE TABLE ap_ipc_line (
  ipc_id text NOT NULL REFERENCES ap_ipc, line_no integer NOT NULL, boq_item text NOT NULL, wbs text NOT NULL, cost_code text NOT NULL,
  description text NOT NULL DEFAULT '', uom text NOT NULL,
  prev_qty numeric NOT NULL CHECK (prev_qty >= 0), curr_qty numeric NOT NULL CHECK (curr_qty >= 0), rate numeric NOT NULL CHECK (rate >= 0),
  PRIMARY KEY (ipc_id, line_no)
);
CREATE TABLE ap_ipc_variation ( -- amount may be negative (omission)
  ipc_id text NOT NULL REFERENCES ap_ipc, line_no integer NOT NULL, ref text NOT NULL, amount aed NOT NULL, PRIMARY KEY (ipc_id, line_no)
);
CREATE TABLE ap_ipc_deduction (
  ipc_id text NOT NULL REFERENCES ap_ipc, line_no integer NOT NULL, type text NOT NULL, amount aed NOT NULL CHECK (amount > 0), PRIMARY KEY (ipc_id, line_no)
);
CREATE TABLE ap_ipc_attachment (
  ipc_id text NOT NULL REFERENCES ap_ipc, line_no integer NOT NULL, type text NOT NULL, name text NOT NULL, PRIMARY KEY (ipc_id, line_no)
);

CREATE TABLE ap_invoice (
  id text PRIMARY KEY,
  ipc_id text NOT NULL UNIQUE, -- one invoice per IPC
  contract_id text NOT NULL, project_id text NOT NULL, supplier_id text NOT NULL,
  tax_invoice_no text CHECK (btrim(tax_invoice_no) <> ''), invoice_date date NOT NULL,
  gross aed NOT NULL CHECK (gross > 0), retention aed NOT NULL CHECK (retention >= 0), advance_recovery aed NOT NULL CHECK (advance_recovery >= 0),
  deductions aed NOT NULL CHECK (deductions >= 0), net_before_tax aed NOT NULL CHECK (net_before_tax >= 0),
  vat aed NOT NULL CHECK (vat >= 0), wht aed NOT NULL CHECK (wht >= 0), net_payable aed NOT NULL,
  status text NOT NULL CHECK (status IN ('approval_required','approved','accounted','on_hold','rejected')),
  prepared_by text NOT NULL REFERENCES app_user, certified_by text NOT NULL REFERENCES app_user, approved_by text REFERENCES app_user,
  approval_comment text, rejected_reason text,
  FOREIGN KEY (ipc_id, contract_id, project_id, supplier_id, certified_by) REFERENCES ap_ipc (id, contract_id, project_id, supplier_id, certified_by),
  UNIQUE (id, ipc_id, contract_id, project_id),
  CHECK (abs(net_before_tax - (gross - retention - advance_recovery - deductions)) <= 0.01
     AND abs(net_payable - (net_before_tax + vat - wht)) <= 0.01),
  CHECK (prepared_by <> approved_by AND certified_by <> approved_by), -- segregation of duties (approval limit stays in the engine)
  CHECK ((approved_by IS NOT NULL) = (status IN ('approved','accounted'))), -- a hold clears the approval
  CHECK ((status = 'rejected') = (rejected_reason IS NOT NULL))
);
CREATE UNIQUE INDEX ap_invoice_tax_no ON ap_invoice (supplier_id, lower(btrim(tax_invoice_no, E' \t\r\n'))) WHERE tax_invoice_no IS NOT NULL AND status <> 'rejected';
CREATE UNIQUE INDEX ap_invoice_amount_date ON ap_invoice (supplier_id, net_payable, invoice_date) WHERE status <> 'rejected'; -- createInvoice duplicate rule
CREATE INDEX ap_invoice_project_status ON ap_invoice (project_id, status);
CREATE INDEX ap_invoice_supplier ON ap_invoice (supplier_id);

-- hold_no is the position in Invoice.holds; the primary key serves lookups by invoice.
CREATE TABLE ap_invoice_hold (
  invoice_id text NOT NULL REFERENCES ap_invoice, hold_no integer NOT NULL,
  reason text NOT NULL, owner_id text NOT NULL REFERENCES app_user, placed_by text NOT NULL REFERENCES app_user, placed_on date NOT NULL,
  release_condition text NOT NULL, release_authority text NOT NULL,
  released_by text REFERENCES app_user, released_on date, release_comment text,
  PRIMARY KEY (invoice_id, hold_no),
  CHECK (num_nonnulls(released_by, released_on, release_comment) IN (0, 3)),
  CHECK (released_by IS NULL OR released_by = owner_id OR released_by <> placed_by) -- only the owner, or someone other than the placer
);
CREATE UNIQUE INDEX ap_invoice_hold_open ON ap_invoice_hold (invoice_id) WHERE released_by IS NULL; -- one open hold at a time

CREATE TABLE ap_gl_batch (id text PRIMARY KEY, exported_by text NOT NULL REFERENCES app_user, exported_at timestamptz NOT NULL);

CREATE TABLE ap_journal (
  id text PRIMARY KEY,
  invoice_id text NOT NULL UNIQUE, ipc_id text NOT NULL, contract_id text NOT NULL, project_id text NOT NULL, -- one journal per invoice
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('pending_transfer','transferred')), batch_id text REFERENCES ap_gl_batch,
  FOREIGN KEY (invoice_id, ipc_id, contract_id, project_id) REFERENCES ap_invoice (id, ipc_id, contract_id, project_id),
  CHECK ((status = 'transferred') = (batch_id IS NOT NULL))
);
CREATE INDEX ap_journal_status ON ap_journal (status);
CREATE INDEX ap_journal_batch ON ap_journal (batch_id);

CREATE TABLE ap_journal_line (
  journal_id text NOT NULL REFERENCES ap_journal, line_no integer NOT NULL, account text NOT NULL, name text NOT NULL,
  dr aed NOT NULL DEFAULT 0 CHECK (dr >= 0), cr aed NOT NULL DEFAULT 0 CHECK (cr >= 0),
  PRIMARY KEY (journal_id, line_no),
  CHECK ((dr > 0) <> (cr > 0)) -- exactly one side
);

-- Balanced at commit: lines and journal may be inserted in any order inside the transaction.
CREATE FUNCTION ap_journal_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE jid text := (CASE TG_OP WHEN 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END) ->> TG_ARGV[0]; d numeric; c numeric; n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ap_journal WHERE id = jid) THEN RETURN NULL; END IF;
  SELECT coalesce(sum(dr), 0), coalesce(sum(cr), 0), count(*) INTO d, c, n FROM ap_journal_line WHERE journal_id = jid;
  IF n = 0 OR d <> c THEN RAISE EXCEPTION 'journal % does not balance: debits %, credits %, lines %', jid, d, c, n; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER ap_journal_balanced AFTER INSERT ON ap_journal DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ap_journal_balanced('id');
CREATE CONSTRAINT TRIGGER ap_journal_line_balanced AFTER INSERT OR UPDATE OR DELETE ON ap_journal_line DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ap_journal_balanced('journal_id');

-- Transferred journals went to the GL: no edits. The pending -> transferred update passes because the stored status is still pending.
CREATE FUNCTION ap_journal_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE jid text := (CASE TG_OP WHEN 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END) ->> TG_ARGV[0];
BEGIN
  IF EXISTS (SELECT 1 FROM ap_journal WHERE id = jid AND status = 'transferred') THEN RAISE EXCEPTION 'journal % is transferred and cannot change', jid; END IF;
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER ap_journal_frozen BEFORE UPDATE OR DELETE ON ap_journal FOR EACH ROW EXECUTE FUNCTION ap_journal_frozen('id');
CREATE TRIGGER ap_journal_line_frozen BEFORE INSERT OR UPDATE OR DELETE ON ap_journal_line FOR EACH ROW EXECUTE FUNCTION ap_journal_frozen('journal_id');

CREATE TABLE ap_setting (id text PRIMARY KEY CHECK (id = 'cfg'), closed_through date);
-- Periods only close forward. "Not later than today" depends on the engine clock (p.today), so it cannot be a DDL rule: the engine keeps it.
CREATE FUNCTION ap_setting_forward() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.closed_through IS NOT NULL AND (NEW.closed_through IS NULL OR NEW.closed_through < OLD.closed_through) THEN
    RAISE EXCEPTION 'periods are closed through % and cannot be reopened', OLD.closed_through; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ap_setting_forward BEFORE UPDATE ON ap_setting FOR EACH ROW EXECUTE FUNCTION ap_setting_forward();
