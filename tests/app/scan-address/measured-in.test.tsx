// SPEC §6, D66: the report's measured-in line never calls a country or a
// language on the list unmeasured, and the landing names the same list.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { ReportView } from "@/app/(public)/scan/[domain]/_address/report-view";
import { FIXTURE_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";
import LandingPage from "@/app/(public)/page";
import { AlsoServesNote, WhatWeRead } from "@/app/_business/WhatWeRead";
import { understandBusiness } from "@/lib/business/understanding";
import { copy } from "@/lib/presentation/copy";
import { COUNTRIES, LANGUAGES, countriesMeasuredIn, resolveLocale, type LocaleReading } from "@/lib/locale/locales";
import type { ReportLocale } from "@/lib/scan/report";

function reportHtml(locale: ReportLocale): string {
  return renderToStaticMarkup(
    React.createElement(ReportView, {
      state: { report: { ...FIXTURE_REPORT, locale }, notice: null, control: { kind: "none" }, correction: { offered: true, as: "first" } },
    })
  );
}

function lineOf(html: string, testId: string): string | null {
  const line = new RegExp(`data-testid="${testId}">([^<]*)<`).exec(html);
  return line === null ? null : (line[1] ?? "").replace(/&#x27;/g, "'");
}

const measuredIn = (locale: ReportLocale): string | null => lineOf(reportHtml(locale), "report-measured-in");

const SUPPORTED = [...Object.values(COUNTRIES).map((row) => row.location), ...Object.values(LANGUAGES).map((row) => row.name)];
const READINGS: LocaleReading[] = [
  ...Object.keys(COUNTRIES).flatMap((country) => ["en", "de", "fr", null].map((language) => ({ country, language }))),
  { country: "FR", language: "en" },
  { country: "FR", language: "fr" },
  { country: null, language: null },
];

describe("the measured-in line never calls a supported country or language unmeasured", () => {
  it.each(READINGS)("a site read as %o", (reading) => {
    const { locale, fellBack } = resolveLocale(reading);
    const line = measuredIn(fellBack === null ? locale : { ...locale, fellBack });
    for (const name of SUPPORTED) expect(line ?? "").not.toContain(`does not measure ${name} yet`);
  });

  it("a stored report of a supported country read in another language names the pair and suggests a rescan", () => {
    expect(measuredIn({ country: "GB", language: "en", fellBack: { country: "DE", language: null } })).toBe(
      "Measured as searched in United Kingdom, in English, because your site read as English. ReachKit measures Germany in German: scan again to see it."
    );
    for (const country of Object.keys(COUNTRIES)) {
      expect(measuredIn({ country: "GB", language: "en", fellBack: { country, language: "fr" } })).toContain(
        `because your site read as French. ReachKit measures ${COUNTRIES[country as keyof typeof COUNTRIES].location} in`
      );
    }
  });

  it("a German site read as English is measured in Germany, in German, and the line says only that", () => {
    const { locale, fellBack } = resolveLocale({ country: "DE", language: "en" });
    expect(measuredIn({ ...locale, ...(fellBack === null ? {} : { fellBack }) })).toBe(
      "Measured as searched in Germany, in German. Your site reads as English; ReachKit measures Germany in German."
    );
  });

  it("a supported language read in a country that does not use it names the pair", () => {
    expect(measuredIn({ country: "GB", language: "en", fellBack: { country: null, language: "de" } })).toBe(
      "Measured as searched in United Kingdom, in English. Your site reads as German; ReachKit measures United Kingdom in English."
    );
  });

  it("what is not on the list is still named unmeasured", () => {
    expect(measuredIn({ country: "GB", language: "en", fellBack: { country: "FR", language: "fr" } })).toBe(
      "Measured as searched in United Kingdom, in English. ReachKit does not measure France in French yet."
    );
  });
});

describe("the landing's German answer names the countries ReachKit measures", () => {
  it("every supported country appears in the rendered answer", () => {
    const html = renderToStaticMarkup(React.createElement(LandingPage));
    const answer = html.slice(html.indexOf("Does it work in German?"), html.indexOf("</details>", html.indexOf("Does it work in German?")));
    for (const row of Object.values(COUNTRIES)) expect(answer).toContain(row.location);
  });

  it("a country added to the list is named by its language", () => {
    const fixture = { ...COUNTRIES, NZ: { location: "New Zealand", language: "en" } };
    expect(countriesMeasuredIn("en", fixture)).toContain("New Zealand");
    expect(countriesMeasuredIn("de", fixture)).not.toContain("New Zealand");
  });
});

describe("a site that declares other markets is told one is measured", () => {
  const tags = (n: number): string[] => Array.from({ length: n }, (_, i) => `x${i}`);
  const words = (text: string): number => text.split(/\s+/).filter(Boolean).length;

  it.each([
    [0, null],
    [1, "Your site also serves one other market. We measure the one this address is for; choose another at setup."],
    [48, "Your site also serves 48 other markets. We measure the one this address is for; choose another at setup."],
  ])("the free report at %i other markets", (n, said) => {
    const html = reportHtml({ country: "DE", language: "de", ...(n === 0 ? {} : { alsoServes: tags(n) }) });
    expect(lineOf(html, "report-also-serves")).toBe(said);
    expect(html).not.toMatch(/Settings/);
  });

  it.each([
    [0, null],
    [1, "Your site also serves one other market; we measure one. Change it at setup."],
    [48, "Your site also serves 48 other markets; we measure one. Change it at setup."],
  ])("the app at %i other markets", (n, said) => {
    expect(lineOf(renderToStaticMarkup(React.createElement(AlsoServesNote, { n })), "also-serves")).toBe(said);
  });

  it("Overview's card says it from the newest pass's count, and the free report's card does not repeat it", () => {
    const understanding = understandBusiness({ domain: "flixbus.de", profile: null, locale: { country: "DE", language: "de" }, alsoServes: 48 });
    const app = renderToStaticMarkup(React.createElement(WhatWeRead, { understanding, editHref: "/app/settings/business" }));
    expect(lineOf(app, "also-serves")).toContain("48 other markets");
    expect(renderToStaticMarkup(React.createElement(WhatWeRead, { understanding }))).not.toContain("also-serves");
  });

  it("each line is at most 20 words", () => {
    for (const line of [
      copy("report.locale.also-serves", { n: "48" }),
      copy("report.locale.also-serves.one"),
      copy("app.locale.also-serves", { n: "48" }),
      copy("app.locale.also-serves.one"),
    ]) {
      expect(words(line), line).toBeLessThanOrEqual(20);
    }
  });
});
