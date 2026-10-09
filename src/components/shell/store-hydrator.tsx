"use client";
import { useEffect } from "react";
import { useBrandStore } from "@/lib/store/brand-store";
import { useStudioStore } from "@/lib/store/studio-store";

/** Rehydrates persisted demo state after mount to avoid hydration mismatches. */
export function StoreHydrator() {
  useEffect(() => {
    void useStudioStore.persist.rehydrate();
    void useBrandStore.persist.rehydrate();
  }, []);
  return null;
}
