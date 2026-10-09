"use client";
import { useEffect } from "react";
import { useStudioStore } from "@/lib/store/studio-store";

/** Rehydrates persisted demo state after mount to avoid hydration mismatches. */
export function StoreHydrator() {
  useEffect(() => {
    void useStudioStore.persist.rehydrate();
  }, []);
  return null;
}
