"""Summarise out/results.jsonl into measured tables + a blank rating sheet.

    python report.py   ->  out/summary.md, out/ratings.csv
Only measured data is written; nothing is estimated here.
"""
import csv
import json
import os
import statistics

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
RUBRIC = ["garment_type", "silhouette", "construction_details", "fabric_realism", "colour_accuracy", "presentation_quality", "overall_usability"]


def load(path):
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]


def summarise(rows):
    by_gpu = {}
    for r in rows:
        by_gpu.setdefault(r["gpu"], []).append(r)
    out = []
    for gpu, rs in sorted(by_gpu.items()):
        warm = [r["seconds"] for r in rs if not r.get("cold")]
        cold = [r["wall_seconds"] for r in rs if r.get("cold")]
        loads = [r["load_seconds"] for r in rs if r.get("load_seconds")]
        out.append({
            "gpu": gpu,
            "images": len(rs),
            "warm_median_s": round(statistics.median(warm), 2) if warm else None,
            "warm_p90_s": round(sorted(warm)[int(0.9 * (len(warm) - 1))], 2) if warm else None,
            "cold_wall_median_s": round(statistics.median(cold), 1) if cold else None,
            "model_load_median_s": round(statistics.median(loads), 1) if loads else None,
            "peak_vram_gb_max": max(r["peak_vram_gb"] for r in rs),
            "est_cost_per_image_usd": round(sum(r["est_cost_usd"] for r in rs) / len(rs), 5),
        })
    return out


def to_markdown(summary):
    cols = list(summary[0].keys()) if summary else []
    lines = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    lines += ["| " + " | ".join("" if v is None else str(v) for v in row.values()) + " |" for row in summary]
    return "\n".join(lines)


def main():
    rows = load(os.path.join(OUT, "results.jsonl"))
    summary = summarise(rows)
    with open(os.path.join(OUT, "summary.md"), "w") as f:
        f.write("# Measured results (Track A)\n\n" + to_markdown(summary) + "\n")
    with open(os.path.join(OUT, "ratings.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["file", "brief", "presentation", "style", "rater"] + RUBRIC + ["failure_tags", "notes"])
        for r in rows:
            if r["set"] in ("quality", "adherence"):
                w.writerow([r["file"], r["brief"], r["presentation"], r["style"], ""] + [""] * len(RUBRIC) + ["", ""])
    print(to_markdown(summary))


if __name__ == "__main__":
    main()
