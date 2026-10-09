"use client";
import { useRef, useState, type DragEvent } from "react";
import { Check, ImageOff, ImagePlus, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { GarmentPlaceholder } from "@/components/shared/garment-placeholder";
import { validateReference, REFERENCE_LIMITS } from "@/components/studio/reference-dropzone";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ORG } from "@/lib/fixtures";
import { useBrandStore } from "@/lib/store/brand-store";
import { isPlaceholderReference, referenceAvailable, useReferenceFiles } from "@/lib/store/reference-files";
import type { BrandReference, ReferenceCategory } from "@/lib/types/brand";
import { cn } from "@/lib/utils";
import { SectionHeader, TagInput, TextField } from "./shared";

const CATEGORIES: ReferenceCategory[] = ["archive", "moodboard", "sketch", "fabric", "detail"];

function EditDialog({ reference, onClose }: { reference: BrandReference; onClose: () => void }) {
  const update = useBrandStore((s) => s.updateReference);
  const [r, setR] = useState(reference);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-none sm:max-w-lg">
        <DialogTitle className="font-display text-2xl font-normal">Reference details</DialogTitle>
        <DialogDescription>Metadata is saved in this browser. Image files are never uploaded.</DialogDescription>
        <div className="space-y-4">
          <TextField label="Title" value={r.title} onChange={(title) => setR({ ...r, title })} />
          <TextField label="Description" value={r.description} onChange={(description) => setR({ ...r, description })} multiline />
          <TextField label="Source / attribution" value={r.source} onChange={(source) => setR({ ...r, source })} />
          <label className="block space-y-1.5">
            <span className="t-meta">Category</span>
            <select value={r.category} onChange={(e) => setR({ ...r, category: e.target.value as ReferenceCategory })} className="h-9 w-full border border-hairline bg-card px-2 text-[13px]">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <TagInput label="Tags" values={r.tags} onChange={(tags) => setR({ ...r, tags })} />
          <label className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" checked={r.rightsConfirmed} onChange={(e) => setR({ ...r, rightsConfirmed: e.target.checked, approval: e.target.checked ? r.approval : "pending" })} className="mt-1 accent-ink" />
            Usage rights confirmed for design reference
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-none" onClick={onClose}>Cancel</Button>
            <Button className="rounded-none" disabled={!r.title.trim()} onClick={() => { update(r.id, { ...r, title: r.title.trim() }); onClose(); }}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ReferencesSection() {
  const references = useBrandStore((s) => s.references);
  const { addReference, updateReference, removeReference } = useBrandStore.getState();
  const urls = useReferenceFiles((s) => s.urls);
  const { attach, detach } = useReferenceFiles.getState();
  const [rights, setRights] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState<{ category: string; tag: string; approval: string }>({ category: "", tag: "", approval: "" });
  const [editing, setEditing] = useState<BrandReference | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const reattach = useRef<{ id: string } | null>(null);
  const reattachInput = useRef<HTMLInputElement>(null);

  const accept = (files: FileList | null) => {
    if (!files?.length) return;
    if (!rights) return setErrors(["Confirm usage rights before adding references"]);
    const errs: string[] = [];
    Array.from(files).forEach((file, i) => {
      const err = validateReference(file);
      if (err) return errs.push(`${file.name}: ${err}`);
      const id = `bref_${Date.now().toString(36)}_${i}`;
      attach(id, file);
      addReference({
        id, orgId: ORG.id, title: file.name.replace(/\.[^.]+$/, ""), description: "", category: "moodboard", tags: [],
        source: "Uploaded by designer", rightsConfirmed: true, approval: "pending",
        fileName: file.name, fileSize: file.size, fileType: file.type, createdAt: new Date().toISOString(),
      });
    });
    setErrors(errs);
  };

  const onReattach = (files: FileList | null) => {
    const file = files?.[0];
    const target = reattach.current;
    if (!file || !target) return;
    const err = validateReference(file);
    if (err) return toast.error(err);
    attach(target.id, file);
    toast.success("Image re-attached for this session");
  };

  const tags = [...new Set(references.flatMap((r) => r.tags))].sort();
  const shown = references.filter(
    (r) => (!filter.category || r.category === filter.category) && (!filter.tag || r.tags.includes(filter.tag)) && (!filter.approval || r.approval === filter.approval),
  );
  const select = "h-8 border border-hairline bg-card px-2 text-[13px]";

  return (
    <div>
      <SectionHeader
        title="Reference library"
        description="Approved, available references are attached to Brand requests as metadata. Images stay in this browser tab and are not analysed by the demo."
      />
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-[12px] text-charcoal">
            <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 accent-ink" />
            I own or am licensed to use these images for design reference.
          </label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e: DragEvent) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files); }}
            className={cn("grid place-items-center border border-dashed border-hairline px-4 py-10 text-center transition-colors", dragging && "border-ink bg-card", !rights && "opacity-60")}
          >
            <button type="button" disabled={!rights} onClick={() => input.current?.click()} className="flex flex-col items-center gap-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed">
              <ImagePlus className="size-5" strokeWidth={1.5} aria-hidden />
              Drop images or browse
              <span className="t-meta normal-case tracking-normal">JPEG, PNG, WebP · up to 8 MB</span>
            </button>
            <input ref={input} type="file" multiple accept={REFERENCE_LIMITS.types.join(",")} className="sr-only" tabIndex={-1} aria-label="Add brand references" onChange={(e) => { accept(e.target.files); e.target.value = ""; }} />
          </div>
          {errors.length > 0 && <ul role="alert" className="text-[12px] text-destructive">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          <div className="space-y-2 border-t border-hairline pt-3">
            <p className="t-meta">Filter</p>
            <select aria-label="Filter by category" className={cn(select, "w-full")} value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select aria-label="Filter by tag" className={cn(select, "w-full")} value={filter.tag} onChange={(e) => setFilter({ ...filter, tag: e.target.value })}>
              <option value="">All tags</option>
              {tags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select aria-label="Filter by approval" className={cn(select, "w-full")} value={filter.approval} onChange={(e) => setFilter({ ...filter, approval: e.target.value })}>
              <option value="">Any approval</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-4" aria-label="References">
          {shown.map((r) => {
            const available = referenceAvailable(r, urls);
            const url = urls[r.id];
            return (
              <li key={r.id} className="space-y-2">
                <div className="relative">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL
                    <img src={url} alt={r.title} className="aspect-[4/5] w-full object-cover" />
                  ) : isPlaceholderReference(r) ? (
                    <GarmentPlaceholder category={r.tags.includes("dress") ? "dress" : r.tags.includes("shirt") ? "shirt" : "outerwear"} palette={[{ name: "Stone", hex: "#CFC6B8" }]} className="aspect-[4/5]" />
                  ) : (
                    <div className="grid aspect-[4/5] place-items-center bg-paper-2 p-3 text-center">
                      <div className="space-y-2">
                        <ImageOff className="mx-auto size-5 text-stone" aria-hidden />
                        <p className="text-[12px] text-charcoal">Image not available after reload</p>
                        <Button size="xs" variant="outline" className="rounded-none" onClick={() => { reattach.current = { id: r.id }; reattachInput.current?.click(); }}>
                          <Upload /> Re-attach
                        </Button>
                      </div>
                    </div>
                  )}
                  <span className={cn("absolute left-2 top-2 inline-flex h-5 items-center border px-1.5 font-mono text-[9px] uppercase tracking-[0.08em]", r.approval === "approved" ? "border-ink bg-ink text-paper" : "border-hairline bg-paper text-charcoal")}>
                    {r.approval}
                  </span>
                </div>
                <div>
                  <p className="truncate text-[13px] font-medium">{r.title}</p>
                  <p className="t-meta">{r.category}{isPlaceholderReference(r) ? " · demo placeholder" : available ? " · local file" : " · unavailable"}</p>
                  {r.tags.length > 0 && <p className="truncate text-[12px] text-muted-foreground">{r.tags.join(", ")}</p>}
                </div>
                <div className="flex gap-1">
                  {r.approval === "pending" ? (
                    <Button size="xs" variant="outline" className="rounded-none" disabled={!r.rightsConfirmed} title={r.rightsConfirmed ? undefined : "Confirm usage rights first"} onClick={() => updateReference(r.id, { approval: "approved" })}>
                      <Check /> Approve
                    </Button>
                  ) : (
                    <Button size="xs" variant="outline" className="rounded-none" onClick={() => updateReference(r.id, { approval: "pending" })}>Unapprove</Button>
                  )}
                  <Button size="icon-xs" variant="ghost" aria-label={`Edit ${r.title}`} onClick={() => setEditing(r)}><Pencil /></Button>
                  <Button size="icon-xs" variant="ghost" aria-label={`Remove ${r.title}`} onClick={() => { detach(r.id); removeReference(r.id); }}><Trash2 /></Button>
                </div>
              </li>
            );
          })}
          {!shown.length && <li className="t-body col-span-full text-muted-foreground">No references match these filters.</li>}
        </ul>
      </div>
      <input ref={reattachInput} type="file" accept={REFERENCE_LIMITS.types.join(",")} className="sr-only" tabIndex={-1} aria-label="Re-attach image" onChange={(e) => { onReattach(e.target.files); e.target.value = ""; }} />
      {editing && <EditDialog reference={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
