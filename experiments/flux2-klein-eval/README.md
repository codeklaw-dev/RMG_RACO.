# Track A — FLUX.2 [klein] 4B evaluation (isolated experiment)

Measures whether FLUX.2 [klein] 4B produces usable **ghost-mannequin garment concepts** on Modal, and what that really costs. This folder is **not** part of the app: nothing in `src/` imports it, and nothing here is deployed for users.

- **Data:** five fictional Serein Atelier briefs (`briefs.json`) and six **CC0** test references (`references/`, provenance in `references/references.json`, every image visually checked). No client material.
- **Model:** `black-forest-labs/FLUX.2-klein-4B`, Apache 2.0. Never switch to the 9B or [dev] variants; they are non-commercial.
- **Status:** built and unit-tested offline. **No generations have been run.** Generation credit is reserved for the team and client tests.

## Cost and free-tier guardrails
- Modal Starter includes **$30/month** of credit ([modal.com/pricing](https://modal.com/pricing)). Each command has a hard `--max-usd` cap (default **$5**) and refuses plans that would exceed it.
- Planned cost for the **entire** benchmark, using deliberately pessimistic timings (10 s per image on L4, 2 min per cold start), is about **$1.25**. Check any set first with `--dry-run`.
- Containers scale to zero after 60 s idle (`SCALEDOWN_WINDOW_S`), so **idle costs $0**. `max_containers=1` prevents parallel spend.
- Before the first run, set a spending alert or limit in the Modal dashboard if your plan offers one.

## One-time setup (team member with Modal access)
```bash
cd experiments/flux2-klein-eval
python3 -m venv .venv && source .venv/bin/activate
pip install modal
modal token new                      # stores credentials in ~/.modal.toml (never in git)
```
1. In `config.py`, pin `MODEL_REVISION` to the Hugging Face commit you reviewed, and pin `DIFFUSERS_GIT` to a diffusers commit (`...diffusers.git@<sha>`).
2. Only if Hugging Face asks you to accept terms for the repo: create a Modal secret holding `HF_TOKEN` and attach it to `download_weights`.
3. Run:
   ```bash
   modal deploy app.py                  # registers the app; costs nothing while idle
   modal run app.py::download_weights   # ~16 GB to a Modal Volume, CPU only (a few cents)
   ```

## Running benchmark sets
| Set | What it measures | Runs |
|---|---|---|
| `smoke` | Model loads and one blazer renders on L4 | 1 |
| `quality` | 5 briefs × ghost mannequin / flat lay × 4 seeds (for human rating) | 40 |
| `adherence` | Structured fashion prompt vs the designer's plain sentence | 20 |
| `references` | Conditioning on CC0 material / silhouette / detail references | 4 |
| `latency` | Warm latency on L4, A10 and L40S | 30 |
| `coldstart` | Three forced cold starts (waits past the idle window) | 3 |
| `reproducibility` | Same seed twice on the same GPU | 4 |

```bash
python run_benchmark.py --set smoke --dry-run   # plan + cost, no Modal calls
python run_benchmark.py --set smoke             # first real call — check the image in out/images/
python run_benchmark.py --set quality --max-usd 2
python report.py                                # out/summary.md + out/ratings.csv
```
Recommended order: smoke → quality → adherence → references → latency → coldstart → reproducibility. Stop after `smoke` if anything looks wrong.

## What gets recorded (measured only)
Per image (`out/results.jsonl`): GPU name and memory, generation seconds, wall seconds, cold-start flag and model-load seconds, peak VRAM, number of references, seed, prompt, model and revision, and a cost estimate from wall-clock × Modal's per-second rates. Reconcile with the Modal usage page, which is authoritative.

`report.py` writes measured tables only and a blank `ratings.csv` for **fashion professionals**. They rate 1–5 for: garment type, silhouette, construction details, fabric realism, colour accuracy, ghost-mannequin presentation, overall usability, plus failure tags (extra or missing sleeves, fused pockets, text/logos, warped hems, visible mannequin or body, artefacts). RACO engineering owns the technical columns.

## Known unknowns (to confirm on the first run)
- The keyword for passing reference images to `Flux2KleinPipeline` (coded as `image=[...]`) — see `app.py`.
- Real warm latency, cold-start time and peak VRAM on L4/A10/L40S (no published figures exist for these GPUs).
- Whether all components fit resident on a 24 GB L4 in bf16 (estimated ~16–17 GB). If not, enable CPU offload or use L40S.
