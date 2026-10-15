// tests/generate/pipeline/report-facts.test.ts — SPEC §7 (2026-10-03,
// issue 1163): the latest complete report's measurements are dated business
// facts. Run against the stored report of the dogfood site, as committed in
// the evaluation snapshot, so the figures are a real pass's.
import "../env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prose } from "@/lib/measure/prose";
import { reportPage, reportSentences } from "@/lib/generate/pipeline/report-facts";
import { orderedPassages } from "@/lib/generate/pipeline/grounding";
import { readStoredReport } from "@/lib/scan/report";

const blob = (): unknown =>
  (
    JSON.parse(
      readFileSync(path.resolve(__dirname, "../../../scripts/eval-content/snapshot/reachkit.app.json"), "utf8")
    ) as { report: unknown }
  ).report;

describe("a complete report states what it measured", () => {
  it("dates the score, who AI answers named, and the engines it asked — Perplexity not among them", () => {
    const sentences = reportSentences(readStoredReport(blob()));
    expect(sentences[0]).toBe(
      "ReachKit measured reachkit.app on 17 September 2026 and gave it a Visibility Score of 20 out of 100."
    );
    expect(sentences).toContain(
      "On 17 September 2026, AI answers mentioned reachkit.app for 0 of the 12 buyer searches they answered in ReachKit's measurement."
    );
    expect(sentences.some((sentence) => sentence.includes("AI answers linked to freddiechatt.com for 3 of the 12"))).toBe(true);
    expect(sentences.at(-1)).toContain("Google AI Overview, Google AI Mode and ChatGPT; it does not measure Perplexity.");
  });

  it("is a page every sentence of which can be quoted, at the report's own address", () => {
    const page = reportPage(readStoredReport(blob()))!;
    expect(new URL(page.url).pathname).toBe("/scan/reachkit.app");
    expect(orderedPassages(page.text).sort()).toEqual(page.text.split("\n").sort());
  });

  it("states nothing for a pass that stopped early", () => {
    expect(reportSentences({ ...readStoredReport(blob()), complete: false })).toEqual([]);
  });
});

describe("an example's caption takes what it captions with it", () => {
  it("drops a panel whose caption carries the example mark itself, and keeps what it said", () => {
    const read = prose(
      `<main><p>We publish one page a day on your own domain.</p>
       <aside><div><h2>One number tells you how findable you are.</h2>
       <p data-testid="panel-example">An example on example.com. It measures no site.</p></div></aside>
       <div data-demo><p>The whole loop, as a customer sees it.</p></div></main>`
    );
    expect(read.text).toBe("We publish one page a day on your own domain.");
    expect(read.examples).toContain("One number tells you how findable you are.");
    expect(read.examples).toContain("The whole loop, as a customer sees it.");
  });
});
