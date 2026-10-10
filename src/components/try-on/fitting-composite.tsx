// Schematic fitting composite: an original SVG avatar with the schematic
// garment layered at the shoulders or waist. It is an illustration only —
// no fit, drape or body measurement is modelled.
import { GarmentShape } from "@/components/shared/garment-placeholder";
import { BACKGROUNDS } from "@/lib/fixtures/fit-models";
import type { GarmentCategory, PaletteColor, Silhouette } from "@/lib/types/domain";
import { TRY_ON_LABEL, type FitBackground, type FitPose } from "@/lib/types/handoff";

const LOWER: GarmentCategory[] = ["trousers", "skirt"];

const BUILD: Record<string, { height: number; shoulder: number }> = {
  fm_a: { height: 1, shoulder: 1 },
  fm_b: { height: 1.06, shoulder: 0.98 },
  fm_c: { height: 0.93, shoulder: 0.94 },
};

function Avatar({ pose, tone }: { pose: FitPose; tone: string }) {
  const leftLeg = pose === "walking" ? "M92 150 L80 282" : "M92 150 L88 282";
  const rightLeg = pose === "walking" ? "M108 150 L124 278" : "M108 150 L112 282";
  return (
    <g fill="none" stroke={tone} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="100" cy="30" r="13" fill={tone} stroke="none" opacity="0.55" />
      <path d="M100 43 L100 52" strokeWidth="6" opacity="0.55" />
      <path d="M72 60 Q100 52 128 60 L122 150 L78 150 Z" fill={tone} stroke="none" opacity="0.35" />
      <path d="M74 62 L64 140" strokeWidth="9" opacity="0.4" />
      <path d={pose === "walking" ? "M126 62 L140 132" : "M126 62 L136 140"} strokeWidth="9" opacity="0.4" />
      <path d={leftLeg} strokeWidth="12" opacity="0.4" />
      <path d={rightLeg} strokeWidth="12" opacity="0.4" />
    </g>
  );
}

export function FittingComposite({
  modelId,
  pose,
  background,
  category,
  palette,
  silhouette,
  seed,
  colour,
  showGarment = true,
  showLabel = true,
}: {
  modelId: string;
  pose: FitPose;
  background: FitBackground;
  category: GarmentCategory;
  palette: PaletteColor[];
  silhouette: Silhouette;
  seed: number | null;
  colour: string | null;
  showGarment?: boolean;
  showLabel?: boolean;
}) {
  const bg = BACKGROUNDS[background].fill;
  const dark = background === "ink";
  const tone = dark ? "#CFC6B8" : "#3A3835";
  const b = BUILD[modelId] ?? BUILD.fm_a;
  const lower = LOWER.includes(category);
  const pal = colour ? [{ name: "Override", hex: colour }, ...palette.slice(1)] : palette;
  // Garment drawing is 100×140; tops anchor at the shoulder line, bottoms at the waist.
  const garment = lower ? "translate(56 132) scale(0.88 1.08)" : `translate(${100 - 45 * b.shoulder} 46) scale(${0.9 * b.shoulder} ${category === "dress" ? 1.6 : 1.05})`;
  return (
    <svg viewBox="0 0 200 300" className="h-full w-full" role="img" aria-label={`${TRY_ON_LABEL}: schematic avatar, ${pose.replace("_", "-")} pose${showGarment ? `, wearing a schematic ${category}` : ""}`}>
      <rect width="200" height="300" fill={bg} />
      <g transform={`translate(100 300) scale(${pose === "three_quarter" ? 0.86 : 1} ${b.height}) translate(-100 -300)`}>
        <Avatar pose={pose} tone={tone} />
        {showGarment && (
          <g transform={garment}>
            <GarmentShape category={category} palette={pal} silhouette={silhouette} seed={seed} />
          </g>
        )}
      </g>
      {showLabel && (
        <g>
          <rect x="0" y="278" width="200" height="22" fill={dark ? "#11100f" : "#F7F5F1"} opacity="0.92" />
          <text textAnchor="middle" fontSize="6" fontFamily="ui-monospace, monospace" fill={dark ? "#CFC6B8" : "#3A3835"} letterSpacing="0.3">
            <tspan x="100" y="287">CONCEPTUAL FITTING PREVIEW · SIMULATED</tspan>
            <tspan x="100" y="295">NOT PHYSICALLY ACCURATE</tspan>
          </text>
        </g>
      )}
    </svg>
  );
}
