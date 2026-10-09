# Implementation Roadmap

| Phase | Scope | Acceptance | Status |
|---|---|---|---|
| 1 | Config, tokens, typography, shell, nav, routing, primitives, types, fixtures, demo adapter, Overview | All routes render; keyboard nav; lint + typecheck + build pass | **Done** |
| 2 | Design Studio: prompt builder, references, modes, job progress/cancel/fail/retry, concept grid, add to collection | 3-minute generation walkthrough on seeded results | Next |
| 3 | Brand DNA: references with rights, palette, rules with citations, approval/versioning, request-metadata preview; Brand mode wired in | Changing a rule changes request metadata and subsequent simulated outputs | |
| 4 | Editor (versions, before/after, prompt edits, mask) + Collections boards, reorder, notes, presentation mode | Save 3 concepts to a collection and present them; history never overwrites source | |
| 5 | Try-on (flagged), Technical handoff brief, guided 5-scene demo mode, pilot roadmap screen | 5–7 min end-to-end demo, no dead ends | |

## Known limitations
- All imagery is placeholder silhouettes; no licensed photography yet.
- No auth, database or server routes (by design for the demo).
- No automated tests yet (unit tests for job state machine planned with Phase 2).
