// tests/site-profile/knowledge.test.ts — issue 1133, SPEC §0 "Knowledge
// base" and §5 (2026-09-29).
//
// What a founder is owed: what ReachKit says it knows about their business
// was on one of their pages, with that page named — or they said it
// themselves — and a price nobody published never becomes one.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";
import type { PageReading } from "../../src/lib/site-profile/knowledge/types";

applyEnvFixture();

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

const { KNOWLEDGE_BASE, PROFILE_PROMPT_CAPS } = await import("../../src/lib/config/constants");
const { readKnowledge, readablePages } = await import("../../src/lib/site-profile/knowledge/extract");
const { knowledgeBase } = await import("../../src/lib/site-profile/knowledge/merge");
const { isBuyerQuestion, isSpecificAudience } = await import("../../src/lib/site-profile/knowledge/clean");
const { readFirstRank } = await import("../../src/lib/site-profile/knowledge/priority");
const { NO_KNOWLEDGE, founderAnswers } = await import("../../src/lib/site-profile/knowledge/types");
const { promptProfile } = await import("../../src/lib/generate/voice/profile-block");

const AT = new Date("2026-10-03T09:00:00.000Z");
const EMPTY: PageReading = {
  offerings: [],
  audience: [],
  problems: [],
  differentiators: [],
  proof: [],
  questions: [],
  integrations: [],
  places: [],
};

const PRICING = {
  url: "https://example.com/pricing",
  text: `${"One plan for a small business that wants pages written for it every day. ".repeat(4)}\nReachKit is €49 a month.`,
};
const BLOG = {
  url: "https://example.com/blog/a-post",
  text: "A long post about the market in general, with nothing to say about a price. ".repeat(4),
};

function cost(capped = false) {
  return { capHit: () => capped } as never;
}

function answers(byUrl: Record<string, Partial<PageReading>>) {
  llmMock.mockImplementation(async (_c: unknown, call: { input: { page: { url: string } } }) => ({
    kind: "measured",
    value: { ...EMPTY, ...byUrl[call.input.page.url] },
    at: AT,
  }));
}

beforeEach(() => {
  llmMock.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("the pages that say what the business sells are read first", () => {
  it("ranks what it costs, what it sells, who it is and what buyers ask ahead of its reference pages and the rest (issue 1314)", () => {
    const order = ["/pricing", "/services", "/faq", "/case-studies", "/reviews", "/docs", "/changelog", "/products/blue-widget", "/blog/a-post", "/privacy"];
    const ranks = order.map((path) => readFirstRank(`https://example.com${path}`));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(order.length);
    expect(readFirstRank("https://example.com/")).toBeLessThan(ranks[0]!);
  });

  it("asks about the pricing page before a blog post, whatever order they were read in", async () => {
    answers({});
    await readKnowledge(cost(), { domain: "example.com", pages: [BLOG, PRICING], previous: NO_KNOWLEDGE, now: AT });
    const asked = llmMock.mock.calls.map((call) => (call[1] as { input: { page: { url: string } } }).input.page.url);
    expect(asked[0]).toBe(PRICING.url);
  });
});

describe("the read is bounded, whatever the site's size (issue 1314)", () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      url: `https://example.com/docs/page-${i}`,
      text: `Page ${i} of the handbook says something of its own about setting the product up. `.repeat(90),
    }));

  it("asks about the most informative twenty pages of a site of a hundred, the pricing page among them", async () => {
    answers({});
    const read = await readKnowledge(cost(), { domain: "example.com", pages: [...many(100), PRICING], previous: NO_KNOWLEDGE, now: AT });
    const asked = llmMock.mock.calls.map((call) => (call[1] as { input: { page: { url: string } } }).input.page.url);
    expect(asked.length).toBeLessThanOrEqual(KNOWLEDGE_BASE.MAX_PAGES);
    expect(asked[0]).toBe(PRICING.url);
    expect(read.knowledge.pages.length).toBe(asked.length);
  });

  it("starts no call the budget does not hold in full, with six calls in flight", async () => {
    // Each page's most: 2,000 tokens in and the call site's whole allowance back.
    const worst = (8000 / 4) * 1e-4 + 1400 * 5e-4;
    answers({});
    const read = await readKnowledge(cost(), { domain: "example.com", pages: many(100), previous: NO_KNOWLEDGE, now: AT });
    expect(read.asked * worst).toBeLessThanOrEqual(KNOWLEDGE_BASE.BUDGET_C + 6 * worst);
    expect(read.asked).toBeGreaterThan(10);
  });
});

describe("a page's own questions are its buyers' questions (issue 1314)", () => {
  const FAQ = {
    url: "https://example.com/faq",
    text: "Answers to what our customers ask before they book a repair with us, at home or at work. ".repeat(4),
    questions: ["Is your team licensed and insured?", "Does it cost to get a diagnosis?", "FAQ"],
  };

  it("keeps the questions the page's markup asks, ahead of what the model read, once each", async () => {
    answers({ [FAQ.url]: { questions: ["Does it cost to get a diagnosis?", "Do you work on weekends?"] } });
    const read = await readKnowledge(cost(), { domain: "example.com", pages: [FAQ], previous: NO_KNOWLEDGE, now: AT });
    expect(read.knowledge.pages[0]!.reading.questions).toEqual([
      "Is your team licensed and insured?",
      "Does it cost to get a diagnosis?",
      "Do you work on weekends?",
    ]);
  });

  it("adds them to a page read before the rule, without asking about it again", async () => {
    answers({});
    const first = await readKnowledge(cost(), { domain: "example.com", pages: [{ url: FAQ.url, text: FAQ.text }], previous: NO_KNOWLEDGE, now: AT });
    expect(first.knowledge.pages[0]!.reading.questions).toEqual([]);
    llmMock.mockClear();
    const second = await readKnowledge(cost(), { domain: "example.com", pages: [FAQ], previous: first.knowledge, now: AT });
    expect(llmMock).not.toHaveBeenCalled();
    expect(second.knowledge.pages[0]!.reading.questions).toHaveLength(2);
  });
});

describe("only what a page says is kept, with the page it was read from", () => {
  it("keeps a price the page carries and drops one it does not", async () => {
    answers({
      [PRICING.url]: {
        offerings: [{ name: "ReachKit", features: [], prices: ["€49 a month", "€490 a year"], uses: [] }],
        proof: ["Customers grew traffic by 300%"],
      },
    });
    const read = await readKnowledge(cost(), { domain: "example.com", pages: [PRICING], previous: NO_KNOWLEDGE, now: AT });
    const base = knowledgeBase({ stored: read.knowledge, answers: {} });

    expect(base.offerings).toEqual([
      { name: "ReachKit", features: [], prices: ["€49 a month"], uses: [], source: { kind: "page", url: PRICING.url } },
    ]);
    expect(base.proof).toEqual([]);
  });

  it("a legal page is never asked about", async () => {
    answers({});
    const privacy = { url: "https://example.com/privacy", text: PRICING.text };
    await readKnowledge(cost(), { domain: "example.com", pages: [privacy], previous: NO_KNOWLEDGE, now: AT });
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("a line the site repeats on three pages is not sent to any call", () => {
    const footer = "Start free today and cancel whenever you like, no card needed.";
    const pages = ["a", "b", "c"].map((name) => ({
      url: `https://example.com/${name}`,
      text: `${`Page ${name} says something of its own about the business here. `.repeat(5)}\n${footer}`,
    }));
    for (const page of readablePages(pages)) expect(page.text).not.toContain(footer);
  });

  it("a page that has not changed is not asked about again", async () => {
    answers({ [PRICING.url]: { audience: ["Small businesses"] } });
    const first = await readKnowledge(cost(), { domain: "example.com", pages: [PRICING], previous: NO_KNOWLEDGE, now: AT });
    llmMock.mockClear();

    const second = await readKnowledge(cost(), { domain: "example.com", pages: [PRICING], previous: first.knowledge, now: AT });

    expect(llmMock).not.toHaveBeenCalled();
    expect(second.reused).toBe(1);
    expect(second.knowledge.pages).toEqual(first.knowledge.pages);
  });

  it("a pass out of money asks nothing and says so", async () => {
    const read = await readKnowledge(cost(true), { domain: "example.com", pages: [PRICING], previous: NO_KNOWLEDGE, now: AT });
    expect(llmMock).not.toHaveBeenCalled();
    expect(read.stoppedBy).toBe("cap");
  });
});

describe("a founder's answer is a fact from the founder", () => {
  const stored = {
    pages: [{ url: PRICING.url, hash: "h", reading: { ...EMPTY, audience: ["Small businesses"] } }],
    readAt: AT.toISOString(),
    demoPhrases: [],
  };

  it("leads its list, marked as theirs, ahead of what a page said", () => {
    const base = knowledgeBase({ stored, answers: { buyers: "Founders with no marketing team", byline: "Ada · Founder" } });
    expect(base.audience).toEqual([
      { text: "Founders with no marketing team", source: { kind: "founder" } },
      { text: "Small businesses", source: { kind: "page", url: PRICING.url } },
    ]);
    expect(base.byline).toBe("Ada · Founder");
  });

  it("reaches the writer's profile, and the whole block stays inside its cap", () => {
    const long = "A sentence about what the business does for the people it serves, in full. ";
    const many = Array.from({ length: KNOWLEDGE_BASE.PAGE_ITEMS }, (_, i) => `${long}${i} ${long}`);
    const base = knowledgeBase({
      stored: {
        pages: Array.from({ length: 6 }, (_, p) => ({
          url: `https://example.com/p${p}`,
          hash: "h",
          reading: {
            ...EMPTY,
            problems: many.map((text) => `${p} ${text}`),
            questions: many.map((text) => `${p} ${text}`),
            proof: many.map((text) => `${p} ${text}`),
          },
        })),
        readAt: AT.toISOString(),
        demoPhrases: [],
      },
      answers: { result: "A bakery went from 0 to 40 orders a week" },
    });

    const profile = promptProfile(null, base);
    const carried = JSON.stringify(profile?.knowledge);

    expect(profile?.knowledge?.proof[0]).toEqual({ text: "A bakery went from 0 to 40 orders a week", from: "founder" });
    expect(carried.length).toBeGreaterThan(1200);
    const text = [
      ...(profile?.knowledge?.problems ?? []),
      ...(profile?.knowledge?.questions ?? []),
      ...(profile?.knowledge?.proof ?? []),
    ].reduce((total, item) => total + item.text.length + item.from.length, 0);
    expect(text).toBeLessThanOrEqual(PROFILE_PROMPT_CAPS.blockChars);
  });

  it("a site with nothing read and nothing said has no profile at all", () => {
    expect(promptProfile(null, knowledgeBase({ stored: NO_KNOWLEDGE, answers: {} }))).toBeNull();
  });

  it("an emptied answer is no answer, and a sixth question is not stored", () => {
    expect(founderAnswers({ buyers: "  ", edge: " We answer the phone. ", other: "x" })).toEqual({
      edge: "We answer the phone.",
    });
  });
});

// SPEC §5 (owner D65 of 2026-10-07, issue 1303): the two rules hold for any
// business, in the languages its pages are written in.
describe("D65 — a heading is not a buyer's question, and \"businesses\" is not an audience", () => {
  it("keeps a question a buyer asks and drops a heading, a label and a heading the model gave a question mark", () => {
    const page = "Why you should care\nHow much does a boiler service cost?\nWhat to do next\nWas kostet eine Zahnreinigung?";
    expect(isBuyerQuestion("How much does a boiler service cost?", page)).toBe(true);
    expect(isBuyerQuestion("Was kostet eine Zahnreinigung?", page)).toBe(true);
    expect(isBuyerQuestion("Why you should care", page)).toBe(false);
    expect(isBuyerQuestion("What to do next?", page)).toBe(false);
    expect(isBuyerQuestion("Why us?")).toBe(false);
  });

  it("keeps an audience that names a kind of customer and drops a word for anybody", () => {
    for (const anybody of ["Businesses", "Companies of all sizes", "Customers and users", "Unternehmen", "Kunden jeder Größe"]) {
      expect(isSpecificAudience(anybody), anybody).toBe(false);
    }
    for (const somebody of ["Small businesses", "Dental practices", "UK law firms", "Shopify stores", "Handwerksbetriebe", "Homeowners"]) {
      expect(isSpecificAudience(somebody), somebody).toBe(true);
    }
  });

  it("cleans a page stored before the rule, and never judges the founder's own answer", () => {
    const stored = {
      pages: [{ url: PRICING.url, hash: "h", reading: { ...EMPTY, audience: ["Businesses", "Independent plumbers"], questions: ["What to do next", "Do you charge a call-out fee?"] } }],
      readAt: AT.toISOString(),
      demoPhrases: [],
    };
    const base = knowledgeBase({ stored, answers: { buyers: "Companies", asked: "Whether we work weekends" } });
    expect(base.audience.map((item) => item.text)).toEqual(["Companies", "Independent plumbers"]);
    expect(base.questions.map((item) => item.text)).toEqual(["Whether we work weekends", "Do you charge a call-out fee?"]);
  });
});
