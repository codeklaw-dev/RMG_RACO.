// Stress brief used by PDF regression tests: long text, special characters,
// many rows and every warning type.
import { CONCEPTS } from "@/lib/fixtures";
import { DEMO_BRIEFS, DEMO_VERSIONS } from "@/lib/fixtures/demo";
import { buildBriefDocument } from "@/lib/handoff/technical";

export const LONG = "Double-faced wool shell with a fully bagged lining; fronts interfaced with lightweight fusible, shoulder seams taped, armholes eased 0.5 cm, and a concealed placket closing with four covered buttons. ".repeat(6);
export const SPECIAL = "Crêpe de Chine — “soft” finish ± 0.5 cm • ½ lined → see note… Ñandú ★ 中文 Ω";

export function stressDocument() {
  const base = DEMO_BRIEFS[0];
  const brief = {
    ...base,
    construction: { ...base.construction, description: LONG, constructionNotes: SPECIAL, stitching: LONG, finishing: LONG.repeat(5), sleeves: "", pockets: "" },
    measurements: [
      ...base.measurements,
      ...Array.from({ length: 24 }, (_, i) => ({ id: `mx${i}`, name: i === 0 ? "Across back at 12 cm below high point shoulder, measured flat edge to edge" : `Point ${i + 1}`, valueCm: i % 3 ? 40 + i : null, toleranceCm: i % 3 ? 0.5 : null, notes: i === 1 ? SPECIAL : "", required: i % 4 === 0, illustrative: i % 5 === 0 })),
    ],
  };
  return buildBriefDocument(brief, {
    concept: CONCEPTS[0], version: DEMO_VERSIONS[0], collectionNames: ["Quiet Architecture — AW26 “Line A”"], brandVersion: 3, conceptReview: "Approved", generatedAt: "10 Oct 2026, 09:00",
  });
}
