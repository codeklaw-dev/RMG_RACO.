import { cn } from "@/lib/utils";
import type { GarmentCategory, PaletteColor } from "@/lib/types/domain";

// Neutral flat silhouettes stand in for imagery until licensed assets
// or live generation exist. Deliberately schematic so they are never
// mistaken for a model-generated result.
const PATHS: Record<GarmentCategory, string> = {
  outerwear: "M34 18 L44 14 Q50 22 56 14 L66 18 L80 26 L86 92 L76 94 L72 50 L74 128 L26 128 L28 50 L24 94 L14 92 L20 26 Z",
  tailoring: "M34 20 L44 16 Q50 24 56 16 L66 20 L82 28 L86 90 L76 92 L72 52 L72 98 L28 98 L28 52 L24 92 L14 90 L18 28 Z",
  dress: "M40 16 Q50 22 60 16 L64 20 L62 50 L72 130 L28 130 L38 50 L36 20 Z",
  shirt: "M38 18 L46 14 Q50 18 54 14 L62 18 L80 28 L84 62 L74 64 L70 40 L70 96 L30 96 L30 40 L26 64 L16 62 L20 28 Z",
  knitwear: "M38 14 L62 14 L64 20 L80 28 L84 70 L74 72 L70 44 L70 98 L30 98 L30 44 L26 72 L16 70 L20 28 L36 20 Z",
  trousers: "M30 16 L70 16 L76 130 L56 130 L50 52 L44 130 L24 130 Z",
  skirt: "M34 22 L66 22 L80 120 L20 120 Z",
};

export function GarmentPlaceholder({
  category,
  palette,
  className,
}: {
  category: GarmentCategory;
  palette: PaletteColor[];
  className?: string;
}) {
  const main = palette[0]?.hex ?? "#CFC6B8";
  const accent = palette[1]?.hex;
  const clipId = `g-${category}-${main.slice(1)}`;
  return (
    <div
      className={cn("relative flex items-center justify-center overflow-hidden bg-paper-2", className)}
      role="img"
      aria-label={`${category} silhouette placeholder`}
    >
      <svg viewBox="0 0 100 140" className="h-[78%] w-auto drop-shadow-[0_1px_0_rgba(0,0,0,0.04)]" aria-hidden>
        <defs>
          <clipPath id={clipId}>
            <path d={PATHS[category]} />
          </clipPath>
        </defs>
        <path d={PATHS[category]} fill={main} />
        {accent && <rect x="0" y="104" width="100" height="40" fill={accent} clipPath={`url(#${clipId})`} />}
        <path d={PATHS[category]} fill="none" stroke="rgba(23,23,23,0.35)" strokeWidth="0.6" strokeLinejoin="round" />
        <line x1="50" y1="24" x2="50" y2="96" stroke="rgba(23,23,23,0.18)" strokeWidth="0.5" strokeDasharray="1.5 2" />
      </svg>
      <span className="absolute bottom-2 left-2 font-mono text-[9px] uppercase tracking-[0.1em] text-stone">Placeholder</span>
    </div>
  );
}
