"use client";
import { useMemo, useState } from "react";
import { Check, Minus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { evaluateConcept } from "@/lib/brand/intelligence";
import { useApprovedVersion, useBrandStore } from "@/lib/store/brand-store";
import { useStudioStore } from "@/lib/store/studio-store";
import type { Concept, ConceptVersion } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

/** Rule checks for the viewed version against the Brand DNA used to generate it, or the current approved one. */
export function BrandPanel({ concept, version }: { concept: Concept; version: ConceptVersion }) {
  const used = useBrandStore((s) => s.versions.find((v) => v.version === version.brandProfileVersion));
  const approved = useApprovedVersion();
  const [against, setAgainst] = useState<"used" | "approved">(used ? "used" : "approved");
  const profile = against === "used" && used ? used : approved;
  const exceptions = useStudioStore((s) => s.exceptions);
  const { addException, removeException } = useStudioStore.getState();
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const result = useMemo(() => (profile ? evaluateConcept({ ...concept, ...version.snapshot }, profile.content) : null), [concept, version.snapshot, profile]);
  if (!profile || !result) return <p className="t-body text-muted-foreground">No approved Brand DNA version to evaluate against.</p>;

  const enforceable = result.checks.filter((c) => c.result !== "not_evaluated" || c.reason.startsWith("No construction"));
  const guidance = result.checks.filter((c) => !enforceable.includes(c));
  const exceptionFor = (ruleId: string) => exceptions.find((e) => e.versionId === version.id && e.ruleId === ruleId && e.brandProfileVersion === profile.version);

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Evaluate against" className="grid grid-cols-2 border border-hairline text-[12px]">
        {used && (
          <button role="radio" aria-checked={against === "used"} onClick={() => setAgainst("used")} className={cn("h-8", against === "used" ? "bg-ink text-paper" : "hover:bg-card")}>Used: v{used.version}</button>
        )}
        <button role="radio" aria-checked={against === "approved" || !used} onClick={() => setAgainst("approved")} className={cn("h-8", (against === "approved" || !used) ? "bg-ink text-paper" : "hover:bg-card", !used && "col-span-2")}>Current approved: v{approved?.version}</button>
      </div>
      <div className="flex items-baseline justify-between">
        <p className="t-meta">Alignment · v{version.number} vs Brand DNA v{profile.version}</p>
        <p className="font-display text-3xl">{result.score === null ? "—" : `${result.score}%`}</p>
      </div>
      <p className="text-[12px] text-muted-foreground">
        Rule-based checks on recorded attributes, recalculated for this version. Not a visual or machine-learning similarity score. The original concept and its Brand DNA version are never changed.
      </p>

      <section aria-label="Evaluated rules">
        <p className="t-meta mb-1">Enforceable rules ({enforceable.length})</p>
        <ul className="divide-y divide-hairline border-y border-hairline">
          {enforceable.map((c) => {
            const exc = exceptionFor(c.ruleId);
            const Icon = c.result === "pass" ? Check : c.result === "fail" ? X : Minus;
            return (
              <li key={c.ruleId} className="space-y-1.5 py-2 text-[12px]">
                <p className="flex gap-2">
                  <Icon aria-label={c.result} className={cn("mt-0.5 size-3.5 shrink-0", c.result === "fail" && !exc && "text-oxblood")} />
                  <span><span className="font-medium">{c.title}</span> <span className="t-meta text-[9px]">{c.priority}</span><span className="block text-muted-foreground">{c.reason}</span></span>
                </p>
                {c.result === "fail" && (exc ? (
                  <p className="ml-5 border-l-2 border-hairline pl-2">
                    Exception recorded: “{exc.reason}” <button className="underline" onClick={() => removeException(exc.id)}>Remove</button>
                  </p>
                ) : reasonFor === c.ruleId ? (
                  <div className="ml-5 flex gap-1.5">
                    <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for overriding this rule" aria-label="Exception reason" className="h-7 min-w-0 flex-1 border border-hairline bg-card px-2" />
                    <Button size="xs" className="rounded-none" onClick={() => {
                      const r = addException({ conceptId: concept.id, versionId: version.id, ruleId: c.ruleId, brandProfileVersion: profile.version, reason });
                      if (r.ok) { setReasonFor(null); setReason(""); toast.success("Exception documented. The brand profile is unchanged."); } else toast.error(r.error);
                    }}>Save</Button>
                  </div>
                ) : (
                  <button className="ml-5 underline" onClick={() => { setReasonFor(c.ruleId); setReason(""); }}>Document an exception</button>
                ))}
              </li>
            );
          })}
        </ul>
      </section>
      {guidance.length > 0 && (
        <section aria-label="Guidance rules">
          <p className="t-meta mb-1">Contextual guidance — not evaluated ({guidance.length})</p>
          <ul className="space-y-1 text-[12px] text-muted-foreground">{guidance.map((g) => <li key={g.ruleId}>— {g.title}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
