"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GarmentPlaceholder } from "@/components/shared/garment-placeholder";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { REVIEW_LABEL } from "@/lib/editor/review";
import { versionsOf } from "@/lib/editor/versions";
import { ORG } from "@/lib/fixtures";
import {
  BRIEF_DISCLAIMER,
  BRIEF_TITLE,
  TECH_STATUS_LABEL,
  buildBriefDocument,
  fromDisplay,
  isBriefEditable,
  missingInfo,
  techActions,
  toDisplay,
  validateMeasurement,
  type TechAction,
} from "@/lib/handoff/technical";
import { useHandoffStore } from "@/lib/store/handoff-store";
import { useStoreHydrated, useStudioStore } from "@/lib/store/studio-store";
import { CONSTRUCTION_FIELDS, type BomLine, type BomStatus, type Measurement, type TechBrief } from "@/lib/types/handoff";
import { cn } from "@/lib/utils";

export const technicalHref = (briefId: string) => `/technical?brief=${encodeURIComponent(briefId)}`;
const ACTION_LABEL: Record<TechAction, string> = { submit: "Submit for technical review", request_changes: "Request changes", mark_reviewed: "Mark reviewed (simulated)", reopen: "Reopen as draft" };
const cell = "h-8 w-full border border-hairline bg-card px-2 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
let rowSeq = 0;
const rowId = (p: string) => `${p}_${Date.now().toString(36)}${(++rowSeq).toString(36)}`;

function BriefList() {
  const router = useRouter();
  const briefs = useHandoffStore((s) => s.briefs).filter((b) => b.orgId === ORG.id);
  const concepts = useStudioStore((s) => s.concepts);
  const versions = useStudioStore((s) => s.versions);
  const create = useHandoffStore((s) => s.createBrief);
  const candidates = concepts.filter((c) => c.orgId === ORG.id).sort((a, b) => Number(b.status === "approved") - Number(a.status === "approved"));
  const [conceptId, setConceptId] = useState(candidates[0]?.id ?? "");
  const concept = concepts.find((c) => c.id === conceptId);
  const [versionId, setVersionId] = useState("");
  const conceptVersions = concept ? versionsOf(versions, concept.id) : [];
  const vId = versionId && conceptVersions.some((v) => v.id === versionId) ? versionId : concept?.currentVersionId ?? "";

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Technical development" title="Technical handoff" description="Turn a concept version into a preliminary garment development brief for the technical team. Concept stage only — not a production tech pack." />
      <section className="grid gap-6 border border-hairline bg-card p-5 md:grid-cols-[1fr_1fr_auto] md:items-end" aria-label="Create a brief">
        <label className="space-y-1.5">
          <span className="t-meta">Concept</span>
          <select value={conceptId} onChange={(e) => { setConceptId(e.target.value); setVersionId(""); }} className={cell}>
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.title} · {REVIEW_LABEL[c.status]}</option>)}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="t-meta">Design version</span>
          <select value={vId} onChange={(e) => setVersionId(e.target.value)} className={cell}>
            {[...conceptVersions].reverse().map((v) => <option key={v.id} value={v.id}>v{v.number} · {v.summary}</option>)}
          </select>
        </label>
        <Button className="rounded-none" disabled={!concept || !vId} onClick={() => {
          const r = create(conceptId, vId, ORG.id);
          if (r.ok) router.push(technicalHref(r.value)); else toast.error(r.error);
        }}><Plus /> Create brief</Button>
        {concept && concept.status !== "approved" && <p className="text-[12px] text-muted-foreground md:col-span-3">This concept isn&apos;t creatively approved yet. You can still draft a brief; creative approval and technical review stay separate.</p>}
      </section>
      <section aria-label="Briefs">
        <h2 className="t-heading mb-2 border-b border-hairline pb-2">Briefs</h2>
        <ul className="divide-y divide-hairline">
          {briefs.map((b) => {
            const c = concepts.find((x) => x.id === b.conceptId);
            return (
              <li key={b.id}>
                <Link href={technicalHref(b.id)} className="flex items-center justify-between gap-4 py-3 outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex items-center gap-3">
                    <FileText className="size-4 text-stone" aria-hidden />
                    <span><span className="block text-[14px]">{c?.title ?? b.conceptId} · v{b.versionNumber}</span><span className="t-meta">{TECH_STATUS_LABEL[b.status]} · {missingInfo(b).length} open items</span></span>
                  </span>
                  <span className="t-meta">{new Date(b.updatedAt).toLocaleDateString("en-GB")}</span>
                </Link>
              </li>
            );
          })}
          {!briefs.length && <li className="py-6 text-[13px] text-muted-foreground">No briefs yet.</li>}
        </ul>
      </section>
    </div>
  );
}

function MeasurementTable({ rows, unit, disabled, onChange }: { rows: Measurement[]; unit: "cm" | "in"; disabled: boolean; onChange: (r: Measurement[]) => void }) {
  const set = (id: string, patch: Partial<Measurement>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[12px]">
        <thead className="t-meta border-b border-hairline">
          <tr><th className="py-2 pr-2 font-normal">Point</th><th className="pr-2 font-normal">Value ({unit})</th><th className="pr-2 font-normal">± Tol.</th><th className="pr-2 font-normal">Notes</th><th className="pr-2 font-normal">Req.</th><th className="pr-2 font-normal">Illus.</th><th /></tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((m) => {
            const err = validateMeasurement(m);
            return (
              <tr key={m.id} className="align-top">
                <td className="py-1.5 pr-2"><input aria-label="Measurement point" disabled={disabled} value={m.name} onChange={(e) => set(m.id, { name: e.target.value })} className={cell} />{err && <span role="alert" className="mt-0.5 block text-[11px] text-destructive">{err}</span>}</td>
                <td className="py-1.5 pr-2"><input aria-label={`${m.name} value in ${unit}`} type="number" step="0.1" min="0" disabled={disabled} value={toDisplay(m.valueCm, unit) ?? ""} placeholder="—" onChange={(e) => set(m.id, { valueCm: fromDisplay(num(e.target.value), unit) })} className={cn(cell, "w-24")} /></td>
                <td className="py-1.5 pr-2"><input aria-label={`${m.name} tolerance in ${unit}`} type="number" step="0.1" min="0" disabled={disabled} value={toDisplay(m.toleranceCm, unit) ?? ""} placeholder="—" onChange={(e) => set(m.id, { toleranceCm: fromDisplay(num(e.target.value), unit) })} className={cn(cell, "w-20")} /></td>
                <td className="py-1.5 pr-2"><input aria-label={`${m.name} notes`} disabled={disabled} value={m.notes} onChange={(e) => set(m.id, { notes: e.target.value })} className={cell} /></td>
                <td className="py-1.5 pr-2 text-center"><input type="checkbox" aria-label={`${m.name} required`} disabled={disabled} checked={m.required} onChange={(e) => set(m.id, { required: e.target.checked })} className="mt-2 accent-ink" /></td>
                <td className="py-1.5 pr-2 text-center"><input type="checkbox" aria-label={`${m.name} is illustrative`} disabled={disabled} checked={m.illustrative} onChange={(e) => set(m.id, { illustrative: e.target.checked })} className="mt-2 accent-ink" /></td>
                <td className="py-1.5"><Button size="icon-xs" variant="ghost" disabled={disabled} aria-label={`Remove ${m.name}`} onClick={() => onChange(rows.filter((r) => r.id !== m.id))}><Trash2 /></Button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Button size="sm" variant="outline" className="mt-2 rounded-none" disabled={disabled} onClick={() => onChange([...rows, { id: rowId("m"), name: "New point", valueCm: null, toleranceCm: null, notes: "", required: false, illustrative: false }])}><Plus /> Add measurement</Button>
    </div>
  );
}

function BomTable({ rows, disabled, onChange }: { rows: BomLine[]; disabled: boolean; onChange: (r: BomLine[]) => void }) {
  const set = (id: string, patch: Partial<BomLine>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-[12px]">
        <thead className="t-meta border-b border-hairline"><tr>{["Component", "Material", "Colour", "Qty", "Unit", "Supplier notes", "Status", ""].map((h) => <th key={h} className="py-2 pr-2 font-normal">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((l) => (
            <tr key={l.id}>
              {(["component", "material", "colour"] as const).map((k) => <td key={k} className="py-1.5 pr-2"><input aria-label={`${l.component} ${k}`} disabled={disabled} value={l[k]} placeholder="Unspecified" onChange={(e) => set(l.id, { [k]: e.target.value })} className={cell} /></td>)}
              <td className="py-1.5 pr-2"><input aria-label={`${l.component} quantity`} type="number" min="0" step="0.1" disabled={disabled} value={l.quantity ?? ""} placeholder="—" onChange={(e) => set(l.id, { quantity: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })} className={cn(cell, "w-20")} /></td>
              <td className="py-1.5 pr-2"><input aria-label={`${l.component} unit`} disabled={disabled} value={l.unit} onChange={(e) => set(l.id, { unit: e.target.value })} className={cn(cell, "w-16")} /></td>
              <td className="py-1.5 pr-2"><input aria-label={`${l.component} supplier notes`} disabled={disabled} value={l.supplierNotes} onChange={(e) => set(l.id, { supplierNotes: e.target.value })} className={cell} /></td>
              <td className="py-1.5 pr-2">
                <select aria-label={`${l.component} status`} disabled={disabled} value={l.status} onChange={(e) => set(l.id, { status: e.target.value as BomStatus })} className={cell}>
                  <option value="unspecified">Unspecified</option><option value="proposed">Proposed</option><option value="confirmed">Confirmed</option>
                </select>
              </td>
              <td className="py-1.5"><Button size="icon-xs" variant="ghost" disabled={disabled} aria-label={`Remove ${l.component}`} onClick={() => onChange(rows.filter((r) => r.id !== l.id))}><Trash2 /></Button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button size="sm" variant="outline" className="mt-2 rounded-none" disabled={disabled} onClick={() => onChange([...rows, { id: rowId("bom"), component: "Trim", material: "", colour: "", quantity: null, unit: "pcs", supplierNotes: "", status: "unspecified" }])}><Plus /> Add line</Button>
    </div>
  );
}

function BriefWorkspace({ brief }: { brief: TechBrief }) {
  const concept = useStudioStore((s) => s.concepts.find((c) => c.id === brief.conceptId));
  const version = useStudioStore((s) => s.versions.find((v) => v.id === brief.versionId));
  const collections = useStudioStore((s) => s.collections).filter((c) => c.conceptIds.includes(brief.conceptId));
  const { updateBrief, techReview } = useHandoffStore.getState();
  const [draft, setDraft] = useState(brief);
  const [note, setNote] = useState("");
  const [exporting, setExporting] = useState(false);
  const views = useRef<HTMLDivElement>(null);
  useEffect(() => setDraft(brief), [brief]);
  const editable = isBriefEditable(brief.status);
  const dirty = JSON.stringify(draft) !== JSON.stringify(brief);
  const warnings = useMemo(() => missingInfo(draft), [draft]);
  const invalid = draft.measurements.some((m) => validateMeasurement(m));
  if (!concept || !version) return <p className="t-body">The concept version for this brief is no longer available.</p>;
  const snap = version.snapshot;

  const save = () => {
    const r = updateBrief(brief.id, () => draft);
    if (r.ok) toast.success("Brief saved as draft"); else toast.error(r.error);
  };
  const act = (a: TechAction) => {
    if (dirty && editable) { const r = updateBrief(brief.id, () => draft); if (!r.ok) return void toast.error(r.error); }
    const r = techReview(brief.id, a, note);
    if (r.ok) { toast.success(ACTION_LABEL[a].replace(" (simulated)", "")); setNote(""); } else toast.error(r.error);
  };
  const doExport = async () => {
    setExporting(true);
    try {
      const { exportBriefPdf, svgToPng } = await import("@/lib/handoff/pdf");
      const svgs = [...(views.current?.querySelectorAll("svg") ?? [])] as SVGSVGElement[];
      const pngs = await Promise.all(svgs.map((s, i) => svgToPng(s, 200, 280).then((png) => ({ label: i ? "Back (conceptual)" : "Front (conceptual)", png }))));
      const doc = buildBriefDocument(draft, {
        concept, version, collectionNames: collections.map((c) => c.name), brandVersion: concept.brandProfileVersion,
        conceptReview: REVIEW_LABEL[concept.status], generatedAt: new Date().toLocaleString("en-GB"),
      });
      await exportBriefPdf(doc, pngs, `preliminary-brief-${concept.id}-v${version.number}.pdf`);
      toast.success("Brief exported");
    } catch (e) {
      toast.error("Export failed", { description: (e as Error).message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-4 border-b border-hairline pb-6">
        <p className="t-meta"><Link href="/technical" className="underline">Technical handoff</Link> · {TECH_STATUS_LABEL[brief.status]}</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="t-display">{BRIEF_TITLE}</h1>
            <p className="t-body mt-2 text-charcoal">{snap.title} · {concept.id} · v{version.number}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-none" disabled={!editable || !dirty || invalid} onClick={save}>Save draft</Button>
            <Button className="rounded-none" disabled={exporting || invalid} onClick={doExport}><Download /> {exporting ? "Exporting…" : "Export PDF"}</Button>
          </div>
        </div>
        <p role="note" className="border-l-2 border-oxblood bg-oxblood-soft/60 px-3 py-2 text-[13px] text-oxblood">{BRIEF_DISCLAIMER}</p>
      </header>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-10">
          <section aria-label="Technical overview">
            <h2 className="t-heading mb-3 border-b border-hairline pb-2">Technical overview</h2>
            <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
              {[
                ["Garment", snap.title], ["Concept ID", concept.id], ["Design version", `v${version.number}`], ["Collection", collections.map((c) => c.name).join(", ") || "Not assigned"],
                ["Category", concept.category], ["Silhouette", snap.silhouette], ["Materials", snap.fabrics.join(", ")], ["Palette", snap.palette.map((p) => p.name).join(" / ")],
                ["Brand DNA", concept.brandProfileVersion ? `v${concept.brandProfileVersion}` : "None (Explore)"], ["Creative review", REVIEW_LABEL[concept.status]], ["Designer notes", snap.notes || "—"],
              ].map(([k, v]) => <div key={k} className="grid grid-cols-[120px_1fr] border-b border-hairline py-1.5"><dt className="t-meta">{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </section>

          <section aria-label="Construction">
            <h2 className="t-heading mb-3 border-b border-hairline pb-2">Construction</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {CONSTRUCTION_FIELDS.map(([k, label]) => (
                <label key={k} className={cn("block space-y-1", k === "description" && "md:col-span-2")}>
                  <span className="t-meta flex justify-between"><span>{label}</span>{draft.prefilled.includes(k) && <span className="normal-case tracking-normal text-oxblood">from concept metadata — verify</span>}</span>
                  <textarea rows={k === "description" ? 3 : 2} disabled={!editable} value={draft.construction[k]} placeholder="Not specified" onChange={(e) => setDraft({ ...draft, construction: { ...draft.construction, [k]: e.target.value }, prefilled: draft.prefilled.filter((p) => p !== k) })} className="w-full border border-hairline bg-card px-2 py-1.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
                </label>
              ))}
            </div>
          </section>

          <section aria-label="Measurements">
            <div className="mb-3 flex items-center justify-between border-b border-hairline pb-2">
              <h2 className="t-heading">Preliminary measurements</h2>
              <div role="radiogroup" aria-label="Units" className="flex border border-hairline text-[12px]">
                {(["cm", "in"] as const).map((u) => <button key={u} role="radio" aria-checked={draft.displayUnit === u} onClick={() => setDraft({ ...draft, displayUnit: u })} className={cn("h-7 px-3", draft.displayUnit === u ? "bg-ink text-paper" : "hover:bg-card")}>{u}</button>)}
              </div>
            </div>
            <p className="mb-3 text-[12px] text-muted-foreground">Blank until measured. Values are stored in cm and converted for display. Tick “Illus.” for placeholder values so they&apos;re flagged in the export.</p>
            <MeasurementTable rows={draft.measurements} unit={draft.displayUnit} disabled={!editable} onChange={(measurements) => setDraft({ ...draft, measurements })} />
          </section>

          <section aria-label="Materials and trims">
            <h2 className="t-heading mb-3 border-b border-hairline pb-2">Materials &amp; trims</h2>
            <BomTable rows={draft.bom} disabled={!editable} onChange={(bom) => setDraft({ ...draft, bom })} />
          </section>
        </div>

        <aside className="space-y-8">
          <section aria-label="Technical drawings">
            <h2 className="t-heading mb-3">Drawings</h2>
            <div ref={views} className="grid grid-cols-2 gap-2">
              {(["front", "back"] as const).map((v) => <GarmentPlaceholder key={v} category={concept.category} palette={snap.palette} silhouette={snap.silhouette} seed={snap.seed} view={v} label={v} className="aspect-[5/7]" />)}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Conceptual illustrations — not manufacturing patterns.</p>
          </section>
          <section aria-label="Technical review" className="space-y-3">
            <h2 className="t-heading">Technical review</h2>
            <p className="text-[12px] text-muted-foreground">Separate from creative approval. Reviewer is a simulated local role.</p>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Review note" aria-label="Technical review note" className={cell} />
            <div className="flex flex-wrap gap-1.5">
              {techActions(brief.status).map((a) => <Button key={a} size="sm" variant={a === "mark_reviewed" ? "default" : "outline"} className="rounded-none" disabled={invalid} onClick={() => act(a)}>{ACTION_LABEL[a]}</Button>)}
            </div>
            <ol className="divide-y divide-hairline border-y border-hairline text-[12px]">
              {brief.reviews.map((r) => <li key={r.id} className="py-2">{TECH_STATUS_LABEL[r.from]} → <strong className="font-medium">{TECH_STATUS_LABEL[r.to]}</strong><span className="block text-muted-foreground">{r.actor} · {new Date(r.at).toLocaleString("en-GB")}</span>{r.note && <span className="block">“{r.note}”</span>}</li>)}
              {!brief.reviews.length && <li className="py-2 text-muted-foreground">No review activity yet.</li>}
            </ol>
          </section>
          <section aria-label="Missing information" className="space-y-2">
            <h2 className="t-heading flex items-center gap-2"><AlertTriangle className="size-4 text-oxblood" /> Open items ({warnings.length})</h2>
            <ul className="max-h-64 space-y-1 overflow-y-auto text-[12px] text-charcoal">{warnings.map((w) => <li key={w}>• {w}</li>)}</ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function TechnicalView() {
  const id = useSearchParams().get("brief");
  const hydrated = useStoreHydrated();
  const brief = useHandoffStore((s) => s.briefs.find((b) => b.id === id && b.orgId === ORG.id));
  if (!hydrated) return <div className="h-[60vh] animate-pulse bg-paper-2" />;
  if (!id) return <BriefList />;
  if (!brief) return (
    <div className="space-y-3 py-16 text-center">
      <p className="t-heading">This brief isn&apos;t available</p>
      <Link className="t-meta underline" href="/technical">Back to technical handoff</Link>
    </div>
  );
  return <BriefWorkspace key={brief.id} brief={brief} />;
}
