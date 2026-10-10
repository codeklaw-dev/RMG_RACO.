# Secure Application Foundation (Phase 6 Track B — milestone 6B-1)

Backend groundwork for real AI generation. **Not connected to the UI and not deployed with inference.** The demo is unchanged. `INFERENCE_PROVIDER=none` makes every generation request return `503 inference_disabled` until milestone 6C is approved.

## Stack (founder decision 3)
Next.js route handlers (`/api/v1`, Node runtime) · PostgreSQL + Prisma 7 (`@prisma/adapter-pg`) · private S3-compatible storage (AWS SDK v3, presigned URLs) · Python inference workers (Track A, not wired yet).

## Controls implemented
| Control | Implementation |
|---|---|
| Authentication | Email + password (scrypt, Node built-in). Opaque 256-bit session token in an `HttpOnly; SameSite=Lax` cookie (`Secure` on https); only `HMAC-SHA256(AUTH_SECRET, token)` is stored. 7-day expiry. No self-signup (seeded / invited users only). Generic error for wrong password and unknown user, plus timing equalisation. Lockout after 10 failures per email in 15 min |
| CSRF | Every state-changing request must carry an `Origin` equal to `APP_ORIGIN` |
| Server-side authorisation | `requireAuth(req, permission)` on every handler; role matrix owner/admin/designer/viewer (`src/server/authz.ts`) |
| Organisation isolation | The org comes from the session's membership, never from the request. Every query filters by `orgId`; another org's records return **404** (existence not revealed). References in generation requests must belong to the caller's org |
| Persistence | Prisma schema: Organization, User, Membership, Session, Asset, GenerationJob, AuditEvent (`prisma/schema.prisma`) |
| Private storage | No public objects. Keys `org/{orgId}/{kind}s/{assetId}` built from server ids only. Signed PUT (5 min, type and length signed) and GET (10 min) |
| Secure uploads | JPEG/PNG/WebP only; ≤ 8 MB; rights confirmation required. After upload the server checks the real size and the **file signature (magic bytes)**; mismatches are deleted and marked `rejected`. Re-encoding / EXIF stripping is planned for 6E |
| Auditing | Append-only `AuditEvent` for login (success/failure), logout, upload requested/ready/rejected/deleted/expired, generation requested/rejected by limit, job cancelled. No secrets, tokens or signed URLs in metadata |
| Rate limits | 20 generation requests per user per rolling hour (`USER_HOURLY_GENERATION_LIMIT`) |
| Spending controls | Per-org monthly budget (default $25), global monthly limit (`GLOBAL_MONTHLY_LIMIT_USD`), checked before a job is created and serialised per org with a row lock. Spend = actual cost where reported, else the estimate |
| Retention & deletion | Expiry set at upload (references 30 days, outputs 90 days; per-org columns). `POST /api/v1/internal/retention` (Bearer secret, constant-time compare) deletes expired objects and rows and expired sessions. Users can delete assets immediately |
| Secrets | Validated server-side config (`src/server/env.ts`, lazy so builds need no secrets); errors name missing variables but never echo values. Unexpected errors return a generic 500 and logs are redacted |

## API (v1)
`POST /auth/login` · `POST /auth/logout` · `GET /me` · `POST /assets` (start upload) · `GET /assets` · `POST /assets/:id/complete` · `GET /assets/:id` (signed read) · `DELETE /assets/:id` · `POST /generations` · `GET /jobs/:id` · `POST /jobs/:id/cancel` · `GET /usage` · `POST /internal/retention`

## Run locally ($0)
```bash
npm run db:up                                   # Postgres 16 + SeaweedFS (S3 API) in Docker
npm run db:migrate                              # applies prisma/migrations
SEED_PASSWORD='choose-a-local-password' npm run db:seed   # fictional orgs/users; refuses non-local DBs
npm run test:integration                        # DB + storage tests (separate raco_test DB and bucket)
```
MinIO no longer publishes public container images, so SeaweedFS (Apache 2.0) provides the local S3 API.

## Tests
- `src/server/server.test.ts` (part of `npm test`): env validation, password hashing, session hashing, authorisation matrix, file sniffing, limits, retention dates, error redaction.
- `src/server/api.db.test.ts` (`npm run test:integration`): real Postgres + S3. Covers sign-in, lockout, sessions, CSRF, uploads with signed URLs and spoof rejection, **cross-org isolation**, idempotency, cancellation, rate limit, org budget, global limit, retention, deletion, audit coverage and secret hygiene.

## Not yet (later milestones)
UI wiring and live provider (6C) · server-held Brand DNA (6D) · image re-encoding and reference categories (6E) · user/org management screens · password reset / SSO · production deployment (needs a hosted Postgres, a bucket, secrets, and the Vercel plan decision) · legal review before client data.
