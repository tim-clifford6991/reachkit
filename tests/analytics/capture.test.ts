// tests/analytics/capture.test.ts — issue 336, owner ruling 2026-09-16.
//
// "Record three events only — scan started, paid, draft published. PostHog
// already connected. No other events." So the claims worth having are the
// closed list, that nothing identifying leaves, and that a vendor which is
// down or unconfigured cannot fail the thing it is reporting on.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();
process.env.POSTHOG_API_KEY = "phc_fixture";

const sent = vi.hoisted(() => ({
  calls: [] as { url: string; body: unknown; opts: Record<string, unknown> }[],
  answer: { ok: true, status: 200 } as Record<string, unknown>,
  throws: false,
}));
vi.mock("@/lib/egress", () => ({
  safeFetch: async (url: string, opts: Record<string, unknown>) => {
    if (sent.throws) throw new Error("socket");
    sent.calls.push({ url, body: JSON.parse(String(opts.body)) as unknown, opts });
    return sent.answer;
  },
}));

const { ANALYTICS_EVENTS, capture, subjectDigest } = await import("../../src/lib/analytics");

const body = (): Record<string, unknown> => sent.calls[0]?.body as Record<string, unknown>;

beforeEach(() => {
  sent.calls = [];
  sent.answer = { ok: true, status: 200 };
  sent.throws = false;
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("the closed list — three events, and the type admits no fourth", () => {
  it("is exactly the owner's three", () => {
    expect([...ANALYTICS_EVENTS]).toEqual(["scan_started", "paid", "draft_published"]);
  });

  it("a fourth event does not compile", () => {
    // @ts-expect-error — "lead_captured" is not one of the three
    void (() => capture("lead_captured", { subject: "a" }));
  });
});

describe("what leaves — a hashed subject, the tier, and nothing else", () => {
  it("sends the event and the digest of its subject, never the subject", async () => {
    await capture("scan_started", { subject: "Example.com ", tier: "free" });
    expect(body().event).toBe("scan_started");
    expect(body().distinct_id).toBe(subjectDigest("example.com"));
    expect(JSON.stringify(sent.calls[0])).not.toContain("example.com");
  });

  it("carries the tier and nothing else, and builds no person profile", async () => {
    await capture("paid", { subject: "user-1" });
    expect(body().properties).toEqual({ $process_person_profile: false });
    await capture("scan_started", { subject: "a.com", tier: "deep" });
    expect(sent.calls[1]?.body).toMatchObject({ properties: { tier: "deep" } });
  });

  it("goes to the configured host through the one egress door, and respects no robots file", async () => {
    await capture("draft_published", { subject: "site-1" });
    expect(sent.calls[0]?.url).toBe("https://us.i.posthog.com/i/v0/e/");
    expect(sent.calls[0]?.opts).toMatchObject({ method: "POST", respectRobots: false });
  });

  it("the digest is stable and is not the subject", () => {
    expect(subjectDigest("site-1")).toBe(subjectDigest(" SITE-1 "));
    expect(subjectDigest("site-1")).toHaveLength(12);
    expect(subjectDigest("site-1")).not.toContain("site");
  });
});

describe("it never fails the thing it reports on", () => {
  it("a vendor that refuses is reported false, never raised", async () => {
    sent.answer = { ok: true, status: 500 };
    await expect(capture("paid", { subject: "user-1" })).resolves.toBe(false);
    sent.answer = { ok: false };
    await expect(capture("paid", { subject: "user-1" })).resolves.toBe(false);
  });

  it("a deployment with no key captures nothing and does not reach the vendor", async () => {
    const key = process.env.POSTHOG_API_KEY;
    delete process.env.POSTHOG_API_KEY;
    vi.resetModules();
    const fresh = await import("../../src/lib/analytics");
    await expect(fresh.capture("scan_started", { subject: "a.com", tier: "free" })).resolves.toBe(false);
    expect(sent.calls).toEqual([]);
    process.env.POSTHOG_API_KEY = key;
    vi.resetModules();
  });
});
