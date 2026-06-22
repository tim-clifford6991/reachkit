import { describe, it, expect } from "vitest";
import { groupForVerifyState, actualDeltaForAction, type SnapshotPoint } from "./action-board";

describe("groupForVerifyState", () => {
  it("maps each persisted verify_state to its board group", () => {
    expect(groupForVerifyState("pending")).toBe("open");
    expect(groupForVerifyState("verifying")).toBe("verifying");
    expect(groupForVerifyState("verified")).toBe("done");
    expect(groupForVerifyState("failed")).toBe("retry");
  });

  it("treats unknown/empty states as open", () => {
    expect(groupForVerifyState("")).toBe("open");
    expect(groupForVerifyState("whatever")).toBe("open");
  });
});

describe("actualDeltaForAction", () => {
  const snaps: SnapshotPoint[] = [
    { actionId: null, total: 40, takenAt: "2026-06-01" },
    { actionId: null, total: 45, takenAt: "2026-06-08" },
    { actionId: "a1", total: 53, takenAt: "2026-06-15" }, // verification of a1
    { actionId: "a2", total: 51, takenAt: "2026-06-22" }, // verification of a2 (dropped)
  ];

  it("returns the measured movement vs the prior snapshot", () => {
    expect(actualDeltaForAction(snaps, "a1")).toBe(53 - 45);
    expect(actualDeltaForAction(snaps, "a2")).toBe(51 - 53);
  });

  it("returns null when the action has no snapshot", () => {
    expect(actualDeltaForAction(snaps, "missing")).toBeNull();
  });

  it("returns null when the action's snapshot is the very first point", () => {
    expect(actualDeltaForAction([{ actionId: "a1", total: 30, takenAt: "x" }], "a1")).toBeNull();
  });
});
