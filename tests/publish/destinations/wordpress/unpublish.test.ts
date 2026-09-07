// tests/publish/destinations/wordpress/unpublish.test.ts — the four arms,
// the discriminator, and the three mutations that must fail.
//
// The `made_live_by_us = false` fixtures are constructed directly, because
// **no production path can produce one**: since 2026-09-01 this adapter
// sets `status: 'publish'` on every create and returns `madeLive: true`.
// That is exactly why the arm needs a test — it is unreachable in
// production, deleting it breaks nothing else, and it is the outcome §9
// promises for a page ReachKit created but did not make live.
//
// The archived plan is WO-239.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const site = vi.hoisted(() => ({
  requests: [] as { method: string; path: string; body: unknown }[],
  answer: { kind: "ok" as "ok" | "gone" | "unauthorised" | "silent" | "server_error" },
}));

vi.mock("@/lib/egress", () => ({
  safeFetch: async (url: string, opts: Record<string, unknown>) => {
    const parsed = new URL(url);
    site.requests.push({
      method: (opts.method as string) ?? "GET",
      path: parsed.pathname.replace("/wp-json", ""),
      body: opts.body === undefined ? null : JSON.parse(opts.body as string),
    });
    const json = (status: number, value: unknown) => ({
      ok: true as const,
      status,
      url,
      html: JSON.stringify(value),
      bytes: 1,
      readAt: new Date(),
      headers: {},
    });
    switch (site.answer.kind) {
      case "ok":
        return json(200, { id: 9, status: "draft" });
      case "gone":
        return json(404, { code: "rest_post_invalid_id" });
      case "unauthorised":
        return json(401, { code: "rest_forbidden" });
      case "server_error":
        return json(500, { code: "internal" });
      case "silent":
        return { ok: false as const, reason: "dns" as const, url, readAt: new Date() };
    }
  },
}));

import "../../harness";
import { unpublishWordPress } from "@/lib/publish/destinations/wordpress/unpublish";
import type { Publication } from "@/lib/publish/types";

const CFG = {
  baseUrl: "https://blog.example.com",
  username: "reachkit-bot",
  applicationPassword: "abcd EFGH ijkl",
};

function publication(over: Partial<Publication> = {}): Publication {
  return {
    id: "pub-1",
    draftId: "d1",
    siteId: "s1",
    destination: "wordpress",
    deliveryState: "delivered",
    attemptNo: 1,
    claimedAt: new Date("2026-09-01T09:00:00Z"),
    publishedAt: new Date("2026-09-01T09:00:01Z"),
    unpublishedAt: null,
    liveUrl: "https://blog.example.com/?p=9",
    remoteId: "9",
    failureReason: null,
    mode: "autopilot",
    unpublishOutcome: null,
    madeLiveByUs: true,
    verifyDueAt: null,
    ...over,
  };
}

const SOURCE = readFileSync(
  path.resolve(import.meta.dirname, "../../../../src/lib/publish/destinations/wordpress/unpublish.ts"),
  "utf8"
);

beforeEach(() => {
  site.requests = [];
  site.answer = { kind: "ok" };
});

describe("a page ReachKit made live is returned to draft — one write of one field", () => {
  it("the arm is returned_to_draft, and it is the ordinary outcome now", async () => {
    expect(await unpublishWordPress(publication(), CFG)).toEqual({
      ok: true,
      outcome: "returned_to_draft",
    });
  });

  it("exactly one request, and its body is the status and nothing else", async () => {
    await unpublishWordPress(publication(), CFG);
    expect(site.requests).toHaveLength(1);
    expect(site.requests[0]!.method).toBe("POST");
    expect(site.requests[0]!.path).toBe("/wp/v2/posts/9");
    expect(site.requests[0]!.body).toEqual({ status: "draft" });
  });

  it("**neither mark is stripped**: no tag write, no content write, no removal of either", async () => {
    await unpublishWordPress(publication(), CFG);
    const body = site.requests[0]!.body as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["status"]);
    expect(site.requests.filter((r) => r.path.includes("/tags"))).toHaveLength(0);
  });

  it("it is idempotent: a post already at draft is set to draft and the outcome is the same", async () => {
    await unpublishWordPress(publication(), CFG);
    const again = await unpublishWordPress(publication(), CFG);
    expect(again).toEqual({ ok: true, outcome: "returned_to_draft" });
  });
});

describe("a page ReachKit never made live is named for the customer, and not touched", () => {
  it("the arm is named_for_removal", async () => {
    expect(await unpublishWordPress(publication({ madeLiveByUs: false }), CFG)).toEqual({
      ok: true,
      outcome: "named_for_removal",
    });
  });

  it("**zero egress** — not a write, not a read, nothing at all leaves toward their site", async () => {
    await unpublishWordPress(publication({ madeLiveByUs: false }), CFG);
    expect(site.requests).toEqual([]);
  });

  it("and it is not `already_gone`: one says removing the post is theirs to do, the other that nothing is", async () => {
    const named = await unpublishWordPress(publication({ madeLiveByUs: false }), CFG);
    site.answer = { kind: "gone" };
    const gone = await unpublishWordPress(publication(), CFG);
    expect(named).not.toEqual(gone);
  });
});

describe("what the call itself finds — the two arms only it can learn", () => {
  it("a post that is no longer in their site is already_gone", async () => {
    site.answer = { kind: "gone" };
    expect(await unpublishWordPress(publication(), CFG)).toEqual({
      ok: true,
      outcome: "already_gone",
    });
  });

  it("a site that could not be reached is unreachable, ok: true, with a retry offered", async () => {
    site.answer = { kind: "silent" };
    expect(await unpublishWordPress(publication(), CFG)).toEqual({
      ok: true,
      outcome: "unreachable",
      retryOffered: true,
    });
  });

  it("a 5xx is unreachable too — the site said nothing about the post, so it may still be live there", async () => {
    site.answer = { kind: "server_error" };
    expect(await unpublishWordPress(publication(), CFG)).toMatchObject({ outcome: "unreachable" });
  });

  it("`unreachable` is never mapped to a failure: the customer's stop is taken either way", async () => {
    site.answer = { kind: "silent" };
    const result = await unpublishWordPress(publication(), CFG);
    expect(result.ok).toBe(true);
  });

  it("a credential that no longer opens the door is a failure carrying its reason", async () => {
    site.answer = { kind: "unauthorised" };
    expect(await unpublishWordPress(publication(), CFG)).toEqual({
      ok: false,
      reason: "credentials_expired",
    });
  });

  it("a row with no post id is already_gone, and nothing is asked of their site", async () => {
    expect(await unpublishWordPress(publication({ remoteId: null }), CFG)).toEqual({
      ok: true,
      outcome: "already_gone",
    });
    expect(site.requests).toEqual([]);
  });
});

describe("the discriminator is the stored fact, and the two substitutions are wrong", () => {
  it("**not `liveUrl != null`** — a never-made-live page carries an address and is still not written into", async () => {
    const result = await unpublishWordPress(
      publication({ madeLiveByUs: false, liveUrl: "https://blog.example.com/?p=9" }),
      CFG
    );
    expect(result).toEqual({ ok: true, outcome: "named_for_removal" });
    expect(site.requests).toEqual([]);
  });

  it("and the same predicate the other way: a made-live page with no address is still returned to draft", async () => {
    const result = await unpublishWordPress(publication({ liveUrl: null }), CFG);
    expect(result).toEqual({ ok: true, outcome: "returned_to_draft" });
  });

  it("**not a re-read of the post's status**: the arm is decided before anything is asked of the site", async () => {
    await unpublishWordPress(publication({ madeLiveByUs: false }), CFG);
    expect(site.requests).toEqual([]);
    site.requests = [];
    await unpublishWordPress(publication(), CFG);
    // One request, and it is the write. Nothing read the post first to
    // decide which arm to take.
    expect(site.requests.map((r) => r.method)).toEqual(["POST"]);
  });

  it("the module's code reads `madeLiveByUs` and neither of the destination's own booleans", () => {
    // Comments stripped: the header argues about both booleans at length,
    // and it is the code that must not consult them.
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).toContain("pub.madeLiveByUs");
    expect(code).not.toContain("servesPublicly");
    expect(code).not.toContain("hostedByUs");
    expect(code).not.toContain("liveUrl");
  });
});
