import { requireAuth } from "@/server/auth/context";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";
import { handler, json } from "@/server/http";
import { monthSpendUsd } from "@/server/spend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const ctx = await requireAuth(req, "usage.read");
  const env = getEnv();
  const org = await db().organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
  const spent = await monthSpendUsd(db(), { orgId: ctx.orgId });
  const lastHour = await db().generationJob.count({ where: { userId: ctx.userId, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  const budget = Number(org.monthlyBudgetUsd);
  return json({
    month: { spentUsd: Math.round(spent * 100) / 100, budgetUsd: budget, remainingUsd: Math.max(0, Math.round((budget - spent) * 100) / 100) },
    hour: { requests: lastHour, limit: env.USER_HOURLY_GENERATION_LIMIT },
    retention: { referenceDays: org.referenceRetentionDays, outputDays: org.outputRetentionDays },
  });
});
