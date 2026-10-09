import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Vitest runs without globals, so Testing Library's auto-cleanup isn't registered.
afterEach(() => cleanup());

// jsdom lacks matchMedia (used by GSAP matchMedia and layout hooks).
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
}
if (!URL.createObjectURL) URL.createObjectURL = () => "blob:test";
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};

// Node ≥22 exposes an experimental global localStorage that shadows jsdom's
// and is undefined without --localstorage-file. Provide an in-memory Storage.
if (typeof globalThis.localStorage?.clear !== "function") {
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
}
