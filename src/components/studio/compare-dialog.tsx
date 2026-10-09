"use client";
import { GarmentPlaceholder } from "@/components/shared/garment-placeholder";
import { StatusBadge } from "@/components/shared/status-badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Concept } from "@/lib/types/domain";

const FIELDS: [string, (c: Concept) => string][] = [
  ["Mode", (c) => c.mode],
  ["Garment", (c) => c.category],
  ["Silhouette", (c) => c.silhouette],
  ["Fabric", (c) => c.fabrics.join(", ")],
  ["Palette", (c) => c.palette.map((p) => p.name).join(", ")],
];

export function CompareDialog({ concepts, open, onOpenChange }: { concepts: Concept[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-none sm:max-w-3xl">
        <DialogTitle className="font-display text-2xl font-normal">Compare concepts</DialogTitle>
        <DialogDescription className="sr-only">Side-by-side comparison of two simulated concepts</DialogDescription>
        <div className="grid grid-cols-2 gap-4">
          {concepts.map((c) => (
            <div key={c.id} className="space-y-3">
              <GarmentPlaceholder category={c.category} palette={c.palette} silhouette={c.silhouette} seed={c.seed} className="aspect-[3/4] w-full" />
              <div className="flex items-center gap-2">
                <StatusBadge state={c.capability} />
              </div>
              <p className="text-[14px] font-medium">{c.title}</p>
              <dl className="divide-y divide-hairline border-y border-hairline text-[12px]">
                {FIELDS.map(([label, get]) => (
                  <div key={label} className="flex justify-between gap-2 py-1.5">
                    <dt className="t-meta">{label}</dt>
                    <dd className="text-right">{get(c)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
