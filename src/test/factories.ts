import { BRAND_PROFILE, ORG } from "@/lib/fixtures";
import type { GenerateRequestInput } from "@/lib/services/ai-provider";
import { DEFAULT_BRIEF, buildGenerateRequest, strictnessFor, type Brief } from "@/lib/studio/brief";

export function makeRequest(patch: Partial<Brief> = {}, extra: Partial<GenerateRequestInput> = {}): GenerateRequestInput {
  return {
    ...buildGenerateRequest(
      { ...DEFAULT_BRIEF, prompt: "Oversized charcoal wool blazer with architectural shoulders", brandStrictness: strictnessFor(patch.mode ?? "explore"), ...patch },
      { orgId: ORG.id, brand: BRAND_PROFILE, idempotencyKey: `key_${Math.random().toString(36).slice(2, 10)}` },
    ),
    ...extra,
  };
}
