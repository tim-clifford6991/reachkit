// tests/publish/settings/autopilot.test.ts — SPEC §7 (2026-09-11), #476:
// the veto window is 1–7 days with no zero window, and every existing row
// is autopilot.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fakeDb } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { VETO } from "@/lib/config/constants";
import { governingVetoHours } from "@/lib/publish/settings/veto";
import { invalidFields, toPublishingSettings } from "@/lib/publish/settings/settings";

describe("the governing veto window has a one-day floor", () => {
  it("a stored window under a day reads as a day; a longer one and a missing one read as themselves and the default", () => {
    expect(VETO.minDays).toBe(1);
    expect([0, 12, 23].map(governingVetoHours)).toEqual([24, 24, 24]);
    expect(governingVetoHours(72)).toBe(72);
    expect(governingVetoHours(null)).toBe(VETO.defaultHours);
  });

  it("the settings read and the settings save agree: 0 reads as 24 and cannot be saved", () => {
    expect(toPublishingSettings({ mode: "autopilot", veto_hours: 0, publish_time: null, timezone: null }).vetoHours).toBe(24);
    expect(invalidFields({ vetoHours: 0 })).toContain("vetoHours");
    expect(invalidFields({ vetoHours: 24 })).toEqual([]);
  });
});

describe("the migration: existing rows stay autopilot, and a shorter window is unrepresentable", () => {
  const sql = readFileSync(
    path.resolve(import.meta.dirname, "../../../supabase/migrations/20260914120000_sites_autopilot.sql"),
    "utf8"
  )
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  it("backfills mode and the window, then constrains the floor", () => {
    expect(sql).toMatch(/update sites set mode = 'autopilot' where mode <> 'autopilot';/);
    expect(sql).toMatch(/update sites set veto_hours = 24 where veto_hours < 24;/);
    expect(sql).toMatch(/add constraint sites_veto_hours_floor check \(veto_hours >= 24\)/);
  });
});
