// tests/publish/attempt/retarget-move.test.ts — issue 1487, SPEC §7.
//
// reachkit.app's own rows, as stored: the 7 October page at
// /tools-to-track-where-ai-sends-potential-customers, the 10 October page
// that links it, and the 9 October retarget to "how to rank on chatgpt",
// which went out at the old address. Through the real `publish()`, the real
// hosted adapter and the real edge read; only the database is doubled.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("next/cache", () => ({ revalidateTag: () => undefined }));

import { publish } from "@/lib/publish/attempt";
import { hostedAddress, livePagesForSite, slugDescribesTitle } from "@/lib/publish/destinations/hosted";
import type { GuardDeps } from "@/lib/publish/machine";
import type { Actor } from "@/lib/publish/types";

const SYSTEM: Actor = { kind: "system", job: "publish/execute" };
const AT = new Date(Date.UTC(2026, 9, 18, 7, 0, 0));
const HOST = "content.reachkit.app";
const OLD = `https://${HOST}/tools-to-track-where-ai-sends-potential-customers`;
const NEW = `https://${HOST}/how-to-rank-on-chatgpt`;
const RETARGET_TITLE = "How to rank on ChatGPT when buyers search your market";

function openDeps(): GuardDeps {
  return {
    claimRecheckOutstanding: async () => false,
    outstandingMatch: async () => null,
    reachKitStopped: async () => false,
    isPublishingOn: async () => true,
    hasCeilingRoom: async () => true,
    destinationWorking: async () => true,
    rule: { becomesPublishable: () => true, toldCurrentPair: () => true },
  };
}

const DRAFT: Row = {
  site_id: "s1",
  transitions: [],
  hard_rules_passed: true,
  publishable_since: null,
  veto_deadline: null,
  approved_at: null,
  meta: {},
};

const LIVE: Row = {
  site_id: "s1",
  destination: "hosted",
  delivery_state: "delivered",
  attempt_no: 1,
  unpublished_at: null,
  mode: "autopilot",
};

function seed(shortfall: "retarget" | "due"): void {
  db.reset();
  installTransitionRpc(db);
  db.seed("sites", [
    { id: "s1", domain: "reachkit.app", mode: "autopilot", veto_hours: 24, publishing_enabled: true, timezone: "UTC" },
  ]);
  db.seed("destinations", [
    { id: "dest-1", site_id: "s1", kind: "hosted", hostname: HOST, health: "ok", config: null, deleted_at: null },
  ]);
  db.seed("scans", [{ id: "scan-1", created_at: "2026-10-05T00:00:00.000Z" }]);
  const target = shortfall === "retarget" ? "how to rank on chatgpt" : "tools to track where ai sends potential customers";
  db.seed("opportunities", [
    { id: "oC", scan_id: "scan-1", family: "write", type: "keyword_page", target_query: "tools to track where ai sends potential customers", proposed_slug: "tools-to-track-where-ai-sends-potential-customers", target_ref: "tools-to-track-where-ai-sends-potential-customers" },
    { id: "oD", scan_id: "scan-1", family: "earn", type: "listed_page", target_query: "how to rank in ai overview", proposed_slug: "how-to-rank-in-ai-overview", target_ref: "how-to-rank-in-ai-overview" },
    {
      id: "oR",
      scan_id: "scan-1",
      family: "improve",
      type: "refresh_page",
      target_query: target,
      proposed_slug: null,
      target_ref: OLD,
      evidence: { family: "improve", query: target, pageUrl: OLD, shortfall: { kind: shortfall } },
    },
  ]);
  db.seed("drafts", [
    { ...DRAFT, id: "dC", opportunity_id: "oC", state: "published", title: "Tools to track where ChatGPT sends potential customers", body_md: "# Tools" },
    {
      ...DRAFT,
      id: "dD",
      opportunity_id: "oD",
      state: "published",
      title: "How to rank in AI Overview for your business",
      body_md: `For a sense of what else the measurement side can tell you, see [tools to track where ChatGPT sends potential customers](${OLD}). And more.`,
    },
    { ...DRAFT, id: "dR", opportunity_id: "oR", state: "approved", title: shortfall === "retarget" ? RETARGET_TITLE : "Tools to track where ChatGPT sends potential customers", body_md: "# New" },
  ]);
  db.seed("publications", [
    { ...LIVE, id: "pC", draft_id: "dC", live_url: OLD, published_at: "2026-10-07T07:01:19.749Z" },
    { ...LIVE, id: "pD", draft_id: "dD", live_url: `https://${HOST}/how-to-rank-in-ai-overview`, published_at: "2026-10-10T07:00:43.503Z" },
  ]);
}

async function publishRetarget(): Promise<Awaited<ReturnType<typeof publish>>> {
  return publish({ draftId: "dR", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
}

describe("a retarget moves the page to an address that says its new topic", () => {
  beforeEach(() => seed("retarget"));

  it("goes live at the new search's slug on the same host", async () => {
    expect(await publishRetarget()).toMatchObject({ ok: true, liveUrl: NEW });
  });

  it("the old address answers 301 to it, and is not a page of its own", async () => {
    await publishRetarget();
    const pages = await livePagesForSite("s1", HOST);

    expect(await hostedAddress("s1", "tools-to-track-where-ai-sends-potential-customers")).toMatchObject({
      state: "moved",
      slug: "how-to-rank-on-chatgpt",
    });
    expect(pages.map((page) => page.liveUrl).sort()).toEqual([`https://${HOST}/how-to-rank-in-ai-overview`, NEW]);
  });

  it("is dated as the new page it is, with no earlier version behind it", async () => {
    await publishRetarget();
    const moved = (await livePagesForSite("s1", HOST)).find((page) => page.liveUrl === NEW);

    expect(moved?.firstPublishedAt).toEqual(AT);
    expect(moved?.publishedAt).toEqual(AT);
  });

  it("the page that linked the old address links the new one, by its new name", async () => {
    await publishRetarget();
    const body = db.rows("drafts").find((row) => row.id === "dD")?.body_md as string;

    expect(body).toContain(`see [${RETARGET_TITLE}](${NEW}). And more.`);
    expect(body).not.toContain(OLD);
  });

  it("every live address and its title describe the same topic", async () => {
    await publishRetarget();
    for (const page of await livePagesForSite("s1", HOST)) expect(slugDescribesTitle(page.slug, page.title)).toBe(true);
  });

  it("what was live on 17 October fails that reading", () => {
    expect(slugDescribesTitle("tools-to-track-where-ai-sends-potential-customers", RETARGET_TITLE)).toBe(false);
  });

  it("is refused where its slug is another live page's", async () => {
    db.seed("publications", [
      ...db.rows("publications"),
      { ...LIVE, id: "pX", draft_id: "dD", live_url: NEW, published_at: "2026-10-11T07:00:00.000Z" },
    ]);
    expect(await publishRetarget()).toMatchObject({ ok: false, reason: "destination_rejected" });
  });
});

describe("a refresh that keeps the topic keeps its address", () => {
  beforeEach(() => seed("due"));

  it("is a new version at the same address, and nothing moves", async () => {
    expect(await publishRetarget()).toMatchObject({ ok: true, liveUrl: OLD });
    expect(await hostedAddress("s1", "tools-to-track-where-ai-sends-potential-customers")).toMatchObject({ state: "live" });
    expect(db.rows("drafts").find((row) => row.id === "dD")?.body_md).toContain(OLD);
  });
});
