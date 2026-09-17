// tests/site-profile/your-voice.test.tsx — issue 839, SPEC.md §5
// (2026-09-17): a site that reads gets a voice, and setup never shows a
// blank voice section.
//
// The wiring is the real one end to end except the vendor: the profile
// build, `deriveVoice`, `llm()` and the setup screen all run as shipped;
// the crawl, the profile store and `@anthropic-ai/sdk` are doubled. The
// SDK double answers the way the vendor does when `max_tokens` is shorter
// than the answer — the forced tool comes back cut off — which is how a
// site that read fine stored `voice: null` in the owner's walk.
//
// Node, not jsdom: under jsdom `env.ts` reads the run as a client bundle
// and refuses the model key, so the screen's markup is parsed with
// `JSDOM` directly instead.
import React from "react";
import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";
import { toolUseMessage } from "../llm/fixtures";

applyEnvFixture();

const { createMock, crawlMock, writeMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  crawlMock: vi.fn(),
  writeMock: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), redirect: vi.fn() }));
vi.mock("../../src/lib/site-profile/crawl", () => ({ crawlSite: crawlMock }));
vi.mock("../../src/lib/site-profile/store", () => ({
  writeSiteProfile: writeMock,
  readSiteProfile: vi.fn(),
  adoptVoiceText: vi.fn(),
  saveVoiceText: vi.fn(),
}));

const { buildSiteProfile } = await import("../../src/lib/site-profile");
const { VOICE_LIST_MAX } = await import("../../src/lib/site-profile/summary");
const { SetupForm } = await import("@/app/(account)/setup/SetupForm");
const { assembleSetup } = await import("@/app/(account)/setup/_setup/facts");
const { FIXTURE_SETUP_FACTS } = await import("@/app/(account)/setup/_setup/fixture");
const { copy } = await import("@/lib/presentation/copy");

const DOMAIN = "example.com";

/** A whole answer with every list the schema allows filled, in strings of
 *  the length real pages give — the answer the output pin has to hold. */
function fullAnswer() {
  const phrase = (words: number, n: number) =>
    Array.from({ length: words }, (_, i) => `word${(i + n) % 10}`).join(" ");
  const list = (count: number, words: number) => Array.from({ length: count }, (_, n) => phrase(words, n));
  return {
    siteName: "Example Projects",
    products: list(VOICE_LIST_MAX.products, 4),
    claims: list(VOICE_LIST_MAX.claims, 12),
    voice: {
      text: phrase(90, 0),
      tone: phrase(4, 1),
      person: phrase(3, 2),
      vocabulary: list(VOICE_LIST_MAX.vocabulary, 2),
      claimsToKeep: list(VOICE_LIST_MAX.claimsToKeep, 10),
      claimsToAvoid: list(VOICE_LIST_MAX.claimsToAvoid, 10),
    },
  };
}

/** The vendor, honouring `max_tokens`: an answer longer than the request
 *  allows (at a conservative three characters a token) comes back with the
 *  tool's input cut off, as `stop_reason: "max_tokens"`. */
function vendorAnswering(answer: unknown) {
  return (request: { max_tokens: number }) => {
    const tokens = Math.ceil(JSON.stringify(answer).length / 3);
    if (tokens > request.max_tokens) {
      return Promise.resolve({
        ...toolUseMessage({ siteName: "Example Projects" }, 1200, request.max_tokens, "site_profile"),
        stop_reason: "max_tokens",
      });
    }
    return Promise.resolve(toolUseMessage(answer, 1200, tokens, "site_profile"));
  };
}

function cost() {
  return {
    cap: "DEEP",
    async recordFetch(call: { costCents: number; run: () => Promise<unknown>; settleCents?: (p: unknown) => number }) {
      const payload = await call.run();
      return { payload, fresh: true, costCents: call.settleCents ? call.settleCents(payload) : call.costCents };
    },
    capHit: () => false,
    spentCents: () => 0,
    degraded: () => false,
  } as never;
}

const PASS = {
  domain: DOMAIN,
  homeUrl: `https://${DOMAIN}/`,
  homeHtml: "<html><head><title>Example Projects</title></head></html>",
  sitemaps: [],
};

function screenWith(profile: unknown): Element {
  const html = renderToStaticMarkup(
    <SetupForm model={assembleSetup({ ...FIXTURE_SETUP_FACTS, profile: profile as never })} />
  );
  return new JSDOM(html).window.document.body;
}

beforeEach(() => {
  createMock.mockReset();
  crawlMock.mockReset();
  writeMock.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  crawlMock.mockResolvedValue({
    pages: ["/", "/pricing", "/about"].map((path) => ({
      url: `https://${DOMAIN}${path}`,
      title: "Example Projects",
      h1: path,
      text: "Plain words about projects for agencies.",
    })),
    discovered: 3,
    stoppedBy: "complete" as const,
  });
});

describe("issue 839 — a site that reads gets a voice", () => {
  it("the paid pass's voice call has room for a whole answer, and the profile stores the voice it read", async () => {
    const answer = fullAnswer();
    createMock.mockImplementation(vendorAnswering(answer));

    const profile = await buildSiteProfile(cost(), { ...PASS, tier: "deep" });

    expect(profile?.voice).toEqual(answer.voice);
    expect(writeMock.mock.calls[0]?.[0]?.voice).toEqual(answer.voice);

    // And setup shows it under "Your voice", in the box the submit carries,
    // with no invitation to write one.
    const card = screenWith(profile).querySelector('[data-testid="setup-profile"]');
    expect(card?.querySelector("h2")?.textContent).toContain(copy("setup.profile.title"));
    expect(card?.querySelector('textarea[name="voice_text"]')?.textContent).toBe(answer.voice.text);
    expect(card?.querySelector('[data-testid="setup-profile-voice-unread"]')).toBeNull();
  });
});

describe("issue 839 — a profile with no voice is never a blank section", () => {
  it("the free scan's profile reads no voice, and setup shows an empty, editable box under the written line", async () => {
    const profile = await buildSiteProfile(cost(), { ...PASS, tier: "free" });
    expect(createMock).not.toHaveBeenCalled();
    expect(profile?.voice).toBeNull();

    const card = screenWith(profile).querySelector('[data-testid="setup-profile"]');
    expect(card).not.toBeNull();
    const box = card?.querySelector('textarea[name="voice_text"]');
    expect(box).not.toBeNull();
    expect(box?.textContent).toBe("");
    expect(box?.hasAttribute("readonly") || box?.hasAttribute("disabled")).toBe(false);
    const line = card?.querySelector('[data-testid="setup-profile-voice-unread"]');
    expect(line?.textContent).toBe(copy("setup.profile.voice.unread"));
    expect(line?.textContent).not.toContain("TODO(copy)");
  });

  it("a voice call that did not come back leaves the same invitation, with what was read still shown", async () => {
    createMock.mockRejectedValue(Object.assign(new Error("vendor said no"), { status: 529 }));

    const profile = await buildSiteProfile(cost(), { ...PASS, tier: "deep" });
    expect(profile?.voice).toBeNull();

    const card = screenWith(profile).querySelector('[data-testid="setup-profile"]');
    expect(card?.querySelector('[data-testid="setup-profile-voice-unread"]')).not.toBeNull();
    expect(card?.querySelector('[data-testid="setup-profile-pages"]')).not.toBeNull();
  });
});
