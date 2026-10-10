import "server-only";
// Deletes expired assets (references 30 days, outputs 90 days by default, per-org
// configurable) and expired sessions. Idempotent; safe to run on a schedule.
import { audit } from "./audit";
import { db } from "./db";
import { deleteObject } from "./storage";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const expiryFor = (kind: "reference" | "output", org: { referenceRetentionDays: number; outputRetentionDays: number }, from = new Date()) =>
  new Date(from.getTime() + (kind === "reference" ? org.referenceRetentionDays : org.outputRetentionDays) * DAY_MS);

export async function runRetention(now = new Date(), batch = 200) {
  const expired = await db().asset.findMany({ where: { expiresAt: { lte: now }, status: { not: "deleted" } }, take: batch });
  let deleted = 0;
  for (const a of expired) {
    await deleteObject(a.storageKey).catch(() => undefined); // already gone is fine
    await db().asset.update({ where: { id: a.id }, data: { status: "deleted", deletedAt: now } });
    await audit({ action: "asset.expired", orgId: a.orgId, resourceType: "asset", resourceId: a.id, metadata: { kind: a.kind } });
    deleted++;
  }
  const sessions = await db().session.deleteMany({ where: { expiresAt: { lte: now } } });
  return { assetsDeleted: deleted, sessionsDeleted: sessions.count, more: expired.length === batch };
}
