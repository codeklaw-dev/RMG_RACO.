"use client";
import { useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { GarmentPlaceholder } from "@/components/shared/garment-placeholder";
import { Button } from "@/components/ui/button";
import { isHex, normalizeHex } from "@/lib/brand/intelligence";
import type { BrandColour } from "@/lib/types/brand";
import type { GarmentCategory } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { SaveBar, SectionHeader, useEditable, useSectionForm } from "./shared";

/** Returns an error message per colour id (invalid hex, duplicates, empty names). */
export function validatePalette(palette: BrandColour[]): Record<string, string> {
  const errors: Record<string, string> = {};
  palette.forEach((c, i) => {
    if (!c.name.trim()) errors[c.id] = "Name required";
    else if (!isHex(c.hex)) errors[c.id] = "Use a 6-digit hex, e.g. #8C2F37";
    else if (palette.findIndex((d) => d.hex.toUpperCase() === c.hex.toUpperCase()) !== i) errors[c.id] = "Duplicate colour";
    else if (palette.findIndex((d) => d.name.trim().toLowerCase() === c.name.trim().toLowerCase()) !== i) errors[c.id] = "Duplicate name";
  });
  return errors;
}

export function ColourSection() {
  const f = useSectionForm((c) => c.palette, (c, palette) => ({ ...c, palette: palette.map((p) => ({ ...p, hex: normalizeHex(p.hex), name: p.name.trim() })) }), "Palette");
  const { content } = useEditable();
  const [newHex, setNewHex] = useState("#");
  const [newName, setNewName] = useState("");
  const errors = validatePalette(f.value);
  const d = f.locked;
  const update = (id: string, patch: Partial<BrandColour>) => f.setValue(f.value.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const candidate: BrandColour = { id: "new", name: newName, hex: normalizeHex(newHex), role: "secondary", signature: false };
  const addError = newHex === "#" && !newName ? null : validatePalette([...f.value, candidate])["new"] ?? null;

  const add = () => {
    if (addError || newHex === "#") return;
    f.setValue([...f.value, { ...candidate, id: `c_${Date.now().toString(36)}` }]);
    setNewHex("#");
    setNewName("");
  };

  const primary = f.value.filter((c) => c.role === "primary" && !errors[c.id]);
  const secondary = f.value.filter((c) => c.role === "secondary" && !errors[c.id]);
  const categories: GarmentCategory[] = content.identity.categories.length ? content.identity.categories : ["outerwear"];
  const combos = primary.flatMap((p) => secondary.map((s) => [p, s] as const)).slice(0, 4);

  return (
    <div>
      <SectionHeader title="Colour intelligence" description="Brand mode stays inside this palette. Hybrid anchors on signature colours and explores around them. Explore ignores it." />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <ul className="divide-y divide-hairline border-y border-hairline">
            {f.value.map((c) => (
              <li key={c.id} className="grid grid-cols-2 gap-2 py-3 sm:grid-cols-[40px_minmax(0,1fr)_120px_110px_auto] sm:gap-3">
                <div className="col-span-2 flex gap-3 sm:contents">
                <label className="relative block size-10 shrink-0 cursor-pointer border border-black/10" style={{ background: isHex(c.hex) ? c.hex : "transparent" }}>
                  <span className="sr-only">Pick colour for {c.name}</span>
                  <input type="color" disabled={d} value={isHex(c.hex) ? c.hex : "#000000"} onChange={(e) => update(c.id, { hex: e.target.value.toUpperCase() })} className="absolute inset-0 opacity-0" />
                </label>
                <div className="min-w-0 flex-1">
                  <input aria-label="Colour name" disabled={d} value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} className="h-8 w-full border border-hairline bg-card px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  {errors[c.id] && <p role="alert" className="mt-1 text-[12px] text-destructive">{errors[c.id]}</p>}
                </div>
                </div>
                <input aria-label={`Hex for ${c.name}`} disabled={d} value={c.hex} onChange={(e) => update(c.id, { hex: e.target.value.toUpperCase() })} className={cn("h-8 border border-hairline bg-card px-2 font-mono text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring", errors[c.id] && "border-destructive")} />
                <select aria-label={`Role for ${c.name}`} disabled={d} value={c.role} onChange={(e) => update(c.id, { role: e.target.value as BrandColour["role"] })} className="h-8 border border-hairline bg-card px-2 text-[13px]">
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                </select>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon-sm" className="rounded-none" disabled={d} aria-pressed={c.signature} aria-label={`Signature colour: ${c.name}`} onClick={() => update(c.id, { signature: !c.signature })}>
                    <Star className={cn(c.signature && "fill-oxblood text-oxblood")} />
                  </Button>
                  <Button variant="outline" size="icon-sm" className="rounded-none" disabled={d} aria-label={`Remove ${c.name}`} onClick={() => f.setValue(f.value.filter((x) => x.id !== c.id))}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => { e.preventDefault(); add(); }}
            className="mt-4 flex flex-wrap items-start gap-2"
            aria-label="Add colour"
          >
            <input aria-label="New colour name" disabled={d} placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 w-40 border border-hairline bg-card px-2 text-[13px]" />
            <input aria-label="New colour hex" disabled={d} placeholder="#RRGGBB" value={newHex} onChange={(e) => setNewHex(e.target.value.toUpperCase())} className="h-8 w-28 border border-hairline bg-card px-2 font-mono text-[12px]" />
            <Button type="submit" size="sm" variant="outline" className="h-8 rounded-none" disabled={d || Boolean(addError) || newHex === "#"}><Plus /> Add colour</Button>
            {addError && <p role="alert" className="w-full text-[12px] text-destructive">{addError}</p>}
          </form>
        </div>
        <div>
          <p className="t-meta mb-3">Combination preview</p>
          {combos.length ? (
            <div className="grid grid-cols-2 gap-2">
              {combos.map(([a, b], i) => (
                <figure key={a.id + b.id}>
                  <GarmentPlaceholder category={categories[i % categories.length]} palette={[a, b]} seed={i} className="aspect-[3/4]" />
                  <figcaption className="t-meta mt-1 text-[9px]">{a.name} / {b.name}</figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="t-body text-muted-foreground">Add at least one primary and one secondary colour to preview combinations.</p>
          )}
        </div>
      </div>
      <SaveBar dirty={f.dirty} locked={f.locked || Object.keys(errors).length > 0} onSave={f.save} onReset={f.reset} />
    </div>
  );
}
