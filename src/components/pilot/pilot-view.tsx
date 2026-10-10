"use client";
import Link from "next/link";
import { CheckCircle2, CircleDashed, Server } from "lucide-react";
import { ResetDemoButton, StartDemoButton } from "@/components/demo/demo-controls";
import { PageHeader } from "@/components/shared/page-header";
import { capabilityRegistry, STATUS_COPY, type CapabilityStatus } from "@/lib/config/capabilities";
import { getAIProvider } from "@/lib/services";
import { cn } from "@/lib/utils";

const ICON = { functional: CheckCircle2, simulated: CircleDashed, production_required: Server } as const;

const LAYERS = [
  ["Client UI", "This Next.js app — unchanged screens, typed API client"],
  ["Application API", "Typed /api/v1 routes or a service; Zod validation, org-scoped auth, rate limits"],
  ["Business services", "Brand DNA, versions, collections, reviews, technical briefs"],
  ["AI orchestration", "Job queue, idempotency, retries, cost caps, provider adapters"],
  ["Model execution", "GPU workers: generation, editing/inpainting, reference conditioning, try-on"],
] as const;

const PLAN = [
  "Benchmark 2–3 image models on 20 blind Serein-style briefs (originality, brand fit, edit control)",
  "Measure real latency and cost per accepted concept; set per-org cost caps",
  "Collect authorised brand references with rights metadata; build retrieval index",
  "Agree an evaluation rubric with the design team; run Explore vs Brand vs Hybrid",
  "Legal review: model licences (incl. try-on), IP, data retention",
  "Stand up secure infrastructure: auth/RBAC, Postgres, private storage, audit log",
];

export function PilotView() {
  const caps = capabilityRegistry(getAIProvider());
  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Pilot readiness"
        title="What's real, what's simulated, what's next."
        description="Generated from the capability registry. A feature is listed as functional only when it genuinely works in this demo."
        actions={<><StartDemoButton /><ResetDemoButton /></>}
      />
      <div className="grid gap-px border border-hairline bg-hairline lg:grid-cols-3">
        {(Object.keys(STATUS_COPY) as CapabilityStatus[]).map((status) => {
          const Icon = ICON[status];
          const items = caps.filter((c) => c.status === status);
          return (
            <section key={status} aria-label={STATUS_COPY[status].title} className="bg-card p-5">
              <h2 className="flex items-center gap-2 font-display text-2xl"><Icon className={cn("size-5", status === "simulated" && "text-oxblood")} /> {STATUS_COPY[status].title}</h2>
              <p className="t-body mt-1 text-muted-foreground">{STATUS_COPY[status].blurb}</p>
              <ul className="mt-4 divide-y divide-hairline border-y border-hairline" data-status={status}>
                {items.map((c) => (
                  <li key={c.id} className="py-2.5">
                    <p className="text-[13px] font-medium">{c.route ? <Link href={c.route} className="hover:underline">{c.label}</Link> : c.label}</p>
                    <p className="text-[12px] text-muted-foreground">{c.detail}</p>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section aria-label="Recommended pilot architecture" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <h2 className="t-title mb-4">Recommended pilot architecture</h2>
          <ol className="space-y-2">
            {LAYERS.map(([name, d], i) => (
              <li key={name} className="grid grid-cols-[28px_1fr] items-start gap-3 border border-hairline bg-card p-3">
                <span className="t-meta pt-0.5">{String(i + 1).padStart(2, "0")}</span>
                <span><span className="block text-[14px] font-medium">{name}</span><span className="text-[12px] text-muted-foreground">{d}</span></span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[12px] text-muted-foreground">Cross-cutting: PostgreSQL + Prisma, private object storage with signed URLs, audit logging on every mutation, monitoring of errors, latency and cost.</p>
        </div>
        <div>
          <h2 className="t-title mb-4">Proposed pilot plan</h2>
          <ol className="space-y-2 text-[13px]">
            {PLAN.map((p, i) => <li key={p} className="grid grid-cols-[28px_1fr] gap-3"><span className="t-meta pt-0.5">{String(i + 1).padStart(2, "0")}</span>{p}</li>)}
          </ol>
          <p className="mt-4 border-l-2 border-oxblood pl-3 text-[13px] text-charcoal">Attractive renders are not production feasibility. The pilot measures time saved, accepted-concept rate and rework — not image quality alone.</p>
        </div>
      </section>
    </div>
  );
}
