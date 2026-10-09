"use client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApprovedVersion, useBrandStore, useWorkingVersion, type ActionResult } from "@/lib/store/brand-store";
import type { ProfileStatus } from "@/lib/types/brand";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<ProfileStatus, string> = { draft: "Draft", in_review: "In review", approved: "Approved", archived: "Archived" };

export function VersionStatus({ status, className }: { status: ProfileStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[2px] border px-1.5 font-mono text-[10px] uppercase tracking-[0.08em]",
        status === "approved" && "border-ink bg-ink text-paper",
        status === "in_review" && "border-oxblood/40 bg-oxblood-soft text-oxblood",
        status === "draft" && "border-hairline bg-paper text-charcoal",
        status === "archived" && "border-hairline bg-paper-2 text-stone",
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const notify = (res: ActionResult, ok: string) => (res.ok ? toast.success(ok) : toast.error(res.error));

/** Approval workflow. Approval here is a simulated authorised action, not real auth. */
export function WorkflowBar() {
  const approved = useApprovedVersion();
  const working = useWorkingVersion();
  const { submit, returnToDraft, approve, discard } = useBrandStore.getState();

  return (
    <div className="flex flex-col gap-3 border-y border-hairline py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
        {approved && (
          <span className="flex items-center gap-2">
            <VersionStatus status="approved" /> v{approved.version} conditions Brand & Hybrid generation
          </span>
        )}
        {working && (
          <span className="flex items-center gap-2">
            <VersionStatus status={working.status} /> v{working.version} · based on v{working.basedOnVersion}
          </span>
        )}
        {!working && <span className="text-muted-foreground">No open draft. Editing any section creates one.</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {working?.status === "draft" && (
          <>
            <Button variant="outline" size="sm" className="rounded-none" onClick={() => notify(discard(), `Draft v${working.version} discarded`)}>Discard draft</Button>
            <Button size="sm" className="rounded-none" onClick={() => notify(submit(), `v${working.version} submitted for review`)}>Submit for review</Button>
          </>
        )}
        {working?.status === "in_review" && (
          <>
            <Button variant="outline" size="sm" className="rounded-none" onClick={() => notify(returnToDraft(), `v${working.version} returned to draft`)}>Return to draft</Button>
            <Button
              size="sm"
              className="rounded-none bg-oxblood hover:bg-oxblood/90"
              onClick={() => notify(approve(), `v${working.version} approved. New Studio requests now use it.`)}
              aria-describedby="approve-note"
            >
              Approve v{working.version} (simulated)
            </Button>
            <span id="approve-note" className="sr-only">Demo only: simulates an authorised creative director approving this version.</span>
          </>
        )}
      </div>
    </div>
  );
}
