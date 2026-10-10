import { z } from "zod";
import { requireAuth } from "@/server/auth/context";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { jobDto } from "@/server/dto";
import { getEnv } from "@/server/env";
import { ApiError, clientIp, handler, json, parseJson } from "@/server/http";
import { inferenceProvider } from "@/server/inference";
import { decideLimits } from "@/server/limits";
import { monthSpendUsd } from "@/server/spend";
import { GARMENT_CATEGORIES, MATERIALS, SILHOUETTES } from "@/lib/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const Body = z.object({
  prompt: z.string().trim().min(3).max(2000),
  category: z.enum(GARMENT_CATEGORIES),
  silhouette: z.enum(SILHOUETTES),
  materials: z.array(z.enum(MATERIALS)).min(1).max(3),
  palette: z.array(hex).max(4).default([]),
  mode: z.enum(["explore", "brand", "hybrid"]),
  count: z.number().int().min(1).max(4),
  seed: z.number().int().min(0).max(2 ** 31 - 1).optional(),
  referenceAssetIds: z.array(z.string().min(1)).max(4).default([]),
  idempotencyKey: z.string().min(8).max(100),
});

export const POST = handler(async (req: Request) => {
  const ctx = await requireAuth(req, "generation.create");
  const body = await parseJson(req, Body);
  const env = getEnv();

  const existing = await db().generationJob.findUnique({ where: { orgId_idempotencyKey: { orgId: ctx.orgId, idempotencyKey: body.idempotencyKey } } });
  if (existing) return json({ job: jobDto(existing), duplicate: true });

  // References must be this org's, uploaded, validated and rights-confirmed.
  const refs = body.referenceAssetIds.length
    ? await db().asset.findMany({ where: { id: { in: body.referenceAssetIds }, orgId: ctx.orgId, kind: "reference", status: "ready", rightsConfirmed: true } })
    : [];
  if (refs.length !== new Set(body.referenceAssetIds).size) throw new ApiError(422, "invalid_references", "One or more references are unavailable");

  const provider = inferenceProvider();
  if (!provider.enabled) throw new ApiError(503, "inference_disabled", "Real AI generation is not enabled on this environment");

  const result = await db().$transaction(async (tx) => {
    // Serialise budget checks per organisation.
    await tx.$executeRaw`SELECT 1 FROM "Organization" WHERE id = ${ctx.orgId} FOR UPDATE`;
    const org = await tx.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
    const decision = decideLimits({
      imageCount: body.count,
      costPerImageUsd: env.COST_PER_IMAGE_USD,
      userRequestsLastHour: await tx.generationJob.count({ where: { userId: ctx.userId, createdAt: { gte: new Date(Date.now() - 3600_000) } } }),
      userHourlyLimit: env.USER_HOURLY_GENERATION_LIMIT,
      orgSpentThisMonthUsd: await monthSpendUsd(tx, { orgId: ctx.orgId }),
      orgMonthlyBudgetUsd: Number(org.monthlyBudgetUsd),
      globalSpentThisMonthUsd: await monthSpendUsd(tx, {}),
      globalMonthlyLimitUsd: env.GLOBAL_MONTHLY_LIMIT_USD,
    });
    if (!decision.ok) return { decision };
    const job = await tx.generationJob.create({
      data: {
        orgId: ctx.orgId, userId: ctx.userId, provider: provider.id, status: "queued", imageCount: body.count,
        estimatedCostUsd: decision.estimateUsd, idempotencyKey: body.idempotencyKey,
        request: { ...body, referenceAssetIds: refs.map((r) => r.id) },
      },
    });
    return { decision, job };
  });

  if (!result.decision.ok) {
    await audit({ action: "generation.rejected_limit", orgId: ctx.orgId, actorId: ctx.userId, ip: clientIp(req), metadata: { code: result.decision.code, estimateUsd: result.decision.estimateUsd } });
    throw new ApiError(result.decision.status, result.decision.code, result.decision.message);
  }

  let job = result.job!;
  try {
    const { providerJobId } = await provider.submit({ jobId: job.id, orgId: ctx.orgId, prompt: body.prompt, imageCount: body.count, referenceKeys: refs.map((r) => r.storageKey) });
    job = await db().generationJob.update({ where: { id: job.id }, data: { providerJobId } });
  } catch {
    job = await db().generationJob.update({ where: { id: job.id }, data: { status: "failed", errorCode: "provider_unavailable", actualCostUsd: 0, finishedAt: new Date() } });
  }
  await audit({ action: "generation.requested", orgId: ctx.orgId, actorId: ctx.userId, resourceType: "job", resourceId: job.id, ip: clientIp(req), metadata: { count: body.count, mode: body.mode, references: refs.length, estimateUsd: Number(job.estimatedCostUsd) } });
  return json({ job: jobDto(job) }, { status: 202 });
});
