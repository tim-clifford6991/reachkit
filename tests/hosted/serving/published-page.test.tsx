/** @vitest-environment jsdom */
// tests/hosted/serving/published-page.test.tsx — UI-SPEC S19, REQ-059, issue #375
//
// **What the customer's own page looks like**, which until now nothing
// asserted: the head and the schema are `tests/hosted/indexing/head.test.tsx`'s
// and are not re-tested here. This file is the set's own structure — their
// mark and name, the category they chose, the title, the byline, the body
// with §8's passage marked and its source under it, the canonical note, and
// their footer line — plus the two properties that make it *theirs*: every
// value on the surface is the customer's, and nothing on it is the
// product's colour.
//
// The page is called directly and rendered to static markup, the same
// convention `head.test.tsx` uses, so there is no browser here and no
// second renderer: what is asserted is the HTML a visitor's first byte
// carries.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const state: { host: string; page: unknown } = { host: "content.example.com", page: null };

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: state.host }),
}));

vi.mock("@/lib/account/billing", () => ({
  hostedServingState: async () => ({ serve: true }),
}));

vi.mock("@/lib/publish/destinations/hosted", async () => {
  const address = await import("@/lib/publish/destinations/hosted/address");
  return {
    liveUrlFor: address.liveUrlFor,
    hostedHostFor: address.hostedHostFor,
    tags: { site: (s: string) => `hosted:site:${s}`, page: (p: string) => `hosted:page:${p}` },
    hostedSiteForDomain: async (domain: string) =>
      domain === "example.com" ? { siteId: "site-1", domain } : null,
    livePageBySlug: async () => state.page,
    livePagesForSite: async () => (state.page === null ? [] : [state.page]),
    wasEverLive: async () => false,
  };
});

const Page = (await import("@/app/(hosted)/hosted-page/[...slug]/page")).default;
const { COPY } = await import("@/lib/presentation/copy");

const PASSAGE = "a non-engineer can ship a change";

/** One live page, with everything S19 draws: a category, a stated zone, a
 *  recorded grounding whose passage occurs in the body verbatim. */
function livePage(over: Record<string, unknown> = {}): unknown {
  return {
    publicationId: "pub-1",
    siteId: "site-1",
    slug: "a-page",
    title: "The best onboarding tools",
    bodyMd: `Teams pick a tool on one question: whether ${PASSAGE}.\n\n## What to look for\n\nTime to the first flow.`,
    faq: [],
    grounded: {
      passage: PASSAGE,
      url: "https://example.org/onboarding-tools-compared",
      readAt: new Date("2026-08-28T00:00:00.000Z"),
    },
    publisher: {
      name: "example.com",
      category: "user onboarding software",
      timeZone: "America/New_York",
    },
    publishedAt: new Date("2026-09-04T11:00:00.000Z"),
    liveUrl: "https://content.example.com/a-page",
    record: {
      opportunityId: "opp-1",
      targetQuery: "best onboarding tools",
      measuredOn: new Date("2026-08-28T00:00:00.000Z"),
      mode: "autopilot",
      liveUrl: "https://content.example.com/a-page",
    },
    ...over,
  };
}

async function render(): Promise<string> {
  const tree = await Page({ params: Promise.resolve({ slug: ["a-page"] }) });
  return renderToStaticMarkup(tree);
}

beforeEach(() => {
  state.host = "content.example.com";
  state.page = livePage();
});

describe("S19 — the customer is the publisher, and the page says so", () => {
  it("their mark and their name lead the page, and the address is beside it", async () => {
    const html = await render();
    expect(html).toContain('class="rk-hosted-brand"');
    expect(html).toContain('class="rk-hosted-mark"');
    expect(html).toContain(">example.com</span>");
    // The host the page answers at, taken off the canonical rather than
    // composed a second time.
    expect(html).toContain("content.example.com");
  });

  it("the category they chose is the eyebrow, and a site that chose none draws none", async () => {
    expect(await render()).toContain('class="eyebrow">user onboarding software');

    state.page = livePage({
      publisher: { name: "example.com", category: null, timeZone: "America/New_York" },
    });
    const html = await render();
    expect(html).not.toContain('class="eyebrow"');
    // And the page still renders: an unstated category withholds an
    // eyebrow, never the page.
    expect(html).toContain("The best onboarding tools");
  });

  it("the byline is the set's own line, in the zone the customer publishes in", async () => {
    // 11:00 UTC on 4 Sep is 07:00 in New York, so the day is the same one
    // either way — and the zone is still read, which the next case proves.
    expect(await render()).toContain("published 4 Sep 2026 · by example.com");
  });

  it("a moment that falls on a different day in the customer's zone is written in theirs", async () => {
    // 01:00 UTC on 5 Sep is 21:00 on the 4th in New York. The page states
    // the customer's day, not the server's.
    state.page = livePage({ publishedAt: new Date("2026-09-05T01:00:00.000Z") });
    expect(await render()).toContain("published 4 Sep 2026");
  });

  it("a site with no stated zone still states its date, in UTC rather than in one nobody chose", async () => {
    // REQ-073 c1 forbids inventing a zone. A page that withheld its own
    // publication date because a setting was blank would be worse than one
    // that states the day it is in UTC.
    state.page = livePage({
      publishedAt: new Date("2026-09-05T01:00:00.000Z"),
      publisher: { name: "example.com", category: null, timeZone: null },
    });
    expect(await render()).toContain("published 5 Sep 2026");
  });

  it("§8's recorded passage is marked in the body, and its source stated under it", async () => {
    const html = await render();
    expect(html).toContain(`<mark class="bg-warning/25 rounded px-1">${PASSAGE}</mark>`);
    // 00:00 UTC on the 28th is 20:00 on the 27th in New York: the source's
    // date is written in the customer's zone too, so the two dates on the
    // page are read the same way.
    expect(html).toContain(
      "source: https://example.org/onboarding-tools-compared · retrieved 27 Aug 2026"
    );
  });

  it("a passage the body no longer carries marks nothing, and says nothing about a source", async () => {
    // REQ-045 c8's rule, on the published side: a fact that did not survive
    // the edit is a fact the page is no longer grounded in. The body renders
    // whole and unmarked — never the nearest thing to the passage.
    state.page = livePage({ bodyMd: "A body the recorded passage is not in." });
    const html = await render();
    expect(html).not.toContain("<mark");
    expect(html).toContain("A body the recorded passage is not in.");
  });

  it("a page with no recorded grounding draws no source line at all", async () => {
    state.page = livePage({ grounded: null });
    const html = await render();
    expect(html).not.toContain("source:");
    expect(html).not.toContain("<mark");
  });

  it("the canonical note names their domain, their address and our noindex", async () => {
    expect(await render()).toContain(
      "Written for example.com. Canonical: https://content.example.com/a-page · noindex on *.reachkit.app"
    );
  });

  it("the footer is theirs", async () => {
    expect(await render()).toContain("© example.com");
  });

  it("every sentence on the page is a key, and every one of the four is written", async () => {
    // Rule 6 of UI-SPEC §4, on the one surface that had no key at all
    // before this issue. Written, not owed: the set spells all four
    // unbracketed (11a).
    for (const key of [
      "hosted.published",
      "hosted.source",
      "hosted.canonical",
      "hosted.footer",
    ] as const) {
      expect(COPY[key]).not.toBe("");
      expect(COPY[key]).not.toContain("TODO(copy)");
    }
  });
});

describe("nothing of ours is on a domain that is not ours", () => {
  it("no accent: the product's colour appears nowhere on the customer's page", async () => {
    // `--accent` is the product and the customer's own series (§2.1). On a
    // stranger's domain it would be our branding, so the mark is `--ink`
    // and no class this page spends resolves to the accent.
    const html = await render();
    expect(html).not.toContain("--accent");
    expect(html).not.toContain("rk-wordmark");
    expect(html).not.toContain("btn-primary");
  });

  it("no measure, size or colour is written as a literal on this surface", async () => {
    // The token gate (#349) sweeps inline styles; this asserts the shape
    // that keeps it satisfied — the page carries classes and no `style`
    // attribute of its own.
    expect(await render()).not.toContain("style=");
  });

  it("the whole document is in the HTML at first byte, with no script but the data block", async () => {
    // REQ-062 c1's property, at the source. The FAQ arm is off here, so
    // there is no script element at all.
    const html = await render();
    expect(html).not.toContain("<script");
  });
});
