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
| intake | `requisition.submitted/approved/rejected`, `package.created`, `boq.uploaded` | |
| suppliers | `supplier.registered/qualified/rejected/suspended` (reinstating emits `qualified`) | |
| sourcing | `event.created/published/closed`, `clarification.asked/answered`, `addendum.issued`, `bid.submitted` (seal hash, never prices) | |
| evaluation | `technical.opened/completed`, `conflict.declared`, `score.recorded/moderated`, `exclusion.loaded` | |
| awards | `award.recommended`, `award.decision`, `award.approved` | contracts.draftFromAward |
| contracts | `contract.drafted` | |

### API contract
Every module with a workflow has an `actions` command (intake, suppliers, sourcing, awards).
`POST /api/<module>/<command>`, body `{"args":[...]}`, header `x-user-id` → `{ok:true,data}` or `400/401/404/413 {ok:false,error}`. `GET /api` lists the commands.

## Conventions
- Money: AED, 2dp, rounded per line. FX table = AED per unit. Dates are ISO strings; read time only via `p.today` / `p.clock()`.
- Errors: `throw new Error('<sentence an end user can act on>')`. The API returns the message as is.
- IDs: `p.id('PREFIX')` → `PREFIX-0001`. Commands are verbs; events are `entity.past_tense`.
- Sample data is fictional: no real company names and no client or vendor branding.

## Design principles (web/, mandatory)
These principles apply to all UI work, including any skill (`scroll-craft`, `artifact-design`, `dataviz`). Where a skill's own taste rules conflict with them, these principles win.
1. **Visual hierarchy**: every screen answers, in order: what is this, what state is it in, what do I do next. One focal point per screen, and it passes the squint test.
2. **Prominent actions**: the next workflow step is a high-contrast primary button, visible without scrolling, one per region. Secondary actions are visibly quieter. Destructive actions look different and ask for a reason.
3. **Actions come from the engine**: buttons render from each module's `actions` command (`core/workflow.ts` `available()`), so users only see what they can do. A blocked action shows the engine's error message as the reason.
4. **Typography is one superfamily**: IBM Plex (open licence, on Google Fonts). Each member has one job:
   - **Plex Sans**: UI and body text. Headings use the same family at SemiBold/Bold with tighter tracking.
   - **Plex Sans Condensed**: dense tables and bid comparisons.
   - **Plex Mono**: IDs, cost codes, BOQ refs and audit hashes.
   - **Plex Serif**: only for generated documents (award reports, contracts, regret letters).
   - **Plex Sans Arabic**: Arabic text in the same family.
   - All numbers use tabular figures. No font from outside the superfamily. This replaces the uploaded rules' "pair a serif display with a sans" guidance.

The measurable rules are in `.claude/agents/frontend-engineer.md`, and `qa-reviewer` enforces them.

## Decisions
- **Decided**: TypeScript throughout. RPC API. Web stack: React + Vite + Tailwind v4 tokens + TanStack Query (see `frontend-engineer`). Postgres and Entra ID come next on the platform track. The uploaded `# CLAUDE.md — Frontend Website Rule.txt` guardrails apply to `web/`; its Windows paths and scripts don't.
- **Decided (user)**: visual hierarchy, high-contrast primary actions, and the IBM Plex superfamily (Design principles above).
- **Decided (user, UI inspiration session)**: references are the clean enterprise-SaaS screens (light blue-white surfaces, deep indigo primary, small amber accent, large rounded white cards, product screens tilted in perspective). Palette direction: **indigo + amber**, tuned by the design-system instance for contrast (start near indigo `#2D2A7A`, amber `#F5B800`, ink navy `#14284B`, surface `#F5F8FE`). Type stays IBM Plex (the references' rounded sans does not override it).
- **Decided (user)**: the landing page uses `scroll-craft` with tilted live platform UI (real screens, no AI video, no `lets-scroll` render chain). Story is 5 beats, requisition to award: intake, sourcing, sealed bids, evaluation, award and approval. Audience: procurement and commercial heads. Desktop and mobile get separate compositions.
- **Decided (user)**: the UI must be a **rich and immersive experience**, in the product screens and not only the landing page. Richness comes from layered depth, tinted elevation, live data visuals (inline SVG charts, sparklines, score bars), purposeful transform/opacity motion and tilted perspective views. It never overrides the design principles: one focal point per screen, one primary action per region, reduced-motion respected.
- **Open (ask the user)**: product name; scroll-craft `BRIEF.md` answers still missing (vibe words, the one remembered moment, signature move).
- **Not now**: the AI copilot and other AI features stay out of scope until the user brings them back.

## Next session agenda (user's notes, start here)
1. ~~Colour and UI inspiration~~ done (see Decisions: indigo + amber, tilted live UI).
2. Design system (frontend-engineer, `web/src/ui/`, `tokens.css`, `api.ts`), applying all four design principles. In progress.
3. Landing page (scroll-craft, tilted live UI, 5 beats) once the design system lands. Needs `BRIEF.md` first.
4. Then the user's new procurement capabilities (domain-engineer per capability).

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
- **Done**: Phase 1 capability core (intake, planning, suppliers, sourcing, two-envelope evaluation, award scenarios, DOA approvals, contract handoff, reporting, audit chain, CSV), RPC API, `actions` commands for engine-driven buttons, 10 tests.
- **Done (extraction)**: `core/`, `modules/` and their tests now live in `SatishJag/Procurement_core` (`@satishjag/procurement-core`, compiled `.js` committed, installed via `github:SatishJag/Procurement_core#main`). This repo keeps `server/`, `sample/`, `web/`. Import from the package (`planning.schedule`, `/core` for types); the layout above describes the package contents. The package is a git dependency: pin a commit hash for releases, and keep core imports extensionless with `.js` added after build.
- **Next**: `web/` (design system → landing page → module screens), then the user's new capabilities, then Postgres and Entra ID.
