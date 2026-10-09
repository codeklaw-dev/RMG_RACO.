// Deterministic, clearly-labelled SIMULATED provider. No network, no keys.
// Job progress is derived from elapsed time on an injectable clock, so it
// behaves like a polled queue in the UI and is fully controllable in tests.
// Stages describe demonstration progress, not model inference.
import type { Concept, GenerationJob, ID, JobType } from "@/lib/types/domain";
import { JOBS } from "@/lib/fixtures";
import {
  type AIProvider,
  type BrandAnalysisRequest,
  type EditRequest,
  type GenerateRequest,
  type GenerateRequestInput,
  type JobRef,
  type TryOnRequest,
  ProviderError,
  editRequestSchema,
  generateRequestSchema,
} from "./ai-provider";
import { synthesizeConcepts } from "./demo-engine";
import { TERMINAL, transition } from "./job-machine";

export const QUEUE_MS = 800;
export const DURATION_MS: Record<JobType, number> = {
  generate: 4200,
  edit: 4000,
  analyze_brand: 5000,
  try_on: 7000,
};
/** Progress at which a `simulateFailure` request fails (first attempt only). */
export const FAIL_AT = 0.45;

export const DEMO_STAGES = [
  { until: 0.25, label: "Assembling request metadata" },
  { until: 0.6, label: "Composing schematic previews" },
  { until: 0.9, label: "Writing concept descriptions" },
  { until: 1, label: "Finalising" },
] as const;
const stageFor = (p: number) => DEMO_STAGES.find((s) => p < s.until)?.label ?? "Finalising";

interface Tracked {
  job: GenerationJob;
  startedAt: number;
  request: GenerateRequest | null;
  results: Concept[];
  fixtureResultIds: ID[];
}

export class DemoAIAdapter implements AIProvider {
  readonly info = { id: "demo", label: "Demo adapter", capability: "simulated" as const };
  private jobs = new Map<ID, Tracked>();
  private seq = 0;
  private idempotency = new Map<string, ID>();

  constructor(private now: () => number = () => Date.now()) {
    for (const job of JOBS) {
      this.jobs.set(job.id, { job, startedAt: 0, request: null, results: [], fixtureResultIds: job.resultConceptIds });
    }
  }

  private enqueue(type: JobType, orgId: ID, label: string, key: string | null, request: GenerateRequest | null, fixtureIds: ID[] = []): JobRef {
    const existing = key ? this.idempotency.get(key) : undefined;
    if (existing) return { jobId: existing };
    const id = `job_${type}_${this.now().toString(36)}_${++this.seq}`;
    const draft: GenerationJob = {
      id, orgId, type, provider: this.info.id, status: "draft", progress: 0, label, stage: null, attempt: 1,
      errorCode: null, costEstimate: null, resultConceptIds: [], createdAt: new Date(this.now()).toISOString(),
    };
    this.jobs.set(id, { job: transition(draft, { type: "submit" }), startedAt: this.now(), request, results: [], fixtureResultIds: fixtureIds });
    if (key) this.idempotency.set(key, id);
    return { jobId: id };
  }

  async generateConcepts(input: GenerateRequestInput) {
    const parsed = generateRequestSchema.safeParse(input);
    if (!parsed.success) throw new ProviderError("validation", parsed.error.issues[0].message);
    const req = parsed.data;
    const label = `${req.count} ${req.category} concepts · ${req.mode}${req.variationOf ? " · variation" : ""}`;
    return this.enqueue("generate", req.orgId, label, req.idempotencyKey, req);
  }

  async editConcept(req: EditRequest) {
    const parsed = editRequestSchema.safeParse(req);
    if (!parsed.success) throw new ProviderError("validation", parsed.error.issues[0].message);
    return this.enqueue("edit", req.orgId, req.instruction.slice(0, 48), req.idempotencyKey, null, [req.conceptId]);
  }

  async analyzeBrand(req: BrandAnalysisRequest) {
    return this.enqueue("analyze_brand", req.orgId, `Analyse ${req.assetIds.length} references`, null, null);
  }

  async virtualTryOn(req: TryOnRequest) {
    if (!req.consentConfirmed) throw new ProviderError("validation", "Model consent is required.");
    return this.enqueue("try_on", req.orgId, "Try-on preview", null, null);
  }

  private get(jobId: ID) {
    const t = this.jobs.get(jobId);
    if (!t) throw new ProviderError("not_found", `Job ${jobId} not found`);
    return t;
  }

  /** Advance a tracked job to the state implied by the clock. */
  private advance(t: Tracked) {
    if (!t.startedAt || TERMINAL.includes(t.job.status)) return;
    const elapsed = this.now() - t.startedAt;
    if (t.job.status === "queued") {
      if (elapsed < QUEUE_MS) return;
      t.job = transition(t.job, { type: "start" });
    }
    const progress = Math.min(1, (elapsed - QUEUE_MS) / DURATION_MS[t.job.type]);
    if (t.request?.simulateFailure && t.job.attempt === 1 && progress >= FAIL_AT) {
      t.job = transition(transition(t.job, { type: "progress", progress: FAIL_AT, stage: stageFor(FAIL_AT) }), {
        type: "fail",
        errorCode: "simulated_failure",
      });
      return;
    }
    if (progress >= 1) {
      t.results = t.request ? synthesizeConcepts(t.request, { jobId: t.job.id, now: new Date(this.now()).toISOString() }) : [];
      const ids = t.request ? t.results.map((c) => c.id) : t.fixtureResultIds;
      t.job = transition(t.job, { type: "succeed", resultConceptIds: ids });
      return;
    }
    t.job = transition(t.job, { type: "progress", progress, stage: stageFor(progress) });
  }

  async getJob(jobId: ID): Promise<GenerationJob> {
    const t = this.get(jobId);
    this.advance(t);
    return t.job;
  }

  async getResults(jobId: ID): Promise<Concept[]> {
    const t = this.get(jobId);
    this.advance(t);
    return t.job.status === "succeeded" ? t.results : [];
  }

  async cancelJob(jobId: ID) {
    const t = this.get(jobId);
    this.advance(t);
    if (TERMINAL.includes(t.job.status)) return; // already finished: cancel is a no-op
    t.job = transition(t.job, { type: "cancel" });
  }

  async retryJob(jobId: ID) {
    const t = this.get(jobId);
    t.job = transition(t.job, { type: "retry" });
    t.startedAt = this.now();
  }

  /** Demo helper: lists jobs for the activity panel. */
  listJobs(orgId: ID): GenerationJob[] {
    return [...this.jobs.values()].filter((t) => t.job.orgId === orgId).map((t) => (this.advance(t), t.job));
  }
}
