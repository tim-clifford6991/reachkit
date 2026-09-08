// tests/measure/verdict/verdict.test.ts
//
// WO-277 `## Test plan` (carried verbatim from WO-055) — the composition,
// determinism and blocked-readers suites for `src/lib/measure/verdict.ts`.
// `structure.md` rule 4.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { measured, unmeasured, type Measured } from "../../../src/lib/measure/measured.ts";
import type { InputOutcome, ScanInput } from "../../../src/lib/measure/partition.ts";
import type { Drivers } from "../../../src/lib/measure/score.ts";
import { verdictOf, type Verdict } from "../../../src/lib/measure/verdict.ts";
import type { CanonicalDomain } from "../../../src/lib/scan/domain.ts";
import type { RobotsPolicy } from "../../../src/lib/egress/types.ts";
import { AI_READER_AGENTS } from "../../../src/lib/config/constants.ts";

const AT = new Date("2026-09-04T00:00:00.000Z");
const DOMAIN = "example.com" as CanonicalDomain;
const SOURCE_PATH = path.resolve(import.meta.dirname, "../../../src/lib/measure/verdict.ts");

const ALL_INPUTS: readonly ScanInput[] = [
  "home_document",
  "pricing_document",
  "access_rules",
  "business_profile",
  "market_suggestions",
  "own_ranked_rows",
  "question_serps",
];

function allRead(): Record<ScanInput, InputOutcome> {
  const rec = {} as Record<ScanInput, InputOutcome>;
  for (const input of ALL_INPUTS) rec[input] = { read: true, empty: false };
  return rec;
}

function fullDrivers(at: Date = AT): Drivers {
  return {
    foundations: measured(80, at),
    answerability: measured(70, at),
    searchPresence: measured(60, at),
    aiPresence: measured(40, at),
  };
}

function robotsFixture(overrides: Partial<RobotsPolicy> = {}, at: Date = AT): Measured<RobotsPolicy> {
  return measured(
    {
      ok: true,
      origin: "https://example.com",
      readAt: at,
      disallowsAll: false,
      disallowedAgents: {},
      sitemaps: [],
      absent: false,
      ...overrides,
    },
    at
  );
}

describe(
  'REQ-004 c1 — "… the first module shows a single score … the domain measured, and the date it was measured." — verdict/compose · the verdict carries domain, date, score and band',
  () => {
    it("a full-measurement fixture yields a measured verdict with domain, date and empty missing", () => {
      const v = verdictOf({ domain: DOMAIN, measuredAt: AT, drivers: fullDrivers(), inputs: allRead(), robots: robotsFixture() });
      expect(v.scoreAndBand.kind).toBe("measured");
      expect(v.domain).toBe(DOMAIN);
      expect(v.measuredAt).toBe(AT);
      expect(v.missing).toEqual([]);
    });
  }
);

describe(
  'REQ-004 c3 — "… the first module shows \'—\' in place of the score … carries one written line saying the verdict could not be reached, naming every driver that has no value …" — verdict/missing · every factor with no value is named, with the reason that applies',
  () => {
    it.each([
      ["foundations", "undeterminable"],
      ["foundations", "not_attempted"],
      ["answerability", "undeterminable"],
      ["answerability", "not_attempted"],
      ["presence", "undeterminable"],
      ["presence", "not_attempted"],
    ] as const)("%s missing with reason %s — named exactly once, scoreAndBand unmeasured, domain/measuredAt populated", (factor, reason) => {
      const drivers: Drivers = fullDrivers();
      if (factor === "foundations") drivers.foundations = unmeasured(reason, AT);
      if (factor === "answerability") drivers.answerability = unmeasured(reason, AT);
      if (factor === "presence") drivers.searchPresence = unmeasured(reason, AT);

      const v = verdictOf({ domain: DOMAIN, measuredAt: AT, drivers, inputs: allRead(), robots: robotsFixture() });
      expect(v.scoreAndBand.kind).toBe("unmeasured");
      expect(v.missing).toEqual([{ factor, reason }]);
      expect(v.domain).toBe(DOMAIN);
      expect(v.measuredAt).toBe(AT);
    });

    it("is over factors, never over the four quantities — only aiPresence failed reports presence in missing, never aiPresence", () => {
      const drivers: Drivers = fullDrivers();
      drivers.aiPresence = unmeasured("undeterminable", AT);
      const v = verdictOf({ domain: DOMAIN, measuredAt: AT, drivers, inputs: allRead(), robots: robotsFixture() });
      expect(v.missing).toEqual([{ factor: "presence", reason: "undeterminable" }]);
      expect(v.missing.some((m) => (m.factor as string) === "aiPresence")).toBe(false);
    });
  }
);

describe(
  'REQ-004 c5 — "… no part of the score, the band or the line criterion 2 requires is hidden, blurred, rounded down, locked, or marked as available on payment …" — verdict/no-tier · nothing in this file can hide anything',
  () => {
    // Comment-stripped: this file's own header, verbatim from BP-024's
    // public interface, legitimately says in prose that there is no tier
    // field and no `forFree` parameter — only the actual code must be free
    // of the words.
    const CODE_ONLY = readFileSync(SOURCE_PATH, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    it.each(["tier", "free", "paid", "forFree", "plan", "entitle"])("contains no identifier `%s`", (word) => {
      const identifier = new RegExp(`\\b${word}\\b`, "i");
      expect(identifier.test(CODE_ONLY)).toBe(false);
    });

    it("verdictOf takes exactly one parameter object with exactly domain, measuredAt, drivers, inputs, robots", () => {
      expect(verdictOf.length).toBe(1);
      const v = verdictOf({ domain: DOMAIN, measuredAt: AT, drivers: fullDrivers(), inputs: allRead(), robots: robotsFixture() });
      expect(new Set(Object.keys(v))).toEqual(
        // `factors` joined the seven on 2026-09-08 (ruling 1b): the header
        // strip draws the three driver bars with their values, so the
        // verdict keeps what `factorsOf` always computed. Nothing else
        // moved, and no member here can hide anything.
        new Set([
          "domain",
          "measuredAt",
          "scoreAndBand",
          "factors",
          "limiting",
          "missing",
          "unmeasuredElsewhere",
          "blockedReaders",
        ])
      );
    });
  }
);

describe(
  'REQ-004 c6 — "… An input no driver depends on never withholds the score." — verdict/unmeasuredElsewhere · a failure no factor depended on leaves the score standing',
  () => {
    it("every factor measured, one unread input whose FEEDS row is satisfied elsewhere → scoreAndBand measured, the input appears in unmeasuredElsewhere with its reason", () => {
      const inputs = allRead();
      inputs.pricing_document = { read: false, because: "undeterminable" };
      const v = verdictOf({ domain: DOMAIN, measuredAt: AT, drivers: fullDrivers(), inputs, robots: robotsFixture() });
      expect(v.scoreAndBand.kind).toBe("measured");
      expect(v.unmeasuredElsewhere).toEqual([{ input: "pricing_document", reason: "undeterminable" }]);
    });
  }
);

describe(
  'REQ-004 c12 — "… Every number the report shows and the product stores comes from the scan whose measurement date the report carries." — verdict/one-date · every value under the verdict carries the verdict\'s date',
  () => {
    it("a Measured input carrying a different `at` makes verdictOf throw", () => {
      const drivers = fullDrivers(new Date("2020-01-01T00:00:00.000Z"));
      expect(() => verdictOf({ domain: DOMAIN, measuredAt: AT, drivers, inputs: allRead(), robots: robotsFixture() })).toThrow();
    });

    it("verdict/determinism · same inputs, byte-identical verdict", () => {
      const a = verdictOf({ domain: DOMAIN, measuredAt: AT, drivers: fullDrivers(), inputs: allRead(), robots: robotsFixture() });
      const b = verdictOf({ domain: DOMAIN, measuredAt: AT, drivers: fullDrivers(), inputs: allRead(), robots: robotsFixture() });
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it("reads no clock — no Date.now, new Date() or performance.now in the source", () => {
      const source = readFileSync(SOURCE_PATH, "utf8");
      expect(source).not.toMatch(/Date\.now/);
      expect(source).not.toMatch(/new Date\(\)/);
      expect(source).not.toMatch(/performance\.now/);
    });
  }
);

describe(
  "REQ-009 c1 (rendered by BP-027, measured here) — verdict/blockedReaders · the count carries the trichotomy",
  () => {
    it("measured with two disallowed members → measured 2", () => {
      const disallowed = Object.fromEntries(AI_READER_AGENTS.slice(0, 2).map((t) => [t, true]));
      const v = verdictOf({
        domain: DOMAIN,
        measuredAt: AT,
        drivers: fullDrivers(),
        inputs: allRead(),
        robots: robotsFixture({ disallowedAgents: disallowed }),
      });
      expect(v.blockedReaders).toEqual({ kind: "measured", value: 2, at: AT });
    });

    it("measured with none disallowed → zero 0", () => {
      const v = verdictOf({ domain: DOMAIN, measuredAt: AT, drivers: fullDrivers(), inputs: allRead(), robots: robotsFixture() });
      expect(v.blockedReaders).toEqual({ kind: "zero", value: 0, at: AT });
    });

    it("measured with absent: true (no robots.txt) → zero 0, never unmeasured", () => {
      const v = verdictOf({
        domain: DOMAIN,
        measuredAt: AT,
        drivers: fullDrivers(),
        inputs: allRead(),
        robots: robotsFixture({ absent: true }),
      });
      expect(v.blockedReaders).toEqual({ kind: "zero", value: 0, at: AT });
    });

    it("disallowsAll disallows every member of the set", () => {
      const v = verdictOf({
        domain: DOMAIN,
        measuredAt: AT,
        drivers: fullDrivers(),
        inputs: allRead(),
        robots: robotsFixture({ disallowsAll: true }),
      });
      expect(v.blockedReaders).toEqual({ kind: "measured", value: AI_READER_AGENTS.length, at: AT });
    });

    it("unmeasured/undeterminable robots → unmeasured/undeterminable count", () => {
      const v = verdictOf({
        domain: DOMAIN,
        measuredAt: AT,
        drivers: fullDrivers(),
        inputs: allRead(),
        robots: unmeasured("undeterminable", AT),
      });
      expect(v.blockedReaders).toEqual({ kind: "unmeasured", reason: "undeterminable", at: AT });
    });

    it("unmeasured/not_attempted robots → unmeasured/not_attempted count, never 0", () => {
      const v = verdictOf({
        domain: DOMAIN,
        measuredAt: AT,
        drivers: fullDrivers(),
        inputs: allRead(),
        robots: unmeasured("not_attempted", AT),
      });
      expect(v.blockedReaders).toEqual({ kind: "unmeasured", reason: "not_attempted", at: AT });
    });

    it("is over AI_READER_AGENTS and no other list — spying on the imported constant", () => {
      const disallowed: Record<string, boolean> = {};
      for (const t of AI_READER_AGENTS) disallowed[t] = true;
      disallowed["some-other-crawler"] = true; // not in the closed set
      const v = verdictOf({
        domain: DOMAIN,
        measuredAt: AT,
        drivers: fullDrivers(),
        inputs: allRead(),
        robots: robotsFixture({ disallowedAgents: disallowed }),
      });
      expect((v.blockedReaders as { value: number }).value).toBe(AI_READER_AGENTS.length);
    });

    it("reads disallowedAgents by token rather than counting the map's own size", () => {
      // A map with extra, irrelevant tokens set to false must not inflate
      // the count beyond the closed set's true positives.
      const disallowed: Record<string, boolean> = { "irrelevant-1": false, "irrelevant-2": false };
      if (AI_READER_AGENTS[0] !== undefined) disallowed[AI_READER_AGENTS[0]] = true;
      const v = verdictOf({
        domain: DOMAIN,
        measuredAt: AT,
        drivers: fullDrivers(),
        inputs: allRead(),
        robots: robotsFixture({ disallowedAgents: disallowed }),
      });
      expect((v.blockedReaders as { value: number }).value).toBe(1);
    });
  }
);

// Type witness: the verdict carries the three factors, and the report
// header is the one surface that may draw their values (ruling 1b of
// 2026-09-08, which amends REQ-004 c2 and reverses BP-024 decision 6 for
// that strip alone).
function _factorsField(v: Verdict): void {
  void v.factors.foundations;
  void v.factors.answerability;
  void v.factors.presence;
}
void _factorsField;
