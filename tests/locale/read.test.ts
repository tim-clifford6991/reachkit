// SPEC §6, owner D66 (issue 1311): a site is measured in its own country and
// language, read from its country domain, `<html lang>`, currency, address
// and phone prefix; anything else falls back to the nearest supported
// country in English, and a `.com` that says nothing stays US English.
import { describe, expect, it } from "vitest";
import { readLocale, readLocaleSignals, resolveLocale, localeOf, SUPPORTED_LOCALES } from "@/lib/locale";

const page = (a: { lang?: string; body: string; head?: string }): string =>
  `<!doctype html><html${a.lang === undefined ? "" : ` lang="${a.lang}"`}><head><title>t</title>${a.head ?? ""}</head><body>${a.body}</body></html>`;

const GERMAN = "<p>Wir backen unser Brot jeden Tag frisch und mit Zeit für den Teig. Unsere Brötchen sind nicht nur für das Frühstück, sie sind auch für die Pause und für das Abendbrot. Die Bäckerei ist von Montag bis Samstag für Sie da, und wir freuen uns auf Sie.</p>";
const ENGLISH = "<p>We repair and rewire homes for the people of our city, and we have done so for thirty years. You can call our team for a quote, and we will be with you the same week. Our work is certified and our prices are fair for the work that you need.</p>";

describe("reading a site's country and language", () => {
  it("reads a German bakery on a .de address in Germany, in German", () => {
    expect(readLocale({ domain: "baeckerei-hinkel.de", html: page({ lang: "de", body: GERMAN }) })).toEqual({
      locale: { country: "DE", language: "de" },
      fellBack: null,
    });
  });

  it("reads the country from the address alone where the page was not read", () => {
    expect(readLocale({ domain: "fletcherelectric.co.uk", html: null }).locale).toEqual({ country: "GB", language: "en" });
    expect(readLocale({ domain: "example.com.au", html: null }).locale).toEqual({ country: "AU", language: "en" });
    expect(readLocale({ domain: "example.at", html: null }).locale).toEqual({ country: "AT", language: "de" });
  });

  it("keeps a .com with no other signal in the United States, in English, and calls that no fallback", () => {
    expect(readLocale({ domain: "savvycal.com", html: page({ lang: "en", body: ENGLISH }) })).toEqual({
      locale: { country: "US", language: "en" },
      fellBack: null,
    });
    expect(readLocale({ domain: "streaksapp.com", html: page({ body: "<p>Streaks</p>" }) }).fellBack).toBeNull();
  });

  it("does not take a generic two-letter ending for a country", () => {
    expect(readLocaleSignals({ domain: "linear.app", html: null }).country).toBeNull();
    expect(readLocaleSignals({ domain: "notion.so", html: null }).country).toBeNull();
    expect(readLocaleSignals({ domain: "crisp.io", html: null }).country).toBeNull();
  });

  it("reads a .com by its phone prefix, its address or its structured data", () => {
    const phone = page({ lang: "en", body: `${ENGLISH}<a href="tel:+441134960000">Call us</a>` });
    expect(readLocale({ domain: "leeds-sparks.com", html: phone }).locale.country).toBe("GB");

    const address = page({ lang: "en", body: `${ENGLISH}<address>12 Harbour Road<br>Cork<br>Ireland</address>` });
    expect(readLocale({ domain: "harbour-accounts.com", html: address }).locale.country).toBe("IE");

    const data = page({
      lang: "en",
      body: ENGLISH,
      head: '<script type="application/ld+json">{"@type":"LocalBusiness","address":{"addressCountry":"AU"}}</script>',
    });
    expect(readLocale({ domain: "smilestudio.com", html: data }).locale.country).toBe("AU");
  });

  it("does not move a business to a country it only ships to", () => {
    const ships = page({ lang: "en", body: `${ENGLISH}<p>We ship to Canada, Australia and the United Kingdom every week of the year.</p>` });
    expect(readLocale({ domain: "tattly.com", html: ships }).locale).toEqual({ country: "US", language: "en" });
  });

  it("reads a currency that belongs to one country where nothing stronger says", () => {
    const priced = page({ lang: "en", body: `${ENGLISH}<p>Call-outs from £45 and rewires from £1,900.</p>` });
    expect(readLocale({ domain: "sparkright.com", html: priced }).locale.country).toBe("GB");
  });

  it("reads the page's own words over a `lang` its builder left at English", () => {
    const left = page({ lang: "en-US", body: GERMAN });
    expect(readLocale({ domain: "baeckerei-beispiel.com", html: left }).locale).toEqual({ country: "DE", language: "de" });
  });

  it("falls back to the nearest supported country in English, and says what it fell back from", () => {
    const french = page({ lang: "fr", body: "<p>Boulangerie artisanale à Lyon.</p>" });
    expect(readLocale({ domain: "boulangerie-exemple.fr", html: french })).toEqual({
      locale: { country: "GB", language: "en" },
      fellBack: { country: "FR", language: "fr" },
    });
    expect(resolveLocale({ country: "MX", language: null })).toEqual({
      locale: { country: "US", language: "en" },
      fellBack: { country: "MX", language: null },
    });
    expect(resolveLocale({ country: "NZ", language: "en" })).toEqual({
      locale: { country: "AU", language: "en" },
      fellBack: { country: "NZ", language: null },
    });
    // German is measured; a German site outside the three countries is read in Germany.
    expect(resolveLocale({ country: "IT", language: "de" })).toEqual({
      locale: { country: "DE", language: "de" },
      fellBack: { country: "IT", language: null },
    });
    // A Swiss site in French: the country is measured in German only.
    expect(resolveLocale({ country: "CH", language: "fr" }).fellBack).toEqual({ country: "CH", language: "fr" });
  });

  it("holds every answer to the closed list", () => {
    expect(SUPPORTED_LOCALES.map((l) => `${l.country}/${l.language}`)).toEqual(["US/en", "GB/en", "IE/en", "AU/en", "CA/en", "DE/de", "AT/de", "CH/de"]);
    expect(localeOf("DE", "en")).toBeNull();
    expect(localeOf("FR", "fr")).toBeNull();
    expect(localeOf("CH", "de")).toEqual({ country: "CH", language: "de" });
  });
});

describe("issue 1480 — a site's country follows its domain and language before an office it mentions", () => {
  const offices = (countries: string[]): string =>
    `<script type="application/ld+json">{"@type":"Organization","location":[${countries
      .map((c) => `{"@type":"Place","address":{"@type":"PostalAddress","addressCountry":"${c}"}}`)
      .join(",")}]}</script>`;

  it("stripe.com: offices in many countries, Singapore first, say nothing; its own page says the United States", () => {
    const html = page({ lang: "en-US", head: offices(["SG", "US", "GB", "AU", "DE", "JP"]), body: `${ENGLISH}<footer><p>United States</p></footer>` });
    expect(readLocale({ domain: "stripe.com", html })).toEqual({ locale: { country: "US", language: "en" }, fellBack: null });
  });

  it("an English page whose one office is in a country written in another language is read by its language", () => {
    expect(readLocale({ domain: "monday.com", html: page({ lang: "en", head: offices(["IL"]), body: ENGLISH }) })).toEqual({ locale: { country: "US", language: "en" }, fellBack: null });
    expect(readLocale({ domain: "typeform.com", html: page({ lang: "en", head: offices(["ES"]), body: ENGLISH }) }).locale.country).toBe("US");
  });

  it("an office in the page's own language still names the country, in English and in German", () => {
    expect(readLocale({ domain: "smilestudio.com", html: page({ lang: "en", head: offices(["AU"]), body: ENGLISH }) }).locale.country).toBe("AU");
    expect(readLocale({ domain: "praxis-beispiel.com", html: page({ lang: "de", head: offices(["CH"]), body: GERMAN }) }).locale).toEqual({ country: "CH", language: "de" });
    expect(readLocale({ domain: "kiwi-plumbing.com", html: page({ lang: "en", head: offices(["NZ"]), body: ENGLISH }) }).fellBack).toEqual({ country: "NZ", language: null });
  });

  it("nifty.pm and the other endings sold as names name no country; a country's own ending names it", () => {
    for (const domain of ["nifty.pm", "linear.io", "perplexity.ai", "angel.co", "about.me", "twitch.tv", "example.gl", "example.md"]) {
      expect(readLocaleSignals({ domain, html: null }).country).toBeNull();
    }
    expect(readLocale({ domain: "nifty.pm", html: page({ lang: "en", body: ENGLISH }) }).locale).toEqual({ country: "US", language: "en" });
    expect(readLocaleSignals({ domain: "example.fr", html: null }).country).toBe("FR");
    expect(readLocaleSignals({ domain: "example.co.nz", html: null }).country).toBe("NZ");
    expect(readLocaleSignals({ domain: "example.uk", html: null }).country).toBe("GB");
    // Endings that are no ISO country's.
    expect(readLocaleSignals({ domain: "example.ac", html: null }).country).toBeNull();
    expect(readLocaleSignals({ domain: "example.su", html: null }).country).toBeNull();
  });
});
