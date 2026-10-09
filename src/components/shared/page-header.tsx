import type { ReactNode } from "react";
import type { CapabilityState } from "@/lib/types/domain";
import { StatusBadge } from "./status-badge";

export function PageHeader({
  eyebrow,
  title,
  description,
  capability,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  capability?: CapabilityState;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-6 border-b border-hairline pb-8 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl space-y-3">
        <div className="flex items-center gap-3">
          {eyebrow && <p className="t-meta">{eyebrow}</p>}
          {capability && <StatusBadge state={capability} />}
        </div>
        <h1 className="t-display">{title}</h1>
        {description && <p className="t-body max-w-xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
