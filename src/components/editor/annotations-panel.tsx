"use client";
import { useState } from "react";
import { Check, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorSession } from "@/lib/store/editor-session";
import { useStudioStore } from "@/lib/store/studio-store";
import type { ConceptVersion, DesignAnnotation } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { AnnotationDialog } from "./annotation-dialog";

export function AnnotationsPanel({ version }: { version: ConceptVersion }) {
  const all = useStudioStore((s) => s.annotations);
  const update = useStudioStore((s) => s.updateAnnotation);
  const { selectedAnnotationId, set } = useEditorSession();
  const [editing, setEditing] = useState<DesignAnnotation | null>(null);
  const list = all.filter((a) => a.versionId === version.id);
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted-foreground">Annotations belong to v{version.number}. Turn on Annotate and click the garment, or use “Add pin at centre” and arrow keys.</p>
      <ol className="divide-y divide-hairline border-y border-hairline">
        {list.map((a, i) => (
          <li key={a.id} className={cn("flex gap-2 py-2 text-[12px]", selectedAnnotationId === a.id && "bg-card")}>
            <button className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[10px]", a.resolved ? "border border-hairline text-stone" : "bg-oxblood text-paper")} onClick={() => set({ selectedAnnotationId: a.id, side: a.view })} aria-label={`Select annotation ${i + 1}`}>
              {list.filter((x) => x.view === a.view).indexOf(a) + 1}
            </button>
            <div className={cn("min-w-0 flex-1", a.resolved && "text-muted-foreground line-through")}>
              {a.text}
              <span className="t-meta block text-[9px]">{a.category} · {a.view} · {Math.round(a.x * 100)}%, {Math.round(a.y * 100)}%</span>
            </div>
            <Button size="icon-xs" variant="ghost" aria-label={a.resolved ? "Reopen annotation" : "Resolve annotation"} onClick={() => update(a.id, { resolved: !a.resolved })}>{a.resolved ? <RotateCcw /> : <Check />}</Button>
            <Button size="icon-xs" variant="ghost" aria-label="Edit annotation" onClick={() => setEditing(a)}><Pencil /></Button>
          </li>
        ))}
        {!list.length && <li className="py-3 text-[12px] text-muted-foreground">No annotations on this version.</li>}
      </ol>
      {editing && <AnnotationDialog conceptId={editing.conceptId} versionId={editing.versionId} side={editing.view} annotation={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
