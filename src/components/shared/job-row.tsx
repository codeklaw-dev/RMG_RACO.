import { AlertCircle, Check, Clock, Loader2, X } from "lucide-react";
import type { GenerationJob, JobStatus } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

const ICON: Record<JobStatus, typeof Check> = {
  draft: Clock, queued: Clock, running: Loader2, succeeded: Check, failed: AlertCircle, canceled: X,
};

export function JobRow({ job }: { job: GenerationJob }) {
  const Icon = ICON[job.status];
  return (
    <li className="flex items-center gap-3 py-3">
      <Icon
        aria-hidden
        className={cn(
          "size-4 shrink-0",
          job.status === "running" && "animate-spin text-oxblood",
          job.status === "failed" && "text-destructive",
          job.status === "succeeded" && "text-ink",
          (job.status === "queued" || job.status === "canceled") && "text-stone",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px]">{job.label}</p>
        <div className="mt-1.5 h-px w-full bg-hairline">
          <div className="h-px bg-ink transition-[width] duration-500" style={{ width: `${Math.round(job.progress * 100)}%` }} />
        </div>
      </div>
      <span className="t-meta w-20 text-right">
        {job.status === "failed" ? "Failed · retry" : job.status}
      </span>
    </li>
  );
}
