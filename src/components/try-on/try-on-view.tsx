"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bookmark, Columns2, Loader2, Maximize, Minus, PanelLeft, Plus, Shirt, SlidersHorizontal, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { GarmentPlaceholder } from "@/components/shared/garment-placeholder";
import { StatusBadge } from "@/components/shared/status-badge";
import { ChipRadioGroup } from "@/components/studio/controls";
import { newIdempotencyKey } from "@/components/studio/use-job-runner";
import { useTryOnJob } from "./use-try-on-job";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { REVIEW_LABEL } from "@/lib/editor/review";
import { versionsOf } from "@/lib/editor/versions";
import { ORG } from "@/lib/fixtures";
import { BACKGROUNDS, FIT_MODELS, POSE_LABEL } from "@/lib/fixtures/fit-models";
import { isActive } from "@/lib/services/job-machine";
import { useHandoffStore } from "@/lib/store/handoff-store";
import { useStoreHydrated, useStudioStore } from "@/lib/store/studio-store";
import type { Concept } from "@/lib/types/domain";
import { TRY_ON_LABEL, type FitBackground, type FitPose, type TryOnPreview } from "@/lib/types/handoff";
import { cn } from "@/lib/utils";
import { FittingComposite } from "./fitting-composite";

export const tryOnHref = (conceptId: string, versionId?: string) => `/try-on?concept=${encodeURIComponent(conceptId)}${versionId ? `&version=${encodeURIComponent(versionId)}` : ""}`;

function GarmentPicker({ selectedId, onPick }: { selectedId: string | null; onPick: (c: Concept) => void }) {
  const concepts = useStudioStore((s) => s.concepts);
  const collections = useStudioStore((s) => s.collections);
  const [q, setQ] = useState("");
  const [col, setCol] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const c = collections.find((x) => x.id === col);
    return concepts
      .filter((x) => x.orgId === ORG.id && x.status !== "archived")
      .filter((x) => !t || x.title.toLowerCase().includes(t))
      .filter((x) => !c || c.conceptIds.includes(x.id))
      .sort((a, b) => Number(b.status === "approved") - Number(a.status === "approved") || b.createdAt.localeCompare(a.createdAt));
  }, [concepts, collections, q, col]);
  return (
    <div className="space-y-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search garments" aria-label="Search garments" className="h-8 w-full border border-hairline bg-card px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <select value={col} onChange={(e) => setCol(e.target.value)} aria-label="Filter by collection" className="h-8 w-full border border-hairline bg-card px-2 text-[12px]">
        <option value="">All collections</option>
        {collections.filter((c) => c.orgId === ORG.id).map((c) => <option key={c.id} value={c.id}>{c.season} · {c.name}</option>)}
      </select>
      <ul className="max-h-[44vh] divide-y divide-hairline overflow-y-auto border-y border-hairline" aria-label="Garments">
        {list.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onPick(c)} aria-pressed={c.id === selectedId} className={cn("flex w-full items-center gap-2 px-1 py-1.5 text-left outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", c.id === selectedId && "bg-card")}>
              <GarmentPlaceholder category={c.category} palette={c.palette} silhouette={c.silhouette} seed={c.seed} label={null} className="aspect-[3/4] w-8 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-[12px]">{c.title}</span>
                <span className="t-meta text-[9px]">{REVIEW_LABEL[c.status]} · {c.category}</span>
              </span>
            </button>
          </li>
        ))}
        {!list.length && <li className="py-3 text-[12px] text-muted-foreground">No garments match.</li>}
      </ul>
    </div>
  );
}

function PreviewCard({ p, selected, onToggle }: { p: TryOnPreview; selected: boolean; onToggle: () => void }) {
  const concept = useStudioStore((s) => s.concepts.find((c) => c.id === p.conceptId));
  const remove = useHandoffStore((s) => s.removePreview);
  if (!concept) return null;
  return (
    <li className={cn("space-y-1", selected && "outline outline-1 outline-offset-2 outline-ink")}>
      <button type="button" onClick={onToggle} aria-pressed={selected} aria-label={`Select preview ${p.garment.title} on ${FIT_MODELS.find((m) => m.id === p.modelId)?.name} for comparison`} className="block aspect-[2/3] w-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <FittingComposite modelId={p.modelId} pose={p.pose} background={p.background} category={concept.category} palette={p.garment.palette} silhouette={p.garment.silhouette} seed={p.garment.seed} colour={p.colour} showLabel={false} />
      </button>
      <div className="flex items-start justify-between gap-1">
        <p className="t-meta text-[9px] leading-tight">v{p.versionNumber} · {FIT_MODELS.find((m) => m.id === p.modelId)?.name} · {POSE_LABEL[p.pose]}</p>
        <Button size="icon-xs" variant="ghost" aria-label="Delete preview" onClick={() => remove(p.id)}><Trash2 /></Button>
      </div>
    </li>
  );
}

export function TryOnView() {
  const params = useSearchParams();
  const router = useRouter();
  const hydrated = useStoreHydrated();
  const desktop = useMediaQuery("(min-width: 1280px)");
  const conceptId = params.get("concept");
  const concept = useStudioStore((s) => s.concepts.find((c) => c.id === conceptId && c.orgId === ORG.id)) ?? null;
  const versions = useStudioStore(useShallow((s) => (concept ? versionsOf(s.versions, concept.id) : [])));
  const version = versions.find((v) => v.id === params.get("version")) ?? versions.find((v) => v.id === concept?.currentVersionId) ?? null;
  const previews = useHandoffStore((s) => s.previews);
  const { setPreviewSaved } = useHandoffStore.getState();
  const [modelId, setModelId] = useState(FIT_MODELS[0].id);
  const [pose, setPose] = useState<FitPose>("standing");
  const [background, setBackground] = useState<FitBackground>("paper");
  const [colour, setColour] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const { job, result, setResult, start, cancel, reset } = useTryOnJob();
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [ctrlOpen, setCtrlOpen] = useState(false);
  const model = FIT_MODELS.find((m) => m.id === modelId)!;
  const running = Boolean(job && isActive(job.status));
  const mine = previews.filter((p) => p.orgId === ORG.id);
  const compared = compareIds.map((id) => mine.find((p) => p.id === id)).filter((p): p is TryOnPreview => Boolean(p));

  // Switching garment or version abandons any in-flight run.
  useEffect(() => { reset(); setColour(null); }, [conceptId, version?.id, reset]);
  useEffect(() => { if (!model.poses.includes(pose)) setPose(model.poses[0]); }, [model, pose]);

  const pick = (c: Concept) => { router.push(tryOnHref(c.id)); setPickOpen(false); };

  const generate = async () => {
    if (!concept || !version || running) return;
    setCtrlOpen(false);
    await start({
      orgId: concept.orgId, conceptId: concept.id, versionId: version.id, modelId, pose, background, colour,
      garment: { title: version.snapshot.title, silhouette: version.snapshot.silhouette, palette: version.snapshot.palette, seed: version.snapshot.seed },
      consentConfirmed: true, idempotencyKey: newIdempotencyKey(),
    });
  };

  if (!hydrated) return <div className="h-[70vh] animate-pulse bg-paper-2" />;

  const picker = (
    <div className="space-y-5 p-4">
      <div>
        <p className="t-meta mb-2">Garment</p>
        <GarmentPicker selectedId={concept?.id ?? null} onPick={pick} />
      </div>
      {concept && version && (
        <div className="space-y-2 text-[12px]">
          <label className="block space-y-1">
            <span className="t-meta">Design version</span>
            <select value={version.id} onChange={(e) => router.push(tryOnHref(concept.id, e.target.value))} className="h-8 w-full border border-hairline bg-card px-2 text-[12px]">
              {[...versions].reverse().map((v) => <option key={v.id} value={v.id}>v{v.number} · {v.summary}</option>)}
            </select>
          </label>
          <dl className="grid grid-cols-[84px_1fr] gap-y-1">
            <dt className="t-meta">Category</dt><dd>{concept.category}</dd>
            <dt className="t-meta">Silhouette</dt><dd>{version.snapshot.silhouette}</dd>
            <dt className="t-meta">Fabric</dt><dd>{version.snapshot.fabrics.join(", ")}</dd>
            <dt className="t-meta">Brand DNA</dt><dd>{concept.brandProfileVersion ? `v${concept.brandProfileVersion}` : "None (Explore)"}</dd>
            <dt className="t-meta">Review</dt><dd>{REVIEW_LABEL[concept.status]}</dd>
          </dl>
          <Link href={`/editor?concept=${encodeURIComponent(concept.id)}`} className="underline">Open in Design Editor</Link>
        </div>
      )}
    </div>
  );

  const controls = (
    <div className="space-y-5 p-4">
      <fieldset>
        <legend className="t-meta mb-2">Model</legend>
        <ChipRadioGroup name="model" value={modelId} options={FIT_MODELS.map((m) => ({ value: m.id, label: m.name }))} onChange={setModelId} />
        <p className="mt-1.5 text-[11px] text-muted-foreground">{model.representation}. Original schematic avatar — not a real person.</p>
      </fieldset>
      <fieldset>
        <legend className="t-meta mb-2">Pose</legend>
        <ChipRadioGroup name="pose" value={pose} options={model.poses.map((p) => ({ value: p, label: POSE_LABEL[p] }))} onChange={setPose} />
      </fieldset>
      <fieldset>
        <legend className="t-meta mb-2">Background</legend>
        <ChipRadioGroup name="bg" value={background} options={(Object.keys(BACKGROUNDS) as FitBackground[]).map((b) => ({ value: b, label: BACKGROUNDS[b].label }))} onChange={setBackground} />
      </fieldset>
      <fieldset>
        <legend className="t-meta mb-2">Garment colour</legend>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={colour === null} onClick={() => setColour(null)} className={cn("h-7 border px-2 text-[12px]", colour === null ? "border-ink bg-ink text-paper" : "border-hairline bg-card")}>Version palette</button>
          {["#1C1C1E", "#CFC6B8", "#8C2F37", "#3B2A22", "#5F6B4E"].map((h) => (
            <button key={h} type="button" aria-label={`Colour ${h}`} aria-pressed={colour === h} onClick={() => setColour(h)} className={cn("size-7 border border-black/10", colour === h && "ring-2 ring-ink ring-offset-2 ring-offset-paper")} style={{ background: h }} />
          ))}
        </div>
      </fieldset>
      <div className="space-y-2 border-t border-hairline pt-4">
        {running ? (
          <>
            <div className="h-px bg-hairline"><div className="h-px bg-ink transition-[width]" style={{ width: `${Math.round((job?.progress ?? 0) * 100)}%` }} /></div>
            <p className="t-meta flex justify-between"><span>{job?.stage}</span><span>demonstration progress</span></p>
            <Button variant="outline" className="w-full rounded-none" onClick={cancel}><Square /> Cancel</Button>
          </>
        ) : (
          <Button className="w-full rounded-none" disabled={!concept || !version} onClick={generate}><Shirt /> Generate preview</Button>
        )}
        <Button variant="outline" className="w-full rounded-none" disabled={!result || result.saved} onClick={() => { if (result) { setPreviewSaved(result.id, true); setResult({ ...result, saved: true }); toast.success("Preview saved"); } }}>
          <Bookmark /> {result?.saved ? "Saved" : "Save preview"}
        </Button>
        <p className="text-[11px] text-muted-foreground">Schematic composition by the demo adapter. No try-on model runs; fit, drape and measurements are not simulated.</p>
      </div>
    </div>
  );

  const stageContent = compareMode && compared.length === 2 ? (
    <div className="grid h-full grid-cols-2 gap-3 p-4">
      {compared.map((p) => {
        const c = useStudioStore.getState().concepts.find((x) => x.id === p.conceptId)!;
        return (
          <figure key={p.id} className="flex min-h-0 flex-col">
            <div className="min-h-0 flex-1"><FittingComposite modelId={p.modelId} pose={p.pose} background={p.background} category={c.category} palette={p.garment.palette} silhouette={p.garment.silhouette} seed={p.garment.seed} colour={p.colour} /></div>
            <figcaption className="t-meta mt-1">{p.garment.title} v{p.versionNumber} · {FIT_MODELS.find((m) => m.id === p.modelId)?.name} · {POSE_LABEL[p.pose]}</figcaption>
          </figure>
        );
      })}
    </div>
  ) : concept && version ? (
    <div className="grid h-full place-items-center overflow-hidden p-4">
      <div className="aspect-[2/3] h-full max-h-[680px] max-w-full transition-transform" style={{ transform: `scale(${zoom})` }} data-testid="fitting-stage">
        <FittingComposite
          modelId={result?.modelId ?? modelId}
          pose={result?.pose ?? pose}
          background={result?.background ?? background}
          category={concept.category}
          palette={result?.garment.palette ?? version.snapshot.palette}
          silhouette={result?.garment.silhouette ?? version.snapshot.silhouette}
          seed={result?.garment.seed ?? version.snapshot.seed}
          colour={result ? result.colour : colour}
          showGarment={Boolean(result)}
          showLabel={Boolean(result)}
        />
      </div>
    </div>
  ) : (
    <div className="grid h-full place-items-center p-8 text-center">
      <div className="max-w-sm space-y-2">
        <p className="font-display text-3xl">Choose a garment</p>
        <p className="t-body text-muted-foreground">Select a concept version, an avatar and a pose, then generate a conceptual fitting preview.</p>
      </div>
    </div>
  );

  return (
    <div className="-mx-4 -my-8 md:-mx-8 md:-my-10 xl:grid xl:h-[calc(100dvh-3.5rem)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
      <aside aria-label="Garment selection" className="hidden min-h-0 overflow-y-auto border-r border-hairline bg-sidebar/60 xl:block">{picker}</aside>
      <section aria-label="Fitting preview" className="flex min-h-[75dvh] flex-col xl:min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3 md:px-6">
          <div className="min-w-0">
            <p className="t-meta flex items-center gap-2">Virtual try-on <StatusBadge state="simulated" /></p>
            <h1 className="truncate font-display text-2xl">{concept ? version?.snapshot.title : "Conceptual fitting"}</h1>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Zoom out" disabled={zoom <= 0.75} onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}><Minus /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Zoom in" disabled={zoom >= 2} onClick={() => setZoom((z) => Math.min(2, z + 0.25))}><Plus /></Button>
            <Button variant="ghost" size="sm" onClick={() => setZoom(1)}><Maximize /> Reset</Button>
            <Button variant={compareMode ? "default" : "outline"} size="sm" className="rounded-none" aria-pressed={compareMode} disabled={compared.length !== 2} onClick={() => setCompareMode((m) => !m)}><Columns2 /> Compare {compared.length}/2</Button>
            <Button variant="outline" size="sm" className="rounded-none xl:hidden" onClick={() => setPickOpen(true)}><PanelLeft /> Garment</Button>
            <Button size="sm" className="rounded-none xl:hidden" onClick={() => setCtrlOpen(true)}><SlidersHorizontal /> Fitting</Button>
          </div>
        </div>
        <div className="min-h-[420px] flex-1 bg-paper-2/50">{stageContent}</div>
        <div role="status" className="border-t border-hairline px-4 py-2 text-[12px] text-oxblood md:px-6">
          {running ? <span className="flex items-center gap-2"><Loader2 className="size-3.5 animate-spin" /> Composing preview…</span> : result || compareMode ? TRY_ON_LABEL : "Avatar only — generate a preview to place the garment."}
        </div>
        <div className="border-t border-hairline px-4 py-3 md:px-6">
          <p className="t-meta mb-2">Saved previews · select two to compare</p>
          <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
            {mine.filter((p) => p.saved).map((p) => (
              <PreviewCard key={p.id} p={p} selected={compareIds.includes(p.id)} onToggle={() => setCompareIds((ids) => (ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id].slice(-2)))} />
            ))}
          </ul>
        </div>
      </section>
      <aside aria-label="Fitting controls" className="hidden min-h-0 overflow-y-auto border-l border-hairline bg-card xl:block">{controls}</aside>
      {!desktop && (
        <>
          <Sheet open={pickOpen} onOpenChange={setPickOpen}>
            <SheetContent side="left" className="w-full gap-0 overflow-y-auto bg-paper p-0 sm:max-w-sm">
              <SheetTitle className="border-b border-hairline px-4 py-3 font-display text-2xl font-normal">Garment</SheetTitle>
              {picker}
            </SheetContent>
          </Sheet>
          <Sheet open={ctrlOpen} onOpenChange={setCtrlOpen}>
            <SheetContent side="right" className="w-full gap-0 overflow-y-auto bg-card p-0 sm:max-w-sm">
              <SheetTitle className="border-b border-hairline px-4 py-3 font-display text-2xl font-normal">Fitting controls</SheetTitle>
              {controls}
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}
