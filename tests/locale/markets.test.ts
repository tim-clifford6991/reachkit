// SPEC §6, D66: the market a site declares for the address it was asked for
// chooses the locale, and the other markets it declares are counted. The
// home documents are today's reads, trimmed of scripts and styles.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { marketsServed, readLocale } from "@/lib/locale/read";
import type { Locale } from "@/lib/locale/locales";

const home = (domain: string): string => readFileSync(path.join(__dirname, "fixtures/homes", `${domain}.html`), "utf8");
const ENGLISH = `<p>${"We run the buses and you get the best fares for your trip with our app and from our team. ".repeat(4)}</p>`;
const LOCAL = ["baeckerei-hinkel.de", "alexander.co.uk", "austinplumbery.com"];
const US: Locale = { country: "US", language: "en" };

describe("the market declared for the address asked for chooses the locale", () => {
  it("flixbus.de is Germany in German, whether its page is served in German or in English", () => {
    expect(readLocale({ domain: "flixbus.de", html: home("flixbus.de") })).toEqual({ locale: { country: "DE", language: "de" }, fellBack: null });
    const english = home("flixbus.de").replace('lang="de"', 'lang="en"').replace(/<body[\s\S]*<\/body>/, `<body>${ENGLISH}</body>`);
    expect(readLocale({ domain: "flixbus.de", html: english })).toEqual({ locale: { country: "DE", language: "de" }, fellBack: null });
  });

  it("stripe.com's Finnish variant, read as stripe.com, is the United States in English", () => {
    expect(readLocale({ domain: "stripe.com", html: home("stripe.com") })).toEqual({ locale: { country: "US", language: "en" }, fellBack: null });
  });

  it("zalando.de is Germany in German", () => {
    expect(readLocale({ domain: "zalando.de", html: home("zalando.de") })).toEqual({ locale: { country: "DE", language: "de" }, fellBack: null });
  });

  it("a local site that declares no alternates reads as it did", () => {
    expect(LOCAL.map((domain) => readLocale({ domain, html: home(domain) }).locale)).toEqual([
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
    expect(served("flixbus.de", home("flixbus.de"), { country: "DE", language: "de" })).toBe(48);
    expect(marketsServed({ domain: "flixbus.de", html: home("flixbus.de"), measured: { country: "DE", language: "de" } })).toContain("en");
    expect(served("zalando.de", home("zalando.de"), { country: "DE", language: "de" })).toBe(2);
  });

  it("reads a language switcher of two or more locale paths, never one word-code path", () => {
    expect(served("brand.com", links("/de/", "/fr/preise", "/en/"), US)).toBe(2);
    expect(served("brand.com", links("/it/"), US)).toBe(0);
    expect(served("brand.com", links("/it/", "/go/"), US)).toBe(0);
  });

  it("reads the same name under other country endings", () => {
    expect(served("brand.com", links("https://brand.fr/", "https://www.brand.co.uk/", "https://brand.io/"), US)).toBe(2);
  });

  it("a local site serves no other market", () => {
    expect(LOCAL.map((domain) => served(domain, home(domain), readLocale({ domain, html: home(domain) }).locale))).toEqual([0, 0, 0]);
  });
});
