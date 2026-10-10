import { requireAuth } from "@/server/auth/context";
import { db } from "@/server/db";
import { jobDto } from "@/server/dto";
import { ApiError, handler, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireAuth(req, "job.read");
  const { id } = await params;
  const job = await db().generationJob.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!job) throw new ApiError(404, "not_found", "Job not found");
  return json({ job: jobDto(job) });
});
