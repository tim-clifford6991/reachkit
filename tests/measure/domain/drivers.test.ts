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
  answerabilityOf,
  foundationsOf,
  ownRankedOf,
  searchPresenceOf,
} from "../../../src/lib/measure/drivers.ts";
import { measured, measuredZero, unmeasured, type Measured } from "../../../src/lib/measure/measured.ts";
import type { OnPageFacts } from "../../../src/lib/measure/parse.ts";

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

describe('`BUILD.md` §5: "Foundations = access gates + clarity signals, 0–100 (generic noindex on the home document ⇒ 0, and score ⇒ 0)"', () => {
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

describe('`BUILD.md` §5: "Answerability = shape of the home + measured pages, 0–100, floored at 1 · shape = (questionShaped + directAnswers + evidenceDensity) / 3"', () => {
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
    expect(valueOf(searchPresenceOf({ ranked: measured(rows, AT), at: AT }))).not.toBe(3);
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

describe('`BUILD.md` §5: "SearchPresence = min(100, 25 × log10(ranked + 1)) × (0.55 + 0.45 × min(1, top10share × 4))"', () => {
  function presence(rows: readonly RankedRow[]): Measured<number> {
    return searchPresenceOf({ ranked: measured(rows, AT), at: AT });
  }

  it('zero ranked rows is a measured presence of zero — "0 rows is a legal result"', () => {
    const m = searchPresenceOf({ ranked: measuredZero<readonly RankedRow[]>([], AT), at: AT });
    expect(m.kind).toBe("zero");
    expect(valueOf(m)).toBe(0);
    expectAt(m);
  });

  it("an unmeasured row set stays unmeasured and carries the same reason", () => {
    const m = searchPresenceOf({ ranked: unmeasured<readonly RankedRow[]>("not_attempted", AT), at: AT });
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
    // 10,000 rows, every one of them in the top 10: 25 × log10(10001) > 100,
    // so the `min(100, …)` holds it at the top of the scale. Dropping that
    // `min` fails here.
    const many = Array.from({ length: 10_000 }, (_, i) => rankedRow((i % 10) + 1));
    expect(25 * Math.log10(10_001)).toBeGreaterThan(100);
    expect(valueOf(presence(many))).toBeCloseTo(100, 10);
  });
});

describe('`BUILD.md` §5: "AIPresence = max(1, (0.4 × mentionRate + 0.6 × citationRate) × 100)"', () => {
  it("AIPresence weights citations above mentions", () => {
    const mentionsOnly = aiPresenceOf({ serps: [measured(serp(["g2.com/reachkit"]), AT)], ownDomain: OWN, at: AT });
    expect(valueOf(mentionsOnly)).toBeCloseTo(40, 10);

    const citationsOnly = aiPresenceOf({ serps: [measured(serp(["reachkit.app"]), AT)], ownDomain: OWN, at: AT });
    expect(valueOf(citationsOnly)).toBeCloseTo(60, 10);
  });

  it("a measured set that names the customer nowhere is a zero carrying the floor of 1, not a 0", () => {
    const m = aiPresenceOf({
      serps: [measured(serp(["example.com", "other.example"]), AT), measured(serp([], false), AT)],
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
    const m = aiPresenceOf({ serps: [measured(serp(["reachkit.app/pricing"]), AT)], ownDomain: OWN, at: AT });
    expect(valueOf(m)).toBeCloseTo(60, 10);
  });

  it("a subdomain of the customer's own domain is a citation; a third-party host carrying the brand token is a mention", () => {
    const subdomain = aiPresenceOf({ serps: [measured(serp(["docs.reachkit.app"]), AT)], ownDomain: OWN, at: AT });
    expect(valueOf(subdomain)).toBeCloseTo(60, 10);

    const thirdParty = aiPresenceOf({ serps: [measured(serp(["reachkit.medium.com"]), AT)], ownDomain: OWN, at: AT });
    expect(valueOf(thirdParty)).toBeCloseTo(40, 10);
  });

  it("the brand token matches whole tokens only — a longer word that merely contains it is not a mention", () => {
    // Brand token "app" from "app.com": "apple.com" contains it as a
    // substring and is not a mention of it.
    const m = aiPresenceOf({ serps: [measured(serp(["apple.com"]), AT)], ownDomain: "app.com", at: AT });
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
