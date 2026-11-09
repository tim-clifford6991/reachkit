// tests/publish/ceilings/ceilings.test.ts — BUILD §9's day ceiling.
//
// No more than one publishes in any calendar day, counted in the time zone
// the customer set, whatever their settings or plan would otherwise allow.
//
// The archived plan is WO-211.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { ceilingRoom, startOfLocalDay, startOfNextLocalDay } from "@/lib/publish/ceilings";

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

describe("the day ceiling", () => {
  const MONDAY = new Date("2026-09-14T14:00:00.000Z");

  it("neither blocked: there is room", async () => {
    expect(await ceilingRoom("s1", MONDAY)).toEqual({ room: true });
  });

  it("one already published today blocks, whatever went out earlier in the week", async () => {
    db.seed("publications", [
      publishedAt("2026-09-14T13:00:00.000Z"),
      ...["08", "09", "10", "11", "12"].map((d) => publishedAt(`2026-09-${d}T13:00:00.000Z`)),
    ]);
    expect(await ceilingRoom("s1", MONDAY)).toMatchObject({ room: false, blockedBy: "day" });
  });

  it("eight in one day is refused by the day", async () => {
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

describe("issue #792 — a ceiling that cannot be counted holds, never counts nothing", () => {
  it("publications that cannot be read hold the page, even with a page already out today", async () => {
    db.seed("publications", [publishedAt("2026-09-14T13:00:00.000Z")]);
    db.unreadable.add("publications");
    const warned = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      expect(await ceilingRoom("s1", new Date("2026-09-14T14:00:00.000Z"))).toEqual({
        room: false,
        blockedBy: "unreadable",
      });
      expect(JSON.parse(String(warned.mock.calls[0]?.[0]))).toMatchObject({
        event: "publish_ceiling_unreadable",
        table: "publications",
      });
    } finally {
      warned.mockRestore();
    }
  });

  it("a site read that errors is unreadable, not a site with no zone", async () => {
    db.unreadable.add("sites");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await ceilingRoom("s1", new Date("2026-09-14T14:00:00.000Z"))).toEqual({
      room: false,
      blockedBy: "unreadable",
    });
  });
});
