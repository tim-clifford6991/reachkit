// SPEC §7 (2026-09-20, #928) — the net-new rule, both arms.
//
// "A planned page that overlaps one of them becomes an **update** of that
// page where the destination can publish to it; otherwise the topic is
// skipped and the existing page is linked from related pages."
//
// #928's own done-when: "Connect a WordPress holding a post on the planned
// topic: the plan shows an update of that post, not a new page." That is
// the first case below, and it is asserted over the derivation's own gate
// rather than over a screen — SPEC §7's three layers put the decision at
// derivation, and `readiness.ts` stores the other arm.
//
// Pure: candidates in, candidates out, with the two answers the rule needs
// handed in as functions.
import "../opportunities/env";
import { describe, expect, it } from "vitest";
import { applyKnownContent } from "@/lib/opportunities/derive/known";
import type { Candidate } from "@/lib/opportunities/derive/candidate";
import { eligible, type ReadinessContext } from "@/lib/opportunities/readiness";
import type { KnownMatch, KnownPage } from "@/lib/known-content/types";
import type { Opportunity } from "@/lib/opportunities/types";
import { measured } from "@/lib/measure/measured";

const AT = new Date("2026-09-21T09:00:00.000Z");
const THEIR_POST = "https://acme.example/blog/pricing-a-retainer";

function knownPage(over: Partial<KnownPage> = {}): KnownPage {
  return {
    source: "wordpress",
    ref: "42",
    url: THEIR_POST,
    title: "How to price a retainer",
    headings: [],
    live: true,
    publishedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...over,
  };
}

/** A Write candidate for the search their post already answers. */
function writeCandidate(over: Partial<Candidate> = {}): Candidate {
  return {
    siteId: "site-1",
    scanId: "scan-1",
    type: "answer_page",
    family: "write",
    targetQuery: "how to price a retainer",
    targetRef: "how-to-price-a-retainer",
    title: "How to price a retainer",
    volume: measured(140, AT),
    evidence: {
      family: "write",
      query: "how to price a retainer",
      volume: measured(140, AT),
      // The rival whose page the search found instead — copied at creation,
      // as every figure on a row is.
      rival: {
        domain: "rival.example",
        url: measured("https://rival.example/retainers", AT),
        position: measured(3, AT),
      },
    },
    acceptance: { form: "top20", query: "how to price a retainer" },
    fitBand: "winnable",
    effort: 0.5,
    ...over,
  };
}

const match: KnownMatch = { page: knownPage(), score: 1 };

describe("#928 — a topic their own blog already covers becomes an update of that post", () => {
  it("the plan holds an update of the post, not a second page about it", () => {
    const [planned] = applyKnownContent([writeCandidate()], {
      covered: () => match,
      canUpdate: () => true, // WordPress updates any page of the site.
      at: AT,
    });

    expect(planned?.family).toBe("improve");
    expect(planned?.type).toBe("refresh_page");
    // The update targets *their* post, at its own address.
    expect(planned?.targetRef).toBe(THEIR_POST);
    // And it carries what matched them, rather than a measurement nobody took.
    expect(planned?.evidence).toMatchObject({
      family: "improve",
      pageUrl: THEIR_POST,
      shortfall: {
        kind: "covered",
        page: { url: THEIR_POST, title: "How to price a retainer", source: "wordpress" },
        similarity: { kind: "measured", value: 1, at: AT },
      },
    });
    // The search it targets, its volume and its acceptance test are the
    // ones the pass measured: what changed is which page answers it.
    expect(planned?.targetQuery).toBe("how to price a retainer");
    expect(planned?.volume).toEqual(measured(140, AT));
    expect(planned?.acceptance).toEqual({ form: "top20", query: "how to price a retainer" });
  });

  it("a topic nothing covers is left exactly as it was", () => {
    const candidate = writeCandidate();
    const [planned] = applyKnownContent([candidate], {
      covered: () => null,
      canUpdate: () => true,
      at: AT,
    });
    expect(planned).toBe(candidate);
  });

  it("a destination that cannot publish to the covering page leaves the candidate alone", () => {
    // A hosted-only site: ReachKit publishes to its own host and cannot
    // rewrite a post on the customer's WordPress.
    const [planned] = applyKnownContent([writeCandidate()], {
      covered: () => match,
      canUpdate: () => false,
      at: AT,
    });
    expect(planned?.family).toBe("write");
    expect(planned?.type).toBe("answer_page");
  });

  it("#1181 — a page younger than 30 days is not refreshed; the candidate stays and is stored covered", () => {
    const young = { page: knownPage({ source: "reachkit", publishedAt: new Date("2026-09-15T00:00:00.000Z") }), score: 1 };
    const writing = { page: knownPage({ source: "reachkit", live: false, publishedAt: null }), score: 1 };
    for (const covering of [young, writing]) {
      const [planned] = applyKnownContent([writeCandidate()], { covered: () => covering, canUpdate: () => true, at: AT });
      expect(planned?.family).toBe("write");
    }
  });

  it("an Improve row is never re-pointed at another page — it is already an update", () => {
    const improve = writeCandidate({
      family: "improve",
      type: "expand_page",
      targetRef: "https://acme.example/pricing",
    });
    const [planned] = applyKnownContent([improve], {
      covered: () => match,
      canUpdate: () => true,
      at: AT,
    });
    expect(planned?.targetRef).toBe("https://acme.example/pricing");
  });
});

describe("#928 — a topic that cannot become an update never fills a day", () => {
  const context = (over: Partial<ReadinessContext> = {}): ReadinessContext => ({
    now: AT,
    grounded: true,
    earnGrounding: { comparison_table: true, integration_page: true, original_data_page: true },
    suppression: { clusters: new Set(), retiredUrls: new Set() },
    profile: null,
    ownRanks: () => false,
    canUpdate: () => true,
    coveredBy: () => null,
    ...over,
  });

  function row(over: Partial<Opportunity> = {}): Opportunity {
    return {
      ...(writeCandidate() as unknown as Opportunity),
      id: "opp-1",
      status: "open",
      clusterKey: null,
      absorbedQueries: [],
      ready: false,
      unreadyReason: "not_assessed",
      createdAt: AT,
      ...over,
    };
  }

  it("the row is stored unready, naming the reason", () => {
    expect(eligible(row(), context({ coveredBy: () => match }))).toBe("destination_cannot_address");
  });

  it("a row nothing covers passes the same gate", () => {
    expect(eligible(row(), context())).toBeNull();
  });

  it("the update itself is exempt: an Improve row's covering page is its own", () => {
    const update = row({ family: "improve", type: "refresh_page", targetRef: THEIR_POST });
    expect(eligible(update, context({ coveredBy: () => match }))).toBeNull();
  });

  it("the destination's own refusal still speaks first — a page it cannot address is that, not a repeat", () => {
    const update = row({ family: "improve", type: "refresh_page", targetRef: THEIR_POST });
    expect(
      eligible(update, context({ canUpdate: () => false, coveredBy: () => match }))
    ).toBe("destination_cannot_address");
  });
});
