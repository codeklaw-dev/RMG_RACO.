"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/config/nav";
import { cn } from "@/lib/utils";

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav aria-label="Primary" className="flex flex-col gap-6">
      {NAV.map((group) => (
        <div key={group.group}>
          <p className="t-meta mb-2 px-3">{group.group}</p>
          <ul className="flex flex-col">
            {group.items
              .filter((i) => i.enabled !== false)
              .map(({ href, label, icon: Icon, capability }) => {
                const active = isActive(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-9 items-center gap-3 px-3 text-[13px] text-charcoal transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring",
                        active && "bg-sidebar-accent font-medium text-ink",
                      )}
                    >
                      {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 bg-oxblood" />}
                      <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                      <span className="flex-1">{label}</span>
                      {capability === "planned" && <span className="t-meta text-[9px]">Soon</span>}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
