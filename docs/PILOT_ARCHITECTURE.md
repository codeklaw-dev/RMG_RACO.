# Production Pilot Architecture (proposal — not deployed)

```
Client UI (this Next.js app)
   │ typed API client (same AIProvider / store contracts)
Application API  — /api/v1 route handlers or a service · Zod · org-scoped auth · rate limits · idempotency
   │
Business services — Brand DNA · concepts & versions · collections & reviews · technical briefs · try-on records
   │                                   │
AI orchestration — job queue (Redis/SQS) · retries · cancellation · cost caps · provider adapters
   │
Model execution — GPU workers: generation · image editing/inpainting · reference conditioning · try-on
Cross-cutting: PostgreSQL + Prisma (pgvector for references) · private object storage (signed URLs) · audit log · monitoring
```

## Separation of concerns
| Layer | Owns | Never does |
|---|---|---|
| Client UI | Interaction, optimistic state | Hold secrets, call models |
| Application API | AuthN/Z, validation, tenancy | Run inference |
| Business services | Domain rules (immutability, review workflows) | Talk to GPUs directly |
| AI orchestration | Jobs, retries, costs, provider choice | Domain decisions |
| Model execution | Inference only | Access other tenants' data |
| Asset storage | Images, references, PDFs (private) | Public URLs |
| Audit logging | Every mutation & approval | — |

## Contracts already in the codebase
`AIProvider` (generate, edit with region/base, analyse brand, try-on, jobs, results), `brandContextSchema`, `tryOnRequestSchema`, `editRequestSchema`, `GarmentAsset` / `ModelAsset` / `PoseReference`, job state machine, `ConceptVersion` provenance, capability registry.

## Pilot plan
1. Benchmark 2–3 image models on 20 blind briefs. 2. Measure latency and cost per accepted concept. 3. Collect authorised references with rights metadata. 4. Agree an evaluation rubric (originality, brand fit, edit control, time saved). 5. Legal review of model licences, IP and data retention. 6. Stand up auth/RBAC, Postgres, private storage, audit logging, monitoring.
