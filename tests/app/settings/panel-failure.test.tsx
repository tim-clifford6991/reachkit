/** @vitest-environment jsdom */
// Settings on a slow database: a read that fails or times out leaves only the panels that state it on
// one plain line, and the billing tab draws its cancel control while every other read is stalled.
import "../../generate/env";
import { renderToReadableStream } from "react-dom/server";
import type React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../../publish/harness";

const db = fakeDb();
/** Tables whose queries never answer, the way a database over its quota does. */
const stalled = new Set<string>();
const never = (): unknown =>
  new Proxy(() => undefined, { get: (_t, key) => (key === "then" ? () => undefined : never()), apply: () => never() });
const client = (): unknown =>
  new Proxy(db.client as Record<string, unknown>, {
    get: (target, key) =>
      key === "from" ? (table: string) => (stalled.has(table) ? never() : (target.from as (t: string) => unknown)(table)) : target[key as string],
  });
vi.mock("@/lib/db", () => ({ dbAdmin: client, db: client }));

const { copy } = await import("@/lib/presentation/copy");
const { LIVE_ACCOUNT, resetAccount, signedInAs } = await import("../account-door");
const { readLiveSettingsFacts } = await import("@/app/(account)/app/settings/store");
const { default: AccountTab } = await import("@/app/(account)/app/settings/account/page");
const { default: BillingTab } = await import("@/app/(account)/app/settings/billing/page");
const { default: PublishingTab } = await import("@/app/(account)/app/settings/publishing/page");

const ACCOUNT = { ...LIVE_ACCOUNT, timeZone: "America/New_York" };

/** The document once every boundary has settled, or, with `first`, what streams before a stalled boundary. */
async function render(page: () => Promise<React.JSX.Element>, first = false): Promise<Document> {
  const stream = await renderToReadableStream(await page(), { onError: () => undefined });
  if (!first) await stream.allReady;
  let html = "";
  if (first) {
    const reader = stream.getReader();
    const quiet = new Promise<null>((resolve) => setTimeout(() => resolve(null), 300));
    for (let chunk = await reader.read(); !chunk.done; chunk = (await Promise.race([reader.read(), quiet])) ?? { done: true, value: undefined }) {
      html += new TextDecoder().decode(chunk.value);
    }
    void reader.cancel();
  } else html = await new Response(stream).text();
  return new DOMParser().parseFromString(html, "text/html");
}
const has = (doc: Document, id: string): boolean => doc.querySelector(`[data-testid="${id}"]`) !== null;

// The tabs import their stores lazily; loaded once here so a cold transform is not read as a slow database.
beforeAll(async () => {
  await Promise.all([import("@/app/(account)/app/_shell/store"), import("@/lib/known-content/link-map"), import("@/lib/account/billing")]);
});

beforeEach(() => {
  db.reset();
  stalled.clear();
  signedInAs(LIVE_ACCOUNT);
  db.seed("sites", [
    { id: LIVE_ACCOUNT.siteId, user_id: LIVE_ACCOUNT.userId, domain: LIVE_ACCOUNT.domain, mode: "autopilot", veto_hours: 24, publish_time: "09:00", timezone: "America/New_York", publishing_enabled: true },
  ]);
  db.seed("users", [
    { id: LIVE_ACCOUNT.userId, email: "founder@acme.test", name: "A Founder", pending_email: null, pending_email_sent_at: null, deleted_at: null, notify: {}, created_at: "2026-01-01T00:00:00.000Z", paid_through: "2026-12-01T00:00:00.000Z", cancelled_at: null, plan_status: "active" },
  ]);
});
afterEach(() => {
  resetAccount();
  vi.restoreAllMocks();
});

describe("one read that times out", () => {
  it("is not the line while every read answers", async () => {
    for (const page of [AccountTab, PublishingTab, BillingTab]) {
      expect((await render(page)).querySelector('[data-testid^="settings-unread-"]')).toBeNull();
    }
  });

  it("is named in the log and in `unread`, and every other fact is still read", async () => {
    stalled.add("publications");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const facts = await readLiveSettingsFacts(ACCOUNT);
    expect(facts.unread).toEqual(["pages"]);
    expect(facts.vetoHours).toBe(24);
    expect(facts.billing.readable).toBe(true);
    expect(warn.mock.calls.map(([line]) => JSON.parse(String(line)))).toContainEqual({
      event: "settings_read_failed",
      read: "pages",
      detail: "Error: settings read timed out: pages",
    });
  });

  it("puts only the panel that states it on the plain line; the tab's other panels and billing draw", async () => {
    stalled.add("publications");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const account = await render(AccountTab);
    expect(account.querySelector('[data-testid="settings-unread-account"]')?.textContent).toBe(copy("settings.panel.unread"));
    expect(has(account, "settings-shortcuts")).toBe(true);
    expect(has(account, "settings-danger")).toBe(true);

    const publishing = await render(PublishingTab);
    expect(has(publishing, "settings-unread-publishing")).toBe(false);
    expect(publishing.querySelector("h2")?.textContent).toBe(copy("settings.publishing.title"));

    expect(has(await render(BillingTab), "action-cancel")).toBe(true);
  });
});

describe("billing reads only billing", () => {
  it("draws the cancel control in the first flush while every other table is stalled", async () => {
    for (const table of ["sites", "publications", "drafts", "destinations", "scans", "pages", "market_readings"]) stalled.add(table);
    const doc = await render(BillingTab, true);
    expect(has(doc, "action-cancel")).toBe(true);
    expect(has(doc, "billing-month-skeleton")).toBe(true);
  });

  it("draws it settled while every other read rejects, the month on its own line", async () => {
    for (const table of ["sites", "publications", "drafts", "destinations", "scans"]) db.unreadable.add(table);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const doc = await render(BillingTab);
    expect(has(doc, "action-cancel")).toBe(true);
    expect(has(doc, "billing-month-skeleton")).toBe(false);
  });
});
