/** @vitest-environment jsdom */
// SPEC §6 (2026-09-20, #908) measure (d), issue #921 — *AI engines on your
// blog*: what it states, decided from its facts, and what a reader meets.
//
// The model is pure over its facts, so the rules worth holding are held
// here rather than read off a render: a fetch is never a visitor, an
// unreadable count is never a zero, a site we do not host is not drawn at
// all, and the referral figure is always "at least".
//
// **Rendering convention.** `tests/app/**` runs under the `node` project,
// whose environment has no `document`; this file declares `jsdom` for
// itself and renders with `react-dom/server`. The card is server-rendered —
// there is nothing on it to press.
//
// **`copy()` is not mocked**: every assertion about a sentence is about
// what a reader sees, so the real registry is what renders.
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AI_BLOG_ENGINES, BLOG_READS_WINDOW_D } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { formatCount } from "@/app/(account)/app/_overview/present";
import type { BlogReadRow } from "@/lib/publish/reads/store";
import {
  assembleBlogReads,
  windowStartDay,
  type BlogReadsFacts,
} from "@/lib/publish/reads/model";
import { FIXTURE_BLOG_READS_FACTS } from "@/app/(account)/app/_overview/blog-reads-fixture";
import { BlogReads } from "@/app/(account)/app/_overview/BlogReads";

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

function render(node: React.JSX.Element | null): Element {
  const container = document.createElement("div");
  container.innerHTML = node === null ? "" : renderToStaticMarkup(node);
  return container;
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

  it("the card renders nothing at all when it is not shown", () => {
    expect(render(<BlogReads model={model({ hosted: false })} />).textContent).toBe("");
  });
});

describe("what a reader meets", () => {
  const MODEL = assembleBlogReads(FIXTURE_BLOG_READS_FACTS, BLOG_READS_WINDOW_D, AT);
  const card = (): Element => render(<BlogReads model={MODEL} />);

  it("states its title and the window it counts over", () => {
    const el = card();
    expect(el.textContent).toContain(copy("overview.blog.title"));
    expect(el.textContent).toContain(
      copy("overview.blog.lead", { days: formatCount(BLOG_READS_WINDOW_D) })
    );
  });

  it("the fetch figure is the fetch total", () => {
    const value = card().querySelector('[data-testid="blog-reads-fetches-value"]');
    expect(value?.textContent).toBe(
      MODEL.fetches.kind === "unmeasured" ? null : formatCount(MODEL.fetches.value)
    );
  });

  it('the referral figure is always "at least", with the line saying why', () => {
    const el = card();
    const value = el.querySelector('[data-testid="blog-reads-referrals-value"]');
    expect(value?.textContent).toBe(
      copy("overview.blog.at-least", {
        n: formatCount(MODEL.referrals.kind === "unmeasured" ? 0 : MODEL.referrals.value),
      })
    );
    expect(el.textContent).toContain(copy("overview.blog.at-least.means"));
  });

  it("every engine has a named row, silent ones included", () => {
    const el = card();
    for (const engine of AI_BLOG_ENGINES) {
      expect(el.querySelector(`[data-testid="blog-reads-engine-${engine}"]`), engine).not.toBeNull();
    }
  });

  it("§11 — no rank position and no sentiment reaches the screen", () => {
    // 2026-09-20: "an 'AI rank position' or sentiment measure" is not in
    // the MVP. The model has no member to render one from; this holds the
    // words off the surface too.
    const text = card().textContent ?? "";
    expect(text.toLowerCase()).not.toContain("rank");
    expect(text.toLowerCase()).not.toContain("sentiment");
    expect(text.toLowerCase()).not.toContain("position");
  });

  it("an unreadable count draws its written line, not a zero", () => {
    const el = render(<BlogReads model={model({ rows: null })} />);
    expect(el.querySelector('[data-testid="blog-reads-fetches-value"]')).toBeNull();
    expect(el.textContent).toContain(copy("overview.blog.fetches.label"));
  });
});
