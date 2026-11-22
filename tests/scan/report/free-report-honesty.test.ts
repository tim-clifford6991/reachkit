// Every stored free report: a quote is one line of the answer's own words, and no card draws a count over zero searches.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { aiFigureOf, answerQuoteOf, presenceFigureOf } from "@/lib/scan/sections";
import { readStoredReport } from "@/lib/scan/report";

const dir = path.resolve(import.meta.dirname, "../../fixtures/walk/free");
const reports = readdirSync(dir).flatMap((f) => (JSON.parse(readFileSync(path.join(dir, f), "utf8")) as { sites: { stored: { scan: { report: unknown } } | null }[] }).sites.flatMap((s) => (s.stored ? [readStoredReport(s.stored.scan.report)] : [])));
const NOT_WORDS = /https?:|www\.|[[\]【】<>|*_\n]|&[#a-z0-9]+;|^(?:\d+[.)]|[•+#>-])\s/;

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
  const cases: [string, string | undefined][] = [
    ["![x](https://api.dataforseo.com/cdn/i/1) Bread is a baked food. More.", "Bread is a baked food."],
    ["Bread (a food [1]) is baked.[[1]](https://a.example/x)[[2]](https://b.example) More.", "Bread (a food) is baked."],
    ["[t](https://x.example/a_(b)) Bread is food.", "t Bread is food."],
    ["Coffee is sold online:\n\n- Trade Coffee – A shop.", undefined],
    ["1. **Local Roasters:** Visit shops.", "Local Roasters: Visit shops."],
    ["e.g. bread is baked. More.", "e.g. bread is baked."],
    ["Bread is a baked food[^note] [1, 2] [1-3] 【1】. More.", "Bread is a baked food."],
    ["Bread is a baked food [a]. More.", undefined],
    ["<b>Bread</b> is a baked food.<br>More.", "Bread is a baked food."],
    ["Bread &amp; butter is a food.", "Bread & butter is a food."],
    ["__Bread__ is a _baked_ food.", "Bread is a baked food."],
    ["Bread is a baked food\u00a0[1]. More.", "Bread is a baked food."],
    ["### Breads\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n```\ncode\n```\n\nBread is a baked food.", "Bread is a baked food."],
    ["Bread is a baked food[1](https://a.example). More.", "Bread is a baked food."],
    ["Bread is ~~not~~ a baked food. More.", undefined],
    ["Bread is a baked food¹. More.", "Bread is a baked food."],
    ["Bread is a baked food^1^. More.", "Bread is a baked food."],
    ["A bakery of 100 m² bakes bread. More.", "A bakery of 100 m² bakes bread."],
    ["[^1]: Source text here is long.\n\nBread is a baked food. More.", "Bread is a baked food."],
    ["El pan es un alimento básico. ¿Dónde comprarlo? Aquí.", "El pan es un alimento básico."],
    ["לחם הוא מזון בסיסי בכל בית. נמכר במאפיות.", "לחם הוא מזון בסיסי בכל בית."],
    ["الخبز طعام أساسي في كل بيت. يباع في المخابز.", "الخبز طعام أساسي في كل بيت."],
    ["The best bakery is run by Dr. Smith in town. It opens at 7.", undefined],
    ["Bread is a baked food<sup>1</sup>. It is old.", undefined],
    ["Bread is a baked food ([1](https://a.com), [2](https://b.com)). It is old.", undefined],
    ["Bread is a baked food^[1]. It is old.", undefined],
  ];
  for (const [text, want] of cases) expect(quote(text), text).toBe(want);
  const stored = reports.flatMap((x) => x.serps).flatMap((sv) => (sv.kind !== "unmeasured" && sv.value.aiOverview.text?.includes("subscriptions:\n\n- ") ? [sv.value.aiOverview.text] : []));
  expect(stored.length).toBeGreaterThan(0);
  for (const text of stored) expect(quote(text)).toBeUndefined();
});
