"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, GitBranch, History } from "lucide-react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { GarmentPlaceholder } from "@/components/shared/garment-placeholder";
import { Button } from "@/components/ui/button";
import { REVIEW_LABEL } from "@/lib/editor/review";
import { versionsOf } from "@/lib/editor/versions";
import { useEditorSession } from "@/lib/store/editor-session";
import { useStudioStore } from "@/lib/store/studio-store";
import type { Concept, ConceptStatus } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

const OP_LABEL = { generate: "Original", edit: "Refinement", manual: "Designer edit", restore: "Restore", reopen: "Reopened", variation: "Variation", try_on: "Try-on" } as const;
const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const editorHref = (id: string) => `/editor?concept=${encodeURIComponent(id)}`;

function ConceptList({ currentId, orgId }: { currentId: string; orgId: string }) {
  const concepts = useStudioStore((s) => s.concepts);
  const collections = useStudioStore((s) => s.collections);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | ConceptStatus>("");
  const [collectionId, setCollectionId] = useState("");
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const col = collections.find((c) => c.id === collectionId);
    return concepts
      .filter((c) => c.orgId === orgId)
      .filter((c) => !term || `${c.title} ${c.category} ${c.silhouette} ${c.fabrics.join(" ")}`.toLowerCase().includes(term))
      .filter((c) => !status || c.status === status)
      .filter((c) => !col || col.conceptIds.includes(c.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [concepts, collections, q, status, collectionId, orgId]);
  const select = "h-8 min-w-0 flex-1 border border-hairline bg-card px-2 text-[12px]";

  return (
    <div className="space-y-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search concepts" aria-label="Search concepts" className="h-8 w-full border border-hairline bg-card px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <div className="flex gap-1.5">
        <select aria-label="Filter by status" className={select} value={status} onChange={(e) => setStatus(e.target.value as ConceptStatus | "")}>
          <option value="">All statuses</option>
          {(Object.keys(REVIEW_LABEL) as ConceptStatus[]).map((s) => <option key={s} value={s}>{REVIEW_LABEL[s]}</option>)}
        </select>
        <select aria-label="Filter by collection" className={select} value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
          <option value="">All collections</option>
          {collections.filter((c) => c.orgId === orgId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <ul className="max-h-64 divide-y divide-hairline overflow-y-auto border-y border-hairline" aria-label="Concepts">
        {shown.map((c) => (
          <li key={c.id}>
            <Link
              href={editorHref(c.id)}
              aria-current={c.id === currentId ? "page" : undefined}
              className={cn("flex items-center gap-2 px-1 py-1.5 outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", c.id === currentId && "bg-card")}
            >
              <GarmentPlaceholder category={c.category} palette={c.palette} silhouette={c.silhouette} seed={c.seed} label={null} className="aspect-[3/4] w-8 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-[12px]">{c.title}</span>
                <span className="t-meta text-[9px]">{REVIEW_LABEL[c.status]} · {c.mode}</span>
              </span>
            </Link>
          </li>
        ))}
        {!shown.length && <li className="py-3 text-[12px] text-muted-foreground">No concepts match.</li>}
      </ul>
    </div>
  );
}

export function Navigator({ concept }: { concept: Concept }) {
  const versions = useStudioStore(useShallow((s) => versionsOf(s.versions, concept.id)));
  const parent = useStudioStore((s) => s.concepts.find((c) => c.id === concept.parentConceptId));
  const variations = useStudioStore(useShallow((s) => s.concepts.filter((c) => c.parentConceptId === concept.id)));
  const collections = useStudioStore(useShallow((s) => s.collections.filter((c) => c.conceptIds.includes(concept.id))));
  const annotations = useStudioStore((s) => s.annotations);
  const { restoreVersion, duplicateFromVersion } = useStudioStore.getState();
  const router = useRouter();
  const viewId = useEditorSession((s) => s.viewVersionId) ?? concept.currentVersionId;
  const setSession = useEditorSession((s) => s.set);
  const idx = versions.findIndex((v) => v.id === viewId);
  const go = (i: number) => versions[i] && setSession({ viewVersionId: versions[i].id, compare: false, draft: null, draftSource: null });

  return (
    <div className="space-y-6 p-4">
      <section aria-label="Concepts">
        <p className="t-meta mb-2">Concepts</p>
        <ConceptList currentId={concept.id} orgId={concept.orgId} />
      </section>

      <section aria-label="Version timeline">
        <div className="mb-2 flex items-center justify-between">
          <p className="t-meta flex items-center gap-1.5"><History className="size-3" /> Versions</p>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-xs" aria-label="Previous version" disabled={idx <= 0} onClick={() => go(idx - 1)}><ChevronLeft /></Button>
            <Button variant="ghost" size="icon-xs" aria-label="Next version" disabled={idx >= versions.length - 1} onClick={() => go(idx + 1)}><ChevronRight /></Button>
          </div>
        </div>
        <ol className="space-y-1">
          {[...versions].reverse().map((v) => {
            const viewing = v.id === viewId;
            const current = v.id === concept.currentVersionId;
            const pins = annotations.filter((a) => a.versionId === v.id).length;
            return (
              <li key={v.id} className={cn("border border-hairline", viewing && "border-ink bg-card")}>
                <button type="button" aria-current={viewing ? "true" : undefined} onClick={() => setSession({ viewVersionId: v.id, compare: false, draft: null, draftSource: null })} className="block w-full px-2.5 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium">v{v.number} · {OP_LABEL[v.operation]}</span>
                    {current && <span className="t-meta text-[9px] text-oxblood">current</span>}
                  </span>
                  <span className="block truncate text-[12px] text-charcoal">{v.summary}</span>
                  <span className="t-meta text-[9px]">{fmt(v.createdAt)}{v.parentId ? ` · from v${versions.find((p) => p.id === v.parentId)?.number}` : ""}{pins ? ` · ${pins} note${pins > 1 ? "s" : ""}` : ""}</span>
                </button>
                {viewing && (
                  <div className="flex gap-1 border-t border-hairline px-2 py-1.5">
                    <Button
                      size="xs"
                      variant="outline"
                      className="rounded-none"
                      disabled={current}
                      onClick={() => {
                        const r = restoreVersion(concept.id, v.id);
                        if (r.ok) { toast.success(`v${v.number} restored as a new version`); setSession({ viewVersionId: null }); }
                        else toast.error(r.error);
                      }}
                    >
                      Restore as new version
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        const id = duplicateFromVersion(concept.id, v.id);
                        if (id) { toast.success("Variation created as a new related concept"); router.push(editorHref(id)); }
                      }}
                    >
                      <GitBranch /> Variation
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-[11px] text-muted-foreground">Revisions are versions of this concept. Variations become separate, linked concepts.</p>
      </section>

      <section aria-label="Lineage" className="space-y-2 text-[12px]">
        <p className="t-meta">Lineage</p>
        {parent ? (
          <p>Variation of <Link className="underline" href={editorHref(parent.id)}>{parent.title}</Link></p>
        ) : (
          <p className="text-muted-foreground">Source concept ({concept.jobId ? `Studio job ${concept.jobId}` : "seed fixture"}) · {concept.mode} mode{concept.brandProfileVersion ? ` · Brand DNA v${concept.brandProfileVersion}` : ""}</p>
        )}
        {variations.length > 0 && (
          <ul className="space-y-0.5">
            {variations.map((v) => <li key={v.id}>↳ <Link className="underline" href={editorHref(v.id)}>{v.title}</Link></li>)}
          </ul>
        )}
        <p>{collections.length ? <>In {collections.map((c, i) => <span key={c.id}>{i ? ", " : ""}<Link className="underline" href={`/collections/${c.id}`}>{c.name}</Link></span>)}</> : <span className="text-muted-foreground">Not in a collection</span>}</p>
      </section>
    </div>
  );
}
