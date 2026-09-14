// tests/publish/destinations/wordpress/update.test.ts — §7's third asset
// kind: the page the opportunity named, rewritten where it already stands.
//
// The discriminating assertions are a count and an address: exactly one
// write, and it goes to the post's own id. A create would leave the
// customer's page untouched and publish a second one at a new address, which
// is the outcome this path exists to prevent, and it would pass any
// assertion that only read the returned delivery.
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Request {
  method: string;
  path: string;
  body: unknown;
}

const site = vi.hoisted(() => ({
  requests: [] as { method: string; path: string; body: unknown }[],
  namespaces: ["wp/v2"] as string[],
  posts: [] as Record<string, unknown>[],
  tags: [] as Record<string, unknown>[],
  searchAnswers: true,
  nextId: 100,
}));

vi.mock("@/lib/egress", () => ({
  safeFetch: async (url: string, opts: Record<string, unknown>) => {
    const parsed = new URL(url);
    const path = parsed.pathname.replace("/wp-json", "") + parsed.search;
    const method = (opts.method as string) ?? "GET";
    const body = opts.body === undefined ? null : JSON.parse(opts.body as string);
    site.requests.push({ method, path, body });

    const json = (status: number, value: unknown) => ({
      ok: true as const,
      status,
      url,
      html: JSON.stringify(value),
      bytes: 1,
      readAt: new Date(),
      headers: {},
    });

    if (path === "/") return json(200, { namespaces: site.namespaces });
    if (path.startsWith("/wp/v2/users/me")) {
      return json(200, { capabilities: { publish_posts: true, manage_categories: true } });
    }
    if (path.startsWith("/wp/v2/tags?") && method === "GET") return json(200, site.tags);

    if (path.startsWith("/wp/v2/posts?") && method === "GET") {
      if (!site.searchAnswers) {
        return { ok: false as const, reason: "timeout" as const, url, readAt: new Date() };
      }
      const params = parsed.searchParams;
      const slug = params.get("slug");
      if (slug !== null) return json(200, site.posts.filter((p) => p.slug === slug));
      const search = params.get("search") ?? "";
      return json(
        200,
        site.posts.filter((p) => JSON.stringify(p).includes(search))
      );
    }

    // The id-addressed write. Matched before the create route so the two
    // cannot be confused by a prefix.
    const addressed = /^\/wp\/v2\/posts\/(\d+)$/.exec(path);
    if (addressed !== null && method === "POST") {
      const id = Number(addressed[1]);
      const post = site.posts.find((p) => p.id === id);
      if (post === undefined) return json(404, { code: "rest_post_invalid_id" });
      const sent = body as Record<string, unknown>;
      if (typeof sent.title === "string") post.title = sent.title;
      if (typeof sent.content === "string") post.content = { raw: sent.content };
      return json(200, post);
    }

    if (path === "/wp/v2/posts" && method === "POST") {
      const sent = body as Record<string, unknown>;
      const post = {
        id: site.nextId++,
        status: "publish",
        link: `https://shop.example.com/?p=${site.nextId}`,
        slug: sent.slug as string,
        content: { raw: sent.content as string },
        tags: [],
        meta: {},
        date_gmt: "2026-09-06T09:00:00",
      };
      site.posts.push(post);
      return json(201, post);
    }
    return json(404, { code: "rest_no_route" });
  },
}));

import "../../harness";
import { WORDPRESS_ADAPTER } from "@/lib/publish/destinations/wordpress/adapter";
import { markerToken } from "@/lib/publish/destinations/wordpress/marks";

const CFG = {
  baseUrl: "https://shop.example.com",
  username: "reachkit-bot",
  applicationPassword: "abcd EFGH ijkl",
};

const OWNED = "https://shop.example.com/delivery-times";

/** The day's asset: an update to a page the customer already has. */
const UPDATE = {
  title: "How long delivery takes",
  slug: "delivery-times",
  bodyMd: "# How long delivery takes\n\nA fuller answer.",
  meta: { description: "The short of it." },
  updateOf: OWNED,
};

const writes = (): Request[] => site.requests.filter((r) => r.method !== "GET");

function theirPage(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 41,
    status: "publish",
    link: OWNED,
    slug: "delivery-times",
    title: "Delivery",
    content: { raw: "<p>Their own words.</p>" },
    tags: [],
    meta: {},
    date_gmt: "2026-09-01T09:00:00",
    ...over,
  };
}

beforeEach(() => {
  site.requests = [];
  site.namespaces = ["wp/v2"];
  site.posts = [];
  site.tags = [];
  site.searchAnswers = true;
  site.nextId = 100;
});

describe("an update changes the page that is already there", () => {
  it("writes once, to that page's own id, and never creates a second", async () => {
    site.posts = [theirPage()];

    const result = await WORDPRESS_ADAPTER.deliver(UPDATE, CFG, "d1");

    expect(result.ok).toBe(true);
    expect(result.liveUrl).toBe(OWNED);
    expect(result.remoteId).toBe("41");
    expect(writes().map((r) => r.path)).toEqual(["/wp/v2/posts/41"]);
  });

  it("records that ReachKit did not make their page live", async () => {
    site.posts = [theirPage()];

    const result = await WORDPRESS_ADAPTER.deliver(UPDATE, CFG, "d1");

    // `made_live_by_us` is what `unpublish` reads to decide whether it may
    // touch the page at all, so an update must never claim authorship.
    expect(result.madeLive).toBe(false);
  });

  it("carries the rewritten body, marked so a retry can find it", async () => {
    site.posts = [theirPage()];

    await WORDPRESS_ADAPTER.deliver(UPDATE, CFG, "d1");

    const sent = writes()[0]?.body as { content: string };
    expect(sent.content).toContain("A fuller answer.");
    expect(sent.content).toContain(markerToken("d1"));
  });

  it("sends no status, so no update can publish or retire a page", async () => {
    site.posts = [theirPage()];

    await WORDPRESS_ADAPTER.deliver(UPDATE, CFG, "d1");

    expect(Object.keys(writes()[0]?.body as Record<string, unknown>)).not.toContain("status");
  });
});

describe("an update with nothing to change", () => {
  it("is refused when no page of theirs stands at that address", async () => {
    site.posts = [theirPage({ link: "https://shop.example.com/somewhere-else" })];

    const result = await WORDPRESS_ADAPTER.deliver(UPDATE, CFG, "d1");

    expect(result).toEqual({ ok: false, madeLive: false, reason: "destination_rejected" });
    expect(writes()).toEqual([]);
  });

  it("is refused, never created, when the site has no such page at all", async () => {
    const result = await WORDPRESS_ADAPTER.deliver(UPDATE, CFG, "d1");

    expect(result.ok).toBe(false);
    expect(writes()).toEqual([]);
  });

  it("fails rather than writing when the lookup could not be read", async () => {
    site.searchAnswers = false;

    const result = await WORDPRESS_ADAPTER.deliver(UPDATE, CFG, "d1");

    expect(result.ok).toBe(false);
    expect(writes()).toEqual([]);
  });
});

describe("a retried update", () => {
  it("finds the page it already rewrote and writes nothing again", async () => {
    site.posts = [
      theirPage({ content: { raw: `<p>A fuller answer.</p>\n\n<!-- ${markerToken("d1")} -->` } }),
    ];

    const result = await WORDPRESS_ADAPTER.deliver(UPDATE, CFG, "d1");

    expect(result.ok).toBe(true);
    expect(result.liveUrl).toBe(OWNED);
    expect(result.madeLive).toBe(false);
    expect(writes()).toEqual([]);
  });
});
