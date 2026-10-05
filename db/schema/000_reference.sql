-- Reference stubs: only what the payables tables point at.
-- ponytail: hand-written to match core/types.ts; generate from each module's types when those modules move to Postgres.
-- Ids are text in the engine's PREFIX-0001 format. Dates are ISO strings in the engine, date/timestamptz here.

CREATE DOMAIN aed AS numeric(18,2);
CREATE DOMAIN pct AS numeric(5,2) CHECK (VALUE BETWEEN 0 AND 100);

CREATE TABLE project (
  id text PRIMARY KEY, name text NOT NULL, site text NOT NULL, capacity_mw numeric NOT NULL,
  budgets jsonb NOT NULL DEFAULT '{}', committed jsonb NOT NULL DEFAULT '{}' -- cost code -> AED
);

CREATE TABLE app_user (
  id text PRIMARY KEY, name text NOT NULL,
  roles text[] NOT NULL DEFAULT '{}' CHECK (roles <@ ARRAY['requester','project_manager','buyer','procurement_manager','category_manager',
    'technical_evaluator','commercial_evaluator','legal','finance','budget_owner','executive','compliance_reviewer','expeditor','admin','auditor','supplier']),
  approval_limit aed, supplier_id text -- supplier portal tenant key; FK added once supplier is generated
);
-- project_id '*' means all projects, so it is deliberately not a foreign key.
CREATE TABLE user_project (user_id text NOT NULL REFERENCES app_user, project_id text NOT NULL, PRIMARY KEY (user_id, project_id));

CREATE TABLE supplier (
  id text PRIMARY KEY, name text NOT NULL, country text NOT NULL, categories text[] NOT NULL DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('invited','registered','qualified','suspended','rejected')),
  docs jsonb NOT NULL DEFAULT '[]', risk text NOT NULL CHECK (risk IN ('low','medium','high')),
  sanctioned boolean NOT NULL DEFAULT false, performance numeric NOT NULL CHECK (performance BETWEEN 0 AND 100)
);

CREATE TABLE award ( -- event_id has no FK: sourcing events are not modelled yet
  id text PRIMARY KEY, event_id text NOT NULL, scenario text NOT NULL, allocations jsonb NOT NULL, value aed NOT NULL,
  justification text NOT NULL, deviation boolean NOT NULL, recommended_by text NOT NULL REFERENCES app_user,
  steps jsonb NOT NULL, status text NOT NULL CHECK (status IN ('pending','approved','rejected'))
);

CREATE TABLE contract (
  id text PRIMARY KEY, award_id text NOT NULL REFERENCES award, supplier_id text NOT NULL REFERENCES supplier,
  lot_ids text[] NOT NULL DEFAULT '{}', value aed NOT NULL, status text NOT NULL CHECK (status = 'draft')
);

-- Hash chain from core/audit.ts. "at" and "entity" stay text and "data" must be written by the app together with "hash":
-- jsonb reorders keys, so verify() has to run in the app on the values it computed, not on a re-serialised jsonb.
CREATE TABLE audit_event (
  seq bigint PRIMARY KEY, at text NOT NULL, actor text NOT NULL, action text NOT NULL, entity text NOT NULL,
  data jsonb NOT NULL, prev text NOT NULL, hash text NOT NULL UNIQUE
);
CREATE INDEX audit_event_entity ON audit_event (entity);

CREATE FUNCTION audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_event is append-only'; END $$;
CREATE TRIGGER audit_event_immutable BEFORE UPDATE OR DELETE ON audit_event FOR EACH ROW EXECUTE FUNCTION audit_append_only();
