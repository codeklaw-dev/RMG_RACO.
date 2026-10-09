import { describe, expect, it } from "vitest";
import type { GenerationJob } from "@/lib/types/domain";
import { canTransition, transition } from "./job-machine";

const draft: GenerationJob = {
  id: "j1", orgId: "o", type: "generate", provider: "demo", status: "draft", progress: 0, label: "", stage: null,
  attempt: 1, errorCode: null, costEstimate: null, resultConceptIds: [], createdAt: "2026-01-01T00:00:00Z",
};

describe("job state machine", () => {
  it("follows the happy path draft → queued → running → succeeded", () => {
    let j = transition(draft, { type: "submit" });
    expect(j.status).toBe("queued");
    j = transition(j, { type: "start" });
    j = transition(j, { type: "progress", progress: 0.5 });
    expect(j.progress).toBe(0.5);
    j = transition(j, { type: "succeed", resultConceptIds: ["c1"] });
    expect(j).toMatchObject({ status: "succeeded", progress: 1, resultConceptIds: ["c1"] });
  });

  it("never lets progress go backwards or reach 1 before success", () => {
    const running = transition(transition(draft, { type: "submit" }), { type: "start" });
    const p = transition(running, { type: "progress", progress: 0.6 });
    expect(transition(p, { type: "progress", progress: 0.3 }).progress).toBe(0.6);
    expect(transition(p, { type: "progress", progress: 1 }).progress).toBe(0.99);
  });

  it("rejects invalid transitions", () => {
    expect(() => transition(draft, { type: "start" })).toThrow(/Cannot start a draft job/);
    const done = { ...draft, status: "succeeded" as const };
    expect(() => transition(done, { type: "cancel" })).toThrow();
    expect(() => transition(done, { type: "retry" })).toThrow();
    expect(canTransition("queued", "succeed")).toBe(false);
  });

  it("supports cancel and retry with attempt tracking", () => {
    const canceled = transition(transition(draft, { type: "submit" }), { type: "cancel" });
    expect(canceled.status).toBe("canceled");
    const failed = { ...draft, status: "failed" as const, errorCode: "x" };
    const retried = transition(failed, { type: "retry" });
    expect(retried).toMatchObject({ status: "queued", attempt: 2, errorCode: null, progress: 0 });
  });
});
