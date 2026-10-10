# Implementation Roadmap

| Phase | Scope | Acceptance | Status |
|---|---|---|---|
| 1 | Config, tokens, typography, shell, nav, routing, primitives, types, fixtures, demo adapter, Overview | All routes render; keyboard nav; lint + typecheck + build pass | Done |
| 2 | Design Studio: prompt builder, references, modes, job progress/cancel/fail/retry, concept grid, inspector, compare, variations, add to collection, local references | 3-minute generation walkthrough; tests for schema, job machine, determinism, cancel, fail/retry, persistence, membership, modes | **Done** |
| 3 | Brand DNA workspace: overview, identity, colour, materials & silhouettes, reference library, rules & exclusions with conflict detection, draft → review → approved versioning with compare/restore; deterministic brand context + consistency checks wired into the Studio | Changing a rule changes request metadata and subsequent simulated outputs | |
| 4 | Design Editor (navigator, canvas with zoom/pan/front-back/compare/annotations, inspector), immutable versions + lineage, deterministic refinement, brand alignment with exceptions, concept review, collection boards (groups, dnd + keyboard reorder, notes), presentation mode | Save 3 concepts to a collection and present them; history never overwrites source | |
| 5 | Conceptual try-on, technical handoff (brief, measurements, BOM, review, PDF), guided 5-scene demo, curated dataset + reset, capability registry + pilot readiness | 17-step clean-session acceptance scenario | **Done** — see VIRTUAL_TRY_ON.md, TECHNICAL_HANDOFF.md, CLIENT_DEMO_GUIDE.md, PILOT_ARCHITECTURE.md, DEMO_LIMITATIONS.md |

## Known limitations
See [DEMO_LIMITATIONS.md](DEMO_LIMITATIONS.md) for the full list.
- All imagery is placeholder silhouettes; no licensed photography yet.
- No auth, database or server routes (by design for the demo).
- Studio results are deterministic schematic concepts from the demo adapter — no image model, no pixel analysis of references.
- The demo job queue lives in memory: a full page reload marks running jobs *interrupted* (retry resubmits the stored request). Navigating within the app does not interrupt jobs.
- Reference images are kept as in-tab object URLs only; they are not persisted or uploaded.
- Brand learning is structured profile conditioning + deterministic rule checks on recorded attributes. No embeddings, LoRA or visual analysis; guidance-only rules are carried as text and never scored.
- Approval is a simulated authorised action; there is no auth or role enforcement yet.
- Uploaded brand reference images live in the tab only; after a reload they show as unavailable (metadata kept) and can be re-attached. Fixture references are placeholders that are always available.
- Editor refinements understand only controlled vocabulary; unsupported requests are refused. Garments remain schematic; metadata-only edits (title, notes, fabric text) don't change the drawing.
- Concept, collection and Brand DNA approvals are simulated local actions.
