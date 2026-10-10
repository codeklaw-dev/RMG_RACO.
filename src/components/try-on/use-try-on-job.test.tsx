import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_VERSIONS } from "@/lib/fixtures/demo";
import { getAIProvider } from "@/lib/services";
import { DURATION_MS, QUEUE_MS } from "@/lib/services/demo-adapter";
import { useHandoffStore } from "@/lib/store/handoff-store";
import { useStudioStore } from "@/lib/store/studio-store";
import { useTryOnJob } from "./use-try-on-job";

const v2 = DEMO_VERSIONS[0];
let n = 0;
const request = () => ({
  orgId: "org_serein", conceptId: "cpt_01", versionId: v2.id, modelId: "fm_a", pose: "standing" as const, background: "paper" as const, colour: null,
  garment: { title: v2.snapshot.title, silhouette: v2.snapshot.silhouette, palette: v2.snapshot.palette, seed: v2.snapshot.seed },
  consentConfirmed: true as const, idempotencyKey: `key_hook_${++n}_${Date.now()}`,
});
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const newPreviews = () => useHandoffStore.getState().previews.filter((p) => p.jobId);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  localStorage.clear();
  useStudioStore.getState().reset();
  useHandoffStore.getState().reset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useTryOnJob concurrency", () => {
  it("completes a run and records exactly one preview", async () => {
    const { result } = renderHook(() => useTryOnJob());
    await act(async () => { void result.current.start(request()); });
    await advance(QUEUE_MS + DURATION_MS.try_on + 500);
    expect(result.current.job?.status).toBe("succeeded");
    expect(result.current.result?.label).toMatch(/Conceptual fitting preview/);
    expect(newPreviews()).toHaveLength(1);
  });

  it("ignores a second start while a run is active (no duplicate jobs or timers)", async () => {
    const spy = vi.spyOn(getAIProvider(), "virtualTryOn");
    const { result } = renderHook(() => useTryOnJob());
    let second: unknown;
    await act(async () => {
      void result.current.start(request());
      second = await result.current.start(request());
    });
    expect(second).toEqual({ ok: false, error: "A preview is already being generated" });
    expect(spy).toHaveBeenCalledTimes(1);
    await advance(QUEUE_MS + DURATION_MS.try_on + 500);
    expect(newPreviews()).toHaveLength(1);
  });

  it("stops updating after cancel and never stores a preview", async () => {
    const spy = vi.spyOn(getAIProvider(), "getJob");
    const { result } = renderHook(() => useTryOnJob());
    await act(async () => { void result.current.start(request()); });
    await advance(QUEUE_MS + 500);
    await act(async () => { await result.current.cancel(); });
    expect(result.current.job?.status).toBe("canceled");
    const callsAfterCancel = spy.mock.calls.length;
    await advance(DURATION_MS.try_on * 2);
    expect(spy.mock.calls.length).toBe(callsAfterCancel);
    expect(result.current.job?.status).toBe("canceled");
    expect(newPreviews()).toHaveLength(0);
  });

  it("abandons the run when the garment changes (reset) — no stale result arrives later", async () => {
    const cancelSpy = vi.spyOn(getAIProvider(), "cancelJob");
    const { result } = renderHook(() => useTryOnJob());
    await act(async () => { void result.current.start(request()); });
    await advance(QUEUE_MS + 300);
    act(() => result.current.reset());
    expect(result.current.job).toBeNull();
    await advance(DURATION_MS.try_on * 2);
    expect(result.current.job).toBeNull();
    expect(result.current.result).toBeNull();
    expect(newPreviews()).toHaveLength(0);
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    // A fresh run can start right away.
    await act(async () => { void result.current.start(request()); });
    await advance(QUEUE_MS + DURATION_MS.try_on + 500);
    expect(newPreviews()).toHaveLength(1);
  });

  it("cleans up on unmount: provider job canceled, no state updates or previews afterwards", async () => {
    const errors = vi.spyOn(console, "error");
    const cancelSpy = vi.spyOn(getAIProvider(), "cancelJob");
    const { result, unmount } = renderHook(() => useTryOnJob());
    await act(async () => { void result.current.start(request()); });
    await advance(QUEUE_MS + 300);
    unmount();
    await advance(DURATION_MS.try_on * 2);
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(newPreviews()).toHaveLength(0);
    expect(errors).not.toHaveBeenCalled();
  });

  it("cancels a job whose start resolves after the run was abandoned", async () => {
    const provider = getAIProvider();
    const real = provider.virtualTryOn.bind(provider);
    let release!: () => void;
    vi.spyOn(provider, "virtualTryOn").mockImplementation(async (r) => { await new Promise<void>((res) => { release = res; }); return real(r); });
    const cancelSpy = vi.spyOn(provider, "cancelJob");
    const { result } = renderHook(() => useTryOnJob());
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.start(request()); });
    act(() => result.current.reset()); // switch garment before the job id exists
    await act(async () => { release(); await pending; });
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    await advance(DURATION_MS.try_on * 2);
    expect(result.current.job).toBeNull();
    expect(newPreviews()).toHaveLength(0);
  });
});
