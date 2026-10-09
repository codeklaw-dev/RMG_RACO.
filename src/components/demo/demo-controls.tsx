"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FLAGS } from "@/lib/config/flags";
import { resetDemo, userWorkSummary } from "@/lib/demo/reset";
import { demoScenes } from "@/lib/demo/scenes";
import { useDemoStore } from "@/lib/store/demo-store";

function WorkList({ work }: { work: Record<string, number> }) {
  return (
    <ul className="space-y-0.5 text-[13px]">
      {Object.entries(work).map(([k, n]) => <li key={k}>• {n} {k}</li>)}
    </ul>
  );
}

export function ResetDemoButton({ size = "sm" }: { size?: "sm" | "default" }) {
  const [open, setOpen] = useState(false);
  const work = open ? userWorkSummary() : {};
  const custom = Object.keys(work).length > 0;
  return (
    <>
      <Button variant="outline" size={size} className="rounded-none" onClick={() => setOpen(true)}><RotateCcw /> Reset demo</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogTitle className="font-display text-2xl font-normal">Reset demo data?</DialogTitle>
          <DialogDescription>Restores the curated Serein Atelier dataset in this browser.</DialogDescription>
          {custom ? (<><p className="text-[13px]">This will permanently replace work created in this browser:</p><WorkList work={work} /></>) : <p className="text-[13px] text-muted-foreground">No custom work detected; this only restores defaults.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-none" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="rounded-none bg-oxblood hover:bg-oxblood/90" onClick={() => { resetDemo(); setOpen(false); toast.success("Demo data restored"); }}>Reset</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function StartDemoButton({ size = "sm", variant = "outline" }: { size?: "sm" | "default"; variant?: "outline" | "default" }) {
  const router = useRouter();
  const start = useDemoStore((s) => s.start);
  const [work, setWork] = useState<Record<string, number> | null>(null);
  if (!FLAGS.guidedDemo) return null;
  const begin = (reset: boolean) => {
    if (reset) resetDemo();
    setWork(null);
    start();
    router.push(demoScenes()[0].steps[0].href);
  };
  return (
    <>
      <Button variant={variant} size={size} className="rounded-none" onClick={() => { const w = userWorkSummary(); if (Object.keys(w).length) setWork(w); else begin(false); }}>
        <Play /> Guided demo
      </Button>
      <Dialog open={work !== null} onOpenChange={(o) => !o && setWork(null)}>
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogTitle className="font-display text-2xl font-normal">Start the guided demo</DialogTitle>
          <DialogDescription>This browser has work beyond the curated dataset.</DialogDescription>
          {work && <WorkList work={work} />}
          <p className="text-[13px] text-muted-foreground">Keep it to present with your own work, or reset to the curated data for a predictable walkthrough.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" className="rounded-none" onClick={() => begin(false)}>Keep my work</Button>
            <Button className="rounded-none" onClick={() => begin(true)}>Reset &amp; start</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
