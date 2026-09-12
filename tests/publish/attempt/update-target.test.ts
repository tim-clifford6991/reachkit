// tests/publish/attempt/update-target.test.ts — which address the day's asset
// publishes at: the slug a Write target proposed, or the page an Improve
// target already names.
//
// The discriminating assertion is the address itself. An implementation that
// read `proposed_slug` alone would refuse every Improve target outright (the
// column is null for them by constraint), and one that composed a fresh
// address would publish a second page beside the customer's own instead of
// changing it — and both would pass any row that only read the delivery's
// `ok`.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { PUBLISH_VERIFY_DELAY_H } from "@/lib/config/constants";
import { publish } from "@/lib/publish/attempt";
import type { GuardDeps } from "@/lib/publish/machine";
import type {
  Actor,
  DestinationAdapter,
  RenderedPage,
  UnpublishResult,
} from "@/lib/publish/types";

const SYSTEM: Actor = { kind: "system", job: "publish/execute" };
const AT = new Date(Date.UTC(2026, 8, 15, 12, 0, 0));

/** A page of the customer's own, as an Improve opportunity records it. */
const OWNED = "https://example.com/pricing";

function openDeps(over: Partial<GuardDeps> = {}): GuardDeps {
  return {
    claimRecheckOutstanding: async () => false,
    outstandingMatch: async () => null,
    reachKitStopped: async () => false,
    isPublishingOn: async () => true,
    hasCeilingRoom: async () => true,
    destinationWorking: async () => true,
    rule: { becomesPublishable: () => true, toldCurrentPair: () => true },
    ...over,
  };
}

/** Keeps the page it was handed, and delivers at whatever address that page
 *  names — which is what makes the assertions below about the address this
 *  subsystem resolved, not about one the adapter invented. */
function recordingAdapter(seen: { page: RenderedPage | null }): DestinationAdapter {
  return {
    kind: "wordpress",
    servesPublicly: true,
    hostedByUs: false,
    deliver: async (page: RenderedPage) => {
      seen.page = page;
      return {
        ok: true,
        madeLive: page.updateOf === undefined,
        liveUrl: page.updateOf ?? `https://content.example.com/${page.slug}`,
        remoteId: "41",
      };
    },
    unpublish: async (): Promise<UnpublishResult> => ({ ok: true, outcome: "removed" }),
    health: async () => ({ health: "ok" as const, reason: null }),
  };
}

function seed(opportunity: Row, draft: Row = {}): void {
  db.reset();
  installTransitionRpc(db);
  db.seed("sites", [
    {
      id: "s1",
      mode: "autopilot",
      veto_hours: 24,
      publishing_enabled: true,
      timezone: "America/New_York",
    },
  ]);
  db.seed("destinations", [
    { id: "dest-1", site_id: "s1", kind: "wordpress", health: "ok", config: null },
  ]);
  db.seed("opportunities", [{ id: "o1", ...opportunity }]);
  db.seed("drafts", [
    {
      id: "d1",
      site_id: "s1",
      opportunity_id: "o1",
      state: "approved",
      title: "What our pricing answers",
      body_md: "# What our pricing answers",
      meta: {},
      transitions: [],
      hard_rules_passed: true,
      publishable_since: null,
      veto_deadline: null,
      approved_at: null,
      ...draft,
    },
  ]);
  db.seed("publications", []);
}

const IMPROVE: Row = { family: "improve", proposed_slug: null, target_ref: OWNED };
const WRITE: Row = { family: "write", proposed_slug: "best-widgets", target_ref: "best-widgets" };
const FIX: Row = { family: "fix", proposed_slug: null, target_ref: OWNED };

function pub(): Row {
  const row = db.rows("publications")[0];
  if (row === undefined) throw new Error("no publication row");
  return row;
}

async function deliverOnce(seen: { page: RenderedPage | null }): Promise<unknown> {
  return publish({
    draftId: "d1",
    destination: "wordpress",
    by: SYSTEM,
    at: AT,
    deps: openDeps(),
    adapterFor: () => recordingAdapter(seen),
  });
}

beforeEach(() => seed(IMPROVE));

describe("an update publishes at the page the opportunity already named", () => {
  it("hands the adapter that page's own address", async () => {
    const seen: { page: RenderedPage | null } = { page: null };

    await deliverOnce(seen);

    expect(seen.page?.updateOf).toBe(OWNED);
  });

  it("records that address, and no second one appears", async () => {
    const seen: { page: RenderedPage | null } = { page: null };

    await deliverOnce(seen);

    expect(pub().live_url).toBe(OWNED);
    expect(db.rows("publications")).toHaveLength(1);
  });

  it("sets the twenty-four-hour check on the address it updated", async () => {
    const seen: { page: RenderedPage | null } = { page: null };

    await deliverOnce(seen);

    const due = new Date(AT.getTime() + PUBLISH_VERIFY_DELAY_H * 3600_000).toISOString();
    expect(pub().verify_due_at).toBe(due);
  });
});

describe("the other two families address what they always did", () => {
  it("a Write target publishes at the slug it proposed, updating nothing", async () => {
    seed(WRITE);
    const seen: { page: RenderedPage | null } = { page: null };

    await deliverOnce(seen);

    expect(seen.page?.slug).toBe("best-widgets");
    expect(seen.page?.updateOf).toBeUndefined();
  });

  it("a Fix target publishes no asset: its URL is where a barrier was found", async () => {
    seed(FIX);
    const seen: { page: RenderedPage | null } = { page: null };

    await deliverOnce(seen);

    expect(seen.page).toBeNull();
  });
});

describe("a vetoed update", () => {
  it("leaves the customer's live page exactly as it was", async () => {
    seed(IMPROVE, { state: "skipped" });
    const seen: { page: RenderedPage | null } = { page: null };

    await deliverOnce(seen);

    // Nothing was sent to the destination, and nothing was recorded as
    // published: the page they already have is untouched.
    expect(seen.page).toBeNull();
    expect(db.rows("publications")).toEqual([]);
  });
});
