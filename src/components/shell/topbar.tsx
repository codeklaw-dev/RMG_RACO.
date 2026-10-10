"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NAV } from "@/lib/config/nav";
import { ORG } from "@/lib/fixtures";
import { StartDemoButton } from "@/components/demo/demo-controls";
import { BrandMark } from "./brand-mark";
import { NavList } from "./nav-list";

const LABELS = Object.fromEntries(NAV.flatMap((g) => g.items).map((i) => [i.href.slice(1), i.label]));

export function Topbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-hairline bg-paper/90 px-4 backdrop-blur-sm md:px-8">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" />}>
          <Menu />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center border-b border-sidebar-border px-5">
            <BrandMark />
          </div>
          <div className="px-2 py-4">
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <li className="hidden sm:block">
            <Link href="/" className="hover:text-ink">{ORG.name}</Link>
          </li>
          <li aria-hidden className="hidden sm:block">/</li>
          <li className="truncate text-ink" aria-current="page">
            {segments.length ? LABELS[segments[0]] ?? segments[0] : "Overview"}
          </li>
        </ol>
      </nav>

      <span className="t-meta hidden items-center gap-2 md:flex">
        <span className="size-1.5 rounded-full bg-oxblood" aria-hidden />
        Demo environment · no live models
      </span>
      <span className="hidden sm:inline-flex"><StartDemoButton /></span>
      <Button size="sm" render={<Link href="/studio" />} nativeButton={false}>
        <Plus /> New concept
      </Button>
    </header>
  );
}
