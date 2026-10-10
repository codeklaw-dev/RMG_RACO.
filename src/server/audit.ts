import "server-only";
// Append-only audit trail. Metadata must never contain secrets, tokens or signed URLs.
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";

export async function audit(e: {
  action: string;
  orgId?: string | null;
  actorId?: string | null;
  resourceType?: string;
  resourceId?: string;
  ip?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await db().auditEvent.create({ data: { ...e, orgId: e.orgId ?? null, actorId: e.actorId ?? null, ip: e.ip ?? null } });
}
