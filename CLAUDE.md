# CLAUDE.md: Procurement Platform

An end-to-end Source-to-Pay platform for capital projects (data centres, construction). The spec is `PRocurement Platorm.txt`. References: `TruBuild.pdf` (AI bid-evaluation competitor) and `Procure.AI.pptx` (vendor options, Oracle gaps). This file is the source of truth for how we build. Keep it current (see Upkeep).

## Ponytail: always on
Load the `ponytail` skill (`.claude/skills/ponytail`) at the start of every coding task.
- Ladder: does it need to exist → already in the repo → stdlib → native platform → installed dependency → one line → minimum code.
- No abstraction with one implementation, no config nobody sets, no scaffolding "for later". Fewest files, shortest correct diff.
- Never simplify away: validation at trust boundaries, access/SoD/authority controls, audit, security, accessibility.
- Mark deliberate shortcuts `// ponytail: <ceiling>, <upgrade path>`.
- Output: code first, then at most 3 lines (`skipped: X, add when Y`).
- Token economy: Grep before Read, read only the ranges you need, never re-read a file you just wrote, don't paste this file into prompts (agents load it), reports at most 15 lines.

## Commands
`npm test` · `npm run typecheck` (after `npm i`) · `npm run demo` · `npm run api` → http://127.0.0.1:8787/api
Node ≥22.18 runs `.ts` directly: no build step, zero runtime dependencies (dev only: typescript, @types/node).

## Architecture: modular monolith, open for extension
```
core/     kernel.ts (Platform: table(), clock, id(), emit/on), types.ts (shared chain), workflow.ts (Flow, next, guard), audit.ts, csv.ts, dates.ts
modules/  one file per capability, plus index.ts (registry + createPlatform event wiring)
server/   HTTP RPC over each module's `commands`
sample/   fictional DC1 seed + demo.ts walkthrough
test/     <capability>.test.ts per module, plus flow, kernel, server
web/      next: React app + scroll-craft product tour
.claude/  agents/ (the team), skills/ (ponytail, ponytail-review, scroll-craft)
```
- **New capability** = `modules/<x>.ts` + `test/<x>.test.ts` + one export line in `modules/index.ts`. Never edit the kernel to add a table (`p.table<T>('x')`) or a role (all requirement roles already exist in `Role`).
- **Module talk**: reads via another module's exports, reactions via events (`p.on` in `createPlatform`). Imports are acyclic: intake→planning; sourcing→intake, suppliers; evaluation→sourcing; awards→evaluation, sourcing, intake; reporting reads all. Modules never import `server/` or `web/`.
- **Every state change**: `guard` → validate → `next(flow)` → mutate → `p.emit(user, 'entity.past_tense', id, data)`. `emit` writes the hash-chained audit trail and publishes the domain event.
- **API surface** = each module's `export const commands = {...}`. Pure helpers are unreachable.
- **Swap points** (marked `ponytail:`): in-memory Maps → Postgres (`kernel.table`); sync bus → outbox + Service Bus (`kernel.on`); `x-user-id` → Entra ID (`server`); keyword classifier → LLM (`intake.classify`, same `{category, confidence, evidence}` shape).

### Event catalogue
| Module | Emits | Subscribers |
|---|---|---|
| intake | `requisition.submitted/approved/rejected`, `package.created` | |
| suppliers | `supplier.registered/qualified/rejected/suspended` (reinstating emits `qualified`) | |
| sourcing | `event.created/published/closed`, `clarification.asked/answered`, `addendum.issued`, `bid.submitted` (seal hash, never prices) | |
| evaluation | `technical.opened/completed`, `conflict.declared`, `score.recorded/moderated`, `exclusion.loaded` | |
| awards | `award.recommended`, `award.decision`, `award.approved` | contracts.draftFromAward |
| contracts | `contract.drafted` | |

### API contract
`POST /api/<module>/<command>`, body `{"args":[...]}`, header `x-user-id` → `{ok:true,data}` or `400/401/404/413 {ok:false,error}`. `GET /api` lists the commands.

## Conventions
- Money: AED, 2dp, rounded per line. FX table = AED per unit. Dates are ISO strings; read time only via `p.today` / `p.clock()`.
- Errors: `throw new Error('<sentence an end user can act on>')`. The API returns the message as is.
- IDs: `p.id('PREFIX')` → `PREFIX-0001`. Commands are verbs; events are `entity.past_tense`.
- Sample data is fictional: no real company names and no client or vendor branding.

## Decisions
- **Decided**: TypeScript throughout. RPC API. Web stack: React + Vite + Tailwind v4 tokens + TanStack Query (see `frontend-engineer`). Postgres and Entra ID come next on the platform track. The uploaded `# CLAUDE.md — Frontend Website Rule.txt` guardrails apply to `web/`; its Windows paths and scripts don't.
- **Open (ask the user)**: product name; brand palette (candidate from the deck: teal `#0E8C7A` and rust `#C9541A` on warm greys); whether the scroll-craft tour ships.

## Multi-agent operating model
The main session is the **lead architect**. It talks to the user, writes specs, owns `core/`, `modules/index.ts`, `CLAUDE.md` and `README.md`, and spawns, reviews and merges.

| Agent (`.claude/agents/`) | Instances | Owns |
|---|---|---|
| domain-engineer | 1 per capability, in parallel | `modules/<x>.ts`, `test/<x>.test.ts` |
| platform-engineer | 1 | `server/`, kernel storage/bus backing, CI, integrations |
| frontend-engineer | design system first, then 1 per module's screens, plus 1 for the tour | `web/` |
| qa-reviewer | 1 per merge, read-only | findings report |

Recipe for each new capability request:
1. The lead maps it to requirement sections and writes a spec of at most 20 lines: capability, commands, tables, events emitted and consumed, controls, acceptance checks, files owned.
2. Spawn builders with `isolation: "worktree"`. Independent specs run in parallel. Kernel or shared-type changes go through the lead first.
3. `qa-reviewer` checks each result. The lead merges and runs the full test suite.
4. The lead updates the README capability map and this file.

Don't spawn an agent for a change the lead can make in a few edits. Default models are set in each agent's frontmatter; override per spawn only when a task needs it.

## Upkeep (mandatory)
Update this file in the same commit as any change to: layout, conventions, the event catalogue, the API contract, decisions, agent roles, or status. Agents propose edits with a `CLAUDE.md delta:` line in their report. Only the lead edits this file.

## Status
- **Done**: Phase 1 capability core (intake, planning, suppliers, sourcing, two-envelope evaluation, award scenarios, DOA approvals, contract handoff, reporting, audit chain, CSV), RPC API, 9 tests.
- **Next**: `web/` (design system → module screens → tour), then the user's new capabilities, then Postgres and Entra ID.
