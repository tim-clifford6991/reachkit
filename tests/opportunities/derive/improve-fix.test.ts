// BUILD §7 — the Improve family, and the Fix family that is an
// instruction and never a page.
import "../env";
import { describe, expect, it } from "vitest";
import {
  AI_READER_AGENTS,
  IMPROVE_POSITION_BAND,
  THIN_PAGE_VISIBLE_CHARS,
} from "../../../src/lib/config/constants";
import { measured, unmeasured } from "../../../src/lib/measure/measured";
import { fixCandidates } from "../../../src/lib/opportunities/derive/fix";
import { improveCandidates } from "../../../src/lib/opportunities/derive/improve";
import type { OnPageFacts } from "../../../src/lib/measure/parse";
import type { RobotsPolicy } from "../../../src/lib/egress/types";
import { ON_PAGE, ROBOTS } from "../../scan/report/fixtures";
import { AT, SCAN_ID, SITE_ID, question, reportOf, serp, smallCounts } from "../fixtures";

const base = { siteId: SITE_ID, scanId: SCAN_ID, ownRanked: 0 };

/** A top ten with the customer's own measured page inside the band. */
function rankingSerp(position: number, url = ON_PAGE.url) {
  return serp({
    organic: [
      { position: 1, domain: "appcues.com", url: "https://appcues.com/a", title: "A" },
      { position, domain: "example.com", url, title: "Us" },
    ],
    aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] },
  });
}

function facts(over: Partial<OnPageFacts> = {}): OnPageFacts {
  return { ...ON_PAGE, ...over };
}

describe('§7: `expand_page` — "Customer ranks 4-30, page thin"', () => {
  it("a ranking page under the thin floor becomes one, with the measured count as its shortfall", () => {
    const report = reportOf(
      { questions: [question()], serps: [rankingSerp(5)] },
      { onPage: measured(facts({ visibleChars: 400 }), AT) }
    );
    const { candidates } = improveCandidates({ ...base, report, rankedCounts: smallCounts() });
    expect(candidates).toHaveLength(1);
    const only = candidates[0]!;
    expect(only.type).toBe("expand_page");
    expect(only.family).toBe("improve");
    expect(only.evidence).toEqual({
      family: "improve",
      query: "best user onboarding software",
      volume: { kind: "measured", value: 1900, at: AT },
      pageUrl: ON_PAGE.url,
      shortfall: { kind: "thin", words: { kind: "measured", value: 400, at: AT } },
    });
    expect(only.acceptance).toEqual({ form: "top20", query: "best user onboarding software" });
    expect(only.targetRef).toBe(ON_PAGE.url);
  });

  it("a page at or above the thin floor is not thin", () => {
    const report = reportOf(
      { questions: [question()], serps: [rankingSerp(5)] },
      { onPage: measured(facts({ visibleChars: THIN_PAGE_VISIBLE_CHARS }), AT) }
    );
    expect(
      improveCandidates({ ...base, report, rankedCounts: smallCounts() }).candidates.map(
        (c) => c.type
      )
    ).not.toContain("expand_page");
  });
});

describe('§7: `answerable_page` — "Page has search value, low answerability"', () => {
  it("a substantial ranking page the AI answer ignores becomes one, with its position", () => {
    const report = reportOf(
      {
        questions: [question()],
        serps: [
          serp({
            organic: [
              { position: 1, domain: "appcues.com", url: "https://appcues.com/a", title: "A" },
              { position: 6, domain: "example.com", url: ON_PAGE.url, title: "Us" },
            ],
            aiOverview: {
              present: true,
              asynchronousAiOverview: true,
              referenceDomains: ["appcues.com"],
            },
          }),
        ],
      },
      { onPage: measured(facts({ visibleChars: 9000 }), AT) }
    );
    const { candidates } = improveCandidates({ ...base, report, rankedCounts: smallCounts() });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.type).toBe("answerable_page");
    expect(candidates[0]!.acceptance).toEqual({ form: "named_on", question: question().text });
    const evidence = candidates[0]!.evidence;
    if (evidence.family !== "improve") throw new Error("unreachable");
    expect(evidence.shortfall).toEqual({
      kind: "position",
      position: { kind: "measured", value: 6, at: AT },
    });
  });
});

describe("§7: `refresh_page` is not derived from measurement", () => {
  it("nothing the scan stores is a last-changed date, so no report produces one", () => {
    for (const chars of [200, 9000]) {
      const report = reportOf(
        { questions: [question()], serps: [rankingSerp(5)] },
        { onPage: measured(facts({ visibleChars: chars }), AT) }
      );
      expect(
        improveCandidates({ ...base, report, rankedCounts: smallCounts() }).candidates.map(
          (c) => c.type
        )
      ).not.toContain("refresh_page");
    }
  });
});

describe("§6.6's cold-start law: nothing to improve is not something invented", () => {
  it("a customer who ranks for nothing gets no Improve candidate at all", () => {
    const report = reportOf({ questions: [question()], serps: [serp()] });
    const result = improveCandidates({ ...base, report, rankedCounts: smallCounts() });
    expect(result.candidates).toEqual([]);
    expect(result.assessed).toBe(0);
  });

  it("a page the scan never read yields nothing — the shortfall must be measured", () => {
    const report = reportOf(
      { questions: [question()], serps: [rankingSerp(5)] },
      { onPage: unmeasured("undeterminable", AT) }
    );
    expect(
      improveCandidates({ ...base, report, rankedCounts: smallCounts() }).candidates
    ).toEqual([]);
  });

  it("a ranking url that is not the page the scan measured yields nothing", () => {
    // There is no crawler: the shortfall on record is a measurement of the
    // home document, and attaching it to a different page would be a claim
    // about a page nobody read.
    const report = reportOf(
      { questions: [question()], serps: [rankingSerp(5, "https://example.com/blog/post")] },
      { onPage: measured(facts({ visibleChars: 400 }), AT) }
    );
    expect(
      improveCandidates({ ...base, report, rankedCounts: smallCounts() }).candidates
    ).toEqual([]);
  });
});

describe("§7's Improve band: positions 4-30, inclusive", () => {
  it("a page above the band is not an Improve target", () => {
    const report = reportOf(
      { questions: [question()], serps: [rankingSerp(IMPROVE_POSITION_BAND.min - 1)] },
      { onPage: measured(facts({ visibleChars: 400 }), AT) }
    );
    expect(
      improveCandidates({ ...base, report, rankedCounts: smallCounts() }).candidates
    ).toEqual([]);
  });

  it("a page at the top of the band is", () => {
    const report = reportOf(
      { questions: [question()], serps: [rankingSerp(IMPROVE_POSITION_BAND.min)] },
      { onPage: measured(facts({ visibleChars: 400 }), AT) }
    );
    expect(
      improveCandidates({ ...base, report, rankedCounts: smallCounts() }).candidates
    ).toHaveLength(1);
  });
});

describe('§7: `unblock` is "instruction only, never generated, never automated"', () => {
  it("a robots policy that shuts every reader out yields one, with a gate test", () => {
    const shut: RobotsPolicy = { ...ROBOTS, disallowsAll: true };
    const report = reportOf(
      { questions: [question()], serps: [serp()] },
      { robots: measured(shut, AT), blockedAgents: [...AI_READER_AGENTS] }
    );
    const { candidates } = fixCandidates({ siteId: SITE_ID, scanId: SCAN_ID, report });
    const unblock = candidates.find((c) => c.evidence.family === "fix");
    expect(unblock).toBeDefined();
    expect(unblock!.type).toBe("unblock");
    expect(unblock!.evidence).toEqual({
      family: "fix",
      barrier: "robots_disallow",
      foundOnUrl: ROBOTS.origin,
    });
    expect(unblock!.acceptance).toEqual({ form: "gate_cleared", gate: "robots_disallow" });
  });

  it("a named AI reader shut out is its own barrier", () => {
    const report = reportOf(
      { questions: [question()], serps: [serp()] },
      { blockedAgents: [AI_READER_AGENTS[0]!] }
    );
    const { candidates } = fixCandidates({ siteId: SITE_ID, scanId: SCAN_ID, report });
    const evidence = candidates[0]!.evidence;
    if (evidence.family !== "fix") throw new Error("unreachable");
    expect(evidence.barrier).toBe("blocked_ai_agent");
  });

  it("a home document telling every reader not to index it is another", () => {
    const report = reportOf(
      { questions: [question()], serps: [serp()] },
      {
        blockedAgents: [],
        onPage: measured(facts({ noindex: true, noindexAppliesToEveryReader: true }), AT),
      }
    );
    const { candidates } = fixCandidates({ siteId: SITE_ID, scanId: SCAN_ID, report });
    const evidence = candidates[0]!.evidence;
    if (evidence.family !== "fix") throw new Error("unreachable");
    expect(evidence.barrier).toBe("noindex");
    expect(evidence.foundOnUrl).toBe(ON_PAGE.url);
  });

  it("an unblock carries no search, no band and no volume", () => {
    const report = reportOf(
      { questions: [question()], serps: [serp()] },
      { blockedAgents: [AI_READER_AGENTS[0]!] }
    );
    const only = fixCandidates({ siteId: SITE_ID, scanId: SCAN_ID, report }).candidates[0]!;
    expect(only.targetQuery).toBeNull();
    expect(only.fitBand).toBeNull();
    expect(only.volume).toBeNull();
    expect(only.title).toBeNull();
  });

  it("a site with no gate failing gets no instruction", () => {
    const report = reportOf({ questions: [question()], serps: [serp()] }, { blockedAgents: [] });
    expect(fixCandidates({ siteId: SITE_ID, scanId: SCAN_ID, report }).candidates).toEqual([]);
  });

  it("a noindex that does not apply to every reader is not a barrier", () => {
    const report = reportOf(
      { questions: [question()], serps: [serp()] },
      {
        blockedAgents: [],
        onPage: measured(facts({ noindex: true, noindexAppliesToEveryReader: false }), AT),
      }
    );
    expect(fixCandidates({ siteId: SITE_ID, scanId: SCAN_ID, report }).candidates).toEqual([]);
  });
});
