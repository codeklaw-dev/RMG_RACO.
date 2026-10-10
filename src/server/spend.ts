import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { startOfMonthUtc } from "./limits";

type Tx = Prisma.TransactionClient;

/** Month-to-date spend: actual cost where known, otherwise the estimate (canceled-before-start jobs excluded). */
export async function monthSpendUsd(tx: Tx, where: { orgId?: string }, now = new Date()) {
  const since = startOfMonthUtc(now);
  const [actual, pending] = await Promise.all([
    tx.generationJob.aggregate({ _sum: { actualCostUsd: true }, where: { ...where, createdAt: { gte: since }, actualCostUsd: { not: null } } }),
    tx.generationJob.aggregate({ _sum: { estimatedCostUsd: true }, where: { ...where, createdAt: { gte: since }, actualCostUsd: null, status: { not: "canceled" } } }),
  ]);
  return Number(actual._sum.actualCostUsd ?? 0) + Number(pending._sum.estimatedCostUsd ?? 0);
}
