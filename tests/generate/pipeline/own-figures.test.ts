// tests/generate/pipeline/own-figures.test.ts — SPEC §7 (owner, 2026-10-17,
// issue 1490, amending 1163): the site's own measurements appear only on a
// research page. Run on the dogfood site's stored report, as committed in
// the evaluation snapshot, so the figures are a real pass's ("0 of the 12",
// "20 out of 100").
import "../env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPack, type PackInputs } from "@/lib/generate/pipeline/pack";
import { reportAddress, reportFactsAllowed, reportSentences } from "@/lib/generate/pipeline/report-facts";
import { repairMechanical } from "@/lib/generate/pipeline/repair";
import type { SourcedFact } from "@/lib/generate/pipeline/grounding";
import { checkTraceableNumerals } from "@/lib/generate/rules/brief";
import { refreshCauseOf, statesOwnFigures, type OwnLivePage } from "@/lib/opportunities/refresh";
import type { Opportunity } from "@/lib/opportunities/types";
import { readStoredReport } from "@/lib/scan/report";
import { AT, FACTS, opportunity, report } from "../fixtures";

const stored = readStoredReport(
  (
    JSON.parse(
      readFileSync(path.resolve(__dirname, "../../../scripts/eval-content/snapshot/reachkit.app.json"), "utf8")
    ) as { report: unknown }
  ).report
);
const SENTENCES = reportSentences(stored);
const REPORT_FACTS: SourcedFact[] = SENTENCES.map((passage) => ({
  fact: { url: reportAddress("reachkit.app"), readAt: AT, passage },
  sourceText: SENTENCES.join("\n"),
  report: true,
}));

const brief = (withheld: boolean) => ({
  facts: [...SENTENCES, "Answers cover 12 buyer searches every week."],
  queries: ["ai visibility tool"],
  ...(withheld ? { reportPassages: SENTENCES } : {}),
});

describe("a page that is not research states none of the site's own measurements", () => {
  it("only a research page may hold the report's sentences", () => {
    expect(reportFactsAllowed("research")).toBe(true);
    for (const type of ["listicle", "how_to", "documentation", "qa", "insights", "update"] as const) {
      expect(reportFactsAllowed(type)).toBe(false);
    }
  });

  it("the pack of a how-to leaves them out; a research pack keeps them", () => {
    const inputs = (type: PackInputs["type"]): PackInputs => ({
      type,
      opportunity: opportunity(),
      site: { businessName: "Acme", domain: "example.com", doNotClaim: [], rivals: [] },
      category: "project management software",
      byline: null,
      voice: null,
      profile: null,
      facts: [...FACTS, ...REPORT_FACTS],
      research: { facts: [], products: [] },
      report: report(),
      sitePages: [],
      links: [],
      now: AT,
    });
    expect(buildPack(inputs("how_to")).facts.some((fact) => fact.report === true)).toBe(false);
    expect(buildPack(inputs("research")).facts.filter((fact) => fact.report === true).length).toBeGreaterThan(0);
  });

  it("stops a count of a total or a score, linked to the report or not", () => {
    for (const body of [
      "Today AI answers name reachkit.app in 0 of the 12 buyer searches.",
      "Our [Visibility Score of 20](https://reachkit.app/scan/reachkit.app) leaves room to grow.",
      "The site scores 20/100 on findability.",
    ]) {
      expect(checkTraceableNumerals({ markdown: body, brief: brief(true) })?.rule).toBe("traceable_numerals");
    }
  });

  it("reads a bare number as no measurement, and holds a research page to nothing more", () => {
    const body = "Answers cover 12 buyer searches every week.";
    expect(checkTraceableNumerals({ markdown: body, brief: brief(true) })).toBeNull();
    expect(checkTraceableNumerals({ markdown: "Today AI answers name reachkit.app in 0 of the 12 buyer searches.", brief: brief(false) })).toBeNull();
  });

  it("the repair drops the sentence, rather than linking the figure to the report", () => {
    const body = "We write one page a day. AI answers named reachkit.app in 0 of the 12 buyer searches.";
    expect(repairMechanical(body, ["traceable_numerals"], { brief: brief(true), sources: [] }).trim()).toBe("We write one page a day.");
  });
});

describe("a live page that states one is refreshed at 0¢", () => {
  const meta = (type: string) => ({ pack: { type, facts: [{ passage: SENTENCES[1], url: reportAddress("reachkit.app"), readAt: AT.toISOString(), report: true }] } });
  const body = "## Where you stand\n\nAI answers named reachkit.app in 0 of the 12\nbuyer searches.";

  it("reads the figure off the version's own pack, and never off a research page", () => {
    expect(SENTENCES[1]).toContain("0 of the 12");
    expect(statesOwnFigures(meta("how_to"), body)).toBe(true);
    expect(statesOwnFigures(meta("research"), body)).toBe(false);
    expect(statesOwnFigures(meta("how_to"), "AI answers cover 12 buyer searches.")).toBe(false);
    expect(statesOwnFigures({}, body)).toBe(false);
  });

  it("is due for its own cause once past §6's floor", () => {
    const page = (age: number): OwnLivePage => ({
      url: "https://blog.reachkit.app/how-to",
      publishedAt: new Date(AT.getTime() - age * 86_400_000),
      row: { targetQuery: "how to" } as unknown as Opportunity,
      declined: false,
      facts: [],
      marketFacts: [],
      ownFigures: true,
    });
    expect(refreshCauseOf(page(31), { siteText: [], market: [] }, AT)).toBe("own_figures");
    expect(refreshCauseOf(page(5), { siteText: [], market: [] }, AT)).toBeNull();
  });
});
