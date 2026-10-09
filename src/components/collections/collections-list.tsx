"use client";
import Link from "next/link";
import { GarmentPlaceholder } from "@/components/shared/garment-placeholder";
import { ORG } from "@/lib/fixtures";
import { useStudioStore } from "@/lib/store/studio-store";

export function CollectionsList() {
  const collections = useStudioStore((s) => s.collections).filter((c) => c.orgId === ORG.id);
  const concepts = useStudioStore((s) => s.concepts);
  return (
    <ul className="divide-y divide-hairline border-y border-hairline">
      {collections.map((col) => {
        const looks = col.conceptIds.map((id) => concepts.find((c) => c.id === id)).filter((c) => c !== undefined);
        return (
          <li key={col.id}>
            <Link href={`/collections/${col.id}`} className="group grid gap-6 py-6 outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[280px_minmax(0,1fr)]">
              <div>
                <p className="t-meta">{col.season} · {col.status.replace("_", " ")}</p>
                <p className="font-display mt-2 text-3xl group-hover:underline">{col.name}</p>
                <p className="t-body mt-2 text-muted-foreground">{col.description}</p>
                <p className="t-meta mt-4">{looks.length} looks</p>
              </div>
              <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
                {looks.map((c) => (
                  <GarmentPlaceholder key={c.id} category={c.category} palette={c.palette} silhouette={c.silhouette} seed={c.seed} className="aspect-[3/4]" />
                ))}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
