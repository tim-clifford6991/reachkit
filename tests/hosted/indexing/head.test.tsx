/** @vitest-environment jsdom */
// tests/hosted/indexing/head.test.tsx — BUILD §9, REQ-059 c3, issue #49
//
// The hosted page's head and its structured data: the canonical is on the
// customer's own domain, and `FAQPage` appears exactly when the stored
// section is there.
//
// The row that matters most is the negative one: a page with no
// question-and-answer section emits **no markup at all** — never an empty
// `FAQPage`, which would be a structured claim about a section that is not
// on the page, on a domain that is not ours.
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
const { generateMetadata } = await import("@/app/(hosted)/hosted-page/[...slug]/page");

function livePage(faq: { question: string; answer: string }[]): unknown {
  return {
    publicationId: "pub-1",
    siteId: "site-1",
    slug: "a-page",
    title: "The best onboarding tools",
    bodyMd: "One paragraph.\n\n## A heading\n\nAnother paragraph.",
    faq,
    publishedAt: new Date("2026-09-01T09:00:00.000Z"),
    liveUrl: "https://content.example.com/a-page",
    record: {
      opportunityId: "opp-1",
      targetQuery: "best onboarding tools",
      measuredOn: new Date("2026-08-28T00:00:00.000Z"),
      mode: "autopilot",
      liveUrl: "https://content.example.com/a-page",
    },
  };
}

async function render(): Promise<string> {
  const tree = await Page({ params: Promise.resolve({ slug: ["a-page"] }) });
  return renderToStaticMarkup(tree);
}

beforeEach(() => {
  state.host = "content.example.com";
  state.page = livePage([{ question: "How long does it take?", answer: "Under an hour." }]);
});

describe("REQ-059 c3 — the canonical is on the customer's own domain", () => {
  it("it names content.{their domain}/{slug}, never a ReachKit address", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: ["a-page"] }) });
    expect(metadata.alternates?.canonical).toBe("https://content.example.com/a-page");
    expect(String(metadata.alternates?.canonical)).not.toContain("reachkit");
  });

  it("the title is the customer's page title, not a sentence of ours", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: ["a-page"] }) });
    expect(metadata.title).toBe("The best onboarding tools");
  });

  it("an address with no page declares nothing at all", async () => {
    state.page = null;
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: ["a-page"] }) });
    expect(metadata).toEqual({});
  });
});

describe("REQ-059 c3 — FAQPage exactly where the data is, and nowhere else", () => {
  it("a page with a stored section is marked up as such", async () => {
    const html = await render();
    expect(html).toContain('type="application/ld+json"');
    const schema = JSON.parse(jsonLdOf(html)) as Record<string, unknown>;
    expect(schema["@type"]).toBe("FAQPage");
    expect(schema["@id"]).toBe("https://content.example.com/a-page#faq");
    expect(schema.mainEntity).toEqual([
      {
        "@type": "Question",
        name: "How long does it take?",
        acceptedAnswer: { "@type": "Answer", text: "Under an hour." },
      },
    ]);
  });

  it("a page without one emits no markup at all — never an empty FAQPage", async () => {
    state.page = livePage([]);
    const html = await render();
    expect(html).not.toContain("application/ld+json");
    expect(html).not.toContain("FAQPage");
  });

  it("the schema is emitted from the stored section, not from parsing the body", async () => {
    // The body carries a `## A heading` and the stored section is empty: a
    // render-time heading heuristic would have to invent a question from
    // it, and there is none to invent from. The heading still renders as a
    // heading — it is the customer's own content — and no schema does.
    state.page = livePage([]);
    const withoutSection = await render();
    expect(withoutSection).toContain("A heading");
    expect(withoutSection).not.toContain("application/ld+json");

    // One stored entry, one question — never one per heading.
    state.page = livePage([{ question: "Q?", answer: "A." }]);
    const schema = JSON.parse(jsonLdOf(await render())) as { mainEntity: unknown[] };
    expect(schema.mainEntity).toHaveLength(1);
  });

  it("a `<` in a stored answer cannot break out of the script element", async () => {
    state.page = livePage([{ question: "Q?", answer: "a < b </script><script>x()</script>" }]);
    const html = await render();
    expect(html).not.toContain("</script><script>");
    expect(html).toContain("\\u003c");
  });
});

describe("the render itself — the whole page at first byte, and no sentence of ours", () => {
  it("the title and the body are both in the HTML", async () => {
    const html = await render();
    expect(html).toContain("The best onboarding tools");
    expect(html).toContain("One paragraph.");
    expect(html).toContain("Another paragraph.");
  });

  it("the body goes through the one Markdown renderer, escaped", async () => {
    state.page = { ...(livePage([]) as object), bodyMd: "<img src=x onerror=alert(1)>" };
    const html = await render();
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("no ReachKit name, link or navigation stands on a customer's own page", async () => {
    const html = await render();
    expect(html.toLowerCase()).not.toContain("reachkit");
    expect(html).not.toContain("<nav");
  });

  it("it declares its own band arms, as every screen root does (ADR-093)", async () => {
    const html = await render();
    expect(html).toContain("data-surface");
    expect(html).toContain('data-arm-compact="columns:1"');
  });

  it("the publish date is a numeral in the mono face, with no line of ours around it", async () => {
    const html = await render();
    // `.num` is §2.3's one mechanism for "every numeral, date, URL … is
    // JetBrains Mono with tabular-nums". The attribute's spelling is the
    // renderer's; the date, the class and the absence of a sentence around
    // them are this file's.
    expect(html).toMatch(/<time class="num" date[Tt]ime="2026-09-01">2026-09-01<\/time>/);
  });

  it("an address the site never published at is a 404, never another page", async () => {
    state.page = null;
    await expect(render()).rejects.toThrow();
  });

  it("a deeper path is not a page at all", async () => {
    await expect(
      Page({ params: Promise.resolve({ slug: ["a", "b"] }) })
    ).rejects.toThrow();
  });

  it("an unknown Host renders nothing, even with a page in hand", async () => {
    state.host = "content.stranger.example";
    await expect(render()).rejects.toThrow();
  });
});

function jsonLdOf(html: string): string {
  const match = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html);
  if (match?.[1] === undefined) throw new Error("no JSON-LD block in the rendered page");
  return match[1];
}
