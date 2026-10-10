import "server-only";
// Opaque sessions: a random 256-bit token lives only in an HttpOnly cookie; the
// database stores HMAC-SHA256(AUTH_SECRET, token), so a DB leak can't replay sessions.
import { createHmac, randomBytes } from "node:crypto";
import { db } from "../db";
import { getEnv } from "../env";

export const SESSION_COOKIE = "raco_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const hashToken = (token: string, secret = getEnv().AUTH_SECRET) => createHmac("sha256", secret).update(token).digest("hex");

export async function createSession(userId: string, orgId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db().session.create({ data: { tokenHash: hashToken(token), userId, orgId, expiresAt } });
  return { token, expiresAt };
}

export function sessionCookie(token: string, expiresAt: Date) {
  const secure = getEnv().APP_ORIGIN.startsWith("https://");
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure ? "; Secure" : ""}`;
}

export const clearedSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export function readSessionToken(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === SESSION_COOKIE) return v.join("=") || null;
  }
  return null;
}
