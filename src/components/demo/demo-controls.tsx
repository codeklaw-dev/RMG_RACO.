"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FLAGS } from "@/lib/config/flags";
import { describeImpact, resetDemo, resetImpact, type ResetItem } from "@/lib/demo/reset";
import { demoScenes } from "@/lib/demo/scenes";
import { useDemoStore } from "@/lib/store/demo-store";

const RESET_SCOPE = "Concepts, versions, annotations, reviews, collection boards, Brand DNA, references, technical briefs, try-on previews and generation history in this browser.";

export function ImpactList({ items }: { items: ResetItem[] }) {
  return (
    <ul className="max-h-60 space-y-1.5 overflow-y-auto border-y border-hairline py-2 text-[13px]" aria-label="Changes that will be discarded">
      {items.map((i) => (
        <li key={i.area}>
          <span className="font-medium">{i.area}</span> — {describeImpact(i)}
          {i.examples.length > 0 && <span className="block text-[12px] text-muted-foreground">{i.examples.join(" · ")}{i.added + i.modified + i.removed > i.examples.length ? " …" : ""}</span>}
        </li>
      ))}
    </ul>
  );
}

export function ResetDemoButton({ size = "sm" }: { size?: "sm" | "default" }) {
  const [open, setOpen] = useState(false);
  const items = open ? resetImpact() : [];
  const custom = items.length > 0;
  return (
    <>
      <Button variant="outline" size={size} className="rounded-none" onClick={() => setOpen(true)}><RotateCcw /> Reset demo</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogTitle className="font-display text-2xl font-normal">Reset demo data?</DialogTitle>
          <DialogDescription>Restores the curated Serein Atelier dataset in this browser.</DialogDescription>
          <p className="text-[12px] text-muted-foreground">Resets: {RESET_SCOPE}</p>
          {custom ? (<><p className="text-[13px]">These changes will be permanently discarded:</p><ImpactList items={items} /></>) : <p className="text-[13px] text-muted-foreground">No differences from the curated data were found; resetting changes nothing you created.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-none" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="rounded-none bg-oxblood hover:bg-oxblood/90" onClick={() => { resetDemo(); setOpen(false); toast.success("Demo data restored"); }}>{custom ? "Discard changes and reset" : "Reset"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function StartDemoButton({ size = "sm", variant = "outline" }: { size?: "sm" | "default"; variant?: "outline" | "default" }) {
  const router = useRouter();
  const start = useDemoStore((s) => s.start);
  const [work, setWork] = useState<ResetItem[] | null>(null);
  if (!FLAGS.guidedDemo) return null;
  const begin = (reset: boolean) => {
    if (reset) resetDemo();
    setWork(null);
    start();
    router.push(demoScenes()[0].steps[0].href);
  };
  return (
    <>
      <Button variant={variant} size={size} className="rounded-none" onClick={() => { const w = resetImpact(); if (w.length) setWork(w); else begin(false); }}>
        <Play /> Guided demo
      </Button>
      <Dialog open={work !== null} onOpenChange={(o) => !o && setWork(null)}>
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogTitle className="font-display text-2xl font-normal">Start the guided demo</DialogTitle>
          <DialogDescription>This browser differs from the curated dataset:</DialogDescription>
          {work && <ImpactList items={work} />}
          <p className="text-[13px] text-muted-foreground">Keep it to present with your own work, or reset to the curated data for a predictable walkthrough.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" className="rounded-none" onClick={() => begin(false)}>Keep my work</Button>
            <Button className="rounded-none" onClick={() => begin(true)}>Discard changes, reset &amp; start</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
