# Virtual Try-On (conceptual)

Route: `/try-on?concept=<id>&version=<versionId>` (feature flag `NEXT_PUBLIC_FLAG_TRY_ON`).

## What it actually does
The demo adapter composes an **original schematic avatar** (SVG, no photograph, no real person) with the **schematic garment** of the selected concept version. Tops anchor at the shoulder line, trousers/skirts at the waist; pose changes the avatar's stance; colour override recolours the garment. Every result carries the label **“Conceptual fitting preview — simulated, not physically accurate.”** No fit, drape, body measurement or manufacturing feasibility is modelled, and no uploaded image is analysed.

## Workflow
Select garment (search, collection filter, version) → model (Avatar A/B/C) → pose (only poses the model supports) → background → optional colour → **Generate preview** (a `try_on` job on the shared job state machine: queued → running → succeeded/failed/canceled, cancellable) → inspect → **Save preview** → select two saved previews → **Compare**.

## Job handling
`useTryOnJob` runs one job at a time (single-flight start). `pollJob` (`lib/services/poll-job.ts`) polls sequentially — the next request starts only after the previous settles — and accepts an `AbortSignal`. Cancel, switching garment/version, and unmount abort the run and cancel the provider job, so no stale progress, result or preview reaches state or the store.

## Data
- `FitModel` (`lib/fixtures/fit-models.ts`): id, name, poses, view, representation, provenance, usage rights.
- `TryOnPreview` (`lib/types/handoff.ts`): concept, version + number, model, pose, background, colour, garment snapshot subset, job id, fixed label, provenance, saved flag. Persisted in `raco-handoff` (metadata only); previews are redrawn, never stored as images.

## Adapter contract (for a real provider)
`AIProvider.virtualTryOn(TryOnRequest) → JobRef`, `getTryOnResult(jobId) → TryOnPreview | null`. `tryOnRequestSchema` validates org, concept/version, model, pose, background, colour, garment palette and `consentConfirmed`. Supporting types: `GarmentAsset`, `ModelAsset` (schematic vs consented photograph), `PoseReference`, `TryOnErrorCode`. A production adapter resolves asset ids to private storage server-side, runs inference on GPU workers and returns an output asset id on the same preview shape — the UI does not change.

## Candidate models (evaluation only — nothing installed)
| Model | Notes |
|---|---|
| FASHN VTON / FASHN API | Commercial API and released weights; check the specific licence and API terms for client use |
| IDM-VTON | Research code; licence is non-commercial (CC BY-NC-SA) — **not** usable commercially without permission |
| CatVTON | Research release; verify licence of code **and** weights before any commercial use |
| OOTDiffusion and similar | Check licence and base-model (e.g. SD) terms |

Do not assume research-code licences permit commercial deployment. Model photographs require explicit consent and rights metadata.
