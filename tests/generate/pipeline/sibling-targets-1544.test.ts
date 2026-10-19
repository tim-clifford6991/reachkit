// tests/generate/pipeline/sibling-targets-1544.test.ts — issue 1544: a
// question another live or planned page of the site targets is that page's
// to answer. It is never a sibling's buyer question too, whatever the
// business and its language.
import "../env";
import { describe, expect, it } from "vitest";
import { buildPack, type PackInputs } from "../../../src/lib/generate/pipeline/pack";
import type { SitePage } from "../../../src/lib/opportunities";
import type { Locale } from "../../../src/lib/locale/locales";
import { AT, GROUNDED, opportunity, report } from "../fixtures";

interface Business {
  name: string;
  domain: string;
  category: string;
  locale?: Locale;
  target: string;
  /** Passages of its own pages, each answering one question below. */
  facts: string[];
  peopleAlsoAsk: string[];
  related?: { search: string; volume: number }[];
}

const PLUMBER: Business = {
  name: "Riverside Plumbing",
  domain: "riversideplumbing.example",
  category: "plumbing services",
  target: "emergency plumber near me",
  facts: [
    "Our plumbers charge $95 per hour for call-outs, with no extra fee at night.",
    "A burst pipe repair takes our plumbers about two hours on average.",
    "We fix leaking water heater tanks the same day.",
  ],
  peopleAlsoAsk: [
    "How much does a plumber charge per hour?",
    "How long does a burst pipe repair take?",
    "Can a leaking water heater tank be fixed?",
  ],
  related: [{ search: "plumber call out fee night", volume: 320 }],
};

const BOARDS: Business = {
  name: "Acme",
  domain: "example.com",
  category: "project management software",
  target: "project management software for small teams",
  facts: [
    "Acme's task boards show every project a small team runs.",
    "Acme imports Trello boards and their cards in one click.",
    "Guests who only view Acme boards are free of charge.",
  ],
  peopleAlsoAsk: ["Do small teams need task boards?", "Can I import Trello boards and cards?", "Are guests who view boards free of charge?"],
};

const STEUERBERATER: Business = {
  name: "Kanzlei Weber",
  domain: "kanzlei-weber.example",
  category: "Steuerberatung",
  locale: { country: "DE", language: "de" },
  target: "steuerberater für selbstständige",
  facts: [
    "Die Steuererklärung für Selbstständige kostet bei uns ab 450 Euro im Jahr.",
    "Belege reichen Mandanten digital über DATEV Unternehmen online ein.",
    "Die Umsatzsteuervoranmeldung übernehmen wir monatlich oder vierteljährlich.",
  ],
  peopleAlsoAsk: [
    "Was kostet eine Steuererklärung für Selbstständige?",
    "Wie reiche ich Belege digital über DATEV ein?",
    "Wer übernimmt die Umsatzsteuervoranmeldung monatlich?",
  ],
};

function inputs(business: Business, sitePages: SitePage[]): PackInputs {
  return {
    type: "qa",
    opportunity: opportunity({ targetQuery: business.target, targetRef: business.target.replace(/\s+/g, "-"), title: null }),
    site: { businessName: business.name, domain: business.domain, doNotClaim: [], rivals: [] },
    category: business.category,
    writingFor: null,
    byline: null,
    voice: null,
    profile: null,
    facts: business.facts.map((passage) => ({ fact: { ...GROUNDED, url: `https://${business.domain}/`, passage }, sourceText: passage })),
    research: { facts: [], products: [], asked: { peopleAlsoAsk: business.peopleAlsoAsk, related: business.related ?? [] } },
    report: { ...report(), questions: { kind: "unmeasured", reason: "not_attempted", at: AT } },
    sitePages,
    links: [],
    now: AT,
    ...(business.locale === undefined ? {} : { locale: business.locale }),
  };
}

const live = (question: string, url: string): SitePage => ({ title: question, question, url, kind: "qa", status: "published" });
const queued = (question: string): SitePage => ({ title: question, question, url: null, kind: "qa", status: "planned" });

/** A People-also-ask question as a sibling's target stores it (issue 1519). */
const targetOf = (question: string): string => question.toLowerCase().replace(/[?]+$/, "");

describe("issue 1544: a question a sibling page targets is not this page's buyer question", () => {
  const cases: [string, Business, taken: string][] = [
    ["a plumber, in English", PLUMBER, "How much does a plumber charge per hour?"],
    ["a software business, in English", BOARDS, "Can I import Trello boards and cards?"],
    ["a tax adviser, in German", STEUERBERATER, "Was kostet eine Steuererklärung für Selbstständige?"],
  ];
  const rest = (business: Business, taken: string) => business.peopleAlsoAsk.filter((asked) => asked !== taken);

  it.each(cases)("%s: a live page's target is left out, and the rest stand", (_, business, taken) => {
    // Every one stands while no other page targets it.
    expect(buildPack(inputs(business, [])).questions).toEqual(expect.arrayContaining(business.peopleAlsoAsk));
    const questions = buildPack(inputs(business, [live(targetOf(taken), `https://${business.domain}/answers/one`)])).questions;
    expect(questions).not.toContain(taken);
    expect(questions).toEqual(expect.arrayContaining(rest(business, taken)));
  });

  it.each(cases)("%s: a queued Write or Earn row's target is reserved the same way", (_, business, taken) => {
    const questions = buildPack(inputs(business, [queued(targetOf(taken))])).questions;
    expect(questions).not.toContain(taken);
    expect(questions).toEqual(expect.arrayContaining(rest(business, taken)));
  });

  it("a sibling that targets a search reserves the question it asks, and a related search by that search", () => {
    const search = PLUMBER.related![0]!.search;
    const asked = buildPack(inputs(PLUMBER, [])).questions.find((question) => !PLUMBER.peopleAlsoAsk.includes(question));
    expect(asked).toBeDefined();
    expect(buildPack(inputs(PLUMBER, [queued(search)])).questions).not.toContain(asked);
    // A sibling whose target is that search worded as a question.
    expect(buildPack(inputs(PLUMBER, [live(targetOf(asked!), `https://${PLUMBER.domain}/answers/two`)])).questions).not.toContain(asked);
  });
});
