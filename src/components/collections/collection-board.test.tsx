import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COLLECTIONS } from "@/lib/fixtures";
import { useStudioStore } from "@/lib/store/studio-store";
import { CollectionBoard } from "./collection-board";
import { PresentationView } from "./presentation-view";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/collections/col_aw26", useSearchParams: () => new URLSearchParams() }));

beforeEach(async () => {
  localStorage.clear();
  useStudioStore.getState().reset();
  await useStudioStore.persist.rehydrate();
  push.mockReset();
});
afterEach(() => vi.useRealTimers());

const ids = () => useStudioStore.getState().collections.find((c) => c.id === "col_aw26")!.conceptIds;

describe("collection board", { timeout: 20_000 }, () => {
  it("reorders with keyboard-accessible move buttons", () => {
    render(<CollectionBoard collection={COLLECTIONS[0]} />);
    const before = [...ids()];
    const first = useStudioStore.getState().concepts.find((c) => c.id === before[0])!;
    fireEvent.click(screen.getByRole("button", { name: `Move ${first.title} later` }));
    expect(ids().slice(0, 2)).toEqual([before[1], before[0]]);
    expect(screen.getByRole("button", { name: `Move ${useStudioStore.getState().concepts.find((c) => c.id === ids()[0])!.title} earlier` })).toBeDisabled();
  });

  it("exposes drag handles with keyboard instructions", () => {
    render(<CollectionBoard collection={COLLECTIONS[0]} />);
    expect(screen.getAllByRole("button", { name: /Space to pick up, arrow keys to move/ })).toHaveLength(ids().length);
  });

  it("approves a concept through review and saves a creative direction note", () => {
    render(<CollectionBoard collection={COLLECTIONS[0]} />);
    fireEvent.change(screen.getByLabelText("Creative direction"), { target: { value: "Narrow shoulders, tonal" } });
    const approved = () => useStudioStore.getState().concepts.filter((c) => ids().includes(c.id) && c.status === "approved").length;
    const before = approved();
    fireEvent.click(screen.getAllByRole("button", { name: "Submit for review" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Approve (simulated)" })[0]);
    expect(approved()).toBe(before + 1);
    expect(useStudioStore.getState().reviews.slice(0, 2).map((r) => r.to)).toEqual(["approved", "in_review"]);
    expect(useStudioStore.getState().collections.find((c) => c.id === "col_aw26")!.creativeDirection).toBe("Narrow shoulders, tonal");
  });
});

describe("presentation mode", { timeout: 20_000 }, () => {
  it("navigates with the keyboard, hides editing controls, keeps honest labels and exits", async () => {
    render(<PresentationView collectionId="col_aw26" />);
    await act(async () => {});
    expect(screen.getByRole("heading", { level: 1, name: "Quiet Architecture" })).toBeInTheDocument();
    expect(screen.getByText(/Simulated concepts · schematic placeholders/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Submit for review|Save|Remove/ })).toBeNull();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const first = useStudioStore.getState().concepts.find((c) => c.id === ids()[0])!;
    // Role queries are unreliable mid-GSAP-tween in jsdom; assert on the slide heading itself.
    expect(document.querySelector("main h2")?.textContent).toBe(first.title);
    expect(screen.getByText(`Look 01 / ${String(ids().length).padStart(2, "0")}`)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "End" });
    expect(screen.getByText(/looks approved for development/, { ignore: "script" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(push).toHaveBeenCalledWith("/collections/col_aw26");
  });
});
