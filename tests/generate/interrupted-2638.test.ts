import { describe, expect, it } from "vitest";
import { REWRITTEN, owedToRow } from "@/lib/generate/interrupted";

const row = (created_at: string, scheduled_for: string, meta: unknown = {}) => ({ transitions: [], created_at, scheduled_for, meta });
const at = (iso: string) => new Date(iso);

describe("a generating row a run saved and then stopped on", () => {
  it("is rewritten once, then stopped, whenever in the hour it was saved", () => {
    const saved = row("2026-11-10T08:40:00Z", "2026-11-11");
    expect(owedToRow(saved, at("2026-11-10T09:03:00Z"), "UTC")).toBeNull();
    expect(owedToRow(saved, at("2026-11-10T11:03:00Z"), "UTC")).toBe("mark");
    expect(owedToRow({ ...saved, meta: { [REWRITTEN]: "2026-11-10T11:03:00Z" } }, at("2026-11-10T12:03:00Z"), "UTC")).toBe("stop");
  });

  it("is rewritten automatically however old while its date is to come, and stopped once it has passed", () => {
    expect(owedToRow(row("2026-11-10T08:05:13Z", "2026-11-11"), at("2026-11-10T18:05:00Z"), "UTC")).toBe("mark");
    expect(owedToRow(row("2026-11-10T08:05:13Z", "2026-11-11"), at("2026-11-11T07:03:00Z"), "Europe/Berlin")).toBe("mark");
    expect(owedToRow(row("2026-11-08T08:05:13Z", "2026-11-09"), at("2026-11-10T07:03:00Z"), "UTC")).toBe("stop");
  });
});
