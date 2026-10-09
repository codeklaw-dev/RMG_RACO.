"use client";
// Local-only reference intake. Files never leave the browser: previews are
// object URLs held in memory; only id/name/size metadata enters the request.
// The demo adapter does not analyse image pixels.
import { useRef, useState, type DragEvent } from "react";
import { ImagePlus, X } from "lucide-react";
import { useStudioSession, type LocalReference } from "@/lib/store/studio-session";
import { cn } from "@/lib/utils";

export const REFERENCE_LIMITS = {
  maxFiles: 6,
  maxBytes: 8 * 1024 * 1024,
  types: ["image/jpeg", "image/png", "image/webp"],
};

export function validateReference(file: { type: string; size: number }): string | null {
  if (!REFERENCE_LIMITS.types.includes(file.type)) return "Only JPEG, PNG or WebP images";
  if (file.size > REFERENCE_LIMITS.maxBytes) return "Images must be 8 MB or smaller";
  return null;
}

export function ReferenceDropzone() {
  const references = useStudioSession((s) => s.references);
  const addReferences = useStudioSession((s) => s.addReferences);
  const removeReference = useStudioSession((s) => s.removeReference);
  const [rights, setRights] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const accept = (files: FileList | null) => {
    if (!files?.length) return;
    const errs: string[] = [];
    const room = REFERENCE_LIMITS.maxFiles - references.length;
    const next: LocalReference[] = [];
    for (const file of Array.from(files)) {
      const err = validateReference(file);
      if (err) errs.push(`${file.name}: ${err}`);
      else if (next.length >= room) errs.push(`${file.name}: limit of ${REFERENCE_LIMITS.maxFiles} references`);
      else
        next.push({
          id: `ref_${Date.now().toString(36)}_${next.length}`,
          name: file.name,
          size: file.size,
          type: file.type,
          previewUrl: URL.createObjectURL(file),
          status: "ready",
          rightsConfirmed: rights,
        });
    }
    setErrors(errs);
    if (next.length) addReferences(next);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (rights) accept(e.dataTransfer.files);
    else setErrors(["Confirm usage rights before adding references"]);
  };

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2 text-[12px] text-charcoal">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 accent-ink" />
        <span>I own or am licensed to use these images for design reference.</span>
      </label>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn("border border-dashed border-hairline p-3 transition-colors", dragging && "border-ink bg-card", !rights && "opacity-60")}
      >
        <button
          type="button"
          disabled={!rights || references.length >= REFERENCE_LIMITS.maxFiles}
          onClick={() => input.current?.click()}
          className="flex w-full items-center justify-center gap-2 py-2 text-[12px] text-charcoal outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
        >
          <ImagePlus className="size-4" strokeWidth={1.5} aria-hidden />
          Drop images or browse
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={REFERENCE_LIMITS.types.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-label="Add reference images"
          onChange={(e) => { accept(e.target.files); e.target.value = ""; }}
        />
        {references.length > 0 && (
          <ul className="mt-3 grid grid-cols-3 gap-1.5">
            {references.map((r) => (
              <li key={r.id} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                <img src={r.previewUrl} alt={r.name} className="aspect-square w-full object-cover" />
                <span className="t-meta absolute inset-x-0 bottom-0 truncate bg-paper/85 px-1 text-[8px]">Local · ready</span>
                <button
                  type="button"
                  onClick={() => removeReference(r.id)}
                  aria-label={`Remove ${r.name}`}
                  className="absolute right-0.5 top-0.5 grid size-5 place-items-center bg-paper/90 text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="t-meta normal-case tracking-normal">
        JPEG, PNG or WebP · up to 8 MB · max {REFERENCE_LIMITS.maxFiles}. Kept in this browser tab only and attached as metadata; the demo does not analyse image content.
      </p>
      {errors.length > 0 && (
        <ul role="alert" className="space-y-0.5 text-[12px] text-destructive">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
    </div>
  );
}
