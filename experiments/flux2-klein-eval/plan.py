"""Benchmark sets. Sized to stay well inside Modal's free Starter credit."""
import json
import os

import config

HERE = os.path.dirname(os.path.abspath(__file__))
# Conservative planning figures used only for budget checks (replaced by measurements).
PLAN_SECONDS_PER_IMAGE = {"L4": 10.0, "A10": 8.0, "L40S": 5.0, "A100-40GB": 5.0, "A100-80GB": 4.0}
PLAN_COLD_START_S = 120.0


def load_briefs():
    with open(os.path.join(HERE, "briefs.json")) as f:
        return json.load(f)["briefs"]


def build_set(name, gpu=config.DEFAULT_GPU, seeds=(11, 22, 33, 44)):
    briefs = load_briefs()
    runs = []
    if name == "smoke":
        runs = [dict(brief=briefs[0]["id"], presentation="ghost_mannequin", style="structured", seed=11, gpu=gpu)]
    elif name == "quality":
        runs = [dict(brief=b["id"], presentation=p, style="structured", seed=s, gpu=gpu) for b in briefs for p in ("ghost_mannequin", "flat_lay") for s in seeds]
    elif name == "adherence":
        runs = [dict(brief=b["id"], presentation="ghost_mannequin", style=st, seed=s, gpu=gpu) for b in briefs for st in ("structured", "plain") for s in seeds[:2]]
    elif name == "latency":
        runs = [dict(brief=briefs[i % 5]["id"], presentation="ghost_mannequin", style="structured", seed=100 + i, gpu=g) for g in ("L4", "A10", "L40S") for i in range(10)]
    elif name == "coldstart":
        # Each request waits past the scale-down window so a fresh container must start.
        runs = [dict(brief=briefs[i]["id"], presentation="ghost_mannequin", style="structured", seed=200 + i, gpu=gpu, wait_before_s=config.SCALEDOWN_WINDOW_S + 30) for i in range(3)]
    elif name == "references":
        # CC0 test references only (references/references.json).
        runs = [
            dict(brief="blazer", presentation="ghost_mannequin", style="structured", seed=301, gpu=gpu, references=["tweed_fabric.jpg"]),
            dict(brief="wrap_coat", presentation="ghost_mannequin", style="structured", seed=302, gpu=gpu, references=["cream_wool_coat.jpg"]),
            dict(brief="wide_trouser", presentation="flat_lay", style="structured", seed=303, gpu=gpu, references=["linen_dark.webp"]),
            dict(brief="blazer", presentation="ghost_mannequin", style="structured", seed=304, gpu=gpu, references=["tweed_fabric.jpg", "tweed_buttons_detail.jpg"]),
        ]
    elif name == "reproducibility":
        runs = [dict(brief=b["id"], presentation="ghost_mannequin", style="structured", seed=7, gpu=gpu, repeat=r) for b in briefs[:2] for r in (1, 2)]
    else:
        raise ValueError("unknown set: %s" % name)
    return runs


def estimate_usd(runs, cold_starts_per_gpu=1):
    if runs and all("wait_before_s" in r for r in runs):
        cold_starts_per_gpu = len(runs)
    from costs import cost_usd
    total = 0.0
    gpus = sorted(set(r["gpu"] for r in runs))
    for g in gpus:
        n = sum(1 for r in runs if r["gpu"] == g)
        total += cost_usd(g, n * PLAN_SECONDS_PER_IMAGE[g] + cold_starts_per_gpu * (PLAN_COLD_START_S + config.SCALEDOWN_WINDOW_S))
    return round(total, 4)
