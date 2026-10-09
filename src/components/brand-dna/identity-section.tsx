"use client";
import { ChipCheckboxGroup } from "@/components/studio/controls";
import { GARMENT_CATEGORIES, type GarmentCategory } from "@/lib/types/domain";
import type { BrandDNA } from "@/lib/types/brand";
import { SaveBar, SectionHeader, TagInput, TextField, useSectionForm } from "./shared";

type Form = Pick<BrandDNA, "name" | "description" | "positioning"> & Omit<BrandDNA["identity"], "silhouettes">;

const LABEL: Record<GarmentCategory, string> = {
  tailoring: "Blazer / tailoring", dress: "Dress", shirt: "Shirt", trousers: "Trousers", jacket: "Jacket", skirt: "Skirt", knitwear: "Knitwear", outerwear: "Outerwear",
};

export function IdentitySection() {
  const f = useSectionForm<Form>(
    (c) => ({ name: c.name, description: c.description, positioning: c.positioning, ...(({ silhouettes, ...rest }) => (void silhouettes, rest))(c.identity) }),
    (c, v) => {
      const { name, description, positioning, ...identity } = v;
      return { ...c, name, description, positioning, identity: { ...c.identity, ...identity } };
    },
    "Visual identity",
  );
  const set = <K extends keyof Form>(k: K) => (val: Form[K]) => f.setValue({ ...f.value, [k]: val });
  const d = f.locked;
  return (
    <div>
      <SectionHeader title="Visual identity" description="Who the brand is and what it designs. Used for completeness and as context; only structured rules are evaluated." />
      <div className="grid gap-5 lg:grid-cols-2">
        <TextField label="Brand name" value={f.value.name} onChange={set("name")} disabled={d} />
        <TextField label="Target audience" value={f.value.targetAudience} onChange={set("targetAudience")} disabled={d} />
        <TextField label="Description" value={f.value.description} onChange={set("description")} multiline disabled={d} />
        <TextField label="Positioning" value={f.value.positioning} onChange={set("positioning")} multiline disabled={d} />
        <TextField label="Personality" value={f.value.personality} onChange={set("personality")} multiline disabled={d} />
        <TextField label="Creative direction" value={f.value.creativeDirection} onChange={set("creativeDirection")} multiline disabled={d} />
        <TagInput label="Aesthetic keywords" values={f.value.keywords} onChange={set("keywords")} disabled={d} />
        <TagInput label="Signature design elements" values={f.value.signatureElements} onChange={set("signatureElements")} disabled={d} />
        <TagInput label="Seasonal influences" values={f.value.seasonalInfluences} onChange={set("seasonalInfluences")} disabled={d} />
        <fieldset className="space-y-2" disabled={d}>
          <legend className="t-meta mb-2">Preferred garment categories</legend>
          <ChipCheckboxGroup values={f.value.categories} max={8} options={GARMENT_CATEGORIES.map((v) => ({ value: v, label: LABEL[v] }))} onChange={set("categories")} />
        </fieldset>
      </div>
      <SaveBar dirty={f.dirty} locked={f.locked} onSave={f.save} onReset={f.reset} />
    </div>
  );
}
