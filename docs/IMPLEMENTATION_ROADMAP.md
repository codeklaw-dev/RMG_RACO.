# Implementation Roadmap

| Phase | Scope | Acceptance | Status |
|---|---|---|---|
| 1 | Config, tokens, typography, shell, nav, routing, primitives, types, fixtures, demo adapter, Overview | All routes render; keyboard nav; lint + typecheck + build pass | Done |
| 2 | Design Studio: prompt builder, references, modes, job progress/cancel/fail/retry, concept grid, inspector, compare, variations, add to collection, local references | 3-minute generation walkthrough; tests for schema, job machine, determinism, cancel, fail/retry, persistence, membership, modes | **Done** |
| 3 | Brand DNA: references with rights, palette, rules with citations, approval/versioning, request-metadata preview; Brand mode wired in | Changing a rule changes request metadata and subsequent simulated outputs | |
| 4 | Editor (versions, before/after, prompt edits, mask) + Collections boards, reorder, notes, presentation mode | Save 3 concepts to a collection and present them; history never overwrites source | |
| 5 | Try-on (flagged), Technical handoff brief, guided 5-scene demo mode, pilot roadmap screen | 5–7 min end-to-end demo, no dead ends | |

## Known limitations
- All imagery is placeholder silhouettes; no licensed photography yet.
- No auth, database or server routes (by design for the demo).
- Studio results are deterministic schematic concepts from the demo adapter — no image model, no pixel analysis of references.
- The demo job queue lives in memory: a full page reload marks running jobs *interrupted* (retry resubmits the stored request). Navigating within the app does not interrupt jobs.
- Reference images are kept as in-tab object URLs only; they are not persisted or uploaded.
- Brand/Hybrid attach the Serein Atelier fixture profile as request metadata; no brand learning.
- Phase 2 Studio is wired to the Overview's activity list and collection pages; the Editor route is still a placeholder (Phase 4).
