import { requireAuth } from "@/server/auth/context";
import { clearedSessionCookie } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { handler, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const ctx = await requireAuth(req);
  await db().session.delete({ where: { id: ctx.sessionId } });
  await audit({ action: "auth.logout", orgId: ctx.orgId, actorId: ctx.userId });
  return json({ ok: true }, { headers: { "Set-Cookie": clearedSessionCookie() } });
});
