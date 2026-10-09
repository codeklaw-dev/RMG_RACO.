"use client";
// Owns one try-on run at a time. Starting is single-flight, polling is
// sequential, and cancel / garment switch / unmount abort the run so no stale
// progress or result reaches React state or the preview store.
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getAIProvider, ProviderError, type TryOnRequest } from "@/lib/services";
import { pollJob } from "@/lib/services/poll-job";
import { useHandoffStore } from "@/lib/store/handoff-store";
import type { GenerationJob } from "@/lib/types/domain";
import type { TryOnPreview } from "@/lib/types/handoff";

interface Run {
  controller: AbortController;
  jobId: string | null;
}

export function useTryOnJob() {
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [result, setResult] = useState<TryOnPreview | null>(null);
  const run = useRef<Run | null>(null);
  const mounted = useRef(true);

  /** Abort the current run and cancel its provider job (fire-and-forget). */
  const abortRun = useCallback(() => {
    const r = run.current;
    run.current = null;
    if (!r) return null;
    r.controller.abort();
    if (r.jobId) void getAIProvider().cancelJob(r.jobId).catch(() => {});
    return r.jobId;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRun();
    };
  }, [abortRun]);

  const start = useCallback(async (request: TryOnRequest) => {
    if (run.current) return { ok: false as const, error: "A preview is already being generated" };
    const controller = new AbortController();
    const current: Run = { controller, jobId: null };
    run.current = current;
    const provider = getAIProvider();
    const live = () => !controller.signal.aborted && mounted.current;
    try {
      const { jobId } = await provider.virtualTryOn(request);
      current.jobId = jobId;
      if (!live()) {
        void provider.cancelJob(jobId).catch(() => {});
        return { ok: false as const, error: "aborted" };
      }
      setResult(null);
      const outcome = await pollJob({
        jobId,
        getJob: (id) => provider.getJob(id),
        getResult: (id) => provider.getTryOnResult(id),
        onUpdate: (j) => { if (live()) setJob(j); },
        signal: controller.signal,
      });
      if (outcome.kind === "aborted" || !live()) return { ok: false as const, error: "aborted" };
      if (outcome.kind === "ended" || !outcome.result) {
        toast.error("Preview did not complete");
        return { ok: false as const, error: outcome.kind === "ended" ? outcome.job.status : "no result" };
      }
      const saved = useHandoffStore.getState().addPreview(outcome.result);
      if (!saved.ok) {
        toast.error(saved.error);
        return { ok: false as const, error: saved.error };
      }
      setResult(useHandoffStore.getState().previews.find((p) => p.id === outcome.result!.id) ?? null);
      toast.success("Conceptual preview ready");
      return { ok: true as const };
    } catch (e) {
      if (live()) toast.error(e instanceof ProviderError ? e.message : "Could not start the preview");
      return { ok: false as const, error: e instanceof Error ? e.message : "error" };
    } finally {
      if (run.current === current) run.current = null;
    }
  }, []);

  /** User cancel: stop polling, cancel the job, show its final state once. */
  const cancel = useCallback(async () => {
    const jobId = abortRun();
    if (!jobId) return;
    const final = await getAIProvider().getJob(jobId).catch(() => null);
    if (mounted.current && final) setJob(final);
  }, [abortRun]);

  /** Garment/version switch: abandon the run and clear the stage. */
  const reset = useCallback(() => {
    abortRun();
    setJob(null);
    setResult(null);
  }, [abortRun]);

  return { job, result, setResult, start, cancel, reset, isRunning: () => run.current !== null };
}
