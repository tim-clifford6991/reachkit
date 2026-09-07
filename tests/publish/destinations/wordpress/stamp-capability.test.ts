// tests/publish/destinations/wordpress/stamp-capability.test.ts — issue
// #160, ADR-083 Decision 4 and REQ-060 criterion 6: can this site carry the
// findability stamp?
//
// The file exists for three rows that are not happy paths:
//
//  1. **The two probes are two probes.** A site that publishes and refuses
//     the term, and a site that takes the term and refuses to publish, both
//     appear below and each gets one `true` and one `false`. An
//     implementation returning a capability *set* — the obvious
//     simplification — passes neither row without a caller somewhere
//     choosing which member to gate on, which is the choice the issue's own
//     note forbids offering.
//  2. **The zero-write row.** The seam throws on any non-GET, so a probe
//     that proved the capability by creating the term would fail here
//     rather than leave a `reachkit` tag in every site ever asked about,
//     including the ones that publish nothing.
//  3. **The not-an-error row.** A transport failure or a 5xx returns
//     neither `true` nor `false`: it rejects, and the check records
//     nothing, so the last real answer stands.
import { beforeEach, describe, expect, it, vi } from "vitest";

const site = vi.hoisted(() => ({
  requests: [] as { method: string; path: string }[],
  answer: "editor" as
    | "editor"
    | "author"
    | "term_only"
    | "no_capabilities"
    | "unauthorised"
    | "silent"
    | "server_error",
  refuseWrites: true,
}));

vi.mock("@/lib/egress", () => ({
  safeFetch: async (url: string, opts: Record<string, unknown>) => {
    const method = (opts.method as string) ?? "GET";
    const parsed = new URL(url);
    site.requests.push({ method, path: parsed.pathname });
    if (site.refuseWrites && method !== "GET") {
      throw new Error(`the stamp probe made a ${method} to ${parsed.pathname}`);
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
      case "editor":
        // Publishes and manages terms.
        return json(200, {
          id: 3,
          capabilities: { edit_posts: true, publish_posts: true, manage_categories: true },
        });
      case "author":
        // Publishes and will not take the term.
        return json(200, { id: 4, capabilities: { edit_posts: true, publish_posts: true } });
      case "term_only":
        // Takes the term and will not publish.
        return json(200, { id: 5, capabilities: { edit_posts: true, manage_categories: true } });
      case "no_capabilities":
        return json(200, { id: 6, name: "someone" });
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
  WORDPRESS_ADAPTER,
  WordPressProbeError,
  canPublish,
  canStamp,
  canStampWith,
} from "@/lib/publish/destinations/wordpress/adapter";

const CFG = {
  baseUrl: "https://blog.example.com",
  username: "reachkit-bot",
  applicationPassword: "abcd EFGH ijkl",
};

beforeEach(() => {
  site.requests = [];
  site.answer = "editor";
  site.refuseWrites = true;
});

describe("the answer the site gives about carrying the stamp", () => {
  it("a credential the API reports as able to manage terms is true", async () => {
    expect(await canStamp(CFG)).toBe(true);
  });

  it("one that publishes and cannot manage terms is false — and false is not an error", async () => {
    site.answer = "author";
    await expect(canStamp(CFG)).resolves.toBe(false);
  });

  it("it is one authenticated read of the credential's own account", async () => {
    await canStamp(CFG);
    expect(site.requests).toHaveLength(1);
    expect(site.requests[0]!.method).toBe("GET");
    expect(site.requests[0]!.path).toBe("/wp-json/wp/v2/users/me");
  });
});

describe("**two questions, two answers** — the probes never merge", () => {
  it("a site that publishes and refuses the term answers true to one and false to the other", async () => {
    site.answer = "author";
    expect(await canPublish(CFG)).toBe(true);
    expect(await canStamp(CFG)).toBe(false);
  });

  it("a site that takes the term and refuses to publish answers the other way round", async () => {
    site.answer = "term_only";
    expect(await canPublish(CFG)).toBe(false);
    expect(await canStamp(CFG)).toBe(true);
  });

  it("the adapter declares them as two members, and neither is the other", () => {
    expect(WORDPRESS_ADAPTER.canStamp).toBe(canStampWith);
    expect(WORDPRESS_ADAPTER.canStamp).not.toBe(WORDPRESS_ADAPTER.canPublish);
    expect(WORDPRESS_ADAPTER.canStamp).not.toBe(WORDPRESS_ADAPTER.health);
  });
});

describe("**it never writes a term to find out**", () => {
  it("no write of any kind — no term, no post, no meta", async () => {
    for (const answer of ["editor", "author", "term_only"] as const) {
      site.answer = answer;
      await canStamp(CFG);
    }
    expect(site.requests.filter((r) => r.method !== "GET")).toEqual([]);
  });
});

describe("**`false` is an answer; a read that failed is not**", () => {
  it.each(["silent", "server_error", "unauthorised", "no_capabilities"] as const)(
    "a %s read rejects rather than answering no",
    async (answer) => {
      site.answer = answer;
      await expect(canStamp(CFG)).rejects.toBeInstanceOf(WordPressProbeError);
    }
  );

  it("the rejection carries a classified reason and no part of any payload", async () => {
    site.answer = "unauthorised";
    const cause: WordPressProbeError = await canStamp(CFG).then(
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
    await expect(canStampWith({})).rejects.toBeInstanceOf(WordPressProbeError);
    expect(site.requests).toEqual([]);
  });
});
