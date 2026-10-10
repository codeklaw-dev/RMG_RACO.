import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa: E402
import report  # noqa: E402
from costs import BudgetGuard, cost_usd, rate_per_s  # noqa: E402
from plan import build_set, estimate_usd, load_briefs  # noqa: E402
from prompts import build_prompt  # noqa: E402
import run_benchmark  # noqa: E402


class PromptTests(unittest.TestCase):
    def setUp(self):
        self.brief = load_briefs()[0]

    def test_structured_prompt_has_garment_presentation_and_exclusions(self):
        p = build_prompt(self.brief, "ghost_mannequin")
        for part in ("single-breasted tailored blazer", "stone", "notched lapel", "ghost-mannequin", "no logos", "light-grey background"):
            self.assertIn(part, p)

    def test_plain_prompt_is_the_designer_sentence_plus_presentation(self):
        p = build_prompt(self.brief, "flat_lay", style="plain")
        self.assertTrue(p.startswith(self.brief["plain"]))
        self.assertIn("flat-lay", p)
        self.assertNotIn("no logos", p)

    def test_rejects_unknown_options(self):
        with self.assertRaises(ValueError):
            build_prompt(self.brief, "on_model")
        with self.assertRaises(ValueError):
            build_prompt(self.brief, "flat_lay", style="fancy")

    def test_five_fictional_briefs(self):
        self.assertEqual([b["id"] for b in load_briefs()], ["blazer", "column_dress", "wrap_coat", "rib_knit", "wide_trouser"])


class CostTests(unittest.TestCase):
    def test_rate_includes_gpu_cpu_and_memory(self):
        self.assertAlmostEqual(rate_per_s("L4"), 0.000222 + 4 * 0.0000131 + 32 * 0.00000222, places=9)
        self.assertAlmostEqual(cost_usd("L4", 3600), 1.24, places=2)

    def test_budget_guard_stops_before_overspend(self):
        g = BudgetGuard(0.01)
        self.assertTrue(g.can_afford("L4", 20))
        g.charge("L4", 20)
        self.assertFalse(g.can_afford("L4", 20))
        self.assertGreater(g.remaining, 0)
        with self.assertRaises(ValueError):
            BudgetGuard(0)

    def test_unknown_gpu(self):
        with self.assertRaises(ValueError):
            rate_per_s("T4")


class PlanTests(unittest.TestCase):
    def test_set_sizes(self):
        self.assertEqual(len(build_set("smoke")), 1)
        self.assertEqual(len(build_set("quality")), 40)
        self.assertEqual(len(build_set("adherence")), 20)
        self.assertEqual(len(build_set("latency")), 30)
        self.assertEqual(len(build_set("coldstart")), 3)
        self.assertEqual(len(build_set("references")), 4)

    def test_reference_runs_use_only_documented_cc0_files(self):
        here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        with open(os.path.join(here, "references", "references.json")) as f:
            documented = {r["file"]: r for r in json.load(f)["references"]}
        self.assertTrue(all(r["license"] == "cc0" and r["landing_url"] for r in documented.values()))
        for run in build_set("references"):
            for ref in run["references"]:
                self.assertIn(ref, documented)
                self.assertTrue(os.path.exists(os.path.join(here, "references", ref)))

    def test_whole_benchmark_fits_inside_free_credit_with_room_to_spare(self):
        total = sum(estimate_usd(build_set(n)) for n in ("smoke", "quality", "adherence", "latency", "coldstart", "references", "reproducibility"))
        self.assertLess(total, 10.0)  # Modal Starter credit is $30/month; most is kept for team/client tests

    def test_dry_run_never_contacts_modal(self):
        self.assertEqual(run_benchmark.main(["--set", "quality", "--dry-run"]), 0)
        self.assertNotIn("modal", sys.modules)

    def test_refuses_plans_over_the_cap(self):
        self.assertEqual(run_benchmark.main(["--set", "latency", "--max-usd", "0.05", "--dry-run"]), 2)


class ReportTests(unittest.TestCase):
    def test_summary_uses_only_measured_values(self):
        rows = [
            {"gpu": "L4", "seconds": 5.0, "wall_seconds": 95.0, "cold": True, "load_seconds": 40.0, "peak_vram_gb": 16.8, "est_cost_usd": 0.03},
            {"gpu": "L4", "seconds": 4.0, "wall_seconds": 4.5, "cold": False, "load_seconds": None, "peak_vram_gb": 16.9, "est_cost_usd": 0.0016},
            {"gpu": "L4", "seconds": 6.0, "wall_seconds": 6.4, "cold": False, "load_seconds": None, "peak_vram_gb": 16.9, "est_cost_usd": 0.0022},
        ]
        s = report.summarise(rows)[0]
        self.assertEqual(s["warm_median_s"], 5.0)
        self.assertEqual(s["cold_wall_median_s"], 95.0)
        self.assertEqual(s["model_load_median_s"], 40.0)
        self.assertEqual(s["peak_vram_gb_max"], 16.9)
        self.assertIn("| gpu |", report.to_markdown(report.summarise(rows)))


if __name__ == "__main__":
    unittest.main()
