import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDemo } from "@/lib/demo/reset";
import { useStudioStore } from "@/lib/store/studio-store";
import { ResetDemoButton } from "./demo-controls";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/pilot", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => {
  localStorage.clear();
  resetDemo();
});

describe("reset confirmation", () => {
  it("lists modified records by area and name before discarding them", () => {
    useStudioStore.getState().moveLook("col_aw26", "cpt_01", 1);
    useStudioStore.getState().updateAnnotation("ann_demo_2", { text: "Edited by designer" });
    render(<ResetDemoButton />);
    fireEvent.click(screen.getByRole("button", { name: /Reset demo/ }));
    const list = screen.getByRole("list", { name: "Changes that will be discarded" });
    expect(within(list).getByText("Collection boards")).toBeInTheDocument();
    expect(list).toHaveTextContent("Quiet Architecture");
    expect(list).toHaveTextContent("“Edited by designer”");
    fireEvent.click(screen.getByRole("button", { name: "Discard changes and reset" }));
    expect(useStudioStore.getState().annotations.find((a) => a.id === "ann_demo_2")!.text).not.toBe("Edited by designer");
  });

  it("says plainly when nothing differs from the curated data", () => {
    render(<ResetDemoButton />);
    fireEvent.click(screen.getByRole("button", { name: /Reset demo/ }));
    expect(screen.getByText(/No differences from the curated data/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });
});
