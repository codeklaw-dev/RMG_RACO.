import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorSession } from "@/lib/store/editor-session";
import { useStudioStore } from "@/lib/store/studio-store";
import { useBrandStore } from "@/lib/store/brand-store";
import { EditorView } from "./editor-view";

let query = "concept=cpt_03";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(query),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/editor",
}));

const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(async () => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  localStorage.clear();
  useStudioStore.getState().reset();
  useBrandStore.getState().reset();
  useEditorSession.getState().open(null);
  await useStudioStore.persist.rehydrate();
});
afterEach(() => vi.useRealTimers());

describe("Design Editor", { timeout: 20_000 }, () => {
  it("opens a concept by id with canvas, navigator and inspector", async () => {
    query = "concept=cpt_03";
    render(<EditorView />);
    await advance(10);
    expect(screen.getByRole("heading", { level: 1, name: "Cocoon cape blazer" })).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Canvas tools" })).toBeInTheDocument();
    expect(screen.getAllByText(/v1 · Original/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("125%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "back" }));
    expect(screen.getByRole("img", { name: /back view/ })).toBeInTheDocument();
  });

  it("handles unknown concept ids gracefully", async () => {
    query = "concept=does-not-exist";
    render(<EditorView />);
    await advance(10);
    expect(screen.getByText("This concept isn't available")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Choose another concept" })).toHaveAttribute("href", "/editor");
  });

  it("runs a supported refinement into a new version and refuses unsupported ones", async () => {
    query = "concept=cpt_03";
    render(<EditorView />);
    await advance(10);
    const inspector = screen.getAllByRole("complementary", { name: "Design inspector" })[0];
    fireEvent.click(within(inspector).getByRole("tab", { name: "Refine" }));
    const box = within(inspector).getByRole("textbox", { name: "Refinement request" });
    fireEvent.change(box, { target: { value: "Adjust sleeve proportions" } });
    expect(within(inspector).getByRole("alert")).toHaveTextContent(/Not available in the demo/);
    expect(within(inspector).getByRole("button", { name: /Confirm as new version/ })).toBeDisabled();

    fireEvent.change(box, { target: { value: "Use linen instead of wool" } });
    fireEvent.click(within(inspector).getByRole("button", { name: /Confirm as new version/ }));
    await advance(6000);
    const versions = useStudioStore.getState().versions.filter((v) => v.conceptId === "cpt_03");
    expect(versions.map((v) => v.number)).toEqual([1, 2]);
    expect(versions[1]).toMatchObject({ operation: "edit", capability: "simulated" });
    expect(versions[1].snapshot.fabrics).toEqual(["washed linen"]);
    expect(versions[0].snapshot.fabrics).toEqual(["Wool gabardine"]);
  });
});
