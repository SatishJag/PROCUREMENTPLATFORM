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
Node ≥22.18 runs `.ts` directly: no build step for `server/` and `sample/`. The core package is zero-dependency (AI SDK is an optional peer); this product adds `@anthropic-ai/sdk` for `insight`, plus the web toolchain under `web/`.

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
- **Module talk**: reads via another module's exports, reactions via events (`p.on` in `createPlatform`). Imports are acyclic: intake→planning; sourcing→intake, suppliers; evaluation→sourcing; awards→evaluation, sourcing, intake; insight→evaluation, intake, sourcing; reporting reads all. `insight` is async and advisory: no Flow or `actions` (exception to the `next()` step, plain role guards), commands `classifyRequisition` and `analyzeBids`, test seam in `modules/insight-seam.ts` (not indexed). The server `await`s every command. Modules never import `server/` or `web/`.
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
| insight | `insight.generated` (kind, model, inputHash, subject), `insight.failed` (kind, model, inputHash, reason; only when data was sent) | |

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
- **Decided (user)**: the landing page uses `scroll-craft` with tilted live platform UI (real screens, no AI video, no `lets-scroll` render chain). Story (supersedes the earlier 5 beats) is 6 acts following one request: demand, sourcing, supplier collaboration, Digital Tender War Room (the emotional peak, largest span; target feel "Bloomberg Terminal meets JARVIS for procurement"), contract and fulfilment (outcomes), executive oversight (camera zooms out to a live enterprise "Procurement Digital Twin": the remembered moment, "Procurement isn't buying. Procurement runs the enterprise."). Grammar: Live surface with a "Zoom-out twin" signature move, dark indigo-night stage with the platform's light cards on it. Brief: `scrollcraft/builds/procurement-twin/BRIEF.md`. Honesty: sample data from the real engine, labelled; AI wording is allowed only for what `insight` really does (an advisory second opinion with cited evidence), never as autonomous or deciding; assets, logistics and material movement are not built, so they appear only as marked roadmap. Audience: procurement and commercial heads. Desktop and mobile get separate compositions.
- **Decided (user)**: the UI must be a **rich and immersive experience**, in the product screens and not only the landing page. Richness comes from layered depth, tinted elevation, live data visuals (inline SVG charts, sparklines, score bars), purposeful transform/opacity motion and tilted perspective views. It never overrides the design principles: one focal point per screen, one primary action per region, reduced-motion respected.
- **Decided (user)**: look and feel must be **posh, modern and classic**, never dated or "old style", and immersive with **zoom in and zoom out** as a core interaction (semantic zoom on a live "Command Map" of the enterprise, and scroll-driven zoom on the landing page). Direction (lead, open to veto): midnight-indigo stage with porcelain surfaces, champagne-gold hairlines and accents, Plex Sans at light and medium weights with generous tracking and large tabular numerals, glass layers, soft depth, slow eased motion. IBM Plex is self-hosted from `@fontsource/ibm-plex-*` because the sandbox blocks Google Fonts (the fallback font was a main cause of the dated look). Plex Serif stays document-only unless the user allows it for display headlines.
- **Decided (lead)**: `npm run api` serves a scripted mid-process state (`run(print, true)` stops after the award recommendation) so screens always have real work waiting: the first approver (Daniel, `u-daniel`) has `AW-0009` to approve, later approvers wait their turn. Tests keep using the plain seed.
- **Decided (user)**: spec section 6 ("Workflow and low-code configuration") was missed in earlier planning. Today every workflow is coded (e.g. the DOA bands in `awards.ts`, route bands in `intake.ts`, the `Flow` state machines). For the MVP demo the user wants a **Workflow Console, UI only**: an admin screen, consistent with the product theme and filled with sample data, to show that super users or end users will be able to change workflows, routing rules by person, designation and transaction limits, multi-tier approvals, etc. It is NOT wired to the engine and must say so on its face ("Preview, sample configuration"). Screen: `web/src/screens/workflows/`, fixture-driven, with a small client-side simulator over the fixture rules (enter a value and see the route). Real engine work (workflow definitions as versioned, effective-dated data that `awards`, `intake` and `sourcing` read instead of constants) is a later capability and needs its own spec.
- **Open (ask the user)**: product name; scroll-craft `BRIEF.md` answers still missing (vibe words, the one remembered moment, signature move).
- **Decided (user)**: AI is back in scope and must be real, not only marketing copy. Rules: (1) advisory only. The deterministic engine stays the decision of record. AI output is a second opinion shown with its evidence, never an approval, award or state change. (2) New capability `insight` (Procurement_core `modules/insight.ts`): `classifyRequisition` (LLM second opinion beside `intake.classify`) and `analyzeBids` (War Room commentary over `evaluation.results`: risks, anomalies in plain language, scenario trade-offs). (3) Controls: reuse the existing guards. `analyzeBids` only runs when `evaluation.results` would allow it (envelope sealed until technical sign-off, blind aliases, conflicts) and sends nothing the caller cannot already see. Every call emits `insight.generated` (model, input hash, never the key) into the audit chain. (4) Official `@anthropic-ai/sdk`, declared as an optional peer dependency and dynamically imported, so the core stays zero-dependency when AI is off. Model `claude-opus-5-5`, structured outputs (`output_config.format`), no forced tool use. Without `ANTHROPIC_API_KEY` the commands return the deterministic result labelled `source: "engine"`. (5) Open for the user: Anthropic API key in the environment secrets, and whether commercial data may leave the tenant (UAE data residency).
- **Not now**: autonomous agents that act on procurement data, and anything beyond the two `insight` commands, until the user asks.

## Next session agenda (user's notes, start here)
1. ~~Colour and UI inspiration~~ done (see Decisions: indigo + amber, tilted live UI).
2. ~~Design system v2~~ merged (posh restyle). Palette: midnight `#14123F`, porcelain `#FBF9F5`, champagne gold `#D4B46A`. Primary button is amber `#F5B800` on the night stage and indigo `#2D2A7A` on porcelain (amber on porcelain is only 1.7:1). Fonts from `@fontsource` (latin 300/400/500/600 Sans, 400/600 Condensed, 400/500 Mono), no Google Fonts link. New `web/src/ui/`: `Zoomable` (pan/zoom, wheel, pinch, drag, keys, `onScale` for semantic zoom; it captures the plain wheel so use it in panels and maps, not long scrolling columns), `FocusCard` (zoom-in card via View Transitions, FLIP fallback, native dialog), `Table`, `Section`, `Field`/`Input`. Dashboard shows engine-rendered actions (awards.actions takes the award id). Remaining gaps: `AppShell` user list is hard-coded (no users endpoint); package float and next step come from `exportPackages`, which the engine allows only for buyer, manager and auditor, so other roles see the engine's refusal in the register. v1 notes follow.
   Earlier v1 notes: `web/` (Vite + React + Tailwind v4 `@theme` tokens in `web/src/styles/tokens.css`, `web/src/ui/` primitives, `web/src/api.ts`, hash routes registered in `web/src/main.tsx`, Dashboard proof screen). Setup: `npm i --legacy-peer-deps` in `web/`, then `npm --prefix web run dev|build`. Known gaps for the next pass: the Dashboard primary ("Review actions") renders dim when nothing is waiting, so give it a live alternative or hide it; `AppShell.tsx` hardcodes the seed users (no users endpoint); requested primitives: Table (Plex Condensed), collapsible Section, Field/Input. Module nav entries are disabled ("soon").
3. Landing page (scroll-craft, Live surface + zoom-out twin, 6 acts) per `scrollcraft/builds/procurement-twin/BRIEF.md`. Design system has landed; blocked only on the user's answers on unbuilt layers and the API key for a live War Room.
4. ~~Workflow Console~~ built (UI-only MVP demo, spec section 6): `web/src/screens/workflows/`, route `#/workflows`, fixture-driven, not wired to the engine, banner says so. Library, stage editor on a `Zoomable` canvas with inspector, authority matrix, delegation, notifications, versions with diff and publish (local only), simulator, safeguards (blocking errors disable Publish with the reason). Award approval and Sourcing route seed with the engine's real bands. `NavItem` has an optional `group`. Gaps: local controls in `bits.tsx` (Select, Check, Tabs, Tags, IconBtn, Lbl) and a Dialog should be promoted to `ui/`; `html { color-scheme: dark }` needs `color-scheme: light` on `.on-light`; `Table` has a fixed `min-w-[54rem]`; the Sourcing card's mini diagram renders vertically; `logic.ts` has no unit test (node cannot resolve extensionless imports; add a Vitest case).
5. Then the user's new procurement capabilities (domain-engineer per capability), including the real configurable workflow engine.

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
- **Done (extraction)**: `core/`, `modules/` and their tests now live in `SatishJag/Procurement_core` (`@satishjag/procurement-core`, compiled `.js` committed, installed via `github:SatishJag/Procurement_core#<commit>`, currently `724bd59`). This repo keeps `server/`, `sample/`, `web/`. Import from the package (`planning.schedule`, `/core` for types); the layout above describes the package contents. The package is a git dependency: pin a commit hash for releases, and keep core imports extensionless with `.js` added after build.
- **Done (AI)**: `insight` built, QA-reviewed and merged into Procurement_core `main` at `724bd59` by the user's go-ahead (16 tests; QA blocker on risk/supplier binding fixed, `insight.failed` audited). This repo pins `724bd59` and depends on `@anthropic-ai/sdk` directly (the product installs the core's optional peer; this is the exception to zero runtime dependencies). Not yet exercised against the live model (no API key here). ConstructionAI also depends on the core, so it picks `insight` up only when it bumps its pin. Known QA leftovers: no per-user rate limit on paid calls; stored insight rows have no read path (any future reader must repeat the `evaluation.results` guards); real SDK path untested.
- **Done (twin)**: `reporting.twin(p, user)` (read-only, `{nodes, edges, activity}` for the Command Map and landing twin) merged into Procurement_core `main` at `173a4ec` by the user's go-ahead, QA-reviewed. Controls: internal roles only; no bid prices, scores or rates; award `value` only once approved (or for evaluation `READERS`); bid count and `bid.submitted` rows only after the event closes; invitations only once published; supplier and bidder actors masked as "sealed"; project-scoped. Same merge adds a guard so supplier-portal users cannot open `reporting.dashboard` (it leaked other suppliers' document expiries). This repo still pins `724bd59`: repin to `173a4ec` (or later) once no agent is running, then build the Command Map screen against `reporting/twin`.
- **Done (deploy prep)**: Procurement_core is a library (no `start` script, no server), so a Railway service connected to that repo fails in Railpack ("failed to prepare the build"). The deployable service is THIS repo's API: `npm start` (`node server/index.ts`), `engines.node >= 22.18`, `PORT` and `HOST` env vars (the server listens on `0.0.0.0` automatically whenever `PORT` is set, as hosts like Railway do; otherwise loopback only; `HOST` overrides). Root `dev/build/preview` scripts were removed (the web app lives in `web/`; its scripts are `npm --prefix web run dev|build`) and the stale GitHub Packages `.npmrc` was deleted. One service serves everything: the server also serves the built web app from `web/dist` (path-traversal safe, tested) and root `npm run build` builds `web/` (self-contained deps, `--include=dev`). Verified in a clean copy: production-only root install, `npm run build`, then `PORT=3998 HOST=0.0.0.0 npm start` serves the UI at `/`, assets, and the live demo API. Railway setup: Source repo PROCUREMENTPLATFORM, branch `claude/charming-knuth-hn3nix` (NOT `main`, which holds the separate Python "Procure.AI" app from PR #3 that pins the private Procurement_core at `61cff01`); no variables required. Procurement_core must be readable by the build host: the user chose to make it public. Open before a public deploy: `x-user-id` is trusted as identity (anyone could act as any user, including approving awards), so keep any public URL demo-only on sample data or put an access gate in front; the core is a git dependency, so the build host needs read access to the Procurement_core repo (public, or a token).
- **Done (web base)**: design system and Dashboard merged (see agenda 2). `tsconfig.json` uses `moduleResolution: bundler` and `noEmit` (typecheck only). Package type imports come from `@satishjag/procurement-core/types`, the kernel from `/core`. Product tests (`test/flow.test.ts`, `test/server.test.ts`) live here and run with `npm test`; module tests live in Procurement_core.
- **Next**: landing page (6 acts), module screens in `web/` (Table, Section, Field primitives first), exercise `insight` on the live model once a key exists, then the user's new capabilities, then Postgres and Entra ID.
