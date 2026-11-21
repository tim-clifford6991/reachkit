// Every stored free report: no quote holds an address or markdown, and no count over zero searches is drawn as a result.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { answerQuoteOf } from "@/app/(public)/scan/[domain]/_modules/ai-answers";
import { presenceFigureOf } from "@/app/(public)/scan/[domain]/_modules/google-presence";
import { readStoredReport } from "@/lib/scan/report";

const dir = path.resolve(import.meta.dirname, "../../fixtures/walk/free");
const reports = readdirSync(dir).flatMap((f) => (JSON.parse(readFileSync(path.join(dir, f), "utf8")) as { sites: { stored: { scan: { report: unknown } } | null }[] }).sites.flatMap((s) => (s.stored ? [readStoredReport(s.stored.scan.report)] : [])));

it("quotes words only and draws no figure over zero searches", () => {
  for (const r of reports) {
    if (r.aiAnswers) expect(answerQuoteOf(r.aiAnswers, r.serps)?.text ?? "").not.toMatch(/!\[|\]\(|http/);
    if (r.presence) expect(presenceFigureOf(r.presence) === null).toBe(r.presence.measuredSearches === 0);
  }
  const r = reports.find((x) => x.aiAnswers && answerQuoteOf(x.aiAnswers, x.serps))!;
  const i = r.aiAnswers!.rows.findIndex((row) => row.cell.kind === "answered" && row.cell.citedDomains.length > 0);
  const serps = r.serps.map((s, j) => (j === i && s.kind !== "unmeasured" ? { ...s, value: { ...s.value, aiOverview: { ...s.value.aiOverview, text: "![x](https://api.dataforseo.com/cdn/i/1) Bread is a baked food. More." } } } : s));
  expect(answerQuoteOf(r.aiAnswers!, serps)?.text).toBe("Bread is a baked food.");
  expect(reports.some((x) => x.presence?.measuredSearches === 0)).toBe(true);
});
