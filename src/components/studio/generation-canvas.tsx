"use client";
import { AlertTriangle, Ban, RotateCcw, Square } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { ConceptCard } from "@/components/shared/concept-card";
import { Reveal } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isActive } from "@/lib/services/job-machine";
import { useStudioSession } from "@/lib/store/studio-session";
import { useStudioStore, type JobRecord } from "@/lib/store/studio-store";
import { cn } from "@/lib/utils";
import { EXAMPLE_BRIEFS } from "./brief-panel";
import type { useJobRunner } from "./use-job-runner";

type Runner = ReturnType<typeof useJobRunner>;

const ERROR_COPY: Record<string, string> = {
  simulated_failure: "The demo adapter returned a simulated failure, as requested in Advanced settings.",
  interrupted: "The page was reloaded while this demo job was running. Retry to run it again from the stored request.",
};

function EmptyCanvas() {
  const setBrief = useStudioSession((s) => s.setBrief);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-6 py-16">
      <p className="t-meta">Design Studio</p>
      <h2 className="t-display">Start from a brief.</h2>
      <ol className="t-body space-y-2 text-charcoal">
        <li><span className="t-meta mr-2">01</span>Describe the garment in your own words.</li>
        <li><span className="t-meta mr-2">02</span>Set garment, silhouette, material and palette.</li>
        <li><span className="t-meta mr-2">03</span>Choose Explore, Brand or Hybrid, then generate 2–4 concepts.</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_BRIEFS.map((ex) => (
          <Button key={ex.label} variant="outline" size="sm" className="rounded-none" onClick={() => setBrief({ prompt: ex.prompt, ...(ex.patch as object) })}>
            {ex.label}
          </Button>
        ))}
      </div>
      <p className="t-body text-muted-foreground">
        This demo uses a simulated adapter: results are deterministic schematic concepts assembled from your brief, not images from a live model.
      </p>
    </div>
  );
}

function JobStatus({ record, runner }: { record: JobRecord; runner: Runner }) {
  const { job } = record;
  const active = isActive(job.status);
  const pct = Math.round(job.progress * 100);
  return (
    <div className="space-y-3 border-b border-hairline pb-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="t-meta">
            {job.status} · attempt {job.attempt} · {record.request.mode}
            {record.request.brandContext ? ` · Brand DNA v${record.request.brandContext.version}` : ""}
          </p>
          <p className="truncate text-[15px] font-medium">{record.request.prompt}</p>
        </div>
        <div className="flex gap-2">
          {active && (
            <Button variant="outline" size="sm" className="rounded-none" onClick={() => runner.cancel(job.id)}>
              <Square /> Cancel
            </Button>
          )}
          {(job.status === "failed" || job.status === "canceled") && (
            <Button size="sm" className="rounded-none" disabled={Boolean(runner.activeJobId)} onClick={() => runner.retry(job.id)}>
              <RotateCcw /> Retry
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-1.5" aria-live="polite">
        <div className="h-px w-full bg-hairline" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Demonstration progress">
          <div className={cn("h-px transition-[width] duration-300", job.status === "failed" ? "bg-destructive" : "bg-ink")} style={{ width: `${pct}%` }} />
        </div>
        <p className="t-meta flex justify-between">
          <span>{job.stage ?? job.status}</span>
          <span>{active ? `${pct}% · demonstration progress, no model inference` : `${pct}%`}</span>
        </p>
      </div>
      {job.status === "failed" && (
        <p role="alert" className="flex items-start gap-2 text-[13px] text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {ERROR_COPY[job.errorCode ?? ""] ?? "The job failed. Retry or adjust the brief."}
        </p>
      )}
      {job.status === "canceled" && (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Ban className="size-4" /> Canceled. Nothing was saved. Retry to run the same request again.
        </p>
      )}
    </div>
  );
}

function History({ records, current }: { records: JobRecord[]; current: string | null }) {
  const setViewJob = useStudioSession((s) => s.setViewJob);
  if (records.length < 2) return null;
  return (
    <nav aria-label="Generation history" className="border-t border-hairline pt-4">
      <p className="t-meta mb-2">History</p>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {records.map(({ job, request }) => (
          <li key={job.id} className="shrink-0">
            <button
              type="button"
              onClick={() => setViewJob(job.id)}
              aria-current={job.id === current ? "true" : undefined}
              className={cn(
                "w-48 border border-hairline px-3 py-2 text-left outline-none transition-colors hover:bg-card focus-visible:ring-2 focus-visible:ring-ring",
                job.id === current && "border-ink bg-card",
              )}
            >
              <span className="t-meta block">{job.status} · {request.mode}{request.brandContext ? ` · v${request.brandContext.version}` : ""}</span>
              <span className="block truncate text-[12px]">{request.prompt}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function GenerationCanvas({ runner, onSelect }: { runner: Runner; onSelect: (id: string) => void }) {
  const records = useStudioStore((s) => s.jobs);
  const viewJobId = useStudioSession((s) => s.viewJobId);
  const selectedId = useStudioSession((s) => s.selectedId);
  const record = records.find((r) => r.job.id === viewJobId) ?? records[0];
  const results = useStudioStore(
    useShallow((s) => (record ? record.job.resultConceptIds.map((id) => s.concepts.find((c) => c.id === id)).filter((c) => c !== undefined) : [])),
  );

  if (!runner.hydrated) return <div className="p-8"><Skeleton className="h-64 w-full rounded-none" /></div>;
  if (!record) return <EmptyCanvas />;

  const pending = isActive(record.job.status);
  const count = Number(record.request.count ?? 4);

  return (
    <div className="space-y-6">
      <JobStatus record={record} runner={runner} />
      {pending && (
        <div className={cn("grid gap-4", count > 2 ? "grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4" : "grid-cols-2")} aria-hidden>
          {Array.from({ length: count }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full rounded-none bg-paper-2" />
          ))}
        </div>
      )}
      {record.job.status === "succeeded" && (
        <Reveal key={record.job.id} className={cn("grid gap-x-4 gap-y-8", results.length > 2 ? "grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4" : "grid-cols-2")}>
          {results.map((c) => (
            <ConceptCard key={c.id} concept={c} onSelect={onSelect} selected={c.id === selectedId} />
          ))}
        </Reveal>
      )}
      <History records={records} current={record.job.id} />
    </div>
  );
}
