import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-hairline px-6 py-16 text-center">
      <Icon className="size-5 text-stone" aria-hidden />
      <p className="t-heading">{title}</p>
      <p className="t-body max-w-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}
