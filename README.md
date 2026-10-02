# Procure.AI

AI-first sourcing and intake layered on Oracle, which stays the system of record for PRs, POs and
payments. Product scope: `PRocurement Platorm.txt` (Source-to-Pay capability map and roadmap).

## Backend in this repo

`procurement_core/` is the shared procurement engine, also used by ConstructionAI. It has no UI;
each product builds its own on the REST API.

- **Vendor PreQual:** vendor × trade qualification graded A to D from a versioned rulebook, with
  separate contractor and consultant profiles, evidence states and rule integrity checks.
- **Bid evaluation:** decision matrix (project complexity × package risk) for eligible grades and
  technical/commercial weights; technical, commercial and composite scores with explanations;
  human review with overrides, segregation of duties and an append-only audit trail.
- **BOQ to PO:** six-gate benchmarking, bid levelling, single and split award scenarios, approval
  routing by authority matrix, and draft POs for Oracle.

Design, scoring model, API and data model: [`procurement_core/README.md`](procurement_core/README.md).
Postgres schema: [`db/schema.sql`](db/schema.sql).

## Run

```
pip install -r requirements-dev.txt
uvicorn app.main:app --reload        # API docs at http://localhost:8000/docs
pytest
```
