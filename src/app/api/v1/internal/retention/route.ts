import { timingSafeEqual } from "node:crypto";
import { getEnv } from "@/server/env";
import { ApiError, handler, json } from "@/server/http";
import { runRetention } from "@/server/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Scheduled job endpoint (e.g. Vercel Cron). Bearer secret, constant-time compare. */
export const POST = handler(async (req: Request) => {
  const given = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
  const expected = Buffer.from(getEnv().RETENTION_CRON_SECRET);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new ApiError(401, "unauthorized", "Unauthorized");
  return json(await runRetention());
});
