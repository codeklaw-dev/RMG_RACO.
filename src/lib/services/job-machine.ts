// Pure job state machine shared by all adapters.
// draft → queued → running → succeeded | failed | canceled; failed/canceled → queued (retry).
import type { GenerationJob, JobStatus } from "@/lib/types/domain";
import { ProviderError } from "./ai-provider";

export type JobEvent =
  | { type: "submit" }
  | { type: "start" }
  | { type: "progress"; progress: number; stage?: string }
  | { type: "succeed"; resultConceptIds: string[] }
  | { type: "fail"; errorCode: string }
  | { type: "cancel" }
  | { type: "retry" };

const ALLOWED: Record<JobEvent["type"], JobStatus[]> = {
  submit: ["draft"],
  start: ["queued"],
  progress: ["running"],
  succeed: ["running"],
  fail: ["queued", "running"],
  cancel: ["draft", "queued", "running"],
  retry: ["failed", "canceled"],
};

export const TERMINAL: JobStatus[] = ["succeeded", "failed", "canceled"];
export const isActive = (s: JobStatus) => s === "queued" || s === "running";

export function canTransition(status: JobStatus, event: JobEvent["type"]) {
  return ALLOWED[event].includes(status);
}

export function transition(job: GenerationJob, event: JobEvent): GenerationJob {
  if (!canTransition(job.status, event.type)) {
    throw new ProviderError("invalid_transition", `Cannot ${event.type} a ${job.status} job`);
  }
  switch (event.type) {
    case "submit":
      return { ...job, status: "queued", progress: 0, stage: "Queued" };
    case "start":
      return { ...job, status: "running", stage: "Starting" };
    case "progress":
      return { ...job, progress: Math.min(Math.max(event.progress, job.progress), 0.99), stage: event.stage ?? job.stage };
    case "succeed":
      return { ...job, status: "succeeded", progress: 1, stage: "Complete", resultConceptIds: event.resultConceptIds };
    case "fail":
      return { ...job, status: "failed", stage: "Failed", errorCode: event.errorCode };
    case "cancel":
      return { ...job, status: "canceled", stage: "Canceled" };
    case "retry":
      return { ...job, status: "queued", progress: 0, stage: "Queued", errorCode: null, attempt: job.attempt + 1, resultConceptIds: [] };
  }
}
