"use client";
import { ChipCheckboxGroup } from "@/components/studio/controls";
import { CONSTRUCTION_DETAILS } from "@/lib/brand/vocabulary";
import { MATERIALS, SILHOUETTES, type Material, type Silhouette } from "@/lib/types/domain";
import type { BrandMaterials } from "@/lib/types/brand";
import { SaveBar, SectionHeader, TextField, useSectionForm } from "./shared";

type Form = BrandMaterials & { silhouettes: Silhouette[] };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const opts = <T extends string>(xs: readonly T[]) => xs.map((v) => ({ value: v, label: cap(v) }));

export function MaterialsSection() {
  const f = useSectionForm<Form>(
    (c) => ({ ...c.materials, silhouettes: c.identity.silhouettes }),
    (c, { silhouettes, ...materials }) => ({ ...c, materials, identity: { ...c.identity, silhouettes } }),
    "Materials & silhouettes",
  );
  const v = f.value;
  const set = (patch: Partial<Form>) => f.setValue({ ...v, ...patch });
  // A material can't be both preferred and restricted: picking one side removes it from the other.
  const setPreferred = (preferred: Material[]) => set({ preferred, restricted: v.restricted.filter((m) => !preferred.includes(m)) });
  const setRestricted = (restricted: Material[]) => set({ restricted, preferred: v.preferred.filter((m) => !restricted.includes(m)) });

  return (
    <div>
      <SectionHeader title="Materials & silhouettes" description="Preferred and restricted materials feed Brand requests directly. Construction details come from the controlled vocabulary the demo engine and checks understand." />
      <fieldset disabled={f.locked} className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="t-meta">Preferred fabrics</p>
          <ChipCheckboxGroup values={v.preferred} options={opts(MATERIALS)} max={6} onChange={setPreferred} />
        </div>
        <div className="space-y-2">
          <p className="t-meta">Restricted fabrics</p>
          <ChipCheckboxGroup values={v.restricted} options={opts(MATERIALS)} max={6} onChange={setRestricted} />
        </div>
        <div className="space-y-2">
          <p className="t-meta">Preferred silhouettes</p>
          <ChipCheckboxGroup values={v.silhouettes} options={opts(SILHOUETTES)} max={6} onChange={(silhouettes) => set({ silhouettes })} />
        </div>
        <div className="space-y-2">
          <p className="t-meta">Signature construction details</p>
          <ChipCheckboxGroup values={v.constructionDetails} options={CONSTRUCTION_DETAILS.map((d) => ({ value: d, label: d }))} max={6} onChange={(constructionDetails) => set({ constructionDetails })} />
        </div>
        <div className="space-y-2">
          <p className="t-meta">Autumn / winter materials</p>
          <ChipCheckboxGroup values={v.seasonal.autumnWinter} options={opts(MATERIALS)} max={6} onChange={(autumnWinter) => set({ seasonal: { ...v.seasonal, autumnWinter } })} />
        </div>
        <div className="space-y-2">
          <p className="t-meta">Spring / summer materials</p>
          <ChipCheckboxGroup values={v.seasonal.springSummer} options={opts(MATERIALS)} max={6} onChange={(springSummer) => set({ seasonal: { ...v.seasonal, springSummer } })} />
        </div>
        <TextField label="Material notes" value={v.notes} onChange={(notes) => set({ notes })} multiline />
        <TextField label="Sustainability preferences (optional)" value={v.sustainability} onChange={(sustainability) => set({ sustainability })} multiline />
      </fieldset>
      <SaveBar dirty={f.dirty} locked={f.locked} onSave={f.save} onReset={f.reset} />
    </div>
  );
}
