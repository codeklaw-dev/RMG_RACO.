import type { CapabilityState } from "@/lib/types/domain";
import { PageHeader } from "./page-header";

/** Structured stub for modules scheduled in later phases. Not clickable as if functional. */
export function ModulePlaceholder({
  eyebrow,
  title,
  description,
  capability,
  phase,
  scope,
  notice,
}: {
  eyebrow: string;
  title: string;
  description: string;
  capability: CapabilityState;
  phase: number;
  scope: string[];
  notice?: string;
}) {
  return (
    <div className="space-y-10">
      <PageHeader eyebrow={eyebrow} title={title} description={description} capability={capability} />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid aspect-[16/9] place-items-center border border-dashed border-hairline bg-card">
          <div className="text-center">
            <p className="t-meta">Workspace arrives in Phase {phase}</p>
            <p className="font-display mt-2 text-3xl text-stone">{title}</p>
          </div>
        </div>
        <div className="space-y-6">
          <div>
            <p className="t-meta mb-3">Planned scope</p>
            <ul className="divide-y divide-hairline border-y border-hairline">
              {scope.map((s) => (
                <li key={s} className="t-body py-2.5">{s}</li>
              ))}
            </ul>
          </div>
          {notice && <p className="t-body border-l-2 border-oxblood pl-3 text-muted-foreground">{notice}</p>}
        </div>
      </div>
    </div>
  );
}
