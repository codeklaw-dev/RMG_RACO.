"use client";
import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Columns2, GitBranch, Heart, PenTool } from "lucide-react";
import { GarmentPlaceholder } from "@/components/shared/garment-placeholder";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { ORG } from "@/lib/fixtures";
import { useApprovedVersion, useEligibleReferenceIds } from "@/lib/store/brand-store";
import { BrandConsistency } from "./brand-consistency";
import { MODE_COPY, buildGenerateRequest } from "@/lib/studio/brief";
import { useStudioSession } from "@/lib/store/studio-session";
import { useStudioStore } from "@/lib/store/studio-store";
import type { Concept } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 py-2 text-[13px]">
      <dt className="t-meta pt-0.5">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

const Palette = ({ hexes }: { hexes: { hex: string; name: string }[] }) => (
  <span className="flex flex-wrap items-center gap-1.5">
    {hexes.map((p) => (
      <span key={p.hex} className="inline-flex items-center gap-1">
        <span className="size-3 border border-black/10" style={{ background: p.hex }} aria-hidden />
        <span className="text-[12px]">{p.name}</span>
      </span>
    ))}
  </span>
);

/** Live view of the request the Studio will send. Shown when nothing is selected. */
export function RequestPreview() {
  const brief = useStudioSession((s) => s.brief);
  const approved = useApprovedVersion();
  const eligibleReferenceIds = useEligibleReferenceIds();
  const req = buildGenerateRequest(brief, { orgId: ORG.id, brand: approved, eligibleReferenceIds, idempotencyKey: "preview" });
  const bc = req.brandContext;
  return (
    <div className="space-y-4 p-5">
      <div>
        <p className="t-meta">Request preview</p>
        <p className="font-display mt-1 text-2xl">{MODE_COPY[brief.mode].label} mode</p>
        <p className="t-body text-muted-foreground">{MODE_COPY[brief.mode].hint}</p>
      </div>
      <dl className="divide-y divide-hairline border-y border-hairline">
        <Row label="Garment">{req.category} · {req.silhouette}</Row>
        <Row label="Materials">{req.materials?.join(", ") || "—"}</Row>
        <Row label="Palette">{req.palette?.length ? req.palette.join(" ") : "Auto"}</Row>
        <Row label="Brand">
          {bc ? (
            <span>
              Approved v{bc.version} · strictness {bc.strictness?.toFixed(2)} · {bc.styleRuleIds.length} rules · {bc.negativeRuleIds.length} exclusions
            </span>
          ) : brief.mode === "explore" ? (
            "None (Explore ignores Brand DNA)"
          ) : (
            <span className="text-oxblood">No approved profile — request will be rejected</span>
          )}
        </Row>
        {bc && (
          <>
            <Row label="Silhouette">
              {bc.preferredSilhouettes?.length ? `prefer ${bc.preferredSilhouettes.join(", ")}` : "no preference"}
              {bc.avoidSilhouettes?.length ? ` · avoid ${bc.avoidSilhouettes.join(", ")}` : ""}
            </Row>
            <Row label="Materials">
              {bc.preferredMaterials?.length ? `prefer ${bc.preferredMaterials.join(", ")}` : "no preference"}
              {bc.avoidMaterials?.length ? ` · avoid ${bc.avoidMaterials.join(", ")}` : ""}
            </Row>
            <Row label="Details">
              {bc.preferredDetails?.length ? `prefer ${bc.preferredDetails.join(", ")}` : "—"}
              {bc.avoidDetails?.length ? ` · avoid ${bc.avoidDetails.join(", ")}` : ""}
            </Row>
            <Row label="Colour">{bc.paletteOnly ? "Approved palette only" : "Palette preferred"} · {bc.palette.length} colours</Row>
            {bc.guidance?.length ? <Row label="Guidance">{bc.guidance.join(" · ")}</Row> : null}
            <Row label="Brand refs">{bc.referenceIds?.length ?? 0} approved, available</Row>
          </>
        )}
        <Row label="References">{req.referenceAssetIds?.length ?? 0} local, metadata only</Row>
        <Row label="Output">{req.count} concepts · creativity {req.creativity?.toFixed(2)} · seed {req.seed}</Row>
        {req.variationOf && <Row label="Parent">{req.variationOf}</Row>}
      </dl>
      <p className="t-body text-muted-foreground">
        Select a concept to inspect it. Only the approved Brand DNA version conditions requests; drafts never do.
      </p>
    </div>
  );
}

export function ConceptInspector({ concept, onVariation }: { concept: Concept; onVariation?: () => void }) {
  const collections = useStudioStore((s) => s.collections).filter((c) => c.orgId === concept.orgId);
  const toggleFavorite = useStudioStore((s) => s.toggleFavorite);
  const saveToCollection = useStudioStore((s) => s.saveToCollection);
  const parent = useStudioStore((s) => s.concepts.find((c) => c.id === concept.parentConceptId));
  const targetId = useStudioSession((s) => s.brief.targetCollectionId);
  const loadVariation = useStudioSession((s) => s.loadVariation);
  const compareIds = useStudioSession((s) => s.compareIds);
  const toggleCompare = useStudioSession((s) => s.toggleCompare);
  const [collectionId, setCollectionId] = useState(targetId ?? collections[0]?.id ?? "");
  const memberOf = collections.filter((c) => c.conceptIds.includes(concept.id));

  const save = () => {
    const res = saveToCollection(concept.id, collectionId);
    const name = collections.find((c) => c.id === collectionId)?.name ?? "collection";
    if (res.ok) toast.success(`Saved to ${name}`);
    else if (res.reason === "duplicate") toast.info(`Already in ${name}`);
    else toast.error("Could not save", { description: "The collection is unavailable. Try another." });
  };

  return (
    <div className="space-y-5 p-5">
      <GarmentPlaceholder category={concept.category} palette={concept.palette} silhouette={concept.silhouette} seed={concept.seed} className="aspect-[4/5] w-full" />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <StatusBadge state={concept.capability} />
          <span className="t-meta">{MODE_COPY[concept.mode].label} mode</span>
        </div>
        <h2 className="font-display text-[28px] leading-tight">{concept.title}</h2>
        <p className="t-body text-charcoal">{concept.description}</p>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Button variant="outline" size="sm" aria-pressed={concept.favorite} onClick={() => toggleFavorite(concept.id)} className="rounded-none">
          <Heart className={cn(concept.favorite && "fill-oxblood text-oxblood")} /> {concept.favorite ? "Saved" : "Favourite"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-none"
          onClick={() => {
            loadVariation(concept);
            onVariation?.();
            toast("Brief loaded for a variation", { description: "Adjust it and generate. The original stays unchanged." });
          }}
        >
          <GitBranch /> Variation
        </Button>
        <Button variant="outline" size="sm" className="rounded-none" aria-pressed={compareIds.includes(concept.id)} onClick={() => toggleCompare(concept.id)}>
          <Columns2 /> {compareIds.includes(concept.id) ? "Comparing" : "Compare"}
        </Button>
      </div>

      <Button variant="outline" size="sm" className="w-full rounded-none" render={<Link href={`/editor?concept=${encodeURIComponent(concept.id)}`} />} nativeButton={false}>
        <PenTool /> Open in Design Editor
      </Button>

      <div className="space-y-2">
        <p className="t-meta">Save to collection</p>
        <div className="flex gap-1.5">
          <select
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
            aria-label="Collection"
            className="h-8 min-w-0 flex-1 border border-hairline bg-card px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {collections.map((c) => (
              <option key={c.id} value={c.id}>{c.season} · {c.name}</option>
            ))}
          </select>
          <Button size="sm" className="h-8 rounded-none" onClick={save} disabled={!collectionId}>Save</Button>
        </div>
        {memberOf.length > 0 && <p className="text-[12px] text-muted-foreground">In {memberOf.map((c) => c.name).join(", ")}</p>}
      </div>

      <BrandConsistency concept={concept} />

      <dl className="divide-y divide-hairline border-y border-hairline">
        <Row label="Garment">{concept.category}</Row>
        <Row label="Silhouette">{concept.silhouette}</Row>
        <Row label="Fabric">{concept.fabrics.join(", ")}</Row>
        {concept.details?.length ? <Row label="Details">{concept.details.join(", ")}</Row> : null}
        <Row label="Palette"><Palette hexes={concept.palette} /></Row>
        <Row label="Brand">{concept.brandProfileVersion ? `Brand DNA v${concept.brandProfileVersion}` : "None (Explore)"}</Row>
        {parent && <Row label="Parent">{parent.title}</Row>}
        <Row label="Prompt"><span className="text-charcoal">{concept.prompt}</span></Row>
        <Row label="Provenance"><span className="text-muted-foreground">{concept.provenance}</span></Row>
      </dl>
    </div>
  );
}
