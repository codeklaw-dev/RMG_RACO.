import { cn } from "@/lib/utils";
import type { GarmentCategory, PaletteColor, Silhouette } from "@/lib/types/domain";

// Neutral flat silhouettes stand in for imagery until licensed assets
// or live generation exist. Deliberately schematic so they are never
// mistaken for a model-generated result. Silhouette and seed vary the
// proportions and construction details so results stay distinguishable.
const PATHS: Record<GarmentCategory, string> = {
  outerwear: "M34 18 L44 14 Q50 22 56 14 L66 18 L80 26 L86 92 L76 94 L72 50 L74 128 L26 128 L28 50 L24 94 L14 92 L20 26 Z",
  tailoring: "M34 20 L44 16 Q50 24 56 16 L66 20 L82 28 L86 90 L76 92 L72 52 L72 98 L28 98 L28 52 L24 92 L14 90 L18 28 Z",
  jacket: "M36 18 L44 12 L50 18 L56 12 L64 18 L80 26 L84 80 L74 82 L71 48 L72 86 L28 86 L29 48 L26 82 L16 80 L20 26 Z",
  dress: "M40 16 Q50 22 60 16 L64 20 L62 50 L72 130 L28 130 L38 50 L36 20 Z",
  shirt: "M38 18 L46 14 Q50 18 54 14 L62 18 L80 28 L84 62 L74 64 L70 40 L70 96 L30 96 L30 40 L26 64 L16 62 L20 28 Z",
  knitwear: "M38 14 L62 14 L64 20 L80 28 L84 70 L74 72 L70 44 L70 98 L30 98 L30 44 L26 72 L16 70 L20 28 L36 20 Z",
  trousers: "M30 16 L70 16 L76 130 L56 130 L50 52 L44 130 L24 130 Z",
  skirt: "M34 22 L66 22 L80 120 L20 120 Z",
};

const SCALE_X: Record<Silhouette, number> = {
  tailored: 1, structured: 1.04, oversized: 1.14, relaxed: 1.08, fitted: 0.9, draped: 0.96,
};

const LINE = "rgba(23,23,23,0.28)";

function Details({ category, variant }: { category: GarmentCategory; variant: number }) {
  const top = category === "trousers" || category === "skirt" ? 24 : 30;
  switch (variant) {
    case 1: // belt / waist seam
      return <line x1="28" y1={top + 30} x2="72" y2={top + 30} stroke={LINE} strokeWidth="1.4" />;
    case 2: // buttons
      return (
        <g fill={LINE}>
          {[0, 1, 2, 3].map((i) => <circle key={i} cx="53" cy={top + 4 + i * 12} r="1" />)}
        </g>
      );
    case 3: // patch pockets
      return (
        <g fill="none" stroke={LINE} strokeWidth="0.6">
          <rect x="33" y={top + 40} width="11" height="10" />
          <rect x="56" y={top + 40} width="11" height="10" />
        </g>
      );
    default: // panel seams
      return (
        <g stroke={LINE} strokeWidth="0.5">
          <line x1="40" y1={top} x2="38" y2={top + 60} />
          <line x1="60" y1={top} x2="62" y2={top + 60} />
        </g>
      );
  }
}

export function GarmentPlaceholder({
  category,
  palette,
  silhouette = "tailored",
  seed = 0,
  className,
}: {
  category: GarmentCategory;
  palette: PaletteColor[];
  silhouette?: Silhouette;
  seed?: number | null;
  className?: string;
}) {
  const main = palette[0]?.hex ?? "#CFC6B8";
  const accent = palette[1]?.hex;
  const variant = (seed ?? 0) % 4;
  const clipId = `g-${category}-${silhouette}-${main.slice(1)}`;
  const sx = SCALE_X[silhouette];
  return (
    <div
      className={cn("relative flex items-center justify-center overflow-hidden bg-paper-2", className)}
      role="img"
      aria-label={`Schematic ${silhouette} ${category} placeholder`}
    >
      <svg viewBox="0 0 100 140" className="h-[78%] w-auto" aria-hidden>
        <g transform={`translate(50 0) scale(${sx} 1) translate(-50 0)`}>
          <defs>
            <clipPath id={clipId}>
              <path d={PATHS[category]} />
            </clipPath>
          </defs>
          <path d={PATHS[category]} fill={main} />
          {accent && <rect x="0" y="104" width="100" height="40" fill={accent} clipPath={`url(#${clipId})`} />}
          <g clipPath={`url(#${clipId})`}>
            <Details category={category} variant={variant} />
          </g>
          <path d={PATHS[category]} fill="none" stroke="rgba(23,23,23,0.35)" strokeWidth="0.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
      <span className="absolute bottom-2 left-2 font-mono text-[9px] uppercase tracking-[0.1em] text-stone">Schematic</span>
    </div>
  );
}
