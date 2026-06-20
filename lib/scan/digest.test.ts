import { describe, it, expect } from "vitest";
import { parseRefreshDigest } from "./digest";

describe("parseRefreshDigest", () => {
  it("shapes a well-formed refresh payload", () => {
    const out = parseRefreshDigest(
      {
        weekOf: "2026-06-15",
        noOp: false,
        newActions: 2,
        changes: [{ kind: "reviews", summary: "3 new reviews", novel: true }],
        alerts: [{ kind: "competitor_launch", message: "New competitor: x.com" }],
      },
      "2026-06-15T09:00:00Z",
    );
    expect(out).toEqual({
      weekOf: "2026-06-15",
      noOp: false,
      newActions: 2,
      changes: [{ kind: "reviews", summary: "3 new reviews", novel: true }],
      alerts: [{ kind: "competitor_launch", message: "New competitor: x.com" }],
      createdAt: "2026-06-15T09:00:00Z",
    });
  });

  it("returns null for non-object / missing weekOf payloads", () => {
    expect(parseRefreshDigest(null, "t")).toBeNull();
    expect(parseRefreshDigest("nope", "t")).toBeNull();
    expect(parseRefreshDigest({ noOp: true }, "t")).toBeNull();
  });

  it("defaults arrays + scalars defensively when fields are absent", () => {
    const out = parseRefreshDigest({ weekOf: "2026-06-15" }, "t")!;
    expect(out.changes).toEqual([]);
    expect(out.alerts).toEqual([]);
    expect(out.newActions).toBe(0);
    expect(out.noOp).toBe(false);
  });
});
