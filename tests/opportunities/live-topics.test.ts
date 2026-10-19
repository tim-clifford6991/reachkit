// SPEC §7 (issue 1506, as the SEO master review of 2026-10-18 amended it) —
// the hourly recheck reads each live page the customer has not edited
// against the topic rules at 0¢. A failing page waits for a planned
// retarget, is retargeted to a ready topic in its cluster, or is withdrawn
// only where nothing says it is worth keeping. reachkit.app's live pages of
// 18 October are the stored-row fixtures: A and B are the dry report's, and
// D53 keeps both.
import "./env";
import { describe, expect, it } from "vitest";
import type { MarketConclusion } from "../../src/lib/market/infer/types";
import { comparisonBrands } from "../../src/lib/opportunities/derive/topics";
import type { TopTenRow } from "../../src/lib/opportunities/derive/top-ten-kind";
import {
  liveAddressesOf,
  liveTopicVerdict,
  rankedWithin,
  retireOffTopicPages,
  type LiveTopicDeps,
  type LiveTopicPage,
  type LiveTopicSite,
} from "../../src/lib/opportunities/live-topics";
import { readOpportunity, type OpportunityRow } from "../../src/lib/opportunities/store";
import type { Opportunity } from "../../src/lib/opportunities/types";
import { measured } from "../../src/lib/measure/measured";
import stored from "./fixtures/live-topics-1506.json";

const NOW = new Date("2026-10-18T12:00:00.000Z");
/** Four months on: every page is past 90 days. */
const LATER = new Date("2027-02-18T12:00:00.000Z");
const market = stored.market as unknown as MarketConclusion;

const pages: LiveTopicPage[] = stored.pages.map((page) => ({
  draftId: page.draft_id,
  publicationId: page.publication_id,
  hosted: page.destination === "hosted",
  liveUrl: page.live_url,
  opportunity: readOpportunity(page.row as unknown as OpportunityRow),
  signals: {
    firstLive: new Date(page.signals.published_at),
    publishedAt: new Date(page.signals.published_at),
    verdicts: page.signals.verdicts,
    ranked: false,
    reads: page.signals.reads,
  },
}));
const page = (name: string) => pages[stored.pages.findIndex((held) => held.name === name)]!;
const named = (live: LiveTopicPage) => stored.pages[pages.indexOf(live)]?.name ?? live.liveUrl;

function site(over: Partial<LiveTopicSite> = {}): LiveTopicSite {
  const topTens = stored.topTens as Record<string, TopTenRow[]>;
  return {
    domain: stored.domain,
    brands: { ...comparisonBrands({ report: null, market }), own: stored.own },
    prompts: stored.prompts,
    asked: [],
    business: { kind: market.kind ?? null, serves: null },
    topTen: (query) => topTens[query.trim().toLowerCase()] ?? null,
    open: stored.open.map((row) => readOpportunity(row as unknown as OpportunityRow)),
    pages,
    ...over,
  };
}

/** Page B as it would be on the site's own host, which the weekly
 *  measurement reads, with `signals` over its stored ones. */
function measuredB(signals: Partial<LiveTopicPage["signals"]> = {}): LiveTopicPage {
  const b = page("B");
  return { ...b, liveUrl: "https://reachkit.app/blog/reachkit-vs-aeo-engine", signals: { ...b.signals, ...signals } };
}

/** A ready topic the site holds, in the cluster of `of`. */
function readyTopic(of: LiveTopicPage, query: string): Opportunity {
  return { ...of.opportunity, id: `ready-${query}`, status: "open", ready: true, targetQuery: query, family: "write", type: "answer_page" };
}

describe("the dry report on the stored rows of 18 October: A and B follow D53", () => {
  it("A waits on its open D53 retarget, which #1487 moves; B is too young to judge and stays; C and D keep", async () => {
    expect(pages.map((live) => [named(live), liveTopicVerdict(live, site(), NOW)])).toEqual([
      ["A", { kind: "moving", failure: { rule: "other_kind", kind: "agency" } }],
      ["B", { kind: "waits", failure: { rule: "no_demand" } }],
      ["C", { kind: "keeps" }],
      ["D", { kind: "keeps" }],
    ]);
    const acted: string[] = [];
    const deps: LiveTopicDeps = {
      sites: async () => [site()],
      retarget: async () => (acted.push("retarget"), true),
      refresh: async () => (acted.push("refresh"), true),
      withdraw: async () => (acted.push("withdraw"), true),
      merge: async () => (acted.push("merge"), true),
    };
    const report = await retireOffTopicPages({ now: NOW, deps, dry: true });
    expect(report.failed).toEqual([
      { liveUrl: page("A").liveUrl, verdict: "moving", rule: "other_kind" },
      { liveUrl: page("B").liveUrl, verdict: "waits", rule: "no_demand" },
    ]);
    expect(acted).toEqual([]);
  });

  it("past 90 days B is still never withdrawn on the content host, which the weekly measurement may not see (#316): it is kept and refreshed", () => {
    expect(liveTopicVerdict(page("B"), site(), LATER)).toEqual({ kind: "refresh", failure: { rule: "no_demand" }, signals: ["host_unmeasured"] });
  });
});

describe("B stays until a comparison replaces it, then 301s to it (owner, 2026-10-18)", () => {
  /** A live comparison of the business with a rival people search for, in
   *  B's cluster: the comparison D53 meant (D50). */
  const comparison: LiveTopicPage = {
    ...page("B"),
    draftId: "comparison",
    publicationId: "comparison-publication",
    liveUrl: "https://content.reachkit.app/reachkit-vs-profound",
    // Searched, so it passes the topic rules (issue 1520: a prompt naming
    // the rival is no longer demand on its own).
    opportunity: { ...page("B").opportunity, id: "comparison-row", targetQuery: "reachkit vs profound", volume: measured(90, NOW) },
  };

  it("with the comparison live, B is merged into it the day it fails, young or not, hosted or not measured", async () => {
    const both = site({ pages: [page("B"), comparison] });
    expect(liveTopicVerdict(page("B"), both, NOW)).toEqual({ kind: "redirect", failure: { rule: "no_demand" }, into: comparison.liveUrl, why: "replaced" });
    const merged: [string, string][] = [];
    const outcome = await retireOffTopicPages({
      now: NOW,
      deps: {
        sites: async () => [both],
        retarget: async () => true,
        refresh: async () => true,
        withdraw: async () => true,
        merge: async (from, into) => (merged.push([from.liveUrl, into.publicationId]), true),
      },
    });
    expect(merged).toEqual([[page("B").liveUrl, "comparison-publication"]]);
    expect(outcome.merged).toEqual([{ liveUrl: page("B").liveUrl, into: comparison.liveUrl }]);
    expect(outcome.withdrawn).toEqual([]);
  });

  it("on the customer's own host there is no 301 of ours: the page stays live and is reported", async () => {
    const own = { ...page("B"), hosted: false };
    const merged: string[] = [];
    const outcome = await retireOffTopicPages({
      now: NOW,
      deps: {
        sites: async () => [site({ pages: [own, { ...comparison, hosted: false }] })],
        retarget: async () => true,
        refresh: async () => true,
        withdraw: async () => true,
        merge: async (from) => (merged.push(from.liveUrl), true),
      },
    });
    expect(merged).toEqual([]);
    expect(outcome.failed).toMatchObject([{ liveUrl: own.liveUrl, verdict: "redirect", why: "replaced" }]);
  });
});

describe("a page is withdrawn only where nothing says it is worth keeping", () => {
  const on = (b: LiveTopicPage) => site({ pages: [b] });

  it("a page past 90 days, measured, with no verdict but too early, no read and no position, is withdrawn", () => {
    expect(liveTopicVerdict(measuredB(), on(measuredB()), LATER)).toEqual({ kind: "withdraw", failure: { rule: "no_demand" } });
  });

  it("one answer-engine read, a working verdict or a top-30 position keeps it, planned as a refresh", () => {
    expect(liveTopicVerdict(measuredB({ reads: 1 }), on(measuredB()), LATER)).toMatchObject({ kind: "refresh", signals: ["reads"] });
    expect(liveTopicVerdict(measuredB({ verdicts: ["too_early", "working"] }), on(measuredB()), LATER)).toMatchObject({ kind: "refresh", signals: ["working"] });
    expect(liveTopicVerdict(measuredB({ ranked: true }), on(measuredB()), LATER)).toMatchObject({ kind: "refresh", signals: ["ranked"] });
  });

  it("a page younger than 90 days waits while every verdict is too early; one judged already is not too young", () => {
    expect(liveTopicVerdict(measuredB(), on(measuredB()), NOW)).toMatchObject({ kind: "waits" });
    expect(liveTopicVerdict(measuredB({ verdicts: ["not_working"] }), on(measuredB()), NOW)).toMatchObject({ kind: "withdraw" });
  });

  it("another live page in its cluster that fails too is the 301 it would take, never a 410", () => {
    const sibling = { ...measuredB(), liveUrl: "https://reachkit.app/blog/reachkit-vs-maxaeo", opportunity: { ...page("B").opportunity, id: "maxaeo", targetQuery: "reachkit vs maxaeo" } };
    expect(liveTopicVerdict(measuredB(), site({ pages: [measuredB(), sibling] }), LATER)).toMatchObject({ kind: "redirect", into: sibling.liveUrl, why: "closest" });
  });
});

describe("a failing page with a ready topic in its cluster is retargeted, once per search", () => {
  it("the ready row becomes its retarget; where another live page already targets that search, it is merged into that page", () => {
    const to = readyTopic(page("B"), "reachkit alternatives");
    expect(liveTopicVerdict(page("B"), site({ open: [to] }), NOW)).toMatchObject({ kind: "retarget", to: { id: to.id } });
    // A topic in another cluster, or one not ready, is not its retarget.
    expect(liveTopicVerdict(page("B"), site({ open: [{ ...to, clusterKey: "other" }] }), NOW)).toMatchObject({ kind: "waits" });
    expect(liveTopicVerdict(page("B"), site({ open: [{ ...to, ready: false }] }), NOW)).toMatchObject({ kind: "waits" });
    const holder = { ...page("D"), opportunity: { ...page("D").opportunity, targetQuery: "ReachKit alternatives" } };
    expect(liveTopicVerdict(page("B"), site({ open: [to], pages: [page("B"), holder] }), NOW)).toMatchObject({ kind: "redirect", into: holder.liveUrl, why: "same_search" });
  });
});

describe("the hourly run acts through unpublish and the refresh path, never a row edit", () => {
  it("withdraws every live version at the address, and reads a failed withdrawal again", async () => {
    const withdrawn: string[] = [];
    const b = { ...measuredB(), olderVersions: ["older-b"] };
    const outcome = await retireOffTopicPages({
      now: LATER,
      deps: {
        sites: async () => [site({ pages: [b], open: [] })],
        retarget: async () => true,
        refresh: async () => true,
        withdraw: async (draftId) => (withdrawn.push(draftId), draftId !== "older-b"),
        merge: async () => true,
      },
    });
    expect(withdrawn).toEqual([b.draftId, "older-b"]);
    expect(outcome.withdrawn).toEqual([]);
    expect(outcome.stillLive).toEqual([b.liveUrl]);
  });

  it("issue 1549 — a withdrawn page's topic is dismissed, never left queued", async () => {
    const dismissed: (readonly string[])[] = [];
    const b = { ...measuredB(), olderVersions: ["older-b"] };
    await retireOffTopicPages({
      now: LATER,
      deps: {
        sites: async () => [site({ pages: [b], open: [] })],
        retarget: async () => true,
        refresh: async () => true,
        withdraw: async () => true,
        merge: async () => true,
        dismiss: async (draftIds) => {
          dismissed.push(draftIds);
        },
      },
    });
    expect(dismissed).toEqual([[b.draftId, "older-b"]]);
  });

  it("a kept page is planned one refresh once its version is 30 days old, and none while one is open", async () => {
    const refreshed: string[] = [];
    const run = (open: Opportunity[], now: Date) =>
      retireOffTopicPages({
        now,
        deps: {
          sites: async () => [site({ pages: [measuredB({ reads: 2 })], open })],
          retarget: async () => true,
          refresh: async (live) => (refreshed.push(live.liveUrl), true),
          withdraw: async () => true,
          merge: async () => true,
        },
      });
    await run([], LATER);
    expect(refreshed).toEqual([measuredB().liveUrl]);
    const planned = { ...page("B").opportunity, id: "planned", family: "improve", type: "refresh_page", targetRef: measuredB().liveUrl } as Opportunity;
    await run([planned], LATER);
    expect(refreshed).toHaveLength(1);
  });
});

describe("what the run reads", () => {
  it("a page the customer edited is never read; an address is read at its newest version, the older ones beside it", () => {
    const live = (id: string, url: string, at: string, meta: Record<string, unknown> = {}) => ({
      id,
      draft_id: `draft-${id}`,
      destination: "hosted",
      live_url: url,
      published_at: at,
      site_id: "site",
      drafts: { meta, opportunities: stored.pages[0]!.row },
    });
    const read = liveAddressesOf(
      [
        live("a1", "https://content.example/a", "2026-10-03T07:00:00Z"),
        live("a2", "https://content.example/a", "2026-10-10T07:00:00Z"),
        live("b", "https://content.example/b", "2026-10-05T07:00:00Z", { first_edited_at: "2026-10-06T09:00:00Z" }),
      ],
      (row) => readOpportunity(row as OpportunityRow)
    );
    expect(read.map((address) => [address.liveUrl, address.versions.map((version) => version.id)])).toEqual([
      ["https://content.example/a", ["a2", "a1"]],
    ]);
  });

  it("a page its customer took down and put back is theirs and never read (issue 1532)", () => {
    const customer = { kind: "customer", userId: "u1" };
    const transitions = [
      { from: "published", to: "unpublished", actor: customer, reason: "take_down", at: "2026-10-12T09:00:00Z" },
      { from: "unpublished", to: "published", actor: customer, reason: "put_back", at: "2026-10-13T09:00:00Z" },
    ];
    const row = (id: string, url: string, moves: unknown[]) => ({
      id,
      draft_id: `draft-${id}`,
      destination: "hosted",
      live_url: url,
      published_at: "2026-10-03T07:00:00Z",
      site_id: "site",
      drafts: { meta: {}, transitions: moves, opportunities: stored.pages[0]!.row },
    });
    const read = liveAddressesOf(
      [row("a", "https://content.example/a", transitions), row("b", "https://content.example/b", [])],
      (stored) => readOpportunity(stored as OpportunityRow)
    );
    expect(read.map((address) => address.liveUrl)).toEqual(["https://content.example/b"]);
  });

  it("a stored ranked keyword keeps a page only within the top 30, at its own address", () => {
    const url = "https://reachkit.app/blog/x";
    expect(rankedWithin([{ url: "https://www.reachkit.app/blog/x/", position: 30 }], url)).toBe(true);
    expect(rankedWithin([{ url, position: 31 }], url)).toBe(false);
    expect(rankedWithin([{ url: "https://reachkit.app/blog/y", position: 3 }], url)).toBe(false);
  });
});
