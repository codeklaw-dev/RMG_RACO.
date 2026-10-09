// Deterministic, clearly-labelled SIMULATED provider. No network, no keys.
// Job progress is derived from elapsed time on an injectable clock, so it
// behaves like a polled queue in the UI and is fully controllable in tests.
// Stages describe demonstration progress, not model inference.
import type { Concept, ConceptVersion, GenerationJob, ID, JobType } from "@/lib/types/domain";
import { JOBS } from "@/lib/fixtures";
import {
  type AIProvider,
  type BrandAnalysisRequest,
  type EditRequest,
  type EditRequestInput,
  type GenerateRequest,
  type GenerateRequestInput,
  type JobRef,
  type TryOnRequest,
  ProviderError,
  editRequestSchema,
  generateRequestSchema,
} from "./ai-provider";
import { synthesizeConcepts } from "./demo-engine";
import { applyEdit, parseInstruction } from "./demo-edit";
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
  edit: EditRequest | null;
  results: Concept[];
  version: ConceptVersion | null;
  fixtureResultIds: ID[];
}

export class DemoAIAdapter implements AIProvider {
  readonly info = { id: "demo", label: "Demo adapter", capability: "simulated" as const };
  private jobs = new Map<ID, Tracked>();
  private seq = 0;
  private idempotency = new Map<string, ID>();

  constructor(private now: () => number = () => Date.now()) {
    for (const job of JOBS) {
      this.jobs.set(job.id, { job, startedAt: 0, request: null, edit: null, results: [], version: null, fixtureResultIds: job.resultConceptIds });
    }
  }

  private enqueue(type: JobType, orgId: ID, label: string, key: string | null, request: GenerateRequest | null, fixtureIds: ID[] = [], edit: EditRequest | null = null): JobRef {
    const existing = key ? this.idempotency.get(key) : undefined;
    if (existing) return { jobId: existing };
    const id = `job_${type}_${this.now().toString(36)}_${++this.seq}`;
    const draft: GenerationJob = {
      id, orgId, type, provider: this.info.id, status: "draft", progress: 0, label, stage: null, attempt: 1,
      errorCode: null, costEstimate: null, resultConceptIds: [], createdAt: new Date(this.now()).toISOString(),
    };
    this.jobs.set(id, { job: transition(draft, { type: "submit" }), startedAt: this.now(), request, edit, results: [], version: null, fixtureResultIds: fixtureIds });
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

  async editConcept(input: EditRequestInput) {
    const parsed = editRequestSchema.safeParse(input);
    if (!parsed.success) throw new ProviderError("validation", parsed.error.issues[0].message);
    const req = parsed.data;
    if (!parseInstruction(req.instruction, req.base, req.region).changes.length) {
      throw new ProviderError("validation", "No supported change found. Name a silhouette, material, colour or construction detail.");
    }
    return this.enqueue("edit", req.orgId, req.instruction.slice(0, 48), req.idempotencyKey, null, [req.conceptId], req);
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
    if (progress >= 1 && t.edit) {
      const e = t.edit;
      const { changes } = parseInstruction(e.instruction, e.base, e.region);
      const id = `${e.conceptId}_${t.job.id}`;
      t.version = {
        id,
        conceptId: e.conceptId,
        parentId: e.parentVersionId,
        number: 0, // assigned by the store when appended
        summary: changes.map((c) => `${c.attribute}: ${c.to}`).join(" · "),
        brandProfileVersion: null, // inherited from the concept when appended
        provenance: "Simulated refinement by demo adapter · deterministic vocabulary match · no model inference",
        imageAssetId: `placeholder/${id}`,
        operation: "edit",
        instruction: e.instruction,
        region: e.region,
        changes,
        snapshot: applyEdit(e.base, changes, e.instruction),
        capability: "simulated",
        jobId: t.job.id,
        createdAt: new Date(this.now()).toISOString(),
      };
      t.job = transition(t.job, { type: "succeed", resultConceptIds: [e.conceptId] });
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

  async getEditResult(jobId: ID): Promise<ConceptVersion | null> {
    const t = this.get(jobId);
    this.advance(t);
    return t.job.status === "succeeded" ? t.version : null;
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
