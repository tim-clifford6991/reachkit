// The public library, the free tools, setup, stop and unsubscribe speak
// plain words (19 Oct sweep): ReachKit's pace is the A1 week, not a page a
// day; ReachKit puts pages live and checks, it does not publish or measure;
// the tools name what Google reads, not the tag behind it. Compare carries a
// dated caption and a trademark line; the Plausible teardown a greyscale
// sketch, a direct link and a checked date (trust E14–E16). Titles keep the
// term people search.
import "../../generate/env";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/presentation/copy";
import { WEEK_PLAN } from "@/lib/config/constants";
import { ANSWERS, COMPARISONS, TEARDOWNS, longDate } from "@/app/(public)/_library";
import ComparePage from "@/app/(public)/compare/page";
import ComparisonPage from "@/app/(public)/compare/[tool]/page";
import TeardownPage from "@/app/(public)/teardowns/[site]/page";

const KEYS = COPY as Record<string, string>;
const keysUnder = (...prefixes: string[]): [string, string][] =>
  Object.entries(KEYS).filter(([key]) => prefixes.some((p) => key.startsWith(p)));

/** The public surfaces this sweep covers, as copy keys. */
const SURFACE_KEYS = keysUnder("compare.", "teardowns.", "tools.", "library.", "setup.", "publish.veto.", "optout.");

/** Everything ReachKit claims about itself in an article: not the facts
 *  about the other product, which keep that product's own words. */
const OUR_CLAIMS = [
  ...COMPARISONS.flatMap((c) => [c.description, c.summary, c.intro, ...c.ours.paragraphs, ...c.pickUs, ...c.rows.map((r) => r.label)]),
  ...ANSWERS.flatMap((a) => a.sections.filter((s) => s.heading.includes("ReachKit")).flatMap((s) => s.paragraphs)),
  ...ANSWERS.flatMap((a) => a.faq.filter((f) => f.q.includes("ReachKit")).map((f) => f.a)),
];

/** A page a day, in any of the forms the pages used to say it. */
const DAILY_PACE = /\bpages?(?: [\w-]+){0,3} (?:every|each|per) day\b|\b(?:a|one) page a day\b|\bdaily pages?\b|\bone every day\b/i;

describe("the pace is the owner's A1 week on every page this covers", () => {
  it("no article and no key says a page a day", () => {
    const articles = [...COMPARISONS, ...TEARDOWNS, ...ANSWERS].map((page) => JSON.stringify(page));
    expect(articles.filter((text) => DAILY_PACE.test(text)).map((text) => text.match(DAILY_PACE)?.[0])).toEqual([]);
    expect(SURFACE_KEYS.filter(([, value]) => DAILY_PACE.test(value)).map(([key]) => key)).toEqual([]);
  });

  it("where an article states the number, it is the week's pages from the plan", () => {
    const counted = OUR_CLAIMS.filter((s) => /pages a week/.test(s));
    expect(counted.length).toBeGreaterThan(0);
    for (const s of counted) expect(s, s).toContain(`up to ${WEEK_PLAN.days} pages a week`);
  });
});

describe("ReachKit's own claims use the plain words", () => {
  it("ReachKit puts pages live and checks; it never publishes or measures", () => {
    expect(OUR_CLAIMS.filter((s) => /\bpublish|\bmeasur/i.test(s))).toEqual([]);
  });

  it("the tools name what Google reads, not the tag behind it", () => {
    const tools = keysUnder("tools.check.", "tools.preview.", "tools.lead", "tools.meta.", "tools.onpage.");
    const jargon = /\b(meta description|canonical|indexing|index it|structured data|share tags|alt text|open graph|the tags)\b/i;
    expect(tools.filter(([, value]) => jargon.test(value)).map(([key]) => key)).toEqual([]);
  });

  it("the comparison groups, setup, stop and unsubscribe drop the trade words", () => {
    const groups = keysUnder("compare.group.").map(([, value]) => value);
    expect(groups.filter((g) => /\bSEO\b|On-page/.test(g))).toEqual([]);
    // The provider guide keeps the words each dashboard prints.
    const setup = keysUnder("setup.").filter(([key]) => !key.startsWith("setup.destination.guide."));
    expect(setup.filter(([, v]) => /DNS record|\bthis record\b|\bthe record\b|Brand voice|byline|Measuring your market/.test(v)).map(([k]) => k)).toEqual([]);
    // ReachKit's own lines in setup say check and put live, never measure or publish.
    const claims = ["setup.address.assurance", "setup.competitors.none-found", "setup.release.unmeasured"];
    expect(claims.filter((k) => /\bpublish|\bmeasur/i.test(KEYS[k]!))).toEqual([]);
    expect(keysUnder("publish.veto.").filter(([, v]) => /Tomorrow’s page|\/mo\b/.test(v)).map(([k]) => k)).toEqual([]);
    expect(KEYS["optout.unavailable"]).not.toMatch(/opt-out/i);
  });
});

describe("Compare carries its dated caption and the trademark line (trust E14–E16)", () => {
  const latest = COMPARISONS.map((c) => c.checked).sort().at(-1)!;

  it("the index dates what its cards say, and names whose the names are", () => {
    const html = renderToStaticMarkup(ComparePage());
    expect(html).toContain('data-testid="compare-caption"');
    expect(html).toContain(longDate(latest));
    expect(html).toContain(KEYS["library.trademarks"]);
  });

  it("one comparison says whose the names are too", async () => {
    const html = renderToStaticMarkup(await ComparisonPage({ params: Promise.resolve({ tool: "ahrefs" }) }));
    expect(html).toContain(KEYS["library.trademarks"]);
  });
});

describe("the Plausible teardown: a neutral sketch, a direct link, a checked date", () => {
  const plausible = TEARDOWNS.find((t) => t.slug === "plausible")!;

  it("draws the sketch with the page's own words, dated, and links the page it read", async () => {
    const html = renderToStaticMarkup(await TeardownPage({ params: Promise.resolve({ site: "plausible" }) }));
    expect(plausible.checked).toBeDefined();
    expect(html).toContain('data-testid="teardown-sketch"');
    for (const quote of plausible.sketch!.flatMap((m) => m.quotes)) expect(html).toContain(quote);
    expect(html).toContain(`checked ${longDate(plausible.checked!)}`);
    expect(html).toContain('href="https://plausible.io/"');
    expect(html).toContain("(plausible.io)");
    expect(html).toContain(KEYS["library.trademarks"]);
  });

  it("the sketch carries no logo and no brand colour: no image, no colour class", async () => {
    const html = renderToStaticMarkup(await TeardownPage({ params: Promise.resolve({ site: "plausible" }) }));
    const sketch = html.slice(html.indexOf('data-testid="teardown-sketch"'), html.indexOf("</figure>"));
    expect(sketch).not.toMatch(/<img|<svg|\b(?:bg|text|border)-(?:primary|secondary|accent)\b/);
  });
});

describe("a title keeps the term people search (SEO)", () => {
  const words = (s: string): string[] => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const holds = (title: string, term: string): boolean => words(term).every((w) => words(title).includes(w));

  it("each comparison names the product it compares", () => {
    for (const c of COMPARISONS) expect(holds(c.title, c.name), c.slug).toBe(true);
  });

  it("each teardown and answer title holds every word of its address", () => {
    for (const page of [...TEARDOWNS, ...ANSWERS]) expect(holds(page.title, page.slug), page.slug).toBe(true);
  });

  it("each tool's heading holds every word of its address", () => {
    expect(holds(KEYS["tools.title"]!, "tools")).toBe(true);
    expect(holds(KEYS["tools.onpage.name"]!, "on-page-check")).toBe(true);
    expect(holds(KEYS["tools.meta.name"]!, "meta-preview")).toBe(true);
  });
});
