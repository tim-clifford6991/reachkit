import { describe, expect, it } from "vitest";
import { reviewDeadline } from "@/lib/publish/settings/clock";
import { publishMoment } from "@/lib/publish/publishable/predicate";
import { emptyDraftedDay } from "@/lib/generate/interrupted";

const site = { mode: "autopilot", vetoHours: 24, publishTime: "08:00", timezone: "UTC" } as const;
const goesLive = (at: string, date: string) => publishMoment(reviewDeadline(new Date(at), 24, date, site), date, site).toISOString();

describe("entering review never moves a page's date", () => {
  it("keeps its date 13 h before the publish time, with a shorter window", () => {
    expect(goesLive("2026-11-10T19:03:00Z", "2026-11-11")).toBe("2026-11-11T08:00:00.000Z");
  });
  it("publishes the same day once ready after the publish time", () => {
    expect(goesLive("2026-11-11T10:00:00Z", "2026-11-11")).toBe("2026-11-11T10:00:00.000Z");
  });
});

it("a rewrite of a spare returns to the drafted day it left empty", () => {
  const days = [{ publish_date: "2026-11-11", decided_at: "2026-11-10T08:00:00Z" }, { publish_date: "2026-11-12", decided_at: null }];
  expect(emptyDraftedDay(days, new Set(["2026-11-12"]), "2026-11-10", "2026-11-12", "2026-11-10T19:03:00Z")).toBe("2026-11-11");
});
