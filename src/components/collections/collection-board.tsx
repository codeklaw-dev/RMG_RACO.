"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Play, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { TagInput } from "@/components/brand-dna/shared";
import { ConceptReviewControls } from "@/components/editor/review-panel";
import { GarmentPlaceholder } from "@/components/shared/garment-placeholder";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { REVIEW_LABEL } from "@/lib/editor/review";
import { collectionPalette, groupLooks, nextCollectionStatus } from "@/lib/editor/collections";
import { useStudioStore } from "@/lib/store/studio-store";
import type { Collection, Concept, ConceptStatus } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

const COLLECTION_STATUS_LABEL = { concept: "Concept", in_review: "In review", approved: "Approved", archived: "Archived" } as const;

function LookCard({ concept, collection, index, total }: { concept: Concept; collection: Collection; index: number; total: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: concept.id });
  const { moveLook, removeFromCollection, setLookMeta } = useStudioStore.getState();
  const meta = collection.lookMeta?.[concept.id] ?? { note: "", tags: [] };
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("space-y-2 bg-paper", isDragging && "relative z-10 opacity-80 shadow-lg")}>
      <div className="relative">
        <Link href={`/editor?concept=${encodeURIComponent(concept.id)}`} className="block outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <GarmentPlaceholder category={concept.category} palette={concept.palette} silhouette={concept.silhouette} seed={concept.seed} className="aspect-[3/4]" />
        </Link>
        <div className="absolute left-2 top-2 flex gap-1"><StatusBadge state={concept.capability} /></div>
        <span className="t-meta absolute right-2 top-2 bg-paper/90 px-1.5">{String(index + 1).padStart(2, "0")}</span>
        <button
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder ${concept.title}. Space to pick up, arrow keys to move.`}
          className="absolute bottom-2 right-2 grid size-7 cursor-grab place-items-center bg-paper/90 text-charcoal outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">{concept.title}</p>
          <p className="t-meta">{REVIEW_LABEL[concept.status]} · {concept.silhouette}</p>
        </div>
        <div className="flex shrink-0">
          <Button size="icon-xs" variant="ghost" aria-label={`Move ${concept.title} earlier`} disabled={index === 0} onClick={() => moveLook(collection.id, concept.id, -1)}><ArrowUp /></Button>
          <Button size="icon-xs" variant="ghost" aria-label={`Move ${concept.title} later`} disabled={index === total - 1} onClick={() => moveLook(collection.id, concept.id, 1)}><ArrowDown /></Button>
          <Button size="icon-xs" variant="ghost" aria-label={`Remove ${concept.title} from collection`} onClick={() => { removeFromCollection(collection.id, concept.id); toast(`Removed ${concept.title}`); }}><Trash2 /></Button>
        </div>
      </div>
      <ConceptReviewControls concept={concept} compact />
      <textarea
        value={meta.note}
        onChange={(e) => setLookMeta(collection.id, concept.id, { note: e.target.value })}
        rows={2}
        placeholder="Garment note"
        aria-label={`Note for ${concept.title}`}
        className="w-full border border-hairline bg-card px-2 py-1.5 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {(collection.groups?.length ?? 0) > 0 && (
        <select
          value={meta.groupId ?? ""}
          onChange={(e) => setLookMeta(collection.id, concept.id, { groupId: e.target.value || null })}
          aria-label={`Design direction for ${concept.title}`}
          className="h-7 w-full border border-hairline bg-card px-2 text-[12px]"
        >
          <option value="">Ungrouped</option>
          {collection.groups!.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      )}
      <TagInput label="Tags" values={meta.tags} onChange={(tags) => setLookMeta(collection.id, concept.id, { tags })} />
    </li>
  );
}

function AddConceptsDialog({ collection, onClose }: { collection: Collection; onClose: () => void }) {
  const candidates = useStudioStore(useShallow((s) => s.concepts.filter((c) => c.orgId === collection.orgId && !collection.conceptIds.includes(c.id))));
  const save = useStudioStore((s) => s.saveToCollection);
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-none sm:max-w-2xl">
        <DialogTitle className="font-display text-2xl font-normal">Add concepts to {collection.name}</DialogTitle>
        <DialogDescription>Only concepts from {collection.orgId === "org_serein" ? "Serein Atelier" : "this organisation"} are listed.</DialogDescription>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {candidates.map((c) => (
            <li key={c.id}>
              <label className="block cursor-pointer">
                <input type="checkbox" className="peer sr-only" checked={picked.includes(c.id)} onChange={() => setPicked(picked.includes(c.id) ? picked.filter((x) => x !== c.id) : [...picked, c.id])} />
                <GarmentPlaceholder category={c.category} palette={c.palette} silhouette={c.silhouette} seed={c.seed} label={null} className="aspect-[3/4] outline-offset-2 peer-checked:outline-2 peer-checked:outline-ink peer-focus-visible:ring-2 peer-focus-visible:ring-ring" />
                <span className="mt-1 block truncate text-[12px]">{c.title}</span>
              </label>
            </li>
          ))}
          {!candidates.length && <li className="col-span-full text-[13px] text-muted-foreground">Every concept is already in this collection.</li>}
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="rounded-none" onClick={onClose}>Cancel</Button>
          <Button className="rounded-none" disabled={!picked.length} onClick={() => { picked.forEach((id) => save(id, collection.id)); toast.success(`Added ${picked.length} concept${picked.length > 1 ? "s" : ""}`); onClose(); }}>
            Add {picked.length || ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CollectionBoard({ collection: initial }: { collection: Collection }) {
  const collection = useStudioStore((s) => s.collections.find((c) => c.id === initial.id)) ?? initial;
  const concepts = useStudioStore((s) => s.concepts);
  const { reorderLooks, updateCollection, addGroup, renameGroup, removeGroup, setCollectionStatus } = useStudioStore.getState();
  const [status, setStatus] = useState<"" | ConceptStatus>("");
  const [tag, setTag] = useState("");
  const [adding, setAdding] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const looks = useMemo(() => collection.conceptIds.map((id) => concepts.find((c) => c.id === id)).filter((c): c is Concept => Boolean(c && c.orgId === collection.orgId)), [collection, concepts]);
  const palette = useMemo(() => collectionPalette(looks), [looks]);
  const tags = [...new Set(Object.values(collection.lookMeta ?? {}).flatMap((m) => m.tags))].sort();
  const visible = looks.filter((c) => (!status || c.status === status) && (!tag || collection.lookMeta?.[c.id]?.tags.includes(tag)));
  const sections = groupLooks(visible, collection);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const filtered = Boolean(status || tag);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = collection.conceptIds;
    reorderLooks(collection.id, arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };
  const next = nextCollectionStatus(collection.status);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6 border-b border-hairline pb-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl space-y-3">
          <p className="t-meta">{collection.season} · {COLLECTION_STATUS_LABEL[collection.status]} · {looks.length} looks · updated {new Date(collection.updatedAt).toLocaleDateString("en-GB")}</p>
          <h1 className="t-display">{collection.name}</h1>
          <p className="t-body text-muted-foreground">{collection.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {next && (
            <Button variant="outline" className="rounded-none" onClick={() => { setCollectionStatus(collection.id, next.to); toast.success(`Collection ${next.label.toLowerCase()}`); }} title={next.to === "approved" ? "Simulated approval — separate from concept and Brand DNA approval" : undefined}>
              {next.label}
            </Button>
          )}
          <Button variant="outline" className="rounded-none" onClick={() => setAdding(true)}><Plus /> Add concepts</Button>
          <Button className="rounded-none" disabled={!looks.length} render={<Link href={`/present/${collection.id}`} />} nativeButton={false}><Play /> Present</Button>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_280px]" aria-label="Collection overview">
        <label className="block space-y-1.5">
          <span className="t-meta">Creative direction</span>
          <textarea rows={3} value={collection.creativeDirection ?? ""} onChange={(e) => updateCollection(collection.id, { creativeDirection: e.target.value })} className="w-full border border-hairline bg-card px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
        <label className="block space-y-1.5">
          <span className="t-meta">Collection notes</span>
          <textarea rows={3} value={collection.notes ?? ""} onChange={(e) => updateCollection(collection.id, { notes: e.target.value })} placeholder="Line review, sourcing, timing…" className="w-full border border-hairline bg-card px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
        <div className="space-y-1.5">
          <p className="t-meta">Palette summary</p>
          <div className="flex h-8">
            {palette.map((p) => <span key={p.hex} title={`${p.name} · ${p.count} look${p.count > 1 ? "s" : ""}`} className="h-full border-r border-paper" style={{ background: p.hex, flex: p.count }} />)}
          </div>
          <p className="text-[12px] text-muted-foreground">{palette.slice(0, 4).map((p) => p.name).join(", ")}{palette.length > 4 ? ` +${palette.length - 4}` : ""}</p>
        </div>
      </section>

      <div className="flex flex-wrap items-end justify-between gap-3 border-y border-hairline py-3">
        <div className="flex flex-wrap gap-2">
          <select aria-label="Filter by review status" value={status} onChange={(e) => setStatus(e.target.value as ConceptStatus | "")} className="h-8 border border-hairline bg-card px-2 text-[13px]">
            <option value="">All statuses</option>
            {(Object.keys(REVIEW_LABEL) as ConceptStatus[]).map((s) => <option key={s} value={s}>{REVIEW_LABEL[s]} ({looks.filter((l) => l.status === s).length})</option>)}
          </select>
          <select aria-label="Filter by tag" value={tag} onChange={(e) => setTag(e.target.value)} className="h-8 border border-hairline bg-card px-2 text-[13px]">
            <option value="">All tags</option>
            {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {filtered && <p className="self-center text-[12px] text-muted-foreground">Reordering works on the full list; clear filters to see every look.</p>}
        </div>
        <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); const r = addGroup(collection.id, newGroup); if (r.ok) setNewGroup(""); else toast.error(r.error); }}>
          <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="New design direction" aria-label="New group name" className="h-8 w-48 border border-hairline bg-card px-2 text-[13px]" />
          <Button type="submit" size="sm" variant="outline" className="h-8 rounded-none" disabled={!newGroup.trim()}><Plus /> Group</Button>
        </form>
      </div>

      {!looks.length ? (
        <p className="t-body py-16 text-center text-muted-foreground">No looks yet. Add concepts from the Studio, the Editor or “Add concepts”.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          {sections.map((section) => (
            <section key={section.id ?? "ungrouped"} aria-label={section.name} className="space-y-4">
              <div className="flex items-baseline justify-between border-b border-hairline pb-2">
                {section.id ? (
                  <input defaultValue={section.name} onBlur={(e) => renameGroup(collection.id, section.id!, e.target.value)} aria-label="Group name" className="bg-transparent font-display text-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                ) : (
                  <h2 className="font-display text-2xl">{sections.length > 1 ? "Ungrouped" : "Looks"}</h2>
                )}
                <span className="flex items-center gap-2">
                  <span className="t-meta">{section.looks.length} looks</span>
                  {section.id && <Button size="icon-xs" variant="ghost" aria-label={`Delete group ${section.name}`} onClick={() => removeGroup(collection.id, section.id!)}><X /></Button>}
                </span>
              </div>
              <SortableContext items={section.looks.map((c) => c.id)} strategy={rectSortingStrategy}>
                <ol className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {section.looks.map((c) => (
                    <LookCard key={c.id} concept={c} collection={collection} index={collection.conceptIds.indexOf(c.id)} total={collection.conceptIds.length} />
                  ))}
                </ol>
              </SortableContext>
            </section>
          ))}
        </DndContext>
      )}
      {adding && <AddConceptsDialog collection={collection} onClose={() => setAdding(false)} />}
    </div>
  );
}
