import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  groupForVerifyState,
  actualDeltaForAction,
  verifiedAtForAction,
  byPredictedDeltaDesc,
  byVerifiedAtDesc,
  type SnapshotPoint,
} from "./action-board";

// Mock serverDb() modelling the query shapes actionBoard uses:
// - "actions": select(...).eq(...) resolving to { data: rows }.
// - "score_snapshots": select(...).eq(...).order(...) resolving to { data: rows }.
function makeDb(actionsRows: unknown[], snapshotRows: unknown[] = []) {
  const actionsEq = vi.fn().mockResolvedValue({ data: actionsRows, error: null });
  const actionsSelect = vi.fn().mockReturnValue({ eq: actionsEq });

  const snapOrder = vi.fn().mockResolvedValue({ data: snapshotRows, error: null });
  const snapEq = vi.fn().mockReturnValue({ order: snapOrder });
  const snapSelect = vi.fn().mockReturnValue({ eq: snapEq });

  const from = vi.fn((table: string) => {
    if (table === "actions") return { select: actionsSelect };
    return { select: snapSelect };
  });
  return { from, spies: { actionsSelect, actionsEq, snapSelect, snapEq, snapOrder } };
}

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

describe("verifiedAtForAction", () => {
  const snaps: SnapshotPoint[] = [
    { actionId: null, total: 40, takenAt: "2026-06-01" },
    { actionId: "a1", total: 53, takenAt: "2026-06-15" },
    { actionId: "a2", total: 51, takenAt: "" }, // snapshot with a missing timestamp
  ];

  it("returns the action's verification-snapshot timestamp", () => {
    expect(verifiedAtForAction(snaps, "a1")).toBe("2026-06-15");
  });

  it("returns null when the action has no snapshot or the timestamp is empty", () => {
    expect(verifiedAtForAction(snaps, "missing")).toBeNull();
    expect(verifiedAtForAction(snaps, "a2")).toBeNull();
  });
});

describe("board ordering comparators", () => {
  it("byPredictedDeltaDesc puts the biggest predicted delta first, nulls last", () => {
    const rows = [
      { predictedDelta: null },
      { predictedDelta: 3 },
      { predictedDelta: 8 },
    ];
    expect([...rows].sort(byPredictedDeltaDesc).map((r) => r.predictedDelta)).toEqual([8, 3, null]);
  });

  it("byVerifiedAtDesc puts the most recently verified first, falling back to createdAt", () => {
    const rows = [
      { verifiedAt: "2026-06-01", createdAt: "2026-05-01" },
      { verifiedAt: null, createdAt: "2026-06-20" }, // no snapshot → createdAt key
      { verifiedAt: "2026-06-15", createdAt: "2026-05-02" },
    ];
    expect([...rows].sort(byVerifiedAtDesc).map((r) => r.verifiedAt ?? r.createdAt)).toEqual([
      "2026-06-20",
      "2026-06-15",
      "2026-06-01",
    ]);
  });
});

describe("actionBoard", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("surfaces the persisted target on the board action", async () => {
    const db = makeDb([
      {
        id: "a1",
        title: "Post on r/foo",
        category: "community",
        why: null,
        status: "pending",
        verify_state: "pending",
        expected_outcome: null,
        created_at: "2026-07-01",
        draft: null,
        verify_url: null,
        effort_min: 30,
        target: { channel: "community", label: "r/foo", url: "https://reddit.com/r/foo" },
      },
    ]);
    vi.doMock("@/lib/db/client", () => ({ serverDb: () => db }));

    const { actionBoard } = await import("./action-board");
    const board = await actionBoard("app-1");

    expect(board.open[0]?.target).toEqual({ channel: "community", label: "r/foo", url: "https://reddit.com/r/foo" });
  });

  it("degrades safely when target is null/missing (legacy rows)", async () => {
    const db = makeDb([
      {
        id: "a2",
        title: "Legacy action",
        category: "seo",
        why: null,
        status: "pending",
        verify_state: "pending",
        expected_outcome: null,
        created_at: "2026-07-01",
        draft: null,
        verify_url: null,
        effort_min: null,
      },
    ]);
    vi.doMock("@/lib/db/client", () => ({ serverDb: () => db }));

    const { actionBoard } = await import("./action-board");
    const board = await actionBoard("app-2");

    expect(board.open[0]?.target).toBeNull();
  });
});
