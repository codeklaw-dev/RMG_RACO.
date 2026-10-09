// Sequential, abortable job polling. The next request only starts after the
// previous one settles (no overlap), and once the signal aborts no callback
// runs and no result is fetched — so stale responses can't touch state.
import type { GenerationJob, ID } from "@/lib/types/domain";
import { isActive } from "./job-machine";

export type PollOutcome<R> =
  | { kind: "succeeded"; job: GenerationJob; result: R | null }
  | { kind: "ended"; job: GenerationJob } // failed or canceled
  | { kind: "aborted" };

export const abortableSleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });

export async function pollJob<R>(opts: {
  jobId: ID;
  getJob: (id: ID) => Promise<GenerationJob>;
  getResult: (id: ID) => Promise<R | null>;
  onUpdate: (job: GenerationJob) => void;
  signal: AbortSignal;
  intervalMs?: number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}): Promise<PollOutcome<R>> {
  const { jobId, getJob, getResult, onUpdate, signal, intervalMs = 250, sleep = abortableSleep } = opts;
  while (!signal.aborted) {
    const job = await getJob(jobId);
    if (signal.aborted) break;
    onUpdate(job);
    if (!isActive(job.status)) {
      if (job.status !== "succeeded") return { kind: "ended", job };
      const result = await getResult(jobId);
      return signal.aborted ? { kind: "aborted" } : { kind: "succeeded", job, result };
    }
    await sleep(intervalMs, signal);
  }
  return { kind: "aborted" };
}
