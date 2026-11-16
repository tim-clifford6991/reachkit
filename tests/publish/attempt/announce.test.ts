// tests/publish/attempt/announce.test.ts — issue 1511, SPEC §7 (2026-10-18).
//
// Google is told about a hosted page the moment it changes: one WebSub ping
// per publish, update and unpublish, and none for a WordPress destination
// or a host that is not live. Through the real `publish()` and
// `unpublish()`, the real hosted adapter and the real state machine; the
// database is doubled, and the hub is answered by `send`, so no suite pings it.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type Row } from "../harness";
import type { FetchOutcome, SafeFetchOpts } from "@/lib/egress";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("next/cache", () => ({ revalidateTag: () => undefined }));

import { publish } from "@/lib/publish/attempt";
import { unpublish } from "@/lib/publish/attempt/unpublish";
import { WEBSUB_HUB } from "@/lib/publish/destinations/hosted/announce";
import type { GuardDeps } from "@/lib/publish/machine";
import type { Actor, DestinationAdapter } from "@/lib/publish/types";

const SYSTEM: Actor = { kind: "system", job: "publish/execute" };
const AT = new Date(Date.UTC(2026, 9, 18, 7, 0, 0));
const HOST = "content.example.com";
const PAGE = `https://${HOST}/best-onboarding-tools`;
const OLD = `https://${HOST}/onboarding-tools`;
const NEW = `https://${HOST}/how-to-onboard-users`;

function openDeps(): GuardDeps {
  return {
    claimRecheckOutstanding: async () => false,
    outstandingMatch: async () => null,
    reachKitStopped: async () => false,
    isPublishingOn: async () => true,
    hasCeilingRoom: async () => true,
    destinationWorking: async () => true,
    rule: { becomesPublishable: () => true },
  };
}

const DRAFT: Row = { site_id: "s1", transitions: [], hard_rules_passed: true, publishable_since: null, veto_deadline: null, approved_at: null, meta: {} };

interface Sent {
  url: string;
  opts: SafeFetchOpts;
}

let sent: Sent[] = [];
let answer: (url: string) => FetchOutcome = () => ok(200);

function ok(status: number): FetchOutcome {
  return { ok: true, status, url: "", html: "", bytes: 0, readAt: AT, headers: {} };
}

const send = async (url: string, opts: SafeFetchOpts): Promise<FetchOutcome> => {
  sent.push({ url, opts });
  return answer(url);
};

const hub = (): Sent[] => sent.filter((request) => request.url === WEBSUB_HUB);

function seed(a: { kind?: "hosted" | "wordpress"; hostState?: "live" | "pending_dns" } = {}): void {
  sent = [];
  answer = () => ok(200);
  db.reset();
  installTransitionRpc(db);
  db.seed("sites", [{ id: "s1", domain: "example.com", mode: "autopilot", veto_hours: 24, publishing_enabled: true, timezone: "UTC" }]);
  db.seed("destinations", [
    {
      id: "dest-1",
      site_id: "s1",
      kind: a.kind ?? "hosted",
      hostname: HOST,
      hostname_state: a.hostState ?? "live",
      health: "ok",
      config: null,
      deleted_at: null,
    },
  ]);
  db.seed("scans", [{ id: "scan-1", created_at: "2026-10-05T00:00:00.000Z" }]);
  const volume = { kind: "zero", value: 0, at: "2026-10-05T00:00:00.000Z" };
  db.seed("opportunities", [
    { id: "oN", scan_id: "scan-1", family: "write", type: "keyword_page", target_query: "best onboarding tools", proposed_slug: "best-onboarding-tools", target_ref: "best-onboarding-tools", evidence: { family: "write", query: "best onboarding tools", volume } },
    { id: "oO", scan_id: "scan-1", family: "write", type: "keyword_page", target_query: "onboarding tools", proposed_slug: "onboarding-tools", target_ref: "onboarding-tools", evidence: { family: "write", query: "onboarding tools", volume } },
    {
      id: "oR",
      scan_id: "scan-1",
      family: "improve",
      type: "refresh_page",
      target_query: "how to onboard users",
      proposed_slug: null,
      target_ref: OLD,
      evidence: { family: "improve", query: "how to onboard users", pageUrl: OLD, shortfall: { kind: "retarget" } },
    },
  ]);
  db.seed("drafts", [
    { ...DRAFT, id: "dN", opportunity_id: "oN", state: "approved", title: "The best onboarding tools", body_md: "# Tools\n\nWords." },
    { ...DRAFT, id: "dO", opportunity_id: "oO", state: "published", title: "Onboarding tools", body_md: "# Old" },
    { ...DRAFT, id: "dR", opportunity_id: "oR", state: "approved", title: "How to onboard users", body_md: "# New" },
  ]);
  db.seed("publications", [
    { id: "pO", draft_id: "dO", site_id: "s1", destination: a.kind ?? "hosted", delivery_state: "delivered", attempt_no: 1, live_url: OLD, published_at: "2026-10-07T07:00:00.000Z", unpublished_at: null, mode: "autopilot", made_live_by_us: true },
  ]);
}

describe("a hosted publish tells the hub, once", () => {
  beforeEach(() => seed());

  it("a new page pings the feed's hub once, and nothing else", async () => {
    expect(await publish({ draftId: "dN", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps(), announce: send })).toMatchObject({ ok: true, liveUrl: PAGE });

    expect(sent.map((request) => request.url)).toEqual([WEBSUB_HUB]);
    expect(new URLSearchParams(hub()[0]?.opts.body ?? "").get("hub.url")).toBe(`https://${HOST}/rss.xml`);
    expect(new URLSearchParams(hub()[0]?.opts.body ?? "").get("hub.mode")).toBe("publish");
  });

  it("a move pings once", async () => {
    expect(await publish({ draftId: "dR", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps(), announce: send })).toMatchObject({ ok: true, liveUrl: NEW });

    expect(hub()).toHaveLength(1);
  });

  it("an unpublish pings once", async () => {
    expect(await unpublish({ draftId: "dO", by: SYSTEM, at: AT, deps: openDeps(), announce: send })).toMatchObject({ ok: true, outcome: "removed" });

    expect(hub()).toHaveLength(1);
  });

  it("a 429 is dropped: no retry, and the page is published", async () => {
    answer = () => ok(429);

    expect(await publish({ draftId: "dN", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps(), announce: send })).toMatchObject({ ok: true });
    expect(hub()).toHaveLength(1);
    expect(db.rows("drafts").find((row) => row.id === "dN")?.state).toBe("published");
  });

  it("a send that throws never fails the publish", async () => {
    const throwing = async (): Promise<FetchOutcome> => {
      sent.push({ url: WEBSUB_HUB, opts: {} });
      throw new Error("down");
    };
    expect(await publish({ draftId: "dN", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps(), announce: throwing })).toMatchObject({ ok: true, liveUrl: PAGE });
  });
});

describe("nothing is sent off a live hosted host", () => {
  it("a host whose record is not live yet sends none", async () => {
    seed({ hostState: "pending_dns" });
    expect(await publish({ draftId: "dN", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps(), announce: send })).toMatchObject({ ok: true });
    expect(sent).toEqual([]);
  });

  it("a WordPress destination sends none", async () => {
    seed({ kind: "wordpress" });
    const wordpress: DestinationAdapter = {
      kind: "wordpress",
      servesPublicly: true,
      hostedByUs: false,
      deliver: async () => ({ ok: true, madeLive: true, liveUrl: "https://example.com/best-onboarding-tools/" }),
      unpublish: async () => ({ ok: true, outcome: "returned_to_draft" }),
      health: async () => ({ health: "ok", reason: null }),
    } as unknown as DestinationAdapter;

    expect(
      await publish({ draftId: "dN", destination: "wordpress", by: SYSTEM, at: AT, deps: openDeps(), adapterFor: () => wordpress, announce: send })
    ).toMatchObject({ ok: true });
    expect(await unpublish({ draftId: "dO", by: SYSTEM, at: AT, deps: openDeps(), adapterFor: () => wordpress, announce: send })).toMatchObject({ ok: true });
    expect(sent).toEqual([]);
  });
});
