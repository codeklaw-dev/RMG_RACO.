"use client";
// Lightweight DOM/SVG inspection canvas. Konva isn't needed: the garment is a
// single SVG, and pins/compare are plain positioned elements, which keeps
// keyboard access and screen-reader labels straightforward.
import { useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import { Columns2, Maximize, MapPin, Minus, Plus, RotateCcw } from "lucide-react";
import { GarmentPlaceholder } from "@/components/shared/garment-placeholder";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { nudge, toNormalized } from "@/lib/editor/annotations";
import { FIT_VIEW, useEditorSession } from "@/lib/store/editor-session";
import { useStudioStore } from "@/lib/store/studio-store";
import type { Concept, ConceptVersion } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { AnnotationDialog } from "./annotation-dialog";

const MIN = 0.5;
const MAX = 3;
const clampZoom = (z: number) => Math.min(MAX, Math.max(MIN, Math.round(z * 100) / 100));

export function DesignCanvas({ concept, version, compareTo }: { concept: Concept; version: ConceptVersion; compareTo: ConceptVersion | null }) {
  const s = useEditorSession();
  const annotations = useStudioStore((st) => st.annotations);
  const updateAnnotation = useStudioStore((st) => st.updateAnnotation);
  const pins = annotations.filter((a) => a.versionId === version.id && a.view === s.side);
  const artboard = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [split, setSplit] = useState(50);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const snapshot = s.draft ?? version.snapshot;
  const { zoom, x, y } = s.canvas;
  const setView = (z: number, nx = x, ny = y) => s.set({ canvas: { zoom: clampZoom(z), x: nx, y: ny } });
  const comparing = s.compare && compareTo && !s.draft;

  const onPointerDown = (e: PointerEvent) => {
    if (s.annotate) return;
    drag.current = { x: e.clientX, y: e.clientY, ox: x, oy: y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag.current) return;
    setView(zoom, drag.current.ox + (e.clientX - drag.current.x), drag.current.oy + (e.clientY - drag.current.y));
  };
  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setView(zoom * (e.deltaY < 0 ? 1.1 : 0.9));
  };
  const onArtboardClick = (e: React.MouseEvent) => {
    if (!s.annotate || !artboard.current) return;
    setPending(toNormalized({ x: e.clientX, y: e.clientY }, artboard.current.getBoundingClientRect()));
  };
  const onPinKey = (e: KeyboardEvent, id: string, pt: { x: number; y: number }) => {
    if (!e.key.startsWith("Arrow")) return;
    e.preventDefault();
    updateAnnotation(id, nudge(pt, e.key, e.shiftKey));
  };

  const render = (snap: typeof snapshot, label: string | null) => (
    <GarmentPlaceholder category={concept.category} palette={snap.palette} silhouette={snap.silhouette} seed={snap.seed} view={s.side} label={label} className="absolute inset-0" />
  );

  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <div role="toolbar" aria-label="Canvas tools" className="flex flex-wrap items-center gap-1 border-b border-hairline px-3 py-2">
        <Button variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={() => setView(zoom - 0.25)} disabled={zoom <= MIN}><Minus /></Button>
        <span className="t-meta w-12 text-center" aria-live="polite">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={() => setView(zoom + 0.25)} disabled={zoom >= MAX}><Plus /></Button>
        <Button variant="ghost" size="sm" onClick={() => s.set({ canvas: FIT_VIEW })}><Maximize /> Fit</Button>
        <Button variant="ghost" size="sm" onClick={() => s.set({ canvas: FIT_VIEW, side: "front", compare: false, annotate: false })}><RotateCcw /> Reset</Button>
        <span aria-hidden className="mx-1 h-4 w-px bg-hairline" />
        <div role="radiogroup" aria-label="Garment view" className="flex border border-hairline">
          {(["front", "back"] as const).map((v) => (
            <button key={v} role="radio" aria-checked={s.side === v} onClick={() => s.set({ side: v })} className={cn("h-7 px-2.5 text-[12px] capitalize", s.side === v ? "bg-ink text-paper" : "text-charcoal hover:bg-card")}>
              {v}
            </button>
          ))}
        </div>
        <Button variant={s.compare ? "default" : "ghost"} size="sm" aria-pressed={s.compare} disabled={!compareTo || Boolean(s.draft)} onClick={() => s.set({ compare: !s.compare })}>
          <Columns2 /> Compare
        </Button>
        <Button variant={s.annotate ? "default" : "ghost"} size="sm" aria-pressed={s.annotate} disabled={Boolean(s.draft)} onClick={() => s.set({ annotate: !s.annotate })}>
          <MapPin /> Annotate
        </Button>
        {s.annotate && (
          <Button variant="outline" size="sm" className="rounded-none" onClick={() => setPending({ x: 0.5, y: 0.5 })}>
            Add pin at centre
          </Button>
        )}
      </div>

      <div
        className={cn("relative flex-1 touch-none overflow-hidden bg-paper-2/60", s.annotate ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onWheel={onWheel}
      >
        <div className="absolute inset-0 grid place-items-center p-6">
          <div
            ref={artboard}
            onClick={onArtboardClick}
            className="relative aspect-[3/4] h-full max-h-[640px] max-w-full origin-center bg-paper-2 shadow-[0_0_0_1px_var(--hairline)]"
            style={{ transform: `translate(${x}px, ${y}px) scale(${zoom})` }}
            data-testid="artboard"
          >
            {comparing ? (
              <>
                {render(compareTo.snapshot, null)}
                <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>{render(snapshot, null)}</div>
                <div aria-hidden className="absolute inset-y-0 w-px bg-ink" style={{ left: `${split}%` }} />
                <span className="t-meta absolute left-2 top-2 bg-paper/90 px-1.5">v{compareTo.number}</span>
                <span className="t-meta absolute right-2 top-2 bg-paper/90 px-1.5">v{version.number}</span>
              </>
            ) : (
              render(snapshot, null)
            )}
            {!comparing &&
              pins.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  aria-label={`Annotation ${i + 1}: ${a.text}${a.resolved ? " (resolved)" : ""}. Arrow keys move it.`}
                  onClick={(e) => { e.stopPropagation(); s.set({ selectedAnnotationId: a.id }); }}
                  onKeyDown={(e) => onPinKey(e, a.id, a)}
                  className={cn(
                    "absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    a.resolved ? "border-hairline bg-paper text-stone" : "border-oxblood bg-oxblood text-paper",
                    s.selectedAnnotationId === a.id && "ring-2 ring-ink ring-offset-2 ring-offset-paper-2",
                  )}
                  style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, scale: `${1 / zoom}` }}
                >
                  {i + 1}
                </button>
              ))}
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2">
          <StatusBadge state="simulated" />
          <span className="t-meta bg-paper/80 px-1.5">
            {s.draft ? "Unsaved preview" : `v${version.number}${version.id === concept.currentVersionId ? " · current" : " · historical"}`} · {s.side} · schematic placeholder
          </span>
        </div>
      </div>

      {comparing && (
        <label className="flex items-center gap-3 border-t border-hairline px-4 py-2">
          <span className="t-meta shrink-0">v{compareTo.number} ← → v{version.number}</span>
          <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="w-full accent-ink" aria-label="Before and after split" />
        </label>
      )}
      {pending && <AnnotationDialog conceptId={concept.id} versionId={version.id} side={s.side} point={pending} onClose={() => setPending(null)} />}
    </div>
  );
}
