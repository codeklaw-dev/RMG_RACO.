// Track B integration tests against real Postgres + S3-compatible storage.
// Run: npm run db:up && npm run test:integration
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "./db";
import { getEnv, resetEnvCache } from "./env";
import { hashPassword } from "./auth/password";
import { fakeCalls } from "./inference";
import { headObject, s3 } from "./storage";
import * as login from "@/app/api/v1/auth/login/route";
import * as logout from "@/app/api/v1/auth/logout/route";
import * as me from "@/app/api/v1/me/route";
import * as assets from "@/app/api/v1/assets/route";
import * as asset from "@/app/api/v1/assets/[id]/route";
import * as complete from "@/app/api/v1/assets/[id]/complete/route";
import * as generations from "@/app/api/v1/generations/route";
import * as job from "@/app/api/v1/jobs/[id]/route";
import * as cancel from "@/app/api/v1/jobs/[id]/cancel/route";
import * as usage from "@/app/api/v1/usage/route";
import * as retention from "@/app/api/v1/internal/retention/route";

const ORIGIN = "http://localhost:3000";
const PW = "test-password-0123";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137]);

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
async function call(fn: unknown, opts: { method?: string; body?: unknown; cookie?: string; origin?: string | null; params?: Record<string, string>; headers?: Record<string, string> } = {}) {
  const method = opts.method ?? (opts.body ? "POST" : "GET");
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.origin !== null && method !== "GET") headers.origin = opts.origin ?? ORIGIN;
  const res = await (fn as Handler)(new Request(`${ORIGIN}/api/v1/x`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }), { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers, raw: text };
}

const ids: Record<string, string> = {};
const cookies: Record<string, string> = {};
async function signIn(email: string) {
  const r = await call(login.POST, { body: { email, password: PW } });
  expect(r.status).toBe(200);
  return r.headers.get("set-cookie")!.split(";")[0];
}
async function uploadReference(cookie: string, bytes: Buffer = PNG, declared = "image/png") {
  const start = await call(assets.POST, { cookie, body: { fileName: "ref.png", contentType: declared, sizeBytes: bytes.length, rightsConfirmed: true, category: "material" } });
  expect(start.status).toBe(201);
  const put = await fetch(start.body.upload.url, { method: "PUT", headers: { "Content-Type": declared }, body: new Uint8Array(bytes) });
  expect(put.status).toBe(200);
  return { id: start.body.asset.id as string, done: await call(complete.POST, { cookie, params: { id: start.body.asset.id } }) };
}
const genBody = (key: string, extra: object = {}) => ({ prompt: "Single-breasted wool blazer, ghost mannequin", category: "tailoring", silhouette: "tailored", materials: ["wool"], mode: "explore", count: 4, idempotencyKey: key, ...extra });

beforeAll(async () => {
  const orgA = await db().organization.create({ data: { name: "Serein Atelier (fictional)" } });
  const orgB = await db().organization.create({ data: { name: "Northfold Studio (fictional)" } });
  ids.orgA = orgA.id;
  ids.orgB = orgB.id;
  const hash = await hashPassword(PW);
  for (const [key, email, orgId, role] of [["ownerA", "owner@a.test", orgA.id, "owner"], ["designerA", "designer@a.test", orgA.id, "designer"], ["viewerA", "viewer@a.test", orgA.id, "viewer"], ["ownerB", "owner@b.test", orgB.id, "owner"]] as const) {
    const u = await db().user.create({ data: { email, name: key, passwordHash: hash } });
    await db().membership.create({ data: { userId: u.id, orgId, role } });
    ids[key] = u.id;
  }
  for (const k of ["ownerA", "designerA", "viewerA", "ownerB"]) cookies[k] = await signIn(`${k.replace(/A$|B$/, "")}@${k.endsWith("A") ? "a" : "b"}.test`);
});

beforeEach(() => {
  process.env.INFERENCE_PROVIDER = "fake";
  resetEnvCache();
});

describe("authentication", () => {
  it("issues an HttpOnly session cookie and resolves the caller's org", async () => {
    const r = await call(login.POST, { body: { email: "owner@a.test", password: PW } });
    expect(r.headers.get("set-cookie")).toMatch(/raco_session=.+; Path=\/; HttpOnly; SameSite=Lax/);
    const who = await call(me.GET, { cookie: cookies.ownerA });
    expect(who.body).toMatchObject({ org: { id: ids.orgA }, role: "owner" });
  });

  it("rejects bad credentials with one generic message and audits the failure", async () => {
    const wrong = await call(login.POST, { body: { email: "owner@a.test", password: "not-the-password" } });
    const unknown = await call(login.POST, { body: { email: "nobody@a.test", password: "not-the-password" } });
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
    expect(await db().auditEvent.count({ where: { action: "auth.login_failed" } })).toBeGreaterThanOrEqual(2);
  });

  it("locks sign-in after 10 failures in 15 minutes", async () => {
    for (let i = 0; i < 10; i++) await call(login.POST, { body: { email: "lockme@a.test", password: "nope-nope-nope" } });
    expect((await call(login.POST, { body: { email: "lockme@a.test", password: "nope-nope-nope" } })).status).toBe(429);
  });

  it("requires a session, rejects cross-origin writes, and ends sessions on logout", async () => {
    expect((await call(me.GET)).status).toBe(401);
    expect((await call(assets.POST, { cookie: cookies.ownerA, origin: "https://evil.example", body: {} })).status).toBe(403);
    expect((await call(assets.POST, { cookie: cookies.ownerA, origin: null, body: {} })).status).toBe(403);
    const c = await signIn("owner@a.test");
    expect((await call(logout.POST, { cookie: c })).status).toBe(200);
    expect((await call(me.GET, { cookie: c })).status).toBe(401);
  });

  it("stores only hashed session tokens", async () => {
    const token = cookies.ownerA.split("=")[1];
    expect(await db().session.count({ where: { tokenHash: token } })).toBe(0);
  });
});

describe("secure uploads", () => {
  it("validates on the server and serves via short-lived signed URLs", async () => {
    const { id, done } = await uploadReference(cookies.designerA);
    expect(done.status).toBe(200);
    expect(done.body.asset.status).toBe("ready");
    const got = await call(asset.GET, { cookie: cookies.designerA, params: { id } });
    expect(got.body.read.expiresInSeconds).toBe(600);
    const file = await fetch(got.body.read.url);
    expect(Buffer.from(await file.arrayBuffer()).equals(PNG)).toBe(true);
    expect(got.raw).not.toMatch(/org\/|storageKey/);
  });

  it("deletes files whose bytes don't match the declared type", async () => {
    const { id, done } = await uploadReference(cookies.designerA, Buffer.from("<svg onload=alert(1)></svg>   "), "image/png");
    expect(done.status).toBe(422);
    expect(done.body.error.reason).toBe("not_an_image");
    const row = await db().asset.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("rejected");
    expect(await headObject(row.storageKey)).toBeNull();
  });

  it("requires rights confirmation, enforces size and role", async () => {
    expect((await call(assets.POST, { cookie: cookies.designerA, body: { fileName: "a.png", contentType: "image/png", sizeBytes: 10, rightsConfirmed: false } })).status).toBe(400);
    expect((await call(assets.POST, { cookie: cookies.designerA, body: { fileName: "a.png", contentType: "image/png", sizeBytes: 9 * 1024 * 1024, rightsConfirmed: true } })).status).toBe(413);
    expect((await call(assets.POST, { cookie: cookies.designerA, body: { fileName: "a.gif", contentType: "image/gif", sizeBytes: 10, rightsConfirmed: true } })).status).toBe(400);
    expect((await call(assets.POST, { cookie: cookies.viewerA, body: { fileName: "a.png", contentType: "image/png", sizeBytes: 10, rightsConfirmed: true } })).status).toBe(403);
  });
});

describe("organisation isolation", () => {
  it("hides one org's assets and jobs from another (404, not 403)", async () => {
    const { id } = await uploadReference(cookies.ownerA);
    for (const r of [
      await call(asset.GET, { cookie: cookies.ownerB, params: { id } }),
      await call(asset.DELETE, { cookie: cookies.ownerB, params: { id } }),
      await call(complete.POST, { cookie: cookies.ownerB, params: { id } }),
    ]) expect(r.status).toBe(404);
    const a = await call(generations.POST, { cookie: cookies.ownerA, body: genBody("iso-job-a-1") });
    expect((await call(job.GET, { cookie: cookies.ownerB, params: { id: a.body.job.id } })).status).toBe(404);
    expect((await call(cancel.POST, { cookie: cookies.ownerB, params: { id: a.body.job.id } })).status).toBe(404);
    const crossRef = await call(generations.POST, { cookie: cookies.ownerB, body: genBody("iso-job-b-1", { referenceAssetIds: [id] }) });
    expect(crossRef.status).toBe(422);
    const list = await call(assets.GET, { cookie: cookies.ownerB });
    expect(list.body.assets.some((x: { id: string }) => x.id === id)).toBe(false);
  });
});

describe("generation requests: limits and lifecycle", () => {
  it("refuses when real inference is disabled, without creating a job", async () => {
    process.env.INFERENCE_PROVIDER = "none";
    resetEnvCache();
    const before = await db().generationJob.count();
    const r = await call(generations.POST, { cookie: cookies.designerA, body: genBody("disabled-1") });
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe("inference_disabled");
    expect(await db().generationJob.count()).toBe(before);
  });

  it("queues a job, is idempotent, and can be cancelled once", async () => {
    const r = await call(generations.POST, { cookie: cookies.designerA, body: genBody("life-1") });
    expect(r.status).toBe(202);
    expect(r.body.job).toMatchObject({ status: "queued", imageCount: 4, estimatedCostUsd: 0.08 });
    expect(r.raw).not.toMatch(/providerJobId|fake_/);
    expect(fakeCalls.submitted).toContain(r.body.job.id);
    const again = await call(generations.POST, { cookie: cookies.designerA, body: genBody("life-1") });
    expect(again.body).toMatchObject({ duplicate: true, job: { id: r.body.job.id } });
    const c = await call(cancel.POST, { cookie: cookies.designerA, params: { id: r.body.job.id } });
    expect(c.body.job.status).toBe("canceled");
    expect(fakeCalls.canceled).toContain(`fake_${r.body.job.id}`);
    expect((await call(cancel.POST, { cookie: cookies.designerA, params: { id: r.body.job.id } })).status).toBe(409);
  });

  it("denies viewers", async () => {
    expect((await call(generations.POST, { cookie: cookies.viewerA, body: genBody("viewer-1") })).status).toBe(403);
  });

  it("enforces 20 requests per user per hour", async () => {
    const u = ids.ownerB;
    const recent = await db().generationJob.count({ where: { userId: u, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
    for (let i = recent; i < 20; i++) await db().generationJob.create({ data: { orgId: ids.orgB, userId: u, provider: "fake", imageCount: 1, estimatedCostUsd: 0, actualCostUsd: 0, idempotencyKey: `seed-rate-${i}`, request: {} } });
    const r = await call(generations.POST, { cookie: cookies.ownerB, body: genBody("rate-21") });
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe("rate_limited");
    expect(await db().auditEvent.count({ where: { action: "generation.rejected_limit", orgId: ids.orgB } })).toBeGreaterThan(0);
  });

  it("enforces the organisation's monthly budget", async () => {
    await db().organization.update({ where: { id: ids.orgA }, data: { monthlyBudgetUsd: 0.5 } });
    const spent = (await call(usage.GET, { cookie: cookies.ownerA })).body.month.spentUsd;
    await db().generationJob.create({ data: { orgId: ids.orgA, userId: ids.ownerA, provider: "fake", imageCount: 1, estimatedCostUsd: 0, actualCostUsd: Math.max(0, 0.45 - spent), idempotencyKey: "seed-budget", request: {} } });
    const r = await call(generations.POST, { cookie: cookies.ownerA, body: genBody("budget-1") });
    expect(r.status).toBe(402);
    expect(r.body.error.code).toBe("org_budget_exceeded");
    await db().organization.update({ where: { id: ids.orgA }, data: { monthlyBudgetUsd: 25 } });
  });

  it("enforces the global spending limit across organisations", async () => {
    const big = await db().generationJob.create({ data: { orgId: ids.orgB, userId: ids.ownerB, provider: "fake", imageCount: 1, estimatedCostUsd: 0, actualCostUsd: 99.99, idempotencyKey: "seed-global", request: {} } });
    const r = await call(generations.POST, { cookie: cookies.designerA, body: genBody("global-1") });
    expect(r.status).toBe(402);
    expect(r.body.error.code).toBe("global_limit_reached");
    await db().generationJob.delete({ where: { id: big.id } });
  });
});

describe("retention and deletion", () => {
  it("purges expired assets and their objects; keeps fresh ones; requires the cron secret", async () => {
    const expired = await db().asset.create({ data: { orgId: ids.orgA, createdById: ids.ownerA, kind: "reference", status: "ready", storageKey: `org/${ids.orgA}/references/expired-1`, fileName: "old.png", contentType: "image/png", sizeBytes: PNG.length, rightsConfirmed: true, expiresAt: new Date(Date.now() - 1000) } });
    await s3().send(new PutObjectCommand({ Bucket: getEnv().S3_BUCKET, Key: expired.storageKey, Body: PNG, ContentType: "image/png" }));
    const { id: fresh } = await uploadReference(cookies.ownerA);
    expect((await call(retention.POST, { origin: null, headers: { authorization: "Bearer wrong" } })).status).toBe(401);
    const r = await call(retention.POST, { origin: null, headers: { authorization: `Bearer ${getEnv().RETENTION_CRON_SECRET}` } });
    expect(r.status).toBe(200);
    expect(r.body.assetsDeleted).toBeGreaterThanOrEqual(1);
    expect((await db().asset.findUniqueOrThrow({ where: { id: expired.id } })).status).toBe("deleted");
    expect(await headObject(expired.storageKey)).toBeNull();
    expect((await db().asset.findUniqueOrThrow({ where: { id: fresh } })).status).toBe("ready");
  });

  it("lets users delete an asset (object removed, audited)", async () => {
    const { id } = await uploadReference(cookies.designerA);
    const key = (await db().asset.findUniqueOrThrow({ where: { id } })).storageKey;
    expect((await call(asset.DELETE, { cookie: cookies.designerA, params: { id } })).status).toBe(200);
    expect(await headObject(key)).toBeNull();
    expect((await call(asset.GET, { cookie: cookies.designerA, params: { id } })).status).toBe(404);
  });
});

describe("audit trail and secret hygiene", () => {
  it("records security-relevant actions without secrets", async () => {
    const actions = (await db().auditEvent.findMany({ select: { action: true } })).map((a) => a.action);
    for (const a of ["auth.login", "auth.login_failed", "auth.logout", "asset.upload_requested", "asset.ready", "asset.rejected", "asset.deleted", "asset.expired", "generation.requested", "generation.rejected_limit", "job.canceled"]) expect(actions).toContain(a);
    const dump = JSON.stringify(await db().auditEvent.findMany());
    expect(dump).not.toMatch(/X-Amz-Signature|raco_local_secret|test-password|raco_session=/);
  });

  it("never returns credentials or internal keys in API responses", async () => {
    const responses = [
      await call(me.GET, { cookie: cookies.ownerA }),
      await call(assets.GET, { cookie: cookies.ownerA }),
      await call(usage.GET, { cookie: cookies.ownerA }),
    ];
    for (const r of responses) expect(r.raw).not.toMatch(/passwordHash|tokenHash|storageKey|S3_|AUTH_SECRET|raco_local_secret/);
  });
});
