import { describe, expect, it, vi } from "vitest";
import type { GenerationJob, JobStatus } from "@/lib/types/domain";
import { pollJob } from "./poll-job";

const job = (status: JobStatus, progress = 0): GenerationJob => ({
  id: "j", orgId: "o", type: "try_on", provider: "test", status, progress, label: "", stage: null, attempt: 1, errorCode: null, costEstimate: null, resultConceptIds: [], createdAt: "",
});

/** Fake provider whose getJob resolves slowly and records concurrency. */
function slowProvider(statuses: JobStatus[], delayMs = 30) {
  let inFlight = 0, maxInFlight = 0, calls = 0;
  const getJob = vi.fn(async () => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight); calls++;
    await new Promise((r) => setTimeout(r, delayMs));
    inFlight--;
    return job(statuses[Math.min(calls - 1, statuses.length - 1)], calls / statuses.length);
  });
  return { getJob, getResult: vi.fn(async () => "RESULT"), stats: () => ({ maxInFlight, calls }) };
}

describe("pollJob", () => {
  it("never overlaps requests even when responses are slower than the interval", async () => {
    const p = slowProvider(["queued", "running", "running", "running", "succeeded"], 40);
    const updates: JobStatus[] = [];
    const out = await pollJob({ jobId: "j", ...p, onUpdate: (j) => updates.push(j.status), signal: new AbortController().signal, intervalMs: 1 });
    expect(out).toMatchObject({ kind: "succeeded", result: "RESULT" });
    expect(p.stats().maxInFlight).toBe(1);
    expect(updates).toEqual(["queued", "running", "running", "running", "succeeded"]);
    expect(p.getResult).toHaveBeenCalledTimes(1);
  });

  it("drops a response that arrives after abort and fetches no result", async () => {
    const p = slowProvider(["running", "succeeded"], 30);
    const ctrl = new AbortController();
    const onUpdate = vi.fn();
    const pending = pollJob({ jobId: "j", ...p, onUpdate, signal: ctrl.signal, intervalMs: 1 });
    ctrl.abort(); // while the first getJob is in flight
    expect(await pending).toEqual({ kind: "aborted" });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(p.getResult).not.toHaveBeenCalled();
  });

  it("wakes from the interval sleep immediately on abort", async () => {
    const p = slowProvider(["running"], 1);
    const ctrl = new AbortController();
    const t0 = Date.now();
    const pending = pollJob({ jobId: "j", ...p, onUpdate: () => ctrl.abort(), signal: ctrl.signal, intervalMs: 10_000 });
    expect(await pending).toEqual({ kind: "aborted" });
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(p.stats().calls).toBe(1);
  });

  it("reports failed/canceled jobs without fetching results", async () => {
    for (const s of ["failed", "canceled"] as const) {
      const p = slowProvider([s], 1);
      const out = await pollJob({ jobId: "j", ...p, onUpdate: () => {}, signal: new AbortController().signal });
      expect(out).toMatchObject({ kind: "ended", job: { status: s } });
      expect(p.getResult).not.toHaveBeenCalled();
    }
  });
});
