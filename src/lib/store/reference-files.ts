"use client";
// In-tab registry of reference image object URLs. Never persisted: after a
// reload, uploaded references keep their metadata but show as unavailable.
import { create } from "zustand";
import type { ID } from "@/lib/types/domain";
import type { BrandReference } from "@/lib/types/brand";

interface ReferenceFilesState {
  urls: Record<ID, string>;
  attach: (id: ID, file: Blob) => void;
  detach: (id: ID) => void;
  clear: () => void;
}

export const useReferenceFiles = create<ReferenceFilesState>()((set, get) => ({
  urls: {},
  attach: (id, file) => {
    const prev = get().urls[id];
    if (prev) URL.revokeObjectURL(prev);
    set((s) => ({ urls: { ...s.urls, [id]: URL.createObjectURL(file) } }));
  },
  detach: (id) => {
    const url = get().urls[id];
    if (url) URL.revokeObjectURL(url);
    set((s) => {
      const rest = { ...s.urls };
      delete rest[id];
      return { urls: rest };
    });
  },
  clear: () => {
    Object.values(get().urls).forEach((u) => URL.revokeObjectURL(u));
    set({ urls: {} });
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", (e) => {
    if (!e.persisted) useReferenceFiles.getState().clear();
  });
}

/** Demo fixtures have no file and are always available as placeholders. */
export const isPlaceholderReference = (r: BrandReference) => r.fileName === null;
export const referenceAvailable = (r: BrandReference, urls: Record<ID, string>) => isPlaceholderReference(r) || Boolean(urls[r.id]);
