"use client";
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useBrandStore } from "@/lib/store/brand-store";
import { approvedVersion, workingVersion } from "@/lib/brand/versioning";
import type { BrandDNA, BrandProfileVersion } from "@/lib/types/brand";
import { cn } from "@/lib/utils";

/** The version the editor shows: open draft/review if any, else the approved snapshot. */
export function useEditable(): { version: BrandProfileVersion; content: BrandDNA; locked: boolean } {
  const version = useBrandStore((s) => workingVersion(s.versions) ?? approvedVersion(s.versions) ?? s.versions[s.versions.length - 1]);
  return { version, content: version.content, locked: version.status === "in_review" };
}

/**
 * Local form state for one section. Save commits to the draft (creating one
 * from the approved version if needed); Reset restores the last saved values.
 */
export function useSectionForm<T>(select: (c: BrandDNA) => T, apply: (c: BrandDNA, v: T) => BrandDNA, label: string) {
  const { content, locked, version } = useEditable();
  const saved = select(content);
  const savedKey = JSON.stringify(saved);
  const [value, setValue] = useState<T>(saved);
  useEffect(() => setValue(JSON.parse(savedKey)), [savedKey]);
  const dirty = JSON.stringify(value) !== savedKey;
  const edit = useBrandStore((s) => s.edit);
  const save = () => {
    const res = edit(label, (c) => apply(c, value));
    if (res.ok) toast.success(version.status === "approved" ? `Saved to a new draft. Approved v${version.version} is unchanged.` : `${label} saved to draft`);
    else toast.error(res.error);
  };
  return { value, setValue, dirty, locked, save, reset: () => setValue(JSON.parse(savedKey)) };
}

export function SaveBar({ dirty, locked, onSave, onReset }: { dirty: boolean; locked: boolean; onSave: () => void; onReset: () => void }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-2 border-t border-hairline bg-paper/95 px-1 py-3">
      {locked && <p className="mr-auto text-[12px] text-muted-foreground">Locked while in review. Return to draft to edit.</p>}
      {!locked && dirty && <p className="mr-auto text-[12px] text-oxblood">Unsaved changes</p>}
      <Button variant="outline" size="sm" className="rounded-none" disabled={!dirty} onClick={onReset}>Reset</Button>
      <Button size="sm" className="rounded-none" disabled={!dirty || locked} onClick={onSave}>Save to draft</Button>
    </div>
  );
}

export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6 space-y-1">
      <h2 className="t-title">{title}</h2>
      <p className="t-body max-w-2xl text-muted-foreground">{description}</p>
    </div>
  );
}

export function TextField({ label, value, onChange, multiline, disabled }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; disabled?: boolean }) {
  const cls = "w-full border border-hairline bg-card px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
  return (
    <label className="block space-y-1.5">
      <span className="t-meta">{label}</span>
      {multiline ? (
        <textarea value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} rows={3} className={cn(cls, "resize-y leading-relaxed")} />
      ) : (
        <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={cn(cls, "h-9")} />
      )}
    </label>
  );
}

/** Free-text list editor: Enter or comma adds, Backspace on empty removes last. */
export function TagInput({ label, values, onChange, disabled, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; disabled?: boolean; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
    else if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
  };
  return (
    <div className="space-y-1.5">
      <span className="t-meta block">{label}</span>
      <div className={cn("flex min-h-9 flex-wrap items-center gap-1.5 border border-hairline bg-card px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring", disabled && "opacity-60")}>
        {values.map((v) => (
          <span key={v} className="inline-flex h-6 items-center gap-1 border border-hairline bg-paper px-2 text-[12px]">
            {v}
            {!disabled && (
              <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} className="text-stone hover:text-ink">
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        <input
          value={draft}
          disabled={disabled}
          aria-label={`Add to ${label}`}
          placeholder={values.length ? "" : placeholder ?? "Type and press Enter"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={add}
          className="min-w-24 flex-1 bg-transparent text-[13px] outline-none"
        />
      </div>
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("border border-hairline bg-card p-5", className)}>{children}</div>;
}
