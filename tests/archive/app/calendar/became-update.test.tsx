/** @vitest-environment jsdom */
// SPEC §7 (owner, 2026-11-05) — a day the week planned as a new page and an update of a live page filled says so on its
// row and in its panel, only where the stored rows prove both halves: from the drafts rows the fallback writes, to the screen.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { fakeDb, type FakeDb } from "../../publish/harness";
import { measured } from "@/lib/measure/measured";
import { COPY } from "@/lib/presentation/copy";
import { shown, withNuqs } from "./nuqs-adapter";

const db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

/** Wednesday's committed row, by family, or none. */
let planned: "write" | "improve" | null = "write";
const QUERY = "water heater repair austin";
vi.mock("@/lib/opportunities", () => ({
  supplyDepth: async () => ({ unused: 5 }),
  supplyMeasured: async () => true,
  committedWeek: async () => ({ days: planned === null ? [] : [{ date: WED, opportunity: { id: "opp-wed", family: planned } }], spares: [] }),
  explainChoice: async (id: string) => ({ opportunityId: id, type: "answer_page", family: "write", fitBand: "winnable", acceptance: { form: "top20", query: QUERY }, evidence: { family: "write", query: QUERY, volume: measured(320, NOW), rival: null } }),
}));

const { readCalendarFacts } = await import("@/app/(account)/app/calendar/store");
const { assembleMonth } = await import("@/app/(account)/app/calendar/month");
const { CalendarView } = await import("@/app/(account)/app/calendar/CalendarView");

/** 10:00 on Tuesday 2026-09-15 in the site's zone; Wednesday is the day in question. */
const NOW = new Date(Date.UTC(2026, 8, 15, 15, 0, 0));
const WED = "2026-09-16";
const WRITTEN = { fallbackFor: "generate:no_opportunity", research: "stored" };

/** Every state line on the week, and the panel's plan line, with Wednesday's draft carrying `meta`. */
async function linesFor(meta: Record<string, unknown>, family: typeof planned) {
  planned = family;
  db.reset();
  db.seed("sites", [{ id: "site-1", user_id: "u1", mode: "autopilot", veto_hours: 24, publish_time: "16:00", timezone: "America/Chicago", publishing_enabled: true }]);
  db.seed("destinations", [{ id: "dest-1", site_id: "site-1", kind: "hosted", health: "ok", config: null, hostname_state: "live" }]);
  db.seed("drafts", [{ id: "d-wed", site_id: "site-1", opportunity_id: "opp-refresh", state: "in_review", scheduled_for: WED, title: "Water heater repair in Austin", transitions: [{ to: "in_review" }], veto_deadline: "2026-09-16T21:00:00.000Z", approved_at: null, meta }]);
  const facts = await readCalendarFacts({ site: { siteId: "site-1", timeZone: "America/Chicago" }, month: "2026-09", now: NOW });
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(withNuqs(<CalendarView {...shown(assembleMonth(facts, "2026-09"))} />, { day: WED }));
  const panel = root.querySelector('[data-testid="day-panel"]')!;
  return {
    state: [...root.querySelectorAll('[data-testid="cell-state-line"]')].map((el) => [el.closest("li")?.getAttribute("data-testid"), el.textContent]),
    panel: panel.querySelector('[data-testid="day-became-update-line"]')?.textContent ?? null,
    aboveControls: panel.innerHTML.indexOf("day-became-update-line") < panel.innerHTML.indexOf("day-actions"),
  };
}

describe("a day planned as a new page and filled by an update says so", () => {
  it.each([
    ["written from stored research", WRITTEN],
    ["mended in code", { fallbackFor: "generate:rules", mendOf: "live-draft-1" }],
  ])("an update %s: Now an update on its row, the plan line in its panel above the controls", async (_case, meta) => {
    expect(await linesFor(meta, "write")).toEqual({
      state: [[`calendar-cell-${WED}`, COPY["calendar.day.became-update"]]],
      panel: COPY["calendar.day.became-update.line"],
      aboveControls: true,
    });
  });

  it.each([
    ["the committed row was itself an update", WRITTEN, "improve"],
    ["the draft names a fallback but neither a mend nor stored research", { fallbackFor: "generate:rules" }, "write"],
    ["no committed row for the date can be read", WRITTEN, null],
    ["the draft is the day's own page", {}, "write"],
  ] as const)("no line where %s", async (_case, meta, family) => {
    expect(await linesFor(meta, family)).toMatchObject({ state: [], panel: null });
  });
});
