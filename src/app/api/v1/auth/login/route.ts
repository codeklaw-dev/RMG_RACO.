import { createHash } from "node:crypto";
import { z } from "zod";
import { assertSameOrigin } from "@/server/auth/context";
import { burnPasswordCheck, verifyPassword } from "@/server/auth/password";
import { createSession, sessionCookie } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { ApiError, clientIp, handler, json, parseJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(256) });
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const { email, password } = await parseJson(req, Body);
  const emailKey = createHash("sha256").update(email).digest("hex");
  const failures = await db().auditEvent.count({ where: { action: "auth.login_failed", resourceId: emailKey, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } } });
  if (failures >= MAX_FAILURES) throw new ApiError(429, "too_many_attempts", "Too many failed sign-in attempts. Try again later.");

  const user = await db().user.findUnique({ where: { email }, include: { memberships: { orderBy: { createdAt: "asc" } } } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await burnPasswordCheck(password), false);
  if (!user || !ok || user.memberships.length === 0) {
    await audit({ action: "auth.login_failed", resourceType: "login", resourceId: emailKey, ip: clientIp(req) });
    throw new ApiError(401, "invalid_credentials", "Email or password is incorrect");
  }
  const orgId = user.memberships[0].orgId;
  const { token, expiresAt } = await createSession(user.id, orgId);
  await audit({ action: "auth.login", orgId, actorId: user.id, resourceType: "user", resourceId: user.id, ip: clientIp(req) });
  return json({ user: { id: user.id, email: user.email, name: user.name }, orgId }, { headers: { "Set-Cookie": sessionCookie(token, expiresAt) } });
});
