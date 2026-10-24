// Until the customer's own address is connected, only the first page is
// written. Through the real tick, engine seam, hold, day record and
// missing-draft alert over stored rows; the day's page is doubled at
// `@/lib/generate`, where writing it takes the committed row off the plan.
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../publish/harness";
import { panelSite } from "../golden/plan/panel";

const db = fakeDb();
const doubles = vi.hoisted(() => ({ decided: [] as string[] }));

/** `draft_days`' upsert on `(site_id, publish_date)`; the shared double has none. */
const client = {
  from(table: string) {
    const builder = (db.client as { from(t: string): object }).from(table);
    if (table !== "draft_days") return builder;
    return Object.assign(builder, {
      upsert(values: Row, options: { ignoreDuplicates?: boolean } = {}) {
        const found = db.rows(table).find((row) => row.site_id === values.site_id && row.publish_date === values.publish_date);
        if (found === undefined) db.rows(table).push({ outcome: null, reason: null, missing_alerted_at: null, ...values });
        else if (options.ignoreDuplicates !== true) Object.assign(found, values);
        return Promise.resolve({ data: null, error: null });
      },
    });
  },
  rpc: (fn: string, args: Row) => (db.client as { rpc(f: string, a: Row): unknown }).rpc(fn, args),
};

vi.mock("@/lib/db", () => ({ dbAdmin: () => client, db: () => client }));
vi.mock("@/lib/account/billing", () => ({ ensureActiveAccessGate: async () => {} }));
vi.mock("@/lib/publish/daily", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  sitesForDailyTick: async () => ({ sites: [{ siteId: SITE_ID, timeZone: "UTC", publishTime: "09:00", vetoHours: 24 }], held: null }),
}));
vi.mock("@/lib/generate", () => ({
  decideDayPage: async (day: { siteId: string; publishDate: string }) => {
    doubles.decided.push(day.publishDate);
    const row = db.rows("opportunities").find((r) => r.planned_for === day.publishDate && r.status === "open");
    return row === undefined ? { ok: false, because: "no_opportunity" } : { ok: true, opportunityId: row.id };
  },
  generateDayPage: async (day: { siteId: string; publishDate: string; opportunityId: string }) => {
    const id = `draft-${day.publishDate}`;
    db.rows("drafts").push({ id, site_id: day.siteId, scheduled_for: day.publishDate, state: "in_review", opportunity_id: day.opportunityId });
    db.rows("opportunities").find((r) => r.id === day.opportunityId)!.status = "queued";
    return { ok: true, draftId: id };
  },
  restartedDrafts: async () => [],
}));
vi.mock("@/lib/publish/destinations/health", () => ({ sendBreakageMail: async () => ({ sent: false }) }));
vi.mock("@/lib/publish/attempt/window", () => ({ enterReview: async () => ({ kind: "untold", reason: "test" }) }));

const SITE_ID = "33333333-3333-4333-8333-333333333333";
const { draftGenerate } = await import("@/jobs/draft-generate");
const { __setVendorTransportForTesting } = await import("@/lib/mail/vendor/resend");

/** 09:00 UTC on 1 October plus `n` days: each tick drafts the next day's page. */
function tick(n: number): Date {
  return new Date(Date.UTC(2026, 9, 1 + n, 9));
}
function date(n: number): string {
  return tick(n).toISOString().slice(0, 10);
}

/** A local business on the hosted blog waiting for DNS, and a SaaS on a
 *  WordPress whose credential was never entered. */
const CASES = [
  {
    domain: "austinplumbery.com",
    destination: { kind: "hosted", health: "expired", health_reason: "dns_unset", hostname: "blog.austinplumbery.com", hostname_state: "pending_dns" },
    connected: { health: "ok", health_reason: null, hostname_state: "live" },
  },
  {
    domain: "savvycal.com",
    destination: { kind: "wordpress", health: "expired", health_reason: "never_connected", hostname: null, hostname_state: null },
    connected: { health: "ok", health_reason: null },
  },
] as const;

let mails: string[];

beforeEach(() => {
  mails = [];
  doubles.decided = [];
  __setVendorTransportForTesting(async (payload: string) => {
    mails.push(String((JSON.parse(payload) as { subject: string }).subject));
    return { status: 200, headers: {}, body: JSON.stringify({ id: `m${mails.length}` }) };
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  __setVendorTransportForTesting(null);
  vi.restoreAllMocks();
});

describe.each(CASES)("$domain, not connected yet", ({ domain, destination, connected }) => {
  function seed(): void {
    db.reset();
    db.seed("sites", [{ id: SITE_ID, domain }]);
    db.seed("destinations", [{ id: "dest-1", site_id: SITE_ID, deleted_at: null, ...destination }]);
    db.seed("drafts", []);
    db.seed("draft_days", []);
    db.seed("publications", []);
    // The committed week, from the panel's stored topics: one row a day.
    db.seed(
      "opportunities",
      panelSite(domain)
        .rows.slice(0, 7)
        .map((row, n) => ({ ...row, site_id: SITE_ID, status: "open", planned_for: date(n + 1) }))
    );
  }

  it("five days give the first draft only, held days keep why and alert nobody, and the plan is untouched", async () => {
    seed();
    const committed = structuredClone(db.rows("opportunities").slice(1));

    for (let n = 0; n < 5; n++) await draftGenerate.run({ data: {}, now: tick(n) });

    expect(db.rows("drafts").map((row) => row.scheduled_for)).toEqual([date(1)]);
    const held = db.rows("draft_days").filter((row) => row.reason === "waiting_for_address");
    expect(held.map((row) => [row.publish_date, row.outcome])).toEqual([2, 3, 4, 5].map((n) => [date(n), "no_page"]));
    expect(db.rows("draft_days").map((row) => row.outcome)).not.toContain("failed");
    expect(db.rows("draft_days").every((row) => row.missing_alerted_at === null)).toBe(true);
    expect(mails).toEqual([]);
    expect(doubles.decided).toEqual([date(1)]);
    expect(db.rows("opportunities").slice(1)).toEqual(committed);
  });

  it("connecting on day 5 gives a draft on the next due tick", async () => {
    seed();
    for (let n = 0; n < 5; n++) await draftGenerate.run({ data: {}, now: tick(n) });

    Object.assign(db.rows("destinations")[0]!, connected);
    await draftGenerate.run({ data: {}, now: tick(5) });

    expect(db.rows("drafts").map((row) => row.scheduled_for)).toEqual([date(1), date(6)]);
    expect(db.rows("draft_days").find((row) => row.publish_date === date(6))?.reason).not.toBe("waiting_for_address");
  });
});
