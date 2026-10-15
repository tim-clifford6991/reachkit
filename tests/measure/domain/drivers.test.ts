// tests/measure/domain/drivers.test.ts — BUILD §5
//
// A fixture suite per driver, one `describe` each, as BP-010 decision 2
// requires ("the formula's shape is code here, covered by a fixture suite
// per driver"). Every row quotes `BUILD.md` §5 or §6.3 verbatim; no REQ
// criterion is inherited (BP-010 carries `satisfies: []`).
//
// The four functions are pure — no fetch, no clock, no persistence — so
// nothing here is mocked. `at` is always the caller's, and every
// assertion below passes the same one.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SCORING } from "@/lib/config/constants";
import type { RobotsPolicy } from "@/lib/egress/types";
import type { RankedResult, RankedRow, SerpResult } from "@/lib/vendors/dataforseo/types";
import {
  aiPresenceOf,
  aiPresenceRangeOf,
  aiSampleOf,
  answerabilityOf,
  foundationsOf,
  localPackSearches,
  ownRankedOf,
  searchPresenceOf,
} from "../../../src/lib/measure/drivers.ts";
import { measured, measuredZero, unmeasured, type Measured } from "../../../src/lib/measure/measured.ts";
import type { OnPageFacts } from "../../../src/lib/measure/parse.ts";
import { computeScore, estimateOf, factorsOf, NO_AI_ANSWERS, presenceOf, presenceRangeOf } from "../../../src/lib/measure/score.ts";
import stored from "./fixtures/ai-presence-free-scans.json";

const AT = new Date("2026-09-05T00:00:00.000Z");
const OWN = "reachkit.app";

const SOURCE_PATH = path.resolve(import.meta.dirname, "../../../src/lib/measure/drivers.ts");
const SOURCE = readFileSync(SOURCE_PATH, "utf8");
// Comment-stripped: the header legitimately explains in prose that this
// file reads no clock and fetches nothing — only the code must be free of
// those tokens (the convention `tests/measure/domain/parse.test.ts` uses).
const CODE_ONLY = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

function facts(over: Partial<OnPageFacts> = {}): OnPageFacts {
  return {
    url: "https://reachkit.app/",
    headings: 0,
    questionShapedHeadings: 0,
    directAnswerHeadings: 0,
    numerals: 0,
    dates: 0,
    outboundCitations: 0,
    visibleChars: 0,
    schemaTypes: [],
    openGraphProperties: [],
    noindex: false,
    noindexAppliesToEveryReader: false,
    ...over,
  };
}

function robots(over: Partial<RobotsPolicy> = {}): RobotsPolicy {
  return {
    ok: true,
    origin: "https://reachkit.app",
    readAt: AT,
    disallowsAll: false,
    disallowedAgents: {},
    sitemaps: [],
    absent: false,
    ...over,
  };
}

function rankedRow(position: number): RankedRow {
  return { keyword: `k${position}`, position, searchVolume: 100, url: "https://reachkit.app/" };
}

function serp(referenceDomains: readonly string[], present = true): SerpResult {
  return {
    organic: [],
    aiOverview: { present, asynchronousAiOverview: false, referenceDomains },
  };
}

/** Every `Measured` the four return carries the `at` it was handed and
 *  never a clock read of its own. */
function expectAt(m: Measured<unknown>): void {
  expect(m.at).toBe(AT);
}

function valueOf(m: Measured<number>): number {
  if (m.kind === "unmeasured") throw new Error(`expected a value, got unmeasured/${m.reason}`);
  return m.value;
}

describe('BUILD §5: "Foundations = access gates + clarity signals, 0–100 (generic noindex on the home document ⇒ 0, and score ⇒ 0)"', () => {
  it("a read document with a generic noindex is a measured 0, not an unmeasured", () => {
    const m = foundationsOf({
      onPage: measured(facts({ noindex: true, noindexAppliesToEveryReader: true, headings: 9, visibleChars: 4000 }), AT),
      robots: measured(robots({ absent: true }), AT),
      at: AT,
    });
    expect(m.kind).toBe("zero");
    expect(valueOf(m)).toBe(0);
    expectAt(m);
  });

  it("a targeted noindex is not a zero — it halves the gate half and leaves clarity standing", () => {
    const targeted = facts({
      noindex: true,
      noindexAppliesToEveryReader: false,
      headings: 4,
      visibleChars: 4000,
      schemaTypes: ["article"],
      openGraphProperties: ["og:title"],
    });
    const m = foundationsOf({ onPage: measured(targeted, AT), robots: measured(robots({ absent: true }), AT), at: AT });
    expect(m.kind).toBe("measured");
    // gates = 100 (nothing blocked) halved to 50; clarity = 100 (all four
    // signals); Foundations = (50 + 100) / 2.
    expect(valueOf(m)).toBeCloseTo(75, 10);
  });

  it("an open robots policy and every clarity signal reads the top of the scale", () => {
    const full = facts({
      headings: 4,
      visibleChars: 4000,
      schemaTypes: ["article"],
      openGraphProperties: ["og:title"],
    });
    const m = foundationsOf({ onPage: measured(full, AT), robots: measured(robots({ absent: true }), AT), at: AT });
    expect(valueOf(m)).toBeCloseTo(100, 10);
  });

  it("a robots policy that disallows every reader closes the gate half without nulling the driver", () => {
    const full = facts({
      headings: 4,
      visibleChars: 4000,
      schemaTypes: ["article"],
      openGraphProperties: ["og:title"],
    });
    const m = foundationsOf({
      onPage: measured(full, AT),
      robots: measured(robots({ disallowsAll: true }), AT),
      at: AT,
    });
    // gates = 0, clarity = 100 → 50. A measured value, never `unmeasured`.
    expect(m.kind).toBe("measured");
    expect(valueOf(m)).toBeCloseTo(50, 10);
  });

  it("a home document that could not be read is unmeasured, carrying its reason", () => {
    const m = foundationsOf({
      onPage: unmeasured<OnPageFacts>("undeterminable", AT),
      robots: measured(robots({ absent: true }), AT),
      at: AT,
    });
    expect(m).toEqual({ kind: "unmeasured", reason: "undeterminable", at: AT });
  });

  it("a robots policy that could not be read nulls the driver rather than estimating from the half that was read", () => {
    const m = foundationsOf({
      onPage: measured(facts({ headings: 4, visibleChars: 4000 }), AT),
      robots: unmeasured<RobotsPolicy>("not_attempted", AT),
      at: AT,
    });
    expect(m).toEqual({ kind: "unmeasured", reason: "not_attempted", at: AT });
  });

  it("two unmeasured inputs fold under `worseReason` — undeterminable outranks not_attempted", () => {
    const m = foundationsOf({
      onPage: unmeasured<OnPageFacts>("not_attempted", AT),
      robots: unmeasured<RobotsPolicy>("undeterminable", AT),
      at: AT,
    });
    expect(m).toEqual({ kind: "unmeasured", reason: "undeterminable", at: AT });
  });
});

describe('BUILD §5: "Answerability = shape of the home + measured pages, 0–100, floored at 1 · shape = (questionShaped + directAnswers + evidenceDensity) / 3"', () => {
  const THIRD = 100 / 3;

  it("the shape is the mean of exactly three sub-measures", () => {
    // Each fixture isolates one sub-measure at 100 with the other two at 0;
    // all three must land on the same 100/3. A fourth term in the mean
    // moves all three and fails here.
    const questionShapedOnly = measured(facts({ headings: 4, questionShapedHeadings: 4, visibleChars: 1000 }), AT);
    const directAnswersOnly = measured(facts({ headings: 4, directAnswerHeadings: 4, visibleChars: 1000 }), AT);
    // 20 evidence tokens per 1k visible chars is where the curve saturates.
    const evidenceOnly = measured(facts({ numerals: 20, visibleChars: 1000 }), AT);

    for (const page of [questionShapedOnly, directAnswersOnly, evidenceOnly]) {
      expect(valueOf(answerabilityOf({ pages: [page], at: AT }))).toBeCloseTo(THIRD, 10);
    }
  });

  it("the three evidence token kinds are one pooled numerator", () => {
    const pooled = measured(facts({ numerals: 7, dates: 6, outboundCitations: 7, visibleChars: 1000 }), AT);
    expect(valueOf(answerabilityOf({ pages: [pooled], at: AT }))).toBeCloseTo(THIRD, 10);
  });

  it("no headings is a zero, not an unmeasured, and empty denominators read 0", () => {
    const m = answerabilityOf({ pages: [measured(facts({ visibleChars: 1200 }), AT)], at: AT });
    expect(m.kind).toBe("zero");
    expectAt(m);
  });

  it("the floor applies to a measured zero and never to an unmeasured", () => {
    const zeroShape = answerabilityOf({ pages: [measuredZero(facts(), AT)], at: AT });
    expect(zeroShape.kind).toBe("zero");
    expect(valueOf(zeroShape)).toBe(SCORING.answerabilityFloor);

    const nothingRead = answerabilityOf({ pages: [unmeasured<OnPageFacts>("undeterminable", AT)], at: AT });
    expect(nothingRead).toEqual({ kind: "unmeasured", reason: "undeterminable", at: AT });
    expect(nothingRead).not.toHaveProperty("value");
  });

  it("a page that could not be read neither counts for nor against the shape", () => {
    const good = measured(facts({ headings: 4, questionShapedHeadings: 4, visibleChars: 1000 }), AT);
    const alone = answerabilityOf({ pages: [good], at: AT });
    const withAGap = answerabilityOf({ pages: [good, unmeasured<OnPageFacts>("not_attempted", AT)], at: AT });
    expect(valueOf(withAGap)).toBeCloseTo(valueOf(alone), 10);
  });

  it("counts are pooled across every page that was read, not averaged per page", () => {
    const half = measured(facts({ headings: 2, questionShapedHeadings: 1, visibleChars: 1000 }), AT);
    const none = measured(facts({ headings: 6, visibleChars: 1000 }), AT);
    // Pooled: 1 question-shaped heading of 8 → 12.5, not the mean of 50 and 0.
    expect(valueOf(answerabilityOf({ pages: [half, none], at: AT }))).toBeCloseTo(12.5 / 3, 10);
  });

  it("no page handed in at all is undeterminable, never a floored 1", () => {
    const m = answerabilityOf({ pages: [], at: AT });
    expect(m).toEqual({ kind: "unmeasured", reason: "undeterminable", at: AT });
  });
});

describe("the customer's own ranked count — the vendor's total, not the sub-measure (issues #140, #117)", () => {
  /** One `ranked_keywords` answer. `total` defaults to absent, which is
   *  the pre-#117 world: the count falls back to the rows. */
  function answer(rows: readonly RankedRow[], total: number | null = null): RankedResult {
    return { rows, total };
  }

  it("is the vendor's own total, and not a score derived from the rows", () => {
    const rows = [rankedRow(1), rankedRow(11), rankedRow(12)];
    // #117: the rows are a page of a much larger set, and the count is the
    // set. Reading `rows.length` here is what made `far` unreachable.
    expect(ownRankedOf({ ranked: measured(answer(rows, 4200), AT), at: AT })).toEqual(measured(4200, AT));
    // The same rows read as SearchPresence are a 0–100 quantity, which is
    // why the count cannot be recovered from `scans.drivers`.
    expect(valueOf(searchPresenceOf({ ranked: measured(answer(rows, 4200), AT), at: AT }))).not.toBe(4200);
  });

  it("falls back to the rows where the vendor reported no total — never worse than before #117", () => {
    const rows = [rankedRow(1), rankedRow(11), rankedRow(12)];
    expect(ownRankedOf({ ranked: measured(answer(rows), AT), at: AT })).toEqual(measured(3, AT));
  });

  it("a total of zero is the total, not an absence — `?? rows.length` must not swallow it", () => {
    const rows = [rankedRow(1)];
    expect(valueOf(ownRankedOf({ ranked: measured(answer(rows, 0), AT), at: AT }))).toBe(0);
  });

  it('zero rows is a measured 0 — "0 rows is a legal result", never an absence', () => {
    const m = ownRankedOf({ ranked: measuredZero<RankedResult>(answer([], 0), AT), at: AT });
    expect(m.kind).toBe("zero");
    expect(valueOf(m)).toBe(0);
    expectAt(m);
  });

  it("an unmeasured row set stays unmeasured and carries the same reason", () => {
    expect(ownRankedOf({ ranked: unmeasured<RankedResult>("not_attempted", AT), at: AT })).toEqual({
      kind: "unmeasured",
      reason: "not_attempted",
      at: AT,
    });
  });

  it("reads no clock — the date is the caller's", () => {
    const other = new Date("2020-01-01T00:00:00.000Z");
    expect(ownRankedOf({ ranked: measured(answer([rankedRow(1)]), AT), at: other }).at).toEqual(other);
  });
});

describe('BUILD §5: "SearchPresence = min(100, 25 × log10(ranked + 1)) × (0.55 + 0.45 × min(1, top10share × 4))"', () => {
  /** One `ranked_keywords` answer read as SearchPresence. `total`
   *  defaults to absent, so reach falls back to the rows. */
  function presence(rows: readonly RankedRow[], total: number | null = null): Measured<number> {
    return searchPresenceOf({ ranked: measured<RankedResult>({ rows, total }, AT), at: AT });
  }
  /** The fifty rows the free tier buys, a quarter of them in the top 10. */
  const FIFTY = Array.from({ length: 50 }, (_, i) => rankedRow(i % 4 === 0 ? 3 : 30));

  it('zero ranked rows is a measured presence of zero — "0 rows is a legal result"', () => {
    const m = searchPresenceOf({ ranked: measuredZero<RankedResult>({ rows: [], total: null }, AT), at: AT });
    expect(m.kind).toBe("zero");
    expect(valueOf(m)).toBe(0);
    expectAt(m);
  });

  it("an unmeasured row set stays unmeasured and carries the same reason", () => {
    const m = searchPresenceOf({ ranked: unmeasured<RankedResult>("not_attempted", AT), at: AT });
    expect(m).toEqual({ kind: "unmeasured", reason: "not_attempted", at: AT });
  });

  it("SearchPresence saturates rather than clipping — a top-10 share of 0.25 and of 0.9 give the same multiplier", () => {
    // 4 rows, 1 in the top 10 → share 0.25 → min(1, 1.0) = 1.
    const quarter = [rankedRow(1), rankedRow(11), rankedRow(12), rankedRow(13)];
    const reachOfFour = Math.min(100, 25 * Math.log10(5));
    expect(valueOf(presence(quarter))).toBeCloseTo(reachOfFour * 1.0, 10);

    // 10 rows, 9 in the top 10 → share 0.9 → min(1, 3.6) = 1, the same.
    const mostly = [...Array.from({ length: 9 }, (_, i) => rankedRow(i + 1)), rankedRow(40)];
    const reachOfTen = Math.min(100, 25 * Math.log10(11));
    expect(valueOf(presence(mostly))).toBeCloseTo(reachOfTen * 1.0, 10);
  });

  it("a top-10 share of 0 gives the base multiplier 0.55", () => {
    const none = [rankedRow(11), rankedRow(12)];
    expect(valueOf(presence(none))).toBeCloseTo(Math.min(100, 25 * Math.log10(3)) * 0.55, 10);
  });

  it("the reach term rises with the row count and is then capped at the top of the scale", () => {
    // One row, in the top 10: reach = 25 × log10(2), multiplier 1.
    expect(valueOf(presence([rankedRow(1)]))).toBeCloseTo(25 * Math.log10(2), 10);
    // Ten rows, all in the top 10: reach = 25 × log10(11), multiplier 1.
    const ten = Array.from({ length: 10 }, (_, i) => rankedRow(i + 1));
    expect(valueOf(presence(ten))).toBeCloseTo(25 * Math.log10(11), 10);
  });

  it("reach reads the vendor's total, not the rows bought — equal rows, different totals, different presence (#529)", () => {
    // Production, 2026-09-10/11: notion.so (822 ranked) and hey.com (7 412)
    // both scored 25 × log10(51) = 42.69 off the same 50 rows.
    const notion = valueOf(presence(FIFTY, 822));
    const hey = valueOf(presence(FIFTY, 7_412));
    expect(notion).toBeCloseTo(25 * Math.log10(823), 10);
    expect(hey).toBeCloseTo(25 * Math.log10(7_413), 10);
    expect(hey).toBeGreaterThan(notion);
    expect(notion).not.toBeCloseTo(25 * Math.log10(51), 5);
  });

  it("top10share stays the share of the rows bought — never a top-10 count over the total", () => {
    // 50 rows, 5 in the top 10 → share 0.1 → multiplier 0.55 + 0.45 × 0.4.
    // Over the total (5 / 7 412) it would read as the base 0.55.
    const tenth = Array.from({ length: 50 }, (_, i) => rankedRow(i < 5 ? 1 : 40));
    const reach = 25 * Math.log10(7_413);
    expect(valueOf(presence(tenth, 7_412))).toBeCloseTo(reach * (0.55 + 0.45 * Math.min(1, 0.1 * 4)), 10);
  });

  it("where the vendor reports no total, reach is the rows — 30 rows read as 30", () => {
    const thirty = Array.from({ length: 30 }, (_, i) => rankedRow(i < 10 ? i + 1 : 50));
    expect(valueOf(presence(thirty))).toBeCloseTo(25 * Math.log10(31), 10);
  });

  it("a total of 10 000 or more saturates reach at the top of the scale", () => {
    // 25 × log10(10001) > 100, so `min(100, …)` holds it at 100; the
    // multiplier is 1 (a quarter of the rows in the top 10). Dropping that
    // `min` fails here.
    expect(25 * Math.log10(10_001)).toBeGreaterThan(100);
    expect(valueOf(presence(FIFTY, 10_000))).toBeCloseTo(100, 10);
    expect(valueOf(presence(FIFTY, 250_000))).toBeCloseTo(100, 10);
  });

  it("a total of zero with no rows is a measured 0 — the total is read, not swallowed", () => {
    const m = presence([], 0);
    expect(m.kind).toBe("zero");
    expect(valueOf(m)).toBe(0);
  });

  it("the formula's coefficients are §5's, unchanged — only reach's input moved", () => {
    for (const line of [
      "const SEARCH_LOG_COEFFICIENT = 25;",
      "const SEARCH_BASE_SHARE = 0.55;",
      "const SEARCH_TOP10_WEIGHT = 0.45;",
      "const SEARCH_TOP10_SATURATION = 4;",
      "const TOP10_LAST_POSITION = 10;",
    ]) {
      expect(SOURCE).toContain(line);
    }
    // One worked value through the whole formula: 822 ranked, share 0.1.
    const tenth = Array.from({ length: 50 }, (_, i) => rankedRow(i < 5 ? 1 : 40));
    expect(valueOf(presence(tenth, 822))).toBeCloseTo(Math.min(100, 25 * Math.log10(823)) * (0.55 + 0.45 * 0.4), 10);
  });
});

describe('BUILD §5: "AIPresence = max(1, (0.4 × mentionRate + 0.6 × citationRate) × 100)"', () => {
  /** Four reads of the same SERP. */
  const enough = (references: readonly string[]): Measured<SerpResult>[] =>
    Array.from({ length: 4 }, () => measured(serp(references), AT));

  it("AIPresence weights citations above mentions", () => {
    const mentionsOnly = aiPresenceOf({ serps: enough(["g2.com/reachkit"]), ownDomain: OWN, at: AT });
    expect(valueOf(mentionsOnly)).toBeCloseTo(40, 10);

    const citationsOnly = aiPresenceOf({ serps: enough(["reachkit.app"]), ownDomain: OWN, at: AT });
    expect(valueOf(citationsOnly)).toBeCloseTo(60, 10);
  });

  it("a measured set that names the customer nowhere is a zero carrying the floor of 1, not a 0", () => {
    const m = aiPresenceOf({
      serps: enough(["example.com", "other.example"]),
      ownDomain: OWN,
      at: AT,
    });
    expect(m.kind).toBe("zero");
    expect(valueOf(m)).toBe(1);
    expectAt(m);
  });

  it("the rates are over the SERPs measured, not the SERPs asked for", () => {
    const serps: Measured<SerpResult>[] = [
      measured(serp(["reachkit.app/pricing"]), AT),
      ...Array.from({ length: 7 }, () => measured(serp(["example.com"]), AT)),
      ...Array.from({ length: 4 }, () => unmeasured<SerpResult>("undeterminable", AT)),
    ];
    expect(serps).toHaveLength(12);
    // 1 citation over the 8 SERPs read — never over the 12 asked for.
    expect(valueOf(aiPresenceOf({ serps, ownDomain: OWN, at: AT }))).toBeCloseTo(0.6 * (1 / 8) * 100, 10);
  });

  it("a reference that carries a path still resolves to its host — the customer's own path is a citation, not a mention", () => {
    const m = aiPresenceOf({ serps: enough(["reachkit.app/pricing"]), ownDomain: OWN, at: AT });
    expect(valueOf(m)).toBeCloseTo(60, 10);
  });

  it("a subdomain of the customer's own domain is a citation; a third-party host carrying the brand token is a mention", () => {
    const subdomain = aiPresenceOf({ serps: enough(["docs.reachkit.app"]), ownDomain: OWN, at: AT });
    expect(valueOf(subdomain)).toBeCloseTo(60, 10);

    const thirdParty = aiPresenceOf({ serps: enough(["reachkit.medium.com"]), ownDomain: OWN, at: AT });
    expect(valueOf(thirdParty)).toBeCloseTo(40, 10);
  });

  it("the brand token matches whole tokens only — a longer word that merely contains it is not a mention", () => {
    // Brand token "app" from "app.com": "apple.com" contains it as a
    // substring and is not a mention of it.
    const m = aiPresenceOf({ serps: enough(["apple.com"]), ownDomain: "app.com", at: AT });
    expect(m.kind).toBe("zero");
    expect(valueOf(m)).toBe(1);
  });

  it("every SERP unmeasured yields unmeasured, and no SERP at all is undeterminable", () => {
    const allGone = aiPresenceOf({
      serps: [unmeasured<SerpResult>("not_attempted", AT), unmeasured<SerpResult>("not_attempted", AT)],
      ownDomain: OWN,
      at: AT,
    });
    expect(allGone).toEqual({ kind: "unmeasured", reason: "not_attempted", at: AT });

    expect(aiPresenceOf({ serps: [], ownDomain: OWN, at: AT })).toEqual({
      kind: "unmeasured",
      reason: "undeterminable",
      at: AT,
    });
  });
});

describe("BP-010 `## Module / boundary` — the driver arithmetic is pure", () => {
  it("reads no clock, fetches nothing and persists nothing", () => {
    expect(CODE_ONLY).not.toMatch(/Date\.now\s*\(/);
    expect(CODE_ONLY).not.toMatch(/new Date\s*\(\s*\)/);
    expect(CODE_ONLY).not.toMatch(/\bfetch\s*\(/);
    expect(CODE_ONLY).not.toMatch(/@\/lib\/(db|egress\/safe-fetch)/);
  });

  it("reads the two pins from `constants.ts` rather than writing either as a literal", () => {
    expect(CODE_ONLY).toMatch(/from "@\/lib\/config\/constants"/);
    expect(CODE_ONLY).toMatch(/SCORING\.answerabilityFloor/);
    expect(CODE_ONLY).toMatch(/AI_READER_AGENTS/);
  });
});

describe("issue 1357 — an AI Overview whose sources were not loaded is not an answer naming nobody", () => {
  const unread: SerpResult = { organic: [], aiOverview: { present: true, asynchronousAiOverview: true, referenceDomains: [], unread: true } };

  it("is in neither rate: the site cited on every SERP that was read scores as cited on all of them", () => {
    const cited = Array.from({ length: 4 }, () => measured(serp(["reachkit.app"]), AT));
    const alone = aiPresenceOf({ serps: cited, ownDomain: OWN, at: AT });
    const beside = aiPresenceOf({ serps: [...cited, measured(unread, AT), measured(unread, AT)], ownDomain: OWN, at: AT });
    expect(valueOf(beside)).toBe(valueOf(alone));
  });

  it("a pass that read no overview's sources has no AI presence, not the floor", () => {
    expect(aiPresenceOf({ serps: [measured(unread, AT)], ownDomain: OWN, at: AT }).kind).toBe("unmeasured");
  });
});

describe("issue 1439 — AI is judged on the answers that exist, and a score says how sure it is", () => {
  type StoredSerp = { kind: string; reason?: string; because?: string; present?: boolean; referenceDomains?: string[] };
  const serpsOf = (domain: string): Measured<SerpResult>[] => {
    const scan = stored.scans.find((s) => s.domain === domain);
    if (scan === undefined) throw new Error(`no stored scan for ${domain}`);
    return (scan.serps as StoredSerp[]).map((cell) =>
      cell.kind === "unmeasured"
        ? unmeasured<SerpResult>(cell.reason === "not_attempted" ? "not_attempted" : "undeterminable", AT, cell.because)
        : measured(serp(cell.referenceDomains ?? [], cell.present ?? false), AT)
    );
  };
  const aiOf = (domain: string): Measured<number> => aiPresenceOf({ serps: serpsOf(domain), ownDomain: domain, at: AT });
  const scoreWith = (aiPresence: Measured<number>) =>
    computeScore(factorsOf({ foundations: measured(80, AT), answerability: measured(60, AT), searchPresence: measured(70, AT), aiPresence }));
  const fourOf = (references: readonly string[]): Measured<SerpResult>[] =>
    Array.from({ length: 4 }, () => measured(serp(references), AT));

  it("a search Google answers without an AI answer is in neither rate", () => {
    const serps = [measured(serp(["reachkit.app"]), AT), ...Array.from({ length: 3 }, () => measured(serp([], false), AT))];
    expect(valueOf(aiPresenceOf({ serps, ownDomain: OWN, at: AT }))).toBeCloseTo(60, 10);
    expect(aiSampleOf({ serps, ownDomain: OWN })).toEqual({ read: 4, answered: 1, mentioned: 0, cited: 1 });
  });

  it("AI answering none of fewer than four reads is AI not read: the middle of its scale and its whole range", () => {
    const serps = Array.from({ length: 3 }, () => measured(serp([], false), AT));
    const ai = aiPresenceOf({ serps, ownDomain: OWN, at: AT });
    expect(ai).toEqual({ kind: "unmeasured", reason: "undeterminable", at: AT });
    expect(aiPresenceRangeOf(aiSampleOf({ serps, ownDomain: OWN }))).toEqual({ low: 1, high: 100 });
  });

  it("fewer than six results read is always a rough estimate, however narrow the range", () => {
    const factors = factorsOf({ foundations: measured(100, AT), answerability: measured(30, AT), searchPresence: measured(80, AT), aiPresence: measured(40, AT) });
    expect(estimateOf(factors, { low: 60, high: 60 }, 5)!.confidence).toBe("rough");
    expect(estimateOf(factors, { low: 60, high: 60 }, 6)!.confidence).toBe("close");
  });

  it("where AI answered none of four or more searches read, AI presence is not 0 and Presence is search presence alone", () => {
    const serps = Array.from({ length: 6 }, () => measured(serp([], false), AT));
    const ai = aiPresenceOf({ serps, ownDomain: OWN, at: AT });
    expect(ai).toEqual({ kind: "unmeasured", reason: "undeterminable", at: AT, because: NO_AI_ANSWERS });
    const d = { searchPresence: measured(42, AT), aiPresence: ai };
    expect(valueOf(presenceOf(d))).toBe(42);
    expect(aiPresenceRangeOf(aiSampleOf({ serps, ownDomain: OWN }))).toBeNull();
    expect(presenceRangeOf(d, null)).toEqual({ low: 42, high: 42 });
  });

  it("zapier.com's one read, which cited only YouTube, is a rate with a wide range and a score", () => {
    const ai = aiOf("zapier.com");
    expect(ai.kind).toBe("zero");
    expect(scoreWith(ai).kind).toBe("measured");
    const range = aiPresenceRangeOf(aiSampleOf({ serps: serpsOf("zapier.com"), ownDomain: "zapier.com" }))!;
    expect(range.low).toBe(1);
    expect(range.high).toBeGreaterThan(70);
  });

  it("mailchimp.com's two reads are a rate: one citation of two answers", () => {
    expect(valueOf(aiOf("mailchimp.com"))).toBeCloseTo(0.6 * (1 / 2) * 100, 10);
  });

  it("stripe.com's one question, unread at the deadline, keeps its reason and still scores, over the whole AI range", () => {
    const ai = aiOf("stripe.com");
    expect(ai).toEqual({ kind: "unmeasured", reason: "undeterminable", at: AT });
    const d = { searchPresence: measured(70, AT), aiPresence: ai };
    // The unread AI half is the middle of its scale: the figure is inside the range.
    expect(valueOf(presenceOf(d))).toBe(0.5 * 70 + 0.5 * 50.5);
    expect(presenceRangeOf(d, aiPresenceRangeOf(aiSampleOf({ serps: serpsOf("stripe.com"), ownDomain: "stripe.com" })))).toEqual({
      low: 0.5 * 70 + 0.5 * 1,
      high: 0.5 * 70 + 0.5 * 100,
    });
    expect(scoreWith(ai).kind).toBe("measured");
  });

  it("the range narrows as answers grow: one answer is a rough estimate, twelve a close one", () => {
    const estimateOver = (answers: number) => {
      const serps = Array.from({ length: answers }, () => measured(serp(["example.com"]), AT));
      const d = { searchPresence: measured(100, AT), aiPresence: aiPresenceOf({ serps, ownDomain: OWN, at: AT }) };
      const factors = factorsOf({ foundations: measured(100, AT), answerability: measured(30, AT), ...d });
      return estimateOf(factors, presenceRangeOf(d, aiPresenceRangeOf(aiSampleOf({ serps, ownDomain: OWN }))))!;
    };
    const one = estimateOver(1);
    const twelve = estimateOver(12);
    expect(one.high - one.low).toBeGreaterThan(twelve.high - twelve.low);
    expect(one.confidence).toBe("rough");
    expect(twelve.confidence).toBe("close");
  });

  it("a site that does not rank yet is no longer capped: AI answers that name it lift Presence", () => {
    const named = aiPresenceOf({ serps: fourOf(["reachkit.app"]), ownDomain: OWN, at: AT });
    expect(valueOf(presenceOf({ searchPresence: measuredZero(0, AT), aiPresence: named }))).toBeCloseTo(30, 10);
    const nobody = aiPresenceOf({ serps: fourOf(["example.com"]), ownDomain: OWN, at: AT });
    expect(valueOf(presenceOf({ searchPresence: measuredZero(0, AT), aiPresence: nobody }))).toBe(1);
  });
});

describe("D67, owner ruling 2026-10-15 (issue 1441) — a place in the local pack counts toward SearchPresence as a top-ten result", () => {
  const pack = (domains: readonly string[]): Measured<{ localPack?: readonly { domain: string }[] }> => measured({ localPack: domains.map((domain) => ({ domain })) }, AT);

  it("reads the searches whose pack shows the site, by the search each SERP was bought for", () => {
    const found = localPackSearches({
      serps: [pack(["rival.co.uk", "www.reachkit.app"]), pack(["rival.co.uk"]), unmeasured("undeterminable", AT), measured({}, AT), pack(["shop.reachkit.app"])],
      searches: ["plumber leeds", "boiler repair leeds", "drain unblocking leeds", "plumbers in leeds"],
      ownDomain: OWN,
    });
    expect(found).toEqual(["plumber leeds"]);
  });

  it("a site that ranks for nothing but holds the pack on two searches is found on two, each a top-ten result", () => {
    const none = searchPresenceOf({ ranked: measuredZero<RankedResult>({ rows: [], total: 0 }, AT), at: AT });
    const local = searchPresenceOf({ ranked: measuredZero<RankedResult>({ rows: [], total: 0 }, AT), at: AT, localPack: ["plumber leeds", "Plumber Leeds", "emergency plumber leeds"] });
    expect(valueOf(none)).toBe(0);
    expect(valueOf(local)).toBeCloseTo(Math.min(100, 25 * Math.log10(3)) * 1.0, 10);
  });

  it("a pack search the ranked rows already hold below the top ten is moved into it, not counted twice", () => {
    const rows = [{ ...rankedRow(30), keyword: "plumber leeds" }, rankedRow(40), rankedRow(50), rankedRow(60)];
    const before = searchPresenceOf({ ranked: measured<RankedResult>({ rows, total: 4 }, AT), at: AT });
    const after = searchPresenceOf({ ranked: measured<RankedResult>({ rows, total: 4 }, AT), at: AT, localPack: ["plumber leeds"] });
    const reach = Math.min(100, 25 * Math.log10(5));
    expect(valueOf(before)).toBeCloseTo(reach * 0.55, 10);
    expect(valueOf(after)).toBeCloseTo(reach * 1.0, 10);
  });

  it("no pack, and an unmeasured ranked read, change nothing", () => {
    const rows = [rankedRow(3), rankedRow(30)];
    expect(searchPresenceOf({ ranked: measured<RankedResult>({ rows, total: 2 }, AT), at: AT, localPack: [] })).toEqual(
      searchPresenceOf({ ranked: measured<RankedResult>({ rows, total: 2 }, AT), at: AT })
    );
    expect(searchPresenceOf({ ranked: unmeasured<RankedResult>("not_attempted", AT), at: AT, localPack: ["plumber leeds"] }).kind).toBe("unmeasured");
  });
});
