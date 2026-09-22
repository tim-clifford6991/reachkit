/** @vitest-environment jsdom */
// SPEC §4 · §6 (2026-09-22, #1004) — what a founder actually meets on the
// two mentions cards.
//
// The model's own rules are held in `tests/mentions/cards-model.test.ts`,
// with no render. What is held here is the half only a render can answer:
// which sentence is on screen in each of the four states, that the question
// and the page address are drawn whole rather than clamped, and that
// nothing resembling a rank or a sentiment reaches the markup.
//
// **Rendering convention.** `tests/app/**` runs under the `node` project,
// whose environment has no `document`; this file declares `jsdom` for
// itself and renders with `react-dom/server`. Both cards are
// server-rendered — there is nothing on them to press.
//
// **`copy()` is not mocked**: every assertion about a sentence is about
// what a reader sees, so the real registry is what renders.
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { copy } from "@/lib/presentation/copy";
import { formatCount } from "@/app/(account)/app/_overview/present";
import type { MentionWeek, StoredMention } from "@/lib/mentions";
import {
  assembleMentions,
  MENTIONS_WINDOW_WEEKS,
  type MentionsFacts,
} from "@/app/(account)/app/_overview/mentions-model";
import { FIXTURE_MENTIONS_FACTS } from "@/app/(account)/app/_overview/mentions-fixture";
import { MentionCards } from "@/app/(account)/app/_overview/MentionCards";

const ZONE = "Europe/Berlin";

function mention(a: Partial<StoredMention> & { question: string }): StoredMention {
  return {
    weekStart: "2026-09-21",
    engine: "google_ai_overview",
    model: null,
    citedUrl: null,
    aiSearchVolume: null,
    monthlySearches: null,
    firstSeenAt: null,
    lastSeenAt: null,
    ...a,
  };
}

function week(
  mentions: readonly StoredMention[],
  status: MentionWeek["status"] = "measured",
  weekStart = "2026-09-21"
): MentionWeek {
  return { weekStart, status, totalCount: null, mentions };
}

function render(facts: Partial<MentionsFacts> & { weeks: readonly MentionWeek[] }): Element {
  const node = <MentionCards model={assembleMentions({ tracked: [], ...facts })} timeZone={ZONE} />;
  const container = document.createElement("div");
  container.innerHTML = node === null ? "" : renderToStaticMarkup(node);
  return container;
}

describe("a site nobody has queried is not shown an empty card", () => {
  it("renders nothing at all", () => {
    const container = render({ weeks: [] });
    // Not an empty state, not a dash, not a heading with nothing under it:
    // there has been no pass that bought this, and a card would be a claim
    // that there was something to measure.
    expect(container.innerHTML).toBe("");
  });
});

describe("the two states that are a sentence, not a list", () => {
  it("a window the engines answered nobody in says it was measured", () => {
    const container = render({
      weeks: [week([], "zero"), week([], "zero", "2026-09-14"), week([], "zero", "2026-09-07")],
    });
    const stated = container.querySelector('[data-testid="mentions-state"]')?.textContent ?? "";

    expect(stated).toBe(copy("overview.mentions.zero", { weeks: formatCount(3) }));
    // The words that matter: it is measured, not missing.
    expect(stated).toContain("measured, not missing");
  });

  it("a window nobody could read says we did not look — never that nobody named you", () => {
    const container = render({ weeks: [week([], "skipped_cap"), week([], "failed", "2026-09-14")] });
    const stated = container.querySelector('[data-testid="mentions-state"]')?.textContent ?? "";

    expect(stated).toBe(copy("overview.mentions.unread", { weeks: formatCount(2) }));
    expect(stated).not.toContain("named you");
  });

  it("neither of those draws the cited-pages card, because there is nothing measured to put in it", () => {
    const container = render({ weeks: [week([], "zero")] });
    expect(container.querySelector('[data-testid="mentions-cited"]')).toBeNull();
  });
});

describe("the questions card", () => {
  it("draws each question whole, with the engines that answered and the date first seen", () => {
    const container = render({
      weeks: [
        week([
          mention({
            question: "what should a small business look for when it is choosing between a CRM and a shared inbox",
            engine: "chatgpt",
            aiSearchVolume: 1150,
            firstSeenAt: new Date("2026-06-15T00:00:00Z"),
          }),
        ]),
      ],
    });

    const row = container.querySelector('[data-testid="mentions-also-row"]');
    // The question is rendered in full — it wraps, it is not clamped, and
    // no character of it is replaced by an ellipsis in the markup.
    expect(row?.textContent).toContain(
      "what should a small business look for when it is choosing between a CRM and a shared inbox"
    );
    expect(row?.textContent).toContain(copy("ai-answers.engine.chatgpt"));
    expect(row?.textContent).toContain(copy("overview.mentions.also.asked", { count: formatCount(1150) }));
    // The customer's own zone, not the server's.
    expect(row?.textContent).toMatch(/First seen/);
  });

  it("says in words that a question could not be sized, rather than showing a zero", () => {
    const container = render({ weeks: [week([mention({ question: "unsized", aiSearchVolume: null })])] });
    const asked = container.querySelector('[data-testid="mentions-asked"]')?.textContent ?? "";

    expect(asked).toBe(copy("overview.mentions.also.unsized"));
    expect(asked).not.toContain("0");
  });

  it("omits the engine line rather than printing a vendor token", () => {
    const container = render({
      weeks: [week([mention({ question: "q", engine: "some_new_platform" })])],
    });
    expect(container.querySelector('[data-testid="mentions-engines"]')).toBeNull();
    expect(container.innerHTML).not.toContain("some_new_platform");
  });

  it("states how much of the list is on screen only when the cut actually hid something", () => {
    const short = render({ weeks: [week([mention({ question: "only one", aiSearchVolume: 10 })])] });
    expect(short.querySelector('[data-testid="mentions-also-showing"]')).toBeNull();

    const long = render({
      weeks: [
        week(
          Array.from({ length: 15 }, (_, i) =>
            mention({ question: `question ${String(i)}`, aiSearchVolume: i })
          )
        ),
      ],
    });
    expect(long.querySelector('[data-testid="mentions-also-showing"]')?.textContent).toBe(
      copy("overview.mentions.also.showing", { shown: formatCount(12), total: formatCount(15) })
    );
  });

  it("says the window it reads, on both cards, and never implies one week", () => {
    const container = render({ weeks: [week([mention({ question: "q", citedUrl: "https://example.com/a" })])] });
    const windows = [...container.querySelectorAll('[data-testid="mentions-window"]')];

    expect(windows).toHaveLength(2);
    for (const line of windows) {
      expect(line.textContent).toBe(
        copy("overview.mentions.window", { weeks: formatCount(MENTIONS_WINDOW_WEEKS) })
      );
    }
  });
});

describe("the cited-pages card", () => {
  it("links each page at its own address and says how many questions cite it", () => {
    const container = render({
      weeks: [
        week([
          mention({ question: "one", citedUrl: "https://example.com/guides/crm" }),
          mention({ question: "two", citedUrl: "https://example.com/guides/crm" }),
          mention({ question: "three", citedUrl: "https://example.com/pricing" }),
        ]),
      ],
    });

    const links = [...container.querySelectorAll('[data-testid="mentions-cited-url"]')];
    // The link goes to the whole address …
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://example.com/guides/crm",
      "https://example.com/pricing",
    ]);
    // … and what a reader sees is the path, because the domain is theirs
    // and is the same on every row. At 390 the whole address was cut to
    // `https://example.c` on all of them and told a reader nothing.
    expect(links.map((a) => a.textContent)).toEqual(["/guides/crm", "/pricing"]);
    const rows = [...container.querySelectorAll('[data-testid="mentions-cited-row"]')];
    expect(rows[0]?.textContent).toContain(copy("overview.mentions.cited.questions", { count: formatCount(2) }));
    // One question is "1 question", not "1 questions".
    expect(rows[1]?.textContent).toContain(copy("overview.mentions.cited.one-question"));
  });

  it("says so when the answers named the site but quoted no page of theirs", () => {
    const container = render({ weeks: [week([mention({ question: "named, not quoted" })])] });

    expect(container.querySelector('[data-testid="mentions-cited-none"]')?.textContent).toBe(
      copy("overview.mentions.cited.none")
    );
    expect(container.querySelector('[data-testid="mentions-cited-row"]')).toBeNull();
  });
});

describe("a one-week window has its own sentence", () => {
  it("says \"this week\" rather than \"the last 1 weeks\"", () => {
    const zero = render({ weeks: [week([], "zero")] });
    expect(zero.querySelector('[data-testid="mentions-state"]')?.textContent).toBe(
      copy("overview.mentions.zero.one-week")
    );
    expect(zero.textContent).not.toContain("1 weeks");

    const unread = render({ weeks: [week([], "skipped_cap")] });
    expect(unread.querySelector('[data-testid="mentions-state"]')?.textContent).toBe(
      copy("overview.mentions.unread.one-week")
    );
    expect(unread.textContent).not.toContain("1 weeks");
  });
});

describe("what never reaches the markup", () => {
  it("no rank, no position and no sentiment word, on the densest frame the fixture holds", () => {
    const node = <MentionCards model={assembleMentions(FIXTURE_MENTIONS_FACTS)} timeZone={ZONE} />;
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(node);
    const text = container.textContent ?? "";

    // SPEC §4 (2026-09-20): "'AI rank position' and sentiment are never
    // shown", repeated by #1004.
    for (const word of ["rank", "position", "sentiment", "positive", "negative"]) {
      expect(text.toLowerCase()).not.toContain(word);
    }
  });

  it("the fixture draws both cards, with the top-12 cut and a skipped week inside the window", () => {
    const model = assembleMentions(FIXTURE_MENTIONS_FACTS);
    if (model.kind !== "rows") throw new Error(`expected rows, got ${model.kind}`);

    // Three of the fixture's four weeks were read; the oldest was skipped
    // for the cap and contributes nothing without making the window unread.
    expect(model.weeks).toBe(3);
    expect(model.alsoAppearing).toHaveLength(12);
    expect(model.alsoAppearingTotal).toBeGreaterThan(12);
    expect(model.citedPages.length).toBeGreaterThan(0);
    // The tracked question the fixture also holds is excluded from the
    // questions card and counted on the pages card.
    expect(model.alsoAppearing.map((row) => row.question)).not.toContain("best crm for small teams");
  });
});
