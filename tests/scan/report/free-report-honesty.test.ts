// Every stored free report: a quote is one line of the answer's own words, and no card draws a count over zero searches.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { aiFigureOf, answerQuoteOf, presenceFigureOf } from "@/lib/scan/sections";
import { readStoredReport } from "@/lib/scan/report";

const dir = path.resolve(import.meta.dirname, "../../fixtures/walk/free");
const reports = readdirSync(dir).flatMap((f) => (JSON.parse(readFileSync(path.join(dir, f), "utf8")) as { sites: { stored: { scan: { report: unknown } } | null }[] }).sites.flatMap((s) => (s.stored ? [readStoredReport(s.stored.scan.report)] : [])));
const NOT_WORDS = /!\[|\]\(|https?:|www\.|\[\^?\d+\]|\n|^[#>|*-]|\*|\|/;

it("quotes one line of words and draws no figure over zero searches, on every stored report", () => {
  const quotes = reports.flatMap((r) => (r.aiAnswers ? [answerQuoteOf(r.aiAnswers, r.serps)?.text] : [])).filter((q) => q !== undefined);
  expect(quotes.length).toBeGreaterThan(5);
  for (const q of quotes) expect(q).not.toMatch(NOT_WORDS);
  for (const r of reports) {
    expect(aiFigureOf(r.aiAnswers) === null).toBe((r.aiAnswers?.answeredSearches ?? 0) === 0);
    expect(presenceFigureOf(r.presence) === null).toBe((r.presence?.measuredSearches ?? 0) === 0);
  }
  expect(reports.some((r) => r.presence?.measuredSearches === 0) && reports.some((r) => r.aiAnswers?.answeredSearches === 0)).toBe(true);
});

it("cleans images, citations, bracketed addresses and lists out of an answer's first sentence", () => {
  const r = reports.find((x) => x.aiAnswers && answerQuoteOf(x.aiAnswers, x.serps))!;
  const i = r.aiAnswers!.rows.findIndex((row) => row.cell.kind === "answered" && row.cell.citedDomains.length > 0);
  const quote = (text: string) => answerQuoteOf({ ...r.aiAnswers!, rows: [r.aiAnswers!.rows[i]!] }, [r.serps[i]!].map((s) => (s.kind === "unmeasured" ? s : { ...s, value: { ...s.value, aiOverview: { ...s.value.aiOverview, text } } })))?.text;
  expect(quote("![x](https://api.dataforseo.com/cdn/i/1) Bread is a baked food. More.")).toBe("Bread is a baked food.");
  expect(quote("Bread (a food [1]) is baked.[[1]](https://a.example/x)[[2]](https://b.example) More.")).toBe("Bread (a food) is baked.");
  expect(quote("[t](https://x.example/a_(b)) Bread is food.")).toBe("t Bread is food.");
  expect(quote("To find specialty coffee beans near you, check out local roasters:\n\n- **Local Roasters:** Visit shops.")).toBeUndefined();
});
