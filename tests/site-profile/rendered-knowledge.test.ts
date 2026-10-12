// tests/site-profile/rendered-knowledge.test.ts — SPEC §6 (issue 1374).
//
// What the customer is owed: a site drawn by JavaScript has a knowledge
// base read from its pages as a browser draws them, and a site that serves
// its text is read as before and buys nothing.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();

const { textMock, renderMock, robotsMock, readMock, writeMock, profileMock } = vi.hoisted(() => ({
  profileMock: vi.fn(),
  textMock: vi.fn(),
  renderMock: vi.fn(),
  robotsMock: vi.fn(),
  readMock: vi.fn(),
  writeMock: vi.fn(),
}));

vi.mock("@/lib/measure/text", () => ({ readMeasuredText: textMock }));
vi.mock("@/lib/vendors/dataforseo", () => ({ renderedPage: renderMock }));
vi.mock("@/lib/egress/robots", async (original) => ({ ...(await original<object>()), readRobots: robotsMock }));
vi.mock("@/lib/locale/site", () => ({ siteLocale: async () => ({ country: "DE", language: "de" }) }));
vi.mock("../../src/lib/site-profile/store", () => ({ readSiteProfile: profileMock }));
vi.mock("../../src/lib/site-profile/knowledge/store", () => ({ readStoredKnowledge: async () => null, writeStoredKnowledge: writeMock }));
vi.mock("../../src/lib/site-profile/knowledge/extract", () => ({ readKnowledge: readMock }));

const { buildKnowledge } = await import("../../src/lib/site-profile/knowledge/build");
const { parseRobotsTxt } = await import("../../src/lib/egress/robots");

const AT = new Date("2026-10-10T09:00:00.000Z");
const DOMAIN = "example.com";
const HOME = `https://${DOMAIN}/`;
const SAID = "We bake 210 kinds of bread, rolls and pastry by hand every day in the old town. ".repeat(4);

/** What the vendor's browser ends with, by address. */
const DRAWN: Record<string, string> = {
  [HOME]: `<body><main><p>${SAID}</p><a href="/news">News</a><a href="/#contact">Contact</a><a href="/impressum">Impressum</a><a href="/private/menu">Menu</a><a href="https://shop.example.org/">Shop</a></main></body>`,
  [`https://${DOMAIN}/news`]: `<body><main><h2>What does a loaf cost?</h2><p>${SAID}</p></main></body>`,
};

const cost = { capHit: () => false } as never;
const asked = (): string[] => renderMock.mock.calls.map((call) => (call[1] as { url: string }).url);
const readPages = (): { url: string; text: string }[] => (readMock.mock.calls[0]?.[1] as { pages: { url: string; text: string }[] }).pages;

beforeEach(() => {
  for (const mock of [textMock, renderMock, robotsMock, readMock, writeMock, profileMock]) mock.mockReset();
  profileMock.mockResolvedValue({ inventory: [] });
  vi.spyOn(console, "log").mockImplementation(() => {});
  readMock.mockResolvedValue({ knowledge: { pages: [{}] }, asked: 1, stoppedBy: "complete" });
  robotsMock.mockResolvedValue({ ok: true, origin: `https://${DOMAIN}`, readAt: AT, ...parseRobotsTxt("User-agent: *\nDisallow: /private/") });
  renderMock.mockImplementation(async (_c: unknown, a: { url: string }) => {
    const html = DRAWN[a.url];
    return html === undefined
      ? { kind: "zero", value: [], at: AT }
      : { kind: "measured", value: [{ url: a.url, status: 200, html, bytes: html.length, readAt: AT.toISOString() }], at: AT };
  });
});

describe("a site that serves an empty JavaScript shell", () => {
  it("is read as a browser draws it: the home page, then the pages it links to", async () => {
    textMock.mockResolvedValue([{ url: HOME, text: "", measuredAt: AT }]);
    await buildKnowledge(cost, { siteId: "site-1", domain: DOMAIN });

    // Not the legal page, not the path robots.txt closes, not another site,
    // and the home page once though `/#contact` links to it.
    expect(asked()).toEqual([HOME, `https://${DOMAIN}/news`]);
    expect(readPages().map((page) => page.url)).toEqual([HOME, `https://${DOMAIN}/news`]);
    expect(readPages()[0]?.text).toContain("210 kinds of bread");
    expect(readPages()[1]).toMatchObject({ questions: ["What does a loaf cost?"] });
  });

  it("keeps what it had where no page could be drawn", async () => {
    textMock.mockResolvedValue([{ url: HOME, text: "", measuredAt: AT }]);
    renderMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
    await buildKnowledge(cost, { siteId: "site-1", domain: DOMAIN });
    expect(readPages()).toEqual([{ url: HOME, text: "" }]);
  });

  it("is asked of the pages as served on every pass, not of an earlier pass's rendered read", async () => {
    textMock.mockResolvedValue([
      { url: HOME, text: "", measuredAt: AT },
      { url: HOME, text: SAID, measuredAt: AT, rendered: true },
    ]);
    await buildKnowledge(cost, { siteId: "site-1", domain: DOMAIN });
    expect(asked()[0]).toBe(HOME);
  });
});

describe("a site that serves its text", () => {
  it("is read as served, and no rendered read is bought", async () => {
    textMock.mockResolvedValue([
      { url: HOME, text: SAID, measuredAt: AT },
      { url: `https://${DOMAIN}/login`, text: "", measuredAt: AT },
    ]);
    await buildKnowledge(cost, { siteId: "site-1", domain: DOMAIN });
    expect(renderMock).not.toHaveBeenCalled();
    expect(readPages().map((page) => page.url)).toEqual([HOME, `https://${DOMAIN}/login`]);
  });
});

describe("a pass that stored no site profile (issue 1414, wesbos.com)", () => {
  it("buys no read of a base it has no row to keep in, and says so", async () => {
    profileMock.mockResolvedValue(null);
    textMock.mockResolvedValue([{ url: HOME, text: SAID, measuredAt: AT }]);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const read = await buildKnowledge(cost, { siteId: "site-1", domain: DOMAIN });

    expect(readMock).not.toHaveBeenCalled();
    expect(writeMock).not.toHaveBeenCalled();
    expect(read).toMatchObject({ asked: 0, knowledge: { pages: [] } });
    expect(log.mock.calls.map((call) => JSON.parse(String(call[0])) as { event: string; held: number })).toContainEqual(
      expect.objectContaining({ event: "site_knowledge_failed", held: 1 })
    );
  });
});
