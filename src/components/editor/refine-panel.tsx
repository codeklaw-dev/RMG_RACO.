"use client";
import { useMemo, useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyEdit, parseInstruction } from "@/lib/services/demo-edit";
import { useEditorSession } from "@/lib/store/editor-session";
import type { Concept, ConceptVersion } from "@/lib/types/domain";
import { useEditJob } from "./use-edit-job";

const EXAMPLES = [
  "Make the shoulders more structured",
  "Change the primary colour to oxblood",
  "Use linen instead of wool",
  "Simplify the fastening details",
  "Create a more relaxed version",
];

export function RefinePanel({ concept, version }: { concept: Concept; version: ConceptVersion }) {
  const [text, setText] = useState("");
  const { set, draftSource } = useEditorSession();
  const { job, running, run, cancel } = useEditJob();
  const [error, setError] = useState<string | null>(null);
  const isHead = version.id === concept.currentVersionId;
  const locked = concept.status === "approved" || concept.status === "archived";
  const parsed = useMemo(() => (text.trim().length > 2 ? parseInstruction(text, version.snapshot) : null), [text, version.snapshot]);
  const previewing = draftSource === "refine";

  const preview = () => parsed?.changes.length && set({ draft: applyEdit(version.snapshot, parsed.changes, text), draftSource: "refine", compare: false });
  const confirm = async () => {
    setError(null);
    const res = await run(concept, text, null, () => {
      set({ draft: null, draftSource: null, viewVersionId: null });
      setText("");
    });
    if (!res.ok) setError(res.error);
  };

  if (locked || !isHead) {
    return <p className="t-body text-muted-foreground">{locked ? "This concept is locked by review status." : "Refinements apply to the current version. Select it in the timeline."}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="t-body text-charcoal">
        Describe a change. The demo recognises silhouettes, materials, named colours and construction details. Anything else is reported, never faked.
      </p>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); if (previewing) set({ draft: null, draftSource: null }); }}
        rows={3}
        aria-label="Refinement request"
        placeholder="e.g. Use linen instead of wool"
        className="w-full border border-hairline bg-card px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" onClick={() => setText(ex)} className="text-[12px] text-charcoal underline decoration-hairline underline-offset-4 hover:text-ink">{ex}</button>
        ))}
      </div>

      {parsed && (
        <div aria-live="polite" className="space-y-2 border-y border-hairline py-3">
          {parsed.changes.length ? (
            <>
              <p className="t-meta">Will change</p>
              <ul className="space-y-1 text-[13px]">
                {parsed.changes.map((c) => <li key={c.attribute}><span className="t-meta mr-2">{c.attribute}</span>{c.from} → <strong className="font-medium">{c.to}</strong></li>)}
              </ul>
            </>
          ) : (
            <p role="alert" className="text-[13px] text-oxblood">Not available in the demo: no supported silhouette, material, colour or construction detail was found{parsed.unsupported.length ? ` (“${parsed.unsupported.join("”, “")}” edits need a real image model)` : ""}. Nothing will be changed.</p>
          )}
          {parsed.changes.length > 0 && parsed.unsupported.length > 0 && (
            <p className="text-[12px] text-muted-foreground">Ignored, not supported in the demo: {parsed.unsupported.join(", ")}.</p>
          )}
        </div>
      )}

      {running ? (
        <div className="space-y-2">
          <div className="h-px bg-hairline"><div className="h-px bg-ink transition-[width]" style={{ width: `${Math.round((job?.progress ?? 0) * 100)}%` }} /></div>
          <p className="t-meta flex justify-between"><span>{job?.stage}</span><span>demonstration progress</span></p>
          <Button variant="outline" size="sm" className="rounded-none" onClick={cancel}>Cancel</Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 rounded-none" disabled={!parsed?.changes.length} onClick={preview}>
            Preview
          </Button>
          <Button className="flex-1 rounded-none" disabled={!parsed?.changes.length} onClick={confirm}>
            {running ? <Loader2 className="animate-spin" /> : <Wand2 />} Confirm as new version
          </Button>
        </div>
      )}
      {previewing && <p className="text-[12px] text-oxblood">Showing an unsaved preview on the canvas.</p>}
      {error && <p role="alert" className="text-[12px] text-destructive">{error}</p>}
    </div>
  );
}
