"use client";
// Client-facing presentation: no editing controls, keyboard navigation, honest labels.
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { GarmentPlaceholder } from "@/components/shared/garment-placeholder";
import { collectionPalette, presentationStep } from "@/lib/editor/collections";
import { REVIEW_LABEL } from "@/lib/editor/review";
import { ORG } from "@/lib/fixtures";
import { useStoreHydrated, useStudioStore } from "@/lib/store/studio-store";
import type { Concept } from "@/lib/types/domain";

export function PresentationView({ collectionId }: { collectionId: string }) {
  const router = useRouter();
  const hydrated = useStoreHydrated();
  const collection = useStudioStore((s) => s.collections.find((c) => c.id === collectionId && c.orgId === ORG.id));
  const concepts = useStudioStore((s) => s.concepts);
  const looks = useMemo(() => (collection?.conceptIds ?? []).map((id) => concepts.find((c) => c.id === id)).filter((c): c is Concept => Boolean(c)), [collection, concepts]);
  const [i, setI] = useState(0);
  const [notes, setNotes] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const exit = () => router.push(`/collections/${collectionId}`);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return exit();
      if (e.key.toLowerCase() === "n") return setNotes((n) => !n);
      const next = presentationStep(i, e.key, looks.length);
      if (next !== i) { e.preventDefault(); setI(next); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!stage.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(stage.current, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" });
  }, [i]);

  if (!hydrated || !collection) return <div className="min-h-dvh bg-[#11100f]" />;
  const palette = collectionPalette(looks);
  const look = i >= 1 && i <= looks.length ? looks[i - 1] : null;
  const meta = look ? collection.lookMeta?.[look.id] : undefined;
  const last = looks.length + 1;

  return (
    <div className="flex min-h-dvh flex-col bg-[#11100f] text-[#efebe4]" role="region" aria-roledescription="presentation" aria-label={`${collection.name} presentation`}>
      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#a39d93]">Serein Atelier · {collection.season} · {collection.name}</p>
        <button onClick={exit} className="flex items-center gap-2 border border-[#3a3835] px-3 py-1.5 text-[12px] outline-none hover:bg-[#1d1c1a] focus-visible:ring-2 focus-visible:ring-[#8c2f37]">
          <X className="size-3.5" /> Exit presentation
        </button>
      </header>

      <main ref={stage} className="flex flex-1 items-center px-6 md:px-16" aria-live="polite">
        {i === 0 && (
          <div className="mx-auto max-w-3xl space-y-8 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#a39d93]">{collection.season} collection</p>
            <h1 className="font-display text-6xl leading-none md:text-8xl">{collection.name}</h1>
            {collection.creativeDirection && <p className="mx-auto max-w-xl font-display text-2xl leading-snug text-[#cfc6b8]">{collection.creativeDirection}</p>}
            <div className="mx-auto flex h-3 max-w-md">{palette.map((p) => <span key={p.hex} className="h-full" style={{ background: p.hex, flex: p.count }} />)}</div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#a39d93]">{looks.length} looks</p>
          </div>
        )}
        {look && (
          <div className="grid w-full items-center gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <GarmentPlaceholder category={look.category} palette={look.palette} silhouette={look.silhouette} seed={look.seed} label={null} className="mx-auto aspect-[3/4] max-h-[72dvh] w-full max-w-[520px] bg-[#1d1c1a]" />
            <div className="max-w-md space-y-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#a39d93]">Look {String(i).padStart(2, "0")} / {String(looks.length).padStart(2, "0")}</p>
              <h2 className="font-display text-5xl leading-[1.02]">{look.title}</h2>
              <p className="text-[15px] leading-relaxed text-[#cfc6b8]">{look.description.replace(/ Conditioned on .*$/, "").replace(/ Revised:.*$/, "")}</p>
              <dl className="grid grid-cols-[110px_1fr] gap-y-2 border-t border-[#3a3835] pt-4 text-[13px]">
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#a39d93]">Silhouette</dt><dd className="capitalize">{look.silhouette}</dd>
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#a39d93]">Materials</dt><dd>{look.fabrics.join(", ")}</dd>
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#a39d93]">Palette</dt>
                <dd className="flex items-center gap-2">{look.palette.map((p) => <span key={p.hex} className="flex items-center gap-1.5"><span className="size-3" style={{ background: p.hex }} />{p.name}</span>)}</dd>
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#a39d93]">Status</dt><dd>{REVIEW_LABEL[look.status]}</dd>
              </dl>
              {notes && meta?.note && <p className="border-l-2 border-[#8c2f37] pl-3 text-[13px] text-[#cfc6b8]">Designer note: {meta.note}</p>}
            </div>
          </div>
        )}
        {i === last && (
          <div className="mx-auto max-w-2xl space-y-6 text-center">
            <h2 className="font-display text-6xl">{collection.name}</h2>
            <p className="text-[15px] text-[#cfc6b8]">{looks.filter((l) => l.status === "approved").length} of {looks.length} looks approved for development.</p>
          </div>
        )}
      </main>

      <footer className="flex items-center justify-between gap-4 px-6 py-4 md:px-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7d776e]">Simulated concepts · schematic placeholders, not photographs or model output</p>
        <div className="flex items-center gap-3">
          <button onClick={() => setNotes((n) => !n)} aria-pressed={notes} className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#a39d93] hover:text-[#efebe4]">Notes (N)</button>
          <button aria-label="Previous slide" disabled={i === 0} onClick={() => setI(presentationStep(i, "ArrowLeft", looks.length))} className="grid size-9 place-items-center border border-[#3a3835] disabled:opacity-30"><ChevronLeft className="size-4" /></button>
          <span className="w-14 text-center font-mono text-[11px] text-[#a39d93]" aria-live="polite">{i + 1} / {last + 1}</span>
          <button aria-label="Next slide" disabled={i === last} onClick={() => setI(presentationStep(i, "ArrowRight", looks.length))} className="grid size-9 place-items-center border border-[#3a3835] disabled:opacity-30"><ChevronRight className="size-4" /></button>
        </div>
      </footer>
    </div>
  );
}
