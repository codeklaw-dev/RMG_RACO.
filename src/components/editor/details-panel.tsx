"use client";
import { toast } from "sonner";
import { TagInput } from "@/components/brand-dna/shared";
import { ChipCheckboxGroup, ChipRadioGroup } from "@/components/studio/controls";
import { Button } from "@/components/ui/button";
import { CONSTRUCTION_DETAILS } from "@/lib/brand/vocabulary";
import { EDIT_COLOURS } from "@/lib/services/demo-edit";
import { diffSnapshots, RENDERED_ATTRIBUTES } from "@/lib/editor/versions";
import { useEditorSession } from "@/lib/store/editor-session";
import { useStudioStore } from "@/lib/store/studio-store";
import { SILHOUETTES, type Concept, type ConceptSnapshot, type ConceptVersion } from "@/lib/types/domain";

const field = "w-full border border-hairline bg-card px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 py-2 text-[13px]">
      <dt className="t-meta pt-0.5">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function DetailsPanel({ concept, version }: { concept: Concept; version: ConceptVersion }) {
  const { draft, draftSource, set } = useEditorSession();
  const saveRevision = useStudioStore((s) => s.saveRevision);
  const isHead = version.id === concept.currentVersionId;
  const locked = concept.status === "approved" || concept.status === "archived";
  const editing = draftSource === "manual" && draft;
  const snap = editing ? draft : version.snapshot;
  const patch = (p: Partial<ConceptSnapshot>) => draft && set({ draft: { ...draft, ...p } });
  const changes = editing ? diffSnapshots(version.snapshot, draft) : [];
  const metadataOnly = changes.filter((c) => !RENDERED_ATTRIBUTES.includes(c.attribute));

  const save = () => {
    const res = saveRevision(concept.id, draft!);
    if (res.ok) {
      toast.success("Saved as a new version. The previous version is unchanged.");
      set({ draft: null, draftSource: null, viewVersionId: null });
    } else toast.error(res.error);
  };

  if (!editing) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-[28px] leading-tight">{snap.title}</h2>
          <p className="t-body mt-1 text-charcoal">{snap.description}</p>
        </div>
        <dl className="divide-y divide-hairline border-y border-hairline">
          <Row label="Category">{concept.category}</Row>
          <Row label="Silhouette">{snap.silhouette}</Row>
          <Row label="Materials">{snap.fabrics.join(", ")}</Row>
          <Row label="Palette">{snap.palette.map((p) => p.name).join(" / ")}</Row>
          <Row label="Construction">{(snap.details ?? []).join(", ") || "—"}</Row>
          <Row label="Tags">{(snap.tags ?? []).join(", ") || "—"}</Row>
          <Row label="Notes">{snap.notes || "—"}</Row>
          <Row label="Brand DNA">{concept.brandProfileVersion ? `v${concept.brandProfileVersion} (used to generate)` : "None (Explore)"}</Row>
          <Row label="Provenance"><span className="text-muted-foreground">{version.provenance}</span></Row>
        </dl>
        {locked ? (
          <p className="text-[12px] text-muted-foreground">{concept.status === "approved" ? "Approved" : "Archived"} concepts are locked. Create a variation from the timeline to keep developing it.</p>
        ) : (
          <Button className="w-full rounded-none" disabled={!isHead} onClick={() => set({ draft: structuredClone(version.snapshot), draftSource: "manual", compare: false, annotate: false })}>
            {isHead ? "Edit properties" : "Viewing a historical version — restore it to edit"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="t-meta text-oxblood">Editing draft of v{version.number} · preview on canvas</p>
      <label className="block space-y-1"><span className="t-meta">Title</span><input value={snap.title} onChange={(e) => patch({ title: e.target.value })} className={`${field} h-8`} /></label>
      <label className="block space-y-1"><span className="t-meta">Description</span><textarea rows={3} value={snap.description} onChange={(e) => patch({ description: e.target.value })} className={`${field} py-1.5`} /></label>
      <fieldset><legend className="t-meta mb-2">Silhouette</legend>
        <ChipRadioGroup name="edit-silhouette" value={snap.silhouette} options={SILHOUETTES.map((s) => ({ value: s, label: s }))} onChange={(silhouette) => patch({ silhouette })} />
      </fieldset>
      <label className="block space-y-1"><span className="t-meta">Fabric</span><input value={snap.fabrics.join(", ")} onChange={(e) => patch({ fabrics: e.target.value.split(",").map((f) => f.trim()).filter(Boolean) })} className={`${field} h-8`} /></label>
      <div className="grid grid-cols-2 gap-2">
        {[0, 1].map((i) => (
          <label key={i} className="block space-y-1">
            <span className="t-meta">{i ? "Accent colour" : "Primary colour"}</span>
            <select
              value={snap.palette[i]?.name ?? ""}
              onChange={(e) => {
                const c = EDIT_COLOURS.find((x) => x.name === e.target.value);
                const palette = [...snap.palette];
                if (c) palette[i] = { name: c.name, hex: c.hex };
                else palette.splice(i, 1);
                patch({ palette: palette.filter(Boolean) });
              }}
              className={`${field} h-8`}
            >
              {i === 1 && <option value="">None</option>}
              {EDIT_COLOURS.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </label>
        ))}
      </div>
      <fieldset><legend className="t-meta mb-2">Construction details</legend>
        <ChipCheckboxGroup values={snap.details ?? []} options={CONSTRUCTION_DETAILS.map((d) => ({ value: d, label: d }))} max={4} onChange={(details) => patch({ details })} />
      </fieldset>
      <TagInput label="Design tags" values={snap.tags ?? []} onChange={(tags) => patch({ tags })} />
      <label className="block space-y-1"><span className="t-meta">Designer notes</span><textarea rows={3} value={snap.notes ?? ""} onChange={(e) => patch({ notes: e.target.value })} className={`${field} py-1.5`} /></label>

      <div className="border-l-2 border-hairline pl-3 text-[12px] text-muted-foreground">
        Silhouette, colours and construction details redraw the schematic. Title, description, fabric, tags and notes are saved as metadata only — no garment image is regenerated.
        {metadataOnly.length > 0 && <> Pending metadata-only changes: {metadataOnly.map((c) => c.attribute).join(", ")}.</>}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 rounded-none" onClick={() => set({ draft: null, draftSource: null })}>Discard</Button>
        <Button className="flex-1 rounded-none" disabled={!changes.length} onClick={save}>Save as new version</Button>
      </div>
    </div>
  );
}
