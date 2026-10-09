"use client";
import { activeRules, completeness } from "@/lib/brand/intelligence";
import { useApprovedVersion, useBrandStore } from "@/lib/store/brand-store";
import { useStudioStore } from "@/lib/store/studio-store";
import { Panel, SectionHeader, useEditable } from "./shared";
import { VersionStatus } from "./workflow-bar";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function OverviewSection() {
  const { version, content } = useEditable();
  const approved = useApprovedVersion();
  const references = useBrandStore((s) => s.references);
  const changes = useBrandStore((s) => s.changes);
  const versions = useBrandStore((s) => s.versions);
  const jobs = useStudioStore((s) => s.jobs);
  const { score, checks } = completeness(content, references);
  const rules = activeRules(content);
  const approvedRefs = references.filter((r) => r.approval === "approved").length;
  const usedBy = jobs.filter((j) => j.request.brandContext?.version === approved?.version).length;
  const history = changes.length
    ? changes.slice(0, 6).map((c) => ({ id: c.id, at: c.at, text: c.summary }))
    : [...versions].reverse().map((v) => ({ id: v.id, at: v.updatedAt, text: `v${v.version} ${v.status} — ${v.note}` }));

  return (
    <div className="space-y-8">
      <SectionHeader title={content.name} description={content.description} />
      <div className="grid gap-px border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Showing", <span key="v" className="flex items-center gap-2">v{version.version} <VersionStatus status={version.status} /></span>],
          ["Completeness", `${score}%`],
          ["Active rules", `${rules.filter((r) => r.kind === "positive").length} rules · ${rules.filter((r) => r.kind === "negative").length} exclusions`],
          ["Approved references", String(approvedRefs)],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-card p-4">
            <p className="t-meta">{label}</p>
            <div className="mt-2 font-display text-2xl">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <div>
            <p className="t-meta mb-2">Positioning</p>
            <p className="t-body max-w-2xl">{content.positioning}</p>
          </div>
          <div>
            <p className="t-meta mb-2">Palette</p>
            <div className="flex flex-wrap gap-2">
              {content.palette.map((c) => (
                <div key={c.id} className="w-24">
                  <div className="h-14 border border-black/10" style={{ background: c.hex }} />
                  <p className="mt-1 text-[12px]">{c.name}{c.signature ? " ★" : ""}</p>
                  <p className="t-meta text-[9px]">{c.role} · {c.hex}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="t-meta mb-2">Recent profile changes</p>
            <ul className="divide-y divide-hairline border-y border-hairline">
              {history.map((h) => (
                <li key={h.id} className="flex justify-between gap-4 py-2 text-[13px]">
                  <span>{h.text}</span>
                  <span className="t-meta shrink-0">{fmt(h.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="space-y-4">
          <Panel>
            <p className="t-meta">Completeness</p>
            <div className="mt-2 h-px bg-hairline"><div className="h-px bg-oxblood" style={{ width: `${score}%` }} /></div>
            <ul className="mt-3 space-y-1 text-[12px]">
              {checks.map((c) => (
                <li key={c.label} className={c.done ? "text-charcoal" : "text-oxblood"}>{c.done ? "✓" : "○"} {c.label}</li>
              ))}
            </ul>
          </Panel>
          <Panel>
            <p className="t-meta">Generation</p>
            <p className="t-body mt-2">
              {approved ? <>Approved v{approved.version} · last approved {fmt(approved.approvedAt ?? approved.updatedAt)} · used by {usedBy} Studio request{usedBy === 1 ? "" : "s"}.</> : "No approved version: Brand and Hybrid are disabled."}
            </p>
            <p className="t-body mt-2 text-muted-foreground">Last edited {fmt(version.updatedAt)}.</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
