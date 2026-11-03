// The reserved account's demo week, which Plan and Overview both draw: every
// page has its own believable title, the live pages carry every label the
// real verdict can give, and Overview's fixtures name the same pages as Plan's.
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/presentation/copy";
import { contentOf } from "@/lib/measure/published";
import { pageLadderOf } from "@/lib/measure/page-ladder";
import type { Label } from "@/lib/opportunities/verdicts/types";
import { FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH } from "@/app/(account)/app/calendar/fixture";
import { addDays, dayKeyOf, monthOf, weekdayIndex } from "@/app/(account)/app/calendar/dates";
import { readPublishedFor } from "@/app/(account)/app/_overview/content-provider";
import { FIXTURE_OVERVIEW_FACTS } from "@/app/(account)/app/_overview/fixture";
import { FIXTURE_ANSWERS_FACTS } from "@/app/(account)/app/_overview/answers-fixture";
import { FIXTURE_BLOG_READS_FACTS } from "@/app/(account)/app/_overview/blog-reads-fixture";

const ZONE = FIXTURE_CALENDAR_FACTS.timeZone;
const weekOf = (at: Date): string => {
  const day = dayKeyOf(at, ZONE);
  return addDays(day, -weekdayIndex(day));
};

/** The reserved account's live pages and the day they are judged on, as Plan and Overview read them. */
async function live() {
  const read = await readPublishedFor(null);
  const content = contentOf(read)!;
  const pages = content.pages.filter((page) => page.publishedAt <= read.now);
  return { read, pages, ladder: pageLadderOf(content.pages, read.now)! };
}

/** Every page the week names once: Plan's days that are not live, and every live page. */
async function titles(): Promise<string[]> {
  const { pages } = await live();
  const days = FIXTURE_CALENDAR_FACTS.drafts.filter((draft) => draft.state !== "published").map((draft) => draft.title);
  const waiting = FIXTURE_OVERVIEW_FACTS.waiting.flatMap((item) => ("title" in item ? [item.title] : []));
  return [...days, ...pages.map((page) => page.title), ...waiting];
}

describe("the demo week's titles", () => {
  it("are all different, and none is numbered or a placeholder", async () => {
    const all = await titles();
    expect(all.length).toBeGreaterThan(20);
    expect(new Set(all).size).toBe(all.length);
    for (const title of all) expect(title, title).not.toMatch(/\b(\d+|sample|lorem)\b/i);
  });

  it("belong to a small business, not to ReachKit or an SEO tool", async () => {
    for (const title of await titles()) expect(title, title).not.toMatch(/reachkit|\bseo\b/i);
  });
});

describe("the demo week's live pages", () => {
  it("wear every label the verdict gives, each at least once, over more than one week", async () => {
    const { pages, ladder } = await live();
    const labels = new Map<Label, number>();
    for (const row of ladder.rows) if (row.label !== null) labels.set(row.label, (labels.get(row.label) ?? 0) + 1);
    for (const label of ["climbing", "working", "too_early", "not_moving"] as const) {
      expect(labels.get(label) ?? 0, COPY[`review.label.${label}`]).toBeGreaterThanOrEqual(1);
    }
    expect(new Set(pages.map((page) => weekOf(page.publishedAt))).size).toBeGreaterThanOrEqual(2);
  });
});

describe("Overview's fixtures and Plan's name the same pages", () => {
  it("each day Plan shows live is the page published that day, and every page published that month is one of Plan's live days", async () => {
    const { read, pages } = await live();
    expect(read.now).toEqual(FIXTURE_CALENDAR_FACTS.now);
    const plan = FIXTURE_CALENDAR_FACTS.drafts
      .filter((draft) => draft.state === "published")
      .map((draft) => ({ day: draft.scheduledFor, title: draft.title, url: draft.liveUrl }));
    const month = pages
      .filter((page) => monthOf(dayKeyOf(page.publishedAt, ZONE)) === FIXTURE_MONTH)
      .map((page) => ({ day: dayKeyOf(page.publishedAt, ZONE), title: page.title, url: page.url }));
    expect(plan.length).toBeGreaterThan(1);
    expect(month).toEqual(expect.arrayContaining(plan));
    expect(month).toHaveLength(plan.length);
  });

  it("Overview's counts are the live pages': published, already ranking, and the last to go live", async () => {
    const { pages, ladder } = await live();
    const newest = pages[0]!;
    expect(FIXTURE_OVERVIEW_FACTS.pagesPublished).toMatchObject({ kind: "measured", value: pages.length });
    expect(FIXTURE_OVERVIEW_FACTS.pagesRanking).toMatchObject({ kind: "measured", value: ladder.rows.filter((row) => row.label === "working").length });
    expect(FIXTURE_OVERVIEW_FACTS.lastLive).toEqual({ title: newest.title, at: newest.publishedAt });
    expect(FIXTURE_BLOG_READS_FACTS.livePages).toBe(pages.length);
  });

  it("every page the AI answers and blog-reads fixtures name is a live page, by title and address", async () => {
    const { pages } = await live();
    const byUrl = new Map(pages.map((page) => [page.url, page.title]));
    const named = FIXTURE_ANSWERS_FACTS.weeks.flatMap((week) => [...week.questions, ...(week.pageQuestions ?? [])]).flatMap((q) => (q.page === null ? [] : [q.page]));
    expect(named.length).toBeGreaterThan(0);
    for (const page of named) expect(byUrl.get(page.url), page.url).toBe(page.title);
    const ids = new Set(pages.map((page) => page.id));
    expect(FIXTURE_BLOG_READS_FACTS.rows?.length).toBeGreaterThan(0);
    for (const row of FIXTURE_BLOG_READS_FACTS.rows ?? []) expect(ids.has(row.publicationId), row.publicationId).toBe(true);
  });
});
