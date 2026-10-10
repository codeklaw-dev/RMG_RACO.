import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDemoStore } from "@/lib/store/demo-store";
import { DemoBar } from "./demo-bar";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => {
  push.mockClear();
  useDemoStore.setState({ active: true, index: 0 });
});

describe("guided demo bar", () => {
  it("is hidden when the demo isn't active", () => {
    useDemoStore.setState({ active: false });
    render(<DemoBar />);
    expect(screen.queryByRole("region", { name: "Guided demo" })).toBeNull();
  });

  it("moves through scenes with buttons and Alt+arrow keys, then finishes on the pilot screen", () => {
    render(<DemoBar />);
    expect(screen.getByText("Brand intelligence")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(push).toHaveBeenLastCalledWith("/studio");
    expect(screen.getByText("Generate concepts")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowRight", altKey: true });
    expect(push).toHaveBeenLastCalledWith("/editor?concept=cpt_01");
    fireEvent.keyDown(window, { key: "ArrowLeft", altKey: true });
    expect(useDemoStore.getState().index).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Scene 5: Preview & handoff" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(push).toHaveBeenLastCalledWith("/pilot");
    expect(useDemoStore.getState().active).toBe(false);
  });

  it("ignores shortcuts while typing and supports restart and exit", () => {
    render(<><input aria-label="field" /><DemoBar /></>);
    fireEvent.keyDown(screen.getByLabelText("field"), { key: "ArrowRight", altKey: true });
    expect(useDemoStore.getState().index).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    fireEvent.click(screen.getByRole("button", { name: "Restart demo" }));
    expect(useDemoStore.getState().index).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Exit demo" }));
    expect(screen.queryByRole("region", { name: "Guided demo" })).toBeNull();
  });
});
