# Phase 6 — Decision Record & Validation Plan

*Status: awaiting founder approval to start. No paid resources provisioned, nothing purchased, no inference deployed. Prepared 10 Oct 2026. Builds on [PHASE_6_AI_ARCHITECTURE_PROPOSAL.md](PHASE_6_AI_ARCHITECTURE_PROPOSAL.md).*

Legend: **[V]** verified from an authoritative/vendor source today · **[S]** secondary source · **[E]** engineering estimate, *to be replaced by Track A measurements*.

---

## 1. Provisional founder decisions (recorded 10 Oct 2026)

| # | Decision | Condition / note |
|---|---|---|
| 1 | Primary model **FLUX.2 [klein] 4B** | Subject to licensing (§3 ✓), Modal compatibility (§4) and quality (Track A) |
| 2 | GPU infrastructure **Modal** for the pilot | `InferenceProvider` stays portable to RunPod Serverless |
| 3 | Backend **Next.js API + PostgreSQL + Prisma + private S3-compatible storage + Python inference workers** | Replaces the "managed all-in-one" option in the proposal |
| 4 | Hosted API fallback **disabled for proprietary client assets** | Until data-processing terms are approved |
| 5 | Default presentation **ghost mannequin**; flat lay secondary; on-model deferred | Prompt presets accordingly |
| 6 | Budget: **$25 / org / month**, **20 generation requests / user / hour**, configurable **global spending limit** | Enforced server-side (Track B) |
| 7 | Retention: **references 30 days**, **outputs 90 days** | Subject to client agreements; configurable per org |
| 8 | Evaluation: technical reliability by **RACO engineering**; garment quality by **fashion professionals** | Rubrics in §7 |
| 9 | **Legal review mandatory** before real client designs are processed | Gate for any Track A → product connection |

**Architectural change:** implementation is split into two independent tracks.
- **Track A** is an isolated model evaluation using fictional briefs and licensed test references only.
- **Track B** is the secure application foundation.

Real inference is not exposed to client users until Track B controls are tested **and** legal review is complete.

---

## 2. Two tracks

```
TRACK A — Internal model evaluation (isolated)        TRACK B — Secure application foundation
experiments/flux2-klein-eval/  (Python + Modal)        Next.js /api/v1 + Postgres/Prisma + S3
  • fictional briefs, RACO-owned/CC0 references          • auth, server-side authZ, org isolation
  • no app code imports it, no client data               • persistence, private storage, uploads
  • outputs stay in the experiment workspace             • audit, rate limits, spend controls
  • produces: measurements + images + report             • retention & deletion
            │                                                       │
            └──────────── joined only after: Track A passes, Track B controls tested,
                          legal review done, founder approval (milestone 6C) ─────┘
```

---

## 3. Licensing — reconfirmed from authoritative sources

| Component | Licence | Evidence |
|---|---|---|
| FLUX.2 [klein] 4B transformer and repository | **Apache 2.0**: standard text, no added restrictions or acceptable-use policy in `LICENSE.md` | Model card `license: apache-2.0` and `LICENSE.md` [V]; BFL help centre: “released under Apache 2.0, so you can use it commercially with no fees or approvals” [V] |
| Bundled text encoder (`text_encoder/`) | Architecture `Qwen3ForCausalLM`, hidden 2560 × 36 layers. This matches **Qwen3-4B**, which is **Apache 2.0** | Config [V]; Qwen3-4B config and licence [V]. The match is inferred from identical architecture; the repo does not name the base checkpoint |
| VAE, scheduler, tokenizer | Shipped inside the Apache-2.0 repository; no separate licence file | Repo tree [V] |
| FLUX.2 [klein] **9B**, FLUX.2 [dev] | **Non-commercial**; commercial self-hosting needs a BFL licence | BFL help centre [V]. **Must not be used**, even accidentally (pin the exact repo id) |

**Residual licensing actions (for the legal review):**
1. Confirm in writing whether BFL considers the bundled text encoder covered by the repo's Apache 2.0 licence. We infer Qwen3-4B, also Apache 2.0, so there is no conflict either way.
2. Record the exact Hugging Face revision hash used, because licences can change on new revisions.
3. Check whether the repo requires accepting terms (gating) on Hugging Face. The model page showed no gating notice, but this is unconfirmed.
4. Apache 2.0 obligations: keep the licence and NOTICE text when redistributing weights. We don't redistribute; hosting for inference triggers no redistribution.

---

## 4. Modal hardware compatibility

| Check | Finding |
|---|---|
| Runtime | Diffusers `Flux2KleinPipeline`, `torch.bfloat16`, CUDA [V]. The card says to install **diffusers from git main** [V], so pin a specific commit for reproducibility |
| VRAM | Card: “~13 GB VRAM” [V]. Components in bf16: transformer ~8 GB + Qwen3-4B text encoder ~8 GB + VAE → **~16–17 GB if all resident** [E]. Optional CPU offload lowers peak VRAM at a latency cost [V] |
| Download size | Repo 23.7 GB total; it includes a 7.75 GB single-file checkpoint we don't need [V]. Fetch only the Diffusers subfolders (~16 GB [E]) into a Modal Volume once |
| Candidate GPUs on Modal [V] | **L4 24 GB** $0.000222/s · **A10 24 GB** $0.000306/s · **L40S 48 GB** $0.000542/s · A100 40/80 GB, H100, etc. |
| Choice | **L4 as baseline** (all components fit in bf16, cheapest per second). A10 and L40S are measured for comparison; T4 (16 GB) is excluded as too tight |
| Speed evidence | Vendor: “as low as under a second” with no GPU named [V]. Secondary: ~1.2 s per 1024² on RTX 5090, ~0.3 s on GB200 [S]. **No published L4/A10/L40S figures**, which is exactly what Track A measures |

**Compatibility risks:** diffusers-from-git breakage (mitigation: pin commit, build the image once); first-load time for ~16 GB of weights (Modal Volume reads ~1–2 GB/s [S] → ~8–16 s plus CUDA init); bf16 on L4/A10 is supported by Ampere/Ada GPUs.

---

## 5. Corrected cost model

**What Modal actually bills** [V]: GPU per second, **plus CPU ($0.0000131 / core / s) and memory ($0.00000222 / GiB / s)**, from container start to shutdown. That includes **cold start** and the **idle scale-down window** after the last request. The proposal's earlier figures counted only image time.

Assumed container: 4 physical cores + 32 GiB RAM (≈ $0.000123/s CPU+RAM).

| GPU | All-in rate | Per hour |
|---|---|---|
| L4 | $0.000345/s | $1.24 |
| A10 | $0.000429/s | $1.55 |
| L40S | $0.000665/s | $2.40 |

**Runtime assumptions [E]** (realistic, deliberately conservative until measured)

| | L4 | L40S |
|---|---|---|
| Warm time per 1024² image (text encode + 4 steps + VAE decode) | 4–8 s | 2–4 s |
| Request of 4 concepts (+2 s overhead) | 18–34 s | 10–18 s |
| Cold start (container + CUDA + load ~16 GB weights) | 30–90 s | 30–90 s |
| Idle tail before scale-down (configured) | 60 s | 60 s |

**Derived costs [E]**

| Scenario | L4 | L40S |
|---|---|---|
| Warm request (4 images) | $0.006–0.012 → **$0.0016–0.003/image** | $0.007–0.012 → $0.002–0.003/image |
| Each cold episode (start + idle tail) | $0.031–0.052 | $0.060–0.100 |
| **Low usage** — 500 concepts / 125 requests / month, all cold | **≈ $5–8 / month** (≈ $0.009–0.016 per image) | ≈ $8–14 |
| **Moderate usage** — 5,000 concepts / 1,250 requests, 50% cold | **≈ $27–47 / month** (≈ $0.005–0.009 per image) | ≈ $36–76 |
| Idle (no requests) | **$0** | $0 |

**Takeaways:**
- At pilot volume the cost is dominated by cold starts and idle tails, not image time. The levers are: batch four concepts per request; keep a short warm window during working hours only if latency demands it; use memory snapshots if Track A shows they work for this pipeline.
- The Modal Starter plan includes **$30/month of free credits** [V], which would cover the low-usage scenario entirely (subject to Modal's current terms).
- These replace the proposal's $0.001–0.003/image figure, which ignored cold starts, idle time and CPU/RAM.

---

## 6. Experimental (Track A) vs production (Track B) costs

### Track A — one-off evaluation budget

| Item | Volume | Billed time [E] |
|---|---|---|
| Weights download to a Volume | once, CPU container | ~10 min CPU, < $0.05 |
| Quality set (L4) | 5 briefs × 2 presentations × 4 seeds = **40 images** | ~5 min |
| Prompt-adherence set (L4) | 5 briefs × 2 prompt styles (structured vs plain) × 4 seeds = **40 images** | ~5 min |
| Latency set | 3 GPUs × 20 warm images = **60 images** | ~6 min |
| Cold-start set | 3 GPUs × 5 cold starts (incl. 60 s tail) | ~38 min |
| Memory profiling | within the runs above | — |
| Iteration and debugging allowance | ×3 | — |
| **Total** | ~140 images, ~2.5–3 GPU-hours mixed | **≈ $4–7**; proposed hard cap **$15** |

The expected out-of-pocket cost is **$0** if the Starter credits apply.

### Track B / production — recurring, *not* incurred until deployment approval

| Item | Pilot estimate | Status |
|---|---|---|
| Modal GPU (generation) | $5–47 / month (§5) | [E], usage-based, $0 idle |
| PostgreSQL (managed) | $0–25 / month at pilot scale | provider to choose [E] |
| S3-compatible private storage | < $1–2 / month (≈1 MB per WebP; 5,000 outputs ≈ 5 GB, with 90/30-day retention) | [E] |
| Vercel hosting | **Check the plan.** The project is on **Hobby**, which Vercel restricts to non-commercial use [S]. A commercial pilot likely needs Pro | founder/legal to confirm |
| Error monitoring | free tier | optional |
| Email for sign-in links (if used) | free tier | optional |

**Local development of Track B needs no paid services:** Postgres and an S3-compatible store (e.g. MinIO) can run locally in Docker.

---

## 7. Benchmark briefs (fictional — Serein Atelier)

All prompts use the **ghost mannequin** preset by default (“invisible-mannequin product photograph, garment shown in 3D shape with no visible model, front view, centred, full garment in frame, seamless light-grey background, soft even studio lighting, no logos, no text”). Each brief is also run as **flat lay**.

| # | Brief | Garment / silhouette | Material & colour | Required details (adherence checklist) |
|---|---|---|---|---|
| 1 | Tailored blazer | Single-breasted blazer, extended structured shoulder, hip length | Lightweight wool, stone | Notched lapel; two-button; flap pockets; straight hem; shoulder line visibly extended |
| 2 | Column dress | Bias-cut column dress, mid-calf | Silk crepe, ink | Cowl or bateau neckline; fluid drape; no waist seam; length to mid-calf |
| 3 | Wrap coat | Cocoon wrap coat, below the knee | Double-faced wool, espresso | Shawl collar; self-tie belt; dropped shoulder; concealed closure; no visible hardware |
| 4 | Rib knit | Funnel-neck sweater, relaxed | Merino rib, oxblood | Ribbed texture readable; funnel neck; fully-fashioned shoulder seams; ribbed cuffs and hem |
| 5 | Wide-leg trouser | High-rise wide-leg trouser, full length | Wool flannel, charcoal | Front double pleats; pressed crease; side-seam pockets; waistband with concealed closure |

**Automated / engineering measures (RACO engineering):** success rate; failures (OOM, timeouts, NaNs, black images); warm latency split into text-encode, denoise and VAE; peak VRAM (`torch.cuda.max_memory_allocated` and `nvidia-smi`); cold-start breakdown (container start → weights loaded → first image); billed seconds; cost per image; seed reproducibility (same seed twice on the same GPU type).

**Human quality rubric (fashion professionals, blind, 1–5 each):** garment type correct · silhouette accuracy · construction detail coherence (checklist hit rate) · fabric realism · colour accuracy · ghost-mannequin presentation quality (no body/model visible, clean interior) · overall usability as a design concept. Failure cases (extra sleeves, fused pockets, text or logos, warped hems, visible mannequin) are tagged and kept in the report.

**Licensed test references (multi-reference test, optional in A):** only RACO-owned photographs, images generated in this experiment, or CC0 images with recorded source URLs. No client material and no scraped fashion imagery.

---

## 8. Infrastructure requiring payment or credentials

| Item | Track | Payment | Credential | Where it lives |
|---|---|---|---|---|
| Modal account (Starter) | A, later B | Usage-based; $30/mo credit [V] | `MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET` | Engineer's machine (`modal token new`); never in git |
| Hugging Face account | A | Free | `HF_TOKEN` (only if the repo turns out to be gated) | Modal Secret |
| Modal spending guardrail | A | — | Workspace settings | Founder sets a budget/alert in the Modal dashboard before the first run |
| PostgreSQL (managed) | B (deploy) | Free/paid tier | `DATABASE_URL` | Vercel env / Modal Secret |
| S3-compatible storage | B (deploy) | Usage-based | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Vercel env |
| Auth secret / OAuth app | B | Free | `AUTH_SECRET` (+ OAuth client id/secret if used) | Vercel env |
| Worker callback signing | B/6C | — | `INFERENCE_CALLBACK_SECRET` | Vercel env + Modal Secret |
| Vercel plan for commercial use | B (deploy) | Likely Pro | — | Founder decision |
| Error monitoring (optional) | B | Free tier | `SENTRY_DSN` | Vercel env |

---

## 9. Smallest implementation milestones

### 6A-1 — Inference spike (Track A) · *proposed first*
**Scope:** one isolated folder, `experiments/flux2-klein-eval/`, that the Next.js app neither imports nor deploys.
- `app.py`: Modal app with a pinned image (Python 3.11, torch + CUDA, diffusers at a pinned git commit). A Volume holds weights fetched once (Diffusers subfolders only, revision pinned). Function `generate(brief_id, presentation, seed, steps=4)` on L4 by default with GPU overridable, `max_containers=1`, a per-call timeout, and a 60 s scale-down window. It returns PNG bytes plus metrics: phase timings, peak VRAM, GPU name, model revision.
- `briefs.json`: the five briefs × presentations (§7).
- `run_benchmark.py`: local CLI to run the quality, latency and cold-start sets. It writes images + `results.jsonl` to `experiments/flux2-klein-eval/out/` (git-ignored) and stops when the configured cost cap is reached.
- `REPORT.md`: tables filled from measured data only, plus a failure-case gallery and the human rating sheet (CSV).

**No:** app integration, client data, public endpoints, stored credentials, or inference reachable by users.

**Acceptance:**
- Model loads and generates on L4 (and A10/L40S for comparison).
- 140 benchmark images produced.
- Measured warm latency, peak VRAM, cold start and billed cost per image recorded.
- Failure cases documented.
- Total spend ≤ cap.

**Effort:** ~1–2 engineering days.

**Needs your approval for:** creating/using a Modal account, running ≤ $15 of GPU time, and an HF token if the repo is gated.

### 6B-1 — Secure foundation skeleton (Track B) · *can start in parallel, $0*
Runs locally with Docker Postgres and MinIO:
- Prisma schema for orgs, users, memberships, assets, jobs, usage and audit events.
- Auth, with an org membership check on every `/api/v1` handler.
- Signed upload/read URLs.
- Rate limiting and spend counters enforced server-side.
- Retention fields and a deletion job.
- Tests proving cross-org access fails.

Nothing is deployed; the existing demo is unchanged.

### Join point — 6C (later approval)
Connect Track A's validated worker to Track B behind `InferenceProvider`, for **internal users and fictional data only**, until legal review clears client data.

---

## 10. Approvals requested now
1. Approve **6A-1** (inference spike) with a GPU cap of **$15**, run on a Modal account you control or create.
2. Approve **6B-1** to start locally at **$0** (no deployment).
3. Confirm who sets the Modal budget alert and who holds the Modal/HF credentials.
4. Confirm the Vercel plan question for eventual commercial deployment (legal/founder).

## Sources (checked 10 Oct 2026)
- FLUX.2 [klein] 4B model card and README: https://huggingface.co/black-forest-labs/FLUX.2-klein-4B · https://huggingface.co/black-forest-labs/FLUX.2-klein-4B/raw/main/README.md
- `LICENSE.md` (Apache 2.0): https://huggingface.co/black-forest-labs/FLUX.2-klein-4B/raw/main/LICENSE.md
- Text encoder config: https://huggingface.co/black-forest-labs/FLUX.2-klein-4B/raw/main/text_encoder/config.json
- Qwen3-4B (Apache 2.0, config): https://huggingface.co/Qwen/Qwen3-4B
- BFL help — klein licensing and hardware: https://help.bfl.ai/articles/7108141705-can-i-run-or-fine-tune-flux-2-klein-locally
- Modal pricing (GPU/CPU/memory per second, Starter credits): https://modal.com/pricing
- Modal Volumes and snapshots: https://modal.com/docs/examples/vllm_snapshot
- klein speed (secondary): https://awesomeagents.ai/models/flux-2-klein-4b/ · https://www.spheron.network/tools/gpu-recommender/black-forest-labs/FLUX.2-klein-4B/
