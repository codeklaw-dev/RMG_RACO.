import "server-only";
// Resolves the caller from the session cookie and the org membership it was issued
// for. Every tenant query must use ctx.orgId — never an org id from the request.
import type { Role } from "@/generated/prisma/enums";
import { can, type Permission } from "../authz";
import { db } from "../db";
import { getEnv } from "../env";
import { ApiError } from "../http";
import { hashToken, readSessionToken } from "./session";

export interface AuthContext {
  userId: string;
  orgId: string;
  role: Role;
  sessionId: string;
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** CSRF defence for cookie auth: state-changing requests must come from our own origin. */
export function assertSameOrigin(req: Request) {
  if (!UNSAFE.has(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(getEnv().APP_ORIGIN).origin) throw new ApiError(403, "bad_origin", "Cross-origin request rejected");
}

export async function requireAuth(req: Request, permission?: Permission): Promise<AuthContext> {
  assertSameOrigin(req);
  const token = readSessionToken(req);
  if (!token) throw new ApiError(401, "unauthenticated", "Sign in required");
  const session = await db().session.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session || session.expiresAt <= new Date()) throw new ApiError(401, "unauthenticated", "Session expired");
  const membership = await db().membership.findUnique({ where: { userId_orgId: { userId: session.userId, orgId: session.orgId } } });
  if (!membership) throw new ApiError(401, "unauthenticated", "No access to this organisation");
  if (permission && !can(membership.role, permission)) throw new ApiError(403, "forbidden", "Your role doesn't allow this");
  // Touch at most once a minute to avoid write amplification.
  if (Date.now() - session.lastUsedAt.getTime() > 60_000) {
    await db().session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
  }
  return { userId: session.userId, orgId: session.orgId, role: membership.role, sessionId: session.id };
}
