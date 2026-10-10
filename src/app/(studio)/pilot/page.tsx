import type { Metadata } from "next";
import { PilotView } from "@/components/pilot/pilot-view";

export const metadata: Metadata = { title: "Pilot Readiness" };

export default function PilotPage() {
  return <PilotView />;
}
