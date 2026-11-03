/** @vitest-environment jsdom */
// A Settings read that fails is also kept as an `ops_events` row for the daily check, and that write never costs the page.
import "../../generate/env";
import { renderToReadableStream } from "react-dom/server";
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../../publish/harness";

const db = fakeDb();
/** Tables whose queries never answer, and tables whose client call throws. */
const stalled = new Set<string>();
const exploding = new Set<string>();
const never = (): unknown =>
  new Proxy(() => undefined, { get: (_t, key) => (key === "then" ? () => undefined : never()), apply: () => never() });
const client = (): unknown =>
  new Proxy(db.client as Record<string, unknown>, {
    get: (target, key) =>
      key === "from"
        ? (table: string) => {
            if (exploding.has(table)) throw new Error(`stubbed client failure: ${table}`);
            return stalled.has(table) ? never() : (target.from as (t: string) => unknown)(table);
          }
        : target[key as string],
  });
vi.mock("@/lib/db", () => ({ dbAdmin: client, db: client }));

const { copy } = await import("@/lib/presentation/copy");
const { LIVE_ACCOUNT, resetAccount, signedInAs } = await import("../account-door");
const { default: AccountTab } = await import("@/app/(account)/app/settings/account/page");

async function render(): Promise<Document> {
  const stream = await renderToReadableStream(await AccountTab(), { onError: () => undefined });
  await stream.allReady;
  return new DOMParser().parseFromString(await new Response(stream).text(), "text/html");
}
const unreadLine = (doc: Document) => doc.querySelector('[data-testid="settings-unread-account"]')?.textContent;
const logged = (warn: { mock: { calls: unknown[][] } }, event: string, read: string) =>
  warn.mock.calls.map(([line]) => JSON.parse(String(line))).filter((line) => line.event === event && line.read === read);

beforeAll(async () => {
  await Promise.all([import("@/app/(account)/app/_shell/store"), import("@/lib/account/billing")]);
});

beforeEach(() => {
  db.reset();
  stalled.clear();
  exploding.clear();
  signedInAs(LIVE_ACCOUNT);
  db.seed("sites", [
    { id: LIVE_ACCOUNT.siteId, user_id: LIVE_ACCOUNT.userId, domain: LIVE_ACCOUNT.domain, mode: "autopilot", veto_hours: 24, publish_time: "09:00", timezone: "America/New_York", publishing_enabled: true },
  ]);
  db.seed("users", [
    { id: LIVE_ACCOUNT.userId, email: "founder@acme.test", name: "A Founder", pending_email: null, pending_email_sent_at: null, deleted_at: null, notify: {}, created_at: "2026-01-01T00:00:00.000Z", paid_through: "2026-12-01T00:00:00.000Z", cancelled_at: null, plan_status: "active" },
  ]);
  stalled.add("publications");
});
afterEach(() => {
  resetAccount();
  vi.restoreAllMocks();
});

describe("a failed Settings read is kept as a row the daily check counts", () => {
  it("writes one row naming the read, the site and a short code, and the panel is still the plain line", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(unreadLine(await render())).toBe(copy("settings.panel.unread"));
    const pages = () => db.rows("ops_events").filter((row) => row.read === "pages");
    await vi.waitFor(() => expect(pages()).toHaveLength(1));
    expect(pages()[0]).toMatchObject({ kind: "settings_read_failed", site_id: LIVE_ACCOUNT.siteId, code: "timeout" });
  });

  it.each([
    ["throws", () => exploding.add("ops_events")],
    ["never answers", () => stalled.add("ops_events")],
  ])("a write that %s is logged and swallowed, and the page still draws", async (_how, fault) => {
    fault();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const doc = await render();
    expect(unreadLine(doc)).toBe(copy("settings.panel.unread"));
    expect(doc.querySelector('[data-testid="action-cancel"]')).not.toBeNull();
    await vi.waitFor(() => expect(logged(warn, "ops_event_write_failed", "pages")).toHaveLength(1), { timeout: 3_000 });
    expect(db.rows("ops_events")).toEqual([]);
  });
});
