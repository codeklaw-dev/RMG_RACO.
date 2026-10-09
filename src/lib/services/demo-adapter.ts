// Deterministic, clearly-labelled SIMULATED provider. No network, no keys.
// Job progress is derived from elapsed time so polling behaves like a real queue.
import type { GenerationJob, ID, JobType } from "@/lib/types/domain";
import { JOBS } from "@/lib/fixtures";
import {
  type AIProvider,
  type BrandAnalysisRequest,
  type EditRequest,
  type GenerateRequest,
  type JobRef,
  type TryOnRequest,
  ProviderError,
  editRequestSchema,
  generateRequestSchema,
} from "./ai-provider";

const DURATION_MS: Record<JobType, number> = {
  generate: 6000,
  edit: 4000,
  analyze_brand: 5000,
  try_on: 7000,
};

interface Tracked {
  job: GenerationJob;
  startedAt: number;
  resultIds: ID[];
}

export class DemoAIAdapter implements AIProvider {
  readonly info = { id: "demo", label: "Demo adapter", capability: "simulated" as const };
  private jobs = new Map<ID, Tracked>();
  private seq = 0;
  private idempotency = new Map<string, ID>();

  constructor() {
    for (const job of JOBS) this.jobs.set(job.id, { job, startedAt: 0, resultIds: job.resultConceptIds });
  }

  private enqueue(type: JobType, orgId: ID, label: string, key: string | null, resultIds: ID[]): JobRef {
    if (key && this.idempotency.has(key)) return { jobId: this.idempotency.get(key)! };
    const id = `job_demo_${++this.seq}`;
    const job: GenerationJob = {
      id, orgId, type, provider: this.info.id, status: "queued", progress: 0, label,
      errorCode: null, costEstimate: null, resultConceptIds: [], createdAt: new Date().toISOString(),
    };
    this.jobs.set(id, { job, startedAt: Date.now(), resultIds });
    if (key) this.idempotency.set(key, id);
    return { jobId: id };
  }

  async generateConcepts(req: GenerateRequest) {
    const parsed = generateRequestSchema.safeParse(req);
    if (!parsed.success) throw new ProviderError("validation", parsed.error.issues[0].message);
    return this.enqueue("generate", req.orgId, `${req.count} ${req.category} concepts · ${req.mode}`, req.idempotencyKey, []);
  }

  async editConcept(req: EditRequest) {
    const parsed = editRequestSchema.safeParse(req);
    if (!parsed.success) throw new ProviderError("validation", parsed.error.issues[0].message);
    return this.enqueue("edit", req.orgId, req.instruction.slice(0, 48), req.idempotencyKey, [req.conceptId]);
  }

  async analyzeBrand(req: BrandAnalysisRequest) {
    return this.enqueue("analyze_brand", req.orgId, `Analyse ${req.assetIds.length} references`, null, []);
  }

  async virtualTryOn(req: TryOnRequest) {
    if (!req.consentConfirmed) throw new ProviderError("validation", "Model consent is required.");
    return this.enqueue("try_on", req.orgId, "Try-on preview", null, []);
  }

  async getJob(jobId: ID): Promise<GenerationJob> {
    const t = this.jobs.get(jobId);
    if (!t) throw new ProviderError("not_found", `Job ${jobId} not found`);
    const { job } = t;
    if (!t.startedAt || job.status === "canceled" || job.status === "failed" || job.status === "succeeded") return job;

    const elapsed = Date.now() - t.startedAt;
    const total = DURATION_MS[job.type];
    if (elapsed < 800) return job; // queued
    const progress = Math.min(1, (elapsed - 800) / total);
    t.job = progress >= 1
      ? { ...job, status: "succeeded", progress: 1, resultConceptIds: t.resultIds }
      : { ...job, status: "running", progress };
    return t.job;
  }

  async cancelJob(jobId: ID) {
    const t = this.jobs.get(jobId);
    if (!t) throw new ProviderError("not_found", `Job ${jobId} not found`);
    if (t.job.status === "queued" || t.job.status === "running") t.job = { ...t.job, status: "canceled" };
  }

  /** Demo helper: lists jobs for the activity panel. */
  listJobs(orgId: ID): GenerationJob[] {
    return [...this.jobs.values()].map((t) => t.job).filter((j) => j.orgId === orgId);
  }
}
