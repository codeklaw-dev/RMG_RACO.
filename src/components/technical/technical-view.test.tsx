import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHandoffStore } from "@/lib/store/handoff-store";
import { useStudioStore } from "@/lib/store/studio-store";
import { TechnicalView } from "./technical-view";

let query = "";
const push = vi.fn((href: string) => { query = href.split("?")[1] ?? ""; });
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query), useRouter: () => ({ push }), usePathname: () => "/technical" }));

beforeEach(async () => {
  localStorage.clear();
  useStudioStore.getState().reset();
  useHandoffStore.getState().reset();
  await useStudioStore.persist.rehydrate();
  query = "";
});

describe("Technical handoff", { timeout: 20_000 }, () => {
  it("creates a brief from a concept version", async () => {
    render(<TechnicalView />);
    await screen.findByRole("button", { name: /Create brief/ });
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "cpt_03" } });
    fireEvent.click(screen.getByRole("button", { name: /Create brief/ }));
    const b = useHandoffStore.getState().briefs.find((x) => x.conceptId === "cpt_03")!;
    expect(b).toMatchObject({ versionId: "cpt_03_v1", status: "draft" });
    expect(push).toHaveBeenCalledWith(`/technical?brief=${b.id}`);
  });

  it("edits measurements with unit conversion, saves, and runs the technical review", async () => {
    query = "brief=brief_demo_1";
    render(<TechnicalView />);
    expect(await screen.findByRole("heading", { level: 1, name: "Preliminary Garment Development Brief" })).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Concept-stage document");
    fireEvent.change(screen.getByLabelText("Chest width value in cm"), { target: { value: "52" } });
    fireEvent.change(screen.getByLabelText("Chest width tolerance in cm"), { target: { value: "60" } });
    expect(screen.getByRole("alert")).toHaveTextContent(/Tolerance must be smaller/);
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Chest width tolerance in cm"), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("radio", { name: "in" }));
    expect(screen.getByLabelText("Chest width value in in")).toHaveValue(20.47);
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(useHandoffStore.getState().briefs[0].measurements[0]).toMatchObject({ valueCm: 52, toleranceCm: 1.5 });

    const review = screen.getByRole("region", { name: "Technical review" });
    fireEvent.change(within(review).getByLabelText("Technical review note"), { target: { value: "Check shoulder" } });
    fireEvent.click(within(review).getByRole("button", { name: "Submit for technical review" }));
    fireEvent.click(within(review).getByRole("button", { name: "Request changes" }));
    expect(useHandoffStore.getState().briefs[0].status).toBe("changes_requested");
    fireEvent.click(within(review).getByRole("button", { name: "Submit for technical review" }));
    fireEvent.click(within(review).getByRole("button", { name: "Mark reviewed (simulated)" }));
    const brief = useHandoffStore.getState().briefs[0];
    expect(brief.status).toBe("reviewed");
    expect(brief.reviews.map((r) => r.to)).toEqual(["reviewed", "ready_for_review", "changes_requested", "ready_for_review"]);
    expect(screen.getByLabelText("Chest width value in in")).toBeDisabled();
  });

  it("handles unknown briefs", async () => {
    query = "brief=nope";
    render(<TechnicalView />);
    expect(await screen.findByText("This brief isn't available")).toBeInTheDocument();
  });
});
