import { requireAuth } from "@/server/auth/context";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { assetDto } from "@/server/dto";
import { getEnv } from "@/server/env";
import { ApiError, handler, json } from "@/server/http";
import { deleteObject, headObject, readPrefix } from "@/server/storage";
import { checkUploaded } from "@/server/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verify the uploaded object server-side (size + real file signature) before it can be used. */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireAuth(req, "asset.upload");
  const { id } = await params;
  const asset = await db().asset.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!asset) throw new ApiError(404, "not_found", "Asset not found");
  if (asset.status !== "pending") throw new ApiError(409, "invalid_state", `Asset is already ${asset.status}`);
  const head = await headObject(asset.storageKey);
  if (!head) throw new ApiError(409, "not_uploaded", "Upload the file before completing");
  const check = checkUploaded(asset, { size: head.size, prefix: await readPrefix(asset.storageKey) }, getEnv().MAX_UPLOAD_BYTES);
  if (!check.ok) {
    await deleteObject(asset.storageKey);
    const rejected = await db().asset.update({ where: { id }, data: { status: "rejected", rejectReason: check.reason } });
    await audit({ action: "asset.rejected", orgId: ctx.orgId, actorId: ctx.userId, resourceType: "asset", resourceId: id, metadata: { reason: check.reason } });
    return json({ asset: assetDto(rejected), error: { code: "upload_rejected", message: "The file failed validation and was deleted", reason: check.reason } }, { status: 422 });
  }
  const ready = await db().asset.update({ where: { id }, data: { status: "ready" } });
  await audit({ action: "asset.ready", orgId: ctx.orgId, actorId: ctx.userId, resourceType: "asset", resourceId: id });
  return json({ asset: assetDto(ready) });
});
