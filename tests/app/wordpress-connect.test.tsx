// SPEC §5 at launch (owner, 2026-11-06): a buyer connects by DNS only, and the one constant `WORDPRESS_CONNECT`
// brings WordPress back. Each surface is rendered as shipped, then again with the constant flipped on.
// Stored panel reports are the evidence; nothing is measured: 0¢.
import "../generate/env";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "node-html-parser";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), redirect: vi.fn() }));
vi.mock("@/app/(public)/_how/examples", () => ({
  readLiveExamples: async () => ({ report: null, page: null, founder: null }),
}));
vi.mock("@/lib/publish/destinations/hosted/store", () => ({
  hostedSiteForDomain: async () => null,
  hostedHostOfSite: async () => "content.reachkit.app",
  livePagesForSite: async () => [],
}));
vi.mock("@/lib/scan/gallery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/gallery")>()),
  isListed: async () => false,
  listedScore: async () => null,
  readGallery: async () => ({ entries: [], total: 0, categories: [], all: 0 }),
}));

const WORDPRESS = /wordpress/i;
const textOf = (html: string): string => parse(html).textContent.replace(/\s+/g, " ");

/** Setup's Connect step as a new buyer meets it: the destinations offered and the words on screen. */
async function connectStep(): Promise<{ kinds: string[]; text: string }> {
  const { SetupForm } = await import("@/app/(account)/setup/SetupForm");
  const { assembleSetup } = await import("@/app/(account)/setup/_setup/facts");
  const { FIXTURE_SETUP_FACTS } = await import("@/app/(account)/setup/_setup/fixture");
  const html = renderToStaticMarkup(
    <NuqsTestingAdapter searchParams={{ step: "publishing" }}>
      <SetupForm model={assembleSetup(FIXTURE_SETUP_FACTS)} />
    </NuqsTestingAdapter>,
  );
  const kinds = parse(html)
    .querySelectorAll('[data-testid^="setup-destination-"]')
    .map((el) => el.getAttribute("data-testid")!.slice("setup-destination-".length))
    .filter((kind) => kind !== "label");
  return { kinds, text: textOf(html) };
}

/** The library close that compares a free meta-tag tool with ReachKit. */
async function libraryClose(): Promise<string> {
  const { LearnClose } = await import("@/app/(public)/_library/parts");
  return textOf(renderToStaticMarkup(<LearnClose variant="tool-meta" />));
}

/** Who fixes a page title, as the report's check card and the Monday mail's row say it. */
async function titleDoer(): Promise<string> {
  const { SITE_CHECK_DOER } = await import("@/lib/presentation/site-issues");
  const { copy } = await import("@/lib/presentation/copy");
  return copy(SITE_CHECK_DOER.reachkit_rewrites);
}

describe("WORDPRESS_CONNECT off, as shipped: DNS is the only connect path", () => {
  it("a new buyer in Setup sees only the CNAME path, and no WordPress word", async () => {
    const step = await connectStep();
    expect(step.kinds).toEqual(["hosted"]);
    expect(step.text).not.toMatch(WORDPRESS);
  });

  it("Settings › Pages, the calendar's way through and the shortcuts offer a hosted site no WordPress", async () => {
    const { PublishingPanel } = await import("@/app/(account)/app/settings/panels/PublishingPanel");
    const { FIXTURE_SETTINGS_FACTS } = await import("@/app/(account)/app/settings/fixture");
    const { assembleSettings } = await import("@/app/(account)/app/settings/model");
    const { destinationView } = await import("@/lib/publish/destinations/view");
    const { Shortcuts } = await import("@/app/(account)/app/_shell/Shortcuts");
    const { wayAsVisitor } = await import("@/app/(account)/app/calendar/ways");
    const { copy } = await import("@/lib/presentation/copy");
    const hosted = (over: { health: "ok" | "expired"; hostnameState: "live" | "pending_dns" }) =>
      destinationView({ id: "dest-1", kind: "hosted", reason: null, lastCheckedAt: new Date(0), heldPages: 0, hostname: "content.example.com", ...over });
    for (const destination of [hosted({ health: "ok", hostnameState: "live" }), hosted({ health: "ok", hostnameState: "pending_dns" })]) {
      const settings = assembleSettings({ ...FIXTURE_SETTINGS_FACTS, destinations: [destination] });
      expect(textOf(renderToStaticMarkup(<PublishingPanel settings={settings} />))).not.toMatch(WORDPRESS);
    }
    for (const blog of ["https://content.example.com", null]) expect(textOf(renderToStaticMarkup(<Shortcuts blog={blog} />))).not.toMatch(WORDPRESS);
    const address = { offered: true, label: "record.address.publiclyReadableAt", url: "https://content.example.com/a" };
    for (const state of ["published", "unpublished"]) {
      const way = wayAsVisitor({ state, address, verification: { kind: "not_yet" } } as never);
      expect(way === null || way.offered ? "" : copy(way.copy)).not.toMatch(WORDPRESS);
    }
  });

  it("the landing, How it works, pricing and the library say nothing of WordPress", async () => {
    const { settledMarkup } = await import("./shell/settled");
    const { default: LandingPage } = await import("@/app/(public)/page");
    const { default: HowItWorksPage } = await import("@/app/(public)/how-it-works/page");
    const { default: PricingPage } = await import("@/app/(public)/pricing/page");
    const pages = [
      await settledMarkup(<LandingPage searchParams={{}} />),
      renderToStaticMarkup(<HowItWorksPage />),
      renderToStaticMarkup(<PricingPage />),
    ];
    for (const page of pages) expect(textOf(page)).not.toMatch(WORDPRESS);
    expect(await libraryClose()).not.toMatch(WORDPRESS);
  });

  it("the free report of a SaaS and a local business, and the Monday mail's issue rows, say nothing of WordPress", async () => {
    const { panelReport, renderReport } = await import("./scan-address/panel-report");
    for (const which of ["saas", "local"] as const) expect(textOf(renderReport(panelReport(which)))).not.toMatch(WORDPRESS);
    const { issueRows } = await import("@/lib/mail/blocks/site-issues");
    const rows = issueRows({
      issues: [{ check: "page_titles", ran: true, count: 3, over: 12, unit: "pages", severity: "worth_fixing", doer: "reachkit_rewrites", pages: [] }],
    } as never);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toMatch(WORDPRESS);
    expect(await titleDoer()).not.toMatch(WORDPRESS);
  });
});

describe("WORDPRESS_CONNECT flipped on: the same constant brings WordPress back", () => {
  beforeAll(() => {
    vi.resetModules();
    vi.doMock("@/lib/config/constants", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/config/constants")>()),
      WORDPRESS_CONNECT: true,
    }));
  });
  afterAll(() => {
    vi.doUnmock("@/lib/config/constants");
    vi.resetModules();
  });

  it("Setup offers the WordPress destination beside the hosted one", async () => {
    const step = await connectStep();
    expect(step.kinds).toEqual(["hosted", "wordpress"]);
    expect(step.text).toMatch(WORDPRESS);
  });

  it("How it works, the library and the title fix name WordPress again", async () => {
    const { default: HowItWorksPage } = await import("@/app/(public)/how-it-works/page");
    expect(textOf(renderToStaticMarkup(<HowItWorksPage />))).toMatch(WORDPRESS);
    expect(await libraryClose()).toMatch(WORDPRESS);
    expect(await titleDoer()).toMatch(WORDPRESS);
  });
});
