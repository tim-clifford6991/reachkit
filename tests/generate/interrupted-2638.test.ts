import { describe, expect, it } from "vitest";
import { owedToRow } from "@/lib/generate/interrupted";

// Production 2026-11-10: the write step saved the row at 08:05:13Z, threw, and its retry read the date as drafted.
const saved = { transitions: [], created_at: "2026-11-10T08:05:13Z" };

describe("a generating row no run is still writing", () => {
  it("is left alone while a run may still write it, written again at the next tick, and stopped after that", () => {
    expect(owedToRow(saved, new Date("2026-11-10T08:06:12Z"))).toBeNull();
    expect(owedToRow(saved, new Date("2026-11-10T09:03:00Z"))).toBe("rewrite");
    expect(owedToRow(saved, new Date("2026-11-10T10:03:00Z"))).toBe("stop");
  });

  it("a row with a move other than the restart is not one", () => {
    expect(owedToRow({ ...saved, transitions: [{ from: "in_review", to: "needs_attention" }] }, new Date("2026-11-10T09:03:00Z"))).toBeNull();
  });
});
