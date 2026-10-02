# Landing page brief: Procurement Digital Twin

Status: user answers verbatim where marked USER. Everything marked AUTHORED is a lead decision, open to the user's veto.
Audience (USER, earlier): procurement heads and commercial heads. Screens that inspired the UI (USER): clean enterprise SaaS, light cards, deep indigo + amber, tilted product screens.

## The eight topics
1. Vibe (USER): Intelligent. Cinematic. Command. Precision. Scale. Alternative line: "Mission Control for Spend."
2. Journey (USER): "Follow one procurement request through demand, sourcing, supplier collaboration, contract intelligence, fulfillment and executive oversight, ending in a real-time enterprise command center."
3. Energy curve (AUTHORED): calm open on one request, rising through sourcing, loudest in the Tender War Room, a quiet release at contract, then the widest and most open act at the end.
4. Feeling and remembered moment (USER): "The camera pulls back from a single purchase request and reveals an entire living enterprise ecosystem connected through procurement." A requisition becomes suppliers, contracts, warehouses, logistics, equipment, construction sites, budgets and projects, all connected with flowing intelligence. The realization: "Procurement isn't buying. Procurement runs the enterprise."
5. One thing no site does (USER): a Procurement Digital Twin, "a living world where visitors can literally see money moving, material moving, approvals moving, risks appearing, suppliers interacting, projects consuming resources in real time." Competitors show Source-to-Pay, Supplier Management and Contract Management as static modules.
6. Range (AUTHORED): cinematic command centre. Deep indigo-night stage, the platform's light indigo + amber cards glowing on it, Plex type, precise and dense, never playful.
7. One world or scenes (AUTHORED from the USER's zoom-out moment): one continuous space. One request, one camera, one twin that the scroll travels through.
8. Assets (AUTHORED): none supplied. No generated footage. Every surface is real markup computing from a snapshot of the real engine run (the `sample/demo.ts` scenario), labelled as sample data.

## Grammar and signature move (AUTHORED)
- Grammar: Live surface (2.3). The page is the product running, scroll drives its state. Forbids scrub video, kinetic headline stacks, spotlight, marketing chrome. App chrome is the navigation (status bar, stage rail). Close is an actual input.
- Signature move, "Zoom-out twin": one fixed stage holds the twin as an SVG/canvas graph. Scroll drives a camera (scale, translate, depth blur on transform and opacity only). Act 1 is a single requisition card filling the frame. Each act pulls back and brings its own layer into focus. Act 6 pulls back to the whole connected enterprise, nodes pulsing from real engine events.
- Close: a command line input ("find a package, supplier or award") that filters the snapshot twin.

## Journey, feeling curve, devices
| Act | Beat | Feeling, then cause | Device |
|---|---|---|---|
| 1 | Demand | Calm focus. One requisition card, nothing else, classification evidence and budget check read out. | pin (surface in a state) |
| 2 | Sourcing | Anticipation. Envelopes seal, invited suppliers appear as nodes. | pin + count |
| 3 | Supplier collaboration | Connection. Clarification and addendum thread between buyer and supplier nodes. | pan |
| 4 | Digital Tender War Room (PEAK, USER) | Overwhelm, then control. The camera enters a command centre. Bids stream in, commercial scores calculate, risks surface, suppliers compete, large displays fill with intelligence. Target thought (USER): "Bloomberg Terminal meets Iron Man JARVIS for procurement." | pin + pointer |
| 5 | Contract intelligence and fulfilment | Outcomes, release. Approval routing clears, contract drafts, audit chain extends. Everything after the peak shows outcomes (USER). | reveal |
| 6 | Executive oversight | Awe, command. The camera pulls all the way out to the connected enterprise (the remembered moment), landing on "Procurement isn't buying. Procurement runs the enterprise." | pin (camera, second-largest span) |

## The peak
USER decision: the Digital Tender War Room is the peak emotional moment. "Everything before builds tension. Everything after shows outcomes." Act 4 gets the largest scroll span and the asset effort. Act 3 is deliberately the calmest act before it.
The remembered moment is still the zoom-out, Act 1 starting on one request and Act 6 revealing the enterprise. The sentence a visitor tells a friend: "It starts with one purchase request and then the camera pulls back and the whole company is there, wired together."

## The tell-someone sentence
"It's the site where one purchase request turns into the whole company, wired together, live."

## Authored silence
Act 3 and Act 5 hold quieter on purpose. Act 3 (clarification thread only) is the calm before the peak. This is not dead scroll.

## Core story sentence (USER)
"Follow a single procurement request as it transforms into a connected, AI-powered enterprise ecosystem spanning suppliers, contracts, logistics, projects, and executive decision-making."

## Honesty constraints (from CLAUDE.md and the engine)
- No invented statistics. Numbers come from the demo snapshot and the page says so.
- The twin shows live only what the engine models today: projects and budgets, requisitions, packages, suppliers, sourcing events and bids, evaluations, awards, contracts, audit. Warehouses, logistics, equipment, construction sites, material movement and "AI compares proposals" are USER vision but not built. Default (AUTHORED, awaiting user confirmation): show them in the twin visibly marked "roadmap", never as live telemetry.
- "AI-powered" is USER language. CLAUDE.md puts AI features out of scope until the user brings them back, and nothing in the engine is AI today. Default (AUTHORED): the War Room animates what the engine really computes (arithmetic correction, unpriced-line loading, rate anomalies vs median, exclusion add-backs, conflict blocks, sensitivity, scenarios) under the word "intelligence", and any AI wording is labelled as roadmap. User may override.
- Fonts IBM Plex only. No em dashes, no scroll cue, no section counters.

## Feel check (to run after build)
Scroll cold, one word per act, diff against: calm, anticipation, connection, tension, release, awe.
