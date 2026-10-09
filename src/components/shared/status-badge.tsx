import { cn } from "@/lib/utils";
import type { CapabilityState } from "@/lib/types/domain";

const STYLES: Record<CapabilityState, string> = {
  live: "border-emerald-700/30 text-emerald-800 bg-emerald-50",
  simulated: "border-oxblood/30 text-oxblood bg-oxblood-soft",
  planned: "border-hairline text-muted-foreground bg-paper-2",
};

const LABELS: Record<CapabilityState, string> = { live: "Live", simulated: "Simulated", planned: "Planned" };

/** Honest capability label. Every AI output in the demo must carry one. */
export function StatusBadge({ state, className }: { state: CapabilityState; className?: string }) {
  return (
    <span
      title={state === "simulated" ? "Curated demo output — not produced by a live model" : undefined}
      className={cn(
        "inline-flex h-5 items-center rounded-[2px] border px-1.5 font-mono text-[10px] uppercase tracking-[0.08em]",
        STYLES[state],
        className,
      )}
    >
      {LABELS[state]}
    </span>
  );
}
