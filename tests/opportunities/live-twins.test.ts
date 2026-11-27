// SPEC §6 *One URL per question*, §7 *Stop a live page*: two live hosted pages of one question merge into the one with
// more Google impressions, through the real re-check, move and state machine; only the database is doubled.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type Row } from "../publish/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("next/cache", () => ({ revalidateTag: () => undefined }));

import { choose } from "@/lib/opportunities/choose";
import { oneHead } from "@/lib/opportunities/cluster";
import { liveTopicVerdict, retireOffTopicPages, type LiveTopicPage, type LiveTopicSite } from "@/lib/opportunities/live-topics";
import { AT as PANEL_AT, panelSite, rowOf } from "../golden/plan/panel";
import type { Opportunity } from "@/lib/opportunities/types";

const AT = new Date(Date.UTC(2026, 10, 18, 7, 0, 0));
const HOST = "content.reachkit.app";
const A = `https://${HOST}/ai-search-visibility-pricing`;
const B = `https://${HOST}/ai-visibility-pricing`;
const VOLUME = { kind: "measured", value: 50, at: "2026-10-05T00:00:00.000Z" };
const read = (impressions: number, clicks = 1) => ({ at: "2026-11-16T05:00:00.000Z", google: { impressions, clicks, indexed: true, lastCrawl: null } });
const reason = (google: unknown) => ({ at: "2026-11-16T05:00:00.000Z", google });

function row(id: string, query: string): Row {
  return {
    id, site_id: "s1", scan_id: "scan-1", family: "write", type: "keyword_page", target_query: query, target_ref: null, proposed_slug: null,
    title: query, volume: VOLUME, evidence: { family: "write", query, volume: VOLUME }, acceptance: null, effort: 1, status: "queued",
    cluster_key: "pricing visibility", absorbed_queries: [], ready: true, created_at: "2026-10-05T00:00:00.000Z",
  };
}

function seed(bReading: unknown, aReading: unknown = read(120)): void {
  db.reset();
  installTransitionRpc(db);
  db.seed("sites", [{ id: "s1", domain: "reachkit.app", market: null }]);
  db.seed("destinations", [{ id: "dest-1", site_id: "s1", kind: "hosted", hostname: HOST, health: "ok", config: null, deleted_at: null }]);
  db.seed("opportunities", [row("oA", "ai search visibility pricing"), row("oB", "ai visibility pricing")]);
  const draft = { site_id: "s1", state: "published", transitions: [], meta: {}, body_md: "# Pricing" };
  db.seed("drafts", [{ ...draft, id: "dA", opportunity_id: "oA", title: "AI search visibility pricing" }, { ...draft, id: "dB", opportunity_id: "oB", title: "AI visibility pricing" }]);
  const live = { site_id: "s1", destination: "hosted", delivery_state: "delivered", unpublished_at: null };
  db.seed("publications", [
    { ...live, id: "pA", draft_id: "dA", live_url: A, published_at: "2026-10-07T07:00:00.000Z", search_reading: aReading },
    { ...live, id: "pB", draft_id: "dB", live_url: B, published_at: "2026-10-03T07:00:00.000Z", search_reading: bReading },
  ]);
}

describe("live twins", () => {
  beforeEach(() => seed(read(40)));

  it("merges the page with fewer impressions into the other through the state machine, keeping every row", async () => {
    const outcome = await retireOffTopicPages({ now: AT });
    const pub = (id: string) => db.rows("publications").find((p) => p.id === id);

    expect(outcome.merged).toEqual([{ liveUrl: B, into: A }]);
    expect(pub("pB")).toMatchObject({ unpublished_at: AT.toISOString(), merged_into: "pA" });
    expect(db.rows("drafts").find((d) => d.id === "dB")).toMatchObject({ state: "unpublished" });
    expect(pub("pA")).toMatchObject({ unpublished_at: null, live_url: A });
    expect(pub("pA")?.merged_into).toBeUndefined();
    expect(db.rows("drafts").find((d) => d.id === "dA")?.state).toBe("published");
    expect([db.rows("publications").length, db.rows("drafts").length]).toEqual([2, 2]);
    expect(db.rows("opportunities").find((o) => o.id === "oA")?.absorbed_queries).toEqual(["ai visibility pricing"]);
  });

  it.each([
    ["only a reason", reason({ unread: "no_credentials" }), read(120)],
    ["a property too new to read", reason({ unread: "property_new", indexed: true, lastCrawl: null }), read(120)],
  ])("does not merge a twin whose Google reading is %s, and names it as waiting", async (_, bReading, aReading) => {
    seed(bReading, aReading);
    const outcome = await retireOffTopicPages({ now: AT });

    expect(outcome.merged).toEqual([]);
    expect(outcome.twins).toContainEqual(expect.objectContaining({ why: "twin_waits_on_reading" }));
    expect(db.rows("publications").every((p) => p.unpublished_at === null)).toBe(true);
  });

  it("merges the newer of a pair both measured at 0 impressions and 0 clicks into the older", async () => {
    seed(read(0, 0), read(0, 0));
    expect((await retireOffTopicPages({ now: AT })).merged).toEqual([{ liveUrl: A, into: B }]);
  });
});

describe("a failing live page Google shows", () => {
  const topic = (id: string, query: string) =>
    ({ id, family: "write", type: "answer_page", targetQuery: query, clusterKey: "ai visibility", ready: true, evidence: { family: "write" } }) as unknown as Opportunity;
  const page = (google: LiveTopicPage["google"]): LiveTopicPage => ({
    draftId: "d1", publicationId: "p1", hosted: true, liveUrl: `https://${HOST}/best-answer-engine-optimization-services`, opportunity: topic("o1", "best answer engine optimization services"),
    signals: { firstLive: new Date("2026-10-01"), publishedAt: new Date("2026-10-01"), verdicts: [], ranked: false, reads: 0 }, google,
  });
  const agencies = Array.from({ length: 6 }, (_, i) => ({ domain: `agency${i}.com`, title: `AEO Agency ${i}` }));
  const site = (pages: LiveTopicPage[]) =>
    ({ domain: HOST, brands: undefined, prompts: [], asked: [], business: { kind: "software" }, topTen: () => agencies, open: [topic("o2", "best ai visibility tools")], pages }) as unknown as LiveTopicSite;

  it("is refreshed at its own address, not retargeted to a ready topic of its cluster", () => {
    const shown = page({ impressions: 400, clicks: 1 });
    expect(liveTopicVerdict(shown, site([shown]), AT)).toMatchObject({ kind: "refresh", signals: expect.arrayContaining(["impressions"]) });
    const unseen = page({ impressions: 0, clicks: 0 });
    expect(liveTopicVerdict(unseen, site([unseen]), AT).kind).toBe("retarget");
  });

  it("is kept when nobody searches its comparison, and withdrawn only when another kind of business ranks for it", () => {
    const old = { ...page({ impressions: 0, clicks: 0 }), liveUrl: "https://reachkit.app/reachkit-vs-profound", opportunity: topic("o1", "reachkit vs profound"), signals: { firstLive: new Date("2026-01-01"), publishedAt: new Date("2026-01-01"), verdicts: ["not_moving"], ranked: false, reads: 0 } };
    const at = (topTen: unknown) => ({ ...site([old]), domain: "reachkit.app", brands: { own: ["reachkit"], rivals: ["profound"], others: [] }, open: [], topTen: () => topTen }) as unknown as LiveTopicSite;
    expect(liveTopicVerdict(old, at(null), AT)).toEqual({ kind: "keeps" });
    expect(liveTopicVerdict(old, at(agencies), AT)).toMatchObject({ kind: "withdraw", failure: { rule: "other_kind" } });
  });
});

describe("a planned page that names a live page's product, with no top ten read", () => {
  it("is that page's twin, holds for other businesses, and ranks down within the week without chaining", () => {
    expect([
      ["Most Effective Generative Engine Optimization Solutions", "Best generative engine optimization tool: 6 options compared"],
      ["Ai Search Visibility Checker", "Best AI search visibility tools for founders (2026)"],
      ["AI Visibility Tool for Founders and Small Businesses", "Best AI search visibility tools for founders (2026)"],
      ["Leading Answer Engine Optimization Platforms for Ai Products", "Best Answer Engine Optimization Services for AI Visibility"],
      ["local seo tool", "best seo tools"],
      ["emergency plumbing services", "emergency plumber near me"],
      ["best crm software", "best project management software"],
    ].map(([mine, theirs]) => oneHead([mine], [theirs]))).toEqual([true, true, true, true, false, false, false]);
    const searches = [["A", "ai visibility tool", 300], ["B", "ai search visibility tool", 200], ["C", "search visibility software", 100], ["D", "local seo agency pricing", 50]] as const;
    const rows = searches.map(([id, query, volume], n) => ({ ...rowOf("x.com", { query, status: "open", type: "keyword_page", fit: 3, volume, ready: true }, n), id }));
    expect(choose({ rows, fixRows: [], profile: panelSite("savvycal.com").profile, cited: [], topTens: new Map(), live: [], at: PANEL_AT, from: "2026-10-20", days: 4 }).committed.map((e) => e.opportunityId)).toEqual(["A", "C", "D", "B"]);
  });
});
