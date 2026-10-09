import type { ReactNode } from "react";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { StoreHydrator } from "@/components/shell/store-hydrator";
import { Topbar } from "@/components/shell/topbar";

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
        Skip to content
      </a>
      <StoreHydrator />
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 md:px-8 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
