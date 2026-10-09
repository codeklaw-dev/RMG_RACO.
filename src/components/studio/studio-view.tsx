"use client";
import { useState } from "react";
import { Columns2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useStudioSession } from "@/lib/store/studio-session";
import { useStudioStore } from "@/lib/store/studio-store";
import { BriefPanel } from "./brief-panel";
import { CompareDialog } from "./compare-dialog";
import { ConceptInspector, RequestPreview } from "./concept-inspector";
import { GenerationCanvas } from "./generation-canvas";
import { useJobRunner } from "./use-job-runner";

export function StudioView() {
  const runner = useJobRunner();
  const desktop = useMediaQuery("(min-width: 1280px)");
  const [briefOpen, setBriefOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const selectedId = useStudioSession((s) => s.selectedId);
  const select = useStudioSession((s) => s.select);
  const compareIds = useStudioSession((s) => s.compareIds);
  const concepts = useStudioStore((s) => s.concepts);
  const selected = concepts.find((c) => c.id === selectedId) ?? null;
  const compared = compareIds.map((id) => concepts.find((c) => c.id === id)).filter((c) => c !== undefined);

  const onSelect = (id: string) => {
    select(id);
    if (!desktop) setInspectorOpen(true);
  };

  const brief = <BriefPanel runner={runner} onSubmitted={() => setBriefOpen(false)} />;
  const inspector = selected ? (
    <ConceptInspector key={selected.id} concept={selected} onVariation={() => { setInspectorOpen(false); if (!desktop) setBriefOpen(true); }} />
  ) : (
    <RequestPreview />
  );

  return (
    <div className="-mx-4 -my-8 md:-mx-8 md:-my-10 xl:grid xl:h-[calc(100dvh-3.5rem)] xl:grid-cols-[320px_minmax(0,1fr)_340px]">
      <aside aria-label="Creative controls" className="hidden min-h-0 border-r border-hairline bg-sidebar/60 xl:block">{brief}</aside>

      <section aria-label="Generation canvas" className="min-h-0 overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-hairline bg-paper/95 px-4 py-3 md:px-8">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-2xl">Design Studio</h1>
            <span className="t-meta hidden sm:inline">Simulated adapter</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-none"
              disabled={compared.length !== 2}
              onClick={() => setCompareOpen(true)}
              title={compared.length === 2 ? undefined : "Mark two concepts with Compare in the inspector"}
            >
              <Columns2 /> Compare {compared.length}/2
            </Button>
            <Button variant="outline" size="sm" className="rounded-none xl:hidden" onClick={() => setInspectorOpen(true)}>
              Inspector
            </Button>
            <Button size="sm" className="rounded-none xl:hidden" onClick={() => setBriefOpen(true)}>
              <SlidersHorizontal /> Brief
            </Button>
          </div>
        </div>
        <div className="px-4 py-6 md:px-8">
          <GenerationCanvas runner={runner} onSelect={onSelect} />
        </div>
      </section>

      <aside aria-label="Concept inspector" className="hidden min-h-0 overflow-y-auto border-l border-hairline bg-card xl:block">{inspector}</aside>

      {!desktop && (
        <>
          <Sheet open={briefOpen} onOpenChange={setBriefOpen}>
            <SheetContent side="left" className="w-full gap-0 bg-paper p-0 sm:max-w-md">
              <SheetTitle className="border-b border-hairline px-5 py-4 font-display text-2xl font-normal">Design brief</SheetTitle>
              <div className="min-h-0 flex-1">{brief}</div>
            </SheetContent>
          </Sheet>
          <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
            <SheetContent side="right" className="w-full gap-0 overflow-y-auto bg-card p-0 sm:max-w-md">
              <SheetTitle className="border-b border-hairline px-5 py-4 font-display text-2xl font-normal">Inspector</SheetTitle>
              {inspector}
            </SheetContent>
          </Sheet>
        </>
      )}
      <CompareDialog concepts={compared} open={compareOpen && compared.length === 2} onOpenChange={setCompareOpen} />
    </div>
  );
}
