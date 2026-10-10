import { z } from "zod";
import { requireAuth } from "@/server/auth/context";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { assetDto } from "@/server/dto";
import { getEnv } from "@/server/env";
import { ApiError, clientIp, handler, json, parseJson } from "@/server/http";
import { expiryFor } from "@/server/retention";
import { objectKey, signedUploadUrl, UPLOAD_URL_TTL_S } from "@/server/storage";
import { ALLOWED_TYPES, safeFileName } from "@/server/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.enum(ALLOWED_TYPES),
  sizeBytes: z.number().int().positive(),
  rightsConfirmed: z.literal(true, { message: "Confirm you own or are licensed to use this image" }),
  category: z.enum(["inspiration", "silhouette", "material", "palette", "moodboard"]).optional(),
});

/** Start a reference upload: creates a pending asset and a short-lived signed PUT URL. */
export const POST = handler(async (req: Request) => {
  const ctx = await requireAuth(req, "asset.upload");
  const body = await parseJson(req, Body);
  if (body.sizeBytes > getEnv().MAX_UPLOAD_BYTES) throw new ApiError(413, "too_large", "Images must be 8 MB or smaller");
  const org = await db().organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
  const asset = await db().$transaction(async (tx) => {
    const created = await tx.asset.create({
      data: {
        orgId: ctx.orgId, createdById: ctx.userId, kind: "reference", status: "pending", storageKey: "pending",
        fileName: safeFileName(body.fileName), contentType: body.contentType, sizeBytes: body.sizeBytes,
        rightsConfirmed: true, category: body.category ?? null, expiresAt: expiryFor("reference", org),
      },
    });
    return tx.asset.update({ where: { id: created.id }, data: { storageKey: objectKey(ctx.orgId, "reference", created.id) } });
  });
  const url = await signedUploadUrl(asset.storageKey, asset.contentType, asset.sizeBytes);
  await audit({ action: "asset.upload_requested", orgId: ctx.orgId, actorId: ctx.userId, resourceType: "asset", resourceId: asset.id, ip: clientIp(req), metadata: { contentType: asset.contentType, sizeBytes: asset.sizeBytes } });
  return json({ asset: assetDto(asset), upload: { method: "PUT", url, headers: { "Content-Type": asset.contentType }, expiresInSeconds: UPLOAD_URL_TTL_S } }, { status: 201 });
});

export const GET = handler(async (req: Request) => {
  const ctx = await requireAuth(req, "asset.read");
  const assets = await db().asset.findMany({ where: { orgId: ctx.orgId, status: { in: ["pending", "ready"] } }, orderBy: { createdAt: "desc" }, take: 100 });
  return json({ assets: assets.map(assetDto) });
});
