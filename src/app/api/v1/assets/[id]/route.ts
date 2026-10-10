import { requireAuth } from "@/server/auth/context";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { assetDto } from "@/server/dto";
import { ApiError, clientIp, handler, json } from "@/server/http";
import { deleteObject, READ_URL_TTL_S, signedReadUrl } from "@/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const ctx = await requireAuth(req, "asset.read");
  const { id } = await params;
  const asset = await db().asset.findFirst({ where: { id, orgId: ctx.orgId, status: { not: "deleted" } } });
  if (!asset) throw new ApiError(404, "not_found", "Asset not found");
  const read = asset.status === "ready" ? { url: await signedReadUrl(asset.storageKey, asset.fileName), expiresInSeconds: READ_URL_TTL_S } : null;
  return json({ asset: assetDto(asset), read });
});

export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const ctx = await requireAuth(req, "asset.delete");
  const { id } = await params;
  const asset = await db().asset.findFirst({ where: { id, orgId: ctx.orgId, status: { not: "deleted" } } });
  if (!asset) throw new ApiError(404, "not_found", "Asset not found");
  await deleteObject(asset.storageKey).catch(() => undefined);
  await db().asset.update({ where: { id }, data: { status: "deleted", deletedAt: new Date() } });
  await audit({ action: "asset.deleted", orgId: ctx.orgId, actorId: ctx.userId, resourceType: "asset", resourceId: id, ip: clientIp(req) });
  return json({ ok: true });
});
