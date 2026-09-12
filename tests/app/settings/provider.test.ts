// tests/app/settings/provider.test.ts — BUILD §4.7's reads (#228)
//
// The screen's destinations list is not assembled here and never was: it
// comes from the publishing registry, which is where a destination's
// state, its written line and its action are decided. This suite asserts
// that the store actually reaches it, and that a read which cannot be made
// degrades to a **stated** arm.
//
// The mutation these rows kill is the one #228 was opened for: a fact that
// falls back to `FIXTURE_SETTINGS_FACTS` on a real account. A fixture value
// is a claim — a plan state the customer never held, a destination they
// never connected — and a customer acting on one is worse off than a
// customer told the product could not read it.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../../publish/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

vi.mock("@/lib/publish/destinations/registry", () => ({
  adapterFor: () => ({
    kind: "wordpress",
    servesPublicly: true,
    hostedByUs: false,
    deliver: async () => ({ ok: false, madeLive: false, reason: "destination_unavailable" }),
    unpublish: async () => ({ ok: false, reason: "destination_unavailable" }),
    health: async () => ({ health: "expired", reason: "credentials_expired" }),
  }),
}));

vi.mock("@/lib/mail/notifications", () => ({
  readNotifyPrefs: async () => ({ "draft-ready": true, published: true, weekly: false }),
}));

vi.mock("@/lib/account/identity", () => ({
  accountCard: async () => ({
    name: "A Founder",
    email: "founder@example.com",
    pending: null,
    noteKeys: ["settings.account.magic-link", "settings.account.note.change"],
  }),
}));

import { readLiveSettingsFacts } from "@/app/(account)/app/settings/store";
import { FIXTURE_SETTINGS_FACTS } from "@/app/(account)/app/settings/fixture";
import { LIVE_ACCOUNT } from "../accounts";

const ACCOUNT = { ...LIVE_ACCOUNT, siteId: "site-1", timeZone: "America/New_York" };

function seed(over: Row = {}): void {
  // Deliberately different from `FIXTURE_SETTINGS_FACTS` in every field
  // the spread used to supply: a row that matched the fixture could not
  // tell a read from a spread.
  db.seed("sites", [
    {
      id: "site-1",
      user_id: "user-1",
      domain: "acme.test",
      mode: "copilot",
      veto_hours: 48,
      publish_time: "07:30",
      timezone: "America/New_York",
      publishing_enabled: false,
      voice_text: "Terse.",
      do_not_claim: ["never the fastest"],
      category: "agency project management",
      competitors: ["asana.com"],
    },
  ]);
  db.seed("publications", [
    { id: "pub-1", site_id: "site-1", published_at: "2026-09-01", unpublished_at: null },
    { id: "pub-2", site_id: "site-1", published_at: "2026-09-02", unpublished_at: null },
    { id: "pub-3", site_id: "site-1", published_at: "2026-09-03", unpublished_at: "2026-09-04" },
    { id: "pub-4", site_id: "site-other", published_at: "2026-09-01", unpublished_at: null },
  ]);
  db.seed("destinations", [
    {
      id: "dest-1",
      site_id: "site-1",
      kind: "wordpress",
      config: null,
      health: "error",
      health_reason: "cannot_publish",
      health_changed_at: "2026-09-01T00:00:00.000Z",
      broken_mail_sent_at: null,
      last_checked_at: new Date().toISOString(),
      created_at: "2026-09-01T00:00:00.000Z",
      deleted_at: null,
      publish_capable: false,
      ...over,
    },
  ]);
}

beforeEach(() => {
  db.reset();
});

describe("the destinations half is wired to the registry", () => {
  it("a known site is read through `listDestinations`, action and copy keys included", async () => {
    seed();
    const facts = await readLiveSettingsFacts(ACCOUNT);
    expect(facts.destinationsReadable).toBe(true);
    const [view] = facts.destinations;
    expect(view).toMatchObject({
      id: "dest-1",
      health: "error",
      reason: "cannot_publish",
      action: "reconnect_other_account",
    });
    expect(view!.copy.line).toBe("publish.destination.line.cannot-publish");
  });

  it("a disconnected destination is not in the list the screen renders", async () => {
    seed({ deleted_at: "2026-09-05T00:00:00.000Z" });
    const facts = await readLiveSettingsFacts(ACCOUNT);
    expect(facts.destinations).toEqual([]);
    // Read, and empty. Not the same fact as unreadable.
    expect(facts.destinationsReadable).toBe(true);
  });

  it("a read that cannot be made is stated, never the fixture's own destination", async () => {
    seed();
    vi.doMock("@/lib/publish/destinations", () => ({
      listDestinations: () => Promise.reject(new Error("unreachable")),
    }));
    vi.resetModules();
    const { readLiveSettingsFacts: read } = await import("@/app/(account)/app/settings/store");
    const facts = await read(ACCOUNT);
    expect(facts.destinationsReadable).toBe(false);
    expect(facts.destinations).toEqual([]);
    expect(facts.destinations).not.toBe(FIXTURE_SETTINGS_FACTS.destinations);
    vi.doUnmock("@/lib/publish/destinations");
    vi.resetModules();
  });
});

describe("every settings fact is read for the account that owns it (#228)", () => {
  it("the facts that were the fixture's are the site's own", async () => {
    seed();
    const facts = await readLiveSettingsFacts(ACCOUNT);
    // The fixture's values, for comparison: none of them may appear here
    // by having been spread rather than read.
    expect(facts.vetoHours).toBe(48);
    expect(facts.publishTime).toBe("07:30");
    expect(facts.publishingEnabled).toBe(false);
    expect(facts.voiceText).toBe("Terse.");
    expect(facts.doNotClaim).toEqual(["never the fastest"]);
    expect(facts.publishedPages).toBe(2);
    expect(facts.notifyPrefs).toEqual({ "draft-ready": true, published: true, weekly: false });
  });

  it("and none of them equals the fixture's, which is what the spread used to give them", async () => {
    seed();
    const facts = await readLiveSettingsFacts(ACCOUNT);
    expect(facts.vetoHours).not.toBe(FIXTURE_SETTINGS_FACTS.vetoHours);
    expect(facts.publishTime).not.toBe(FIXTURE_SETTINGS_FACTS.publishTime);
    expect(facts.publishingEnabled).not.toBe(FIXTURE_SETTINGS_FACTS.publishingEnabled);
    expect(facts.voiceText).not.toBe(FIXTURE_SETTINGS_FACTS.voiceText);
    expect(facts.publishedPages).not.toBe(FIXTURE_SETTINGS_FACTS.publishedPages);
  });

  it("REQ-071's pending change is computed from the two answers, not spread from the fixture (#204)", async () => {
    seed();
    // The current scan measured a different domain from the one the site
    // declares, which *is* the pending change (ADR-030: a difference, never
    // a record).
    db.seed("scans", [
      {
        id: "scan-1",
        site_id: "site-1",
        domain: "acme-old.test",
        is_current: true,
        created_at: "2026-09-01T00:00:00.000Z",
        report: { category: "agency project management" },
      },
    ]);
    const facts = await readLiveSettingsFacts(ACCOUNT);
    expect(facts.pendingChange?.kind).toBe("domain");
    expect(facts.pendingChange?.effectiveOn).toBeInstanceOf(Date);
    // And the screen's own before-the-save state, which no server read can
    // know: the customer's keystrokes are in their browser.
    expect(facts.editing).toBeNull();
  });

  it("no current scan is no pending change — not the fixture's `null` by accident", async () => {
    seed();
    const facts = await readLiveSettingsFacts(ACCOUNT);
    expect(facts.pendingChange).toBeNull();
    expect(FIXTURE_SETTINGS_FACTS.pendingChange).toBeNull();
  });

  it("the domain and the zone come from the session's own row, not a second read of it", async () => {
    seed();
    const facts = await readLiveSettingsFacts(ACCOUNT);
    expect(facts.domain).toBe(ACCOUNT.domain);
    expect(facts.timeZone).toBe(ACCOUNT.timeZone);
  });
});

describe("billing degrades to a stated arm, never to the fixture's plan (#228)", () => {
  it("a read that never settles is bounded, and states that it could not be read", async () => {
    seed();
    vi.doMock("@/lib/account/billing", () => ({
      billingSummary: () => new Promise<never>(() => {}),
    }));
    vi.resetModules();
    const { readLiveSettingsFacts: read } = await import("@/app/(account)/app/settings/store");

    const started = Date.now();
    const facts = await read(ACCOUNT);
    expect(facts.billing.readable).toBe(false);
    expect(facts.billing).not.toMatchObject({ state: expect.anything() });
    expect(Date.now() - started).toBeLessThan(3_000);

    vi.doUnmock("@/lib/account/billing");
    vi.resetModules();
  });
});
