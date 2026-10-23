// `/pricing` against board Pricing: each section in the board's order, with
// its heading and the strings that make it that section. The words come from
// the registry and the figures from the constants, so a renamed key or a
// moved section fails here, and the parity reading in `no overflow · axe`
// counts every other string.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { default: PricingPage } = (await import("@/app/(public)/pricing/page")) as {
  default: (p: { searchParams?: Record<string, string> }) => React.JSX.Element;
};
const { PricingCard } = await import("@/app/(public)/scan/[domain]/_modules/pricing");
const { copy } = await import("@/lib/presentation/copy");
const { BATTERY, VETO, WEEK_PLAN } = await import("@/lib/config/constants");
const { HARD_RULES } = await import("@/lib/generate/rules/types");
const { HOW_FACTS } = await import("@/app/(public)/_how/facts");
const { AGENCY_BENCHMARK, EXAMPLES } = await import("@/app/(public)/_how/specimen");

const html = renderToStaticMarkup(<PricingPage />);
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

describe("board Pricing — the sections, in the board's order", () => {
  it("top, one week, everything, week 1, compare, before you pay, the free report", () => {
    expect(sections.map((s) => s.id)).toEqual(["top", "week", "included", "week1", "compare", "before", "start"]);
  });
});

describe("board Pricing — the head and the plan card", () => {
  const top = (): string => section("top");

  it("says one plan, everything included, and what €49 a month buys in four figures", () => {
    expect(html).toMatch(/<h1[^>]*>One plan\. Everything included\.<\/h1>/);
    expect(top()).toContain(copy("pricing.subline", weekPages));
    expect(top()).toContain(copy("pricing.buys", { price }));
    for (const figure of [
      `up to ${WEEK_PLAN.days} pages a week, new or updated`,
      `up to ${BATTERY.COMPETITORS_MAX} competitors watched every Monday`,
      "1 email every Monday: what went live, what moved",
      `${HOW_FACTS.setupMinutes} min of your time, once`,
    ]) {
      expect(top()).toContain(figure);
    }
    for (const chip of ["no contract", "no setup fee", "cancel any time"]) expect(top()).toContain(chip);
  });

  it("the card names the plan, how it is billed, its five rows, Start, the cancel line and the free path", () => {
    const card = top();
    const order = [
      copy("pricing.plan.badge"),
      copy("price.interval"),
      copy("pricing.plan.billing", { price }),
      copy("landing.pace", weekPages),
      copy("pricing.plan.chosen"),
      copy("pricing.plan.checked"),
      copy("pricing.plan.mail"),
      copy("offer.pricing.veto", { hours: String(VETO.defaultHours) }),
      copy("offer.start.priced"),
      copy("pricing.plan.cancel"),
      copy("pricing.plan.unsure"),
      copy("pricing.plan.scan"),
    ].map((line) => text(line));
    const at = order.map((line) => card.indexOf(line));
    expect(at.every((i) => i >= 0), order.filter((_, i) => at[i]! < 0).join(" | ")).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).toContain('href="#start"');
  });

  it("the report's card keeps its own cancel line and gains none of the pricing page's", () => {
    const report = text(renderToStaticMarkup(<PricingCard />));
    expect(report).toContain(copy("offer.cancel_self_service"));
    expect(report).not.toContain(copy("pricing.plan.cancel"));
    expect(report).not.toContain(copy("pricing.plan.billing", { price }));
    // The report's line is the first sentence of the pricing card's own, so it is read outside that one.
    expect(top().replace(copy("pricing.plan.cancel"), "")).not.toContain(copy("offer.cancel_self_service"));
  });

  it("shows no guarantee while the launch gate is shut (owner 2026-10-20, Q13)", () => {
    expect(text(html)).not.toMatch(/money-back|refund|change your mind/i);
  });
});

describe("board Pricing — only week 1 is emailed first (D3)", () => {
  const page = text(html);

  it("says what week 1 emails, what follows, and that a page is yours to stop", () => {
    expect(page).toContain("In week 1 we email each page. After that, the Monday email lists the week’s pages.");
    expect(page).toContain("Edit or stop it before it goes live");
    expect(page).toContain(`Each page goes live ${VETO.defaultHours} hours after it is written, unless you stop it.`);
    expect(page).toContain("Written, goes live unless you stop it");
    expect(page).toContain(`up to ${BATTERY.COMPETITORS_MAX} competitors watched every Monday`);
  });

  it("promises no mail before every page, and no one-click cancel on the report's card", () => {
    for (const old of ["We email each page first", "Emailed before it goes live", "after we email it", "Emailed to you", "competitors checked"]) {
      expect(page).not.toContain(old);
    }
    const report = text(renderToStaticMarkup(<PricingCard />));
    expect(report).toContain("Cancel any time from Settings.");
    expect(report).not.toMatch(/one click/i);
  });
});

describe("board Pricing — one week of your €49", () => {
  const week = (): string => section("week");

  it("the example plumber's week, day by day, with its key and its caption", () => {
    expect(week()).toContain(copy("pricing.week.eyebrow"));
    expect(week()).toContain(copy("pricing.week.title", { price }));
    expect(week()).toContain(text(copy("pricing.week.body", weekPages)));
    expect(week()).toContain(text(copy("how.week.name", { business: EXAMPLES.plumber.business })));
    expect(week()).toContain("Mon 19 – Sun 25 Oct");
    for (const day of EXAMPLES.plumber.plan) if (day.kind !== "skip") expect(week()).toContain(text(day.title));
    expect(week()).toContain(copy("how.week.skip.why"));
    for (const key of ["how.week.legend.live", "how.week.legend.emailed", "how.week.legend.update"] as const) {
      expect(week()).toContain(copy(key));
    }
    expect(week()).toContain(copy("pricing.week.caption", { week: EXAMPLES.plumber.mail.week, ...weekPages }));
  });

  it("then where a page goes live, the email before it, and the Monday email", () => {
    expect(week()).toContain(copy("pricing.week.address"));
    expect(week()).toContain(text(copy("pricing.week.address.line")));
    expect(week()).toContain(copy("pricing.week.emailed"));
    expect(week()).toContain(copy("how.part.window", { hours: VETO.defaultHours }));
    expect(week()).toContain(`${copy("pricing.week.mail")} Mon 19 Oct`);
    expect(week()).toContain(copy("pricing.week.mail.climbing", { n: EXAMPLES.plumber.mail.climbing }));
    expect(week()).toContain(copy("pricing.week.mail.calm"));
  });
});

describe("board Pricing — everything in the €49", () => {
  const all = (): string => section("included");

  it("the plan's tiles, each with how often it runs, and its figures from the constants", () => {
    expect(all()).toContain(copy("pricing.all.title", { price }));
    for (const key of ["research", "live", "stop", "mail", "fix", "language", "yours"]) {
      expect(all()).toContain(text(copy(`pricing.all.${key}` as Parameters<typeof copy>[0])));
    }
    expect(all()).toContain(`Up to ${BATTERY.COMPETITORS_MAX}, taken from who shows up when your buyers search.`);
    expect(all()).toContain(`${HOW_FACTS.searches} Google searches and ${HOW_FACTS.prompts} questions asked to AI`);
    expect(all()).toContain(`Up to ${HARD_RULES.length} checks on every page`);
    expect(all()).toContain(`Up to ${WEEK_PLAN.days} pages a week`);
  });

  it("no tile claims what Search Console would measure (D9)", () => {
    expect(all()).not.toMatch(/Google found|Google and Bing have found/);
    expect(section("week1")).not.toMatch(/Google has found/);
  });

  it("and what ReachKit doesn't do", () => {
    expect(all()).toContain(text(copy("pricing.all.not")));
    for (const key of ["pricing.all.not.maps", "how.value.not.ads", "how.value.not.social", "how.value.not.perplexity", "how.value.not.sites", "how.value.not.promise"] as const) {
      expect(all()).toContain(copy(key));
    }
  });
});

describe("board Pricing — what you see from week 1", () => {
  const first = (): string => section("week1");

  it("what week 1 shows, what takes longer, and the first months as time ranges", () => {
    expect(first()).toContain(copy("pricing.first.title"));
    for (const key of ["pricing.first.plan", "pricing.first.live", "pricing.first.google", "pricing.first.ai"] as const) {
      expect(first()).toContain(text(copy(key)));
    }
    expect(first()).toContain(copy("pricing.first.longer"));
    expect(first()).toContain(copy("pricing.months.title"));
    expect(first()).toContain(copy("how.when.sub"));
    const steps = [
      `Day 1 ${copy("pricing.months.day1.what", { minutes: HOW_FACTS.setupMinutes })}`,
      `Day 2 ${copy("pricing.months.day2.what")}`,
      `First Monday ${copy("pricing.months.monday.what")}`,
      `${copy("how.when.found.at")} ${copy("how.when.found.what")}`,
      `${copy("how.when.showing.at")} ${copy("how.when.showing.what")}`,
      `${copy("how.when.top.at")} ${text(copy("how.when.top.what"))}`,
    ];
    const at = steps.map((step) => first().indexOf(step));
    expect(at.every((i) => i >= 0), steps.filter((_, i) => at[i]! < 0).join(" | ")).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(first()).toContain(copy("how.when.promise"));
    expect(first()).not.toContain(copy("how.when.maps"));
  });
});

describe("board Pricing — €49 against the other ways", () => {
  const compare = (): string => section("compare");

  it("the three ways in the same four rows, then what each costs on one scale", () => {
    expect(compare()).toContain(copy("pricing.compare.title", { price }));
    for (const way of ["Do it yourself", "An agency", "ReachKit"]) expect(compare()).toContain(way);
    expect(compare()).toContain("Who does the 5 jobs You do all 5, every week");
    for (const job of ["research", "choose", "write", "publish", "check results"]) expect(compare()).toContain(job);
    expect(compare()).toContain(`Cost ${AGENCY_BENCHMARK.fee} a month, the most common fee¹`);
    expect(compare()).toContain("Cost Hours, not money Your time, plus any AI writing tool");
    expect(compare()).toContain(copy("how.value.chart"));
    expect(compare()).toContain("one scale, 0 to 1,000 a month");
    expect(compare()).toContain(`An agency ${AGENCY_BENCHMARK.fee} a month¹`);
    expect(compare()).toContain(`ReachKit ${price} a month, VAT included`);
    expect(compare()).toContain(`¹ Most common SEO retainer, Ahrefs survey of ${AGENCY_BENCHMARK.providers} providers`);
    expect(compare()).toContain(text(copy("pricing.compare.limit")));
  });
});

describe("board Pricing — before you pay, and the free report", () => {
  it("the questions in the board's order, the price first", () => {
    const before = section("before");
    expect(before).toContain(copy("pricing.faq.title"));
    const asked = [
      "pricing.faq.pay.q",
      "landing.faq.trial.q",
      "landing.faq.start.q",
      "landing.faq.approve.q",
      "landing.faq.results.q",
      "landing.faq.stop.q",
      "landing.faq.local.q",
      "how.faq.software.q",
    ].map((key) => before.indexOf(text(copy(key as Parameters<typeof copy>[0]))));
    expect(asked.every((i) => i >= 0)).toBe(true);
    expect([...asked].sort((a, b) => a - b)).toEqual(asked);
    expect(before).toContain(copy("pricing.faq.pay.a", { price }));
  });

  it("closes on the free scan: the landing's field, its button and its promise", () => {
    const start = section("start");
    expect(start).toContain(`${copy("pricing.plan.unsure")} ${copy("pricing.close.title")}`);
    expect(start).toContain(text(copy("pricing.close.body")));
    expect(start).toContain(copy("landing.field.label"));
    expect(start).toContain(copy("landing.start.cta"));
    expect(start).toContain(copy("landing.close.assurance"));
    expect(html).toContain(`placeholder="${copy("landing.field.placeholder")}"`);
  });
});
