// Board PubReport, the top half: the head, what we read you as, the biggest
// gap, the jump chips, the score card, and who gets your buyers with its AI
// and Google panels, in the board's order and words. Against the real
// registry, on the reserved-name fixture and the customer panel's stored
// reports (a SaaS and a local business). 0¢: nothing is measured.
import { describe, expect, it } from "vitest";
import { copy } from "@/lib/presentation/copy";
import { FIXTURE_COLD_START_REPORT, FIXTURE_DEGRADED_REPORT, FIXTURE_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";
import { answerQuoteOf } from "@/app/(public)/scan/[domain]/_modules/ai-answers";
import { buyersOf } from "@/app/(public)/scan/[domain]/_modules/buyers";
import type { StoredReport } from "@/lib/scan/report";
import { segments } from "../../../scripts/design/parity.mjs";
import { LIMITING_LINES } from "@/lib/presentation/bands";
import { panelReport, renderReport, walkReport } from "./panel-report";

/** The page's visible strings, one per block, as the parity check reads them. */
function shown(report: StoredReport): string[] {
  return segments(renderReport(report)) as string[];
}

/** Where the first string reading exactly `text` sits, or -1. */
function at(lines: readonly string[], text: string): number {
  return lines.indexOf(text);
}

/** Every text is on the page, each after the one before it. */
function expectInOrder(lines: readonly string[], texts: readonly string[]): void {
  let last = -1;
  for (const text of texts) {
    const i = at(lines, text);
    expect(i, `"${text}" is on the page`).toBeGreaterThan(-1);
    expect(i, `"${text}" comes after the string before it`).toBeGreaterThan(last);
    last = i;
  }
}

const ai = FIXTURE_REPORT.aiAnswers!;
const presence = FIXTURE_REPORT.presence!;

describe("the head reads as the board: domain, where it was measured, what we read, the gap, the chips, the score", () => {
  const lines = shown(FIXTURE_REPORT);

  it("names the domain and says where it was measured in one line", () => {
    expectInOrder(lines, [
      copy("report.eyebrow"),
      "example.com",
      `${copy("report.measured-at", { date: "Sep 5, 2026", category: "product analytics" })} ${copy("report.measurement")}`,
    ]);
  });

  it("says what we read you as, with the market's language and country, and offers the correction once", () => {
    expectInOrder(lines, [
      copy("report.read.as.title"),
      "product analytics",
      "product teams",
      copy("report.read.as.locale", { language: "English", country: "United States" }),
      copy("verdict.not-your-market"),
    ]);
    const head = lines.slice(0, at(lines, copy("verdict.score.label")));
    expect(head.filter((line) => line === copy("verdict.not-your-market"))).toHaveLength(1);
  });

  it("names the biggest gap, its two lines and the way to the missing pages (owner R12 B1)", () => {
    expectInOrder(lines, [
      copy("verdict.limiting.answerability"),
      copy("verdict.limiting.answerability.line"),
      copy("verdict.limiting.answerability.why"),
      copy("report.gap.see-missing"),
    ]);
  });

  it("jumps to who gets your buyers, the missing pages, what holds you back and the first page, each a section on the page", () => {
    const html = renderReport(FIXTURE_REPORT);
    const nav = /<nav aria-label="On this report"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? "";
    const chips = [...nav.matchAll(/<a href="#([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => [m[1], m[2]]);
    expect(chips.map(([, label]) => label)).toEqual([
      copy("report.jump.buyers"),
      copy("report.missing.eyebrow"),
      copy("problem.section.title"),
      copy("report.jump.first-page"),
    ]);
    for (const [anchor] of chips) expect(html, `#${anchor} lands on the page`).toContain(`id="${anchor}"`);
  });

  it("the score card: its name, the band beside the range, what it is made of, and the four parts in tenths", () => {
    expectInOrder(lines, [
      copy("verdict.score.label"),
      `${copy("band.score.hard-to-find")} ${copy("verdict.estimate.range", { low: "25", high: "35" })}`,
      copy("verdict.score.parts"),
      `${copy("verdict.factor.foundations")} 7/10`,
      `${copy("verdict.factor.answerability")} 2/10`,
      `${copy("verdict.factor.google")} 1/10`,
      `${copy("verdict.factor.ai")} 3/10`,
    ]);
  });

  it("the head comes before the score, and the score before who gets your buyers", () => {
    expectInOrder(lines, [copy("report.read.as.title"), copy("report.jump.first-page"), copy("verdict.score.label"), copy("report.buyers.title")]);
  });
});

describe("who gets your buyers today, and its two panels", () => {
  const lines = shown(FIXTURE_REPORT);

  it("leads with its heading and the sentence naming who the buyers are sent to", () => {
    const b = buyersOf(ai, presence);
    expect(b).toEqual({ holder: "rival-one.example.net", ai: 3, google: 1, out: 21 });
    expectInOrder(lines, [
      copy("report.jump.buyers"),
      copy("report.buyers.title"),
      copy("report.buyers.lead"),
      `${copy("report.buyers.summary", { holder: "rival-one.example.net", n: "4", m: "21" })} ${copy("report.buyers.split", {
        ai: copy("report.buyers.split.ai", { n: "3" }),
        google: copy("report.buyers.split.google.one", { n: "1" }),
      })}`,
    ]);
  });

  it("the AI panel: the figure, what it counts, the waffle, one answer quoted as written, the questions", () => {
    expectInOrder(lines, [
      copy("report.buyers.title"),
      copy("ai-answers.title"),
      `${copy("report.figure.of", { count: "3", total: "9" })} ${copy("ai-answers.finding")}`,
      copy("ai-answers.source", { total: "12" }),
      copy("report.ai.waffle"),
      copy("report.ai.quote", { search: "product analytics tools" }),
      // One sentence, as written, never the whole answer.
      "For a small team, many start with Rival One or Rival Two, which need no data warehouse.",
      copy("report.ai.asked", { total: "12" }),
    ]);
  });

  it("the Google panel: the figure, its source, the waffle, the biggest search, and the searches you're missing", () => {
    const start = at(lines, copy("report.ai.asked", { total: "12" }));
    expectInOrder(lines.slice(start), [
      copy("presence.title"),
      `${copy("report.figure.of", { count: "1", total: "12" })} ${copy("presence.finding")}`,
      copy("presence.source", { measured: "12" }),
      copy("report.google.waffle"),
      copy("report.google.most", { search: "product analytics tools", volume: "8,100", holder: "rival-one.example.net" }),
      `${copy("presence.absent-from.title")} 5`,
      copy("presence.absent-from.column.search"),
      copy("presence.absent-from.column.volume"),
      copy("presence.absent-from.column.holder"),
    ]);
  });

  it("each waffle row is named and tallied, the customer's last and marked as theirs", () => {
    const html = renderReport(FIXTURE_REPORT);
    const waffle = html.slice(html.indexOf('data-testid="presence-waffle"'));
    const rows = [...waffle.matchAll(/role="rowheader"[^>]*>([\s\S]*?)<\/span><div/g)].map((m) => m[1]!.replace(/<[^>]+>/g, " ").trim());
    const tallies = [...waffle.matchAll(/<span class="num pl-2[^"]*">(\d+)<\/span>/g)].map((m) => m[1]);
    expect(rows.slice(0, 4).map((row) => row.replace(/\s+/g, " "))).toEqual([
      "rival-one.example.net",
      "rival-two.example.net",
      "rival-three.example.org",
      `${copy("report.you")} example.com`,
    ]);
    expect(tallies.slice(0, 4)).toEqual(["10", "8", "5", "1"]);
    expect(waffle.slice(0, waffle.indexOf('data-testid="presence-most-searched"')).match(/data-cell="cited"/g)).toHaveLength(24);
  });
});

describe("the states the board does not draw", () => {
  it("no kept answer text, no quote: none is made up", () => {
    expect(answerQuoteOf(ai, [])).toBeNull();
    expect(renderReport({ ...FIXTURE_REPORT, serps: [] })).not.toContain('data-testid="ai-answers-quote"');
  });

  const kept = (text: string): StoredReport["serps"][number] => ({
    kind: "measured",
    at: new Date("2026-09-05T09:00:00.000Z"),
    value: { organic: [], aiOverview: { present: true, asynchronousAiOverview: true, referenceDomains: [], text } },
  });

  it("an answer whose first sentence runs past one quote is not cut; the next kept answer is used", () => {
    const long = kept(`${"word ".repeat(60)}end.`);
    expect(answerQuoteOf(ai, [long])).toBeNull();
    expect(answerQuoteOf(ai, [long, kept("Short and true. Then more.")])).toEqual({ search: ai.rows[1]!.question.search, text: "Short and true." });
  });

  it("a word that starts with a mark keeps its space, and its dot does not end the sentence", () => {
    expect(answerQuoteOf(ai, [kept("Teams build on .NET and Azure. Then more.")])?.text).toBe("Teams build on .NET and Azure.");
    expect(answerQuoteOf(ai, [kept("Pick a .io domain.")])?.text).toBe("Pick a .io domain.");
  });

  it("a space before a closing mark and the markdown marks are still removed", () => {
    expect(answerQuoteOf(ai, [kept("**Acme** , the `leader` . Then more.")])?.text).toBe("Acme, the leader.");
  });

  it("no competitor found: the sentence counts the customer alone", () => {
    const lines = shown(FIXTURE_COLD_START_REPORT);
    const b = buyersOf(FIXTURE_COLD_START_REPORT.aiAnswers!, FIXTURE_COLD_START_REPORT.presence!);
    expect(b.holder).toBeNull();
    const n = b.ai + b.google;
    const summary = lines.find((line) => line.startsWith(copy(n === 1 ? "report.buyers.summary.none.one" : "report.buyers.summary.none", { n: String(n), m: String(b.out) })));
    expect(summary).toBeDefined();
  });

  it("a panel not measured: no sentence sums over the missing half, and no gap link without a missing page", () => {
    const lines = shown(FIXTURE_DEGRADED_REPORT);
    expect(at(lines, copy("report.buyers.title"))).toBeGreaterThan(-1);
    expect(renderReport(FIXTURE_DEGRADED_REPORT)).not.toContain('data-testid="report-buyers-summary"');
    expect(at(lines, copy("report.gap.see-missing"))).toBe(-1);
  });

  it("a stored report that kept Presence whole says three parts, not four", () => {
    const whole = { ...FIXTURE_REPORT, verdict: { ...FIXTURE_REPORT.verdict, halves: undefined } };
    const lines = shown(whole);
    expect(at(lines, copy("verdict.score.parts.three"))).toBeGreaterThan(-1);
    expect(at(lines, copy("verdict.score.parts"))).toBe(-1);
  });

  it("the biggest search held by no competitor names no first place, and a card stored before it draws no line", () => {
    const noHolder = { ...FIXTURE_REPORT, presence: { ...presence, mostSearched: { ...presence.mostSearched!, topHolder: null } } };
    expect(at(shown(noHolder), copy("report.google.most.none", { search: "product analytics tools", volume: "8,100" }))).toBeGreaterThan(-1);
    const older = { ...FIXTURE_REPORT, presence: { ...presence, mostSearched: undefined } };
    expect(renderReport(older)).not.toContain('data-testid="presence-most-searched"');
  });
});

describe("the customer panel's stored reports, a SaaS and a local business", () => {
  it("names no competitor the buyers go to when the customer was found more often than it", () => {
    for (const [walk, domain] of [
      ["2026-10-15-1441-after", "austinplumbery.com"],
      ["2026-10-15", "alexander.co.uk"],
    ] as const) {
      const report = walkReport(walk, domain);
      const b = buyersOf(report.aiAnswers!, report.presence!);
      expect(b.holder, domain).toBeNull();
      const n = b.ai + b.google;
      const none = copy("report.buyers.summary.none", { n: String(n), m: String(b.out) });
      expect(shown(report).some((line) => line.startsWith(none)), domain).toBe(true);
    }
  });

  it("draws no count where both panels measured nothing", () => {
    for (const domain of ["ifleeds.com", "flintplumb.com"]) {
      const report = walkReport("2026-10-15-1441-after", domain);
      expect(buyersOf(report.aiAnswers!, report.presence!).out, domain).toBe(0);
      const html = renderReport(report);
      expect(html, domain).toContain(`id="buyers-h"`);
      expect(html, domain).not.toContain('data-testid="report-buyers-summary"');
    }
  });

  it("quotes the AI answer in plain words, without its markdown marks", () => {
    const report = panelReport("saas");
    expect(answerQuoteOf(report.aiAnswers!, report.serps)?.text).toBe(
      "Scheduling software helps you manage calendars, meetings, employee shifts, or project timelines."
    );
  });

  it("every biggest gap says why it matters in words other than its line", () => {
    for (const [factor, keys] of Object.entries(LIMITING_LINES)) expect(copy(keys.why), factor).not.toBe(copy(keys.line));
  });

  for (const which of ["saas", "local"] as const) {
    it(`${which}: the head, the chips and who gets your buyers draw from what was stored`, () => {
      const lines = shown(panelReport(which));
      expectInOrder(lines, [
        copy("report.read.as.title"),
        copy("verdict.not-your-market"),
        copy("report.jump.first-page"),
        copy("verdict.score.label"),
        copy("report.buyers.title"),
        copy("ai-answers.title"),
        copy("presence.title"),
      ]);
    });
  }
});
