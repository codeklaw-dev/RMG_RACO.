"use client";
import { Check, Minus, X } from "lucide-react";
import { evaluateConcept } from "@/lib/brand/intelligence";
import { useApprovedVersion, useBrandStore } from "@/lib/store/brand-store";
import type { Concept } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

const ICON = { pass: Check, fail: X, not_evaluated: Minus } as const;

/** Deterministic rule checks against the profile version that conditioned the concept. */
export function BrandConsistency({ concept }: { concept: Concept }) {
  const used = useBrandStore((s) => s.versions.find((v) => v.version === concept.brandProfileVersion));
  const approved = useApprovedVersion();
  const profile = used ?? approved;
  if (!profile) return null;
  const { score, checks } = evaluateConcept(concept, profile.content);
  const label = used ? `Checked against v${used.version}, the version used to generate it` : `Checked against current approved v${profile.version} (not used to generate it)`;

  return (
    <section aria-label="Brand consistency" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="t-meta">Brand consistency</p>
        <p className="font-display text-2xl">{score === null ? "—" : `${score}%`}</p>
      </div>
      <div className="h-px bg-hairline">
        <div className={cn("h-px", (score ?? 0) >= 80 ? "bg-ink" : "bg-oxblood")} style={{ width: `${score ?? 0}%` }} />
      </div>
      <p className="text-[12px] text-muted-foreground">{label}. Rule-based checks on recorded attributes; not a visual or semantic assessment.</p>
      <ul className="divide-y divide-hairline border-y border-hairline">
        {checks.map((c) => {
          const Icon = ICON[c.result];
          return (
            <li key={c.ruleId} className="flex gap-2 py-2 text-[12px]">
              <Icon
                aria-label={c.result.replace("_", " ")}
                className={cn("mt-0.5 size-3.5 shrink-0", c.result === "fail" && "text-oxblood", c.result === "not_evaluated" && "text-stone")}
              />
              <span className="min-w-0">
                <span className="font-medium">{c.title}</span>
                <span className="t-meta ml-1.5 text-[9px]">{c.kind === "negative" ? "exclusion" : "rule"} · {c.priority}</span>
                <span className="block text-muted-foreground">{c.reason}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
