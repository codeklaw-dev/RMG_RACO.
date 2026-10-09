"use client";
import { useEffect } from "react";
import { useBrandStore } from "@/lib/store/brand-store";
import { useDemoStore } from "@/lib/store/demo-store";
import { useHandoffStore } from "@/lib/store/handoff-store";
import { useStudioStore } from "@/lib/store/studio-store";

/** Rehydrates persisted demo state after mount to avoid hydration mismatches. */
export function StoreHydrator() {
  useEffect(() => {
    void useStudioStore.persist.rehydrate();
    void useBrandStore.persist.rehydrate();
    void useHandoffStore.persist.rehydrate();
    void useDemoStore.persist.rehydrate();
  }, []);
  return null;
}
