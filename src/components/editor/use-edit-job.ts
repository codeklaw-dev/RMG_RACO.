"use client";
// Runs a conversational refinement through the AIProvider (demo adapter today)
// and appends the resulting version. Mirrors useJobRunner's polling contract.
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getAIProvider, ProviderError } from "@/lib/services";
import { isActive } from "@/lib/services/job-machine";
import { useStudioStore } from "@/lib/store/studio-store";
import type { Concept, GenerationJob, Region } from "@/lib/types/domain";
import { newIdempotencyKey } from "@/components/studio/use-job-runner";

export function useEditJob() {
  const [job, setJob] = useState<GenerationJob | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const run = useCallback(async (concept: Concept, instruction: string, region: Region | null, onDone?: (versionId: string) => void) => {
    const provider = getAIProvider();
    const store = useStudioStore.getState();
    const head = store.versions.find((v) => v.id === concept.currentVersionId)!;
    try {
      const { jobId } = await provider.editConcept({
        orgId: concept.orgId,
        conceptId: concept.id,
        parentVersionId: head.id,
        instruction,
        region,
        base: { ...head.snapshot, details: head.snapshot.details ?? [] },
        idempotencyKey: newIdempotencyKey(),
      });
      setJob(await provider.getJob(jobId));
      stop();
      timer.current = setInterval(async () => {
        const j = await provider.getJob(jobId);
        setJob(j);
        if (isActive(j.status)) return;
        stop();
        if (j.status !== "succeeded") return void toast.error("Refinement did not complete");
        const v = await provider.getEditResult(jobId);
        const res = v ? useStudioStore.getState().addVersion(v) : { ok: false as const, error: "No result" };
        if (res.ok) {
          toast.success("Saved as a new version (simulated refinement)");
          onDone?.(res.value);
        } else toast.error(res.error);
      }, 250);
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: e instanceof ProviderError ? e.message : "Could not start the refinement" };
    }
  }, []);

  const cancel = useCallback(async () => {
    if (!job) return;
    await getAIProvider().cancelJob(job.id);
    stop();
    setJob(await getAIProvider().getJob(job.id));
  }, [job]);

  return { job, running: Boolean(job && isActive(job.status)), run, cancel };
}
