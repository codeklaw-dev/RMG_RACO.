import { describe, expect, it, vi } from "vitest";
import { useStudioSession } from "./studio-session";

describe("reference object URL cleanup", () => {
  const ref = (id: string) => ({ id, name: id, size: 1, type: "image/png", previewUrl: `blob:${id}`, status: "ready" as const, rightsConfirmed: true });

  it("revokes URLs on remove and on clear, and detaches them from the brief", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const s = useStudioSession.getState();
    s.addReferences([ref("a"), ref("b"), ref("c")]);
    s.removeReference("a");
    expect(revoke).toHaveBeenCalledWith("blob:a");
    useStudioSession.getState().clearReferences();
    expect(revoke).toHaveBeenCalledWith("blob:b");
    expect(revoke).toHaveBeenCalledWith("blob:c");
    expect(useStudioSession.getState().references).toEqual([]);
    expect(useStudioSession.getState().brief.referenceIds).toEqual([]);
  });

  it("revokes all URLs when the page is unloaded", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    useStudioSession.getState().addReferences([ref("d")]);
    window.dispatchEvent(Object.assign(new Event("pagehide"), { persisted: false }));
    expect(revoke).toHaveBeenCalledWith("blob:d");
  });
});
