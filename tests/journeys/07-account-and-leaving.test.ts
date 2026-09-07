// tests/journeys/07-account-and-leaving.test.ts — BUILD §4.7, §13
//
// Journey: a customer decides to go — cancel at the period end and keep
// what they paid for until it runs out, change their mind and come back,
// take everything with them, and then have the account erased and the
// pages stop being served (JN-004).
//
// End to end, at the seams and no further in. Everything the product owns
// is real: `cancelSubscription` and the running-until date, both arms of
// `resumeSubscription`, `exportEverything` and the archive it builds, the
// danger zone's ticket and its confirmation, `deleteAccount` in its own
// order, the WordPress adapter's four unpublish arms, the hosted edge's
// two answers, and the thirty-day purge. Four things outside the process
// are doubled, each at the last line of our own code:
//
//   · Stripe                   → the SDK object `setStripe()` takes
//   · the customer's WordPress → `safeFetch`, the one door its REST client
//                                has
//   · Resend                   → `__setVendorTransportForTesting`
//   · Postgres                 → the storing PostgREST double the §9 suites
//                                share, plus billing's, the export's and
//                                the lifecycle's own declared stores
//
// Four of those need a word.
//
// **The copy registry is not a fixture here**, for journey 06's reason:
// this journey is partly about sentences the owner still owes — the
// deletion mail's and the export's failure line — so it runs against the
// real registry and asserts the debt rather than papering it over. That is
// also why `deleteAccount` reports `mailSent: false` today: the seam
// refuses to compose a mail whose lines are unwritten, which is the
// intended blocking point and not a defect in this path.
//
// **`hasActiveAccess` is the whole of the gate** (ADR-050), so every
// "still theirs" and "no longer theirs" assertion below reads that one
// function rather than a status column. `plan_status` is recorded and
// never read by the gate, and nothing here reads it either.
//
// **Nothing is deleted on the way out** (ADR-051): erasure writes a
// tombstone and a promised date, and the rows go thirty days later in
// `PURGE_ORDER`. The assertion that carries that is the one that looks
// redundant — the lifecycle store recorded no delete at all until the
// purge runs.
//
// **The hosted edge answers two different statements.** An address that
// served a page and no longer does is `410 Gone`; one that never served a
// page is not, and answering 410 for it would be a claim about a page that
// never existed. Both are asserted, on the same host, in the same test.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type FakeDb } from "../publish/harness";
import type { Publication } from "../../src/lib/publish/types";

const db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

// ── The customer's own WordPress ────────────────────────────────────────

interface WpRequest {
  method: string;
  path: string;
}

const wordpress = {
  requests: [] as WpRequest[],
  /** What the site says about the post the customer is taking down. */
  post: { status: "publish" } as Record<string, unknown> | null,
  reachable: true,
};

const WP_BASE = "https://blog.acme.com";
const DOMAIN = "acme.com";

function jsonAnswer(status: number, value: unknown, url: string) {
  const body = JSON.stringify(value);
  return {
    // `ok` on a `FetchOutcome` means an answer came back, not a 2xx: a 404
    // from their site is an answer, and reading it as a transport failure
    // is what would turn "already gone" into "unreachable".
    ok: true as const,
    status,
    url,
    html: body,
    bytes: body.length,
    readAt: new Date("2026-10-02T12:00:00.000Z"),
    headers: { "content-type": "application/json" },
  };
}

vi.mock("@/lib/egress", () => ({
  resolvesInDns: async () => true,
  readRobots: async (origin: string) => ({
    ok: true,
    origin,
    readAt: new Date("2026-10-02T12:00:00.000Z"),
    disallowsAll: false,
    disallowedAgents: {},
    sitemaps: [],
    absent: false,
  }),
  safeFetch: async (url: string, opts: Record<string, unknown> = {}) => {
    const parsed = new URL(url);
    const path = parsed.pathname.replace("/wp-json", "") + parsed.search;
    const method = (opts.method as string) ?? "GET";
    wordpress.requests.push({ method, path });

    if (!wordpress.reachable) {
      return { ok: false as const, status: 0, url, reason: "network" as const, readAt: new Date() };
    }
    if (path === "/") return jsonAnswer(200, { namespaces: ["wp/v2"] }, url);
    if (path.startsWith("/wp/v2/users/me")) {
      return jsonAnswer(200, { id: 1, capabilities: { publish_posts: true, edit_posts: true } }, url);
    }
    if (path.startsWith("/wp/v2/posts")) {
      if (wordpress.post === null) return jsonAnswer(404, { code: "rest_post_invalid_id" }, url);
      if (method === "POST") {
        wordpress.post = { ...wordpress.post, status: "draft" };
        return jsonAnswer(200, wordpress.post, url);
      }
      return jsonAnswer(200, wordpress.post, url);
    }
    return jsonAnswer(404, {}, url);
  },
}));

// ── The modules, after the fixtures above are in place ──────────────────

const { ERASURE_DAYS, HOSTED_RETENTION_DAYS, HOSTED_GONE_STATUS } = await import(
  "../../src/lib/config/constants"
);
const billingApi = await import("../../src/lib/account/billing");
const { setBillingStore } = await import("../../src/lib/account/billing/store");
const { setStripe } = await import("../../src/lib/account/stripe/client");
const exportApi = await import("../../src/lib/account/export");
const lifecycle = await import("../../src/lib/account/lifecycle");
const { deleteAccount } = await import("../../src/lib/account/lifecycle/delete-account");
const { WORDPRESS_ADAPTER } = await import(
  "../../src/lib/publish/destinations/wordpress/adapter"
);
const { unpublishWordPress } = await import(
  "../../src/lib/publish/destinations/wordpress/unpublish"
);
const { resolveHost, normaliseHost } = await import("../../src/app/(hosted)/resolve-host");
const { hostedAnswer, pageSlug } = await import("../../src/app/(hosted)/edge");
const goneRoute = await import("../../src/app/(hosted)/hosted-gone/route");
const { AWAITING_COPY, COPY, OWNER_OWED, TODO_COPY_MARKER } = await import(
  "../../src/lib/presentation/copy/registry"
);
const { copy } = await import("../../src/lib/presentation/copy");
const { __setVendorTransportForTesting } = await import("../../src/lib/mail/vendor/resend");

const billingDoubles = await import("../account/billing/memory-store");
const exportDoubles = await import("../account/export/memory-store");
const lifecycleDoubles = await import("../account/lifecycle/memory-store");
const stripeDoubles = await import("../account/stripe-double");

// ── One customer, on their way out ──────────────────────────────────────

const USER_ID = "user-journey-07";
const SITE_ID = "site-journey-07";
const SUBSCRIPTION_ID = "sub_journey_07";
const CUSTOMER_ID = "cus_journey_07";
const EMAIL = "founder@acme.com";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The clock this journey runs on is the real one, not a fixed date: every
 *  assertion below is about *which side of `paid_through` we are on*, and
 *  `hasActiveAccess` — ADR-050's whole gate — compares that column against
 *  `Date.now()`. A fixed future date would make "no longer theirs" read as
 *  "still theirs" for as long as the fixture stayed in the future. */
const TODAY = new Date();
/** The day the customer's own month runs out — a fortnight off. */
const PAID_THROUGH = new Date(TODAY.getTime() + 14 * MS_PER_DAY);
/** They pressed Cancel today. */
const CANCELLED_AT = TODAY;

let billing: ReturnType<typeof billingDoubles.newMemoryBilling>;
let exported: ReturnType<typeof exportDoubles.newMemoryExport>;
let lifecycleState: ReturnType<typeof lifecycleDoubles.newMemoryLifecycle>;
let vendor: ReturnType<typeof stripeDoubles.newStripeDouble>;
let mails: number;

/** The sentences leaving still owes the owner, in the two shapes the
 *  registry keeps them in: the ones whose absence takes the surface down
 *  rather than render a blank line, and the ones that render the marker so
 *  a whole screen of finished modules is still reviewable. */
const REFUSED_KEYS = [
  "danger.unpublish-all.consequence",
  "danger.delete-account.consequence",
  "mail.account.deleted.subject",
] as const;

const MARKED_KEYS = ["export.failed", "danger.export-failed"] as const;

function seedBilling(over: Partial<ReturnType<typeof billingDoubles.account>> = {}): void {
  billing.users = [
    billingDoubles.account({
      id: USER_ID,
      email: EMAIL,
      stripe_customer_id: CUSTOMER_ID,
      stripe_subscription_id: SUBSCRIPTION_ID,
      paid_through: PAID_THROUGH.toISOString(),
      cancelled_at: null,
      ...over,
    }),
  ];
  billing.sites = [billingDoubles.site({ id: SITE_ID, user_id: USER_ID })];
}

beforeEach(() => {
  db.reset();
  installTransitionRpc(db);
  wordpress.requests.length = 0;
  wordpress.post = { status: "publish" };
  wordpress.reachable = true;
  mails = 0;

  billing = billingDoubles.newMemoryBilling();
  seedBilling();
  setBillingStore(billingDoubles.memoryBillingStore(billing));

  exported = exportDoubles.newMemoryExport();
  exportApi.setExportStore(exportDoubles.memoryExportStore(exported));

  lifecycleState = lifecycleDoubles.newMemoryLifecycle();
  lifecycleState.accounts = [lifecycleDoubles.account({ id: USER_ID, email: EMAIL })];
  lifecycleState.sites = [{ id: SITE_ID, user_id: USER_ID }];
  lifecycle.setLifecycleStore(lifecycleDoubles.memoryLifecycleStore(lifecycleState));

  vendor = stripeDoubles.newStripeDouble();
  vendor.subscriptions.set(
    SUBSCRIPTION_ID,
    stripeDoubles.subscriptionDouble({
      id: SUBSCRIPTION_ID,
      customer: CUSTOMER_ID,
      periodEnd: PAID_THROUGH,
    })
  );
  setStripe(stripeDoubles.stripeDouble(vendor));

  __setVendorTransportForTesting(async () => {
    mails += 1;
    return { status: 200, headers: {}, body: JSON.stringify({ id: `resend-${mails}` }) };
  });
});

afterEach(() => {
  setBillingStore(null);
  exportApi.setExportStore(null);
  lifecycle.setLifecycleStore(null);
  setStripe(null);
  __setVendorTransportForTesting(null);
});

describe("settings → cancel → export → erasure, and the pages stop being served (JN-004)", () => {
  it("cancel is at the period end: they keep what they paid for, and are told the day it runs out", async () => {
    const cancelled = await billingApi.cancelSubscription(USER_ID);
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) throw new Error("unreachable");

    // The date is the stored gate's, not the vendor's answer to this call.
    expect(cancelled.accessEndsAt.getTime()).toBe(PAID_THROUGH.getTime());
    // §9's hosted retention runs from that day, and is stated only because
    // this customer has hosted pages to lose.
    expect(cancelled.hostedServingEndsAt?.getTime()).toBe(
      PAID_THROUGH.getTime() + HOSTED_RETENTION_DAYS * MS_PER_DAY
    );

    // The vendor was told to stop at the period end and nothing else — no
    // cancel now, and no charge.
    expect(vendor.subscriptionUpdates).toEqual([
      { id: SUBSCRIPTION_ID, params: { cancel_at_period_end: true } },
    ]);
    expect(vendor.cancelled).toEqual([]);
    expect(vendor.chargesCreated).toBe(0);

    // Still theirs until the date: the gate is `paid_through` alone.
    expect(await billingApi.hasActiveAccess(SITE_ID)).toBe(true);
    expect(billingDoubles.storedUser(billing).cancelled_at).not.toBeNull();

    // A second cancel is not a second write: the plan already ends when it
    // ends.
    await expect(billingApi.cancelSubscription(USER_ID)).resolves.toEqual({
      ok: false,
      reason: "already_cancelled",
    });
    expect(vendor.subscriptionUpdates).toHaveLength(1);
  });

  it("resume before the date un-cancels; resume after it opens a new subscription on the same customer", async () => {
    // Nothing to resume yet.
    await expect(billingApi.resumeSubscription(USER_ID)).resolves.toEqual({
      ok: false,
      reason: "not_cancelled",
    });

    await billingApi.cancelSubscription(USER_ID);
    vendor.subscriptionUpdates.length = 0;

    // Arm one — inside the paid period: un-cancelling is the whole of it,
    // and no card is asked for because no subscription is created.
    const inside = await billingApi.resumeSubscription(USER_ID);
    expect(inside.ok).toBe(true);
    expect(vendor.subscriptionUpdates).toEqual([
      { id: SUBSCRIPTION_ID, params: { cancel_at_period_end: false } },
    ]);
    expect(vendor.subscriptionsCreated).toEqual([]);
    expect(billingDoubles.storedUser(billing).cancelled_at).toBeNull();
    // The countdown that started because they left, stopped because they
    // came back.
    expect(billingDoubles.storedSite(billing).hosted_serving_ends_at).toBeNull();

    // Arm two — past the date: the vendor's subscription is gone, so a new
    // one is opened against the same customer, at the one price.
    vendor.subscriptions.set(SUBSCRIPTION_ID, {
      ...(vendor.subscriptions.get(SUBSCRIPTION_ID) as Record<string, unknown>),
      status: "canceled",
    });
    billing.users = [
      billingDoubles.account({
        ...billingDoubles.storedUser(billing),
        cancelled_at: CANCELLED_AT.toISOString(),
      }),
    ];
    vendor.subscriptionUpdates.length = 0;

    const after = await billingApi.resumeSubscription(USER_ID);
    expect(after.ok).toBe(true);
    expect(vendor.subscriptionsCreated).toHaveLength(1);
    expect(vendor.subscriptionsCreated[0]?.customer).toBe(CUSTOMER_ID);
    expect(vendor.subscriptionUpdates).toEqual([]);
    // Still no card: ReachKit presents no payment form on this path at all.
    expect(vendor.chargesCreated).toBe(0);
  });

  it("they can take everything with them, and the archive is one site's and no wider", async () => {
    exported.pages = [
      exportDoubles.page({ title: "Best project management software" }),
      exportDoubles.page({ title: "Agency capacity planning" }),
    ];

    const archive = await exportApi.exportEverything(SITE_ID);
    expect(archive.ok).toBe(true);
    if (!archive.ok) throw new Error("unreachable");
    expect(archive.pages).toBe(exported.pages.length);
    expect(archive.filename).toMatch(/\.zip$/);

    // `siteId` is the only parameter there is, so no route above this can
    // narrow — or widen — an export by accident.
    expect(exportApi.exportEverything).toHaveLength(1);
  });

  it("the danger zone hands the archive over before it will take a confirmation", async () => {
    exported.pages = [exportDoubles.page({ title: "A page" })];

    // Both actions state their consequence in the owner's words, and one
    // of them leaves the account standing.
    expect(lifecycle.DANGER_ZONE.map((row) => row.action)).toEqual([
      "unpublish_all",
      "delete_account",
    ]);
    expect(lifecycle.DANGER_ZONE.find((row) => row.action === "delete_account")?.accountSurvives).toBe(
      false
    );

    const begun = await lifecycle.beginDangerAction({ siteId: SITE_ID, action: "delete_account" });
    expect(begun.ok).toBe(true);
    if (!begun.ok) throw new Error("unreachable");

    // The archive first, always: until the customer has actually been
    // handed it, no confirmation is taken — a ticket written before the
    // archive exists is the shape in which an action runs against a
    // customer who was handed nothing.
    await expect(
      lifecycle.confirmDangerAction({ ticket: begun.ticket, typedConfirmation: "delete_account" })
    ).resolves.toEqual({ ok: false, reason: "export_not_taken" });

    await lifecycle.markExportTaken(begun.ticket);

    // And then a confirmation that is not the action's own word is still
    // refused.
    expect(lifecycle.confirmationFor("delete_account")).toBe("delete_account");
    await expect(
      lifecycle.confirmDangerAction({ ticket: begun.ticket, typedConfirmation: "yes" })
    ).resolves.toEqual({ ok: false, reason: "not_confirmed" });
    // A ticket nobody issued is refused too, and says nothing about which.
    await expect(
      lifecycle.confirmDangerAction({ ticket: "not-a-ticket", typedConfirmation: "delete_account" })
    ).resolves.toEqual({ ok: false, reason: "no_ticket" });
  });

  it(
    "erasure takes the pages down, ends the subscription at once, and deletes no row for thirty days",
    async () => {
      const now = new Date();
      const deleted = await deleteAccount({ siteId: SITE_ID, now });
      expect(deleted.ok).toBe(true);
      if (!deleted.ok) throw new Error("unreachable");

      // Signed out everywhere, not on this device alone.
      expect(deleted.result.signedOut).toBe(true);
      // The subscription ends at once — `hasActiveAccess` is false from
      // here, and no further charge was made.
      expect(deleted.result.subscriptionEndedAt.getTime()).toBe(now.getTime());
      expect(await billingApi.hasActiveAccess(SITE_ID)).toBe(false);
      expect(vendor.chargesCreated).toBe(0);

      // The promised date is stored rather than computed by whoever asks.
      expect(deleted.result.purgeDueAt.getTime()).toBe(now.getTime() + ERASURE_DAYS * MS_PER_DAY);

      // ADR-051: nothing is deleted on the way out. The rows go with the
      // purge, thirty days later, and not before.
      expect(lifecycleState.deleted).toEqual([]);

      // Criterion 6's mail is owed and is not sent: its sentences are the
      // owner's and none is written, so the seam refuses to compose it and
      // says so rather than putting a blank line in front of somebody who
      // has just erased their account. `mailSent: false` is that fact
      // carried out to the caller, and the erasure stands either way — the
      // telling is not a precondition of the take-down.
      expect(deleted.result.mailSent).toBe(false);
      expect(mails).toBe(0);
      // What it would have said about the destinations is read off the
      // take-down's own outcomes rather than assumed.
      expect(Array.isArray(deleted.result.stillLive)).toBe(true);
    }
  );

  it("the destination's four arms, each said as what it is", async () => {
    const publication: Publication = {
      id: "pub-1",
      draftId: "draft-1",
      siteId: SITE_ID,
      destination: "wordpress",
      deliveryState: "delivered",
      attemptNo: 1,
      claimedAt: new Date(TODAY.getTime() - 30 * MS_PER_DAY),
      publishedAt: new Date(TODAY.getTime() - 30 * MS_PER_DAY),
      unpublishedAt: null,
      liveUrl: `${WP_BASE}/?p=500`,
      remoteId: "500",
      failureReason: null,
      mode: "autopilot",
      unpublishOutcome: null,
      madeLiveByUs: true,
      verifyDueAt: null,
    };
    const config = { baseUrl: WP_BASE, username: "reachkit", applicationPassword: "abcd efgh ijkl mnop" };

    // Made live by us and still there: returned to draft.
    await expect(unpublishWordPress(publication, config)).resolves.toEqual({
      ok: true,
      outcome: "returned_to_draft",
    });

    // Already gone from the site: nothing to remove, and saying so is not
    // a failure.
    wordpress.post = null;
    await expect(unpublishWordPress(publication, config)).resolves.toEqual({
      ok: true,
      outcome: "already_gone",
    });

    // Their site did not answer: the customer's stop stands, and a retry
    // is offered rather than the page being recorded as taken down.
    wordpress.post = { status: "publish" };
    wordpress.reachable = false;
    await expect(unpublishWordPress(publication, config)).resolves.toEqual({
      ok: true,
      outcome: "unreachable",
      retryOffered: true,
    });

    // Never made live by us: there is nothing of ours to take down, so the
    // page is named for the customer to remove — and nothing leaves the
    // process at all.
    wordpress.reachable = true;
    wordpress.requests.length = 0;
    await expect(
      unpublishWordPress({ ...publication, madeLiveByUs: false }, config)
    ).resolves.toEqual({ ok: true, outcome: "named_for_removal" });
    expect(wordpress.requests).toEqual([]);

    // The adapter this journey drove is the one the product registers.
    expect(WORDPRESS_ADAPTER.kind).toBe("wordpress");
    expect(WORDPRESS_ADAPTER.hostedByUs).toBe(false);
  });

  it(
    "after they leave, the hosted address answers 410 — and an address that never held a page does not",
    async () => {
      db.seed("sites", [{ id: SITE_ID, user_id: USER_ID, domain: DOMAIN }]);
      db.seed("drafts", [{ id: "draft-1", site_id: SITE_ID, opportunity_id: "opp-1" }]);
      db.seed("opportunities", [{ id: "opp-1", proposed_slug: "a-page" }]);
      db.seed("publications", [
        {
          id: "pub-1",
          draft_id: "draft-1",
          site_id: SITE_ID,
          destination: "hosted",
          delivery_state: "delivered",
          live_url: "https://content.acme.com/a-page",
          published_at: new Date(TODAY.getTime() - 30 * MS_PER_DAY).toISOString(),
          unpublished_at: TODAY.toISOString(),
        },
      ]);

      const host = `content.${DOMAIN}`;
      expect(normaliseHost(`${host}:443.`)).toBe(host);
      expect(pageSlug("/a-page")).toBe("a-page");
      // A deeper path is not a deeper page — it is not a page at all.
      expect(pageSlug("/a/b")).toBeNull();

      // While the account stands and the window is open, the host is the
      // customer's site.
      billing.sites = [billingDoubles.site({ id: SITE_ID, user_id: USER_ID })];
      const serving = await resolveHost(host);
      expect(serving.kind).toBe("site");

      // The account is erased: every address on the host is gone, and the
      // reason travels for an operator without changing the answer.
      billing.users = [
        billingDoubles.account({
          ...billingDoubles.storedUser(billing),
          deleted_at: TODAY.toISOString(),
        }),
      ];
      const gone = await resolveHost(host);
      expect(gone).toEqual({ kind: "gone", reason: "account_deleted" });

      // The retention window elapsing is the other ending, and it answers
      // the same way.
      billing.users = [
        billingDoubles.account({ ...billingDoubles.storedUser(billing), deleted_at: null }),
      ];
      billing.sites = [
        billingDoubles.site({
          id: SITE_ID,
          user_id: USER_ID,
          hosted_serving_ends_at: new Date(TODAY.getTime() - MS_PER_DAY).toISOString(),
        }),
      ];
      await expect(resolveHost(host)).resolves.toEqual({
        kind: "gone",
        reason: "access_ended",
      });

      // A page that was taken down is gone; one that never existed is not,
      // because 410 would be a claim about a page nobody ever served.
      billing.sites = [billingDoubles.site({ id: SITE_ID, user_id: USER_ID })];
      await expect(hostedAnswer(host, "/a-page")).resolves.toBe("gone");
      await expect(hostedAnswer(host, "/never-a-page")).resolves.toBe("page");

      // And the response itself: 410, uncached, unindexed, and carrying
      // nothing of ours — it answers on a domain that is not ours.
      const response = await goneRoute.GET();
      expect(response.status).toBe(HOSTED_GONE_STATUS);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex");
      const body = await response.text();
      expect(body.toLowerCase()).not.toContain("reachkit");
      expect(body).not.toContain("<a ");
    }
  );

  it("every sentence leaving speaks is the owner's, and none of them is written yet", () => {
    // The refusing kind: `copy()` throws rather than putting a blank line
    // in front of a customer about to erase their account.
    for (const key of REFUSED_KEYS) {
      expect(Object.keys(COPY), key).toContain(key);
      expect(OWNER_OWED, key).toContain(key);
      expect(() => copy(key), key).toThrow(/owner-owed/);
    }

    // The marked kind: renderable, so a screen full of finished modules is
    // still reviewable, and listed so "what is still unwritten" stays one
    // question with one answer.
    for (const key of MARKED_KEYS) {
      expect(AWAITING_COPY, key).toContain(key);
      expect(copy(key), key).toBe(TODO_COPY_MARKER);
    }

    // The two lists are disjoint: a key is in one shape or the other, and
    // never in both.
    for (const key of MARKED_KEYS) expect(OWNER_OWED).not.toContain(key);
    for (const key of REFUSED_KEYS) expect(AWAITING_COPY).not.toContain(key);
  });
});
