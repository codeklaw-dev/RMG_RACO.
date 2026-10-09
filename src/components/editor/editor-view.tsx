"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FileQuestion, PanelLeft, PanelRight } from "lucide-react";
import { ConceptCard } from "@/components/shared/concept-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ORG } from "@/lib/fixtures";
import { useEditorSession } from "@/lib/store/editor-session";
import { useStoreHydrated, useStudioStore } from "@/lib/store/studio-store";
import { DesignCanvas } from "./design-canvas";
import { Inspector } from "./inspector";
import { Navigator } from "./navigator";

function Picker() {
  const concepts = useStudioStore((s) => s.concepts).filter((c) => c.orgId === ORG.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12);
  return (
    <div className="space-y-6">
      <div>
        <p className="t-meta">Design Editor</p>
        <h1 className="t-display mt-2">Choose a concept to develop.</h1>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 xl:grid-cols-6">
        {concepts.map((c) => <ConceptCard key={c.id} concept={c} />)}
      </div>
    </div>
  );
}

export function EditorView() {
  const id = useSearchParams().get("concept");
  const hydrated = useStoreHydrated();
  const concept = useStudioStore((s) => s.concepts.find((c) => c.id === id && c.orgId === ORG.id));
  const versions = useStudioStore((s) => s.versions);
  const session = useEditorSession();
  const desktop = useMediaQuery("(min-width: 1280px)");
  const [navOpen, setNavOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  useEffect(() => {
    if (useEditorSession.getState().conceptId !== id) useEditorSession.getState().open(id);
    setNavOpen(false);
  }, [id]);

  if (!id) return <Picker />;
  if (!hydrated) return <Skeleton className="h-[70vh] w-full rounded-none" />;
  if (!concept) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="This concept isn't available"
        description="It may have been removed, belong to another organisation, or the link is out of date."
        action={<Link href="/editor" className="t-meta underline">Choose another concept</Link>}
      />
    );
  }

  const version = versions.find((v) => v.id === (session.viewVersionId ?? concept.currentVersionId) && v.conceptId === concept.id) ?? versions.find((v) => v.id === concept.currentVersionId)!;
  const compareTo = versions.find((v) => v.id === (session.compareVersionId ?? version.parentId)) ?? null;
  const navigator = <Navigator concept={concept} />;
  const inspector = <Inspector key={concept.id} concept={concept} version={version} />;

  return (
    <div className="-mx-4 -my-8 md:-mx-8 md:-my-10 xl:grid xl:h-[calc(100dvh-3.5rem)] xl:grid-cols-[280px_minmax(0,1fr)_380px]">
      <aside aria-label="Design navigator" className="hidden min-h-0 overflow-y-auto border-r border-hairline bg-sidebar/60 xl:block">{navigator}</aside>
      <section aria-label="Design canvas" className="flex min-h-[70dvh] flex-col xl:min-h-0">
        <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3 md:px-6">
          <div className="min-w-0">
            <p className="t-meta">Design Editor</p>
            <h1 className="truncate font-display text-2xl">{concept.title}</h1>
          </div>
          <div className="flex gap-2 xl:hidden">
            <Button variant="outline" size="sm" className="rounded-none" onClick={() => setNavOpen(true)}><PanelLeft /> Versions</Button>
            <Button size="sm" className="rounded-none" onClick={() => setInspectorOpen(true)}><PanelRight /> Inspect</Button>
          </div>
        </div>
        <div className="min-h-0 flex-1"><DesignCanvas concept={concept} version={version} compareTo={compareTo} /></div>
      </section>
      <aside aria-label="Design inspector" className="hidden min-h-0 border-l border-hairline bg-card xl:block">{inspector}</aside>
      {!desktop && (
        <>
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetContent side="left" className="w-full gap-0 overflow-y-auto bg-paper p-0 sm:max-w-sm">
              <SheetTitle className="border-b border-hairline px-4 py-3 font-display text-2xl font-normal">Navigator</SheetTitle>
              {navigator}
            </SheetContent>
          </Sheet>
          <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
            <SheetContent side="right" className="w-full gap-0 bg-card p-0 sm:max-w-md">
              <SheetTitle className="sr-only">Design inspector</SheetTitle>
              {inspector}
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}
