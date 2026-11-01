// `/pricing` against board Pricing (canvas v36): each section in the board's
// order, with its heading and the strings that make it that section. The
// words come from the registry and the figures from the constants, so a
// renamed key or a moved section fails here, and the parity reading in
// `no overflow · axe` counts every other string.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "node-html-parser";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { default: PricingPage } = (await import("@/app/(public)/pricing/page")) as {
  default: (p: { searchParams?: Record<string, string> }) => React.JSX.Element;
};
const { PricingCard } = await import("@/app/(public)/scan/[domain]/_modules/pricing");
const { COPY, copy } = await import("@/lib/presentation/copy");
const { BATTERY, VETO, WEEK_PLAN } = await import("@/lib/config/constants");
const { HOW_FACTS } = await import("@/app/(public)/_how/facts");
const { AGENCY_BENCHMARK } = await import("@/app/(public)/_how/specimen");
const { icons, whenIcons } = await import("../how/drawn-icons");

const html = renderToStaticMarkup(<PricingPage />);
const root = parse(html);
const price = copy("price.amount");
const weekPages = { weekPages: WEEK_PLAN.days };

const text = (markup: string): string =>
  markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");

/** Each top-level section's markup, by its id, in page order. */
const sections = [...html.matchAll(/<section id="([^"]+)"/g)].map((match, i, all) => ({
  id: match[1] ?? "",
  markup: text(html.slice(match.index, all[i + 1]?.index ?? html.length)),
}));
const section = (id: string): string => sections.find((s) => s.id === id)?.markup ?? "";
const page = text(html);

const expectInOrder = (within: string, lines: readonly string[]): void => {
  const at = lines.map((line) => within.indexOf(text(line)));
  expect(at.every((i) => i >= 0), lines.filter((_, i) => at[i]! < 0).join(" | ")).toBe(true);
  expect([...at].sort((a, b) => a - b)).toEqual(at);
};

describe("board Pricing — the sections, in the board's order", () => {
  it("top, week 1, compare, before you pay, the free report", () => {
    expect(sections.map((s) => s.id)).toEqual(["top", "week1", "compare", "before", "start"]);
  });
});

describe("board Pricing — the head and the price card", () => {
  it("says one plan, everything included, and no stat tiles or tick strip beside the card", () => {
    expect(html).toMatch(/<h1[^>]*>One plan\. Everything included\.<\/h1>/);
    expect(section("top")).toContain(copy("pricing.subline", weekPages));
    // Each fact once: the card's tick is the only place the competitors are named.
    expect(page.split(`competitors watched every Monday`).length - 1).toBe(1);
    expect(root.querySelectorAll("#top ul[aria-label]")).toHaveLength(0);
    for (const cut of ["no contract", "no setup fee", "Billed in euros", "No account before payment"]) expect(page).not.toContain(cut);
  });

  it("the card names the plan, the price with VAT, its five ticks, Start, the cancel line and the free path", () => {
    expectInOrder(section("top"), [
      copy("pricing.plan.badge"),
      `${price} ${copy("landing.price.month")}`,
      copy("landing.plan.terms"),
      copy("landing.pace", weekPages),
      "Pages chosen from what buyers search and ask AI",
      `Up to ${BATTERY.COMPETITORS_MAX} competitors watched every Monday`,
      "A Monday email: what went live and what’s next",
      copy("offer.pricing.veto", { hours: String(VETO.defaultHours) }),
      copy("offer.start.priced"),
      "Cancel any time from Settings.",
      copy("pricing.plan.unsure"),
      copy("pricing.plan.scan"),
    ]);
    expect(html).toContain('href="#start"');
  });

  it("has one solid button in the hero, and it is Start", () => {
    expect(root.querySelectorAll("#top .btn").map((b) => b.text.trim())).toEqual([copy("offer.start.priced")]);
    expect(root.querySelector("#top .btn")?.classNames).toContain("btn-primary");
  });

  it("says VAT included, never tax included, and no money-back while the launch gate is shut (owner 2026-11-01; 2026-10-20 Q13)", () => {
    expect(page).toContain("VAT included");
    expect(page).not.toMatch(/tax included/i);
    expect(page).not.toMatch(/money-back|refund|change your mind/i);
  });

  it("the report's card keeps its own price line and none of the pricing page's VAT line (board PubReport)", () => {
    const report = text(renderToStaticMarkup(<PricingCard />));
    expect(report).toContain(copy("price.interval"));
    expect(report).toContain("Cancel any time from Settings.");
    expect(report).not.toContain(copy("landing.plan.terms"));
    expect(report).not.toMatch(/one click/i);
  });

  it("under the card, what ReachKit doesn't do, Perplexity included (D7)", () => {
    const top = section("top");
    const after = top.slice(top.indexOf(text(copy("pricing.plan.scan"))));
    expect(after).toContain(text(copy("pricing.all.not")));
    for (const key of ["pricing.all.not.maps", "how.value.not.ads", "how.value.not.social", "how.value.not.perplexity", "how.value.not.sites", "how.value.not.promise"] as const) {
      expect(after).toContain(copy(key));
    }
  });

  it("claims nothing Search Console would measure (D9)", () => {
    expect(page).not.toMatch(/Google found|Google and Bing have found|Google has found/);
  });
});

describe("board Pricing — what you see from week 1", () => {
  const first = (): string => section("week1");

  it("the title, its line, and the first months as six steps with no notes", () => {
    expect(first()).toContain(copy("pricing.first.title"));
    expect(first()).toContain(copy("pricing.first.body"));
    expect(first()).toContain(copy("pricing.months.title"));
    expectInOrder(first(), [
      `Day 1 ${copy("pricing.months.day1.what", { minutes: HOW_FACTS.setupMinutes })}`,
      `Day 2 ${copy("pricing.months.day2.what")}`,
      `First Monday ${copy("pricing.months.monday.what")}`,
      `${copy("how.when.found.at")} ${copy("how.when.found.what")}`,
      `${copy("how.when.showing.at")} ${copy("how.when.showing.what")}`,
      `${copy("how.when.top.at")} ${copy("how.when.top.what")}`,
    ]);
    for (const cut of ["What takes longer", copy("how.when.sub"), copy("how.when.promise"), copy("how.when.maps")]) {
      expect(first()).not.toContain(text(cut));
    }
  });

  it("the first months: timer, circle-check, inbox, search, eye, trending-up", () => {
    const week1 = html.slice(html.indexOf('<section id="week1"'), html.indexOf('<section id="compare"'));
    expect(whenIcons(week1)).toEqual({ steps: ["timer", "circle-check", "inbox", "search", "eye", "trending-up"], notes: [] });
  });
});

describe("board Pricing — €49 against the other ways", () => {
  const compare = (): string => section("compare");

  it("the three ways in three rows, then one caption that carries the chart's source", () => {
    expect(compare()).toContain(copy("pricing.compare.eyebrow"));
    expect(compare()).toContain(copy("pricing.compare.title", { price }));
    for (const way of ["Do it yourself", "An agency", "ReachKit"]) expect(compare()).toContain(way);
    expect(compare()).toContain("Who does the 5 jobs You do all 5, every week");
    for (const job of ["research", "choose", "write", "publish", "check results"]) expect(compare()).toContain(job);
    expect(compare()).toContain(`Cost ${AGENCY_BENCHMARK.fee} a month, the most common fee¹`);
    expect(compare()).toContain("Cost Hours, not money Your time, plus any AI writing tool");
    expect(compare()).toContain(
      `${text(copy("pricing.compare.limit"))} ¹ Most common agency fee for this work, Ahrefs survey of ${AGENCY_BENCHMARK.providers} providers, ${AGENCY_BENCHMARK.year}`
    );
  });

  it("draws no compare lead, no Also covers row and no cost chart", () => {
    expect(compare()).not.toContain("There are three ways");
    expect(compare()).not.toContain("Also covers");
    expect(compare()).not.toContain(copy("how.value.chart"));
    expect(root.querySelector("#compare figure")).toBeNull();
  });

  it("ReachKit's way draws sparkles for AI, never bot", () => {
    const markup = html.slice(html.indexOf('<section id="compare"'), html.indexOf('<section id="before"'));
    expect(icons(markup)).toContain("sparkles");
    expect(icons(markup)).not.toContain("bot");
  });
});

describe("board Pricing — before you pay, and the free report", () => {
  it("the board's questions in its order, in the landing's words; the refund waits for the launch gate", () => {
    const before = root.querySelector("#before")!;
    expect(before.querySelector(".eyebrow")).toBeNull();
    expect(before.querySelector("h2")?.text).toBe(copy("pricing.faq.title"));
    const asked = ["trial", "start", "approve", "results", "stop", "any"].map((id) => copy(`landing.faq.${id}.q` as Parameters<typeof copy>[0]));
    expect(before.querySelectorAll("summary").map((s) => s.text)).toEqual(asked);
    expect(text(before.outerHTML)).toContain(copy("landing.faq.stop.short"));
    expect(text(before.outerHTML)).toContain(copy("landing.faq.any.a"));
    expect(page).not.toContain("What exactly do I pay?");
  });

  it("each question draws its own icon to its left: gift, plug, pen, clock-4, circle-stop, store", () => {
    const summaries = root.querySelectorAll("#before summary");
    expect(summaries.map((s) => icons(s.outerHTML))).toEqual([["gift"], ["plug"], ["pen"], ["clock4"], ["circle-stop"], ["store"]]);
    for (const s of summaries) expect(s.firstElementChild?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("two columns at desktop, the last question across both only when it would sit alone", () => {
    const before = root.querySelector("#before")!;
    expect(before.querySelector("details")?.parentNode?.classNames).toContain("lg:grid-cols-2");
    const spans = before.querySelectorAll("details").map((d) => d.classNames.includes("lg:col-span-2"));
    expect(spans).toEqual(spans.map((_, i) => spans.length % 2 === 1 && i === spans.length - 1));
  });

  it("closes on the free scan: the field, its button and its promise, and nothing under it", () => {
    const start = section("start");
    expect(start).toContain(`${copy("pricing.plan.unsure")} ${copy("pricing.close.title")}`);
    expectInOrder(start, [copy("landing.field.label"), copy("landing.start.cta"), copy("landing.close.assurance")]);
    expect(html).toContain(`placeholder="${copy("landing.field.placeholder")}"`);
    expect(page).not.toContain("Type your website.");
    expect(page).not.toContain("No account before you pay.");
  });
});

describe("board Pricing — the cut blocks leave no key behind", () => {
  it("no pricing.* key of a cut block is in the registry", () => {
    const retired = Object.keys(COPY).filter((key) =>
      /^pricing\.(buys|chip\.|plan\.billing|week\.|first\.longer|compare\.body|faq\.pay|close\.body|footnote)/.test(key)
    );
    expect(retired).toEqual([]);
  });
});
