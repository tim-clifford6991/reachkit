// tests/generate/pipeline/alternatives-1508.test.ts — SPEC §7 (issue 1508,
// with the SEO master's amendment of 2026-10-18): an alternatives or "best
// X" page counts real options and never its subject, and the number in its
// title is the options it lists.
//
// What a reader would notice if it broke: "3 Profound alternatives" with
// Profound as one of the three; a list padded with a tool from another
// market, or a gym in another city; a page that names fewer options than
// it says; or a three-option page published against results that list
// eight. One panel of seven pages over six kinds of business, so the
// reading is not one market's: software (the page that went wrong), a
// property portal, a tool maker searched in German, a website builder, a
// marketplace a creator sells on, a local gym against a chain, and a "best
// website builders" page that counts the business itself.
import "../env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AT, SITE_ID, pageParts } from "../fixtures";
import type { StoredReport } from "../../../src/lib/scan/report";
import type { CostContext } from "../../../src/lib/costs";
import type { Locale } from "../../../src/lib/locale/locales";

const { llmMock, safeFetchMock, serpMock, newsMock, overviewMock } = vi.hoisted(() => ({
  llmMock: vi.fn(),
  safeFetchMock: vi.fn(),
  serpMock: vi.fn(),
  newsMock: vi.fn(),
  overviewMock: vi.fn(),
}));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
vi.mock("@/lib/egress", () => ({ safeFetch: safeFetchMock }));
vi.mock("@/lib/vendors/dataforseo", () => ({ serpOrganic: serpMock, serpNews: newsMock, keywordOverview: overviewMock }));

import { RESEARCH } from "../../../src/lib/config/constants";
import { layoutPage, withClosing } from "../../../src/lib/generate/pipeline/compose";
import type { ContextPack, PackClaim } from "../../../src/lib/generate/pipeline/pack";
import { alternativesSubject, namedProducts, researchMarket, type MarketResearch } from "../../../src/lib/generate/pipeline/research";
import { comparisonTable } from "../../../src/lib/generate/pipeline/table";
import { titleRuleFor } from "../../../src/lib/generate/pipeline/title";
import { writePage } from "../../../src/lib/generate/pipeline/write";
import { missingBlock } from "../../../src/lib/generate/rules/blocks";
import { checkTitle, countedIn } from "../../../src/lib/generate/rules/title";
import { TEMPLATES, type Template } from "../../../src/lib/generate/templates";

const TODAY = new Date("2026-10-18T08:00:00.000Z");
const STORED = JSON.parse(readFileSync(path.join(__dirname, "../../../docs/walk/pipeline-v2/listicle.pack.json"), "utf8")) as ContextPack;
const measured = <T>(value: T) => ({ kind: "measured" as const, value, at: AT });
const filler = "This page sets out how the service is priced and what each plan or package includes for a customer who is choosing. ".repeat(8);
const html = (title: string, body: string) => `<html><head><title>${title}</title></head><body><main><p>${filler}</p>${body}</main></body></html>`;

interface Product {
  domain: string;
  name: string;
  /** What its own pages say it is, beside its price. */
  says?: string;
}

interface Named extends Product {
  /** The top results (0–4, in the order they rank) that link it. */
  on: number[];
}

interface Case {
  kind: string;
  locale: Locale;
  business: Product & { price: string };
  search: string;
  /** The market's category and synonyms (D49). */
  market: string[];
  /** The product the search asks for alternatives to, where it does, and
   *  whether it is a rival in force (else its site is in the top ten). */
  baseline: (Product & { inForce: boolean }) | null;
  inForce: Product[];
  named: Named[];
  /** The products whose own pages are read, in order, the baseline first. */
  expected: string[];
  /** Products the results name that must never be options, and why. */
  never: Record<string, string>;
}

const US: Locale = { country: "US", language: "en" };
const GB: Locale = { country: "GB", language: "en" };
const DE: Locale = { country: "DE", language: "de" };
const LEEDS: Locale = { country: "GB", language: "en", place: { name: "Leeds", region: "West Yorkshire" } };

/** Five results; the first is a vendor's own page, which the claim calls
 *  read as a top result but which names products like any other. */
const RESULTS = ["https://writesonic.com/blog/roundup", "https://bestpicks.com/alternatives", "https://compareguide.net/roundup", "https://toolreview.org/list", "https://shortlist.io/top"];

const PANEL: Case[] = [
  {
    kind: "software, the page that counted its subject",
    locale: US,
    business: { domain: "reachkit.app", name: "ReachKit", price: "€49 a month" },
    search: "profound alternatives",
    market: ["AI visibility tracking", "AI search monitoring"],
    baseline: { domain: "tryprofound.com", name: "Profound", inForce: true },
    inForce: [],
    named: [
      { domain: "rankscale.ai", name: "Rankscale", on: [1, 2, 3, 4] },
      { domain: "peec.ai", name: "Peec AI", on: [0, 1, 2] },
      { domain: "seranking.com", name: "SE Ranking", on: [1, 2] },
      { domain: "scrunch.com", name: "Scrunch", on: [1, 4] },
      { domain: "jasper.ai", name: "Jasper", on: [1, 2], says: "Jasper writes blog posts and ads for marketing teams." },
      { domain: "ahrefs.com", name: "Ahrefs", on: [2, 3] },
      // Named only on the fourth and fifth results: found because the five
      // results already read are all looked at.
      { domain: "otterly.ai", name: "Otterly", on: [3, 4] },
      { domain: "semrush.com", name: "Semrush", on: [3, 4] },
      { domain: "searchable.com", name: "Searchable", on: [3, 4] },
      { domain: "airops.com", name: "AirOps", on: [1] },
    ],
    // The bound of eight own pages: the baseline and seven options.
    expected: ["tryprofound.com", "rankscale.ai", "peec.ai", "seranking.com", "scrunch.com", "ahrefs.com", "otterly.ai", "semrush.com"],
    never: { "jasper.ai": "another market", "airops.com": "one result only", "searchable.com": "past the bound" },
  },
  {
    kind: "a firm, against a property portal",
    locale: GB,
    business: { domain: "hartleyhomes.co.uk", name: "Hartley Homes", price: "£995 to sell your home" },
    search: "rightmove alternatives",
    market: ["property portal", "estate agents"],
    baseline: { domain: "rightmove.co.uk", name: "Rightmove", inForce: false },
    inForce: [{ domain: "purplebricks.co.uk", name: "Purplebricks" }],
    named: [
      { domain: "zoopla.co.uk", name: "Zoopla", on: [1, 2, 3] },
      { domain: "canva.com", name: "Canva", on: [1, 2], says: "Canva lets anyone design flyers and social posts." },
      { domain: "onthemarket.com", name: "OnTheMarket", on: [1, 2] },
      { domain: "openrent.co.uk", name: "OpenRent", on: [2, 3] },
      { domain: "boomin.com", name: "Boomin", on: [4] },
    ],
    expected: ["rightmove.co.uk", "purplebricks.co.uk", "zoopla.co.uk", "onthemarket.com", "openrent.co.uk"],
    never: { "canva.com": "another market", "boomin.com": "one result only" },
  },
  {
    kind: "a shop, searched in German",
    locale: DE,
    business: { domain: "werkzeug-mueller.de", name: "Werkzeug Müller", price: "ab 49 € im Monat" },
    search: "Hilti Alternativen",
    market: ["Elektrowerkzeuge", "Bohrhammer"],
    baseline: { domain: "hilti.de", name: "Hilti", inForce: false },
    inForce: [],
    named: [
      { domain: "bosch-professional.com", name: "Bosch Professional", on: [1, 2, 3] },
      { domain: "obi.de", name: "OBI", on: [1, 2], says: "OBI ist Ihr Baumarkt für Garten und Wohnen." },
      { domain: "makita.de", name: "Makita", on: [1, 2] },
      { domain: "festool.de", name: "Festool", on: [1, 4] },
      { domain: "dewalt.de", name: "DeWalt", on: [2, 3] },
      { domain: "metabo.com", name: "Metabo", on: [3, 4] },
      { domain: "einhell.de", name: "Einhell", on: [3] },
    ],
    expected: ["hilti.de", "bosch-professional.com", "makita.de", "festool.de", "dewalt.de", "metabo.com"],
    never: { "obi.de": "another market", "einhell.de": "one result only" },
  },
  {
    kind: "software, a website builder",
    locale: US,
    business: { domain: "sitecraft.io", name: "Sitecraft", price: "$12 a month" },
    search: "squarespace alternatives",
    market: ["website builder"],
    baseline: { domain: "squarespace.com", name: "Squarespace", inForce: true },
    inForce: [{ domain: "wix.com", name: "Wix" }],
    named: [
      { domain: "webflow.com", name: "Webflow", on: [1, 2] },
      { domain: "framer.com", name: "Framer", on: [2, 3] },
      { domain: "carrd.co", name: "Carrd", on: [4] },
    ],
    expected: ["squarespace.com", "wix.com", "webflow.com", "framer.com"],
    never: { "carrd.co": "one result only" },
  },
  {
    kind: "a creator, against the marketplace they sell on",
    locale: US,
    business: { domain: "inkandline.studio", name: "Ink and Line", price: "$29 a course" },
    search: "skillshare alternatives",
    market: ["online courses", "art classes"],
    baseline: { domain: "skillshare.com", name: "Skillshare", inForce: true },
    inForce: [{ domain: "domestika.org", name: "Domestika" }],
    named: [
      { domain: "udemy.com", name: "Udemy", on: [1, 2] },
      { domain: "masterclass.com", name: "MasterClass", on: [2, 3] },
      { domain: "craftsy.com", name: "Craftsy", on: [1] },
    ],
    expected: ["skillshare.com", "domestika.org", "udemy.com", "masterclass.com"],
    never: { "craftsy.com": "one result only" },
  },
  {
    kind: "a local service, against a chain",
    locale: LEEDS,
    business: { domain: "ironworksgym.co.uk", name: "Ironworks Gym", price: "£25 a month" },
    search: "alternatives to puregym",
    market: ["gym", "fitness club"],
    baseline: { domain: "puregym.com", name: "PureGym", inForce: false },
    inForce: [{ domain: "thegymgroup.com", name: "The Gym Group" }],
    named: [
      { domain: "anytimefitness.co.uk", name: "Anytime Fitness", on: [1, 2], says: "Anytime Fitness is a gym open all hours in Leeds city centre." },
      { domain: "everlastgyms.com", name: "Everlast Gyms", on: [1, 2, 3], says: "Everlast Gyms is a gym in Manchester." },
      { domain: "leedsfitnesshub.co.uk", name: "Leeds Fitness Hub", on: [2, 3], says: "Leeds Fitness Hub is a fitness club in Headingley, Leeds." },
    ],
    expected: ["puregym.com", "thegymgroup.com", "anytimefitness.co.uk", "leedsfitnesshub.co.uk"],
    never: { "everlastgyms.com": "does not serve Leeds" },
  },
  {
    kind: "a 'best {category}' page, which counts the business",
    locale: US,
    business: { domain: "sitecraft.io", name: "Sitecraft", price: "$12 a month" },
    search: "best website builders for small business",
    market: ["website builder"],
    baseline: null,
    inForce: [{ domain: "wix.com", name: "Wix" }],
    named: [
      { domain: "squarespace.com", name: "Squarespace", on: [1, 2, 3] },
      { domain: "webflow.com", name: "Webflow", on: [1, 2] },
      { domain: "framer.com", name: "Framer", on: [2, 3] },
      { domain: "hostinger.com", name: "Hostinger", on: [3, 4] },
    ],
    expected: ["wix.com", "squarespace.com", "webflow.com", "framer.com", "hostinger.com"],
    never: {},
  },
];

/** The options a case counts: the business and every product read but the
 *  baseline. */
const countedOf = (each: Case): number => 1 + each.expected.filter((domain) => domain !== each.baseline?.domain).length;
const productsOf = (each: Case): Product[] => [...(each.baseline === null ? [] : [each.baseline]), ...each.inForce, ...each.named];
const priceOf = (product: Product): string => `${product.name} Standard costs $30 a month for one account.`;
const saysOf = (each: Case, product: Product): string => product.says ?? `${product.name} is a ${each.market[0]} for every customer.`;
const link = (product: Product): string => `<li><a href="https://www.${product.domain}/?ref=list">${product.name}</a> is one option.</li>`;

function serveCase(each: Case): void {
  const all = productsOf(each);
  safeFetchMock.mockImplementation(async (url: string) => {
    const at = RESULTS.indexOf(url);
    if (at !== -1) {
      // Each result also links its own pages, a review site, a social
      // network and the business itself, none of which is an option. The
      // baseline and the rivals in force are named on every one.
      const listed = [...(each.baseline === null ? [] : [each.baseline]), ...each.inForce, ...each.named.filter((product) => product.on.includes(at))];
      const body = [
        `<a href="${new URL(url).origin}/about">About us</a>`,
        `<a href="https://www.g2.com/products/x">G2</a>`,
        `<a href="https://twitter.com/intent/share">Share on Twitter</a>`,
        `<a href="https://${each.business.domain}/">${each.business.name}</a>`,
        `<ul>${listed.map(link).join("")}</ul>`,
      ].join("");
      return { ok: true, status: 200, url, html: html("The best alternatives", body), bytes: 1, readAt: TODAY, headers: {} };
    }
    const product = all.find((one) => url === `https://${one.domain}/` || url === `https://${one.domain}/pricing`);
    if (product !== undefined && url.endsWith("/pricing")) {
      return { ok: true, status: 200, url, html: html(`${product.name} pricing`, `<p>${priceOf(product)} ${saysOf(each, product)}</p>`), bytes: 1, readAt: TODAY, headers: {} };
    }
    if (product !== undefined) {
      return { ok: true, status: 200, url, html: html(product.name, `<a href="/pricing">Pricing</a>`), bytes: 1, readAt: TODAY, headers: {} };
    }
    return { ok: false, reason: "status", status: 404, url, readAt: TODAY };
  });
  llmMock.mockImplementation(async (_c: unknown, call: { input: { pages?: { page: number; url: string }[] } }) =>
    measured({
      claims: (call.input.pages ?? []).flatMap((page) => {
        const product = all.find((one) => page.url === `https://${one.domain}/pricing`);
        return product === undefined ? [] : [{ page: page.page, quote: priceOf(product), year: null, about: "price", plan: null, rival: null }];
      }),
    })
  );
}

function reportFor(each: Case): StoredReport {
  const baselineSite = each.baseline !== null && !each.baseline.inForce ? [`https://www.${each.baseline.domain}/`] : [];
  const organic = [...RESULTS, ...baselineSite].map((url, index) => ({ position: index + 1, url }));
  return { questions: measured([{ search: { keyword: each.search } }]), serps: [measured({ organic })] } as unknown as StoredReport;
}

function cost(): CostContext {
  return {
    cap: "DRAFT",
    async recordFetch<P>(call: { costCents: number; run: () => Promise<P> }) {
      return { payload: await call.run(), fresh: true, costCents: call.costCents, storedAt: null };
    },
    capHit: () => false,
    spentCents: () => 0,
    degraded: () => false,
  } as unknown as CostContext;
}

const inForceOf = (each: Case): Product[] => [...(each.baseline?.inForce === true ? [each.baseline] : []), ...each.inForce];

async function research(each: Case): Promise<MarketResearch> {
  serveCase(each);
  return researchMarket(cost(), {
    siteId: SITE_ID,
    locale: each.locale,
    domain: each.business.domain,
    searches: [each.search],
    report: reportFor(each),
    rivals: inForceOf(each).map((product) => product.domain),
    rivalNames: inForceOf(each),
    options: true,
    marketWords: each.market,
    today: TODAY,
  });
}

/** The listicle's pack, from what research found. */
function packFor(each: Case, found: MarketResearch): ContextPack {
  const claims: PackClaim[] = found.facts.map((fact) => ({
    passage: fact.passage,
    url: fact.url,
    title: fact.title,
    readAt: fact.readAt.toISOString(),
    kind: fact.kind,
    ...(fact.product === undefined ? {} : { product: fact.product }),
  }));
  const knowledge = STORED.profile!.knowledge!;
  return {
    ...STORED,
    builtAt: TODAY.toISOString(),
    ...(each.locale.language === "en" ? {} : { locale: { country: each.locale.country, language: each.locale.language } }),
    target: { question: each.search, searches: [each.search] },
    // The market names its rivals in force; a product the results found is
    // named as they link it.
    business: { ...STORED.business, name: each.business.name, domain: each.business.domain, market: { rivals: inForceOf(each) }, rivals: each.inForce.map((product) => product.domain) },
    profile: {
      ...STORED.profile!,
      knowledge: {
        ...knowledge,
        offerings: [{ ...knowledge.offerings[0]!, name: "Standard", prices: [each.business.price], features: ["Everything a customer needs in one place"], from: `https://${each.business.domain}/pricing` }],
      },
    },
    claims,
    products: found.products,
    ...(found.baseline === undefined ? {} : { baseline: found.baseline }),
    pages: [],
  };
}

const faultsOf = (title: string, rule: ReturnType<typeof titleRuleFor>) => {
  const failed = checkTitle({ title, rule });
  return failed?.detail?.rule === "title" ? failed.detail.faults : [];
};

beforeEach(() => {
  llmMock.mockReset();
  safeFetchMock.mockReset();
  serpMock.mockReset();
  serpMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
  newsMock.mockReset();
  overviewMock.mockReset();
  overviewMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
});

describe("the search's subject is the baseline, in every supported language", () => {
  const products = [{ domain: "hilti.de", name: "Hilti" }, { domain: "peec.ai", name: null }, { domain: "britishgas.co.uk", name: "British Gas" }];
  it.each([
    ["Hilti Alternativen", "hilti.de"],
    ["Alternative zu Hilti", "hilti.de"],
    ["Alternativen zu Hilti", "hilti.de"],
    ["hilti alternative", "hilti.de"],
    ["peec ai alternatives", "peec.ai"],
    ["alternatives to british gas boiler cover", "britishgas.co.uk"],
  ])("%s → %s", (search, domain) => {
    expect(alternativesSubject(search, products)).toBe(domain);
  });
  it("a search that is not for alternatives has none", () => {
    expect(alternativesSubject("hilti preise", products)).toBeNull();
    expect(alternativesSubject("best website builders", products)).toBeNull();
  });
});

describe.each(PANEL)("$kind", (each) => {
  it("its options are the rivals in force and the products two of the top five results name, of the market's category and place, inside the bound", async () => {
    const found = await research(each);
    expect(found.baseline).toBe(each.baseline?.domain);
    const domains = found.products.map((product) => product.domain);
    expect(domains).toEqual(each.expected);
    for (const never of [...Object.keys(each.never), "g2.com", "twitter.com", "bestpicks.com", "writesonic.com", each.business.domain]) {
      expect(domains).not.toContain(never);
    }
    // The bound: eight own pages on a listicle (owner, 2026-10-18).
    expect(domains.length).toBeLessThanOrEqual(RESEARCH.options);
    // The claims stay in the step's own calls, and each product's own page
    // reached one of them, with a claim from it.
    expect(llmMock.mock.calls.length).toBeLessThanOrEqual(RESEARCH.calls);
    const handed = llmMock.mock.calls.flatMap((call) => (call[1] as { input: { pages: { url: string }[] } }).input.pages.map((page) => page.url));
    for (const domain of domains) expect(handed).toContain(`https://${domain}/pricing`);
    // What the claim calls are handed: the three top results and one own
    // page a product (no study is found here). The cost delta of the bound
    // is these pages (issue 1508's PR).
    expect(handed).toHaveLength(RESEARCH.topResults + each.expected.length);
    for (const product of found.products) expect(found.facts.some((fact) => fact.product === product.domain)).toBe(true);
  });

  it("the baseline has a marked row and is not counted; on a 'best' page the business is counted", async () => {
    const pack = packFor(each, await research(each));
    const table = comparisonTable(pack, TEMPLATES.listicle.blocks.table!.rivals)!;
    expect(table.options).toHaveLength(countedOf(each));
    expect(table.options[0]).toBe(each.business.name);
    if (each.baseline === null) {
      expect(table.baseline).toBeNull();
      return;
    }
    expect(table.baseline).toBe(each.baseline.name);
    expect(table.options).not.toContain(each.baseline.name);
    const rows = table.markdown.split("\n");
    expect(rows[3]).toContain(each.locale.language === "de" ? `${each.baseline.name} (zum Vergleich)` : `${each.baseline.name} (for comparison)`);
    expect(rows.filter((row) => row.includes(each.baseline!.name))).toHaveLength(1);
  });

  it("N in the title equals the counted options", async () => {
    const pack = packFor(each, await research(each));
    const rule = titleRuleFor(pack, { description: "x".repeat(140) });
    const n = countedOf(each);
    expect(rule.options).toBe(n);
    const titled = (count: number) => `${count} ${each.baseline?.name ?? "website builders"} alternatives compared`;
    expect(countedIn(titled(n))).toBe(n);
    expect(faultsOf(titled(n), rule)).not.toContain("count");
    // Counting the baseline, leaving the business out, or padding is
    // another number.
    expect(faultsOf(titled(n + 1), rule)).toContain("count");
    expect(faultsOf(titled(n - 1), rule)).toContain("count");
  });

  it("a page of fewer than five options says in its method why only those qualified", async () => {
    const pack = packFor(each, await research(each));
    llmMock.mockReset();
    llmMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
    await writePage(cost(), { template: TEMPLATES.listicle, pack, pageType: "market_comparison", length: { floor: 1500, ceiling: 2500 } });
    const input = (llmMock.mock.calls[0]![1] as { input: { options: string[]; rules: string[] } }).input;
    expect(input.options).toHaveLength(countedOf(each));
    const note = input.rules.find((rule) => rule.startsWith("Only "));
    if (countedOf(each) < RESEARCH.optionsAim) expect(note).toContain(`Only ${countedOf(each)} options qualified. In \`how_we_compared\``);
    else expect(note).toBeUndefined();
  });
});

describe("the page Page E was", () => {
  it("'3 Profound alternatives' over ReachKit, Profound and Otterly counted its subject; now Profound is the baseline and N is the rest", () => {
    const claim = (product: string, passage: string): PackClaim => ({ product, passage, kind: "rival_pricing", url: `https://${product}/pricing`, title: product, readAt: STORED.builtAt });
    const pack: ContextPack = {
      ...STORED,
      type: "listicle",
      target: { question: "profound alternatives", searches: ["profound alternatives"] },
      business: {
        ...STORED.business,
        market: { rivals: [{ name: "Profound", domain: "tryprofound.com" }, { name: "Otterly", domain: "otterly.ai" }, { name: "Peec AI", domain: "peec.ai" }, { name: "Rankscale", domain: "rankscale.ai" }] },
      },
      claims: [claim("tryprofound.com", "Growth $399 a month"), claim("otterly.ai", "Lite $29 a month"), claim("peec.ai", "Starter €89 a month"), claim("rankscale.ai", "Essential $20 a month")],
      products: ["tryprofound.com", "otterly.ai", "peec.ai", "rankscale.ai"].map((domain) => ({ domain, pages: [] })),
      baseline: "tryprofound.com",
    };
    const table = comparisonTable(pack, 2)!;
    expect(table.options).toEqual(["ReachKit", "Otterly", "Peec AI", "Rankscale"]);
    expect(table.baseline).toBe("Profound");
    const rule = titleRuleFor(pack, { description: "x".repeat(140) });
    expect(faultsOf("5 Profound alternatives for service businesses (2026)", rule)).toContain("count");
    expect(faultsOf("4 Profound alternatives for service businesses (2026)", rule)).not.toContain("count");
  });

  it("a link whose words do not spell its domain names nothing, and one result is not two", () => {
    const page = (url: string, links: string) => ({ url, html: `<html><body>${links}</body></html>` });
    const found = namedProducts(
      [
        page("https://a.com/x", `<a href="https://peec.ai/">Peec AI</a><a href="https://go.partner-network.com/r?to=wix">Try Wix</a><a href="https://otterly.ai">Otterly</a>`),
        page("https://b.com/y", `<a href="https://www.peec.ai/pricing">Visit Peec AI</a><a href="https://go.partner-network.com/r?to=wix">Try Wix</a>`),
      ],
      "reachkit.app"
    );
    expect(found).toEqual([{ domain: "peec.ai", name: "Peec AI", on: 2 }]);
  });
});

describe("the baseline's section", () => {
  // Five questions, the listicle's baseline slot and the business's
  // section: the shape the blocks check holds a listicle to.
  const template: Template = {
    ...TEMPLATES.qa,
    sections: [{ ...TEMPLATES.qa.sections[0]!, repeat: { min: 5, max: 5 } }, TEMPLATES.listicle.sections.find((slot) => slot.key === "baseline")!, TEMPLATES.qa.sections[1]!],
  };
  const parts = pageParts();
  const laidOut = (withBaseline: boolean) => {
    const sections = withBaseline ? parts.sections.map((s, index) => (index === 5 ? { ...s, key: "baseline" } : s)) : parts.sections.filter((_, index) => index !== 5);
    const laid = layoutPage({ ...parts, sections }, template, { facts: [], promises: [], queries: ["which plan fits a small team"], names: ["Acme"] });
    const markdown = withClosing(laid.body.bodyMarkdown, laid.closing, "https://example.com/");
    return { markdown, blocks: { template, sections: laid.sections, length: null, faq: laid.faq, domain: "example.com" } };
  };

  it("an alternatives page carries what its subject offers, once; any other page carries none", () => {
    const has = laidOut(true);
    const lacks = laidOut(false);
    expect(missingBlock({ markdown: has.markdown, title: "A title", blocks: { ...has.blocks, baseline: "Globex" } })).not.toBe("sections");
    expect(missingBlock({ markdown: lacks.markdown, title: "A title", blocks: { ...lacks.blocks, baseline: "Globex" } })).toBe("sections");
    expect(missingBlock({ markdown: has.markdown, title: "A title", blocks: has.blocks })).toBe("sections");
    expect(missingBlock({ markdown: lacks.markdown, title: "A title", blocks: lacks.blocks })).not.toBe("sections");
  });
});
