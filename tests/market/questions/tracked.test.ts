// tests/market/questions/tracked.test.ts — SPEC §6 (2026-09-20, #908; both
// numbers confirmed as written by the owner 2026-09-21, §12 · #985), issue
// #919.
//
// "Each published page's own question may join the tracked set: **at most
// 24 tracked questions in all** (the twelve plus twelve) … and a page's
// question leaves the set after **8 weeks** without a mention. The set
// never grows past the cap, so its cost is flat."
//
// Pure: no database, no clock, no vendor, nothing stubbed — the cap
// arithmetic and the retirement, which are the two things the owner's worry
// (a set that grows with every page published) is answered by.
import { describe, expect, it } from "vitest";
import path from "node:path";
import { PAGE_QUESTION_RETIRE_WEEKS, TRACKED_QUESTIONS_MAX } from "../../../src/lib/config/constants.ts";
import {
  missesByPage,
  trackedQuestions,
  type PageQuestionCandidate,
} from "../../../src/lib/market/questions/tracked.ts";
import { QUESTIONS_DIR, runtimeImportClosure } from "./import-graph.ts";

/** One live page, ranked where the caller says. The question is the
 *  opportunity's own asked-as form; nothing here composes one. */
function page(n: number, position: number | null): PageQuestionCandidate {
  return {
    publicationId: `pub-${String(n).padStart(2, "0")}`,
    liveUrl: `https://example.com/page-${n}`,
    question: `What is page ${n} about?`,
    search: `page ${n} search`,
    position,
  };
}

/** `n` live pages, ranked 1, 2, 3 … — so "nearest the first page first" has
 *  an order to be right or wrong about. */
function pages(n: number): PageQuestionCandidate[] {
  return Array.from({ length: n }, (_, i) => page(i + 1, i + 1));
}

const NO_MISSES = new Map<string, number>();

describe("SPEC §6 — the tracked set never grows past 24, whatever the customer publishes", () => {
  it("the two pins are the numbers §6 states", () => {
    expect(TRACKED_QUESTIONS_MAX).toBe(24);
    expect(PAGE_QUESTION_RETIRE_WEEKS).toBe(8);
  });

  it("with 30 live pages the pass still tracks exactly 24 — the issue's own done-when", () => {
    const tracked = trackedQuestions({ selected: 12, candidates: pages(30), misses: NO_MISSES });

    expect(tracked.tracked).toBe(24);
    expect(tracked.asked).toHaveLength(12);
    // The eighteen that did not fit are waiting, not retired: nothing is
    // wrong with them and they are asked the week a slot opens.
    expect(tracked.waiting).toHaveLength(18);
    expect(tracked.retired).toEqual([]);
  });

  it("a site with two live pages tracks fourteen — and costs what fourteen cost", () => {
    // The other half of the cap's promise: it is a ceiling, not a quota, so
    // a small site is not asked twenty-four questions to fill it up.
    const tracked = trackedQuestions({ selected: 12, candidates: pages(2), misses: NO_MISSES });
    expect(tracked.asked).toHaveLength(2);
    expect(tracked.tracked).toBe(14);
    expect(tracked.waiting).toEqual([]);
  });

  it("the page half is whatever the market's questions left of the cap", () => {
    // A thin market selected nine, so the pages may have fifteen — the cap
    // is on the set, not on either half of it.
    const thin = trackedQuestions({ selected: 9, candidates: pages(30), misses: NO_MISSES });
    expect(thin.asked).toHaveLength(15);
    expect(thin.tracked).toBe(24);

    // And a market that somehow filled the cap by itself leaves no room —
    // without taking a slot from the twelve, which are not this function's
    // to trim.
    const full = trackedQuestions({ selected: 24, candidates: pages(30), misses: NO_MISSES });
    expect(full.asked).toEqual([]);
    expect(full.waiting).toHaveLength(30);
    expect(full.tracked).toBe(24);
    expect(trackedQuestions({ selected: 30, candidates: pages(5), misses: NO_MISSES }).tracked).toBe(30);
  });

  it("asks the pages nearest the first page first, and queues a page that ranks nowhere behind every page that does", () => {
    const candidates = [page(1, 40), page(2, null), page(3, 3), page(4, 11)];
    const asked = trackedQuestions({ selected: 22, candidates, misses: NO_MISSES }).asked;

    expect(asked.map((c) => c.publicationId)).toEqual(["pub-03", "pub-04"]);
    // Two passes over the same pages ask the same questions: the order is
    // total, so an unranked pair cannot swap between weeks.
    const ordered = trackedQuestions({ selected: 12, candidates, misses: NO_MISSES }).asked;
    expect(ordered.map((c) => c.publicationId)).toEqual(["pub-03", "pub-04", "pub-01", "pub-02"]);
  });

  it("holds the cap for any market size and any number of pages", () => {
    for (let selected = 0; selected <= 12; selected += 1) {
      for (const live of [0, 1, 12, 13, 30, 200]) {
        const tracked = trackedQuestions({ selected, candidates: pages(live), misses: NO_MISSES });
        expect(tracked.tracked).toBeLessThanOrEqual(TRACKED_QUESTIONS_MAX);
        expect(tracked.tracked).toBe(selected + tracked.asked.length);
        expect(tracked.asked.length + tracked.waiting.length).toBe(live);
      }
    }
  });
});

describe("SPEC §6 — a page's question leaves the set after 8 weeks without a mention", () => {
  it("retires at the eighth miss, not the seventh, and hands the slot to the next candidate", () => {
    const candidates = pages(13);
    const misses = new Map([
      ["pub-01", PAGE_QUESTION_RETIRE_WEEKS],
      ["pub-02", PAGE_QUESTION_RETIRE_WEEKS - 1],
    ]);
    const tracked = trackedQuestions({ selected: 12, candidates, misses });

    expect(tracked.retired.map((c) => c.publicationId)).toEqual(["pub-01"]);
    // Seven misses is still in the set: the rule is eight.
    expect(tracked.asked.map((c) => c.publicationId)).toContain("pub-02");
    // Twelve slots, and the thirteenth page takes the retired one's.
    expect(tracked.asked).toHaveLength(12);
    expect(tracked.asked.map((c) => c.publicationId)).toContain("pub-13");
    expect(tracked.tracked).toBe(24);
  });

  it("retires a page whose weeks ran out even where the set has room to spare", () => {
    // Retirement is about the question, not about the room: a question that
    // has told us what it is going to tell us stops being asked whether or
    // not anything is queued behind it.
    const tracked = trackedQuestions({
      selected: 12,
      candidates: pages(2),
      misses: new Map([["pub-01", 9]]),
    });
    expect(tracked.retired.map((c) => c.publicationId)).toEqual(["pub-01"]);
    expect(tracked.asked.map((c) => c.publicationId)).toEqual(["pub-02"]);
    expect(tracked.tracked).toBe(13);
  });

  it("counts the run of weeks that answered, and a mention resets it", () => {
    // Newest week first. `pub-01` was named three weeks ago, so its run is
    // two; `pub-02` has never been named in the window.
    const weeks = [
      { asked: ["pub-01", "pub-02"], mentioned: [] },
      { asked: ["pub-01", "pub-02"], mentioned: [] },
      { asked: ["pub-01", "pub-02"], mentioned: ["pub-01"] },
      { asked: ["pub-01", "pub-02"], mentioned: [] },
      { asked: ["pub-01", "pub-02"], mentioned: [] },
    ];
    const misses = missesByPage(weeks);
    expect(misses.get("pub-01")).toBe(2);
    expect(misses.get("pub-02")).toBe(5);
  });

  it("a week that did not ask a page is not a week the answer was no", () => {
    // Eight weeks of history, but this page was only asked in three of them
    // — it was published four weeks ago, or a ceiling stopped the pages.
    // Three misses, not eight, so nothing retires.
    const weeks = [
      { asked: ["pub-01"], mentioned: [] },
      { asked: [], mentioned: [] },
      { asked: ["pub-01"], mentioned: [] },
      { asked: [], mentioned: [] },
      { asked: ["pub-01"], mentioned: [] },
      { asked: [], mentioned: [] },
      { asked: [], mentioned: [] },
      { asked: [], mentioned: [] },
    ];
    const misses = missesByPage(weeks);
    expect(misses.get("pub-01")).toBe(3);
    expect(
      trackedQuestions({ selected: 12, candidates: [page(1, 4)], misses }).retired
    ).toEqual([]);
  });

  it("a page with no history at all has missed nothing", () => {
    expect(missesByPage([]).size).toBe(0);
    const fresh = trackedQuestions({ selected: 12, candidates: pages(1), misses: missesByPage([]) });
    expect(fresh.retired).toEqual([]);
    expect(fresh.asked).toHaveLength(1);
  });

  it("eight weeks of misses retires, however the history is spelled", () => {
    const weeks = Array.from({ length: PAGE_QUESTION_RETIRE_WEEKS }, () => ({
      asked: ["pub-01"],
      mentioned: [] as string[],
    }));
    const misses = missesByPage(weeks);
    expect(misses.get("pub-01")).toBe(PAGE_QUESTION_RETIRE_WEEKS);
    expect(
      trackedQuestions({ selected: 12, candidates: pages(1), misses }).retired.map((c) => c.publicationId)
    ).toEqual(["pub-01"]);
  });
});

describe("issue #919 — the arithmetic is pure", () => {
  it("reaches nothing but the two pins", () => {
    // The same rule `select.ts` is held to (BP-025 decision 1): the cap
    // arithmetic decides who is asked, and a module that can reach a
    // vendor, a database or a model from there is one that could spend
    // money while deciding it.
    const closure = runtimeImportClosure(path.join(QUESTIONS_DIR, "tracked.ts"));
    expect(closure).toEqual(["lib/config/constants.ts", "lib/market/questions/tracked.ts"]);
  });

  it("is total: it invents nothing from nonsense, and refuses no input", () => {
    const candidates = pages(3);
    // A negative or absurd `selected` cannot make the cap bigger.
    expect(trackedQuestions({ selected: -5, candidates, misses: NO_MISSES }).tracked).toBe(3);
    // A cap of zero asks no page question and retires none.
    const none = trackedQuestions({ selected: 0, candidates, misses: NO_MISSES, max: 0 });
    expect(none.asked).toEqual([]);
    expect(none.retired).toEqual([]);
    expect(none.waiting).toHaveLength(3);
    // A retirement window below one week would retire every page on its
    // first pass; the floor is one.
    expect(
      trackedQuestions({ selected: 0, candidates, misses: NO_MISSES, retireAfter: 0 }).retired
    ).toEqual([]);
  });
});
