import "server-only";
// Response shapes. Internal fields (storage keys, provider ids, hashes) never leave the server.
import type { Asset, GenerationJob } from "@/generated/prisma/client";

export const assetDto = (a: Asset) => ({
  id: a.id,
  kind: a.kind,
  status: a.status,
  fileName: a.fileName,
  contentType: a.contentType,
  sizeBytes: a.sizeBytes,
  rightsConfirmed: a.rightsConfirmed,
  category: a.category,
  rejectReason: a.rejectReason,
  expiresAt: a.expiresAt.toISOString(),
  createdAt: a.createdAt.toISOString(),
});

export const jobDto = (j: GenerationJob) => ({
  id: j.id,
  status: j.status,
  provider: j.provider,
  imageCount: j.imageCount,
  estimatedCostUsd: Number(j.estimatedCostUsd),
  actualCostUsd: j.actualCostUsd === null ? null : Number(j.actualCostUsd),
  errorCode: j.errorCode,
  attempts: j.attempts,
  createdAt: j.createdAt.toISOString(),
  finishedAt: j.finishedAt?.toISOString() ?? null,
});
