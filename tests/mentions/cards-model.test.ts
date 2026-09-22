// SPEC §4 · §6 (2026-09-22, #1004) — the two cards' rules, decided with no
// database and no browser.
//
// The rules #1004 states, each one a thing a founder would be told wrongly
// if it broke: the questions are the ones **not** already tracked, the cut
// is the top twelve by AI search volume, the window is four weeks and never
// one, a page's count is **distinct** questions, and a site nobody has
// queried draws no card at all while a week the engines answered nobody in
// is a measurement that says so.
import { describe, expect, it } from "vitest";
import type { MentionWeek, StoredMention } from "../../src/lib/mentions/types.ts";
import {
  ALSO_APPEARING_MAX,
  assembleMentions,
  engineOf,
  type MentionsFacts,
} from "../../src/app/(account)/app/_overview/mentions-model.ts";

function mention(a: Partial<StoredMention> & { question: string; weekStart: string }): StoredMention {
  return {
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
  weekStart: string,
  mentions: readonly StoredMention[],
  status: MentionWeek["status"] = "measured"
): MentionWeek {
  return { weekStart, status, totalCount: null, mentions };
}

function model(facts: Partial<MentionsFacts> & { weeks: readonly MentionWeek[] }) {
  return assembleMentions({ tracked: [], ...facts });
}

/** The `rows` arm, or a failure that says which arm came back instead. */
function rowsOf(m: ReturnType<typeof assembleMentions>) {
  if (m.kind !== "rows") throw new Error(`expected rows, got ${m.kind}`);
  return m;
}

describe("a site with nothing measured draws no card, and a measured nothing says so", () => {
  it("no read row in the window is `never_queried` — the card is not drawn at all", () => {
    // An empty card is a claim that there was something to measure. There
    // has not been a pass that bought this yet.
    expect(model({ weeks: [] })).toEqual({ kind: "never_queried" });
  });

  it("a window whose every week was skipped or failed is `unread`, never a zero", () => {
    const m = model({
      weeks: [week("2026-09-14", [], "skipped_cap"), week("2026-09-21", [], "failed")],
    });
    // "We did not look" and "nobody named you" are different sentences.
    expect(m).toEqual({ kind: "unread", weeks: 2 });
  });

  it("a window that was read and found nothing is `zero` — a measurement, with the weeks it covers", () => {
    const m = model({ weeks: [week("2026-09-14", []), week("2026-09-21", [], "zero")] });
    expect(m).toEqual({ kind: "zero", weeks: 2 });
  });

  it("a skipped week inside a read window neither adds rows nor turns the window unread", () => {
    const m = rowsOf(
      model({
        weeks: [
          week("2026-09-14", [mention({ question: "ignored", weekStart: "2026-09-14" })], "skipped_cap"),
          week("2026-09-21", [mention({ question: "a real one", weekStart: "2026-09-21" })]),
        ],
      })
    );
    // Two weeks in the window, one of them read: the line says one.
    expect(m.weeks).toBe(1);
    expect(m.alsoAppearing.map((row) => row.question)).toEqual(["a real one"]);
  });
});

describe("*Also appearing for* is the questions we do NOT already track", () => {
  it("drops a mention matching a tracked search, and keeps the rest", () => {
    const m = rowsOf(
      model({
        tracked: ["best crm for small teams", "What is the best CRM for a small team?"],
        weeks: [
          week("2026-09-21", [
            mention({ question: "Best CRM for small teams", weekStart: "2026-09-21" }),
            mention({ question: "what is the best crm for a small team?", weekStart: "2026-09-21" }),
            mention({ question: "CRM that works offline", weekStart: "2026-09-21" }),
          ]),
        ],
      })
    );
    // Matched on case and collapsed whitespace — a tracked question in
    // different capitals is the same question.
    expect(m.alsoAppearing.map((row) => row.question)).toEqual(["CRM that works offline"]);
  });

  it("a tracked question still counts on *Cited pages* — that card's subject is the page", () => {
    const m = rowsOf(
      model({
        tracked: ["best crm for small teams"],
        weeks: [
          week("2026-09-21", [
            mention({
              question: "best crm for small teams",
              weekStart: "2026-09-21",
              citedUrl: "https://example.com/crm",
            }),
          ]),
        ],
      })
    );
    expect(m.alsoAppearing).toEqual([]);
    expect(m.citedPages).toEqual([{ url: "https://example.com/crm", label: "/crm", questions: 1 }]);
  });
});

describe("the top-12 cut, and what it sorts on", () => {
  it("keeps the twelve most asked and says how many there were in all", () => {
    const weeks = [
      week(
        "2026-09-21",
        Array.from({ length: 15 }, (_, i) =>
          mention({ question: `question ${String(i)}`, weekStart: "2026-09-21", aiSearchVolume: i * 10 })
        )
      ),
    ];
    const m = rowsOf(model({ weeks }));

    expect(ALSO_APPEARING_MAX).toBe(12);
    expect(m.alsoAppearing).toHaveLength(12);
    // Largest demand first.
    expect(m.alsoAppearing[0]?.aiSearchVolume).toBe(140);
    // And the card can say "12 of 15" rather than implying twelve was all.
    expect(m.alsoAppearingTotal).toBe(15);
  });

  it("a question the vendor could not size sorts last, never as a zero", () => {
    const m = rowsOf(
      model({
        weeks: [
          week("2026-09-21", [
            mention({ question: "unsized", weekStart: "2026-09-21", aiSearchVolume: null }),
            mention({ question: "asked once", weekStart: "2026-09-21", aiSearchVolume: 1 }),
          ]),
        ],
      })
    );
    // A null sorted as 0 would put "we could not measure this" above a
    // question one person a month actually asks.
    expect(m.alsoAppearing.map((row) => row.question)).toEqual(["asked once", "unsized"]);
    expect(m.alsoAppearing[1]?.aiSearchVolume).toBeNull();
  });

  it("orders ties by the question, so the list does not reshuffle between renders", () => {
    const m = rowsOf(
      model({
        weeks: [
          week("2026-09-21", [
            mention({ question: "b question", weekStart: "2026-09-21", aiSearchVolume: 50 }),
            mention({ question: "a question", weekStart: "2026-09-21", aiSearchVolume: 50 }),
          ]),
        ],
      })
    );
    expect(m.alsoAppearing.map((row) => row.question)).toEqual(["a question", "b question"]);
  });
});

describe("one question across weeks and engines is one row", () => {
  it("collapses the same question, gathers its engines, keeps the earliest date and the largest figure", () => {
    const m = rowsOf(
      model({
        weeks: [
          week("2026-09-07", [
            mention({
              question: "does a CRM replace a spreadsheet",
              weekStart: "2026-09-07",
              engine: "google_ai_overview",
              aiSearchVolume: 400,
              firstSeenAt: new Date("2026-06-01T00:00:00Z"),
            }),
          ]),
          week("2026-09-21", [
            mention({
              question: "Does a CRM replace a spreadsheet",
              weekStart: "2026-09-21",
              engine: "chatgpt",
              aiSearchVolume: 480,
              firstSeenAt: new Date("2026-07-01T00:00:00Z"),
            }),
          ]),
        ],
      })
    );

    expect(m.alsoAppearing).toHaveLength(1);
    const row = m.alsoAppearing[0];
    // The product's own column order, never the vendor's tokens.
    expect(row?.engines).toEqual(["ai_overview", "chatgpt"]);
    expect(row?.aiSearchVolume).toBe(480);
    expect(row?.firstSeenAt.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  it("falls back to the Monday it was read in where the vendor gave no date, never to today", () => {
    const m = rowsOf(
      model({
        weeks: [
          week("2026-09-21", [
            mention({ question: "no date", weekStart: "2026-09-21", firstSeenAt: null }),
          ]),
        ],
      })
    );
    // Midday UTC on that Monday, so the date reads as that Monday in a zone
    // either side of it.
    expect(m.alsoAppearing[0]?.firstSeenAt.toISOString()).toBe("2026-09-21T12:00:00.000Z");
  });
});

describe("*Cited pages* counts distinct questions, not rows", () => {
  it("one question answered by two engines over three weeks counts once", () => {
    const rows = [
      mention({ question: "q one", weekStart: "w", citedUrl: "https://example.com/a", engine: "google_ai_overview" }),
      mention({ question: "q one", weekStart: "w", citedUrl: "https://example.com/a", engine: "chatgpt" }),
      mention({ question: "q two", weekStart: "w", citedUrl: "https://example.com/a" }),
    ];
    const m = rowsOf(
      model({
        weeks: [
          week("2026-09-07", rows.map((r) => ({ ...r, weekStart: "2026-09-07" }))),
          week("2026-09-14", rows.map((r) => ({ ...r, weekStart: "2026-09-14" }))),
          week("2026-09-21", rows.map((r) => ({ ...r, weekStart: "2026-09-21" }))),
        ],
      })
    );
    // Nine rows, two questions.
    expect(m.citedPages).toEqual([{ url: "https://example.com/a", label: "/a", questions: 2 }]);
  });

  it("orders pages by how many questions cite each, most first", () => {
    const m = rowsOf(
      model({
        weeks: [
          week("2026-09-21", [
            mention({ question: "one", weekStart: "2026-09-21", citedUrl: "https://example.com/quiet" }),
            mention({ question: "two", weekStart: "2026-09-21", citedUrl: "https://example.com/busy" }),
            mention({ question: "three", weekStart: "2026-09-21", citedUrl: "https://example.com/busy" }),
          ]),
        ],
      })
    );
    expect(m.citedPages).toEqual([
      { url: "https://example.com/busy", label: "/busy", questions: 2 },
      { url: "https://example.com/quiet", label: "/quiet", questions: 1 },
    ]);
  });

  it("a mention citing no page of ours still appears as a question, and adds no page", () => {
    const m = rowsOf(
      model({ weeks: [week("2026-09-21", [mention({ question: "named, not quoted", weekStart: "2026-09-21" })])] })
    );
    expect(m.alsoAppearing.map((row) => row.question)).toEqual(["named, not quoted"]);
    expect(m.citedPages).toEqual([]);
  });
});

describe("a cited page is shown by its path, and linked at its whole address", () => {
  it("shows the path, keeps the address on the link, and reads the home page as /", () => {
    const m = rowsOf(
      model({
        weeks: [
          week("2026-09-21", [
            mention({ question: "one", weekStart: "2026-09-21", citedUrl: "https://example.com/guides/pex?utm=1" }),
            mention({ question: "two", weekStart: "2026-09-21", citedUrl: "https://example.com/" }),
          ]),
        ],
      })
    );
    const byUrl = new Map(m.citedPages.map((page) => [page.url, page.label]));
    // The query survives: two pages differing only by it are two pages.
    expect(byUrl.get("https://example.com/guides/pex?utm=1")).toBe("/guides/pex?utm=1");
    expect(byUrl.get("https://example.com/")).toBe("/");
  });

  it("an address that will not parse keeps its whole text rather than an invented path", () => {
    const m = rowsOf(
      model({
        weeks: [week("2026-09-21", [mention({ question: "q", weekStart: "2026-09-21", citedUrl: "not a url" })])],
      })
    );
    expect(m.citedPages).toEqual([{ url: "not a url", label: "not a url", questions: 1 }]);
  });
});

describe("the vendor's platform becomes one of the product's three engines, or nothing", () => {
  it("reads the two the pilot actually saw", () => {
    expect(engineOf("google_ai_overview")).toBe("ai_overview");
    expect(engineOf("ChatGPT")).toBe("chatgpt");
  });

  it("reads AI Mode as the mode, not as the overview", () => {
    expect(engineOf("google_ai_mode")).toBe("ai_mode");
  });

  it("a platform this product has no word for yields null — never a vendor token on a customer's screen", () => {
    expect(engineOf("some_new_platform")).toBeNull();
    expect(engineOf(null)).toBeNull();
  });

  it("a question whose engine we have no word for is still drawn, without one", () => {
    const m = rowsOf(
      model({
        weeks: [
          week("2026-09-21", [
            mention({ question: "still a question", weekStart: "2026-09-21", engine: "some_new_platform" }),
          ]),
        ],
      })
    );
    expect(m.alsoAppearing[0]?.question).toBe("still a question");
    expect(m.alsoAppearing[0]?.engines).toEqual([]);
  });
});

describe("neither card can show a rank position or a sentiment", () => {
  it("no row carries a member either could travel in", () => {
    const m = rowsOf(
      model({
        weeks: [
          week("2026-09-21", [
            mention({ question: "q", weekStart: "2026-09-21", citedUrl: "https://example.com/a" }),
          ]),
        ],
      })
    );
    // SPEC §4 (2026-09-20) and #1004. A field that does not exist is the
    // only way a later surface cannot render one.
    expect(Object.keys(m.alsoAppearing[0] ?? {}).sort()).toEqual([
      "aiSearchVolume",
      "engines",
      "firstSeenAt",
      "question",
    ]);
    expect(Object.keys(m.citedPages[0] ?? {}).sort()).toEqual(["label", "questions", "url"]);
  });
});
