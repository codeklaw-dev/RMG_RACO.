"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useApprovedVersion } from "@/lib/store/brand-store";
import { cn } from "@/lib/utils";
import { ColourSection } from "./colour-section";
import { IdentitySection } from "./identity-section";
import { MaterialsSection } from "./materials-section";
import { OverviewSection } from "./overview-section";
import { ReferencesSection } from "./references-section";
import { RulesSection } from "./rules-section";
import { VersionsSection } from "./versions-section";
import { WorkflowBar } from "./workflow-bar";

const TABS = [
  { id: "overview", label: "Overview", Component: OverviewSection },
  { id: "identity", label: "Identity", Component: IdentitySection },
  { id: "colour", label: "Colour", Component: ColourSection },
  { id: "materials", label: "Materials & silhouettes", Component: MaterialsSection },
  { id: "references", label: "References", Component: ReferencesSection },
  { id: "rules", label: "Rules", Component: RulesSection },
  { id: "versions", label: "Versions", Component: VersionsSection },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function BrandDnaView() {
  const approved = useApprovedVersion();
  const [tab, setTab] = useState<TabId>("overview");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    if (TABS.some((t) => t.id === fromHash)) setTab(fromHash as TabId);
  }, []);

  const choose = (id: TabId) => {
    setTab(id);
    history.replaceState(null, "", `#${id}`);
  };
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    const j = (i + d + TABS.length) % TABS.length;
    choose(TABS[j].id);
    refs.current[j]?.focus();
  };
  const Active = TABS.find((t) => t.id === tab)!.Component;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Brand intelligence"
        title="Brand DNA"
        description={`${approved?.content.name ?? "Brand"} as an editable, versioned profile. Brand learning here is structured profile conditioning and rule checks — not model training.`}
      />
      <WorkflowBar />
      <div role="tablist" aria-label="Brand DNA sections" className="-mx-4 flex gap-1 overflow-x-auto border-b border-hairline px-4 md:mx-0 md:px-0">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => choose(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "relative h-10 shrink-0 px-3 text-[13px] text-charcoal outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              tab === t.id && "font-medium text-ink after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-oxblood",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-2">
        <Active />
      </div>
    </div>
  );
}
