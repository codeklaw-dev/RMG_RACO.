import { requireAuth } from "@/server/auth/context";
import { db } from "@/server/db";
import { handler, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const ctx = await requireAuth(req);
  const [user, org] = await Promise.all([
    db().user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { id: true, email: true, name: true } }),
    db().organization.findUniqueOrThrow({ where: { id: ctx.orgId }, select: { id: true, name: true } }),
  ]);
  return json({ user, org, role: ctx.role });
});
