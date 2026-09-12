// tests/publish/settings/settings.test.ts — REQ-073 c1, c2, c5.
//
// The four values, the closed validation, the one written line per pair,
// and the first-sign-in zone. Every assertion about a sentence is on a
// copy **key**: this module writes no string.
//
// The archived plan is WO-218.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { VETO } from "@/lib/config/constants";
import {
  adoptBrowserTimezone,
  invalidFields,
  isResolvableZone,
  readPublishingSettings,
  vetoDaysFromHours,
  vetoHoursFromDays,
} from "@/lib/publish/settings";
import * as settingsModule from "@/lib/publish/settings/settings";

function seedSite(over: Record<string, unknown> = {}): void {
  db.reset();
  db.seed("sites", [
    {
      id: "s1",
      mode: "autopilot",
      veto_hours: VETO.defaultHours,
      publish_time: "09:00:00",
      timezone: "Europe/Lisbon",
      ...over,
    },
  ]);
}

beforeEach(() => seedSite());

describe('REQ-073 c1 · §7 — "the veto window defaults to 24 h with a range of 1–7 days; there is no zero window"', () => {
  it("the four values are settable within their stated ranges and nothing else is", () => {
    expect(invalidFields({ mode: "autopilot" })).toEqual([]);
    expect(invalidFields({ mode: "copilot" })).toEqual([]);
    expect(invalidFields({ mode: "supervised" as never })).toEqual(["mode"]);

    for (let days = VETO.minDays; days <= VETO.maxDays; days++) {
      expect(invalidFields({ vetoHours: vetoHoursFromDays(days) }), `${days}d`).toEqual([]);
    }
    expect(invalidFields({ vetoHours: vetoHoursFromDays(VETO.maxDays + 1) })).toEqual(["vetoHours"]);
    expect(invalidFields({ vetoHours: -24 })).toEqual(["vetoHours"]);
    // §7: there is no zero window, so a draft always has a veto path.
    expect(invalidFields({ vetoHours: 0 })).toEqual(["vetoHours"]);

    expect(invalidFields({ publishTime: "09:00" })).toEqual([]);
    expect(invalidFields({ publishTime: "23:59" })).toEqual([]);
    expect(invalidFields({ publishTime: "24:00" })).toEqual(["publishTime"]);
    expect(invalidFields({ publishTime: "9:00" })).toEqual(["publishTime"]);

    expect(invalidFields({ timezone: "America/New_York" })).toEqual([]);
    expect(invalidFields({ timezone: "Mars/Olympus" })).toEqual(["timezone"]);
  });

  it("a 36-hour window is refused — the stepper offers whole days and 36 is between two of them", () => {
    expect(invalidFields({ vetoHours: 36 })).toEqual(["vetoHours"]);
  });

  it("an invalid patch names every field that failed, so nothing is partially saved", () => {
    expect(invalidFields({ mode: "x" as never, vetoHours: 36, publishTime: "nope", timezone: "" })).toEqual([
      "mode",
      "vetoHours",
      "publishTime",
      "timezone",
    ]);
  });

  it("the days-to-hours conversion has one home and round-trips", () => {
    expect(vetoHoursFromDays(1)).toBe(24);
    expect(vetoHoursFromDays(7)).toBe(168);
    expect(vetoDaysFromHours(VETO.defaultHours)).toBe(1);
  });

  it("where nothing is set the window is 24 hours", async () => {
    seedSite({ veto_hours: null });
    const s = await readPublishingSettings("s1");
    expect(s.vetoHours).toBe(VETO.defaultHours);
  });

  it("§7 — a window stored below the floor reads as one day, so every draft keeps a veto path", async () => {
    for (const stored of [0, 6, 23]) {
      seedSite({ veto_hours: stored });
      expect((await readPublishingSettings("s1")).vetoHours).toBe(VETO.defaultHours);
    }
    seedSite({ veto_hours: 48 });
    expect((await readPublishingSettings("s1")).vetoHours).toBe(48);
  });

  it("a site with no stated zone reads null — never the server's zone", async () => {
    seedSite({ timezone: null });
    const s = await readPublishingSettings("s1");
    expect(s.timezone).toBeNull();
  });

  it("the publish time is read back as the HH:mm the screen shows", async () => {
    seedSite({ publish_time: "07:30:00" });
    expect((await readPublishingSettings("s1")).publishTime).toBe("07:30");
  });

  it("a site that cannot be read throws rather than answering with defaults nobody chose", async () => {
    db.reset();
    await expect(readPublishingSettings("s1")).rejects.toThrow();
  });

  it("adoptBrowserTimezone writes a null zone once", async () => {
    seedSite({ timezone: null });
    expect(await adoptBrowserTimezone("s1", "America/Denver")).toEqual({ adopted: true });
    expect(db.rows("sites")[0]?.timezone).toBe("America/Denver");
  });

  it("adoptBrowserTimezone refuses a non-IANA value through the same check a patch uses", async () => {
    seedSite({ timezone: null });
    expect(await adoptBrowserTimezone("s1", "Mars/Olympus")).toEqual({
      adopted: false,
      reason: "invalid",
    });
    expect(db.rows("sites")[0]?.timezone).toBeNull();
  });

  it("adoptBrowserTimezone leaves a set zone untouched — removing the null guard fails this case", async () => {
    seedSite({ timezone: "Europe/Lisbon" });
    expect(await adoptBrowserTimezone("s1", "America/Denver")).toEqual({
      adopted: false,
      reason: "already_set",
    });
    expect(db.rows("sites")[0]?.timezone).toBe("Europe/Lisbon");
  });

  it("isResolvableZone reads the runtime's own zone database, not a second list", () => {
    expect(isResolvableZone("UTC")).toBe(true);
    expect(isResolvableZone("")).toBe(false);
    expect(isResolvableZone(null)).toBe(false);
  });
});

describe("REQ-073 c5 / REQ-070 c3 — one home for the mode, and no rate on this screen", () => {
  it("this module exports no function that returns a rate", () => {
    const rateNames = Object.keys(settingsModule).filter((name) =>
      /perDay|perWeek|ceiling|rate|cadence|limit/i.test(name)
    );
    expect(rateNames).toEqual([]);
  });

  it("the mode is read through this module — `sites.mode` is selected here and nowhere else in the leaf", async () => {
    await readPublishingSettings("s1");
    const read = db.queries.filter((q) => q.table === "sites" && q.columns?.includes("mode"));
    expect(read.length).toBe(1);
  });
});
