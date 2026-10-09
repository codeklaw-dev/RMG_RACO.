"use client";
import Link from "next/link";
import { Heart } from "lucide-react";
import type { Concept } from "@/lib/types/domain";
import { useStudioStore } from "@/lib/store/studio-store";
import { cn } from "@/lib/utils";
import { GarmentPlaceholder } from "./garment-placeholder";
import { StatusBadge } from "./status-badge";

const MODE_LABEL = { explore: "Explore", brand: "Brand", hybrid: "Hybrid" } as const;

export function ConceptCard({
  concept,
  aspect = "aspect-[3/4]",
  selected,
  onSelect,
}: {
  concept: Concept;
  aspect?: string;
  /** When provided the card selects instead of navigating. */
  onSelect?: (id: string) => void;
  selected?: boolean;
}) {
  const toggleFavorite = useStudioStore((s) => s.toggleFavorite);
  const preview = (
    <GarmentPlaceholder
      category={concept.category}
      palette={concept.palette}
      silhouette={concept.silhouette}
      seed={concept.seed}
      className={cn(aspect, "w-full transition-colors duration-300 group-hover:bg-[#e9e4dc]")}
    />
  );
  const focus = "block w-full outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <article className={cn("group relative", selected && "outline outline-1 outline-offset-4 outline-ink")}>
      {onSelect ? (
        <button type="button" onClick={() => onSelect(concept.id)} aria-pressed={selected} aria-label={`Select ${concept.title}`} className={focus}>
          {preview}
        </button>
      ) : (
        <Link href={`/editor?concept=${concept.id}`} className={focus}>
          {preview}
        </Link>
      )}
      <div className="absolute left-2 top-2 flex gap-1">
        <StatusBadge state={concept.capability} />
      </div>
      <button
        type="button"
        onClick={() => toggleFavorite(concept.id)}
        aria-pressed={concept.favorite}
        aria-label={concept.favorite ? "Remove from favourites" : "Add to favourites"}
        className="absolute right-2 top-2 grid size-7 place-items-center bg-paper/80 text-ink opacity-0 transition-opacity hover:bg-paper focus-visible:opacity-100 group-hover:opacity-100 aria-pressed:opacity-100"
      >
        <Heart className={cn("size-3.5", concept.favorite && "fill-oxblood text-oxblood")} />
      </button>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">{concept.title}</p>
          <p className="t-meta mt-0.5">
            {concept.category} · {MODE_LABEL[concept.mode]}
            {concept.brandProfileVersion ? ` v${concept.brandProfileVersion}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-0.5 pt-1" aria-label="Palette">
          {concept.palette.map((p) => (
            <span key={p.hex} title={p.name} className="size-2.5 border border-black/10" style={{ background: p.hex }} />
          ))}
        </div>
      </div>
    </article>
  );
}
