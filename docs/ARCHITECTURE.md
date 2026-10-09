# Architecture

Frontend-only client demo. Production pieces exist as typed contracts so the demo can grow into a pilot without a UI rewrite.

```
Next.js App Router (src/app/(studio)/*)
  └─ components/ (shell, shared, per-module views)       ← presentation only
       └─ lib/services/index.ts  getAIProvider(), repo   ← the only door to data/AI
            ├─ ai-provider.ts   AIProvider interface + Zod request schemas
            ├─ demo-adapter.ts  DemoAIAdapter (SIMULATED, deterministic, no network)
            └─ repository.ts    org-scoped reads over fixtures
       └─ lib/store/            Zustand (persisted) = demo session state
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

## Key decisions
- **No backend in the demo.** All UI calls go through `lib/services`. Pilot: add `/api/v1` route handlers that run a server-side adapter; the client adapter becomes a thin HTTP client with the same interface.
- **Honest labels.** Every capability is `live | simulated | planned`; every AI output carries a `StatusBadge`.
- **Tenant isolation.** Every record has `orgId`; repository functions take `orgId` first. Server must re-check ownership on every request.
- **Jobs are async.** `draft → queued → running → succeeded | failed | canceled`, with idempotency keys, cancel and retry.
- **Provenance.** `Asset.licenseStatus/consentStatus/provenance` and `ConceptVersion.parentId` preserve history; originals are never overwritten.
- **Placeholders, not stock photos.** Garments are rendered as schematic silhouettes until licensed imagery or live generation exists.

## Pilot path
Postgres + Prisma (+ pgvector) for entities and reference embeddings · S3-compatible private storage with signed uploads · Redis queue + GPU workers behind `AIProvider` · auth with roles from `Role` · `AuditEvent` on every mutation.
