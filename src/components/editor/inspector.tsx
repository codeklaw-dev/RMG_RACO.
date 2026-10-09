"use client";
import { useState } from "react";
import { StatusBadge } from "@/components/shared/status-badge";
import { REVIEW_LABEL } from "@/lib/editor/review";
import type { Concept, ConceptVersion } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { AnnotationsPanel } from "./annotations-panel";
import { BrandPanel } from "./brand-panel";
import { DetailsPanel } from "./details-panel";
import { RefinePanel } from "./refine-panel";
import { ReviewPanel } from "./review-panel";

const TABS = ["Details", "Refine", "Brand", "Notes", "Review"] as const;

export function Inspector({ concept, version }: { concept: Concept; version: ConceptVersion }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Details");
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pt-4">
        <StatusBadge state={concept.capability} />
        <span className="t-meta">{REVIEW_LABEL[concept.status]} · v{version.number}</span>
      </div>
      <div role="tablist" aria-label="Inspector" className="mt-3 flex gap-0.5 border-b border-hairline px-3">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("relative h-9 px-2.5 text-[12px] text-charcoal hover:text-ink", tab === t && "font-medium text-ink after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-oxblood")}>
            {t}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={tab} className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "Details" && <DetailsPanel concept={concept} version={version} />}
        {tab === "Refine" && <RefinePanel concept={concept} version={version} />}
        {tab === "Brand" && <BrandPanel concept={concept} version={version} />}
        {tab === "Notes" && <AnnotationsPanel version={version} />}
        {tab === "Review" && <ReviewPanel concept={concept} />}
      </div>
    </div>
  );
}
