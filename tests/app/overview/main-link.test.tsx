/** @vitest-environment jsdom */
// tests/app/overview/main-link.test.tsx — issue 1511, SPEC §7 (2026-10-18).
//
// Overview tells the customer, once and in plain words, whether their main
// site links their articles, with the link ready to copy. It is optional:
// never a needs-you item, gone once the scan finds the link, and not said at
// all for a WordPress destination or a host that is not live yet. The
// snippet's words are in the site's own language (D66).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import OverviewPage from "@/app/(account)/app/(tabs)/page";
import { MainSiteLink } from "@/app/(account)/app/_overview/MainSiteLink";
import { copy } from "@/lib/presentation/copy";
import { resetAccount, signedInAs } from "../account-door";

vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));

const stored = vi.hoisted(() => ({
  host: null as { hostname: string; state: "live" | "pending_dns" } | null,
  links: [] as { host: string; state: string }[],
  language: "en" as "en" | "de",
}));

vi.mock("@/lib/publish/destinations/hosted/hostname", () => ({ hostedHostFor: async () => stored.host }));
vi.mock("@/lib/site-profile/store", () => ({
  readMainSite: async () => ({ home: "https://example.com/", organization: { id: null, name: null, logo: null }, sameAs: [], links: stored.links }),
}));
vi.mock("@/lib/locale/site", () => ({ siteLocale: async () => ({ language: stored.language, country: "US" }) }));

const { mainSiteLinkFinding } = await import("@/lib/publish/destinations/hosted/main-link");

beforeEach(() => {
  signedInAs();
  stored.host = { hostname: "content.example.com", state: "live" };
  stored.links = [{ host: "content.example.com", state: "not_linked" }];
  stored.language = "en";
});
afterEach(() => resetAccount());

function dom(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("Overview states the main-site link as an optional finding", () => {
  it("draws the finding with the link to copy, and not as a needs-you item", async () => {
    const doc = dom(renderToStaticMarkup(await OverviewPage()));
    const card = doc.querySelector('[data-testid="overview-main-link"]');
    expect(card).not.toBeNull();
    expect(card?.querySelector("h2")?.textContent).toBe(copy("overview.main-link.title"));
    expect(card?.querySelector("code")?.textContent).toBe('<a href="https://content.example.com/">Articles</a>');
    expect(card?.textContent).toContain(copy("overview.main-link.optional"));
    expect(doc.querySelector('[data-testid="needs-you"]')?.textContent ?? "").not.toContain(copy("overview.main-link.title"));
  });

  it("a link search engines are asked not to follow is said as that", () => {
    const html = renderToStaticMarkup(
      <MainSiteLink finding={{ state: "not_followed", host: "content.example.com", snippet: '<a href="https://content.example.com/">Articles</a>' }} />
    );
    expect(html).toContain(copy("overview.main-link.not-followed", { host: "content.example.com" }).replace(/&/g, "&amp;"));
  });
});

describe("the finding is read from the stored scan, and said only while it is true", () => {
  it("not linked: the snippet points at the content host, in the site's language", async () => {
    expect(await mainSiteLinkFinding({ siteId: "s1", domain: "example.com" })).toEqual({
      state: "not_linked",
      host: "content.example.com",
      snippet: '<a href="https://content.example.com/">Articles</a>',
    });
    stored.language = "de";
    expect((await mainSiteLinkFinding({ siteId: "s1", domain: "example.com" }))?.snippet).toBe(
      '<a href="https://content.example.com/">Artikel</a>'
    );
  });

  it("is gone once the link is found, and never said for WordPress or a host not live yet", async () => {
    stored.links = [{ host: "content.example.com", state: "linked" }];
    expect(await mainSiteLinkFinding({ siteId: "s1", domain: "example.com" })).toBeNull();

    stored.links = [{ host: "content.example.com", state: "not_linked" }];
    stored.host = null;
    expect(await mainSiteLinkFinding({ siteId: "s1", domain: "example.com" })).toBeNull();

    stored.host = { hostname: "content.example.com", state: "pending_dns" };
    expect(await mainSiteLinkFinding({ siteId: "s1", domain: "example.com" })).toBeNull();
  });
});
