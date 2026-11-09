/** @vitest-environment jsdom */
// tests/app/calendar/live-update.test.tsx — Plan › Live pages: a live page
// whose update is scheduled this week names the day it goes live, from the
// stored row and its stored address, and never while no moment is promised.
import "../../generate/env";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { copy } from "@/lib/presentation/copy";
import { TOO_EARLY_WEEKS } from "@/lib/config/constants";
import { contentOf, type PublishedPage } from "@/lib/measure/published";
import type { PageReading } from "@/lib/measure/page-reading";
import { PublishedList, updateDays } from "@/app/(account)/app/calendar/PublishedList";
import { assembleMonth, weekOf, type PageOnDay, type WeekModel } from "@/app/(account)/app/calendar/month";
import { FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH } from "@/app/(account)/app/calendar/fixture";
import type { State } from "@/lib/publish/types";

const ZONE = "America/Chicago";
const NOW = new Date("2026-10-19T15:00:00.000Z");
const WEEK_MS = 7 * 86_400_000;
const A = "https://harborplumbing.example/toilet-repair";
const B = "https://harborplumbing.example/toilet-repair-austin";

/** Place 48 with its best reached past the not-moving window: the no-gain line. */
function noGain(): PageReading {
  const bestAt = new Date(NOW.getTime() - (TOO_EARLY_WEEKS + 1) * WEEK_MS).toISOString();
  return {
    at: NOW.toISOString(),
    crawled: true,
    place: { value: 48, source: "serp", query: "toilet repair austin" },
    first: { at: bestAt, place: 52 },
    best: { place: 47, at: bestAt },
    prev: 48,
    linkedBy: null,
    aiReads: null,
    variants: [],
    reached: { found: bestAt },
    google: null,
    bing: null,
  };
}

// Two live pages with one title: only the address may tell them apart.
const PAGES: readonly PublishedPage[] = [
  { id: "pub-a", draftId: "d-a", title: "Toilet repair in Austin", url: A, publishedAt: new Date("2026-07-01T15:00:00.000Z"), reading: noGain() },
  { id: "pub-b", draftId: "d-b", title: "Toilet repair in Austin", url: B, publishedAt: new Date("2026-07-02T15:00:00.000Z"), reading: noGain() },
];

type Page = Pick<PageOnDay, "stage" | "replaces" | "publishAt" | "scheduledFor">;

function refresh(over: Partial<Page> = {}): Page {
  // 21:00 UTC is 4:00 PM in Austin on Tuesday 20 October.
  return { stage: "scheduled", replaces: A, publishAt: new Date("2026-10-20T21:00:00.000Z"), scheduledFor: "2026-10-20", ...over };
}

function week(page: Page | null, over: Partial<Pick<WeekModel, "destination" | "held" | "stopped">> = {}) {
  return {
    timeZone: ZONE,
    destination: { kind: "hosted" as const, healthy: true },
    held: null,
    stopped: null,
    ...over,
    cells: [{ when: "plan" as const, page }],
  };
}

/** Each row's text, keyed by the draft its link opens. */
function rowsByDraft(w: ReturnType<typeof week>): Map<string, string> {
  const html = renderToStaticMarkup(
    <PublishedList content={contentOf({ pages: PAGES, now: NOW })} timeZone={ZONE} now={NOW} updates={updateDays(w)} />
  );
  const doc = new DOMParser().parseFromString(html, "text/html");
  return new Map(
    [...doc.querySelectorAll('[data-testid="plan-published-row"]')].map((li) => [li.querySelector("a")?.getAttribute("href") ?? "", li.textContent ?? ""])
  );
}

function rowsOf(w: ReturnType<typeof week>): string[] {
  return [...rowsByDraft(w).values()];
}

const WEEKDAY = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/;
const UPDATE = copy("calendar.live.update", { day: "\u0000" }).split("\u0000")[0]!;

describe("a live page with its update scheduled this week names the day it goes live", () => {
  it("reads the stored go-live moment in the site's zone, and follows it when the date moves", () => {
    const a = rowsByDraft(week(refresh())).get("/app/draft/d-a");
    expect(a).toContain(`${copy("calendar.live.no-gain", { n: "48", weeks: String(TOO_EARLY_WEEKS + 1) })} ${copy("calendar.live.update", { day: "Tue 20" })}`);
    const moved = rowsByDraft(week(refresh({ publishAt: new Date("2026-10-25T21:00:00.000Z"), scheduledFor: "2026-10-25" }))).get("/app/draft/d-a");
    expect(moved).toContain(copy("calendar.live.update", { day: "Sun 25" }));
    expect(moved).not.toContain("Tue 20");
  });

  it("the day is the publish moment's own in the site's zone, not the date it was first scheduled for, nor UTC's", () => {
    // 03:00 UTC Thursday is 10:00 PM Wednesday in Austin.
    expect(updateDays(week(refresh({ publishAt: new Date("2026-10-22T03:00:00.000Z") })))).toEqual(new Map([[A, "Wed 21"]]));
  });

  it("a planned update with no publish moment yet names the date the week committed it for", () => {
    expect(updateDays(week(refresh({ stage: "planned", publishAt: null, scheduledFor: "2026-10-22" })))).toEqual(new Map([[A, "Thu 22"]]));
  });
});

describe("the day is the stored row's, never invented", () => {
  it("a no-gain page with no update scheduled has no update sentence", () => {
    expect(updateDays(week(null)).size).toBe(0);
    for (const row of rowsOf(week(null))) {
      expect(row).toContain(copy("calendar.live.no-gain", { n: "48", weeks: String(TOO_EARLY_WEEKS + 1) }));
      expect(row).not.toContain(UPDATE);
    }
  });

  it("a no-gain page's label is Not moving, with its board icon", () => {
    const html = renderToStaticMarkup(<PublishedList content={contentOf({ pages: PAGES, now: NOW })} timeZone={ZONE} now={NOW} updates={new Map()} />);
    const badges = [...new DOMParser().parseFromString(html, "text/html").querySelectorAll('[data-testid="plan-published-row"] .badge')];
    expect(badges.map((b) => b.textContent)).toEqual([copy("review.label.not_moving"), copy("review.label.not_moving")]);
    for (const badge of badges) expect(badge.querySelector("svg.lucide-minus")).not.toBeNull();
  });

  it("an update of page B says nothing on page A, though both carry the same title", () => {
    const rows = rowsByDraft(week(refresh({ replaces: B })));
    expect(rows.get("/app/draft/d-b")).toContain(copy("calendar.live.update", { day: "Tue 20" }));
    expect(rows.get("/app/draft/d-a")).toContain(PAGES[0]!.title);
    expect(rows.get("/app/draft/d-a")).not.toContain(UPDATE);
  });

  it("an address written with a trailing slash or other case is the same page", () => {
    expect(updateDays(week(refresh({ replaces: `${A.toUpperCase()}/` })))).toEqual(new Map([[A, "Tue 20"]]));
  });

  it("a new page, a page live already and a day already past name no day", () => {
    expect(updateDays(week(refresh({ replaces: undefined }))).size).toBe(0);
    expect(updateDays(week(refresh({ stage: "live" }))).size).toBe(0);
    expect(updateDays({ ...week(refresh()), cells: [{ when: "past", page: refresh() }] }).size).toBe(0);
  });
});

describe("no day while nothing can go live (Q11, the paused rule)", () => {
  const cases = {
    unconnected: { destination: null },
    "address not working": { destination: { kind: "hosted" as const, healthy: false } },
    "publishing paused": { held: "publishing_off" as const },
    "ReachKit stopped": { stopped: { since: NOW, resumes: { promised: false as const }, needs: { kind: "nothing" as const }, partial: false } },
  };
  for (const [name, over] of Object.entries(cases)) {
    it(`${name}: no update sentence and no weekday`, () => {
      for (const row of rowsOf(week(refresh(), over))) {
        expect(row).not.toContain(UPDATE);
        expect(row).not.toMatch(WEEKDAY);
      }
    });
  }
});

describe("a skipped or stopped update names no day", () => {
  // Through the model Plan draws: a skipped or taken-down draft leaves its date, so no page carries the update.
  function weekWith(state: State): ReturnType<typeof updateDays> {
    const base = FIXTURE_CALENDAR_FACTS.drafts[0]!;
    const draft = { ...base, draftId: "d-refresh", scheduledFor: "2026-09-17", state, update: true, replaces: A, publishAt: new Date("2026-09-17T13:00:00.000Z") };
    const facts = { ...FIXTURE_CALENDAR_FACTS, stop: null, stoppedDays: [], instructions: {}, drafts: [draft] };
    return updateDays(weekOf([assembleMonth(facts, FIXTURE_MONTH)], "2026-09-15"));
  }

  it("an approved update on the week's Thursday names it", () => {
    expect(weekWith("approved")).toEqual(new Map([[A, "Thu 17"]]));
  });

  for (const state of ["skipped", "unpublished", "needs_attention"] as const) {
    it(`a ${state} update names no day`, () => {
      expect(weekWith(state).size).toBe(0);
    });
  }
});
