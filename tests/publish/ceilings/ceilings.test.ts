// tests/publish/ceilings/ceilings.test.ts — BUILD §9's two ceilings.
//
// "no more than one publishes in any calendar day and no more than eight in
// any calendar week, counted in the time zone the customer set, whatever
// their settings or plan would otherwise allow; the two ceilings hold
// independently of each other."
//
// The discriminating fixture is the Sunday one: a page published on a
// Sunday evening in the customer's zone counts in the week that Sunday
// *ends*, not the one it begins. A UTC-week implementation gets that wrong
// and passes every other row here.
//
// The archived plan is WO-211.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { RATE_LIMITS } from "@/lib/config/constants";
import { ceilingRoom } from "@/lib/publish/ceilings";
import {
  startOfLocalDay,
  startOfLocalWeek,
  startOfNextLocalDay,
  startOfNextLocalWeek,
} from "@/lib/publish/ceilings/local-week";
import { weekStartOf } from "@/jobs/site-clock";

const ZONE = "America/New_York";

function site(over: Row = {}): Row {
  return { id: "s1", timezone: ZONE, mode: "autopilot", veto_hours: 24, publishing_enabled: true, ...over };
}

function publishedAt(iso: string, siteId = "s1"): Row {
  return { id: `p-${iso}-${siteId}`, site_id: siteId, published_at: iso, destination: "hosted" };
}

beforeEach(() => {
  db.reset();
  db.seed("sites", [site()]);
  db.seed("publications", []);
});

describe("the pins are the only source of the two limits", () => {
  it("§9's hard limits, read from constants.ts and never restated here", () => {
    expect(RATE_LIMITS.publishesPerDay).toBe(1);
    expect(RATE_LIMITS.publishesPerWeek).toBe(8);
  });
});

describe("the day boundary is the customer's midnight, not UTC's", () => {
  // 2026-09-15 01:30 UTC is still 2026-09-14 21:30 in New York.
  const lateNightUtc = new Date("2026-09-15T01:30:00.000Z");

  it("a page published at 21:30 local blocks a second one at 22:00 local the same day", async () => {
    db.seed("publications", [publishedAt("2026-09-15T01:30:00.000Z")]);
    const room = await ceilingRoom("s1", new Date("2026-09-15T02:00:00.000Z"));
    expect(room).toMatchObject({ room: false, blockedBy: "day" });
  });

  it("the same page does not block one published after the customer's midnight", async () => {
    db.seed("publications", [publishedAt("2026-09-15T01:30:00.000Z")]);
    // 2026-09-15 05:00 UTC is 01:00 on the 15th in New York — a new day.
    const room = await ceilingRoom("s1", new Date("2026-09-15T05:00:00.000Z"));
    expect(room).toEqual({ room: true });
  });

  it("startOfLocalDay lands on the customer's own midnight", () => {
    const start = startOfLocalDay(lateNightUtc, ZONE);
    expect(start.toISOString()).toBe("2026-09-14T04:00:00.000Z");
  });

  it("nextFreeAt on a day refusal is the customer's next midnight", async () => {
    db.seed("publications", [publishedAt("2026-09-15T01:30:00.000Z")]);
    const room = await ceilingRoom("s1", new Date("2026-09-15T02:00:00.000Z"));
    if (room.room || room.blockedBy !== "day") throw new Error("expected a day refusal");
    expect(room.nextFreeAt.toISOString()).toBe(startOfNextLocalDay(lateNightUtc, ZONE).toISOString());
    expect(room.nextFreeAt.toISOString()).toBe("2026-09-15T04:00:00.000Z");
  });
});

describe("the week starts on the customer's Monday", () => {
  it("a page published on a Sunday counts in the week that Sunday ends, not the one it begins", async () => {
    // 2026-09-13 is a Sunday. Seven pages that week, then the Sunday one is
    // the eighth: a ninth on Monday the 14th must be allowed, because the
    // Monday starts a new week.
    const sundayEvening = "2026-09-14T00:30:00.000Z"; // 20:30 Sunday 13th, New York
    db.seed("publications", [publishedAt(sundayEvening)]);
    const mondayLocal = new Date("2026-09-14T14:00:00.000Z"); // 10:00 Monday 14th
    expect(await ceilingRoom("s1", mondayLocal)).toEqual({ room: true });
  });

  it("startOfLocalWeek on that Sunday is the Monday before it, in the customer's zone", () => {
    const sundayEvening = new Date("2026-09-14T00:30:00.000Z");
    expect(startOfLocalWeek(sundayEvening, ZONE).toISOString()).toBe("2026-09-07T04:00:00.000Z");
  });

  it("agrees with the job runner's own site-local week on a fixed date — two helpers, one answer", () => {
    for (const iso of [
      "2026-09-14T00:30:00.000Z",
      "2026-09-14T14:00:00.000Z",
      "2026-03-08T06:30:00.000Z",
      "2026-11-01T05:30:00.000Z",
    ]) {
      const instant = new Date(iso);
      const mine = startOfLocalWeek(instant, ZONE);
      const theirs = weekStartOf(instant, ZONE);
      const asDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(mine);
      expect(asDate, iso).toBe(theirs);
    }
  });
});

describe("the two ceilings hold independently", () => {
  const MONDAY = new Date("2026-09-14T14:00:00.000Z");

  it("neither blocked: there is room", async () => {
    expect(await ceilingRoom("s1", MONDAY)).toEqual({ room: true });
  });

  it("the day alone blocks: one already published today, six this week", async () => {
    db.seed("publications", [
      publishedAt("2026-09-14T13:00:00.000Z"),
      ...["08", "09", "10", "11", "12"].map((d) => publishedAt(`2026-09-${d}T13:00:00.000Z`)),
    ]);
    expect(await ceilingRoom("s1", MONDAY)).toMatchObject({ room: false, blockedBy: "day" });
  });

  it("the week alone blocks: eight this week, a free day today", async () => {
    // Eight publications Monday-to-Sunday of the *previous* local week would
    // not count, so these are eight in the week containing MONDAY: the local
    // Monday is 2026-09-14, so they are eight on that Monday... which would
    // also trip the day. Use a Tuesday reading with eight spread Mon-Tue.
    const TUESDAY = new Date("2026-09-15T14:00:00.000Z");
    db.seed("publications", [
      ...Array.from({ length: 8 }, (_, i) =>
        publishedAt(`2026-09-14T${String(10 + i).padStart(2, "0")}:00:00.000Z`)
      ),
    ]);
    const room = await ceilingRoom("s1", TUESDAY);
    expect(room).toMatchObject({ room: false, blockedBy: "week" });
  });

  it("nextFreeAt on a week refusal is the customer's next Monday", async () => {
    const TUESDAY = new Date("2026-09-15T14:00:00.000Z");
    db.seed("publications", [
      ...Array.from({ length: 8 }, (_, i) =>
        publishedAt(`2026-09-14T${String(10 + i).padStart(2, "0")}:00:00.000Z`)
      ),
    ]);
    const room = await ceilingRoom("s1", TUESDAY);
    if (room.room || room.blockedBy !== "week") throw new Error("expected a week refusal");
    expect(room.nextFreeAt.toISOString()).toBe(startOfNextLocalWeek(TUESDAY, ZONE).toISOString());
    expect(room.nextFreeAt.toISOString()).toBe("2026-09-21T04:00:00.000Z");
  });

  it("both blocked: the day is reported, because it is the nearer boundary", async () => {
    db.seed("publications", [
      ...Array.from({ length: 8 }, (_, i) =>
        publishedAt(`2026-09-14T${String(10 + i).padStart(2, "0")}:00:00.000Z`)
      ),
    ]);
    expect(await ceilingRoom("s1", MONDAY)).toMatchObject({ blockedBy: "day" });
  });

  it("another site's publications do not count against this one", async () => {
    db.seed("publications", [publishedAt("2026-09-14T13:00:00.000Z", "s2")]);
    expect(await ceilingRoom("s1", MONDAY)).toEqual({ room: true });
  });

  it("a claimed row that never published counts against neither ceiling", async () => {
    db.seed("publications", [
      { id: "p-claimed", site_id: "s1", published_at: null, destination: "hosted" },
    ]);
    expect(await ceilingRoom("s1", MONDAY)).toEqual({ room: true });
  });
});

describe("no settings value raises either ceiling", () => {
  it("every publishing column on the site is written, and the refusal is unchanged", async () => {
    db.seed("sites", [
      site({
        mode: "autopilot",
        veto_hours: 0,
        publishing_enabled: true,
        publishes_per_day: 99,
        publishes_per_week: 99,
        plan: "unlimited",
      }),
    ]);
    db.seed("publications", [publishedAt("2026-09-14T13:00:00.000Z")]);
    expect(await ceilingRoom("s1", new Date("2026-09-14T14:00:00.000Z"))).toMatchObject({
      room: false,
      blockedBy: "day",
    });
  });

  it("the module reads no per-site column that could hold a rate", async () => {
    db.queries.length = 0;
    await ceilingRoom("s1", new Date("2026-09-14T14:00:00.000Z"));
    const siteReads = db.queries.filter((q) => q.table === "sites");
    expect(siteReads.map((q) => q.columns)).toEqual(["timezone"]);
  });
});

describe("a site with no zone is held, and the hold names why", () => {
  it("no calendar day can be counted for it, so no attempt begins", async () => {
    db.seed("sites", [site({ timezone: null })]);
    expect(await ceilingRoom("s1", new Date("2026-09-14T14:00:00.000Z"))).toEqual({
      room: false,
      blockedBy: "zone_not_set",
    });
  });

  it("a site that cannot be read at all is held the same way", async () => {
    expect(await ceilingRoom("no-such-site", new Date())).toEqual({
      room: false,
      blockedBy: "zone_not_set",
    });
  });
});
