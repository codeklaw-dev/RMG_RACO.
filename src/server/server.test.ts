// @vitest-environment node
import { describe, expect, it } from "vitest";
import { can } from "./authz";
import { hashPassword, verifyPassword } from "./auth/password";
import { hashToken, readSessionToken } from "./auth/session";
import { ConfigError, getEnv } from "./env";
import { ApiError, redact, toResponse } from "./http";
import { decideLimits, startOfMonthUtc } from "./limits";
import { DAY_MS, expiryFor } from "./retention";
import { checkUploaded, safeFileName, sniffImageType } from "./uploads";
import { objectKey } from "./storage";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const WEBP = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);
const baseEnv = {
  DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/db", S3_BUCKET: "bucket", S3_ACCESS_KEY_ID: "key", S3_SECRET_ACCESS_KEY: "secretsecret",
  AUTH_SECRET: "x".repeat(32), RETENTION_CRON_SECRET: "y".repeat(24), APP_ORIGIN: "https://app.example.com",
};

describe("server env validation", () => {
  it("accepts a complete config with safe defaults", () => {
    const env = getEnv({ ...baseEnv } as unknown as NodeJS.ProcessEnv);
    expect(env).toMatchObject({ INFERENCE_PROVIDER: "none", USER_HOURLY_GENERATION_LIMIT: 20, DEFAULT_ORG_MONTHLY_BUDGET_USD: 25, MAX_UPLOAD_BYTES: 8 * 1024 * 1024 });
  });
  it("names missing variables without echoing secret values", () => {
    try {
      getEnv({ ...baseEnv, AUTH_SECRET: "short-secret-value" } as unknown as NodeJS.ProcessEnv);
      throw new Error("should fail");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as Error).message).toContain("AUTH_SECRET");
      expect((e as Error).message).not.toContain("short-secret-value");
    }
  });
  it("refuses the fake inference provider in production", () => {
    expect(() => getEnv({ ...baseEnv, INFERENCE_PROVIDER: "fake", NODE_ENV: "production" } as unknown as NodeJS.ProcessEnv)).toThrow(/test-only/);
  });
});

describe("passwords and sessions", () => {
  it("hashes with scrypt and verifies only the right password", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$32768$8$1$")).toBe(true);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong horse battery", h)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
    await expect(hashPassword("short")).rejects.toThrow(/12/);
  });
  it("stores only a keyed hash of the session token", () => {
    expect(hashToken("abc", "s".repeat(32))).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("abc", "s".repeat(32))).not.toBe(hashToken("abc", "t".repeat(32)));
  });
  it("reads the session cookie", () => {
    const req = new Request("http://x", { headers: { cookie: "a=1; raco_session=tok_123; b=2" } });
    expect(readSessionToken(req)).toBe("tok_123");
    expect(readSessionToken(new Request("http://x"))).toBeNull();
  });
});

describe("authorization matrix", () => {
  it("lets viewers read but not upload, generate or delete", () => {
    expect(can("viewer", "asset.read")).toBe(true);
    for (const p of ["asset.upload", "asset.delete", "generation.create", "job.cancel"] as const) expect(can("viewer", p)).toBe(false);
    expect(can("designer", "generation.create")).toBe(true);
    expect(can("designer", "audit.read")).toBe(false);
    expect(can("owner", "audit.read")).toBe(true);
  });
});

describe("upload validation", () => {
  it("sniffs real image signatures", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(JPG)).toBe("image/jpeg");
    expect(sniffImageType(WEBP)).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
  it("rejects size mismatch, oversize, non-images and type spoofing", () => {
    const max = 1000;
    expect(checkUploaded({ contentType: "image/png", sizeBytes: 10 }, { size: 10, prefix: PNG }, max)).toEqual({ ok: true });
    expect(checkUploaded({ contentType: "image/png", sizeBytes: 10 }, { size: 11, prefix: PNG }, max)).toEqual({ ok: false, reason: "size_mismatch" });
    expect(checkUploaded({ contentType: "image/png", sizeBytes: 2000 }, { size: 2000, prefix: PNG }, max)).toEqual({ ok: false, reason: "too_large" });
    expect(checkUploaded({ contentType: "image/png", sizeBytes: 5 }, { size: 5, prefix: new TextEncoder().encode("hello") }, max)).toEqual({ ok: false, reason: "not_an_image" });
    expect(checkUploaded({ contentType: "image/png", sizeBytes: 6 }, { size: 6, prefix: JPG }, max)).toEqual({ ok: false, reason: "type_mismatch" });
  });
  it("never uses file names in object keys", () => {
    expect(objectKey("org1", "reference", "a1")).toBe("org/org1/references/a1");
    expect(safeFileName("../../etc/passwd")).toBe(".._.._etc_passwd");
  });
});

describe("rate and spend limits", () => {
  const base = { imageCount: 4, costPerImageUsd: 0.02, userRequestsLastHour: 0, userHourlyLimit: 20, orgSpentThisMonthUsd: 0, orgMonthlyBudgetUsd: 25, globalSpentThisMonthUsd: 0, globalMonthlyLimitUsd: 100 };
  it("allows within limits and estimates cost", () => expect(decideLimits(base)).toEqual({ ok: true, estimateUsd: 0.08 }));
  it("enforces 20 requests per user per hour", () => {
    expect(decideLimits({ ...base, userRequestsLastHour: 19 }).ok).toBe(true);
    expect(decideLimits({ ...base, userRequestsLastHour: 20 })).toMatchObject({ ok: false, status: 429, code: "rate_limited" });
  });
  it("enforces the org budget including the new request", () => {
    expect(decideLimits({ ...base, orgSpentThisMonthUsd: 24.92 }).ok).toBe(true);
    expect(decideLimits({ ...base, orgSpentThisMonthUsd: 24.93 })).toMatchObject({ ok: false, status: 402, code: "org_budget_exceeded" });
  });
  it("enforces the global limit first", () => {
    expect(decideLimits({ ...base, globalSpentThisMonthUsd: 99.95, orgSpentThisMonthUsd: 30 })).toMatchObject({ code: "global_limit_reached" });
  });
  it("computes the UTC month start", () => expect(startOfMonthUtc(new Date("2026-10-31T23:59:59Z")).toISOString()).toBe("2026-10-01T00:00:00.000Z"));
});

describe("retention", () => {
  it("expires references after 30 days and outputs after 90 by default", () => {
    const now = new Date("2026-10-10T00:00:00Z");
    const org = { referenceRetentionDays: 30, outputRetentionDays: 90 };
    expect(expiryFor("reference", org, now).getTime() - now.getTime()).toBe(30 * DAY_MS);
    expect(expiryFor("output", org, now).getTime() - now.getTime()).toBe(90 * DAY_MS);
  });
});

describe("error responses", () => {
  it("normalises errors without leaking internals", async () => {
    const r1 = toResponse(new ApiError(404, "not_found", "Asset not found"));
    expect(r1.status).toBe(404);
    expect(await r1.json()).toEqual({ error: { code: "not_found", message: "Asset not found" } });
    const r2 = toResponse(new Error("connect postgresql://raco:pw@db:5432/x failed"));
    expect(r2.status).toBe(500);
    expect(JSON.stringify(await r2.json())).not.toMatch(/postgres|pw@/);
    expect(redact("url?X-Amz-Signature=abc123&x=1 password=hunter2")).not.toMatch(/abc123|hunter2/);
  });
});
