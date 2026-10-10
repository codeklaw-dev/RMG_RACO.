# Architecture

Frontend-only client demo. Production pieces exist as typed contracts so the demo can grow into a pilot without a UI rewrite.

```
Next.js App Router (src/app/(studio)/*)
  └─ components/ (shell, shared, per-module views)       ← presentation only
       └─ lib/services/index.ts  getAIProvider(), repo   ← the only door to data/AI
            ├─ ai-provider.ts   AIProvider interface + Zod request schemas
            ├─ job-machine.ts   pure job state machine (shared by all adapters)
            ├─ demo-adapter.ts  DemoAIAdapter (SIMULATED, injectable clock, no network)
            ├─ demo-engine.ts   seeded concept synthesis (mulberry32 PRNG)
            └─ repository.ts    org-scoped reads over fixtures
       └─ lib/studio/brief.ts   Brief → GenerateRequest assembly, BrandContext builder
       └─ lib/store/            studio-store (persisted: concepts, collections, jobs)
                                studio-session (ephemeral: brief, selection, local references)
       └─ lib/fixtures/         one fictional brand, 2 collections, 14 concepts, jobs
       └─ lib/types/domain.ts   domain models (spec §05)
```

## Folder map
| Path | Purpose |
|---|---|
| `src/app/(studio)/` | Routes: `/`, `/studio`, `/editor`, `/brand-dna`, `/collections`, `/collections/[id]`, `/try-on`, `/technical` |
| `src/components/shell` | Sidebar, topbar/breadcrumbs, mobile nav sheet, store hydrator |
| `src/components/shared` | StatusBadge, GarmentPlaceholder, ConceptCard, JobRow, PageHeader, Section, EmptyState, Reveal, ModulePlaceholder |
| `src/components/ui` | shadcn primitives (Base UI) |
| `src/lib/config` | Navigation + feature flags |
| `src/components/studio` | Design Studio: brief panel, canvas, inspector, compare, reference dropzone, `useJobRunner` |
| `src/**/*.test.ts(x)` | Vitest + Testing Library (jsdom), no network |

## Key decisions
- **No backend in the demo.** All UI calls go through `lib/services`. Pilot: add `/api/v1` route handlers that run a server-side adapter; the client adapter becomes a thin HTTP client with the same interface.
- **Honest labels.** Every capability is `live | simulated | planned`; every AI output carries a `StatusBadge`.
- **Tenant isolation.** Every record has `orgId`; repository functions take `orgId` first. Server must re-check ownership on every request.
- **Jobs are async.** `draft → queued → running → succeeded | failed | canceled`, with idempotency keys, cancel and retry.
- **Provenance.** `Asset.licenseStatus/consentStatus/provenance` and `ConceptVersion.parentId` preserve history; originals are never overwritten.
- **Placeholders, not stock photos.** Garments are rendered as schematic silhouettes until licensed imagery or live generation exists.

## Studio data flow (Phase 2)
1. `BriefPanel` edits `studio-session.brief`.
2. `buildGenerateRequest(brief, { orgId, brand })` → `GenerateRequestInput`; Zod validates it in the UI and again in the adapter.
3. `useJobRunner.submit` → `provider.generateConcepts` → job stored in `studio-store.jobs` with its request; `activeJobId` set.
4. The runner polls `getJob` (250 ms). On `succeeded` it calls `getResults` and appends concepts; nothing is overwritten.
5. Variations set `variationOf`; results carry `parentConceptId`.
6. `saveToCollection` enforces org match and no duplicate membership. Collection pages and Overview read the same store.

## Brand DNA (Phase 3)
```
lib/types/brand.ts         BrandDNA, BrandProfileVersion, BrandRule (+ structured RuleEffect), BrandReference
lib/brand/versioning.ts    pure workflow: draft → in_review → approved (prev → archived); restore → new draft
lib/brand/intelligence.ts  completeness, conflict detection, buildBrandContext(), evaluateConcept(), diffContent()
lib/brand/vocabulary.ts    controlled construction-detail and material vocab shared by rules, engine and checks
lib/store/brand-store.ts   persisted versions/references/change log (metadata only)
lib/store/reference-files.ts in-tab object URLs for uploaded references (never persisted)
components/brand-dna/*     workspace sections + workflow bar
```
Rules:
- Approved versions are immutable; any edit goes to a draft (created on first save).
- Only the **approved** version reaches `buildBrandContext()`; drafts and in-review versions never condition generation. With no approved version, Brand/Hybrid are disabled.
- Only enabled + approved rules are active. Only structured effects are evaluated; `guidance` rules are passed as text.
- Each generated concept records `brandProfileVersion`; the inspector checks it against that exact version.
- The demo engine uses an independent seeded stream per attribute, so a rule change moves only what it governs.

## Design Editor & collections (Phase 4)
```
lib/editor/versions.ts     immutable version helpers: originalVersion, nextVersion, diffSnapshots
lib/editor/review.ts       concept review state machine
lib/editor/annotations.ts  normalised pin coordinates + keyboard nudging
lib/editor/collections.ts  palette summary, groups, collection review steps, presentation navigation
lib/services/demo-edit.ts  deterministic refinement interpreter (controlled vocabulary)
lib/store/editor-session.ts ephemeral canvas/draft state
components/editor/*        navigator, canvas, inspector panels, edit job hook
components/collections/*   board (dnd-kit) and presentation view
app/present/[id]           presentation route outside the app shell
```
Store additions (`raco-studio` v5): `versions`, `annotations`, `reviews`, `exceptions`; collections gain `creativeDirection`, `notes`, `groups`, `lookMeta`. Mutations validate concept/version/collection existence and organisation scope. Concepts mirror their head version's snapshot for fast list rendering. See [DESIGN_EDITOR.md](DESIGN_EDITOR.md) and [COLLECTION_WORKFLOW.md](COLLECTION_WORKFLOW.md).

## Try-on, handoff, demo (Phase 5)
```
lib/types/handoff.ts          FitModel, TryOnPreview, TechBrief, Measurement, BomLine, TechReview
lib/fixtures/fit-models.ts    original schematic avatars (rights + provenance)
lib/fixtures/demo.ts          curated dataset: cpt_01 v2, annotations, reviews, brief, 3 previews
lib/handoff/technical.ts      prefill, units, validation, review machine, missing info, BriefDocument
lib/handoff/pdf.ts            jsPDF renderer (lazy import), SVG → PNG for drawings
lib/store/handoff-store.ts    raco-handoff: previews + briefs (metadata only)
lib/store/demo-store.ts       guided demo progress (sessionStorage)
lib/demo/scenes.ts, reset.ts  five scenes (flag-aware), reset with work summary
lib/config/capabilities.ts    capability registry → Pilot Readiness
components/try-on, technical, demo, pilot
```
Try-on reuses the shared job state machine via `AIProvider.virtualTryOn` + `getTryOnResult`. Feature flags: `NEXT_PUBLIC_FLAG_TRY_ON`, `NEXT_PUBLIC_FLAG_TECHNICAL`, `NEXT_PUBLIC_FLAG_DEMO` hide nav, demo scenes and routes (404). See [PILOT_ARCHITECTURE.md](PILOT_ARCHITECTURE.md) for the production design.

## Persisted demo state
`raco-brand` (brand-store) validates on load and falls back to fixtures. `studio-store` persists under `raco-studio` with an explicit `version`. `migrateState()` upgrades legacy keys (`raco-studio-v1`, `raco-studio-v2`), fills fields added since, drops unrepairable records, and re-validates same-version payloads so corrupt storage falls back to fixtures instead of breaking the UI. v5 also maps legacy `shortlisted` → `in_review`, backfills version numbers, keeps edits to fixture concepts, and drops annotations/exceptions whose version no longer exists. Bump `STORE_VERSION` and extend `migrateState()` whenever the persisted shape changes.

Reference previews are object URLs: revoked on remove, on `clearReferences()`, and on `pagehide`. They are never persisted.

## Deployment
Vercel. `vercel.json` pins `"framework": "nextjs"` (the project was created before the app existed and defaulted to a static `public/` output).

## Pilot path
Postgres + Prisma (+ pgvector) for entities and reference embeddings · S3-compatible private storage with signed uploads · Redis queue + GPU workers behind `AIProvider` · auth with roles from `Role` · `AuditEvent` on every mutation.
