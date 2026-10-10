"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ruler, Shirt } from "lucide-react";
import { FLAGS } from "@/lib/config/flags";
import { useHandoffStore } from "@/lib/store/handoff-store";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { availableActions, REVIEW_LABEL, type ReviewAction } from "@/lib/editor/review";
import { useStudioStore } from "@/lib/store/studio-store";
import type { Concept } from "@/lib/types/domain";

const ACTION_LABEL: Record<ReviewAction, string> = {
  submit: "Submit for review", withdraw: "Withdraw", approve: "Approve (simulated)", reject: "Reject", reopen: "Reopen as new draft", archive: "Archive",
};

export function ConceptReviewControls({ concept, compact }: { concept: Concept; compact?: boolean }) {
  const review = useStudioStore((s) => s.review);
  const [note, setNote] = useState("");
  const act = (a: ReviewAction) => {
    const r = review(concept.id, a, note);
    if (r.ok) { toast.success(`${concept.title}: ${ACTION_LABEL[a].replace(" (simulated)", "")}`); setNote(""); }
    else toast.error(r.error);
  };
  return (
    <div className="space-y-2">
      {!compact && <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Review note (optional)" aria-label="Review note" className="h-8 w-full border border-hairline bg-card px-2 text-[13px]" />}
      <div className="flex flex-wrap gap-1.5">
        {availableActions(concept.status).map((a) => (
          <Button key={a} size={compact ? "xs" : "sm"} variant={a === "approve" ? "default" : "outline"} className="rounded-none" onClick={() => act(a)}>{ACTION_LABEL[a]}</Button>
        ))}
      </div>
    </div>
  );
}

function NextSteps({ concept }: { concept: Concept }) {
  const router = useRouter();
  const createBrief = useHandoffStore((s) => s.createBrief);
  return (
    <div className="space-y-2 border-t border-hairline pt-4">
      <p className="t-meta">Next steps</p>
      {FLAGS.virtualTryOn && (
        <Button variant="outline" size="sm" className="w-full rounded-none" render={<Link href={`/try-on?concept=${encodeURIComponent(concept.id)}&version=${encodeURIComponent(concept.currentVersionId)}`} />} nativeButton={false}>
          <Shirt /> Conceptual try-on
        </Button>
      )}
      {FLAGS.technicalDevelopment && (
        <Button variant="outline" size="sm" className="w-full rounded-none" onClick={() => {
          const r = createBrief(concept.id, concept.currentVersionId, concept.orgId);
          if (r.ok) router.push(`/technical?brief=${encodeURIComponent(r.value)}`); else toast.error(r.error);
        }}>
          <Ruler /> Technical brief (current version)
        </Button>
      )}
    </div>
  );
}

export function ReviewPanel({ concept }: { concept: Concept }) {
  const reviews = useStudioStore((s) => s.reviews).filter((r) => r.conceptId === concept.id);
  const versions = useStudioStore((s) => s.versions);
  const collections = useStudioStore((s) => s.collections).filter((c) => c.orgId === concept.orgId);
  const saveToCollection = useStudioStore((s) => s.saveToCollection);
  const [collectionId, setCollectionId] = useState(collections[0]?.id ?? "");
  return (
    <div className="space-y-5">
      <div>
        <p className="t-meta">Concept review</p>
        <p className="font-display mt-1 text-2xl">{REVIEW_LABEL[concept.status]}</p>
        <p className="text-[12px] text-muted-foreground">Simulated local approval — separate from Brand DNA and collection approval. No real authentication.</p>
      </div>
      <ConceptReviewControls concept={concept} />
      <div className="space-y-2">
        <p className="t-meta">Save to collection</p>
        <div className="flex gap-1.5">
          <select value={collectionId} onChange={(e) => setCollectionId(e.target.value)} aria-label="Collection" className="h-8 min-w-0 flex-1 border border-hairline bg-card px-2 text-[13px]">
            {collections.map((c) => <option key={c.id} value={c.id}>{c.season} · {c.name}</option>)}
          </select>
          <Button size="sm" className="h-8 rounded-none" onClick={() => {
            const r = saveToCollection(concept.id, collectionId);
            const name = collections.find((c) => c.id === collectionId)?.name;
            if (r.ok) toast.success(`Saved to ${name}`); else toast.info(r.reason === "duplicate" ? `Already in ${name}` : "Could not save");
          }}>Save</Button>
        </div>
      </div>
      <div>
        <p className="t-meta mb-1">History</p>
        {reviews.length ? (
          <ol className="divide-y divide-hairline border-y border-hairline text-[12px]">
            {reviews.map((r) => (
              <li key={r.id} className="py-2">
                {REVIEW_LABEL[r.from]} → <strong className="font-medium">{REVIEW_LABEL[r.to]}</strong> · v{versions.find((v) => v.id === r.versionId)?.number}
                <span className="block text-muted-foreground">{r.actor} · {new Date(r.at).toLocaleString("en-GB")}</span>
                {r.note && <span className="block">“{r.note}”</span>}
              </li>
            ))}
          </ol>
        ) : <p className="text-[12px] text-muted-foreground">No review activity yet.</p>}
      </div>
      <NextSteps concept={concept} />
    </div>
  );
}
