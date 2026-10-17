// tests/generate/rules/rival-claims.test.ts — SPEC §7 (issue 1485): a
// rival's claim keeps its plan and its own page, and nothing is denied of a
// rival that no source denies.
//
// What a reader would notice if it broke: a rival's free trial set out as
// the product, a reviewer's price beside the rival's own pricing page, or
// "X has no free plan" where X's own page offers one — the defect found live
// on content.reachkit.app/profound-alternatives. One panel, five kinds of
// business, so the reading is not one market's.
import "../env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ContextPack, PackClaim } from "../../../src/lib/generate/pipeline/pack";
import { admittedClaims, ownPagesFirst } from "../../../src/lib/generate/pipeline/research";
import { comparisonTable } from "../../../src/lib/generate/pipeline/table";
import { checkRivalNegative, checkRivalScope, type NamedRival } from "../../../src/lib/generate/rules/rivals";

const TODAY = new Date("2026-10-17T00:00:00Z");
const STORED = JSON.parse(
  readFileSync(path.join(__dirname, "../../../docs/walk/pipeline-v2/listicle.pack.json"), "utf8")
) as ContextPack;

interface Case {
  kind: string;
  rival: NamedRival & { name: string };
  /** The rival's own pricing page, as it reads. */
  pricing: string;
  /** A claim it states of one plan, and that plan's name. */
  scoped: { quote: string; plan: string };
  /** A claim true of every plan. */
  whole: string;
  /** A third party's page about the rival. */
  review: { url: string; text: string; quote: string };
  /** A denial its own page supports, and one nothing supports. */
  denied: { supported: string; own: string; unsupported: string };
}

const PANEL: Case[] = [
  {
    kind: "a local trade",
    rival: { domain: "swiftplumbing.example", name: "Swift Plumbing" },
    pricing: "Emergency call-out £95 per visit, any hour. New customer offer: first half hour of labour included. No call-out fee on weekday mornings. Gas safety checks for every boiler we fit.",
    scoped: { quote: "first half hour of labour included", plan: "New customer offer" },
    whole: "Gas safety checks for every boiler we fit.",
    review: { url: "https://reviews.example/swift-plumbing", text: "Swift Plumbing charges £60 an hour for most jobs in town according to our survey of local trades.", quote: "Swift Plumbing charges £60 an hour for most jobs in town" },
    denied: { supported: "Swift Plumbing does not charge a call-out fee on weekday mornings.", own: "No call-out fee on weekday mornings.", unsupported: "Swift Plumbing has no emergency service." },
  },
  {
    kind: "a shop",
    rival: { domain: "leafandloom.example", name: "Leaf & Loom" },
    pricing: "Monthly box £24 a month, four seasonal plants. Trial box: one plant shipped free for 14 days. Free delivery is not offered outside the mainland. Every plant is grown in our own nursery.",
    scoped: { quote: "one plant shipped free for 14 days", plan: "Trial box" },
    whole: "Every plant is grown in our own nursery.",
    review: { url: "https://giftguide.example/plant-boxes", text: "Leaf & Loom costs £19 a month and ships nationwide, our gift guide found after testing six boxes.", quote: "Leaf & Loom costs £19 a month and ships nationwide" },
    denied: { supported: "Leaf & Loom does not offer free delivery outside the mainland.", own: "Free delivery is not offered outside the mainland.", unsupported: "Leaf & Loom lacks a gift option." },
  },
  {
    kind: "a firm",
    rival: { domain: "ledgerpartners.example", name: "Ledger Partners" },
    pricing: "Starter bookkeeping £150 a month, up to 50 transactions. Growth £400 a month, payroll for ten staff. Every client has a named accountant. We do not take on audit work.",
    scoped: { quote: "payroll for ten staff", plan: "Growth" },
    whole: "Every client has a named accountant.",
    review: { url: "https://firms.example/ledger-partners", text: "Ledger Partners bills from £99 a month for sole traders, a directory listing of accountants says.", quote: "Ledger Partners bills from £99 a month for sole traders" },
    denied: { supported: "Ledger Partners does not take on audit work.", own: "We do not take on audit work.", unsupported: "Ledger Partners doesn't offer tax returns." },
  },
  {
    kind: "software",
    rival: { domain: "tracklight.example", name: "Tracklight" },
    pricing: "Free trial: 50 prompts run daily for 7 days across three answer engines. Enterprise covers nine answer engines and custom prompt volume. Every plan exports reports to CSV. No credit card is needed for the trial.",
    scoped: { quote: "50 prompts run daily for 7 days across three answer engines", plan: "Free trial" },
    whole: "Every plan exports reports to CSV.",
    review: { url: "https://listicle.example/tracklight-alternatives", text: "Tracklight's entry-level package starts at $99/month, according to third-party reviewers we read.", quote: "Tracklight's entry-level package starts at $99/month" },
    denied: { supported: "Tracklight does not ask for a credit card for its trial.", own: "No credit card is needed for the trial.", unsupported: "Tracklight has no free tier." },
  },
  {
    kind: "a creator",
    rival: { domain: "studionova.example", name: "Studio Nova" },
    pricing: "Pro membership $12 a month, every course and live critiques. Free plan: three lessons a week. All lessons are recorded in 4K. Downloads are not available on the free plan.",
    scoped: { quote: "every course and live critiques", plan: "Pro membership" },
    whole: "All lessons are recorded in 4K.",
    review: { url: "https://creators.example/studio-nova", text: "Studio Nova charges $20 a month for its courses, a creator round-up reported this spring.", quote: "Studio Nova charges $20 a month for its courses" },
    denied: { supported: "Studio Nova does not allow downloads on its free plan.", own: "Downloads are not available on the free plan.", unsupported: "Studio Nova has no community forum." },
  },
];

const pricingUrl = (c: Case): string => `https://${c.rival.domain}/pricing`;

/** What the claims call returned for the rival's page and the review. */
function research(c: Case) {
  const pages = [
    { url: pricingUrl(c), title: c.rival.name, text: c.pricing, readAt: TODAY.toISOString(), kind: "rival_pricing" as const, product: c.rival.domain },
    { url: c.review.url, title: "Review", text: c.review.text, readAt: TODAY.toISOString(), kind: "top_result" as const },
  ];
  return admittedClaims(
    [
      { page: 1, quote: c.scoped.quote, year: null, about: "product", plan: c.scoped.plan, rival: null },
      { page: 1, quote: c.whole, year: null, about: "product", plan: null, rival: null },
      { page: 1, quote: c.denied.own, year: null, about: "product", plan: null, rival: null },
      { page: 2, quote: c.review.quote, year: null, about: "other", plan: null, rival: c.rival.domain },
    ],
    pages,
    TODAY,
    [c.rival.domain]
  );
}

const factsOf = (c: Case) => ownPagesFirst(research(c)).map((fact) => ({ ...fact, readAt: fact.readAt.toISOString() }));
const link = (text: string, url: string) => `[${text}](${url})`;

describe.each(PANEL)("rival claims for $kind", (c) => {
  const rivals = [c.rival];

  it("keeps each claim with the plan its own page names, and a rival's own page outranks a third party's", () => {
    const read = research(c);
    expect(read.find((fact) => fact.passage === c.scoped.quote)).toMatchObject({ product: c.rival.domain, plan: c.scoped.plan, url: pricingUrl(c) });
    expect(read.find((fact) => fact.passage === c.whole)).toMatchObject({ plan: null });
    // A plan the page does not name is no plan anyone can check.
    const page = { url: pricingUrl(c), title: c.rival.name, text: c.pricing, readAt: TODAY.toISOString(), kind: "rival_pricing" as const, product: c.rival.domain };
    expect(admittedClaims([{ page: 1, quote: c.whole, year: null, about: "product", plan: "Platinum", rival: null }], [page], TODAY)).toEqual([]);
    expect(read.find((fact) => fact.url === c.review.url)).toMatchObject({ about: c.rival.domain });
    // Its own page was read, so the review's claim about it is not kept.
    expect(ownPagesFirst(read).some((fact) => fact.url === c.review.url)).toBe(false);
    // Where its own page yielded nothing, the review stays, cited to itself.
    expect(ownPagesFirst(read.filter((fact) => fact.product === undefined)).map((fact) => fact.url)).toEqual([c.review.url]);
  });

  it("a claim of one plan is stated with that plan's name, and a rival is cited to its own page", () => {
    const facts = factsOf(c);
    const scope = (sentence: string) => checkRivalScope({ markdown: sentence, rivals, facts });
    expect(scope(`${c.rival.name} offers ${link(c.scoped.quote, pricingUrl(c))}.`)?.detail).toMatchObject({ rule: "rival_source", fault: "plan" });
    expect(scope(`${c.rival.name}'s ${c.scoped.plan} offers ${link(c.scoped.quote, pricingUrl(c))}.`)).toBeNull();
    expect(scope(`${c.rival.name} says: ${link(c.whole, pricingUrl(c))}`)).toBeNull();
    // The review, cited beside its name, where its own page was read.
    const withReview = [...facts, { ...research(c).find((fact) => fact.url === c.review.url)!, readAt: TODAY.toISOString() }];
    expect(checkRivalScope({ markdown: `${link(c.review.quote, c.review.url)}.`, rivals, facts: withReview })?.detail).toMatchObject({ fault: "third_party" });
  });

  it("the table names the tier a rival's cell shows", () => {
    const claims: PackClaim[] = factsOf(c).map((fact) => ({ ...fact, title: c.rival.name }));
    const other: PackClaim = { passage: "Weekly reports for every client.", url: "https://other.example/features", title: "Other", readAt: TODAY.toISOString(), kind: "rival_features", product: "other.example", plan: null };
    const table = comparisonTable({ ...STORED, claims: [...claims, other], products: [{ domain: c.rival.domain, pages: [] }, { domain: "other.example", pages: [] }] }, 2);
    const row = table!.markdown.split("\n").find((line) => line.includes(c.rival.domain) || line.includes(c.rival.name))!;
    // What it does is the claim true of every plan, not the trial's.
    expect(row).toContain(c.whole);
    expect(row).not.toContain(c.scoped.quote);
    const only = comparisonTable({ ...STORED, claims: [...claims.filter((each) => each.passage === c.scoped.quote), other], products: [{ domain: c.rival.domain, pages: [] }, { domain: "other.example", pages: [] }] }, 2);
    expect(only!.markdown).toContain(`${c.scoped.plan}: [${c.scoped.quote}]`);
  });

  it("nothing is denied of a rival that no stored source denies", () => {
    const facts = factsOf(c);
    const denies = (sentence: string, faq: { question: string; answer: string }[] = []) => checkRivalNegative({ markdown: sentence, faq, rivals, facts });
    expect(denies(c.denied.unsupported)?.detail).toEqual({ rule: "rival_negative", sentence: c.denied.unsupported });
    expect(denies(`${c.denied.supported.slice(0, -1)} (${link("its pricing", pricingUrl(c))}).`)).toBeNull();
    expect(denies(c.denied.supported)).toBeNull();
    // The FAQ stored beside the page is read too.
    expect(denies("Prices vary.", [{ question: "Is there a cheaper option?", answer: c.denied.unsupported }])?.rule).toBe("rival_negative");
    // A denial of the business's own, or one in another clause, is not about the rival.
    expect(denies(`Unlike ${c.rival.name}, we do not charge for it.`)).toBeNull();
  });
});
