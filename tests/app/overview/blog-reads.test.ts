// SPEC §6 (2026-09-20, #908) measure (d), issue #921 — the AI reads and
// visits on hosted pages, decided from their facts.
//
// The model is pure over its facts, so the rules worth holding are held
// here rather than read off a render: a fetch is never a visitor, an
// unreadable count is never a zero, a site we do not host is not drawn at
// all, and the referral figure is always "at least".
import { describe, expect, it } from "vitest";
import { AI_BLOG_ENGINES, BLOG_READS_WINDOW_D } from "@/lib/config/constants";
import type { BlogReadRow } from "@/lib/publish/reads/store";
import {
  assembleBlogReads,
  windowStartDay,
  type BlogReadsFacts,
} from "@/lib/publish/reads/model";

const AT = new Date("2026-08-31T06:00:00.000Z");

function row(
  engine: BlogReadRow["engine"],
  kind: BlogReadRow["kind"],
  hits: number,
  day = "2026-08-31"
): BlogReadRow {
  return { publicationId: "pub-1", day, engine, kind, hits };
}

function facts(over: Partial<BlogReadsFacts> = {}): BlogReadsFacts {
  return { hosted: true, livePages: 3, rows: [], ...over };
}

function model(over: Partial<BlogReadsFacts> = {}) {
  return assembleBlogReads(facts(over), BLOG_READS_WINDOW_D, AT);
}


describe("§6(d) — two measures, and they are never added together", () => {
  it("fetches count the answer fetches, and nothing else", () => {
    const m = model({
      rows: [
        row("chatgpt", "answer_fetch", 10),
        row("perplexity", "answer_fetch", 4),
        row("chatgpt", "index_fetch", 100),
        row("chatgpt", "referral", 7),
      ],
    });
    expect(m.fetches).toMatchObject({ kind: "measured", value: 14 });
  });

  it("referrals count the referrals, and nothing else", () => {
    const m = model({
      rows: [
        row("chatgpt", "answer_fetch", 10),
        row("chatgpt", "referral", 7),
        row("gemini", "referral", 2),
      ],
    });
    expect(m.referrals).toMatchObject({ kind: "measured", value: 9 });
  });

  it("a search indexer's fetches are counted in neither figure", () => {
    const m = model({ rows: [row("chatgpt", "index_fetch", 500)] });
    expect(m.fetches).toMatchObject({ kind: "zero", value: 0 });
    expect(m.referrals).toMatchObject({ kind: "zero", value: 0 });
  });
});

describe("the window the counts are read over", () => {
  it("is inclusive of today — seven days is today and the six before it", () => {
    expect(windowStartDay(new Date("2026-09-22T11:00:00.000Z"), 7)).toBe("2026-09-16");
  });

  it("crosses a month and a year boundary by the calendar, not by arithmetic on the day", () => {
    expect(windowStartDay(new Date("2026-03-03T00:00:00.000Z"), 7)).toBe("2026-02-25");
    expect(windowStartDay(new Date("2026-01-02T00:00:00.000Z"), 7)).toBe("2025-12-27");
  });

  it("a one-day window is today alone", () => {
    expect(windowStartDay(new Date("2026-09-22T23:59:00.000Z"), 1)).toBe("2026-09-22");
  });
});

describe("the engine breakdown", () => {
  it("names every engine the build knows, in the pin's order, with zero where none came", () => {
    const m = model({ rows: [row("claude", "answer_fetch", 3)] });
    expect(m.byEngine.map((e) => e.engine)).toEqual([...AI_BLOG_ENGINES]);
    expect(m.byEngine.find((e) => e.engine === "claude")?.fetches).toBe(3);
    expect(m.byEngine.find((e) => e.engine === "gemini")?.fetches).toBe(0);
  });

  it("a referral is not a fetch on any engine's row", () => {
    const m = model({ rows: [row("chatgpt", "referral", 9)] });
    expect(m.byEngine.every((e) => e.fetches === 0)).toBe(true);
  });

  it("each engine's visits are counted beside its reads, and each week carries both", () => {
    const m = model({ rows: [row("chatgpt", "referral", 2), row("chatgpt", "answer_fetch", 5), row("perplexity", "referral", 1)] });
    expect(m.byEngine.find((e) => e.engine === "chatgpt")).toMatchObject({ fetches: 5, referrals: 2 });
    expect(m.byEngine.find((e) => e.engine === "perplexity")).toMatchObject({ fetches: 0, referrals: 1 });
    expect(m.weekly.at(-1)).toMatchObject({ fetches: 5, referrals: 3 });
  });

  it("one engine's days are summed", () => {
    const m = model({
      rows: [
        row("chatgpt", "answer_fetch", 5, "2026-08-30"),
        row("chatgpt", "answer_fetch", 6, "2026-08-31"),
      ],
    });
    expect(m.byEngine.find((e) => e.engine === "chatgpt")?.fetches).toBe(11);
  });
});

describe("REQ-004 — a reading nobody took never becomes a zero", () => {
  it("counts that could not be read are unmeasured, not zero", () => {
    const m = model({ rows: null });
    expect(m.fetches.kind).toBe("unmeasured");
    expect(m.referrals.kind).toBe("unmeasured");
    expect(m.show).toBe(true);
  });

  it("a hosted blog nothing was counted on is a real zero", () => {
    const m = model({ rows: [] });
    expect(m.fetches).toMatchObject({ kind: "zero", value: 0 });
  });

  it("a failed read on a blog with nothing published is not drawn either", () => {
    // Two reasons not to draw a card, and neither of them is a zero.
    expect(model({ rows: null, livePages: 0 }).show).toBe(false);
  });
});

describe('§6(d) — "on hosted blogs only"', () => {
  it("a site that publishes to WordPress is not drawn at all", () => {
    expect(model({ hosted: false }).show).toBe(false);
  });

  it("a hosted site with no page live yet is not drawn either", () => {
    expect(model({ livePages: 0 }).show).toBe(false);
  });
});
