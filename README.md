# Procurement Platform: capability core

This is the Source-to-Contract engine behind the platform described in `PRocurement Platorm.txt`. It covers the requirement's recommended first release: **procurement planning through award, supplier onboarding, technical and commercial evaluation, and contract handoff**, all in one auditable workflow.

There is no UI yet (that's next). Everything here is TypeScript with **no runtime dependencies**. Node 22.18+ runs it directly, with no build step. Architecture, conventions and the multi-agent team are in [`CLAUDE.md`](CLAUDE.md).

```bash
npm test            # 10 checks: end-to-end flow, money paths, approvals, audit tamper, CSV safety, kernel, API
npm run demo        # walks a 24 MW data-centre generator ITT from intake to signed-off award
npm run api         # JSON RPC on http://127.0.0.1:8787/api (GET /api lists commands)
npm i && npm run typecheck
```

## Capability map (Phase 1)

| Capability | Module | What is enforced |
|---|---|---|
| Identity and access | `core/workflow.ts` | Role, project scope and value authority on every command. Suppliers are isolated to events they're invited to and can see only their own bid. |
| Workflow configuration | `core/workflow.ts` + each module | Requisition, sourcing-event and supplier lifecycles are Flow tables in their modules that an admin edits: stages, transitions and allowed roles. |
| Guided intake | `modules/intake.ts` | Free text plus value becomes a requisition. It gets a category (with evidence and confidence), a route (Direct PO / RFQ / RFP / ITT, minimum bidders, envelopes, prequal) and a budget check against the cost code. |
| Procurement planning | `modules/planning.ts` | Backward schedule from the required-on-site date and category lead time, a long-lead flag, and float with on track / at risk / late status. |
| Supplier onboarding and qualification | `modules/suppliers.ts` | Register, qualify, suspend, search. Mandatory documents and expiry, sanctions, and category approval. Ineligible suppliers can't be invited. Discovery is ranked by eligibility and performance. |
| RFx and tender management | `modules/sourcing.ts` | Lots, BOQ imported from Excel CSV, minimum eligible bidders per route, clarifications answered to all bidders anonymously, addenda with bid extensions, sealed bids (the audit holds a SHA-256 seal, not prices) and bid revisions. |
| Technical evaluation | `modules/evaluation.ts` | Blind "Bidder A" aliases, conflict-of-interest declaration before scoring, quorum, weighted criteria totalling 100, pass/fail gates and a minimum threshold. Extreme scores need evidence. Evaluator disagreement forces a consensus moderation. |
| Commercial evaluation | `modules/evaluation.ts` | The envelope stays sealed until technical sign-off. Arithmetic is corrected (rate governs), currencies are converted to AED, scope gaps are loaded at the highest competing rate, and exclusion add-backs are applied. Unbalanced rates, abnormally low bids and collusion-risk indicators are flagged. |
| Bid analysis and award scenarios | `modules/evaluation.ts` | Combined technical/commercial ranking (lowest compliant price = 100) and weight sensitivity bands. Scenarios: best value, lowest compliant price, split by lot. |
| Award approvals | `modules/awards.ts` | Delegation-of-authority bands. Extra steps when over budget or deviating from the best-value ranking. Sequential routing, segregation of duties (requester, evaluators, recommender), the final approver's authority limit, and reasons required for rejections. |
| Contract handoff | `modules/contracts.ts` | Subscribes to `award.approved`: a draft contract per awarded allocation. The award itself records the regret list and commits the budget. |
| Audit trail | `core/audit.ts` | Append-only, SHA-256 hash-chained events. `verify()` finds any edited or removed event. |
| Core dashboards | `modules/reporting.ts` | Pipeline, late/at-risk packages, long-lead count, savings against estimate, my approvals, expiring compliance documents, budget vs committed, and audit integrity. |
| Excel import/export | `core/csv.ts` | CSV round-trip that Excel opens directly. Exports are protected against formula injection. |

`sample/seed.ts` holds fictional sample data (project DC1, users per role, six suppliers, four packages).

## Not built yet

- **UI**: next session. Every module command is already reachable through the API.
- **Postgres and Entra ID sign-in**: the store is in-memory Maps behind `Platform.table()`, and the API identifies users with a dev-only `x-user-id` header.
- **Phase 2–4** from the requirement: contract authoring and obligations, POs, delivery and expediting, receipts, invoices, Oracle/PMWeb integration, supplier performance and risk scorecards, spend analytics, and the AI copilot. The intake classifier already returns the `{ category, confidence, evidence }` shape an LLM would.
- Workflow SLA timers and escalation, delegation and out-of-office, notifications, SSO, reverse auctions, and negotiation/BAFO rounds.
