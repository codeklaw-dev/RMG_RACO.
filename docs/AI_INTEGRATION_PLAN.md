# AI Integration Plan

## Contract
`src/lib/services/ai-provider.ts` — `generateConcepts`, `editConcept`, `analyzeBrand`, `virtualTryOn`, `getJob`, `getResults`, `cancelJob`, `retryJob`. Job states are enforced by `job-machine.ts`.

`GenerateRequest` carries: prompt, category, silhouette, materials, palette, mode, `brandContext`, target collection, reference asset ids, count (2–4), creativity, seed, `variationOf`, idempotency key. `simulateFailure` is demo-only. All return job ids; results attach to `ConceptVersion` with provenance (prompt, seed, model/version, source assets, licence).

Real adapters run **server-side only**, behind `/api/v1`, with timeouts, retries, cancellation, idempotency and per-org cost caps.

## Candidate providers (evaluate before use)
| Capability | Candidates | Notes |
|---|---|---|
| Text-to-image | FLUX.1 [dev]/[schnell], SDXL via ComfyUI or Diffusers | FLUX [dev] weights are **non-commercial**; [schnell] is Apache-2.0. SDXL uses OpenRAIL++. Hosted APIs (e.g. FLUX Pro) need commercial terms. |
| Edit / inpaint | SDXL/FLUX inpainting, Segment Anything for masks | SAM is Apache-2.0. |
| Vision analysis | Hosted VLM (Claude, others) or open VLMs | Used for Brand DNA reference tagging. Keep prompts free of untrusted reference text injection. |
| Embeddings | CLIP / SigLIP + pgvector | Check model licence per checkpoint. |
| Virtual try-on | FASHN API / FASHN VTON, IDM-VTON | Licences differ and some are non-commercial — legal review required. Visual approximation only. |

Nothing is integrated in the demo. Every output is labelled **Simulated**.

## Studio ↔ Brand DNA seam (Phase 3)
Implemented in Phase 3: `buildBrandContext(mode, approvedVersion, { strictness, referenceIds })` in `src/lib/brand/intelligence.ts` is the single place brand conditioning is assembled. It sends the approved version, palette (+ signature colours, palette-only flag, avoided colours), preferred/avoided silhouettes, materials and construction details, rule ids, guidance text, eligible reference ids and strictness (Brand 0.9, Hybrid 0.55 by default; adjustable in the Studio). The schema only accepts `approved: true`.

Pilot path for real providers: map `preferred*`/`avoid*` to positive/negative prompt terms and ControlNet/IP-Adapter inputs, `referenceIds` to retrieved image conditioning, and replace `evaluateConcept()` with a VLM- or embedding-based consistency scorer that returns the same `RuleCheck` shape.

## Editing contract (Phase 4)
`editConcept(EditRequest)` now carries `parentVersionId`, `instruction`, optional normalised `region` (→ mask), `maskAssetId` and the parent `base` snapshot; `getEditResult(jobId)` returns a `ConceptVersion`. The demo adapter interprets controlled vocabulary only and refuses anything else at request time. A real instruction-editing/inpainting provider can replace it without changing the Editor: map `region` to a mask, the parent image asset to the source, and return the new image asset id on the version.

## Brand DNA without fine-tuning
1. Structured `BrandProfile` (style rules, negative rules, palette, silhouettes, fabrics), versioned and approved by a human.
2. Each rule cites source assets.
3. At request time a `BrandContext` builder assembles: approved rules + cited references + top-k similar approved concepts (embedding retrieval) + negative constraints → prompt + reference images (IP-Adapter / image conditioning).
4. The request metadata is shown to the designer, so changing a rule visibly changes the request.

Later: brand-consistency scoring, designer feedback loops, and per-brand LoRA **only** with licensed, consistent datasets, baseline comparisons and cost approval. Training data stays isolated per `orgId`.
