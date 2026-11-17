// SPEC §6 *One URL per question*, §7 *Stop a live page*: two live hosted pages of one question merge into the one with
// more Google impressions, through the real re-check, move and state machine; only the database is doubled.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type Row } from "../publish/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("next/cache", () => ({ revalidateTag: () => undefined }));

import { retireOffTopicPages } from "@/lib/opportunities/live-topics";

const AT = new Date(Date.UTC(2026, 10, 18, 7, 0, 0));
const HOST = "content.reachkit.app";
const A = `https://${HOST}/ai-search-visibility-pricing`;
const B = `https://${HOST}/ai-visibility-pricing`;
const VOLUME = { kind: "measured", value: 50, at: "2026-10-05T00:00:00.000Z" };
const read = (impressions: number) => ({ at: "2026-11-16T05:00:00.000Z", google: { impressions, clicks: 1, indexed: true, lastCrawl: null } });

function row(id: string, query: string): Row {
  return {
    id, site_id: "s1", scan_id: "scan-1", family: "write", type: "keyword_page", target_query: query, target_ref: null, proposed_slug: null,
    title: query, volume: VOLUME, evidence: { family: "write", query, volume: VOLUME }, acceptance: null, effort: 1, status: "queued",
    cluster_key: "pricing visibility", absorbed_queries: [], ready: true, created_at: "2026-10-05T00:00:00.000Z",
  };
}

function seed(bReading: unknown): void {
  db.reset();
  installTransitionRpc(db);
  db.seed("sites", [{ id: "s1", domain: "reachkit.app", market: null }]);
  db.seed("destinations", [{ id: "dest-1", site_id: "s1", kind: "hosted", hostname: HOST, health: "ok", config: null, deleted_at: null }]);
  db.seed("opportunities", [row("oA", "ai search visibility pricing"), row("oB", "ai visibility pricing")]);
  const draft = { site_id: "s1", state: "published", transitions: [], meta: {}, body_md: "# Pricing" };
  db.seed("drafts", [{ ...draft, id: "dA", opportunity_id: "oA", title: "AI search visibility pricing" }, { ...draft, id: "dB", opportunity_id: "oB", title: "AI visibility pricing" }]);
  const live = { site_id: "s1", destination: "hosted", delivery_state: "delivered", unpublished_at: null };
  db.seed("publications", [
    { ...live, id: "pA", draft_id: "dA", live_url: A, published_at: "2026-10-07T07:00:00.000Z", search_reading: read(120) },
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

  it("does not merge a twin whose Google reading is only a reason, and names it as waiting", async () => {
    seed({ at: "2026-11-16T05:00:00.000Z", google: { unread: "no_credentials" } });
    const outcome = await retireOffTopicPages({ now: AT });

    expect(outcome.merged).toEqual([]);
    expect(outcome.twins).toContainEqual({ liveUrl: B, into: A, why: "twin_waits_on_reading" });
    expect(db.rows("publications").every((p) => p.unpublished_at === null)).toBe(true);
  });
});
