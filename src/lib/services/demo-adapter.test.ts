import { beforeEach, describe, expect, it } from "vitest";
import { makeRequest } from "@/test/factories";
import { DURATION_MS, DemoAIAdapter, QUEUE_MS } from "./demo-adapter";

let clock = 0;
let adapter: DemoAIAdapter;
const tick = (ms: number) => (clock += ms);

beforeEach(() => {
  clock = 1_000_000;
  adapter = new DemoAIAdapter(() => clock);
});

describe("DemoAIAdapter", () => {
  it("moves a job through queued → running → succeeded and returns results", async () => {
    const { jobId } = await adapter.generateConcepts(makeRequest({ count: 2 }));
    expect((await adapter.getJob(jobId)).status).toBe("queued");
    tick(QUEUE_MS + 100);
    const running = await adapter.getJob(jobId);
    expect(running.status).toBe("running");
    expect(running.stage).toBeTruthy();
    expect(await adapter.getResults(jobId)).toEqual([]);
    tick(DURATION_MS.generate);
    const done = await adapter.getJob(jobId);
    expect(done.status).toBe("succeeded");
    const results = await adapter.getResults(jobId);
    expect(results.map((c) => c.id)).toEqual(done.resultConceptIds);
    expect(results).toHaveLength(2);
  });

  it("rejects invalid requests", async () => {
    await expect(adapter.generateConcepts(makeRequest({ prompt: "" }))).rejects.toMatchObject({ code: "validation" });
  });

  it("deduplicates submissions with the same idempotency key", async () => {
    const req = makeRequest();
    const a = await adapter.generateConcepts(req);
    const b = await adapter.generateConcepts(req);
    expect(a.jobId).toBe(b.jobId);
  });

  it("cancels running jobs and produces no results", async () => {
    const { jobId } = await adapter.generateConcepts(makeRequest());
    tick(QUEUE_MS + 500);
    await adapter.cancelJob(jobId);
    tick(DURATION_MS.generate * 2);
    expect((await adapter.getJob(jobId)).status).toBe("canceled");
    expect(await adapter.getResults(jobId)).toEqual([]);
  });

  it("fails when asked to simulate failure, then succeeds on retry", async () => {
    const { jobId } = await adapter.generateConcepts(makeRequest({ simulateFailure: true }));
    tick(QUEUE_MS + DURATION_MS.generate);
    const failed = await adapter.getJob(jobId);
    expect(failed).toMatchObject({ status: "failed", errorCode: "simulated_failure" });
    await adapter.retryJob(jobId);
    expect((await adapter.getJob(jobId)).attempt).toBe(2);
    tick(QUEUE_MS + DURATION_MS.generate);
    expect((await adapter.getJob(jobId)).status).toBe("succeeded");
  });

  it("refuses to retry a succeeded job", async () => {
    const { jobId } = await adapter.generateConcepts(makeRequest());
    tick(QUEUE_MS + DURATION_MS.generate);
    await adapter.getJob(jobId);
    await expect(adapter.retryJob(jobId)).rejects.toMatchObject({ code: "invalid_transition" });
  });
});
