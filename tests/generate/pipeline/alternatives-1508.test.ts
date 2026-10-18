// tests/generate/pipeline/alternatives-1508.test.ts — SPEC §7 (issue 1508):
// an alternatives page counts real options and never its subject, and the
// number in its title is the options it lists.
//
// What a reader would notice if it broke: "3 Profound alternatives" with
// Profound as one of the three, a page that lists three options where the
// pages it competes with list eight, or a title whose number is not the
// count of the options below it. One panel of six kinds of business, so the
// reading is not one market's: software (the page that went wrong), a
// property portal, a tool maker searched in German, a website builder, a
// marketplace a creator sells on, and a local gym against a chain.
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
}

interface Case {
  kind: string;
  locale: Locale;
  business: Product & { price: string };
  search: string;
  /** The product the search asks for alternatives to. */
  baseline: Product;
  /** Whether the baseline is a rival in force; else the search's top ten
   *  holds its site. */
  baselineInForce: boolean;
  inForce: Product[];
  /** Products every round-up names, and one only a single round-up does. */
  named: Product[];
  once: Product;
  /** The options the page counts, the business among them. */
  options: number;
}

const US: Locale = { country: "US", language: "en" };
const GB: Locale = { country: "GB", language: "en" };
const DE: Locale = { country: "DE", language: "de" };

const PANEL: Case[] = [
  {
    kind: "software, the page that counted its subject",
    locale: US,
    business: { domain: "reachkit.app", name: "ReachKit", price: "€49 a month" },
    search: "profound alternatives",
    baseline: { domain: "tryprofound.com", name: "Profound" },
    baselineInForce: true,
    inForce: [{ domain: "otterly.ai", name: "Otterly" }, { domain: "peec.ai", name: "Peec AI" }, { domain: "rankscale.ai", name: "Rankscale" }],
    named: [
      { domain: "writesonic.com", name: "Writesonic" },
      { domain: "seranking.com", name: "SE Ranking" },
      { domain: "ahrefs.com", name: "Ahrefs" },
      { domain: "semrush.com", name: "Semrush" },
      { domain: "scrunch.com", name: "Scrunch" },
    ],
    once: { domain: "airops.com", name: "AirOps" },
    // Seven rivals are read beside the baseline: the bound of eight.
    options: 8,
  },
  {
    kind: "a firm, against a property portal",
    locale: GB,
    business: { domain: "hartleyhomes.co.uk", name: "Hartley Homes", price: "£995 to sell your home" },
    search: "rightmove alternatives",
    baseline: { domain: "rightmove.co.uk", name: "Rightmove" },
    baselineInForce: false,
    inForce: [{ domain: "purplebricks.co.uk", name: "Purplebricks" }],
    named: [{ domain: "zoopla.co.uk", name: "Zoopla" }, { domain: "onthemarket.com", name: "OnTheMarket" }, { domain: "openrent.co.uk", name: "OpenRent" }],
    once: { domain: "boomin.com", name: "Boomin" },
    options: 5,
  },
  {
    kind: "a shop, searched in German",
    locale: DE,
    business: { domain: "werkzeug-mueller.de", name: "Werkzeug Müller", price: "ab 49 € im Monat" },
    search: "hilti alternativen",
    baseline: { domain: "hilti.de", name: "Hilti" },
    baselineInForce: false,
    inForce: [],
    named: [
      { domain: "bosch-professional.com", name: "Bosch Professional" },
      { domain: "makita.de", name: "Makita" },
      { domain: "dewalt.de", name: "DeWalt" },
      { domain: "metabo.com", name: "Metabo" },
      { domain: "festool.de", name: "Festool" },
    ],
    once: { domain: "einhell.de", name: "Einhell" },
    options: 6,
  },
  {
    kind: "software, a website builder",
    locale: US,
    business: { domain: "sitecraft.io", name: "Sitecraft", price: "$12 a month" },
    search: "squarespace alternatives",
    baseline: { domain: "squarespace.com", name: "Squarespace" },
    baselineInForce: true,
    inForce: [{ domain: "wix.com", name: "Wix" }],
    named: [{ domain: "webflow.com", name: "Webflow" }, { domain: "wordpress.com", name: "WordPress.com" }, { domain: "framer.com", name: "Framer" }],
    once: { domain: "carrd.co", name: "Carrd" },
    options: 5,
  },
  {
    kind: "a creator, against the marketplace they sell on",
    locale: US,
    business: { domain: "inkandline.studio", name: "Ink and Line", price: "$29 a course" },
    search: "skillshare alternatives",
    baseline: { domain: "skillshare.com", name: "Skillshare" },
    baselineInForce: true,
    inForce: [{ domain: "domestika.org", name: "Domestika" }],
    named: [{ domain: "udemy.com", name: "Udemy" }, { domain: "masterclass.com", name: "MasterClass" }],
    once: { domain: "craftsy.com", name: "Craftsy" },
    // Fewer than five qualify: the page counts the four it has and pads none.
    options: 4,
  },
  {
    kind: "a local service, against a chain",
    locale: GB,
    business: { domain: "ironworksgym.co.uk", name: "Ironworks Gym", price: "£25 a month" },
    search: "alternatives to puregym",
    baseline: { domain: "puregym.com", name: "PureGym" },
    baselineInForce: false,
    inForce: [{ domain: "thegymgroup.com", name: "The Gym Group" }],
    named: [{ domain: "anytimefitness.co.uk", name: "Anytime Fitness" }, { domain: "everlastgyms.com", name: "Everlast Gyms" }],
    once: { domain: "nuffieldhealth.com", name: "Nuffield Health" },
    options: 4,
  },
];

const ROUNDUPS = ["https://bestpicks.com/alternatives", "https://compareguide.net/roundup", "https://toolreview.org/list"];
const priceOf = (product: Product): string => `${product.name} Standard costs $30 a month for one account.`;
const link = (product: Product): string => `<li><a href="https://www.${product.domain}/?ref=list">${product.name}</a> is one option.</li>`;

function serveCase(each: Case): void {
  const all = [each.baseline, ...each.inForce, ...each.named, each.once];
  safeFetchMock.mockImplementation(async (url: string) => {
    const at = ROUNDUPS.indexOf(url);
    if (at !== -1) {
      // Every round-up names the products; only the first names `once`. Each
      // also links its own pages, a review site, a social network and the
      // business itself, none of which is an option.
      const body = [
        `<a href="${new URL(url).origin}/about">About bestpicks</a>`,
        `<a href="https://www.g2.com/products/x">G2</a>`,
        `<a href="https://twitter.com/intent/share">Share on Twitter</a>`,
        `<a href="https://${each.business.domain}/">${each.business.name}</a>`,
        `<ul>${[each.baseline, ...each.inForce, ...each.named].map(link).join("")}${at === 0 ? link(each.once) : ""}</ul>`,
      ].join("");
      return { ok: true, status: 200, url, html: html("The best alternatives", body), bytes: 1, readAt: TODAY, headers: {} };
    }
    const product = all.find((one) => url === `https://${one.domain}/` || url === `https://${one.domain}/pricing`);
    if (product !== undefined && url.endsWith("/pricing")) {
      return { ok: true, status: 200, url, html: html(`${product.name} pricing`, `<p>${priceOf(product)}</p>`), bytes: 1, readAt: TODAY, headers: {} };
    }
    if (product !== undefined) {
      return { ok: true, status: 200, url, html: html(product.name, `<a href="/pricing">Pricing</a>`), bytes: 1, readAt: TODAY, headers: {} };
    }
    return { ok: false, reason: "status", status: 404, url, readAt: TODAY };
  });
  llmMock.mockImplementation(async (_c: unknown, call: { input: { pages: { page: number; url: string }[] } }) =>
    measured({
      claims: call.input.pages.flatMap((page) => {
        const product = all.find((one) => page.url === `https://${one.domain}/pricing`);
        return product === undefined ? [] : [{ page: page.page, quote: priceOf(product), year: null, about: "price", plan: null, rival: null }];
      }),
    })
  );
}

function reportFor(each: Case): StoredReport {
  const organic = [...ROUNDUPS, ...(each.baselineInForce ? [] : [`https://www.${each.baseline.domain}/`])].map((url, index) => ({ position: index + 1, url }));
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

async function research(each: Case): Promise<MarketResearch> {
  serveCase(each);
  const inForce = [...(each.baselineInForce ? [each.baseline] : []), ...each.inForce];
  return researchMarket(cost(), {
    siteId: SITE_ID,
    locale: each.locale,
    domain: each.business.domain,
    searches: [each.search],
    report: reportFor(each),
    rivals: inForce.map((product) => product.domain),
    rivalNames: inForce,
    options: true,
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
    // The market names its rivals in force; a product the round-ups found
    // is named as they link it.
    business: {
      ...STORED.business,
      name: each.business.name,
      domain: each.business.domain,
      market: { rivals: [...(each.baselineInForce ? [each.baseline] : []), ...each.inForce] },
      rivals: each.inForce.map((product) => product.domain),
    },
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

beforeEach(() => {
  llmMock.mockReset();
  safeFetchMock.mockReset();
  serpMock.mockReset();
  serpMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
  newsMock.mockReset();
  overviewMock.mockReset();
  overviewMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
});

describe.each(PANEL)("an alternatives page: $kind", (each) => {
  it("reads the search's subject as the baseline, in any supported language", () => {
    const products = [...each.inForce, each.baseline, ...each.named];
    expect(alternativesSubject(each.search, products)).toBe(each.baseline.domain);
    // A search that is not for alternatives has no baseline.
    expect(alternativesSubject(`${each.baseline.name} pricing`, products)).toBeNull();
  });

  it("its options are the rivals in force and the products two of the top results name, each with a claim from its own page", async () => {
    const found = await research(each);
    expect(found.baseline).toBe(each.baseline.domain);
    const domains = found.products.map((product) => product.domain);
    expect(domains[0]).toBe(each.baseline.domain);
    // Never a product only one round-up named, a listing site, a social
    // network, a round-up's own site or the business itself.
    expect(domains).not.toContain(each.once.domain);
    for (const never of ["g2.com", "twitter.com", "bestpicks.com", each.business.domain]) expect(domains).not.toContain(never);
    // At most the baseline and seven rivals; the claims stay in the step's
    // own calls, and each product's own page reached one of them.
    expect(domains.length).toBeLessThanOrEqual(RESEARCH.options);
    expect(llmMock.mock.calls.length).toBeLessThanOrEqual(RESEARCH.calls);
    const handed = llmMock.mock.calls.flatMap((call) => (call[1] as { input: { pages: { url: string }[] } }).input.pages.map((page) => page.url));
    for (const domain of domains) expect(handed).toContain(`https://${domain}/pricing`);
    for (const product of found.products) expect(found.facts.some((fact) => fact.product === product.domain)).toBe(true);
    // A product the round-ups found is shown by the name they link it by.
    const named = found.products.find((product) => product.domain === each.named[0]!.domain);
    expect(named?.name).toBe(each.named[0]!.name);
  });

  it("the baseline has a marked row and is not counted in N or in the verdict", async () => {
    const pack = packFor(each, await research(each));
    const table = comparisonTable(pack, TEMPLATES.listicle.blocks.table!.rivals)!;
    expect(table.baseline).toBe(each.baseline.name);
    expect(table.options).toHaveLength(each.options);
    expect(table.options[0]).toBe(each.business.name);
    expect(table.options).not.toContain(each.baseline.name);
    const rows = table.markdown.split("\n");
    expect(rows[3]).toContain(each.locale.language === "de" ? `${each.baseline.name} (zum Vergleich)` : `${each.baseline.name} (for comparison)`);
    expect(rows.filter((row) => row.includes(each.baseline.name))).toHaveLength(1);
  });

  it("N in the title equals the counted options", async () => {
    const pack = packFor(each, await research(each));
    const rule = titleRuleFor(pack, { description: "x".repeat(140) });
    expect(rule.options).toBe(each.options);
    const titled = (n: number) => `${n} ${each.baseline.name} alternatives compared`;
    expect(countedIn(titled(each.options))).toBe(each.options);
    const faults = (title: string) => {
      const failed = checkTitle({ title, rule });
      return failed?.detail?.rule === "title" ? failed.detail.faults : [];
    };
    expect(faults(titled(each.options))).not.toContain("count");
    // Counting the baseline, or padding to five, is a different number.
    expect(faults(titled(each.options + 1))).toContain("count");
  });
});

describe("the page Page E was", () => {
  it("'3 Profound alternatives' over ReachKit, Profound and Otterly counts two, so its title fails", () => {
    const claim = (product: string, passage: string): PackClaim => ({ product, passage, kind: "rival_pricing", url: `https://${product}/pricing`, title: product, readAt: STORED.builtAt });
    const pack: ContextPack = {
      ...STORED,
      type: "listicle",
      target: { question: "profound alternatives", searches: ["profound alternatives"] },
      business: { ...STORED.business, market: { rivals: [{ name: "Profound", domain: "tryprofound.com" }, { name: "Otterly", domain: "otterly.ai" }, { name: "Peec AI", domain: "peec.ai" }] } },
      claims: [claim("tryprofound.com", "Growth $399 a month"), claim("otterly.ai", "Lite $29 a month"), claim("peec.ai", "Starter €89 a month")],
      products: [{ domain: "tryprofound.com", pages: [] }, { domain: "otterly.ai", pages: [] }, { domain: "peec.ai", pages: [] }],
      baseline: "tryprofound.com",
    };
    const table = comparisonTable(pack, 2)!;
    expect(table.options).toEqual(["ReachKit", "Otterly", "Peec AI"]);
    expect(table.baseline).toBe("Profound");
    const rule = titleRuleFor(pack, { description: "x".repeat(140) });
    const faults = (title: string) => {
      const failed = checkTitle({ title, rule });
      return failed?.detail?.rule === "title" ? failed.detail.faults : [];
    };
    expect(faults("4 Profound alternatives for service businesses (2026)")).toContain("count");
    expect(faults("3 Profound alternatives for service businesses (2026)")).not.toContain("count");
  });

  it("a product only one round-up links is not an option, and a link whose words do not spell its domain names nothing", () => {
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
  // A template of five questions, the listicle's baseline slot and the
  // business's section: the shape the blocks check holds a listicle to.
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
