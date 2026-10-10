"use client";
// Non-modal guided demo bar: sits at the bottom, never blocks the page, and
// every scene is a normal link. Alt+→ / Alt+← move between scenes.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { demoScenes } from "@/lib/demo/scenes";
import { useDemoStore } from "@/lib/store/demo-store";
import { cn } from "@/lib/utils";

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

export function DemoBar() {
  const router = useRouter();
  const { active, index, go, exit, start } = useDemoStore();
  // Cues start open on wide screens and collapsed on phones; the user's toggle wins.
  const wide = useMediaQuery("(min-width: 768px)");
  const [toggled, setOpen] = useState<boolean | null>(null);
  const open = toggled ?? wide;
  const scenes = demoScenes();
  const scene = scenes[index];
  const last = index === scenes.length - 1;

  const move = (to: number) => {
    const next = Math.min(Math.max(0, to), scenes.length - 1);
    go(next, scenes.length);
    router.push(scenes[next].steps[0].href);
  };

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || isTyping(e.target)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); move(index + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); move(index - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!active || !scene) return null;
  return (
    <>
      <div aria-hidden className={open ? "h-40" : "h-16"} />
      <section aria-label="Guided demo" className="fixed inset-x-0 bottom-0 z-40 border-t border-ink bg-paper/97 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur-sm lg:left-60">
        <div className="mx-auto max-w-5xl px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <ol className="flex gap-1" aria-label="Scene progress">
              {scenes.map((s, i) => (
                <li key={s.id}>
                  <button onClick={() => move(i)} aria-current={i === index ? "step" : undefined} aria-label={`Scene ${i + 1}: ${s.title}`} className={cn("h-1.5 w-8 transition-colors", i < index ? "bg-ink" : i === index ? "bg-oxblood" : "bg-hairline")} />
                </li>
              ))}
            </ol>
            <p className="min-w-0 flex-1 text-[13px]">
              <span className="t-meta mr-2">Scene {index + 1}/{scenes.length}</span>
              <span className="font-medium">{scene.title}</span>
              <span className="hidden text-muted-foreground md:inline"> — {scene.summary}</span>
            </p>
            <div className="flex gap-1">
              <Button size="icon-sm" variant="ghost" aria-label={open ? "Hide presenter cues" : "Show presenter cues"} onClick={() => setOpen(!open)}>{open ? <ChevronDown /> : <ChevronUp />}</Button>
              <Button size="sm" variant="outline" className="rounded-none" disabled={index === 0} onClick={() => move(index - 1)}><ChevronLeft /> Previous</Button>
              {last ? (
                <Button size="sm" className="rounded-none" onClick={() => { router.push("/pilot"); exit(); }}>Finish</Button>
              ) : (
                <Button size="sm" className="rounded-none" onClick={() => move(index + 1)}>Next <ChevronRight /></Button>
              )}
              <Button size="icon-sm" variant="ghost" aria-label="Restart demo" onClick={() => { start(); router.push(scenes[0].steps[0].href); }}><RotateCcw /></Button>
              <Button size="icon-sm" variant="ghost" aria-label="Exit demo" onClick={exit}><X /></Button>
            </div>
          </div>
          {open && (
            <div className="mt-3 grid gap-3 border-t border-hairline pt-3 md:grid-cols-[1fr_auto]">
              <ul className="grid gap-x-6 gap-y-1 text-[12px] text-charcoal sm:grid-cols-2">
                {scene.cues.map((c) => <li key={c}>· {c}</li>)}
              </ul>
              <div className="flex flex-wrap items-start gap-1.5">
                {scene.steps.map((s) => <Link key={s.href} href={s.href} className="border border-hairline bg-card px-2.5 py-1 text-[12px] hover:border-ink">{s.label} →</Link>)}
              </div>
              <p className="t-meta md:col-span-2">Alt + ← / → to change scene · everything stays clickable</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
