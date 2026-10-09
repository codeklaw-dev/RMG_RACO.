"use client";
import { useId, useState, type FormEvent } from "react";
import { Dices, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BRAND_PROFILE, ORG } from "@/lib/fixtures";
import { EXPLORE_PALETTES } from "@/lib/services/demo-engine";
import { MODE_COPY, buildGenerateRequest } from "@/lib/studio/brief";
import { useStudioSession } from "@/lib/store/studio-session";
import { useStudioStore } from "@/lib/store/studio-store";
import type { DesignMode, GarmentCategory, Material, Silhouette } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { ChipCheckboxGroup, ChipRadioGroup, Field, Swatch } from "./controls";
import { ReferenceDropzone } from "./reference-dropzone";
import { newIdempotencyKey, type useJobRunner } from "./use-job-runner";

const CATEGORY_OPTIONS: { value: GarmentCategory; label: string }[] = [
  { value: "tailoring", label: "Blazer" },
  { value: "dress", label: "Dress" },
  { value: "shirt", label: "Shirt" },
  { value: "trousers", label: "Trousers" },
  { value: "jacket", label: "Jacket" },
  { value: "skirt", label: "Skirt" },
  { value: "knitwear", label: "Knitwear" },
  { value: "outerwear", label: "Outerwear" },
];

const SILHOUETTE_OPTIONS: { value: Silhouette; label: string }[] = (
  ["tailored", "oversized", "relaxed", "structured", "fitted", "draped"] as const
).map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));

const MATERIAL_OPTIONS: { value: Material; label: string }[] = [
  { value: "cotton", label: "Cotton" },
  { value: "wool", label: "Wool" },
  { value: "linen", label: "Linen" },
  { value: "silk", label: "Silk" },
  { value: "denim", label: "Denim" },
  { value: "technical", label: "Technical" },
];

const EXTRA_SWATCHES = EXPLORE_PALETTES.map((p) => p[0]).filter((c) => !BRAND_PROFILE.palette.some((b) => b.hex === c.hex));

export const EXAMPLE_BRIEFS = [
  {
    label: "Oversized blazer",
    prompt:
      "Design a contemporary women's oversized blazer inspired by understated Japanese tailoring, in lightweight charcoal wool with architectural shoulders and a minimalist finish.",
    patch: { category: "tailoring", silhouette: "oversized", materials: ["wool"] },
  },
  {
    label: "Autumn outerwear",
    prompt: "Contemporary womenswear outerwear for an autumn capsule. Architectural shoulders, refined drape, neutral stone and espresso palette, no logos.",
    patch: { category: "outerwear", silhouette: "structured", materials: ["wool"] },
  },
  {
    label: "Resort shirt",
    prompt: "Relaxed resort shirt with a sculptural balloon sleeve in matte cotton poplin. Preserve a clean placket and straight hem.",
    patch: { category: "shirt", silhouette: "relaxed", materials: ["cotton", "linen"] },
  },
] as const;

type Runner = ReturnType<typeof useJobRunner>;

export function BriefPanel({ runner, onSubmitted }: { runner: Runner; onSubmitted?: () => void }) {
  const brief = useStudioSession((s) => s.brief);
  const setBrief = useStudioSession((s) => s.setBrief);
  const setMode = useStudioSession((s) => s.setMode);
  const clearVariation = useStudioSession((s) => s.clearVariation);
  const collections = useStudioStore((s) => s.collections);
  const source = useStudioStore((s) => s.concepts.find((c) => c.id === brief.variationOf));
  const [issues, setIssues] = useState<string[]>([]);
  const busy = Boolean(runner.activeJobId);
  const promptId = useId();

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const request = buildGenerateRequest(brief, { orgId: ORG.id, brand: BRAND_PROFILE, idempotencyKey: newIdempotencyKey() });
    const res = await runner.submit(request);
    setIssues(res.ok ? [] : res.issues);
    if (res.ok) onSubmitted?.();
  };

  const brandOnly = brief.mode === "brand";
  const togglePalette = (hex: string) =>
    setBrief({ palette: brief.palette.includes(hex) ? brief.palette.filter((h) => h !== hex) : [...brief.palette, hex].slice(0, 4) });

  return (
    <form onSubmit={submit} className="flex h-full flex-col" aria-label="Design brief">
      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        {source && (
          <div className="flex items-start justify-between gap-2 border-l-2 border-oxblood bg-oxblood-soft/60 px-3 py-2">
            <p className="text-[12px]">
              <span className="t-meta block text-oxblood">Variation of</span>
              {source.title}
            </p>
            <button type="button" onClick={clearVariation} aria-label="Stop variation" className="text-charcoal hover:text-ink">
              <X className="size-3.5" />
            </button>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor={promptId} className="t-meta flex justify-between">
            <span>Design brief</span>
            <span className="normal-case tracking-normal">{brief.prompt.length}/2000</span>
          </label>
          <Textarea
            id={promptId}
            value={brief.prompt}
            maxLength={2000}
            onChange={(e) => setBrief({ prompt: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
            }}
            placeholder="Describe the garment, its mood, construction and intended wearer…"
            className="min-h-28 resize-y rounded-none border-hairline bg-card text-[13px] leading-relaxed"
          />
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <span className="t-meta">Try</span>
            {EXAMPLE_BRIEFS.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => setBrief({ prompt: ex.prompt, ...(ex.patch as object) })}
                className="text-[12px] text-charcoal underline decoration-hairline underline-offset-4 hover:text-ink hover:decoration-ink"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        <Field label="Mode">
          <div role="radiogroup" aria-label="Generation mode" className="grid grid-cols-3 border border-hairline">
            {(Object.keys(MODE_COPY) as DesignMode[]).map((m) => (
              <label key={m} className="relative">
                <input type="radio" name="mode" value={m} checked={brief.mode === m} onChange={() => setMode(m)} className="peer sr-only" />
                <span className="flex h-8 cursor-pointer items-center justify-center text-[12px] text-charcoal transition-colors peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:ring-2 peer-focus-visible:ring-inset peer-focus-visible:ring-ring">
                  {MODE_COPY[m].label}
                </span>
              </label>
            ))}
          </div>
          <p className="text-[12px] text-muted-foreground">
            {MODE_COPY[brief.mode].hint}
            {brief.mode !== "explore" && ` · ${BRAND_PROFILE.name} profile v${BRAND_PROFILE.version} (placeholder)`}
          </p>
        </Field>

        <Field label="Garment">
          <ChipRadioGroup name="category" value={brief.category} options={CATEGORY_OPTIONS} onChange={(category) => setBrief({ category })} />
        </Field>

        <Field label="Silhouette">
          <ChipRadioGroup name="silhouette" value={brief.silhouette} options={SILHOUETTE_OPTIONS} onChange={(silhouette) => setBrief({ silhouette })} />
        </Field>

        <Field label="Material" hint="up to 3">
          <ChipCheckboxGroup values={brief.materials} options={MATERIAL_OPTIONS} max={3} onChange={(materials) => setBrief({ materials })} />
        </Field>

        <Field label="Palette" hint={brief.palette.length ? `${brief.palette.length}/4` : "auto"}>
          <div className="flex flex-wrap gap-2">
            {BRAND_PROFILE.palette.map((c) => (
              <Swatch key={c.hex} hex={c.hex} name={`${c.name} (brand)`} checked={brief.palette.includes(c.hex)} onChange={() => togglePalette(c.hex)} />
            ))}
            <span aria-hidden className="mx-1 w-px self-stretch bg-hairline" />
            {EXTRA_SWATCHES.map((c) => (
              <Swatch key={c.hex} hex={c.hex} name={c.name} disabled={brandOnly} checked={brief.palette.includes(c.hex)} onChange={() => togglePalette(c.hex)} />
            ))}
          </div>
          {brandOnly && <p className="text-[12px] text-muted-foreground">Brand mode limits colours to the approved palette.</p>}
        </Field>

        <Field label="Season / collection">
          <select
            value={brief.targetCollectionId ?? ""}
            onChange={(e) => setBrief({ targetCollectionId: e.target.value || null })}
            className="h-8 w-full border border-hairline bg-card px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Target collection"
          >
            <option value="">No target collection</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>{c.season} · {c.name}</option>
            ))}
          </select>
        </Field>

        <Field label="References">
          <ReferenceDropzone />
        </Field>

        <details className="group border-t border-hairline pt-4">
          <summary className="t-meta cursor-pointer list-none outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="group-open:hidden">+ Advanced</span>
            <span className="hidden group-open:inline">− Advanced</span>
          </summary>
          <div className="mt-4 space-y-5">
            <Field label="Concepts">
              <ChipRadioGroup
                name="count"
                value={String(brief.count) as "2" | "3" | "4"}
                options={["2", "3", "4"].map((v) => ({ value: v as "2" | "3" | "4", label: v }))}
                onChange={(v) => setBrief({ count: Number(v) })}
              />
            </Field>
            <Field label="Creativity" hint={brief.creativity.toFixed(2)}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={brief.creativity}
                onChange={(e) => setBrief({ creativity: Number(e.target.value) })}
                className="w-full accent-ink"
                aria-label="Creativity"
              />
            </Field>
            <Field label="Seed">
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={brief.seed}
                  onChange={(e) => setBrief({ seed: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                  className="h-8 w-full border border-hairline bg-card px-2 font-mono text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Seed"
                />
                <Button type="button" variant="outline" size="icon" aria-label="Random seed" onClick={() => setBrief({ seed: Math.floor(Math.random() * 99999) })}>
                  <Dices />
                </Button>
              </div>
            </Field>
            <label className="flex items-start gap-2 text-[12px] text-charcoal">
              <input type="checkbox" checked={brief.simulateFailure} onChange={(e) => setBrief({ simulateFailure: e.target.checked })} className="mt-0.5 accent-ink" />
              <span>Simulate a failure (demo of error and retry handling)</span>
            </label>
          </div>
        </details>
      </div>

      <div className="space-y-2 border-t border-hairline bg-paper p-5">
        {issues.length > 0 && (
          <ul role="alert" className="space-y-0.5 text-[12px] text-destructive">
            {issues.map((i) => <li key={i}>{i}</li>)}
          </ul>
        )}
        <Button type="submit" size="lg" disabled={busy} className={cn("h-10 w-full rounded-none")}>
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {busy ? "Generating…" : brief.variationOf ? "Generate variation" : "Generate concepts"}
        </Button>
        <p className="t-meta text-center normal-case tracking-normal">Simulated output · ⌘↵ to generate</p>
      </div>
    </form>
  );
}
