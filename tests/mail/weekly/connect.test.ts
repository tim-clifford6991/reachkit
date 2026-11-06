// SPEC §5 — the Monday mail's connect notice, read from what the vendor received: a hosted address waiting for its
// record, or a WordPress set up without its login, named by the site's domain. Vendor transport stubbed: 0¢.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import { fakeDb, type Row } from "../../publish/harness";

applyEnvFixture();
const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/scan/weekly", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/weekly")>()),
  accountForWeek: async () => ({ kind: "complete", measuredAt: NOW }),
}));
vi.mock("@/lib/opportunities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/opportunities")>()),
  weeklyDigest: async () => ({ standings: [], weekMeasuredAt: NOW }),
}));

const { sendWeeklyDigest } = await import("@/lib/mail/weekly");
const { __setVendorTransportForTesting } = await import("@/lib/mail/vendor/resend");
const { registerSignInLinkIssuer } = await import("@/lib/account/provisioning/sign-in-link");
const { copy } = await import("@/lib/presentation/copy");

const NOW = new Date(Date.UTC(2026, 9, 19, 7, 0, 0));
const APP = "https://reachkit.example";
const GREETING = copy("mail.weekly.hi", { name: "Dana", week: "3", business: "harborplumbing.example" });
const NEVER_CONNECTED = { kind: "wordpress", health: "expired", health_reason: "never_connected", config: null };
let payloads: { text: string; html: string }[] = [];

/** The Monday mail the vendor received for a site with this destination. */
async function monday(destination: Row | null, domain = "harborplumbing.example"): Promise<{ text: string; html: string }> {
  db.reset();
  db.seed("users", [{ id: "user-1", email: "dana@harborplumbing.example", name: "Dana", notify: null }]);
  db.seed("sites", [{ id: "site-1", user_id: "user-1", domain, created_at: "2026-10-05T12:00:00Z", timezone: "America/Chicago", publish_time: "16:00", publishing_enabled: true }]);
  db.seed("scans", [{ id: "scan-week", site_id: "site-1", tier: "weekly", week_start: "2026-10-19", status: "done", digest_sent_at: null }]);
  db.seed("destinations", destination === null ? [] : [{ id: "dest-1", site_id: "site-1", deleted_at: null, hostname: null, ...destination }]);
  expect((await sendWeeklyDigest({ siteId: "site-1", weekStart: "2026-10-19", now: NOW })).sent).toBe(true);
  return payloads.at(-1)!;
}

beforeEach(() => {
  payloads = [];
  __setVendorTransportForTesting(async (payload) => (payloads.push(JSON.parse(payload)), { status: 200, headers: {}, body: '{"id":"vendor-1"}' }));
  registerSignInLinkIssuer(async () => ({ issued: true, url: `${APP}/auth/confirm?token_hash=t`, expiresAt: NOW }));
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  __setVendorTransportForTesting(null);
  registerSignInLinkIssuer(null);
  vi.restoreAllMocks();
});

describe("the Monday mail's connect notice", () => {
  it("a WordPress never connected leads with a notice naming the site's domain and a signed link to Settings › Pages", async () => {
    const mail = await monday(NEVER_CONNECTED);
    const notice = copy("mail.weekly.connect.wordpress", { host: "harborplumbing.example" });
    expect(mail.text.indexOf(GREETING)).toBeGreaterThan(-1);
    expect(mail.text.slice(mail.text.indexOf(GREETING) + GREETING.length, mail.text.indexOf(notice)).trim()).toBe("");
    const href = new URL(/href="([^"]*token_hash=t[^"]*)"/.exec(mail.html)![1]!.replace(/&amp;/g, "&"));
    expect([href.origin + href.pathname, href.searchParams.get("next")]).toEqual([`${APP}/auth/confirm`, "/app/settings/pages"]);
  });

  it("a hosted address waiting for its record keeps its own notice and setup link", async () => {
    const mail = await monday({ kind: "hosted", health: "ok", hostname: "blog.harborplumbing.example", hostname_state: "pending_dns" });
    expect(mail.text).toContain(copy("mail.weekly.connect", { host: "blog.harborplumbing.example" }));
    expect(mail.html).toContain(`href="${APP}/setup/connect"`);
    expect(mail.html).not.toContain("token_hash");
  });

  it("a working WordPress, a live host or a site with no domain to name carries no notice", async () => {
    const cases: [Row | null, string?][] = [
      [{ kind: "wordpress", health: "ok", health_reason: null }],
      [{ kind: "hosted", health: "ok", hostname: "blog.harborplumbing.example", hostname_state: "live" }],
      [NEVER_CONNECTED, ""],
      [null],
    ];
    for (const [destination, domain] of cases) {
      expect((await monday(destination, domain)).text, JSON.stringify(destination)).not.toContain(copy("mail.weekly.connect.action", {}));
    }
  });
});
