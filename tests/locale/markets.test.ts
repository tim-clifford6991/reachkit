// SPEC §6, D66: the market a site declares for the address it was asked for
// chooses the locale, and the other markets it declares are counted. The
// home documents are synthetic pages, each holding what its case needs.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { marketsServed, readLocale } from "@/lib/locale/read";
import type { Locale } from "@/lib/locale/locales";

const home = (name: string): string => readFileSync(path.join(__dirname, "fixtures/homes", `${name}.html`), "utf8");
const ENGLISH = `<p>${"We run the buses and you get the best fares for your trip with our app and from our team. ".repeat(4)}</p>`;
const LOCAL = [
  { domain: "example.de", page: "local-de" },
  { domain: "example.co.uk", page: "local-gb" },
  { domain: "example.com", page: "local-us" },
];
const US: Locale = { country: "US", language: "en" };

describe("the market declared for the address asked for chooses the locale", () => {
  it("a .de site is Germany in German, whether its page is served in German or in English", () => {
    expect(readLocale({ domain: "example.de", html: home("de-48-alternates") })).toEqual({ locale: { country: "DE", language: "de" }, fellBack: null });
    const english = home("de-48-alternates").replace('lang="de"', 'lang="en"').replace(/<body[\s\S]*<\/body>/, `<body>${ENGLISH}</body>`);
    expect(readLocale({ domain: "example.de", html: english })).toEqual({ locale: { country: "DE", language: "de" }, fellBack: null });
  });

  it("a .com site's Finnish variant, read as the .com, is the United States in English", () => {
    expect(readLocale({ domain: "example.com", html: home("en-fi-variant") })).toEqual({ locale: { country: "US", language: "en" }, fellBack: null });
  });

  it("a .de site with two alternates is Germany in German", () => {
    expect(readLocale({ domain: "example.de", html: home("de-2-alternates") })).toEqual({ locale: { country: "DE", language: "de" }, fellBack: null });
  });

  it("a local site that declares no alternates reads as it did", () => {
    expect(LOCAL.map(({ domain, page }) => readLocale({ domain, html: home(page) }).locale)).toEqual([
      { country: "DE", language: "de" },
      { country: "GB", language: "en" },
      { country: "US", language: "en" },
    ]);
  });
});

describe("the other markets a home page says its site serves", () => {
  const served = (domain: string, html: string, measured: Locale): number => marketsServed({ domain, html, measured }).length;
  const links = (...hrefs: string[]): string => `<html lang="en"><body>${hrefs.map((href) => `<a href="${href}">x</a>`).join("")}</body></html>`;

  it("counts every hreflang value but x-default and the measured one", () => {
    expect(served("example.de", home("de-48-alternates"), { country: "DE", language: "de" })).toBe(48);
    expect(marketsServed({ domain: "example.de", html: home("de-48-alternates"), measured: { country: "DE", language: "de" } })).toContain("en");
    expect(served("example.de", home("de-2-alternates"), { country: "DE", language: "de" })).toBe(2);
  });

  it("reads a language switcher of two or more locale paths, never one word-code path", () => {
    expect(served("example.com", links("/de/", "/fr/preise", "/en/"), US)).toBe(2);
    expect(served("example.com", links("/it/"), US)).toBe(0);
    expect(served("example.com", links("/it/", "/go/"), US)).toBe(0);
  });

  it("reads the same name under other country endings", () => {
    expect(served("example.com", links("https://example.fr/", "https://www.example.co.uk/", "https://example.io/"), US)).toBe(2);
  });

  it("a local site serves no other market", () => {
    expect(LOCAL.map(({ domain, page }) => served(domain, home(page), readLocale({ domain, html: home(page) }).locale))).toEqual([0, 0, 0]);
  });
});
