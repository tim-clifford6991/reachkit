// tests/publish/destinations/wordpress/wrong-password.test.ts — SPEC §5
// (issue 324): "A WordPress connect with a wrong application password shows
// the destination's health state and no vendor text."
//
// The walk against a real WordPress is the owner's. This is the same
// connect, end to end at our seams, against a site that refuses the
// credential the way WordPress does — `401` with its own code and sentence —
// through the real adapter, the real registry, the real health check and
// the real view the settings card draws. Each link is asserted elsewhere
// with a double beside it; this file is the one place a refused password
// travels the whole way, so a link that starts passing the site's words on
// fails here.
import { beforeEach, describe, expect, it, vi } from "vitest";

/** WordPress's own refusal, word for word as a site sends it. None of it
 *  may reach a return value, a stored row, a view or a log line. */
const VENDOR_CODE = "rest_not_logged_in";
const VENDOR_SENTENCE = "You are not currently logged in.";

const site = vi.hoisted(() => ({
  status: 401,
  requests: [] as { method: string; path: string }[],
}));

vi.mock("@/lib/egress", () => ({
  resolvesInDns: async () => true,
  safeFetch: async (url: string, opts: Record<string, unknown> = {}) => {
    const method = (opts.method as string) ?? "GET";
    site.requests.push({ method, path: new URL(url).pathname });
    const body = JSON.stringify({ code: "rest_not_logged_in", message: "You are not currently logged in.", data: { status: site.status } });
    return { ok: true as const, status: site.status, url, html: body, bytes: body.length, readAt: new Date(), headers: {} };
  },
}));

import { fakeDb } from "../../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { connect } = await import("@/lib/publish/destinations");
const { destinationView } = await import("@/lib/publish/destinations/view");
const { __resetHealthDebounceForTesting } = await import("@/lib/publish/destinations/health");
const { WORDPRESS_ADAPTER, WordPressProbeError, canPublish, canStamp } = await import(
  "@/lib/publish/destinations/wordpress/adapter"
);

const PASSWORD = "wrng PASS word 1234";
const CREDENTIAL = { baseUrl: "https://blog.example.com", username: "reachkit", applicationPassword: PASSWORD };
const CUSTOMER = { kind: "customer" as const, userId: "user-1" };

/** Everything a customer or an operator could read, as one string. */
function leaks(text: string): string[] {
  return [VENDOR_CODE, VENDOR_SENTENCE, PASSWORD].filter((needle) => text.includes(needle));
}

let logged: string[];

beforeEach(() => {
  db.reset();
  db.seed("sites", [{ id: "site-1", domain: "example.com", publishing_enabled: true, timezone: "UTC" }]);
  db.seed("destinations", []);
  site.status = 401;
  site.requests = [];
  __resetHealthDebounceForTesting();
  logged = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  });
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  });
});

describe("the adapter's own reads of a refused credential", () => {
  it.each([401, 403])("a %i from the REST index is expired / credentials_expired, and carries nothing the site wrote", async (status) => {
    site.status = status;
    const answer = await WORDPRESS_ADAPTER.health(CREDENTIAL);
    expect(answer).toEqual({ health: "expired", reason: "credentials_expired" });
    expect(leaks(JSON.stringify(answer))).toEqual([]);
  });

  it.each([
    ["canPublish", canPublish],
    ["canStamp", canStamp],
  ] as const)("%s rejects with the classified reason — never `false`, never the site's words", async (_name, probe) => {
    const cause = await probe(CREDENTIAL).then(
      () => {
        throw new Error("the probe answered where it should have rejected");
      },
      (e: unknown) => e
    );
    expect(cause).toBeInstanceOf(WordPressProbeError);
    expect((cause as InstanceType<typeof WordPressProbeError>).reason).toBe("credentials_expired");
    const error = cause as Error;
    expect(leaks(`${error.message}${error.stack ?? ""}`)).toEqual([]);
  });

  it("no read of a refused credential writes to the site", async () => {
    await WORDPRESS_ADAPTER.health(CREDENTIAL);
    await canPublish(CREDENTIAL).catch(() => undefined);
    await canStamp(CREDENTIAL).catch(() => undefined);
    expect(site.requests.filter((r) => r.method !== "GET")).toEqual([]);
  });
});

describe("a connect with a wrong application password, through to the card", () => {
  it("is refused with the state the check found, and the row holds that state", async () => {
    const result = await connect({ siteId: "site-1", kind: "wordpress", config: CREDENTIAL, by: CUSTOMER });
    expect(result).toEqual({ ok: false, reason: "credentials_expired" });

    const row = db.rows("destinations")[0]!;
    expect(row).toMatchObject({ kind: "wordpress", health: "expired", health_reason: "credentials_expired" });
    // Stored sealed: the plaintext is on no column.
    expect(leaks(JSON.stringify(row))).toEqual([]);
  });

  it("the card draws a health state, one written line and Reconnect — no vendor text", async () => {
    await connect({ siteId: "site-1", kind: "wordpress", config: CREDENTIAL, by: CUSTOMER });
    const row = db.rows("destinations")[0]!;
    const view = destinationView({
      id: String(row.id),
      kind: "wordpress",
      health: row.health as "expired",
      reason: row.health_reason as "credentials_expired",
      lastCheckedAt: new Date(String(row.last_checked_at)),
      heldPages: 0,
    });
    expect(view.action).toBe("reconnect");
    expect(view.copy).toMatchObject({
      state: expect.stringContaining("expired"),
      line: "publish.destination.line.credentials-expired",
    });
    expect(leaks(JSON.stringify(view))).toEqual([]);
  });

  it("no log line of the whole connect carries the password or the site's words", async () => {
    await connect({ siteId: "site-1", kind: "wordpress", config: CREDENTIAL, by: CUSTOMER });
    expect(logged.length).toBeGreaterThan(0);
    expect(leaks(logged.join("\n"))).toEqual([]);
  });
});
