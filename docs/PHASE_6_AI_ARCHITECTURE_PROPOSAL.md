# Phase 6 — Real AI Garment Generation: Architecture Proposal

*Status: **approved in principle** (10 Oct 2026), subject to technical validation and licensing review. Provisional founder decisions, the two-track split (A: isolated model evaluation · B: secure foundation), reconfirmed licensing, the **corrected cost model** and the first milestones are in [PHASE_6_VALIDATION_PLAN.md](PHASE_6_VALIDATION_PLAN.md), which supersedes this document where they differ (notably: backend = Next.js API + Postgres + Prisma + private S3 + Python workers; GPU baseline L4; costs include cold starts, idle time and CPU/RAM). No implementation code, dependencies or infrastructure have been added. Originally prepared against `main` @ `91ba2be`.*

**Legend for every number in this document**
- **[V]** verified from a primary/vendor source on the date above (link given).
- **[S]** from a secondary source (aggregator/tracker) — plausible, re-check before budgeting.
- **[E]** our engineering estimate — *not measured*. Phase 6C/6G replaces these with measurements.

---

## 1. Executive recommendation

| | Recommendation | Why |
|---|---|---|
| **A. Initial production model** | **FLUX.2 [klein] 4B**, self-hosted on **Modal** serverless GPUs (scale to zero) | Apache 2.0 [V]; one model does text-to-image **and** multi-reference image editing [V]; ~13 GB VRAM [V]; 4-step distilled → fast and cheap per image; client data never leaves our own inference containers |
| **B. Best open-weight alternative** | **Qwen-Image (T2I) + Qwen-Image-Edit-2511 (editing, multi-image)**, same Modal setup on a larger GPU | Apache 2.0 [V]; 20B parameters [V] — likely higher garment fidelity, true CFG (negative prompts) and strong editing; needs ~24 GB (FP8) to ~41 GB (BF16) VRAM [S] and ~10× more GPU time per image [E] |
| **C. Hosted fallback** | **fal.ai** endpoints for the *same* open models (klein 4B / Qwen-Image), used **only** for non-confidential briefs until a DPA/zero-retention agreement is signed | No GPU ops; per-image billing; fal's licence to customer input is limited to providing the service, but anonymised usage data may be used [V]. BFL's own API is **excluded for client designs**: its self-serve terms let BFL train on inputs and outputs [V] |

**Decision principle:** start with the cheapest model that is commercially clean and keeps proprietary designs in infrastructure we control, then let a measured bake-off (6C/6G) decide whether the default should move to Qwen-Image. Nothing in the UI or `AIProvider` contract changes if we switch.

**First real image:** reachable in milestones 6B + 6C (secure foundation + one provider), without exposing client data to third-party training.

---

## 2. Repository audit — where real inference plugs in

| Area | Current state (verified in code) | Integration point |
|---|---|---|
| AI contract | `src/lib/services/ai-provider.ts` — `AIProvider` with `generateConcepts`, `editConcept`, `getJob`, `getResults`, `getEditResult`, `cancelJob`, `retryJob`, `virtualTryOn`; Zod schemas for generate/edit/try-on; `brandContextSchema` (approved-only) | Keep the interface. Add an **`HttpAIProvider`** (browser) that calls `/api/v1/*`; the server implements real providers behind a server-only `InferenceProvider` |
| Provider selection | `src/lib/services/index.ts` → `getAIProvider()` returns the singleton `DemoAIAdapter` | Select `HttpAIProvider` when live AI is enabled and the user is signed in; demo stays the default/fallback |
| Jobs | `job-machine.ts` (draft→queued→running→succeeded/failed/canceled, retry), `poll-job.ts` (sequential, abortable), `use-job-runner.ts`, `use-edit-job.ts`, `use-try-on-job.ts` | Same state machine server-side; UI keeps polling `GET /api/v1/jobs/:id` |
| Brand DNA | `lib/brand/intelligence.ts` → `buildBrandContext(mode, approvedVersion, …)`, `evaluateConcept()`; versions in browser store | Prompt compiler consumes the **server-held** approved version (never trust a client-sent context) |
| References | Studio `reference-dropzone.tsx` (object URLs, metadata only), Brand DNA `references-section.tsx` + `reference-files.ts` (in-tab) | Replace with signed uploads to private storage; reference **ids** in requests |
| Images | Every visual uses `GarmentPlaceholder` (14 components); `ConceptVersion.imageAssetId` already exists (`placeholder/…`) | Introduce `ConceptImage` (real asset via signed URL, else schematic placeholder) and swap it in where concepts are shown. Try-on stays schematic |
| Persistence | Zustand + localStorage (`raco-studio`, `raco-brand`, `raco-handoff`) | Live mode needs server persistence for orgs, users, assets, jobs, concepts/versions and approved Brand DNA. Other modules can migrate later |
| Backend | **None** — no `src/app/api` routes exist | Add minimal typed route handlers (`/api/v1`) on the existing Vercel deployment |
| Capability registry | `lib/config/capabilities.ts` marks AI features `simulated` unless provider is `live` | Flips automatically per provider; keeps honest labelling |

---

## 3. Model comparison matrix

Quality columns are **[E] expectations** to be tested in 6C/6G, not benchmarks.

| Model | Licence (commercial self-hosting) | Garment / textile quality [E] | Prompt adherence [E] | Reference conditioning | Editing / inpainting | VRAM | Speed per 1 MP image [E] | Fine-tuning | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **FLUX.2 [klein] 4B** | **Apache 2.0** [V] | Good | Good | Native multi-reference editing in the same model [V] | Yes (image-to-image multi-ref) [V]; masked inpainting not documented | ~13 GB [V] | ~1–3 s on L40S-class (4 steps) [E] | LoRA supported [V] | Distilled, guidance 1.0 → **no negative prompts** in practice |
| FLUX.2 [klein] 9B | FLUX **Non-Commercial** — commercial self-hosting needs a BFL licence [V] | Better | Better | Multi-ref | Yes | ~22 GB [V] | ~2–4 s [E] | Yes | API use includes commercial rights [V], but BFL API terms allow training on inputs [V] |
| FLUX.2 [dev] (32B) | FLUX **Non-Commercial** [S] | High | High | Multi-ref | Yes | Very high | Slow [E] | Yes | Not usable commercially without a BFL licence |
| FLUX.2 [pro]/[flex]/[max] | API only; outputs commercially usable [S] | High–very high | High | Multi-ref (API) | Yes | — | Hosted | No | $0.03–$0.07+/image [V]; **data terms block client designs** on self-serve [V] |
| **Qwen-Image + Qwen-Image-Edit-2511** | **Apache 2.0** [V] | High | High (strong text rendering) | Edit model takes multiple input images [V] | Yes (instruction editing) [V] | ~24 GB FP8 / ~41 GB BF16 [S] | ~15–60 s (40 steps, 20B) [E] | LoRA (community) | True CFG → negative prompts work |
| SDXL 1.0 | CreativeML Open RAIL++-M, commercial allowed with use restrictions [S] | Medium | Medium | IP-Adapter / ControlNet (mature ecosystem) | Mature inpainting | 8–12 GB | ~3–6 s [E] | Excellent | Oldest; lowest garment realism of the shortlist [E] |
| SD 3.5 (Large/Medium) | Stability **Community Licence**: free commercial use **only under $1M annual revenue**; Enterprise licence above [V] | Medium–high | Good | IP-Adapter (limited) | Some | 10–24 GB | ~5–15 s [E] | Yes | Revenue threshold applies to RACO **and** possibly clients — legal check needed |
| Hosted closed APIs (e.g. Gemini/Imagen, OpenAI image) | Commercial per provider terms | High | High | Image inputs supported | Yes | — | Hosted | No | Not evaluated in depth: data-processing terms for client IP must be reviewed first |

**Frameworks:** Hugging Face **Diffusers** (both shortlisted models have pipelines: `Flux2KleinPipeline` [V], `QwenImageEditPlusPipeline` [V]) is the recommended runtime — plain Python, testable, fits a serverless function. **ComfyUI** is excellent for exploration and node workflows but adds a server and workflow-JSON surface to secure; keep it for R&D, not the production path.

---

## 4. System architecture

```
┌────────────────────────── Browser (existing Next.js UI) ───────────────────────────┐
│ Studio · Brand DNA · Editor · Collections · Try-on · Technical                    │
│ AIProvider ──▶ HttpAIProvider (live)  |  DemoAIAdapter (demo, unchanged)           │
└──────────────┬─────────────────────────────────────────────────────────────────────┘
               │ HTTPS + session cookie (no provider keys in the browser)
┌──────────────▼──────────── Application API (Next.js route handlers on Vercel) ─────┐
│ /api/v1/generations · /jobs/:id · /jobs/:id/cancel · /assets/upload-url            │
│ /assets/:id (signed read URL) · /internal/jobs/:id/complete (HMAC callback)        │
│ AuthN (session) → AuthZ (org membership, role) → Zod validation → rate limit       │
│ → cost cap → audit log                                                             │
└──────────────┬───────────────────────────────┬─────────────────────────────────────┘
               │ enqueue (signed request)      │ SQL (org-scoped, RLS)
┌──────────────▼──────── AI orchestration ─────┐ ┌▼──────── Postgres ─────────────────┐
│ jobs table = queue of record                 │ │ orgs · users · memberships         │
│ PromptCompiler (pure, shared with UI)        │ │ brand_profiles (approved versions) │
│ InferenceProvider: modal-klein | modal-qwen  │ │ assets · jobs · concepts · versions│
│   | fal (non-confidential) | demo            │ │ usage/costs · audit_events         │
│ retries · timeouts · cancellation · costs    │ └────────────────────────────────────┘
└──────────────┬───────────────────────────────┘
               │ Modal web endpoint / spawn (secret-authenticated)
┌──────────────▼──────── Model execution (Modal serverless GPU, scale to zero) ──────┐
│ Diffusers pipeline (klein 4B; Qwen-Image optional) · weights on a Modal Volume     │
│ fetch refs via short-lived signed URLs → generate → upload outputs via signed PUT  │
│ → POST callback {jobId, outputs, seed, model, timings} (HMAC)                      │
└──────────────┬─────────────────────────────────────────────────────────────────────┘
┌──────────────▼──────── Private object storage ─────────────────────────────────────┐
│ org/{orgId}/refs/{assetId} · org/{orgId}/outputs/{jobId}/{n}.webp                  │
│ no public URLs; reads via signed URLs (≤10 min)                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**Why this shape**
- **No new long-running services.** Vercel hosts the API; Modal runs GPU work only while a job runs. Postgres is the job queue of record (status, attempts, timestamps). Redis or BullMQ only if volume ever justifies it.
- **Async by design.** `POST /generations` returns a job id immediately. The worker reports completion by signed callback; the UI keeps its existing sequential polling.
- **Provider-agnostic.** `InferenceProvider { submit, cancel, capabilities }` on the server; `capabilities` declares what is genuinely supported (progress granularity, cancellation, seeds, negative prompts, max references) so the UI never overclaims.
- **Monitoring.** Structured logs with secret/PII redaction; error tracking (Sentry is available to this workspace); per-job timings and cost rows.

**Honest capability notes (to be confirmed in 6C)**
- *Progress:* per image (k of n) and queued/running states. Per-step progress only if we add a step callback.
- *Cancellation:* queued jobs cancel cleanly; a running batch stops **between images**; an in-flight diffusion pass is not interrupted.
- *Seeds:* recorded per image; same seed + model + parameters + GPU type should reproduce closely. Bit-exact reproducibility across GPU types is **not** promised.

---

## 5. Generation pipeline

```
1 Brief (Studio) ─▶ 2 Load approved Brand DNA (server, by org) ─▶ 3 PromptCompiler
      │                                                              │
      ▼                                                              ▼
4 Prepare references (validated asset ids → signed URLs; palette extracted)
      │
      ▼
5 Insert job (queued) + cost check ─▶ 6 Modal worker generates N images
      │                                        │
      ▼                                        ▼
7 Store images (private) + metadata ◀── callback (HMAC) ── timings, seed, model hash
      │
      ▼
8 Studio results (signed URLs) ─▶ 9 Select / compare / save ─▶ 10 Editor & Collections
```

**Provenance recorded per image** (extends `Concept` / `ConceptVersion`): `orgId`, `jobId`, provider id, model id + weights revision/hash, compiled prompt (positive + negative), seed, steps, guidance, resolution, Brand DNA profile id + version, reference asset ids with rights status, timestamps, GPU type, GPU-seconds and cost. `capability: "live"` replaces `"simulated"` only for these concepts.

**Prompt compiler** (`src/lib/ai/prompt-compiler.ts`, pure and unit-tested; shared by server and request preview):

| Input | Compiled as |
|---|---|
| Brief text | Core description (sanitised, length-capped; treated as data, never as instructions to other systems) |
| Category, silhouette, materials, construction details | Structured garment clause (controlled vocabulary already in `lib/brand/vocabulary.ts`) |
| Presentation preset | e.g. "studio product photograph, ghost mannequin / flat lay / on a neutral fashion model, seamless light-grey background, soft even lighting, full garment in frame" (founder decision §13) |
| Palette | Colour **names** (models follow names better than hex); approved palette in Brand mode |
| Brand DNA | Brand mode: preferred silhouettes, materials, signature details, guidance text. Hybrid: anchors only (signature colours + 1–2 rules), plus variation. Explore: none |
| Exclusions | Negative prompt where the model honours it (Qwen-Image true CFG); positive rephrasing for klein ("clean, unbranded surface, concealed fastening") because distilled klein runs at guidance 1.0 |
| Creativity / exploration | Seed spread, reference strength, and how many brand terms are included |

---

## 6. Brand DNA → generation

| Constraint | How applied | Enforceable? |
|---|---|---|
| Approved version only | Server loads the org's approved profile; client-sent context ignored | **Programmatic — guaranteed** |
| Brand profile version recorded | Stored on job and concept | **Guaranteed** |
| Approved references only | Server resolves reference ids → must be approved + rights-confirmed + same org | **Guaranteed** |
| Output count, resolution, seeds | Request parameters | **Guaranteed** |
| Palette / signature colours | Prompt colour names + optional palette reference; **post-check** of dominant colours (k-means) flags off-palette results | Probabilistic generation, **programmatic detection** |
| Preferred silhouettes, materials, construction details | Prompt terms and references | **Probabilistic** — model may ignore them |
| Negative rules (logos, hardware, fluorescents) | Negative prompt or positive rephrasing | **Probabilistic**; detection needs a vision model (6G) |
| Guidance rules (e.g. "understated luxury") | Included as text | **Guidance only** — never scored as met |

**Modes:** Explore = no brand terms. Brand = all active rules and approved palette, strong references, narrow seed spread. Hybrid = signature anchors and one or two rules, weaker references, wider spread. This maps directly onto the existing `strictness` / `explorationWeight` fields.

**Consistency scoring for real images (6G):** run a vision-language model to tag the generated image (garment type, silhouette, visible hardware, colours), feed the tags into the existing `evaluateConcept()`, and label the result "AI-assessed". It is never presented as ground truth. We do not promise perfect brand consistency.

---

## 7. Reference image intelligence

**Method (selected model):** FLUX.2 [klein] 4B **native multi-reference** inputs [V], with Qwen-Image-Edit-2511 multi-image as the alternative [V]. No ControlNet or IP-Adapter stack is needed for these models. SDXL's IP-Adapter/ControlNet ecosystem remains an option only if structure control (e.g. sketch → garment) proves essential.

| Reference type | Treatment |
|---|---|
| Visual inspiration / moodboard | Passed as a reference image + "inspired by the mood of image N" |
| Silhouette reference | Reference image + explicit instruction; optional later: sketch/line-art conditioning |
| Material reference | Reference image + "use the fabric texture of image N"; result is probabilistic |
| Colour reference | **Deterministic palette extraction** server-side → colour names in the prompt (more reliable than visual conditioning) |
| Historical collections | Approved Brand DNA references; retrieval by embeddings deferred to a later phase |

We will not claim the model understands these categories. The UI states that categories shape the instruction only.

**Lifecycle**
1. *Validate (server):* rights confirmation required; size ≤ 8 MB; magic-byte type check (JPEG/PNG/WebP only); decode and re-encode to strip EXIF/metadata and reject malformed files; dimension limits; max references per request (set to the model's documented limit after verification).
2. *Store:* private bucket `org/{orgId}/refs/{assetId}`; the database row holds org, uploader, rights, consent, category, hash and created/expiry dates.
3. *Process:* the worker receives short-lived signed **read** URLs, keeps files only in its ephemeral container, and holds no credentials beyond the job.
4. *Use:* asset ids are recorded in job and concept provenance.
5. *Protect:* org-scoped access checks on every read; signed URLs ≤ 10 min; never sent to providers that train on inputs.
6. *Delete:* user-initiated deletion removes the object and marks the row deleted, with an audit event. Retention default is founder decision §13. Generated concepts keep the reference *id* and a "deleted" status for provenance.

---

## 8. GPU & hosting strategy

| Option | Fit for pilot | Idle cost | Notes |
|---|---|---|---|
| A. Local GPU | Dev only | — | The dev machine has no CUDA GPU; Apple MPS isn't representative of production |
| B. Dedicated GPU server | ✗ | ~$0.87–$1.95/hr × 720 h ≈ **$630–$1,400/month** [S/E] even when idle | Only at sustained high volume |
| C. On-demand pods (RunPod Pods, Vast.ai) | Manual | Pay while running | Vast.ai community hosts are a poor fit for proprietary client data |
| **D. Serverless GPU (Modal; RunPod Serverless as alternative)** | **✓ Recommended** | **$0 when idle** (scale to zero) | Per-second billing: Modal L40S $0.000542/s ≈ $1.95/h [V]; A100 80 GB $0.000944/s [S]; RunPod flex 48 GB ~$0.00053/s, A100 ~$0.00076/s [S] |
| E. Hosted inference API (fal, BFL) | Fallback | $0 | klein 4B from ~$0.014/image, Qwen-Image ~$0.02/MP, FLUX.2 [pro] from $0.03 [V/S]; data terms limit use (§1) |

> **Superseded:** the table below counted image time only. See the corrected model (cold starts, idle tail, CPU/RAM, L4 baseline) in [PHASE_6_VALIDATION_PLAN.md §5](PHASE_6_VALIDATION_PLAN.md#5-corrected-cost-model).

**Original cost estimates** (per 1 MP image; **all [E]**)

| | klein 4B on Modal L40S | Qwen-Image on Modal A100 80 GB | fal hosted klein 4B |
|---|---|---|---|
| GPU time / image | 2–5 s incl. overhead | 20–60 s | n/a |
| Cost / image | **$0.001–0.003** | **$0.02–0.06** | ~$0.014 [V/S] |
| Cost / 100 concepts | ~$0.10–0.30 + cold starts | ~$2–6 | ~$1.40 |
| Cold start | 10–60 s per new container; memory snapshots can cut this (2–10× claimed for LLMs) [S] | 30–120 s | none |
| Low usage (500 concepts/month) | **< $5/month** GPU | ~$10–30 | ~$7 |
| Moderate usage (5,000 concepts/month) | **~$10–40/month** GPU | ~$100–300 | ~$70 |
| Idle | **$0** | **$0** | $0 |

**Other monthly costs [E]:** Postgres, auth and storage on a managed free or starter tier ($0–$25/month at pilot scale). Image storage at ~1 MB per WebP output: 5,000 images ≈ 5 GB, which costs cents to low single dollars per month depending on provider; egress terms vary by provider. The Vercel plan is unchanged. The fixed monthly cost is dominated by the database/auth tier, not GPUs.

**Recommendation:** Modal serverless (Python-native, Volumes for weights, secrets, per-second billing, scale to zero, cancellable function calls). Keep RunPod Serverless as a portable alternative behind the same `InferenceProvider`. Neither requires paying for idle GPUs.

---

## 9. Security & data ownership

**Essential before processing any real client-owned design (gate for 6E):**
1. Real authentication (sessions) with org membership and roles enforced **server-side** on every route. Browser-local filtering is not tenant isolation.
2. Postgres row-level security (or equivalent query scoping) keyed by `org_id`, plus tests proving cross-org reads and writes fail.
3. Private storage only; signed URLs ≤ 10 min; object paths prefixed by org; no client-supplied URLs fetched by the server.
4. Provider credentials only in server/Modal secrets; the worker authenticates the callback with an HMAC and receives no database credentials.
5. Inference providers must not train on or retain inputs. Self-hosted Modal satisfies this; hosted APIs require a signed DPA / zero-retention agreement first (BFL self-serve and fal self-serve do not qualify for client IP).
6. Upload validation (type sniffing, re-encode, size and dimension limits, rights confirmation).
7. Audit log of uploads, generations, approvals, deletions and exports (actor, org, resource, time).
8. Retention and deletion workflow (user deletion + scheduled expiry) and a documented data-processing statement for clients.
9. Rate limits and per-org monthly cost caps checked before enqueue.
10. Log redaction (no secrets, signed URLs or raw prompts in third-party error tools unless the client agrees).

---

## 10. Implementation roadmap

| Milestone | Objective | Key tasks | Infrastructure | Depends on | Complexity | Acceptance criteria | Risks |
|---|---|---|---|---|---|---|---|
| **6A** Architecture & model selection | Approve this proposal | Founder decisions (§13); legal read of licences and provider DPAs | — | — | S | Decisions recorded | Licence terms change |
| **6B** Secure backend foundation | Auth, org scoping, storage, job table | `/api/v1` scaffolding; auth + memberships; Postgres schema (orgs, users, memberships, assets, jobs, concepts, versions, brand_profiles, usage, audit); private bucket + signed upload/read; env validation; audit log; rate limit & cost cap; `HttpAIProvider` with demo fallback | Managed Postgres + auth + storage; Vercel env secrets | 6A | M–L | Sign-in works; cross-org access tests fail as expected; signed upload/read round trip; no secrets in client bundle (test) | Scope creep into full data migration |
| **6C** First real text-to-image | First real garment images in Studio | Modal app (klein 4B, Diffusers, weights on Volume); submit/callback/cancel; image storage; `ConceptImage` in Studio cards, inspector, compare; provenance; measure latency, cold start, cost | Modal account + GPU quota | 6B | M | 4 concepts from a blazer brief appear with real images, labelled Live; provenance shows model/seed/prompt; measured latency and cost recorded; demo mode unchanged | Garment quality below expectations → bring the Qwen-Image bake-off forward |
| **6D** Brand DNA prompt integration | Approved Brand DNA drives prompts | Server-held approved profiles; PromptCompiler with mode handling; request preview shows the compiled prompt; palette post-check | — | 6C | M | Changing an approved rule changes the compiled prompt (test); Brand/Hybrid/Explore produce visibly different briefs; palette check flags off-palette images | Model ignores subtle rules |
| **6E** Reference-conditioned generation | Authorised references shape outputs | Signed uploads replace object URLs; server validation/re-encode; rights/consent; categories → instructions; palette extraction; deletion | Storage | 6D, security gate §9 | M | Uploaded reference measurably influences output (human-rated); unapproved or other-org references rejected; deletion removes the object | Reference adherence varies |
| **6F** Editor & Collections integration | Real images through Editor, Collections, presentation | `ConceptImage` everywhere; Editor shows real image; refinement via klein/Qwen editing **or** clearly labelled metadata-only edits; versions keep image asset ids | — | 6C | M | Real concept opens in Editor with correct provenance; collection board and presentation show the real image; no pixel claims for metadata edits | Editing quality |
| **6G** Evaluation & pilot readiness | Measured quality, cost, latency | 5+ brief benchmark (blazer, dress, outerwear, knitwear, resort shirt) × 3 modes; klein vs Qwen-Image bake-off; human panel rubric; optional VLM-assessed consistency; cost per *accepted* concept; docs | GPU time for evaluation | 6C–6F | M | Results table from real runs; default model decision; updated capability registry | Rater availability |

**Fastest path to a first real image:** 6B (thin) → 6C. A "thin 6B" (auth + one org + private storage + jobs + signed callback) is the minimum we should not skip, even internally.

---

## 11. Repository integration plan

| Path | Change |
|---|---|
| `src/lib/services/ai-provider.ts` | Add `ProviderInfo.capabilities` (progress granularity, cancel mode, seeds, negatives, maxReferences); add optional live provenance fields to results; keep existing methods |
| `src/lib/services/http-provider.ts` *(new)* | Browser `AIProvider` → `/api/v1` |
| `src/lib/services/index.ts` | Provider selection (demo vs live), honouring flags and session |
| `src/lib/ai/prompt-compiler.ts` *(new, pure)* | Brief + Brand DNA + refs → `{ positive, negative, params }` |
| `src/server/**` *(new)* | `inference/{modal,fal,demo}.ts`, `jobs.ts`, `storage.ts`, `auth.ts`, `audit.ts`, `env.ts` (Zod-validated) |
| `src/app/api/v1/**` *(new)* | generations, jobs, cancel, assets (upload-url, signed read), internal callback |
| `src/components/shared/concept-image.tsx` *(new)* | Real image (signed URL, loading/error states, high-res viewer) or schematic placeholder |
| Studio / Editor / Collections / presentation components | `GarmentPlaceholder` → `ConceptImage` where a concept is shown (try-on and technical drawings stay schematic) |
| `src/lib/types/domain.ts` | `GenerationProvenance` on concept/version; `capability: "live"` for real outputs |
| `src/lib/config/capabilities.ts` | Already flips to functional for a live provider |
| `inference/` *(new, Python)* | Modal app + Diffusers pipeline; no weights in git |
| `.env.example`, docs | Variables (no values); REAL_AI_ARCHITECTURE, MODEL_SELECTION, GENERATION_PIPELINE, IMAGE_STORAGE_SECURITY, FASHION_EVALUATION, DEPLOYMENT_AI |

The demo adapter, schematic renderer, browser stores and all existing tests remain; demo mode keeps working offline.

---

## 12. Risks & limitations

- **Quality is unmeasured.** All quality and speed statements are expectations until 6C/6G. klein 4B is a fast distilled model and may underperform larger models on fine construction.
- **Licences change.** FLUX variants have different licences (4B Apache vs 9B/dev non-commercial) and many articles get this wrong. Re-check model cards at each upgrade.
- **SD 3.5 revenue threshold.** The $1M cap could bind as RACO or clients grow; it is not recommended as a default.
- **Hosted API data terms.** BFL self-serve allows training on inputs; fal permits anonymised usage data. Both are unsuitable for client IP without contracts.
- **Brand adherence is probabilistic.** Only some constraints are programmatically guaranteed (§6).
- **Garment realism ≠ manufacturability.** Images are concepts; the technical handoff disclaimers stay.
- **People in images.** On-model presentation risks implying real people. Ghost-mannequin or flat-lay defaults avoid likeness issues.
- **Cold starts** make the first image after idle slow; snapshots and keep-warm windows trade cost for latency.
- **Migration scope.** Moving all browser stores to the server is larger than this phase; we migrate only what generation needs and keep the rest local until a later phase.

---

## 13. Decisions requiring founder approval

1. **Default model:** start with FLUX.2 [klein] 4B (recommended) and run a Qwen-Image bake-off in 6G, or start directly with Qwen-Image?
2. **GPU host:** Modal (recommended) or RunPod Serverless?
3. **Backend stack:** one managed Postgres + auth + private storage provider (lighter to run), or separate Postgres + auth library + object storage? (The 6B proposal will detail both options with costs.)
4. **Hosted fallback policy:** allow fal for *non-confidential* briefs now, or no hosted fallback until a DPA / zero-retention agreement is signed?
5. **Presentation preset default:** ghost mannequin, flat lay, or on-model (fictional, non-identifiable)?
6. **Budget guardrails:** per-org monthly cap and per-user rate limit for the pilot (proposal: $25/org/month, 20 generations/hour/user).
7. **Retention:** reference and output retention period and deletion SLA to offer clients (proposal: references 90 days unless pinned, outputs until deleted).
8. **Evaluation panel:** who rates the 6G benchmark (designers from the client vs internal)?
9. **Legal review:** confirm model licences and provider DPAs before any client data is processed.

---

## Sources (checked 10 Oct 2026)
- BFL — FLUX.2 [klein] local use & licences: https://help.bfl.ai/articles/7108141705-can-i-run-or-fine-tune-flux-2-klein-locally
- FLUX.2 [klein] 4B model card (Apache 2.0, multi-reference editing, ~13 GB): https://huggingface.co/black-forest-labs/FLUX.2-klein-4B
- BFL API pricing: https://docs.bfl.ai/quick_start/pricing
- BFL FLUX API service terms (training on inputs/outputs, §2(b)): https://bfl.ai/legal/flux-api-service-terms
- Qwen-Image-Edit-2511 model card (Apache 2.0, multi-image input, 20B): https://huggingface.co/Qwen/Qwen-Image-Edit-2511
- Qwen-Image VRAM guidance (community): https://www.spheron.network/blog/deploy-open-source-ai-image-editing-models-gpu-cloud-2026/ · https://localaimaster.com/blog/qwen-image-edit-local-guide
- Stability AI licence (Community Licence, $1M threshold): https://stability.ai/license
- SDXL licence (OpenRAIL++, community mirror): https://huggingface.co/YuCollection/sdxl-1.0-base-diffusers/blob/main/README.md
- Modal L40S per-second price: https://frontend.modal.com/blog/nvidia-l40s-price-article · Modal price history: https://pricingsaas.com/companies/modal/diffs/2024Q4
- Modal memory snapshots: https://modal.com/docs/examples/vllm_snapshot
- RunPod serverless pricing: https://docs.runpod.io/serverless/pricing · https://www.runpod.io/gpu-instance/pricing
- fal pricing & terms: https://fal.ai/pricing · https://fal.ai/terms · https://fal.ai/learn/tools/flux-vs-qwen-image
- FLUX licence overview (secondary): https://invideo.io/blog/flux-ai-image-generator/
