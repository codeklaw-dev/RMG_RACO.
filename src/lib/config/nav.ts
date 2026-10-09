import {
  Layers,
  LayoutGrid,
  PenTool,
  Ruler,
  Shirt,
  Sparkles,
  Fingerprint,
  type LucideIcon,
} from "lucide-react";
import type { CapabilityState } from "@/lib/types/domain";
import { FLAGS } from "./flags";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  capability?: CapabilityState;
  enabled?: boolean;
}

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Workspace",
    items: [
      { href: "/", label: "Overview", icon: LayoutGrid },
      { href: "/studio", label: "Design Studio", icon: Sparkles, capability: "simulated" },
      { href: "/editor", label: "Design Editor", icon: PenTool },
    ],
  },
  {
    group: "Library",
    items: [
      { href: "/brand-dna", label: "Brand DNA", icon: Fingerprint },
      { href: "/collections", label: "Collections", icon: Layers },
    ],
  },
  {
    group: "Development",
    items: [
      { href: "/try-on", label: "Virtual Try-On", icon: Shirt, capability: "simulated", enabled: FLAGS.virtualTryOn },
      { href: "/technical", label: "Technical", icon: Ruler, capability: "planned", enabled: FLAGS.technicalDevelopment },
    ],
  },
];
