// tests/publish/attempt/hosted-update.test.ts — issue 781, SPEC §7.
//
// A hosted site's update, through the real `publish()` and the real hosted
// adapter the registry resolves: an Improve of a page ReachKit published on
// the host is delivered as a new version at the same address, and the edge
// serves that version in the old one's place; an Improve of a page outside
// ReachKit is refused. Only the database is doubled.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("next/cache", () => ({ revalidateTag: () => undefined }));

import { publish } from "@/lib/publish/attempt";
import { livePageBySlug, livePagesForSite, hostedOwnPagesOfSite } from "@/lib/publish/destinations/hosted";
import type { GuardDeps } from "@/lib/publish/machine";
import type { Actor } from "@/lib/publish/types";

const SYSTEM: Actor = { kind: "system", job: "publish/execute" };
const AT = new Date(Date.UTC(2026, 8, 17, 9, 0, 0));
const OWN_PAGE = "https://blog.example.com/onboarding-checklist";

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

function seed(targetRef: string): void {
  db.reset();
  installTransitionRpc(db);
  db.seed("sites", [
    { id: "s1", domain: "example.com", mode: "autopilot", veto_hours: 24, publishing_enabled: true, timezone: "UTC" },
  ]);
  db.seed("destinations", [
    { id: "dest-1", site_id: "s1", kind: "hosted", hostname: "blog.example.com", health: "ok", config: null, deleted_at: null },
  ]);
  db.seed("scans", [{ id: "scan-1", created_at: "2026-09-10T00:00:00.000Z" }]);
  db.seed("opportunities", [
    { id: "o0", scan_id: "scan-1", family: "write", target_query: "onboarding checklist", proposed_slug: "onboarding-checklist", target_ref: "onboarding-checklist" },
    { id: "o1", scan_id: "scan-1", family: "improve", target_query: "onboarding checklist", proposed_slug: null, target_ref: targetRef },
  ]);
  db.seed("drafts", [
    { ...DRAFT, id: "d0", opportunity_id: "o0", state: "published", title: "The checklist", body_md: "# The checklist" },
    { ...DRAFT, id: "d1", opportunity_id: "o1", state: "approved", title: "The checklist, answered", body_md: "# The checklist, answered" },
  ]);
  db.seed("publications", [
    {
      id: "pub-0",
      draft_id: "d0",
      site_id: "s1",
      destination: "hosted",
      delivery_state: "delivered",
      attempt_no: 1,
      live_url: OWN_PAGE,
      published_at: "2026-09-12T09:00:00.000Z",
      unpublished_at: null,
      mode: "autopilot",
    },
  ]);
}

async function publishUpdate(): Promise<Awaited<ReturnType<typeof publish>>> {
  return publish({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
}

describe("a hosted site updates a page ReachKit published there", () => {
  beforeEach(() => seed(OWN_PAGE));

  it("the site's own pages are its host and the slugs live on it", async () => {
    expect(await hostedOwnPagesOfSite("s1")).toEqual({ host: "blog.example.com", slugs: ["onboarding-checklist"] });
  });

  it("is delivered as a new version at the same address", async () => {
    const result = await publishUpdate();

    expect(result).toMatchObject({ ok: true, liveUrl: OWN_PAGE, alreadyPublished: false });
    const update = db.rows("publications").find((row) => row.draft_id === "d1");
    expect(update).toMatchObject({ delivery_state: "delivered", live_url: OWN_PAGE });
  });

  it("the edge serves the new version at that address, and lists the page once", async () => {
    await publishUpdate();

    expect((await livePageBySlug("s1", "onboarding-checklist", "blog.example.com"))?.title).toBe("The checklist, answered");
    expect((await livePagesForSite("s1", "blog.example.com")).map((page) => page.slug)).toEqual(["onboarding-checklist"]);
  });
});

describe("a hosted site cannot update a page outside ReachKit", () => {
  for (const [why, url] of [
    ["the customer's own site", "https://example.com/onboarding-checklist"],
    ["an address on the host that serves nothing", "https://blog.example.com/never-published"],
  ] as const) {
    it(`refuses ${why} as destination_rejected, and publishes nothing beside it`, async () => {
      seed(url);

      const result = await publishUpdate();

      expect(result).toMatchObject({ ok: false, reason: "destination_rejected", retryable: false });
      expect((await livePagesForSite("s1", "blog.example.com")).map((page) => page.title)).toEqual(["The checklist"]);
    });
  }
});
