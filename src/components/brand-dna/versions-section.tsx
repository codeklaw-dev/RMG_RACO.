"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { diffContent } from "@/lib/brand/intelligence";
import { approvedVersion, workingVersion } from "@/lib/brand/versioning";
import { useBrandStore } from "@/lib/store/brand-store";
import { useStudioStore } from "@/lib/store/studio-store";
import { SectionHeader } from "./shared";
import { VersionStatus } from "./workflow-bar";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

export function VersionsSection() {
  const versions = useBrandStore((s) => s.versions);
  const restore = useBrandStore((s) => s.restore);
  const jobs = useStudioStore((s) => s.jobs);
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const defaultB = workingVersion(versions) ?? approvedVersion(versions) ?? sorted[0];
  const defaultA = versions.find((v) => v.version === defaultB.basedOnVersion) ?? sorted[1] ?? defaultB;
  const [pair, setPair] = useState<[number, number]>([defaultA.version, defaultB.version]);
  const a = versions.find((v) => v.version === pair[0]) ?? defaultA;
  const b = versions.find((v) => v.version === pair[1]) ?? defaultB;
  const changes = diffContent(a.content, b.content);
  const select = "h-8 border border-hairline bg-card px-2 text-[13px]";

  return (
    <div>
      <SectionHeader title="Versions" description="Approved versions are immutable snapshots. Restoring copies a version into a new draft; nothing is overwritten." />
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <ol className="divide-y divide-hairline border-y border-hairline">
          {sorted.map((v) => {
            const used = jobs.filter((j) => j.request.brandContext?.version === v.version).length;
            return (
              <li key={v.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[14px] font-medium">v{v.version} <VersionStatus status={v.status} /></p>
                  <p className="t-body text-charcoal">{v.note}</p>
                  <p className="t-meta mt-1">
                    {v.basedOnVersion ? `from v${v.basedOnVersion} · ` : ""}edited {fmt(v.updatedAt)}
                    {v.approvedAt && v.status !== "draft" && v.status !== "in_review" ? ` · approved ${fmt(v.approvedAt)}` : ""}
                    {used ? ` · used by ${used} generation${used > 1 ? "s" : ""}` : ""}
                  </p>
                  {v.approvedBy && (v.status === "approved" || v.status === "archived") && <p className="text-[12px] text-muted-foreground">{v.approvedBy}</p>}
                </div>
                {v.status !== "draft" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-none"
                    onClick={() => {
                      const res = restore(v.version);
                      if (res.ok) toast.success(`v${v.version} restored into a new draft`);
                      else toast.error(res.error);
                    }}
                  >
                    Restore as draft
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="t-meta">Compare</p>
            <select aria-label="From version" className={select} value={a.version} onChange={(e) => setPair([Number(e.target.value), pair[1]])}>
              {sorted.map((v) => <option key={v.id} value={v.version}>v{v.version}</option>)}
            </select>
            <span className="text-stone">→</span>
            <select aria-label="To version" className={select} value={b.version} onChange={(e) => setPair([pair[0], Number(e.target.value)])}>
              {sorted.map((v) => <option key={v.id} value={v.version}>v{v.version}</option>)}
            </select>
          </div>
          {changes.length ? (
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="t-meta border-b border-hairline">
                  <th className="py-2 pr-3 font-normal">Field</th>
                  <th className="py-2 pr-3 font-normal">v{a.version}</th>
                  <th className="py-2 font-normal">v{b.version}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {changes.map((c, i) => (
                  <tr key={i} className="align-top">
                    <td className="py-2 pr-3"><span className="t-meta block text-[9px]">{c.section}</span>{c.label}</td>
                    <td className="py-2 pr-3 text-muted-foreground line-through decoration-hairline">{c.from}</td>
                    <td className="py-2">{c.to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="t-body text-muted-foreground">No differences between v{a.version} and v{b.version}.</p>
          )}
        </div>
      </div>
    </div>
  );
}
