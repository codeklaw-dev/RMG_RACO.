import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHandoffStore } from "@/lib/store/handoff-store";
import { useStudioStore } from "@/lib/store/studio-store";
import { TryOnView } from "./try-on-view";

let query = "concept=cpt_01";
const push = vi.fn((href: string) => { query = href.split("?")[1] ?? ""; });
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query), useRouter: () => ({ push }), usePathname: () => "/try-on" }));
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(async () => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  localStorage.clear();
  useStudioStore.getState().reset();
  useHandoffStore.getState().reset();
  await useStudioStore.persist.rehydrate();
  query = "concept=cpt_01";
  push.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("Virtual Try-On", { timeout: 20_000 }, () => {
  it("selects a garment from the picker", async () => {
    query = "";
    render(<TryOnView />);
    await advance(10);
    expect(screen.getAllByText("Choose a garment").length).toBeGreaterThan(0);
    const picker = screen.getAllByRole("complementary", { name: "Garment selection" })[0];
    fireEvent.click(within(picker).getAllByRole("button", { name: /Extended-shoulder wrap coat/ })[0]);
    expect(push).toHaveBeenCalledWith("/try-on?concept=cpt_01");
  });

  it("selects models and limits poses to what the model supports", async () => {
    render(<TryOnView />);
    await advance(10);
    const controls = screen.getAllByRole("complementary", { name: "Fitting controls" })[0];
    fireEvent.click(within(controls).getByRole("radio", { name: "Avatar C" }));
    expect(within(controls).queryByRole("radio", { name: "Walking" })).toBeNull();
    expect(within(controls).getByRole("radio", { name: "Three-quarter" })).toBeInTheDocument();
  });

  it("generates a clearly labelled conceptual preview and saves it", async () => {
    render(<TryOnView />);
    await advance(10);
    expect(screen.getByText(/Avatar only/)).toBeInTheDocument();
    const controls = screen.getAllByRole("complementary", { name: "Fitting controls" })[0];
    fireEvent.click(within(controls).getByRole("button", { name: /Generate preview/ }));
    await advance(6000);
    expect(screen.getByRole("status")).toHaveTextContent("Conceptual fitting preview — simulated, not physically accurate");
    expect(screen.getAllByRole("img", { name: /Conceptual fitting preview — simulated, not physically accurate: schematic avatar/ }).length).toBeGreaterThan(0);
    fireEvent.click(within(controls).getByRole("button", { name: /Save preview/ }));
    const saved = useHandoffStore.getState().previews.filter((p) => p.saved && p.jobId);
    expect(saved).toHaveLength(1);
  });

  it("compares two saved previews side by side", async () => {
    render(<TryOnView />);
    await advance(10);
    const picks = screen.getAllByRole("button", { name: /Select preview .* for comparison/ });
    fireEvent.click(picks[0]);
    fireEvent.click(picks[1]);
    fireEvent.click(screen.getByRole("button", { name: /Compare 2\/2/ }));
    expect(screen.getAllByRole("img", { name: /Conceptual fitting preview/ }).length).toBeGreaterThanOrEqual(2 + picks.length);
  });

  it("switching garment mid-generation discards the run (no stale preview)", async () => {
    const { rerender } = render(<TryOnView />);
    await advance(10);
    const controls = screen.getAllByRole("complementary", { name: "Fitting controls" })[0];
    fireEvent.click(within(controls).getByRole("button", { name: /Generate preview/ }));
    await advance(1200);
    query = "concept=cpt_03";
    rerender(<TryOnView />);
    await advance(8000);
    expect(useHandoffStore.getState().previews.filter((p) => p.jobId)).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent(/Avatar only/);
  });
});
