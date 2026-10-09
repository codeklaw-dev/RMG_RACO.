import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-baseline justify-between border-b border-hairline pb-2">
        <h2 className="t-heading">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
