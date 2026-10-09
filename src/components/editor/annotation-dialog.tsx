"use client";
import { useState } from "react";
import { toast } from "sonner";
import { ChipRadioGroup } from "@/components/studio/controls";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useStudioStore } from "@/lib/store/studio-store";
import type { AnnotationCategory, DesignAnnotation } from "@/lib/types/domain";

export const ANNOTATION_CATEGORIES: AnnotationCategory[] = ["fit", "construction", "material", "colour", "detail", "general"];

/** Create (with point) or edit (with annotation). Position is editable as % for keyboard users. */
export function AnnotationDialog({
  conceptId,
  versionId,
  side,
  point,
  annotation,
  onClose,
}: {
  conceptId: string;
  versionId: string;
  side: "front" | "back";
  point?: { x: number; y: number };
  annotation?: DesignAnnotation;
  onClose: () => void;
}) {
  const { addAnnotation, updateAnnotation, deleteAnnotation } = useStudioStore.getState();
  const [text, setText] = useState(annotation?.text ?? "");
  const [category, setCategory] = useState<AnnotationCategory>(annotation?.category ?? "fit");
  const [pos, setPos] = useState({ x: Math.round((annotation?.x ?? point?.x ?? 0.5) * 100), y: Math.round((annotation?.y ?? point?.y ?? 0.5) * 100) });

  const save = () => {
    const xy = { x: pos.x / 100, y: pos.y / 100 };
    if (annotation) {
      updateAnnotation(annotation.id, { text: text.trim(), category, ...xy });
      onClose();
      return;
    }
    const res = addAnnotation({ conceptId, versionId, text, category, view: side, ...xy });
    if (res.ok) onClose();
    else toast.error(res.error);
  };

  const num = "h-8 w-20 border border-hairline bg-card px-2 font-mono text-[12px]";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-none sm:max-w-md">
        <DialogTitle className="font-display text-2xl font-normal">{annotation ? "Edit annotation" : "New annotation"}</DialogTitle>
        <DialogDescription>Pinned to this version ({side} view). Position is stored relative to the garment, so it holds at any zoom or screen size.</DialogDescription>
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="t-meta">Comment</span>
            <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="e.g. Reduce shoulder width" className="w-full border border-hairline bg-card px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <fieldset>
            <legend className="t-meta mb-2">Category</legend>
            <ChipRadioGroup name="annotation-category" value={category} options={ANNOTATION_CATEGORIES.map((c) => ({ value: c, label: c }))} onChange={setCategory} />
          </fieldset>
          <fieldset className="flex items-end gap-3">
            <legend className="t-meta mb-2">Position (% from top-left)</legend>
            <label className="text-[12px]">X <input type="number" min={0} max={100} value={pos.x} onChange={(e) => setPos({ ...pos, x: Math.min(100, Math.max(0, Number(e.target.value))) })} className={num} /></label>
            <label className="text-[12px]">Y <input type="number" min={0} max={100} value={pos.y} onChange={(e) => setPos({ ...pos, y: Math.min(100, Math.max(0, Number(e.target.value))) })} className={num} /></label>
          </fieldset>
          <div className="flex justify-between gap-2 pt-1">
            {annotation ? (
              <Button variant="ghost" className="rounded-none text-destructive" onClick={() => { deleteAnnotation(annotation.id); onClose(); }}>Delete</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-none" onClick={onClose}>Cancel</Button>
              <Button className="rounded-none" disabled={!text.trim()} onClick={save}>{annotation ? "Save" : "Add annotation"}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
