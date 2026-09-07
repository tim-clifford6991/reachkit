// tests/publish/destinations/wordpress/seo.test.ts — REQ-060 criteria 3
// and 4: the plugins are **detected, never assumed**, and neither present
// is a success.
//
// The discriminating row is the last one: an implementation that treated a
// missing SEO plugin as a failed delivery would pass every detection row
// here and fail that one. The page is in the customer's site; saying
// otherwise would be false.
//
// The archived plan is WO-238.
import { beforeEach, describe, expect, it, vi } from "vitest";

const site = vi.hoisted(() => ({
  reads: 0,
  namespaces: ["wp/v2"] as string[] | undefined,
  answers: true,
  body: null as unknown,
}));

vi.mock("@/lib/egress", () => ({
  safeFetch: async (url: string) => {
    site.reads += 1;
    if (!site.answers) return { ok: false as const, reason: "dns" as const, url, readAt: new Date() };
    return {
      ok: true as const,
      status: 200,
      url,
      html: JSON.stringify(site.body ?? { namespaces: site.namespaces }),
      bytes: 1,
      readAt: new Date(),
      headers: {},
    };
  },
}));

import "../../harness";
import {
  NO_SEO_PLUGIN_LINE,
  detectSeoPlugins,
  seoMetaFor,
  seoWrittenIn,
} from "@/lib/publish/destinations/wordpress/seo";
import { COPY } from "@/lib/presentation/copy/registry";

const CFG = {
  baseUrl: "https://blog.example.com",
  username: "reachkit-bot",
  applicationPassword: "abcd EFGH ijkl",
};
const PAGE = { title: "How to choose a kiln", description: "The short of it." };

beforeEach(() => {
  site.reads = 0;
  site.namespaces = ["wp/v2"];
  site.answers = true;
  site.body = null;
});

describe("detection is a read of the site's own REST index", () => {
  it("both plugins present means both", async () => {
    site.namespaces = ["wp/v2", "yoast/v1", "rankmath/v1"];
    expect(await detectSeoPlugins(CFG)).toEqual(["yoast", "rankmath"]);
  });

  it.each([
    [["wp/v2", "yoast/v1"], ["yoast"]],
    [["wp/v2", "rankmath/v1"], ["rankmath"]],
  ])("one present means one", async (namespaces, expected) => {
    site.namespaces = namespaces;
    expect(await detectSeoPlugins(CFG)).toEqual(expected);
  });

  it("neither present is the empty list, and not an error", async () => {
    expect(await detectSeoPlugins(CFG)).toEqual([]);
  });

  it("exactly one read per delivery, and nothing is cached across two", async () => {
    await detectSeoPlugins(CFG);
    expect(site.reads).toBe(1);
    site.namespaces = ["wp/v2", "yoast/v1"];
    expect(await detectSeoPlugins(CFG)).toEqual(["yoast"]);
    expect(site.reads).toBe(2);
  });

  it("it never assumes from a version string — only the routes the site says it serves", async () => {
    site.body = { namespaces: ["wp/v2"], yoast: { version: "22.4" }, description: "rankmath installed" };
    expect(await detectSeoPlugins(CFG)).toEqual([]);
  });

  it("a site that did not answer yields no plugins rather than a guess", async () => {
    site.answers = false;
    expect(await detectSeoPlugins(CFG)).toEqual([]);
  });
});

describe("the fields that ride the create request", () => {
  it("each detected plugin contributes its own two keys, and no plugin that is absent does", () => {
    expect(seoMetaFor(["yoast"], PAGE)).toEqual({
      _yoast_wpseo_title: PAGE.title,
      _yoast_wpseo_metadesc: PAGE.description,
    });
    expect(seoMetaFor(["rankmath"], PAGE)).toEqual({
      rank_math_title: PAGE.title,
      rank_math_description: PAGE.description,
    });
    expect(seoMetaFor([], PAGE)).toEqual({});
  });

  it("a page with no description of its own contributes none", () => {
    expect(seoMetaFor(["yoast"], { title: PAGE.title, description: "" })).toEqual({
      _yoast_wpseo_title: PAGE.title,
    });
  });
});

describe("what was written is read back from the post, never inferred from what was sent", () => {
  it("a plugin whose fields came back is written", () => {
    const post = { meta: { _yoast_wpseo_title: PAGE.title, _yoast_wpseo_metadesc: PAGE.description } };
    expect(seoWrittenIn(["yoast"], post, PAGE)).toEqual(["yoast"]);
  });

  it("a plugin whose fields the site dropped is not", () => {
    expect(seoWrittenIn(["yoast", "rankmath"], { meta: {} }, PAGE)).toEqual([]);
  });

  it("a post with no meta at all is no plugins written, and no throw", () => {
    expect(seoWrittenIn(["yoast"], { id: 9 }, PAGE)).toEqual([]);
    expect(seoWrittenIn(["yoast"], null, PAGE)).toEqual([]);
  });

  it("one written and one dropped is exactly one", () => {
    const post = { meta: { rank_math_title: PAGE.title, rank_math_description: PAGE.description } };
    expect(seoWrittenIn(["yoast", "rankmath"], post, PAGE)).toEqual(["rankmath"]);
  });
});

describe("REQ-060 c4 — the line, and it is a key rather than a sentence", () => {
  it("the module names a registry key and writes no sentence of its own", () => {
    expect(NO_SEO_PLUGIN_LINE).toBe("publish.wordpress.noSeoPlugin");
    expect(Object.keys(COPY)).toContain(NO_SEO_PLUGIN_LINE);
  });
});
