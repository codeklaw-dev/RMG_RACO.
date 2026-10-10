"""Run a benchmark set against the Modal app, under a hard budget.

    python run_benchmark.py --set smoke --dry-run      # plan + cost estimate, no Modal calls
    python run_benchmark.py --set quality --max-usd 3   # real run (needs `modal token new`)

Outputs: out/images/*.png and out/results.jsonl (git-ignored).
"""
import argparse
import json
import os
import sys
import time

import config
from costs import BudgetGuard, cost_usd
from plan import PLAN_COLD_START_S, PLAN_SECONDS_PER_IMAGE, build_set, estimate_usd, load_briefs
from prompts import build_prompt

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("--set", required=True, choices=["smoke", "quality", "adherence", "latency", "coldstart", "references", "reproducibility"])
    p.add_argument("--gpu", default=config.DEFAULT_GPU, choices=sorted(config.GPU_PRICE_PER_S))
    p.add_argument("--max-usd", type=float, default=config.DEFAULT_BUDGET_USD)
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args(argv)

    runs = build_set(a.set, gpu=a.gpu)
    est = estimate_usd(runs)
    print("set=%s runs=%d planned_cost<=%.2f USD cap=%.2f USD" % (a.set, len(runs), est, a.max_usd))
    if est > a.max_usd:
        print("Planned cost exceeds the cap; raise --max-usd deliberately or choose a smaller set.")
        return 2
    if a.dry_run:
        return 0

    import modal  # only needed for real runs

    Generator = modal.Cls.from_name("raco-flux2-klein-eval", "Generator")
    briefs = {b["id"]: b for b in load_briefs()}
    guard = BudgetGuard(a.max_usd)
    os.makedirs(os.path.join(OUT, "images"), exist_ok=True)
    warm = set()
    with open(os.path.join(OUT, "results.jsonl"), "a") as log:
        for i, r in enumerate(runs):
            if r.get("wait_before_s"):
                print("waiting %ds for the container to scale down..." % r["wait_before_s"])
                time.sleep(r["wait_before_s"])
                warm.discard(r["gpu"])
            planned = PLAN_SECONDS_PER_IMAGE[r["gpu"]] + (0 if r["gpu"] in warm else PLAN_COLD_START_S)
            if not guard.can_afford(r["gpu"], planned):
                print("Budget cap reached after %d runs (spent ~%.3f USD)." % (i, guard.spent))
                break
            prompt = build_prompt(briefs[r["brief"]], r["presentation"], r["style"])
            t0 = time.time()
            refs = [open(os.path.join(HERE, "references", f), "rb").read() for f in r.get("references", [])]
            res = Generator.with_options(gpu=r["gpu"])().generate.remote(prompt, r["seed"], reference_images=refs or None)
            wall = round(time.time() - t0, 3)
            warm.add(r["gpu"])
            guard.charge(r["gpu"], wall)
            name = "%s_%s_%s_%s_s%d%s.png" % (a.set, r["gpu"], r["brief"], r["presentation"], r["seed"], "_r%d" % r["repeat"] if "repeat" in r else "")
            with open(os.path.join(OUT, "images", name), "wb") as f:
                f.write(res.pop("png"))
            rec = dict(r, set=a.set, file=name, prompt=prompt, wall_seconds=wall, est_cost_usd=cost_usd(r["gpu"], wall), **res)
            log.write(json.dumps(rec) + "\n")
            print("%3d/%d %-5s %-13s %-15s %5.2fs gen  %6.2fs wall  %.2f GB%s" % (i + 1, len(runs), r["gpu"], r["brief"], r["presentation"], res["seconds"], wall, res["peak_vram_gb"], "  (cold)" if res["cold"] else ""))
    print("Done. Approx spend %.3f USD (wall-clock based; reconcile with the Modal usage page)." % guard.spent)
    return 0


if __name__ == "__main__":
    sys.exit(main())
