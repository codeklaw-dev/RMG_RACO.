import { CURRENT_USER, ORG } from "@/lib/fixtures";
import { BrandMark } from "./brand-mark";
import { NavList } from "./nav-list";

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-14 items-center border-b border-sidebar-border px-5">
        <BrandMark />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-6">
        <NavList />
      </div>
      <div className="border-t border-sidebar-border px-5 py-4">
        <p className="text-[13px] font-medium">{CURRENT_USER.name}</p>
        <p className="t-meta mt-0.5">{ORG.name} · Creative Director</p>
      </div>
    </aside>
  );
}
