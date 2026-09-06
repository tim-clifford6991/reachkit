// tests/market/questions/matrix.test.ts — BUILD §6.7
//
// The AI-answers card: its denominator, its two counts, the three cell
// kinds it keeps apart, the five invariants it holds, and the coverage
// state that says which AI answers it could see at all.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BATTERY_ENGINES,
  buildAiAnswersCard,
  engineColumns,
  type AiAnswersCard,
  type BatteryAnswers,
} from "../../../src/lib/market/questions/matrix.ts";
import { measured, unmeasured, type Measured } from "../../../src/lib/measure/measured.ts";
import type { MarketAiAnswer, MarketSerp, QuestionView } from "../../../src/lib/market/views.ts";

const SOURCE_PATH = path.resolve(import.meta.dirname, "../../../src/lib/market/questions/matrix.ts");
const SOURCE = readFileSync(SOURCE_PATH, "utf8");
const AT = new Date("2026-09-05T10:00:00.000Z");

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

function question(i: number): QuestionView {
  return {
    id: `q${i}`,
    text: `What's the best thing ${i}?`,
    phrasing: "template",
    search: { keyword: `best thing ${i}`, volume: 100 + i },
  };
}

function serp(cited: string[] | null): MarketSerp {
  return {
    organic: [{ position: 1, domain: "holder.com" }],
    aiOverview:
      cited === null
        ? { present: false, referenceDomains: [] }
        : { present: true, referenceDomains: cited },
  };
}

const ok = (cited: string[] | null): Measured<MarketSerp> => measured(serp(cited), AT);
const missing = (reason: "undeterminable" | "not_attempted" = "not_attempted"): Measured<MarketSerp> =>
  unmeasured<MarketSerp>(reason, AT);

function card(a: {
  serps: Measured<MarketSerp>[];
  ownDomain?: string;
  coverage?: AiAnswersCard["coverage"];
}): AiAnswersCard {
  return buildAiAnswersCard({
    questions: a.serps.map((_, i) => question(i)),
    serps: a.serps,
    ownDomain: a.ownDomain ?? "customer.com",
    coverage: a.coverage ?? "async_included",
  });
}

describe('REQ-006 c1 — the card states how many searches were measured and on how many an AI answer appeared', () => {
  it("card/denominator-is-what-was-measured — 12 questions of which 4 SERPs are unmeasured yields 8", () => {
    const serps = Array.from({ length: 12 }, (_, i) => (i % 3 === 0 && i < 12 ? missing() : ok(null)));
    const built = card({ serps });
    expect(built.rows).toHaveLength(12);
    expect(built.measuredSearches).toBe(8);
  });

  it("card/invariants — all six hold on a mixed fixture", () => {
    const questions = Array.from({ length: 12 }, (_, i) => question(i));
    const serps: Measured<MarketSerp>[] = [
      ok(["customer.com"]),
      ok(["rival.com"]),
      ok([]),
      ok(null),
      ok(null),
      missing("undeterminable"),
      missing("not_attempted"),
      ok(["www.customer.com", "rival.com"]),
      ok(["rival.com"]),
      ok(null),
      missing(),
      ok(["other.com"]),
    ];
    const built = buildAiAnswersCard({ questions, serps, ownDomain: "customer.com", coverage: "async_included" });

    expect(built.measuredSearches).toBe(built.rows.filter((r) => r.cell.kind !== "unmeasured").length);
    expect(built.answeredSearches).toBe(built.rows.filter((r) => r.cell.kind === "answered").length);
    expect(built.customerCitations).toBeLessThanOrEqual(built.answeredSearches);
    expect(built.rows).toHaveLength(questions.length);
    for (const [i, row] of built.rows.entries()) {
      expect(row.keyword).toBe(questions[i]?.search.keyword);
      expect(Object.keys(row).sort()).toEqual(["cell", "engines", "keyword", "phrasing", "questionId", "text"]);
      // The sixth invariant (issue #128): three columns, in
      // BATTERY_ENGINES order, the first of which *is* the row's own cell.
      expect(row.engines.map((e) => e.engine)).toEqual([...BATTERY_ENGINES]);
      expect(row.engines[0]?.cell).toBe(row.cell);
    }

    expect(built.measuredSearches).toBe(9);
    expect(built.answeredSearches).toBe(6);
    expect(built.customerCitations).toBe(2);
  });

  it("card/citations-are-counted-over-m-never-over-n", () => {
    const built = card({ serps: [ok(["customer.com"]), ok(null), missing()] });
    expect(built.measuredSearches).toBe(2);
    expect(built.answeredSearches).toBe(1);
    expect(built.customerCitations).toBe(1);
    expect(built.customerCitations).toBeLessThanOrEqual(built.answeredSearches);
  });
});

describe('REQ-006 c2 and c10 — a search with no AI answer is excluded from both counts and is never an absence', () => {
  it("cell/no-answer-excluded-from-both-counts", () => {
    const built = card({ serps: [ok(null), ok(["rival.com"])] });
    expect(built.rows[0]?.cell).toEqual({ kind: "no_answer" });
    expect(built.answeredSearches).toBe(1);
    expect(built.customerCitations).toBe(0);
    expect(built.measuredSearches).toBe(2);
  });

  it("cell/no-answer-is-not-an-absence — the arm carries no namesCustomer field at all", () => {
    const cell = card({ serps: [ok(null)] }).rows[0]?.cell;
    expect(cell?.kind).toBe("no_answer");
    expect(Object.keys(cell ?? {})).toEqual(["kind"]);
    expect("namesCustomer" in (cell ?? {})).toBe(false);
  });

  it("cell/unmeasured-is-not-an-absence — it carries its reason and no customer verdict", () => {
    const cell = card({ serps: [missing("undeterminable")] }).rows[0]?.cell;
    expect(cell).toEqual({ kind: "unmeasured", reason: "undeterminable" });
  });

  it("cell/a-question-with-no-serp-at-all-is-unmeasured, never a dropped row", () => {
    const built = buildAiAnswersCard({
      questions: [question(0), question(1)],
      serps: [ok(null)],
      ownDomain: "customer.com",
      coverage: "async_included",
    });
    expect(built.rows).toHaveLength(2);
    expect(built.rows[1]?.cell).toEqual({ kind: "unmeasured", reason: "not_attempted" });
  });
});

describe('REQ-006 c3 and c11 — cited domains are named; an answer that named no brand is not "no answer"', () => {
  it("cell/cited-domains-named-and-customer-flagged", () => {
    const built = card({
      serps: [ok(["https://www.rival.com/x", "https://content.customer.com/y"])],
      ownDomain: "customer.com",
    });
    expect(built.rows[0]?.cell).toEqual({
      kind: "answered",
      citedDomains: ["rival.com", "customer.com"],
      namesCustomer: true,
    });
  });

  it("cell/cited-domains — nulls dropped, order preserved, exact duplicates collapsed once", () => {
    const built = card({ serps: [ok(["rival.com", "not a host", "https://www.rival.com/b", "other.com"])] });
    expect(built.rows[0]?.cell).toMatchObject({ citedDomains: ["rival.com", "other.com"] });
  });

  it("cell/answered-with-no-citations — an answer that cited nobody is answered, and raises m", () => {
    const built = card({ serps: [ok([])] });
    expect(built.rows[0]?.cell).toEqual({ kind: "answered", citedDomains: [], namesCustomer: false });
    expect(built.answeredSearches).toBe(1);
  });
});

describe('REQ-006 c4 and c5 — zero is a measurement, never an error or an omitted card', () => {
  it("card/zero-citations-is-a-measurement", () => {
    const built = card({ serps: Array.from({ length: 12 }, () => ok(["rival.com"])) });
    expect(built.customerCitations).toBe(0);
    expect(built.rows).toHaveLength(12);
    for (const value of Object.values(built)) expect(value).toBeDefined();
  });

  it("card/zero-answers-still-a-card", () => {
    const built = card({ serps: Array.from({ length: 12 }, () => ok(null)) });
    expect(built.measuredSearches).toBe(12);
    expect(built.answeredSearches).toBe(0);
    expect(built.rows).toHaveLength(12);
  });

  it("card/nothing-measured-at-all is still a card", () => {
    const built = card({ serps: Array.from({ length: 12 }, () => missing()) });
    expect(built).toMatchObject({ measuredSearches: 0, answeredSearches: 0, customerCitations: 0 });
    expect(built.rows).toHaveLength(12);
  });
});

describe("DECISIONS 2026-09-03 / ADR-094 — coverage is a state the caller decides, never a branch here", () => {
  it("card/coverage-is-carried-verbatim", () => {
    expect(card({ serps: [ok(["rival.com"])], coverage: "async_included" }).coverage).toBe("async_included");
    expect(card({ serps: [ok(["rival.com"])], coverage: "cached_only" }).coverage).toBe("cached_only");
  });

  it("card/coverage-changes-no-count — the same SERPs count the same under either coverage", () => {
    const serps = [ok(["customer.com"]), ok(null), missing()];
    const asyncIncluded = card({ serps, coverage: "async_included" });
    const cachedOnly = card({ serps, coverage: "cached_only" });
    expect({ ...asyncIncluded, coverage: null }).toEqual({ ...cachedOnly, coverage: null });
  });

  it("the module never reads the vendor's own asynchronous-AI-Overview flag", () => {
    expect(SOURCE).not.toMatch(/asynchronousAiOverview|asynchronous_ai_overview/);
  });
});

describe('REQ-006 c7 — the card reports what was measured and nothing more', () => {
  it("card/no-advice-field — the card's keys are exactly the five the interface declares", () => {
    const built = card({ serps: [ok(["rival.com"])] });
    expect(Object.keys(built).sort()).toEqual([
      "answeredSearches",
      "coverage",
      "customerCitations",
      "measuredSearches",
      "rows",
    ]);
  });

  it("card/no-advice-field — no instruction, severity or recommendation key anywhere", () => {
    const keys = new Set<string>();
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (typeof value === "object" && value !== null) {
        for (const [k, v] of Object.entries(value)) {
          keys.add(k);
          walk(v);
        }
      }
    };
    walk(card({ serps: [ok(["rival.com"]), ok(null), missing()] }));
    for (const forbidden of ["advice", "tip", "recommendation", "instruction", "severity", "warning", "level", "fix"]) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it("row/carries-search-and-wording-but-no-volume", () => {
    const built = card({ serps: [ok(["rival.com"])] });
    const row = built.rows[0];
    expect(row?.keyword).toBe("best thing 0");
    expect(row?.text).toBe("What's the best thing 0?");
    expect(row?.phrasing).toBe("template");
    expect(Object.keys(row ?? {})).not.toContain("volume");
    expect(JSON.stringify(built)).not.toContain("100");
  });
});

// ── §6.2's three answer columns (issue #128) ─────────────────────────────
//
// "Paid weekly battery: ChatGPT std + AI Mode std + AI-Overview piggyback
// = 2.2¢/week, rendered as three answer columns." The mutations this block
// exists to kill: reordering the columns (a renderer indexes by position);
// re-deriving the AI-Overview column instead of reading the row's own
// cell (two readings of one measurement, free to drift); collapsing an
// engine that was never asked onto `no_answer` (which reads as a miss);
// and letting the battery move the three rendered counts, which is the
// design decision the three-column visual is gated behind.

const answer = (cited: string[]): Measured<MarketAiAnswer> => measured({ answered: true, citedDomains: cited }, AT);
const silent = (): Measured<MarketAiAnswer> => measured({ answered: false, citedDomains: [] }, AT);
const unasked = (reason: "undeterminable" | "not_attempted" = "not_attempted"): Measured<MarketAiAnswer> =>
  unmeasured<MarketAiAnswer>(reason, AT);

function withBattery(serps: Measured<MarketSerp>[], battery: BatteryAnswers[]): AiAnswersCard {
  return buildAiAnswersCard({
    questions: serps.map((_, i) => question(i)),
    serps,
    battery,
    ownDomain: "customer.com",
    coverage: "async_included",
  });
}

describe("BUILD §6.2 — three answer columns, carried as data on every row", () => {
  it("engines/order-is-fixed — ai_overview, ai_mode, chatgpt, on every row", () => {
    const built = withBattery(
      [ok(["rival.com"]), ok(null), missing()],
      [
        { aiMode: answer(["customer.com"]), chatgpt: silent() },
        { aiMode: unasked("undeterminable"), chatgpt: answer(["rival.com"]) },
        { aiMode: unasked(), chatgpt: unasked() },
      ]
    );
    expect(BATTERY_ENGINES).toEqual(["ai_overview", "ai_mode", "chatgpt"]);
    for (const row of built.rows) {
      expect(row.engines).toHaveLength(3);
      expect(row.engines.map((e) => e.engine)).toEqual([...BATTERY_ENGINES]);
    }
  });

  it("engines/perplexity-is-not-a-column — §6.4 forbids a fourth engine", () => {
    expect(BATTERY_ENGINES).toHaveLength(3);
    expect([...BATTERY_ENGINES]).not.toContain("perplexity");
  });

  it("engines/battery-cells-take-the-same-three-kinds-the-overview-does", () => {
    const built = withBattery(
      [ok(["rival.com"])],
      [{ aiMode: answer(["www.customer.com", "rival.com"]), chatgpt: silent() }]
    );
    const [, aiMode, chatgpt] = built.rows[0]?.engines ?? [];
    expect(aiMode?.cell).toEqual({
      kind: "answered",
      citedDomains: ["customer.com", "rival.com"],
      namesCustomer: true,
    });
    expect(chatgpt?.cell).toEqual({ kind: "no_answer" });
  });

  it("engines/an-engine-nobody-asked-is-not-a-miss — the free path's two columns", () => {
    // No `battery` argument at all: the free path, which makes zero AI
    // Optimization calls. Both battery columns say we did not get to them.
    const built = card({ serps: [ok(["rival.com"]), ok(null)] });
    for (const row of built.rows) {
      expect(row.engines[1]?.cell).toEqual({ kind: "unmeasured", reason: "not_attempted" });
      expect(row.engines[2]?.cell).toEqual({ kind: "unmeasured", reason: "not_attempted" });
    }
  });

  it("engines/a-raised-engine-carries-its-own-reason", () => {
    const built = withBattery([ok(null)], [{ aiMode: unasked("undeterminable"), chatgpt: unasked() }]);
    expect(built.rows[0]?.engines[1]?.cell).toEqual({ kind: "unmeasured", reason: "undeterminable" });
    expect(built.rows[0]?.engines[2]?.cell).toEqual({ kind: "unmeasured", reason: "not_attempted" });
  });

  it("engines/a-short-battery-covers-the-questions-it-covers-and-no-more", () => {
    const built = withBattery(
      [ok(null), ok(null)],
      [{ aiMode: answer(["rival.com"]), chatgpt: silent() }]
    );
    expect(built.rows[0]?.engines[1]?.cell.kind).toBe("answered");
    expect(built.rows[1]?.engines[1]?.cell).toEqual({ kind: "unmeasured", reason: "not_attempted" });
  });

  it("engines/the-three-rendered-counts-do-not-move — the battery is data beside them, not arithmetic under them", () => {
    const serps = [ok(["rival.com"]), ok(null), missing()];
    const without = card({ serps });
    const with_ = withBattery(serps, [
      { aiMode: answer(["customer.com"]), chatgpt: answer(["customer.com"]) },
      { aiMode: answer(["customer.com"]), chatgpt: answer(["customer.com"]) },
      { aiMode: answer(["customer.com"]), chatgpt: answer(["customer.com"]) },
    ]);
    expect(with_.measuredSearches).toBe(without.measuredSearches);
    expect(with_.answeredSearches).toBe(without.answeredSearches);
    expect(with_.customerCitations).toBe(without.customerCitations);
    expect(with_.customerCitations).toBe(0);
  });

  it("engines/the-overview-column-is-the-row's-own-cell-and-not-a-second-derivation", () => {
    const built = withBattery([ok(["customer.com"])], [{ aiMode: silent(), chatgpt: silent() }]);
    expect(built.rows[0]?.engines[0]?.cell).toBe(built.rows[0]?.cell);
  });

  it("engines/no-engine-text-can-reach-the-card — MarketAiAnswer has no field for it", () => {
    // The vendor's own `AiAnswer` carries `text`; the view the card reads
    // does not, so an engine's prose has nowhere to travel and cannot be
    // rendered unlabelled.
    const built = withBattery(
      [ok(null)],
      [
        {
          aiMode: measured(
            { answered: true, citedDomains: ["rival.com"], text: "Try Rival, it is the best." } as MarketAiAnswer,
            AT
          ),
          chatgpt: silent(),
        },
      ]
    );
    expect(JSON.stringify(built)).not.toContain("it is the best");
  });

  it("engineColumns/is-the-one-implementation-of-the-order", () => {
    // `src/lib/scan/sections.ts` builds the columns for a question the
    // card had no row for; it must build them the same way.
    const overview = { kind: "no_answer" } as const;
    expect(engineColumns({ overview, ownDomain: "customer.com" }).map((e) => e.engine)).toEqual([
      ...BATTERY_ENGINES,
    ]);
    expect(engineColumns({ overview, ownDomain: "customer.com" })[0]?.cell).toBe(overview);
  });
});

describe('BUILD §6.6 — the card buys nothing and is deterministic', () => {
  it("card/buys-nothing", () => {
    for (const forbidden of [
      /from\s+["'][^"']*lib\/vendors/,
      /from\s+["'][^"']*lib\/costs/,
      /from\s+["'][^"']*lib\/llm/,
      /from\s+["'][^"']*lib\/db/,
    ]) {
      expect(SOURCE).not.toMatch(forbidden);
    }
    expect(SOURCE).not.toMatch(/CostContext/);
    expect(SOURCE).not.toMatch(/\bfetch\(/);
    expect(SOURCE).not.toMatch(/Date\.now\(\)/);
  });

  it("card/byte-identical-on-every-run", () => {
    const serps = [ok(["b.com", "a.com"]), ok(null), missing(), ok([])];
    const first = JSON.stringify(card({ serps }));
    for (let i = 0; i < 50; i += 1) expect(JSON.stringify(card({ serps }))).toBe(first);
  });
});

describe("Observability — cell kinds only", () => {
  it("card/logs-cell-kinds-not-content", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    card({ serps: [ok(["secret-rival.com"]), missing()] });
    const line = spy.mock.calls.at(-1)?.[0] as string;
    expect(JSON.parse(line)).toEqual({
      event: "ai_answers_card",
      coverage: "async_included",
      cells: ["answered", "unmeasured"],
    });
    expect(line).not.toContain("secret-rival.com");
  });
});
