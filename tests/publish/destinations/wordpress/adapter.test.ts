// tests/publish/destinations/wordpress/adapter.test.ts — one create call
// that publishes live, at most one post per (draft, destination), and the
// two booleans that first differ here.
//
// The fixture is a small WordPress that answers at the egress seam, so the
// assertions below are about the **requests that actually left**: the
// discriminating one is a *count* — exactly one write to the post — because
// a create-then-publish two-step would otherwise read as a harmless
// follow-up and pass every functional row in this file (ADR-084 Decision 1).
//
// The archived plans are WO-237, WO-264.
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
  createStatus: "publish" as string,
  createdMeta: true,
  tagsWritable: true,
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
    if (path.startsWith("/wp/v2/users/me")) return json(200, { capabilities: { publish_posts: true } });
    if (path.startsWith("/wp/v2/tags?") && method === "GET") {
      return json(200, site.tags);
    }
    if (path === "/wp/v2/tags" && method === "POST") {
      if (!site.tagsWritable) return json(403, { code: "rest_cannot_create" });
      const tag = { id: 7, slug: (body as { slug: string }).slug };
      site.tags.push(tag);
      return json(201, tag);
    }
    if (path.startsWith("/wp/v2/posts?") && method === "GET") {
      if (!site.searchAnswers) return { ok: false as const, reason: "timeout" as const, url, readAt: new Date() };
      const search = new URL(url).searchParams.get("search") ?? "";
      return json(
        200,
        site.posts.filter((p) => JSON.stringify(p).includes(search))
      );
    }
    if (path === "/wp/v2/posts" && method === "POST") {
      const sent = body as Record<string, unknown>;
      const post = {
        id: site.nextId++,
        status: site.createStatus,
        link: `https://blog.example.com/?p=${site.nextId}`,
        content: { raw: sent.content as string },
        tags: (sent.tags as number[]) ?? [],
        meta: site.createdMeta ? ((sent.meta as Record<string, string>) ?? {}) : {},
        date_gmt: "2026-09-06T09:00:00",
      };
      site.posts.push(post);
      return json(201, post);
    }
    return json(404, { code: "rest_no_route" });
  },
}));

import "../../harness";
import {
  WORDPRESS_ADAPTER,
  canPublish,
  type WordPressDelivery,
} from "@/lib/publish/destinations/wordpress/adapter";
import { unpublishWordPress } from "@/lib/publish/destinations/wordpress/unpublish";
import { markerToken } from "@/lib/publish/destinations/wordpress/marks";
import { WORDPRESS } from "@/lib/config/constants";

const CFG = {
  baseUrl: "https://blog.example.com",
  username: "reachkit-bot",
  applicationPassword: "abcd EFGH ijkl",
};

const PAGE = {
  title: "How to choose a kiln",
  slug: "how-to-choose-a-kiln",
  bodyMd: "# How to choose a kiln\n\nA body.",
  meta: { description: "The short of it." },
};

const writes = (): Request[] => site.requests.filter((r) => r.method !== "GET");
const postWrites = (): Request[] => writes().filter((r) => r.path.startsWith("/wp/v2/posts"));

beforeEach(() => {
  site.requests = [];
  site.namespaces = ["wp/v2"];
  site.posts = [];
  site.tags = [];
  site.createStatus = "publish";
  site.createdMeta = true;
  site.tagsWritable = true;
  site.searchAnswers = true;
  site.nextId = 100;
});

describe("ADR-084 Decision 2 — two booleans, and this adapter is where they first differ", () => {
  it("it serves publicly: the page carries a live address, is verified and is judged", () => {
    expect(WORDPRESS_ADAPTER.servesPublicly).toBe(true);
  });

  it("ReachKit does not run it, which is what keeps the `removed` arm hosted-only", () => {
    expect(WORDPRESS_ADAPTER.hostedByUs).toBe(false);
  });

  it("they are two fields and a merge of them fails here", () => {
    expect(WORDPRESS_ADAPTER.servesPublicly).not.toBe(WORDPRESS_ADAPTER.hostedByUs);
  });
});

describe("ADR-084 Decision 1 — one create call, live, and no second write to that post", () => {
  it("the page is created with `status: publish` in one request", async () => {
    const result = (await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1")) as WordPressDelivery;
    expect(result.ok).toBe(true);
    const creates = postWrites();
    expect(creates).toHaveLength(1);
    expect((creates[0]!.body as { status: string }).status).toBe("publish");
  });

  it("**no second write to that post** — asserted as a count, so a two-step fails here", async () => {
    await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1");
    expect(postWrites()).toHaveLength(1);
    expect(writes().filter((r) => /\/wp\/v2\/posts\/\d+/.test(r.path))).toHaveLength(0);
  });

  it("the address is the permalink the site returned, never one recomputed from the slug", async () => {
    const result = (await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1")) as WordPressDelivery;
    // The fixture returns a permalink no slug derivation would produce.
    expect(result.liveUrl).toBe("https://blog.example.com/?p=101");
    expect(result.liveUrl).not.toContain(PAGE.slug);
  });

  it("`madeLive` is true on every successful return, and the post id comes back as the remote id", async () => {
    const result = (await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1")) as WordPressDelivery;
    expect(result.madeLive).toBe(true);
    expect(result.remoteId).toBe("100");
  });

  it("a WordPressDelivery that claims it made nothing live is a type error", () => {
    // `madeLive` is narrowed to `true` by type; widening it back to
    // boolean is what would let a delivery be reported as published with
    // nothing live behind it.
    const impossible: WordPressDelivery = {
      ok: true,
      // @ts-expect-error — see above.
      madeLive: false,
      liveUrl: "https://blog.example.com/x",
      remoteId: "1",
      seoWritten: [],
      stampApplied: true,
      deliveredAt: new Date(),
    };
    expect(impossible.remoteId).toBe("1");
  });
});

describe("ADR-086 Decision 5 — a create that came back not published", () => {
  it.each(["draft", "pending"])("a 201 whose post is `%s` fails credentials_invalid, and delivers nothing", async (status) => {
    site.createStatus = status;
    const result = await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1");
    expect(result).toEqual({ ok: false, madeLive: false, reason: "credentials_invalid" });
    expect(result.liveUrl).toBeUndefined();
  });

  it("and never credentials_expired — the state that would offer the one remedy that cannot work", async () => {
    site.createStatus = "draft";
    const result = await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1");
    expect(result.reason).not.toBe("credentials_expired");
  });

  it("no post ReachKit reports as published is left standing as a draft: the retry finds it and still refuses", async () => {
    site.createStatus = "draft";
    await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1");
    site.requests = [];
    const again = await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1");
    expect(again).toEqual({ ok: false, madeLive: false, reason: "credentials_invalid" });
    expect(postWrites()).toHaveLength(0);
  });
});

describe("ADR-080 — the marker is the half of the at-most-once guarantee that lives in their site", () => {
  it("a second delivery after an answer we never recorded finds the post and creates no second one", async () => {
    const first = (await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1")) as WordPressDelivery;
    site.requests = [];
    const second = (await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1")) as WordPressDelivery;
    expect(postWrites()).toHaveLength(0);
    expect(second.remoteId).toBe(first.remoteId);
    expect(second.liveUrl).toBe(first.liveUrl);
    expect(site.posts).toHaveLength(1);
  });

  it("the marker is written at creation, on our own post, and names the draft", async () => {
    await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1");
    const created = postWrites()[0]!.body as { content: string };
    expect(created.content).toContain(markerToken("draft-1"));
    expect(created.content.startsWith(PAGE.bodyMd)).toBe(true);
  });

  it("**the search looks for the marker and never for the stamp**: a post whose tag the customer removed is still found", async () => {
    await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1");
    site.posts[0]!.tags = [];
    site.requests = [];
    const again = (await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1")) as WordPressDelivery;
    expect(postWrites()).toHaveLength(0);
    expect(again.remoteId).toBe("100");
  });

  it("another draft's post is not this draft's, however loosely the site's search ranks", async () => {
    await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1");
    site.requests = [];
    await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-2");
    expect(postWrites()).toHaveLength(1);
    expect(site.posts).toHaveLength(2);
  });

  it("a search that could not be answered creates nothing — the second article is not risked on a silence", async () => {
    site.searchAnswers = false;
    const result = await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1");
    expect(result.ok).toBe(false);
    expect(postWrites()).toHaveLength(0);
    expect(site.posts).toHaveLength(0);
  });
});

describe("ADR-083 — the findability stamp, in the create call and never afterwards", () => {
  it("the post carries the stamp term, assigned in the create request", async () => {
    const result = (await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1")) as WordPressDelivery;
    const created = postWrites().find((r) => r.path === "/wp/v2/posts")!;
    expect((created.body as { tags: number[] }).tags).toEqual([7]);
    expect(result.stampApplied).toBe(true);
    expect(site.tags[0]).toMatchObject({ slug: WORDPRESS.stampSlug });
  });

  it("a site that will not take the term still gets its page, and the delivery says the stamp is not on it", async () => {
    site.tagsWritable = false;
    const result = (await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1")) as WordPressDelivery;
    expect(result.ok).toBe(true);
    expect(result.stampApplied).toBe(false);
    expect(result.liveUrl).toBe("https://blog.example.com/?p=101");
  });

  it("an existing term is used rather than a second one created", async () => {
    site.tags = [{ id: 42, slug: WORDPRESS.stampSlug }];
    const result = (await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1")) as WordPressDelivery;
    expect(writes().filter((r) => r.path === "/wp/v2/tags")).toHaveLength(0);
    expect(result.stampApplied).toBe(true);
  });
});

describe("REQ-060 c3 and c4 — the SEO fields ride the create, and neither plugin is a success", () => {
  it("with Yoast present its two fields are in the create body and come back written", async () => {
    site.namespaces = ["wp/v2", "yoast/v1"];
    const result = (await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1")) as WordPressDelivery;
    const meta = (postWrites()[0]!.body as { meta: Record<string, string> }).meta;
    expect(meta._yoast_wpseo_title).toBe(PAGE.title);
    expect(meta._yoast_wpseo_metadesc).toBe(PAGE.meta.description);
    expect(result.seoWritten).toEqual(["yoast"]);
  });

  it("with neither present the page is still delivered and nothing was written", async () => {
    const result = (await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1")) as WordPressDelivery;
    expect(result.ok).toBe(true);
    expect(result.seoWritten).toEqual([]);
  });

  it("a site that accepted the post and dropped the meta is a delivered page with nothing written", async () => {
    site.namespaces = ["wp/v2", "rankmath/v1"];
    site.createdMeta = false;
    const result = (await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1")) as WordPressDelivery;
    expect(result.ok).toBe(true);
    expect(result.seoWritten).toEqual([]);
  });

  it("detection happens before the create, so the fields can ride it", async () => {
    site.namespaces = ["wp/v2", "yoast/v1"];
    await WORDPRESS_ADAPTER.deliver(PAGE, CFG, "draft-1");
    const index = site.requests.findIndex((r) => r.path === "/");
    const create = site.requests.findIndex((r) => r.path === "/wp/v2/posts" && r.method === "POST");
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(create);
  });
});

describe("a credential this adapter cannot read is not a thing to retry", () => {
  it.each([{}, { baseUrl: "https://x.example" }, { baseUrl: "", username: "u", applicationPassword: "p" }])(
    "a config missing what a WordPress call needs fails credentials_invalid and sends nothing",
    async (cfg) => {
      const result = await WORDPRESS_ADAPTER.deliver(PAGE, cfg, "draft-1");
      expect(result).toEqual({ ok: false, madeLive: false, reason: "credentials_invalid" });
      expect(site.requests).toHaveLength(0);
    }
  );
});

describe("the health read makes no write to the customer's site", () => {
  it("a WordPress REST index that answers is ok, with no reason and no write", async () => {
    expect(await WORDPRESS_ADAPTER.health(CFG)).toEqual({ health: "ok", reason: null });
    expect(writes()).toHaveLength(0);
  });

  it("an address that answers 200 with something that is not a REST index is not `ok`", async () => {
    site.namespaces = undefined as unknown as string[];
    expect(await WORDPRESS_ADAPTER.health(CFG)).toEqual({
      health: "error",
      reason: "destination_rejected",
    });
  });

  it("it asks nothing about publishing — that is the probe's question, beside it and never inside it", async () => {
    await WORDPRESS_ADAPTER.health(CFG);
    expect(site.requests.filter((r) => r.path.startsWith("/wp/v2/users/me"))).toHaveLength(0);
  });
});

describe("the adapter's unpublish is the module that owns the four arms", () => {
  it("it is `unpublishWordPress`, bound and not re-implemented", () => {
    expect(WORDPRESS_ADAPTER.unpublish).toBe(unpublishWordPress);
  });
});

describe("the capability probe reads, and never writes", () => {
  it("a credential the site reports as able to publish is true, by one read", async () => {
    expect(await canPublish(CFG)).toBe(true);
    expect(writes()).toHaveLength(0);
    expect(site.posts).toHaveLength(0);
  });
});
