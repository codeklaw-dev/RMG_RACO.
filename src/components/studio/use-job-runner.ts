"use client";
// Bridges the provider's job lifecycle to persisted Studio state.
// Polling stops when the Studio unmounts; the adapter keeps its own clock,
// so returning to the Studio resumes and collects results. A full page
// reload clears the in-memory demo queue — such jobs are marked interrupted
// and can be retried from their stored request.
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { getAIProvider, generateRequestSchema, ProviderError, type GenerateRequestInput } from "@/lib/services";
import { isActive } from "@/lib/services/job-machine";
import { useStoreHydrated, useStudioStore } from "@/lib/store/studio-store";
import { useStudioSession } from "@/lib/store/studio-session";
import type { GenerationJob, ID } from "@/lib/types/domain";

const POLL_MS = 250;

export const newIdempotencyKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `key_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export function useJobRunner() {
  const hydrated = useStoreHydrated();
  const activeJobId = useStudioStore((s) => s.activeJobId);
  const submitting = useRef(false);

  // Reconcile jobs persisted from an earlier page load.
  useEffect(() => {
    if (!hydrated) return;
    const provider = getAIProvider();
    const { jobs, updateJob, setActiveJob, activeJobId: active } = useStudioStore.getState();
    for (const { job } of jobs) {
      if (!isActive(job.status)) continue;
      provider.getJob(job.id).catch(() => {
        updateJob({ ...job, status: "failed", errorCode: "interrupted", stage: "Interrupted by page reload" });
        if (active === job.id) setActiveJob(null);
      });
    }
  }, [hydrated]);

  // Poll the active job.
  useEffect(() => {
    if (!hydrated || !activeJobId) return;
    const provider = getAIProvider();
    let stopped = false;
    const tick = async () => {
      const { updateJob, addConcepts, setActiveJob } = useStudioStore.getState();
      let job: GenerationJob;
      try {
        job = await provider.getJob(activeJobId);
      } catch {
        setActiveJob(null);
        return;
      }
      if (stopped) return;
      updateJob(job);
      if (isActive(job.status)) return;
      setActiveJob(null);
      if (job.status === "succeeded") {
        const results = await provider.getResults(job.id);
        addConcepts(results);
        useStudioSession.getState().select(results[0]?.id ?? null);
        toast.success(`${results.length} simulated concepts ready`);
      } else if (job.status === "failed") {
        toast.error("Generation failed", { description: "Simulated failure. You can retry the job." });
      }
    };
    void tick();
    const timer = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [hydrated, activeJobId]);

  const submit = useCallback(async (request: GenerateRequestInput) => {
    const parsed = generateRequestSchema.safeParse(request);
    if (!parsed.success) return { ok: false as const, issues: parsed.error.issues.map((i) => i.message) };
    if (submitting.current || useStudioStore.getState().activeJobId) {
      return { ok: false as const, issues: ["A generation is already running"] };
    }
    submitting.current = true;
    try {
      const provider = getAIProvider();
      const { jobId } = await provider.generateConcepts(request);
      const job = await provider.getJob(jobId);
      const store = useStudioStore.getState();
      store.upsertJob({ job, request });
      store.setActiveJob(jobId);
      useStudioSession.getState().setViewJob(jobId);
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, issues: [e instanceof ProviderError ? e.message : "Could not start generation"] };
    } finally {
      submitting.current = false;
    }
  }, []);

  const cancel = useCallback(async (id: ID) => {
    const provider = getAIProvider();
    await provider.cancelJob(id);
    const job = await provider.getJob(id);
    useStudioStore.getState().updateJob(job);
    if (job.status === "canceled") toast("Generation canceled");
  }, []);

  const retry = useCallback(async (id: ID) => {
    const provider = getAIProvider();
    const store = useStudioStore.getState();
    if (store.activeJobId) return;
    try {
      await provider.retryJob(id);
      store.updateJob(await provider.getJob(id));
      store.setActiveJob(id);
    } catch (e) {
      // Interrupted jobs are unknown to the in-memory queue: resubmit the stored request.
      const record = store.jobs.find((r) => r.job.id === id);
      if (e instanceof ProviderError && e.code === "not_found" && record) {
        await submit({ ...record.request, simulateFailure: false, idempotencyKey: newIdempotencyKey() });
      }
    }
  }, [submit]);

  return { hydrated, activeJobId, submit, cancel, retry };
}
