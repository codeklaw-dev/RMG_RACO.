import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BRIEF } from "@/lib/studio/brief";
import { useStudioSession } from "@/lib/store/studio-session";
import { useStudioStore } from "@/lib/store/studio-store";
import { useBrandStore } from "@/lib/store/brand-store";
import { StudioView } from "./studio-view";

beforeEach(async () => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  localStorage.clear();
  useStudioStore.getState().reset();
  useStudioSession.setState({ brief: DEFAULT_BRIEF, selectedId: null, compareIds: [], references: [], viewJobId: null });
  await useStudioStore.persist.rehydrate();
  useBrandStore.getState().reset();
});
afterEach(() => vi.useRealTimers());

const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

// Full jsdom renders of the Studio are slow on loaded machines; logic tests keep the default timeout.
describe("Design Studio walkthrough", { timeout: 20_000 }, () => {
  it("generates simulated concepts from a brief and saves one to a collection", async () => {
    render(<StudioView />);
    await advance(10);
    const form = screen.getAllByRole("form", { name: "Design brief" })[0];
    fireEvent.click(within(form).getByRole("button", { name: "Oversized blazer" }));
    fireEvent.click(within(form).getByRole("radio", { name: "Hybrid" }));
    fireEvent.click(within(form).getByRole("button", { name: /Generate concepts/ }));
    await advance(300);

    expect(screen.getAllByText(/demonstration progress/i).length).toBeGreaterThan(0);
    expect(within(form).getByRole("button", { name: /Generating/ })).toBeDisabled();

    await advance(6000);
    const cards = screen.getAllByRole("button", { name: /^Select / });
    expect(cards).toHaveLength(4);
    expect(screen.getAllByText("Simulated").length).toBeGreaterThanOrEqual(4);

    const job = useStudioStore.getState().jobs[0];
    expect(job.job.status).toBe("succeeded");
    expect(job.request.mode).toBe("hybrid");
    expect(job.request.brandContext).not.toBeNull();

    const inspector = screen.getAllByRole("complementary", { name: "Concept inspector" })[0];
    fireEvent.change(within(inspector).getByRole("combobox", { name: "Collection" }), { target: { value: "col_resort" } });
    fireEvent.click(within(inspector).getByRole("button", { name: "Save" }));
    const saved = useStudioStore.getState().collections.find((c) => c.id === "col_resort")!;
    expect(saved.conceptIds).toContain(job.job.resultConceptIds[0]);
  });

  it("shows validation errors instead of submitting an empty brief", async () => {
    render(<StudioView />);
    await advance(10);
    const form = screen.getAllByRole("form", { name: "Design brief" })[0];
    fireEvent.click(within(form).getByRole("button", { name: /Generate concepts/ }));
    await advance(10);
    expect(within(form).getByRole("alert")).toHaveTextContent(/Describe the garment/);
    expect(useStudioStore.getState().jobs).toHaveLength(0);
  });

  it("disables Brand and Hybrid when no approved Brand DNA version exists", async () => {
    useBrandStore.setState((st) => ({ versions: st.versions.map((v) => (v.status === "approved" ? { ...v, status: "in_review" as const } : v)) }));
    render(<StudioView />);
    await advance(10);
    const form = screen.getAllByRole("form", { name: "Design brief" })[0];
    expect(within(form).getByRole("radio", { name: "Brand" })).toBeDisabled();
    expect(within(form).getByRole("radio", { name: "Hybrid" })).toBeDisabled();
    expect(within(form).getByText(/need an approved Brand DNA version/)).toBeInTheDocument();
  });
});
