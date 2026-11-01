// BUILD §7 — the Write family, from measured evidence only.
import "../env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SerpResult } from "../../../src/lib/vendors/dataforseo/types";
import { WRITE_VOLUME_FLOOR_PER_MONTH } from "../../../src/lib/config/constants";
import { writeCandidates } from "../../../src/lib/opportunities/derive/write";
import { difficultyCeiling } from "../../../src/lib/opportunities/winnability/bars";
import { measured } from "../../../src/lib/measure/measured";
import { marketSetOf } from "../../../src/lib/market/questions/market-set";
import { PROFILE } from "../../scan/report/fixtures";
import {
  AT,
  SCAN_ID,
  SITE_ID,
  bigCounts,
  question,
  reportOf,
  search,
  serp,
  smallCounts,
  unreadableCounts,
} from "../fixtures";

const base = { siteId: SITE_ID, scanId: SCAN_ID, ownRanked: 0 };

describe('§7: `answer_page` — "AI answer for a question names rivals, not customer"', () => {
  it("an answer that cited a rival and not the customer yields one, with the question as its test", () => {
    const report = reportOf({ questions: [question()], serps: [serp()] });
    const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });

    expect(candidates).toHaveLength(1);
    const only = candidates[0]!;
    expect(only.type).toBe("answer_page");
    expect(only.family).toBe("write");
    expect(only.acceptance).toEqual({ form: "named_on", question: question().text });
  });

  it("an answer that already names the customer yields no answer_page", () => {
    const named = serp({
      aiOverview: {
        present: true,
        asynchronousAiOverview: true,
        referenceDomains: ["example.com"],
      },
    });
    const report = reportOf({ questions: [question()], serps: [named] });
    const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });
    expect(candidates.map((c) => c.type)).not.toContain("answer_page");
  });
});

describe("issue 867 — the target's own facts are copied onto the evidence at creation", () => {
  it("carries the search's difficulty, the ceiling this site is judged against, and every engine's standing", () => {
    const report = reportOf({
      questions: [question({ search: search({ difficulty: 12 }) })],
      serps: [serp()],
    });
    const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });

    expect(candidates).toHaveLength(1);
    const evidence = candidates[0]!.evidence;
    if (evidence.family !== "write") throw new Error("expected a Write candidate");
    expect(evidence.target?.difficulty).toEqual(measured(12, AT));
    // `difficultyCeiling(0)` — the cold-start bar (SPEC §6, issue 858).
    expect(evidence.target?.ceiling).toBe(difficultyCeiling(0));
    // One entry per engine the row carried, each with where it stood.
    expect(evidence.target?.engines).toEqual([
      { engine: "ai_overview", standing: "names_others" },
      { engine: "ai_mode", standing: "unmeasured" },
      { engine: "chatgpt", standing: "unmeasured" },
    ]);
  });

  it("a search the vendor gave no difficulty for carries the unmeasured arm, never a 0", () => {
    const report = reportOf({ questions: [question()], serps: [serp()] });
    const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });
    const evidence = candidates[0]!.evidence;
    if (evidence.family !== "write") throw new Error("expected a Write candidate");
    expect(evidence.target?.difficulty.kind).toBe("unmeasured");
  });
});

describe("issue 858 — the answer_page trigger reads every answer column the pass measured", () => {
  const noOverview = serp({ aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] } });
  const withEngines = (chatgpt: { kind: "answered"; citedDomains: string[]; namesCustomer: boolean } | { kind: "no_answer" }) => {
    const report = reportOf({
      questions: [question({ search: search({ keyword: "seo content brief template for startups", intent: "informational" }) })],
      serps: [noOverview],
    });
    const row = report.aiAnswers!.rows[0]!;
    (row as { engines: unknown }).engines = [
      { engine: "ai_overview", cell: row.cell },
      { engine: "ai_mode", cell: { kind: "no_answer" } },
      { engine: "chatgpt", cell: chatgpt },
    ];
    return report;
  };

  it("no AI Overview, but ChatGPT answered citing a rival and not the customer: an answer_page", () => {
    const report = withEngines({ kind: "answered", citedDomains: ["briefkit.io"], namesCustomer: false });
    const { candidates } = writeCandidates({
      ...base,
      report,
      rankedCounts: unreadableCounts(),
      marketRivals: ["briefkit.io"],
    });
    expect(candidates.map((c) => [c.type, c.source])).toEqual([["answer_page", "ai_gap"]]);
  });

  it("an answer that cites only a publisher is no AI-answer gap (SPEC §6, 2026-09-29, issue 1134)", () => {
    const report = withEngines({ kind: "answered", citedDomains: ["youtube.com", "gartner.com"], namesCustomer: false });
    const { candidates } = writeCandidates({ ...base, report, rankedCounts: unreadableCounts() });
    expect(candidates.map((c) => c.type)).not.toContain("answer_page");
    expect(candidates.map((c) => c.source)).not.toContain("ai_gap");
  });

  it("an engine that names the customer, or answered nothing, is no trigger", () => {
    for (const cell of [
      { kind: "answered" as const, citedDomains: ["briefkit.io"], namesCustomer: true },
      { kind: "no_answer" as const },
    ]) {
      const { candidates } = writeCandidates({ ...base, report: withEngines(cell), rankedCounts: unreadableCounts() });
      expect(candidates.map((c) => c.type)).not.toContain("answer_page");
    }
  });
});

describe('§7: `keyword_page` — "Rival top-20 for a query >=10/mo; customer absent"', () => {
  const noAnswer = serp({
    aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] },
  });

  it("a search the customer is absent from yields one, with a top-20 test", () => {
    const report = reportOf({
      questions: [question({ search: search({ keyword: "user onboarding software" }) })],
      serps: [noAnswer],
    });
    const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.type).toBe("keyword_page");
    expect(candidates[0]!.acceptance).toEqual({
      form: "top20",
      query: "user onboarding software",
    });
  });

  it("a German site's new address writes its umlauts as German does; an English site's drops them (issue 1514)", () => {
    const questions = [question({ search: search({ keyword: "bäckerei düsseldorf" }) })];
    const german = reportOf({ questions, serps: [noAnswer] });
    german.locale = { country: "DE", language: "de" };
    expect(writeCandidates({ ...base, report: german, rankedCounts: smallCounts() }).candidates[0]!.targetRef).toBe(
      "baeckerei-duesseldorf"
    );
    const english = reportOf({ questions, serps: [noAnswer] });
    expect(writeCandidates({ ...base, report: english, rankedCounts: smallCounts() }).candidates[0]!.targetRef).toBe(
      "backerei-dusseldorf"
    );
  });

  it("a search the customer already holds a place in yields none", () => {
    const present = serp({
      organic: [
        { position: 1, domain: "appcues.com", url: "https://appcues.com/a", title: "A" },
        { position: 2, domain: "example.com", url: "https://example.com/x", title: "X" },
      ],
      aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] },
    });
    const report = reportOf({
      questions: [question({ search: search({ keyword: "user onboarding software" }) })],
      serps: [present],
    });
    expect(writeCandidates({ ...base, report, rankedCounts: smallCounts() }).candidates).toEqual([]);
  });

  it("a search below the volume floor yields none", () => {
    const report = reportOf({
      questions: [
        question({
          search: search({
            keyword: "user onboarding software",
            volume: WRITE_VOLUME_FLOOR_PER_MONTH - 1,
          }),
        }),
      ],
      serps: [noAnswer],
    });
    expect(writeCandidates({ ...base, report, rankedCounts: smallCounts() }).candidates).toEqual([]);
  });
});

describe('§7: `comparison_page` — "Gap query names a rival or contains vs/alternative"', () => {
  const noAnswer = serp({
    aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] },
  });

  it("a vs search becomes a comparison, not a keyword page", () => {
    const report = reportOf({
      questions: [question({ search: search({ keyword: "appcues vs userpilot" }) })],
      serps: [noAnswer],
    });
    const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });
    expect(candidates[0]!.type).toBe("comparison_page");
  });

  it("an alternatives search does too", () => {
    const report = reportOf({
      questions: [question({ search: search({ keyword: "onboarding tool alternatives" }) })],
      serps: [noAnswer],
    });
    expect(
      writeCandidates({ ...base, report, rankedCounts: smallCounts() }).candidates[0]!.type
    ).toBe("comparison_page");
  });
});

describe("§7: `format_page` is not derived from measurement", () => {
  it("no report produces one — the trigger names a page type nothing measures", () => {
    // "Rivals have a page type customer lacks entirely" states a page
    // *type*, and no measurement in the stored report is one. It arises
    // only where the model refines an already-derived candidate.
    for (const keyword of ["best onboarding software", "appcues vs userpilot", "onboarding guide"]) {
      const report = reportOf({
        questions: [question({ search: search({ keyword }) })],
        serps: [serp()],
      });
      const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });
      expect(candidates.map((c) => c.type)).not.toContain("format_page");
    }
  });
});

describe("winnability gates keyword pages only (§6, 2026-09-15)", () => {
  const keywordSearch = () =>
    reportOf({
      questions: [question({ search: search({ keyword: "user onboarding software" }) })],
      serps: [serp({ aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] } })],
    });

  it("a keyword page over a top ten of large rivals is dropped and counts a not_yet", () => {
    const result = writeCandidates({ ...base, report: keywordSearch(), rankedCounts: bigCounts() });
    expect(result.candidates).toEqual([]);
    expect(result.rejected.not_yet).toBe(1);
    expect(result.assessed).toBe(1);
  });

  it("a keyword page over a top ten we could not size is dropped and counts an unmeasured_top10", () => {
    const result = writeCandidates({ ...base, report: keywordSearch(), rankedCounts: unreadableCounts() });
    expect(result.candidates).toEqual([]);
    expect(result.rejected.unmeasured_top10).toBe(1);
  });

  it("an answer page over the same large rivals survives, with its band recorded", () => {
    const report = reportOf({ questions: [question()], serps: [serp()] });
    const result = writeCandidates({ ...base, report, rankedCounts: bigCounts() });
    expect(result.candidates.map((c) => [c.type, c.fitBand])).toEqual([["answer_page", "not-yet"]]);
    expect(result.rejected.not_yet).toBe(0);
  });

  it("a qualified candidate carries the band it qualified into", () => {
    const report = reportOf({ questions: [question()], serps: [serp()] });
    const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });
    expect(candidates[0]!.fitBand).toBe("winnable");
  });
});

describe("evidence is copied out of the report, with its own dates", () => {
  it("the query, its measured volume and the rival page that shows the gap", () => {
    const report = reportOf({ questions: [question()], serps: [serp()] });
    const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });
    const evidence = candidates[0]!.evidence;
    expect(evidence).toMatchObject({
      family: "write",
      query: "best user onboarding software",
      volume: { kind: "measured", value: 90, at: AT },
      rival: {
        domain: "appcues.com",
        url: { kind: "measured", value: "https://appcues.com/a", at: AT },
        position: { kind: "measured", value: 1, at: AT },
      },
    });
    // What this page is optimising for rides beside them since issue 867,
    // and has its own case below.
    expect(Object.keys(evidence).sort()).toEqual(["family", "query", "rival", "target", "volume"]);
  });

  it("the rival is the best-placed result that is not the customer's own", () => {
    const ownFirst = serp({
      organic: [
        { position: 1, domain: "example.com", url: "https://example.com/", title: "us" },
        { position: 2, domain: "appcues.com", url: "https://appcues.com/a", title: "A" },
      ],
    });
    const report = reportOf({ questions: [question()], serps: [ownFirst] });
    const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });
    const evidence = candidates[0]!.evidence;
    expect(evidence.family).toBe("write");
    if (evidence.family !== "write") throw new Error("unreachable");
    expect(evidence.rival?.domain).toBe("appcues.com");
  });
});

describe("the holder is the first row in Google's order that is a business, a rival or not", () => {
  const holdersOf = (rows: readonly (readonly [string, string, string])[], rivals: readonly string[] = []) => {
    const organic = rows.map(([domain, path, title], i) => ({ position: i + 1, domain, url: `https://${domain}${path}`, title }));
    const report = reportOf(
      { questions: [question({ search: search({ keyword: "bread" }) })], serps: [serp({ organic, aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] } })] },
      { rivals: measured(rivals.map((domain) => ({ domain, top10Appearances: 1, aiCitations: 0, score: 1 })), AT) }
    );
    const counted = smallCounts(rows.map(([domain]) => domain.replace(/^(www|en)\./, "")));
    return writeCandidates({ ...base, report, rankedCounts: counted }).candidates.map((c) => (c.evidence.family === "write" ? (c.evidence.rival?.domain ?? null) : undefined));
  };
  const bread = [
    ["www.google.com", "/maps/search/bread", "Bakeries near you"],
    ["en.wikipedia.org", "/wiki/Bread", "Bread - Wikipedia"],
    ["www.recipetineats.com", "/bread-recipe/", "Easy bread recipe"],
    ["www.woolworths.com.au", "/shop/browse/bakery", "Bakery | Woolworths"],
  ] as const;

  it("a map, an encyclopedia and a recipe are passed over for the shop that sells it, though it is no rival", () => {
    expect(holdersOf(bread)).toEqual(["woolworths.com.au"]);
  });

  it("a rival that sells it holds it the same way", () => {
    expect(holdersOf(bread, ["woolworths.com.au"])).toEqual(["woolworths.com.au"]);
  });

  it("a plumber third in a top ten held by a directory and a forum is the holder", () => {
    const plumber = [
      ["www.yelp.com", "/search?find_desc=plumber&find_loc=Austin", "THE BEST 10 Plumbing in Austin, TX"],
      ["www.reddit.com", "/r/Austin/comments/1abc/plumber/", "Plumber recommendations? : r/Austin"],
      ["austinwaterworksplumbing.com", "/", "Austin Waterworks Plumbing | 24 Hour Plumber"],
    ] as const;
    expect(holdersOf(plumber)).toEqual(["austinwaterworksplumbing.com"]);
  });

  it("a search only sources hold proposes no keyword page", () => {
    const sources = [
      ["en.wikipedia.org", "/wiki/Bread", "Bread - Wikipedia"],
      ["www.health.gov.au", "/topics/food/bread", "Bread and cereals"],
      ["www.yourcareer.gov.au", "/occupations/351111/baker", "Baker | Your Career"],
      ["www.instagram.com", "/bakerbleu/", "Baker Bleu (@bakerbleu) • Instagram"],
    ] as const;
    expect(holdersOf(sources)).toEqual([]);
  });
});

describe("nothing to derive from is not an error", () => {
  it("a pass that never phrased the twelve produces nothing and no counts", () => {
    const report = reportOf({ questions: [question()], serps: [serp()] });
    const unphrased = { ...report, questions: { kind: "unmeasured", reason: "not_attempted", at: AT } } as typeof report;
    const result = writeCandidates({ ...base, report: unphrased, rankedCounts: smallCounts() });
    expect(result).toEqual({
      candidates: [],
      assessed: 0,
      rejected: { not_yet: 0, unmeasured_top10: 0, duplicate_open: 0 },
    });
  });

  it("a question whose SERP was never bought is skipped, not guessed at", () => {
    const report = reportOf({ questions: [question()], serps: [] });
    expect(writeCandidates({ ...base, report, rankedCounts: smallCounts() }).candidates).toEqual([]);
  });
});

describe("at most one Write candidate per search", () => {
  it("a search that fires two triggers yields one page, not two near-duplicates", () => {
    // "appcues vs userpilot" is both a comparison shape and a search the
    // customer is absent from, on a question whose AI answer cited a rival.
    const report = reportOf({
      questions: [question({ search: search({ keyword: "appcues vs userpilot" }) })],
      serps: [serp()],
    });
    const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });
    expect(candidates).toHaveLength(1);
  });
});

describe("a job seeker's search proposes no page, except to a business that recruits or trains", () => {
  const rows = [
    ["www.yourcareer.gov.au", "Baker | Your Career"],
    ["bakingcareer.com.au", "Baking Career - Everything you need to know"],
    ["www.seek.com.au", "Baker Jobs in Australia - SEEK"],
    ["www.brumbys.com.au", "Brumby's Bakeries | Fresh bread"],
  ] as const;
  const baker = serp({
    organic: rows.map(([domain, title], i) => ({ position: i + 1, domain, url: `https://${domain}/`, title })),
    aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] },
  });
  const candidatesFor = (category: string) =>
    writeCandidates({
      ...base,
      report: reportOf(
        { questions: [question({ search: search({ keyword: "baker" }) })], serps: [baker] },
        { market: measured(marketSetOf({ profile: { ...PROFILE, category }, suggestions: [] }), AT) }
      ),
      rankedCounts: smallCounts(["yourcareer.gov.au", "bakingcareer.com.au", "seek.com.au", "brumbys.com.au"]),
    }).candidates.map((candidate) => candidate.targetQuery);

  it("a bakery gets no page for its jobs search", () => {
    expect(candidatesFor("bakery")).toEqual([]);
  });

  it("a recruitment agency keeps it", () => {
    expect(candidatesFor("recruitment agency")).toEqual(["baker"]);
  });
});

describe("a top ten Google hides behind its redirects measures neither the customer's absence nor a holder", () => {
  const stored = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../market/rivals/fixtures/au-baker-d149c119.json"), "utf8")) as { organic: SerpResult["organic"] };
  const noAnswer = { present: false, asynchronousAiOverview: false, referenceDomains: [] };
  const counted = smallCounts(["google.com", "yourcareer.gov.au", "wikipedia.org", "bakingcareer.com.au", "brumbys.com.au", "appcues.com"]);
  const candidatesOn = (organic: SerpResult["organic"], aiOverview: SerpResult["aiOverview"] = noAnswer) =>
    writeCandidates({
      ...base,
      report: reportOf(
        { questions: [question({ search: search({ keyword: "baker" }) })], serps: [serp({ organic, aiOverview })] },
        { market: measured(marketSetOf({ profile: { ...PROFILE, category: "bread and bakery" }, suggestions: [] }), AT) }
      ),
      rankedCounts: counted,
    }).candidates;

  it("stored AU baker top ten (d149c119): no baker candidate for a bread and bakery profile", () => {
    expect(candidatesOn(stored.organic)).toEqual([]);
  });

  it("an unresolved row is never evidence.rival", () => {
    // Half resolved: read, and an AI answer that ignored the customer still makes a page.
    const organic = [stored.organic[1]!, { position: 3, domain: "www.brumbys.com.au", url: "https://www.brumbys.com.au/", title: "Brumby's Bakeries" }];
    const [only] = candidatesOn(organic, { present: true, asynchronousAiOverview: true, referenceDomains: ["appcues.com"] });
    expect(only?.type).toBe("answer_page");
    expect(only?.evidence.family === "write" ? only.evidence.rival?.domain : undefined).toBe("brumbys.com.au");
  });

  it("an unresolved citation is never an ignored answer", () => {
    const organic = [{ position: 1, domain: "www.brumbys.com.au", url: "https://www.brumbys.com.au/", title: "Brumby's Bakeries" }];
    expect(candidatesOn(organic, { present: true, asynchronousAiOverview: true, referenceDomains: ["appcues.com", ""] }).map((c) => c.type)).toEqual(["keyword_page"]);
  });
});
