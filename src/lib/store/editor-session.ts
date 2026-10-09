"use client";
// Ephemeral Editor UI state (not persisted): which version is being viewed,
// comparison target, unsaved draft, canvas view and annotation mode.
import { create } from "zustand";
import type { ConceptSnapshot, ID } from "@/lib/types/domain";

export interface CanvasView {
  zoom: number;
  x: number;
  y: number;
}

export const FIT_VIEW: CanvasView = { zoom: 1, x: 0, y: 0 };

interface EditorSession {
  conceptId: ID | null;
  /** Version shown on the canvas; null = current head. */
  viewVersionId: ID | null;
  compareVersionId: ID | null;
  compare: boolean;
  draft: ConceptSnapshot | null;
  draftSource: "manual" | "refine" | null;
  side: "front" | "back";
  canvas: CanvasView;
  annotate: boolean;
  selectedAnnotationId: ID | null;
  open: (conceptId: ID | null) => void;
  set: (patch: Partial<Omit<EditorSession, "open" | "set">>) => void;
}

export const useEditorSession = create<EditorSession>()((set) => ({
  conceptId: null,
  viewVersionId: null,
  compareVersionId: null,
  compare: false,
  draft: null,
  draftSource: null,
  side: "front",
  canvas: FIT_VIEW,
  annotate: false,
  selectedAnnotationId: null,
  open: (conceptId) =>
    set({ conceptId, viewVersionId: null, compareVersionId: null, compare: false, draft: null, draftSource: null, canvas: FIT_VIEW, annotate: false, selectedAnnotationId: null }),
  set: (patch) => set(patch),
}));
