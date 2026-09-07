// tests/publish/destinations/wordpress/capability.test.ts — REQ-060
// criterion 7 and ADR-084 Decision 3: can this credential *publish*, not
// merely create?
//
// Two rows here are the file's reason for existing, and neither is a happy
// path:
//
//  1. **The zero-write row.** The seam throws on any non-GET, so a probe
//     that proved the capability by creating a post — the implementation a
//     WordPress developer reaches for first — fails here rather than
//     leaving a post in a customer's site whenever its tidy-up failed. The
//     probe runs in line on the read path, when a customer opens a screen.
//  2. **The not-an-error row.** A transport failure or a 5xx returns
//     neither `true` nor `false`: it rejects. An implementation that caught
//     everything into `false` would mark a working destination as unable to
//     publish and hold its queue on a network blip, while telling the
//     customer their account lacks a permission it has.
//
// The archived plan is WO-264.
import { beforeEach, describe, expect, it, vi } from "vitest";

const site = vi.hoisted(() => ({
  requests: [] as { method: string; path: string }[],
  answer: "author" as "author" | "contributor" | "no_capabilities" | "unauthorised" | "silent" | "server_error",
  refuseWrites: true,
}));

vi.mock("@/lib/egress", () => ({
  safeFetch: async (url: string, opts: Record<string, unknown>) => {
    const method = (opts.method as string) ?? "GET";
    const parsed = new URL(url);
    site.requests.push({ method, path: parsed.pathname });
    if (site.refuseWrites && method !== "GET") {
      throw new Error(`the capability probe made a ${method} to ${parsed.pathname}`);
    }
    const json = (status: number, value: unknown) => ({
      ok: true as const,
      status,
      url,
      html: JSON.stringify(value),
      bytes: 1,
      readAt: new Date(),
      headers: {},
    });
    switch (site.answer) {
      case "author":
        return json(200, { id: 3, capabilities: { edit_posts: true, publish_posts: true } });
      case "contributor":
        return json(200, { id: 4, capabilities: { edit_posts: true } });
      case "no_capabilities":
        return json(200, { id: 5, name: "someone" });
      case "unauthorised":
        return json(401, { code: "rest_not_logged_in" });
      case "server_error":
        return json(503, { code: "unavailable" });
      case "silent":
        return { ok: false as const, reason: "timeout" as const, url, readAt: new Date() };
    }
  },
}));

import "../../harness";
import {
  WordPressProbeError,
  canPublish,
  canPublishWith,
} from "@/lib/publish/destinations/wordpress/adapter";

const CFG = {
  baseUrl: "https://blog.example.com",
  username: "reachkit-bot",
  applicationPassword: "abcd EFGH ijkl",
};

beforeEach(() => {
  site.requests = [];
  site.answer = "author";
  site.refuseWrites = true;
});

describe("the answer the site gives about its own credential", () => {
  it("a credential the API reports as able to publish is true", async () => {
    expect(await canPublish(CFG)).toBe(true);
  });

  it("one reported as able to create and not to publish is false — and false is not an error", async () => {
    site.answer = "contributor";
    await expect(canPublish(CFG)).resolves.toBe(false);
  });

  it("it is one authenticated read of the credential's own account", async () => {
    await canPublish(CFG);
    expect(site.requests).toHaveLength(1);
    expect(site.requests[0]!.method).toBe("GET");
    expect(site.requests[0]!.path).toBe("/wp-json/wp/v2/users/me");
  });
});

describe("**it never creates a post to find out**", () => {
  it("no write of any kind — no post, no draft, no meta, no term", async () => {
    for (const answer of ["author", "contributor"] as const) {
      site.answer = answer;
      await canPublish(CFG);
    }
    expect(site.requests.filter((r) => r.method !== "GET")).toEqual([]);
  });
});

describe("**`false` is an answer; a read that failed is not**", () => {
  it.each(["silent", "server_error", "unauthorised", "no_capabilities"] as const)(
    "a %s read rejects rather than answering no",
    async (answer) => {
      site.answer = answer;
      await expect(canPublish(CFG)).rejects.toBeInstanceOf(WordPressProbeError);
    }
  );

  it("the rejection carries a classified reason and no part of any payload", async () => {
    site.answer = "unauthorised";
    const cause: WordPressProbeError = await canPublish(CFG).then(
      () => {
        throw new Error("the probe answered where it should have rejected");
      },
      (e: unknown) => e as WordPressProbeError
    );
    expect(cause.reason).toBe("credentials_expired");
    const emitted = `${cause.message}${cause.stack ?? ""}`;
    expect(emitted).not.toContain("rest_not_logged_in");
    expect(emitted).not.toContain(CFG.applicationPassword);
  });

  it("a config this adapter cannot read rejects, and asks the site nothing", async () => {
    await expect(canPublishWith({})).rejects.toBeInstanceOf(WordPressProbeError);
    expect(site.requests).toEqual([]);
  });
});

describe("the probe is beside `health` and never inside it", () => {
  it("they are two functions, and a site can answer one and refuse the other", async () => {
    const { WORDPRESS_ADAPTER } = await import("@/lib/publish/destinations/wordpress/adapter");
    expect(WORDPRESS_ADAPTER.canPublish).toBe(canPublishWith);
    expect(WORDPRESS_ADAPTER.canPublish).not.toBe(WORDPRESS_ADAPTER.health);
  });
});
