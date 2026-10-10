import { requireAuth } from "@/server/auth/context";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { jobDto } from "@/server/dto";
import { ApiError, handler, json } from "@/server/http";
import { inferenceProvider } from "@/server/inference";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireAuth(req, "job.cancel");
  const { id } = await params;
  const job = await db().generationJob.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!job) throw new ApiError(404, "not_found", "Job not found");
  if (job.status !== "queued" && job.status !== "running") throw new ApiError(409, "invalid_state", `Job is already ${job.status}`);
  if (job.providerJobId) await inferenceProvider().cancel(job.providerJobId).catch(() => undefined);
  const updated = await db().generationJob.update({ where: { id }, data: { status: "canceled", finishedAt: new Date() } });
  await audit({ action: "job.canceled", orgId: ctx.orgId, actorId: ctx.userId, resourceType: "job", resourceId: id });
  return json({ job: jobDto(updated) });
});
