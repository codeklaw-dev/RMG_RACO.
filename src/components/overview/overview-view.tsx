"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Fingerprint, Layers, PenTool, Sparkles } from "lucide-react";
import { ConceptCard } from "@/components/shared/concept-card";
import { GarmentPlaceholder } from "@/components/shared/garment-placeholder";
import { JobRow } from "@/components/shared/job-row";
import { PageHeader } from "@/components/shared/page-header";
import { Reveal } from "@/components/shared/reveal";
import { Section } from "@/components/shared/section";
import { StartDemoButton } from "@/components/demo/demo-controls";
import { Button } from "@/components/ui/button";
import { CURRENT_USER, ORG } from "@/lib/fixtures";
import { completeness } from "@/lib/brand/intelligence";
import { getAIProvider } from "@/lib/services";
import { useApprovedVersion, useBrandStore } from "@/lib/store/brand-store";
import { useStudioStore } from "@/lib/store/studio-store";
import type { GenerationJob } from "@/lib/types/domain";

const QUICK_ACTIONS = [
  { href: "/studio", label: "Generate concepts", hint: "Text and references to garment ideas", icon: Sparkles },
  { href: "/editor", label: "Refine a design", hint: "Conversational edits and versions", icon: PenTool },
  { href: "/brand-dna", label: "Update Brand DNA", hint: "Rules, palette, references", icon: Fingerprint },
  { href: "/collections", label: "Open collections", hint: "Seasons, capsules, boards", icon: Layers },
];

export function OverviewView() {
  const concepts = useStudioStore((s) => s.concepts);
  const collections = useStudioStore((s) => s.collections).filter((c) => c.orgId === ORG.id);
  const approved = useApprovedVersion();
  const brandRefs = useBrandStore((s) => s.references);
  const brand = approved ? { version: approved.version, summary: approved.content.description, palette: approved.content.palette, completeness: completeness(approved.content, brandRefs).score } : null;
  const [jobs, setJobs] = useState<GenerationJob[]>([]);

  const studioJobs = useStudioStore((s) => s.jobs);
  useEffect(() => {
    const provider = getAIProvider();
    const tick = () => {
      const fromAdapter = provider.listJobs(ORG.id);
      const known = new Set(fromAdapter.map((j) => j.id));
      // Jobs from earlier sessions live only in the persisted store.
      setJobs([...fromAdapter, ...studioJobs.map((r) => r.job).filter((j) => !known.has(j.id))]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [studioJobs]);

  const recent = [...concepts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  const firstName = CURRENT_USER.name.split(" ")[0];

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Overview · Thursday 9 October"
        title={`${firstName}, Quiet Architecture is in review.`}
        description="Six AW26 looks are waiting on sign-off. Resort27 needs two more outerwear directions before the line review."
        actions={
          <>
            <StartDemoButton size="default" />
            <Button variant="outline" render={<Link href="/collections/col_aw26" />} nativeButton={false}>
              Review AW26
            </Button>
            <Button render={<Link href="/studio" />} nativeButton={false}>
              <Sparkles /> New concept
            </Button>
          </>
        }
      />

      <Reveal className="grid grid-cols-2 border-l border-t border-hairline lg:grid-cols-4">
        {QUICK_ACTIONS.map(({ href, label, hint, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-6 border-b border-r border-hairline p-5 transition-colors outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <div className="flex items-center justify-between">
              <Icon className="size-4" strokeWidth={1.5} aria-hidden />
              <ArrowUpRight className="size-4 text-stone transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
            </div>
            <div>
              <p className="text-[14px] font-medium">{label}</p>
              <p className="t-body mt-1 text-muted-foreground">{hint}</p>
            </div>
          </Link>
        ))}
      </Reveal>

      <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Section
          title="Recent concepts"
          action={<Link href="/studio" className="t-meta hover:text-ink">Open studio</Link>}
        >
          <Reveal className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {recent.map((c) => (
              <ConceptCard key={c.id} concept={c} />
            ))}
          </Reveal>
        </Section>

        <div className="space-y-12">
          <Section title="Generation activity">
            <ul className="divide-y divide-hairline" aria-live="polite">
              {jobs.map((j) => (
                <JobRow key={j.id} job={j} />
              ))}
            </ul>
            <p className="t-meta">Demo adapter · simulated queue, no model inference</p>
          </Section>

          {brand && (
            <Section title="Brand DNA" action={<Link href="/brand-dna" className="t-meta hover:text-ink">Edit</Link>}>
              <div className="space-y-4">
                <div className="flex items-baseline justify-between">
                  <p className="t-title">{brand.completeness}%</p>
                  <p className="t-meta">Approved v{brand.version}</p>
                </div>
                <div className="h-px bg-hairline">
                  <div className="h-px bg-oxblood" style={{ width: `${brand.completeness}%` }} />
                </div>
                <div className="flex gap-1">
                  {brand.palette.map((p) => (
                    <span key={p.hex} title={p.name} className="h-8 flex-1 border border-black/5" style={{ background: p.hex }} />
                  ))}
                </div>
                <p className="t-body text-muted-foreground">{brand.summary}</p>
              </div>
            </Section>
          )}
        </div>
      </div>

      <Section title="Collections" action={<Link href="/collections" className="t-meta hover:text-ink">All collections</Link>}>
        <div className="grid gap-6 md:grid-cols-2">
          {collections.map((col) => {
            const looks = concepts.filter((c) => col.conceptIds.includes(c.id));
            return (
              <Link
                key={col.id}
                href={`/collections/${col.id}`}
                className="group block outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="grid grid-cols-3 gap-1">
                  {looks.slice(0, 3).map((c) => (
                    <GarmentPlaceholder key={c.id} category={c.category} palette={c.palette} silhouette={c.silhouette} seed={c.seed} className="aspect-[3/4]" />
                  ))}
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <p className="font-display text-2xl group-hover:underline">{col.name}</p>
                  <p className="t-meta">{col.season} · {looks.length} looks · {col.status.replace("_", " ")}</p>
                </div>
                <p className="t-body mt-1 text-muted-foreground">{col.description}</p>
              </Link>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
