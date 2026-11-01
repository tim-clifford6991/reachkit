// SPEC §6 (owner, 2026-09-15), issue 474 — clusters by parent topic, one
// survivor per cluster, Improve before Earn before Write, and a day filled
// only by a row that passed readiness.
import "./env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KEYWORD_PAGE_MIN_VOLUME } from "../../src/lib/config/constants";
import { measured } from "../../src/lib/measure/measured";
import { clusterKey, collapse } from "../../src/lib/opportunities/cluster";
import { canonicalUrl } from "../../src/lib/measure/page-reading";
import type { Candidate } from "../../src/lib/opportunities/derive/candidate";
import { eligible, type ReadinessContext } from "../../src/lib/opportunities/readiness";
import { rankOpen } from "../../src/lib/opportunities/rank/open";
import { setOpportunityStore, type OpportunityRow } from "../../src/lib/opportunities/store";
import { restTopic } from "../../src/lib/opportunities/drafted";
import { supplyDepth } from "../../src/lib/opportunities/plan";
import { assessReadiness, canUpdateFrom, ownRanksFrom } from "../../src/lib/opportunities/readiness";
import type { SerpResult } from "../../src/lib/vendors/dataforseo/types";
import type { CanonicalDomain } from "../../src/lib/scan/domain";
import { UNREADY_REASONS, type Opportunity, type UnreadyReason } from "../../src/lib/opportunities/types";
import type { KnownMatch } from "../../src/lib/known-content/types";
import { memoryStore, newMemoryState, type MemoryState } from "./memory-store";
import { AT, PROFILE, SITE_ID, question, reportOf, search, serp } from "./fixtures";

const BRANDS = ["acme", "appcues"];

describe("clusterKey — the query's content words, one key per parent topic", () => {
  it("drops stop words, brand tokens and a trailing plural, and ignores word order", () => {
    expect(clusterKey("best onboarding tools for SaaS", BRANDS)).toBe("best onboarding saa tool");
    expect(clusterKey("SaaS onboarding tool — best", BRANDS)).toBe(clusterKey("best onboarding tools for SaaS", BRANDS));
    expect(clusterKey("appcues vs acme onboarding", BRANDS)).toBe("onboarding vs");
  });

  it("keeps the brand where only a shape is left: one rival's alternatives are not another's (issue 1134)", () => {
    expect(clusterKey("appcues alternatives", BRANDS)).toBe("alternative appcue");
    expect(clusterKey("appcues alternatives", BRANDS)).not.toBe(clusterKey("userpilot alternatives", [...BRANDS, "userpilot"]));
  });

  it("has no key for no query, or for a query that is only brands and stop words", () => {
    expect(clusterKey(null, BRANDS)).toBeNull();
    expect(clusterKey("the acme", BRANDS)).toBeNull();
  });

  it("canonicalUrl is one form for scheme, www, fragment and trailing slash, and keeps a query string", () => {
    expect(canonicalUrl("https://www.Example.com/guide/#top")).toBe(canonicalUrl("http://example.com/guide"));
    expect(canonicalUrl("https://example.com/guide?page=2")).not.toBe(canonicalUrl("https://example.com/guide"));
  });
});

function candidate(over: Partial<Candidate> & Pick<Candidate, "type" | "family" | "targetQuery">): Candidate {
  return {
    siteId: SITE_ID,
    scanId: "scan",
    targetRef: over.targetQuery ?? "ref",
    title: null,
    volume: measured(100, AT),
    evidence: { family: "write" } as Candidate["evidence"],
    acceptance: { form: "top20", query: over.targetQuery ?? "" },
    fitBand: "winnable",
    effort: 0.3,
    ...over,
  };
}

function held(over: Partial<Opportunity> & Pick<Opportunity, "id" | "type" | "family" | "targetQuery">): Opportunity {
  return {
    ...candidate(over),
    status: "open",
    clusterKey: null,
    absorbedQueries: [],
    ready: false,
    unreadyReason: "not_assessed",
    createdAt: AT,
    ...over,
  } as Opportunity;
}

describe("collapse — one survivor per cluster, over held rows and new candidates", () => {
  it("an Improve of an owned URL beats a held Write on the same topic: the Write is dismissed and its search absorbed", () => {
    const plan = collapse({
      existing: [held({ id: "w1", type: "keyword_page", family: "write", targetQuery: "onboarding checklist" })],
      candidates: [candidate({ type: "expand_page", family: "improve", targetQuery: "onboarding checklists", targetRef: "https://example.com/guide" })],
      brandTokens: BRANDS,
    });
    expect(plan.dismiss).toEqual(["w1"]);
    expect(plan.insert.map((c) => [c.family, c.clusterKey, c.absorbedQueries])).toEqual([
      ["improve", "checklist onboarding", ["onboarding checklist"]],
    ]);
  });

  it("issue 1549 — a search a held row already absorbed folds into that row rather than standing as a second topic", () => {
    const plan = collapse({
      existing: [
        held({
          id: "parent",
          type: "listed_page",
          family: "write",
          targetQuery: "best answer engine optimization tools",
          absorbedQueries: ["best generative engine optimization tools"],
        }),
      ],
      candidates: [candidate({ type: "listed_page", family: "write", targetQuery: "best generative engine optimization tools" })],
      brandTokens: BRANDS,
    });
    expect(plan.insert).toEqual([]);
    expect(plan.dismiss).toEqual([]);
  });

  it("issue 1549 — a low-fit row never swallows a search the business fits into its cluster", () => {
    const plan = collapse({
      existing: [held({ id: "low", type: "keyword_page", family: "write", targetQuery: "meltwater cost", businessFit: 1 })],
      candidates: [candidate({ type: "keyword_page", family: "write", targetQuery: "answer engine optimization pricing", businessFit: 3 })],
      brandTokens: BRANDS,
      sameQuestion: new Map([["answer engine optimization pricing", "meltwater cost"]]),
    });
    expect(plan.dismiss).toEqual(["low"]);
    expect(plan.insert.map((c) => c.targetQuery)).toEqual(["answer engine optimization pricing"]);
  });

  it("a queued row is never dismissed, whatever outranks it; the candidate folds into it", () => {
    const plan = collapse({
      existing: [held({ id: "q1", type: "keyword_page", family: "write", targetQuery: "onboarding checklist", status: "queued" })],
      candidates: [candidate({ type: "expand_page", family: "improve", targetQuery: "onboarding checklist" })],
      brandTokens: BRANDS,
    });
    expect(plan).toEqual({ dismiss: [], insert: [], update: [{ id: "q1", clusterKey: "checklist onboarding", absorbedQueries: [] }] });
  });

  it("issue 881 — a right-sized candidate takes the place of a held outsized row on the same topic", () => {
    // The stale-evidence half of the dogfood: the six rows on file were
    // derived before right-sizing shipped and carry `not-yet`. Held-row-wins
    // let one of them survive its cluster, so the pass's own right-sized
    // candidate for the same topic was never written — the old competing
    // with the new, and winning.
    const plan = collapse({
      existing: [
        held({
          id: "stale",
          type: "keyword_page",
          family: "write",
          targetQuery: "best seo software",
          fitBand: "not-yet",
        }),
      ],
      candidates: [
        candidate({
          type: "keyword_page",
          family: "write",
          targetQuery: "seo software best",
          fitBand: "winnable",
        }),
      ],
      brandTokens: BRANDS,
    });

    expect(plan.dismiss).toEqual(["stale"]);
    expect(plan.insert.map((c) => [c.targetQuery, c.fitBand])).toEqual([["seo software best", "winnable"]]);
  });

  it("issue 881 — an outsized candidate never displaces a right-sized row already held", () => {
    const plan = collapse({
      existing: [
        held({
          id: "fit",
          type: "keyword_page",
          family: "write",
          targetQuery: "seo content brief template",
          fitBand: "winnable",
        }),
      ],
      candidates: [
        candidate({
          type: "answer_page",
          family: "write",
          targetQuery: "seo content brief templates",
          fitBand: "not-yet",
        }),
      ],
      brandTokens: BRANDS,
    });

    expect(plan.dismiss).toEqual([]);
    expect(plan.insert).toEqual([]);
  });

  it("issue 881 — a queued row still survives, outsized or not: its page is already being written", () => {
    const plan = collapse({
      existing: [
        held({
          id: "q1",
          type: "keyword_page",
          family: "write",
          targetQuery: "best seo software",
          fitBand: "not-yet",
          status: "queued",
        }),
      ],
      candidates: [
        candidate({ type: "keyword_page", family: "write", targetQuery: "seo software best", fitBand: "winnable" }),
      ],
      brandTokens: BRANDS,
    });

    expect(plan.dismiss).toEqual([]);
    expect(plan.insert).toEqual([]);
  });

  it("among Write candidates the owner's type order decides, and a re-derivation of the held row moves nothing", () => {
    const plan = collapse({
      existing: [],
      candidates: [
        candidate({ type: "keyword_page", family: "write", targetQuery: "onboarding tools" }),
        candidate({ type: "answer_page", family: "write", targetQuery: "best onboarding tool", volume: measured(10, AT) }),
        candidate({ type: "comparison_page", family: "write", targetQuery: "onboarding tool best" }),
      ],
      brandTokens: BRANDS,
    });
    expect(plan.insert.map((c) => c.type)).toEqual(["keyword_page", "answer_page"]);
    expect(plan.insert[1]?.absorbedQueries).toEqual(["onboarding tool best"]);

    const again = collapse({
      existing: [held({ id: "a1", type: "answer_page", family: "write", targetQuery: "best onboarding tool", clusterKey: "best onboarding tool", absorbedQueries: ["onboarding tool best"] })],
      candidates: [candidate({ type: "answer_page", family: "write", targetQuery: "best onboarding tool" })],
      brandTokens: BRANDS,
    });
    expect(again).toEqual({ dismiss: [], update: [], insert: [] });
  });

  describe("#1131 — one URL per question", () => {
    const page = (n: number) => `example.org/page-${n}`;
    const tens = new Map<string, readonly string[]>([
      ["best seo software", [1, 2, 3, 4, 5, 6].map(page)],
      ["what is the best seo software", [1, 2, 3, 4, 7, 8].map(page)],
      ["best seo software for small business", [1, 2, 3, 9, 10].map(page)],
    ]);

    it("a search whose top ten shares four addresses with a held page folds into it; three shared stays its own topic", () => {
      const plan = collapse({
        existing: [held({ id: "live", type: "answer_page", family: "write", targetQuery: "best seo software", status: "queued" })],
        candidates: [
          candidate({ type: "keyword_page", family: "write", targetQuery: "what is the best seo software" }),
          candidate({ type: "keyword_page", family: "write", targetQuery: "best seo software for small business" }),
        ],
        brandTokens: BRANDS,
        topTens: tens,
      });
      expect(plan.insert.map((c) => c.targetQuery)).toEqual(["best seo software for small business"]);
      expect(plan.update).toEqual([{ id: "live", clusterKey: "best seo software", absorbedQueries: ["what is the best seo software"] }]);
    });

    it("the stored same-question judgement joins two searches no top ten links", () => {
      const plan = collapse({
        existing: [held({ id: "open", type: "answer_page", family: "write", targetQuery: "best seo software" })],
        candidates: [candidate({ type: "keyword_page", family: "write", targetQuery: "top rated seo tools" })],
        brandTokens: BRANDS,
        sameQuestion: new Map([["top rated seo tools", "best seo software"]]),
      });
      expect(plan.insert).toEqual([]);
      expect(plan.update).toEqual([{ id: "open", clusterKey: "best seo software", absorbedQueries: ["top rated seo tools"] }]);
    });
  });
});

const CTX: ReadinessContext = {
  now: AT,
  grounded: true,
  earnGrounding: { comparison_table: true, integration_page: true, original_data_page: true },
  suppression: { clusters: new Set(), retiredUrls: new Set() },
  profile: PROFILE,
  ownRanks: () => false,
  canUpdate: () => true,
  // #928: nothing this site already has covers these topics. The rule's
  // own arms are `tests/known-content/`'s.
  coveredBy: () => null,
};

describe("eligible — the one predicate", () => {
  const keyword = (over: Partial<Opportunity> = {}) =>
    held({ id: "k", type: "keyword_page", family: "write", targetQuery: "best user onboarding software", ...over });

  it("a keyword page passes only with every gate: volume, winnable, commercial intent, no owned URL ranking", () => {
    expect(eligible(keyword(), CTX)).toBeNull();
    expect(eligible(keyword({ volume: measured(KEYWORD_PAGE_MIN_VOLUME - 1, AT) }), CTX)).toBe("no_intent");
    expect(eligible(keyword({ fitBand: "reach" }), CTX)).toBe("no_intent");
    expect(eligible(keyword({ targetQuery: "what is user onboarding" }), CTX)).toBe("no_intent");
    expect(eligible(keyword(), { ...CTX, ownRanks: () => true })).toBe("no_intent");
    expect(eligible(keyword(), { ...CTX, profile: null })).toBe("no_intent");
  });

  it("issue 884 — an outsized target is stored unready with its own reason, for every type that takes a day", () => {
    // The right-sizing law used to be read at ranking time for every type
    // while only the keyword gate carried it here, so a row could be stored
    // `ready: true` and still never fill a day.
    const outsized = (type: Opportunity["type"], family: Opportunity["family"], over: Partial<Opportunity> = {}) =>
      held({
        id: `o-${type}`,
        type,
        family,
        targetQuery: "best seo software",
        fitBand: "not-yet",
        ...over,
      });

    expect(eligible(outsized("answer_page", "write"), CTX)).toBe("outsized");
    expect(eligible(outsized("comparison_page", "write"), CTX)).toBe("outsized");
    expect(eligible(outsized("format_page", "write", { targetQuery: "seo tool comparison" }), CTX)).toBe("outsized");
    expect(eligible(outsized("listed_page", "earn"), CTX)).toBe("outsized");
    expect(eligible(outsized("answerable_page", "improve"), CTX)).toBe("outsized");
    // A `keyword_page` keeps its own tighter gate, which speaks first.
    expect(eligible(outsized("keyword_page", "write"), CTX)).toBe("no_intent");
    // And the two bands that qualify are not refused by the shared rule.
    expect(eligible(held({ id: "r", type: "answer_page", family: "write", targetQuery: "best seo software", fitBand: "reach" }), CTX)).toBeNull();
  });

  it("a format page passes only for comparison / vs / alternative / integration / template", () => {
    const format = (q: string) => held({ id: "f", type: "format_page", family: "write", targetQuery: q });
    for (const q of ["appcues vs userpilot", "userpilot alternatives", "slack integration", "onboarding email templates", "onboarding tool comparison"]) {
      expect(eligible(format(q), CTX), q).toBeNull();
    }
    expect(eligible(format("onboarding glossary"), CTX)).toBe("no_intent");
  });

  it("with no grounding fact every Write, Earn and Improve row is no_grounding_fact", () => {
    for (const [family, type] of [["write", "answer_page"], ["improve", "expand_page"], ["earn", "listed_page"]] as const) {
      expect(eligible(held({ id: family, type, family, targetQuery: "best onboarding tool" }), { ...CTX, grounded: false })).toBe("no_grounding_fact");
    }
  });
});

describe("eligible answers one of six reasons, each absorbing the gates it names (owner ruling C6)", () => {
  const answer = (over: Partial<Opportunity> = {}) => held({ id: "a", type: "answer_page", family: "write", targetQuery: "what is a product tour", ...over });
  const covering = { page: { url: "https://example.com/product-tours" }, score: 1 } as unknown as KnownMatch;
  const SOON = new Date(AT.getTime() + 86_400_000);
  // Old handle → the reason that now holds the same row, with the row and context that made the old one.
  const MERGED: readonly [old: string, merged: UnreadyReason, row: Opportunity, ctx: ReadinessContext][] = [
    ["resting", "resting", answer({ restUntil: SOON }), CTX],
    ["cluster_suppressed", "resting", answer({ clusterKey: "tours" }), { ...CTX, suppression: { clusters: new Set(["tours"]), retiredUrls: new Set() } }],
    ["url_retired", "resting", answer({ targetRef: "https://example.com/tours" }), { ...CTX, suppression: { clusters: new Set(), retiredUrls: new Set([canonicalUrl("https://example.com/tours")]) } }],
    ["destination_cannot_address", "destination_cannot_address", held({ id: "i", type: "expand_page", family: "improve", targetQuery: "product tours" }), { ...CTX, canUpdate: () => false }],
    ["already_covered", "destination_cannot_address", answer(), { ...CTX, coveredBy: () => covering }],
    ["low_fit", "low_fit", answer({ businessFit: 1 }), CTX],
    ["no_grounding_fact", "no_grounding_fact", answer(), { ...CTX, grounded: false }],
    ["keyword_gate", "no_intent", held({ id: "k", type: "keyword_page", family: "write", targetQuery: "what is user onboarding" }), CTX],
    ["format_not_allowed", "no_intent", held({ id: "f", type: "format_page", family: "write", targetQuery: "onboarding glossary" }), CTX],
    ["no_intent", "no_intent", answer({ volume: null }), { ...CTX, prompts: [{ id: "p", text: "Which invoicing apps suit a freelancer?" }] }],
    ["outsized", "outsized", answer({ fitBand: "not-yet" }), CTX],
  ];

  it.each(MERGED)("%s → %s", (_old, merged, row, ctx) => {
    expect(eligible(row, ctx)).toBe(merged);
  });

  it("the six are every reason but the unassessed state", () => {
    expect(new Set(MERGED.map(([, merged]) => merged))).toEqual(new Set(UNREADY_REASONS.filter((reason) => reason !== "not_assessed")));
    expect(UNREADY_REASONS).toHaveLength(7);
  });
});

describe("issue 781 — an Improve is ready only where the site's destination can deliver the update", () => {
  const improve = (targetRef: string) =>
    held({ id: "i", type: "answerable_page", family: "improve", targetQuery: "user onboarding checklist", targetRef });
  const hosted = canUpdateFrom({ host: "blog.example.com", slugs: ["onboarding-checklist"] });

  it("a hosted destination updates only ReachKit's own live publication on its host", () => {
    expect(eligible(improve("https://blog.example.com/onboarding-checklist/"), { ...CTX, canUpdate: hosted })).toBeNull();
    for (const url of [
      "https://example.com/onboarding-checklist",
      "https://blog.example.com/never-published",
      "https://blog.example.com/",
      "https://blog.example.com/guides/onboarding-checklist",
    ]) {
      expect(eligible(improve(url), { ...CTX, canUpdate: hosted }), url).toBe("destination_cannot_address");
    }
  });

  it("any other destination keeps its updates, and a Write is never asked", () => {
    expect(eligible(improve("https://example.com/pricing"), { ...CTX, canUpdate: canUpdateFrom(null) })).toBeNull();
    const write = held({ id: "w", type: "answer_page", family: "write", targetQuery: "what is a product tour" });
    expect(eligible(write, { ...CTX, canUpdate: () => false })).toBeNull();
  });
});

describe("supply and next-work see only ready rows, in Improve > Earn > Write order", () => {
  let state: MemoryState;
  let n = 0;
  const row = (over: Partial<OpportunityRow> & Pick<OpportunityRow, "family" | "type" | "target_query">): OpportunityRow => {
    n += 1;
    return {
      id: `r${n}`, site_id: SITE_ID, scan_id: "scan", target_ref: `ref-${n}`, proposed_slug: null, title: null,
      volume: 500, evidence: { family: over.family, volume: { kind: "measured", value: 500, at: AT.toISOString() } },
      acceptance: { form: "top20", query: over.target_query }, fit_band: "winnable", effort: 0.3, status: "open",
      cluster_key: null, absorbed_queries: [], ready: false, unready_reason: "not_assessed", created_at: AT.toISOString(),
      ...over,
    };
  };

  beforeEach(() => {
    state = newMemoryState({ profile: PROFILE });
    setOpportunityStore(memoryStore(state));
  });
  afterEach(() => setOpportunityStore(null));

  it("orders by points, a tie by volume, age and id, and leaves unready rows out", async () => {
    state.rows.push(
      row({ id: "keyword", family: "write", type: "keyword_page", target_query: "user onboarding software for startups", volume: 9000 }),
      row({ id: "answer", family: "write", type: "answer_page", target_query: "what is a product tour" }),
      row({ id: "improve", family: "improve", type: "expand_page", target_query: "user onboarding checklist", volume: 20 }),
      row({ id: "glossary", family: "write", type: "format_page", target_query: "onboarding glossary" })
    );
    await assessReadiness(SITE_ID, { at: AT });
    expect((await rankOpen(SITE_ID)).map((r) => r.opportunityId)).toEqual(["answer", "improve", "keyword"]);
    expect((await supplyDepth(SITE_ID)).unused).toBe(3);
  });

  it("a rested topic is not a day of supply until its 28 days are over, then ranks again (D26)", async () => {
    state.rows.push(
      row({ id: "rested", family: "write", type: "answer_page", target_query: "what is a product tour", status: "queued" }),
      row({ id: "improve", family: "improve", type: "expand_page", target_query: "user onboarding checklist", volume: 20 })
    );
    await restTopic("rested", AT);
    const day = 86_400_000;
    await assessReadiness(SITE_ID, { at: AT, now: new Date(AT.getTime() + 27 * day) });
    expect(state.rows[0]).toMatchObject({ status: "open", ready: false, unready_reason: "resting" });
    expect((await rankOpen(SITE_ID)).map((r) => r.opportunityId)).toEqual(["improve"]);

    await assessReadiness(SITE_ID, { at: AT, now: new Date(AT.getTime() + 28 * day) });
    expect((await rankOpen(SITE_ID)).map((r) => r.opportunityId)).toEqual(["improve", "rested"]);
  });

  it("a site whose pages ground no fact has zero supply", async () => {
    state.grounded = false;
    state.rows.push(row({ id: "answer", family: "write", type: "answer_page", target_query: "what is a product tour" }));
    await assessReadiness(SITE_ID, { at: AT });
    expect(state.rows[0]!.unready_reason).toBe("no_grounding_fact");
    expect(await rankOpen(SITE_ID)).toEqual([]);
    expect((await supplyDepth(SITE_ID)).unused).toBe(0);
  });
});

describe("a search counts as one an owned URL ranks for only on a row read as the customer's", () => {
  const stored = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../market/rivals/fixtures/au-baker-d149c119.json"), "utf8")) as { organic: SerpResult["organic"] };
  const ranksOn = (organic: SerpResult["organic"], domain: string) =>
    ownRanksFrom({ ...reportOf({ questions: [question({ search: search({ keyword: "baker" }) })], serps: [serp({ organic })] }), domain: domain as CanonicalDomain })("baker");
  const bakersDelight = { position: 2, domain: "google.com", url: "https://google.com/goto?url=https://www.bakersdelight.com.au/", title: "Bakers Delight" };

  it("the AU baker top ten (d149c119) with the customer behind the redirect: baker is ranked", () => {
    expect(ranksOn([...stored.organic.slice(0, 1), bakersDelight, ...stored.organic.slice(2)], "bakersdelight.com.au")).toBe(true);
  });

  it("stored AU baker top ten (d149c119): neither ranked from an unresolved row, nor for google.com", () => {
    expect(ranksOn(stored.organic, "bakersdelight.com.au")).toBe(false);
    expect(ranksOn(stored.organic, "google.com")).toBe(false);
  });
});
