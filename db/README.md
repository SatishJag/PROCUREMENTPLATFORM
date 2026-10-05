# db/: PostgreSQL target schema for `payables`

Not wired in. The engine still runs on in-memory `p.table(name)` Maps; this is the target for the `kernel.table` -> Postgres swap.
Plain SQL, no ORM or migration tool. Postgres 14+ (tested on 16 and PGlite).

## Apply (in order, one database)
```
for f in db/schema/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f $f; done
```

## Engine table -> SQL
| Engine table | SQL |
|---|---|
| `contract_terms` | `contract_terms` |
| `ap_ipcs` | `ap_ipc` + `ap_ipc_line`, `_variation`, `_deduction`, `_attachment`; `adjustments` -> `adj_*`; `calc` -> 8 columns |
| `ap_invoices` | `ap_invoice` + `ap_invoice_hold` (`holds[]`, `hold_no` = array position); `calc` -> 8 columns |
| `ap_journals` | `ap_journal` + `ap_journal_line`; `ap_gl_batch` (new: `batchId` becomes a row) |
| `ap_settings` (`cfg`) | `ap_setting` |
| `contracts`, `awards`, `suppliers`, `users`, `projects`, audit log | stubs in `000_reference.sql` (to be generated from module types) |

`Ipc.invoiceId` and `Invoice.journalId` are not columns: read them from `ap_invoice.ipc_id` and `ap_journal.invoice_id`.
Technically invalid IPC payloads (`technicalErrors`) are kept in `ap_ipc.raw`; typed columns and child rows stay empty for them.

## Swap notes
- Ids stay text (`IPC-0001`); `p.id()` needs a per-prefix counter table or sequence, not `serial`.
- `emit` must insert `audit_event` in the same transaction as the state change. Chain continuity (`seq`, `prev`, `hash`) is the app's job; the table is append-only. Verify the chain from app-side values: `data` is jsonb, which reorders keys.
- Rules the DB cannot express stay in the engine: approval limit vs `net_payable`, role checks, "closed_through not in the future" (needs the engine clock), accounted invoice has a journal.

## Not modelled yet
Payments, bank files and reconciliation, FX and multi-currency, multi-entity and intercompany, e-invoicing (Phase 2+). `v_ap_aging` treats every non-rejected invoice as open because nothing can be paid yet.

## Verify
`npm i @electric-sql/pglite` in a scratch folder, then `PGLITE=<scratch>/node_modules/@electric-sql/pglite/dist/index.js node db/verify.mjs`. It applies the three files and asserts the rules and the worked example (gross 1,000,000 to net payable 871,500).
