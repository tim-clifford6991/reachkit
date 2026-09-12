// tests/site-profile/summary.test.ts — issue #577, SPEC.md §2: the scan
// stores "the site name, its products and claims, and a brand-voice
// summary (tone, person, vocabulary, claims to keep, claims to avoid)",
// bounded — "inside the existing egress caps and the 12¢ ceiling".
//
// Two things a customer is owed here: the voice they are shown was read
// off their own pages, and reading it cannot spend the scan's budget on a
// prompt the size of their website.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

const { SITE_PROFILE } = await import("../../src/lib/config/constants");
const { boundPages, deriveVoice, SITE_READING_SCHEMA } = await import("../../src/lib/site-profile/summary");

const AT = new Date("2026-09-12T09:00:00.000Z");

function page(n: number, chars: number) {
  return {
    url: `https://example.com/page-${n}`,
    title: `Page ${n}`,
    h1: `Page ${n}`,
    text: "word ".repeat(Math.ceil(chars / 5)).slice(0, chars),
  };
}

function fakeCost() {
  return {} as never;
}

beforeEach(() => {
  llmMock.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("the prompt is bounded however large the site is", () => {
  it("sends at most the pinned characters of page text, whatever the crawl read", () => {
    const pages = Array.from({ length: SITE_PROFILE.MAX_PAGES }, (_, i) =>
      page(i, SITE_PROFILE.PAGE_SAMPLE_CHARS)
    );

    const sent = boundPages(pages, SITE_PROFILE.VOICE_INPUT_MAX_CHARS);
    const spent = sent.reduce((total, p) => total + JSON.stringify(p.text).length - 2, 0);

    expect(spent).toBeLessThanOrEqual(SITE_PROFILE.VOICE_INPUT_MAX_CHARS);
    // A hundred pages do not all fit, and the ones that do are whole pages
    // in the order they were read — never a sample of every page.
    expect(sent.length).toBeLessThan(pages.length);
    expect(sent[0]?.url).toBe(pages[0]?.url);
  });

  it("a small site is sent whole — nothing is cut that fits", () => {
    const pages = [page(1, 100), page(2, 100)];
    const sent = boundPages(pages, SITE_PROFILE.VOICE_INPUT_MAX_CHARS);
    expect(sent).toHaveLength(2);
    expect(sent[1]?.text).toBe(pages[1]?.text);
  });

  it("the one call it issues carries the pages and the fixed instruction, and nothing else of the customer's", async () => {
    llmMock.mockResolvedValueOnce({ kind: "unmeasured", reason: "undeterminable", at: AT });

    await deriveVoice(fakeCost(), { domain: "example.com", pages: [page(1, 200)], tier: "free" });

    expect(llmMock).toHaveBeenCalledTimes(1);
    const call = llmMock.mock.calls[0]![1] as { site: string; input: Record<string, unknown> };
    expect(call.site).toBe("site-profile");
    expect(Object.keys(call.input).sort()).toEqual(["domain", "fields", "pages", "task"]);
  });
});

describe("a reading that did not come back is not invented", () => {
  it("hands back the unmeasured result untouched — no default voice, no name from the domain", async () => {
    llmMock.mockResolvedValueOnce({ kind: "unmeasured", reason: "undeterminable", at: AT });

    const result = await deriveVoice(fakeCost(), { domain: "example.com", pages: [page(1, 200)], tier: "free" });

    expect(result).toEqual({ kind: "unmeasured", reason: "undeterminable", at: AT });
  });

  it("accepts the five voice members and refuses an answer carrying a sixth", () => {
    const voice = {
      text: "Plain and direct.",
      tone: "plain",
      person: "second",
      vocabulary: ["payouts"],
      claimsToKeep: ["SEPA-native since 2019"],
      claimsToAvoid: ["the leading"],
    };
    expect(SITE_READING_SCHEMA.safeParse({ siteName: "Example", products: [], claims: [], voice }).success).toBe(true);
    expect(
      SITE_READING_SCHEMA.safeParse({
        siteName: "Example",
        products: [],
        claims: [],
        voice: { ...voice, persona: "a friendly robot" },
      }).success
    ).toBe(false);
  });
});
