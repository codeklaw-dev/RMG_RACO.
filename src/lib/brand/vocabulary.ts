// Shared vocabularies so brand rules, the demo engine and evaluation speak
// the same controlled terms. Rules can only target terms listed here.
import type { Material } from "@/lib/types/domain";

export const CLOSURE_DETAILS = [
  "concealed placket",
  "single covered button",
  "tie fastening",
  "asymmetric snap closure",
  "clean facings, no visible hardware",
  "exposed metal hardware",
] as const;

export const FINISH_DETAILS = [
  "raw-cut edges",
  "bound seams",
  "topstitched seams",
  "hand-felled hems",
  "bonded edges",
  "contrast topstitching",
] as const;

export const CONSTRUCTION_DETAILS: readonly string[] = [...CLOSURE_DETAILS, ...FINISH_DETAILS];

const MATERIAL_WORDS: [Material, RegExp][] = [
  ["cotton", /cotton|poplin|gabardine|voile/i],
  ["wool", /wool|flannel|merino/i],
  ["linen", /linen/i],
  ["silk", /silk|satin|faille/i],
  ["denim", /denim/i],
  ["technical", /technical|nylon|shell/i],
];

/** Map free-text fabric names back to the Material taxonomy. */
export function materialsFromFabrics(fabrics: string[]): Material[] {
  return MATERIAL_WORDS.filter(([, re]) => fabrics.some((f) => re.test(f))).map(([m]) => m);
}
