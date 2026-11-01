// Board PubReport, the top half: the head, what we read you as, the headline
// of who gets your buyers (owner R12), the biggest gap, the score card, and
// the AI and Google panels, in the board's order and words. Against the real
// registry, on the reserved-name fixture and the customer panel's stored
// reports (a SaaS and a local business). 0¢: nothing is measured.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { measured } from "@/lib/measure/measured";
import type { SerpResult } from "@/lib/vendors/dataforseo/types";
import { copy } from "@/lib/presentation/copy";
import { FIXTURE_COLD_START_REPORT, FIXTURE_DEGRADED_REPORT, FIXTURE_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";
import { answerQuoteOf } from "@/app/(public)/scan/[domain]/_modules/ai-answers";
import { buyersOf, headlineOf } from "@/app/(public)/scan/[domain]/_modules/buyers";
import type { StoredReport } from "@/lib/scan/report";
import { segments } from "../../../scripts/design/parity.mjs";
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

describe("the head reads as the board: domain, where it was measured, what we read, the headline, the gap, the score", () => {
  const lines = shown(FIXTURE_REPORT);

  it("names the domain, says where it was measured in one line, and that the report is independent", () => {
    expectInOrder(lines, [
      copy("report.eyebrow"),
      "example.com",
      `${copy("report.measured-at", { date: "Sep 5, 2026", category: "product analytics" })} ${copy("report.measurement")}`,
      copy("report.independent", { company: "example" }),
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

  it("leads with who gets the buyers and the pages found, before the gap and the score ring (owner R12)", () => {
    expectInOrder(lines, [
      copy("verdict.not-your-market"),
      copy("report.top.title", { holder: "rival-one.example.net" }),
      copy("report.top.line", { n: "4", m: "21" }),
      copy("report.top.offer", { count: "7" }),
      copy("verdict.limiting.answerability"),
      copy("verdict.score.label"),
      copy("report.buyers.title"),
    ]);
    const html = renderReport(FIXTURE_REPORT);
    expect(html.indexOf('data-testid="report-top"')).toBeLessThan(html.indexOf("radial-progress"));
    expect(html).toMatch(/<a href="#start"[^>]*data-testid="report-top-offer">/);
    expect(html).toContain('id="start"');
  });

  it("names the biggest gap in its title and one line, and nothing after them", () => {
    const gap = renderReport(FIXTURE_REPORT).match(/<section[^>]*data-testid="report-gap"[\s\S]*?<\/section>/)![0];
    expect(segments(gap)).toEqual([copy("verdict.limiting.answerability"), copy("verdict.limiting.answerability.line")]);
    expect(gap).not.toContain("<a ");
  });

  it("draws no jump chips: the page is short enough to read in order", () => {
    const html = renderReport(FIXTURE_REPORT);
    expect(html).not.toContain("<nav");
    expect(html).not.toMatch(/<a href="#(buyers|holds|first-page)"[^>]*class="badge/);
  });

  it("the score card: its name, the band beside the open range, and closed under its name what it is made of in tenths", () => {
    const split = renderReport(FIXTURE_REPORT).match(/<details[^>]*data-testid="verdict-split"[\s\S]*?<\/details>/)![0];
    expect(split).not.toMatch(/<details[^>]* open/);
    expect(segments(split)[0]).toBe(copy("verdict.score.split"));
    expectInOrder(lines, [
      copy("verdict.score.label"),
      `${copy("band.score.hard-to-find")} ${copy("verdict.estimate.range", { low: "25", high: "35" })}`,
      copy("verdict.score.split"),
      copy("verdict.score.parts"),
      `${copy("verdict.factor.foundations")} 7/10`,
      `${copy("verdict.factor.answerability")} 2/10`,
      `${copy("verdict.factor.google")} 1/10`,
      `${copy("verdict.factor.ai")} 3/10`,
    ]);
  });

});

describe("who gets your buyers, and its two panels", () => {
  const lines = shown(FIXTURE_REPORT);

  it("the section is its heading and the two panels: the headline above already said who leads", () => {
    expect(buyersOf(ai, presence, FIXTURE_REPORT.serps)).toEqual({ holder: "rival-one.example.net", ai: 3, google: 1, out: 21 });
    const i = at(lines, copy("report.buyers.title"));
    expect(lines[i + 1]).toBe(copy("ai-answers.title"));
    expect(lines.filter((line) => line === copy("report.top.title", { holder: "rival-one.example.net" }))).toHaveLength(1);
  });

  it("the AI panel: the figure, what it counts, the waffle, one answer quoted as written, the questions", () => {
    expectInOrder(lines, [
      copy("report.buyers.title"),
      copy("ai-answers.title"),
      `${copy("report.figure.of", { count: "3", total: "9" })} ${copy("ai-answers.finding")}`,
      copy("ai-answers.source", { total: "12", answered: "9" }),
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

  it("nobody found and the customer at zero: buyers can't find you yet, before the score", () => {
    const b = buyersOf(FIXTURE_COLD_START_REPORT.aiAnswers!, FIXTURE_COLD_START_REPORT.presence!, FIXTURE_COLD_START_REPORT.serps);
    expect(b).toMatchObject({ holder: null, ai: 0, google: 0 });
    expectInOrder(shown(FIXTURE_COLD_START_REPORT), [copy("report.top.title.none"), copy("report.top.line", { n: "0", m: String(b.out) }), copy("verdict.score.label")]);
  });

  it("a panel not measured: no headline, so no count is summed over the missing half or shown as 0", () => {
    expect(headlineOf(FIXTURE_DEGRADED_REPORT.aiAnswers, FIXTURE_DEGRADED_REPORT.presence, FIXTURE_DEGRADED_REPORT.serps)).toBeNull();
    const lines = shown(FIXTURE_DEGRADED_REPORT);
    expect(at(lines, copy("report.buyers.title"))).toBeGreaterThan(-1);
    for (const key of ["report.top.title.none", "report.top.title.you-lead"] as const) expect(at(lines, copy(key))).toBe(-1);
    expect(renderReport(FIXTURE_DEGRADED_REPORT)).not.toMatch(/data-testid="report-top"><h2/);
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

describe("who gets your buyers counts searches, each once (wrong-rival F3)", () => {
  const SEARCHES = ["search one", "search two", "search three", "search four"];
  const answered = { kind: "answered", citedDomains: [], namesCustomer: false } as const;

  // Synthetic rivals on plain names: a subdomain of example.net would be example.net itself.
  /** A synthetic market: per rival, the searches (by index) whose top ten, local pack or AI answer it was on. */
  function market(found: Record<string, { top?: number[]; pack?: number[]; ai?: number[] }>, you = { ai: 0, google: 0 }) {
    const domains = Object.keys(found);
    const on = (i: number, where: "top" | "pack") => domains.filter((d) => found[d]![where]?.includes(i)).map((d) => ({ position: 1, domain: `www.${d}`, url: `https://www.${d}/`, title: d }));
    const section = {
      ...ai,
      customerCitations: you.ai,
      rows: SEARCHES.map((search, i) => ({ ...ai.rows[0]!, question: { ...ai.rows[0]!.question, n: i + 1, search } })),
      rivals: domains.map((domain) => ({ domain, cells: SEARCHES.map((_, i) => (found[domain]!.ai?.includes(i) ? { ...answered, citedDomains: [domain] } : answered)) })),
    };
    const card = {
      ...presence,
      you: { ...presence.you, top10Count: you.google },
      rivals: domains.map((domain) => ({ domain, top10Count: SEARCHES.filter((_, i) => found[domain]!.top?.includes(i) || found[domain]!.pack?.includes(i)).length })),
    };
    const serps: StoredReport["serps"] = SEARCHES.map((_, i) => ({
      kind: "measured",
      at: new Date("2026-10-31T09:00:00.000Z"),
      value: { organic: on(i, "top"), localPack: on(i, "pack"), aiOverview: { present: true, asynchronousAiOverview: true, referenceDomains: [] } },
    }));
    return [section, card, serps] as const;
  }

  it("one search in both top ten and AI counts once", () => {
    const [a, p, serps] = market({ "rival-a.com": { top: [0, 1], ai: [0, 1] }, "rival-b.com": { top: [0, 1], pack: [2] } });
    expect(buyersOf(a, p, serps).holder).toBe("rival-b.com");
  });

  it("four rivals on one search each name nobody, and the headline says buyers can't find you", () => {
    const [a, p, serps] = market({
      "rival-a.com": { top: [0], ai: [0] },
      "rival-b.com": { top: [1] },
      "rival-c.com": { pack: [2] },
      "rival-d.com": { ai: [3] },
    });
    expect(buyersOf(a, p, serps).holder).toBeNull();
    expect(headlineOf(a, p, serps)?.title).toBe(copy("report.top.title.none"));
  });

  it("a rival on two searches is named, and only above the customer's own count", () => {
    const found = { "rival-a.com": { top: [0], ai: [1] }, "rival-b.com": { top: [2] } };
    expect(buyersOf(...market(found)).holder).toBe("rival-a.com");
    expect(buyersOf(...market(found, { ai: 1, google: 1 })).holder).toBeNull();
  });
});

describe("the customer panel's stored reports, a SaaS and a local business", () => {
  it("the customer found at least as often as every competitor leads, and is never told buyers can't find it", () => {
    for (const [walk, domain, n, m] of [
      ["2026-10-15-1441-after", "austinplumbery.com", "4", "6"],
      ["2026-10-15", "alexander.co.uk", "5", "9"],
    ] as const) {
      const report = walkReport(walk, domain);
      expect(buyersOf(report.aiAnswers!, report.presence!, report.serps).holder, domain).toBeNull();
      const lines = shown(report);
      expectInOrder(lines, [copy("report.top.title.you-lead"), copy("report.top.line", { n, m }), copy("verdict.score.label")]);
      expect(at(lines, copy("report.top.title.none")), domain).toBe(-1);
    }
  });

  it("draws no headline where both panels measured nothing", () => {
    for (const domain of ["ifleeds.com", "flintplumb.com"]) {
      const report = walkReport("2026-10-15-1441-after", domain);
      expect(buyersOf(report.aiAnswers!, report.presence!, report.serps).out, domain).toBe(0);
      const html = renderReport(report);
      expect(html, domain).toContain(`id="buyers-h"`);
      expect(html, domain).not.toContain(copy("report.top.title.none"));
    }
  });

  it("quotes the AI answer in plain words, without its markdown marks", () => {
    const report = panelReport("saas");
    expect(answerQuoteOf(report.aiAnswers!, report.serps)?.text).toBe(
      "Scheduling software helps you manage calendars, meetings, employee shifts, or project timelines."
    );
  });

  // The SaaS's leader is on three searches; every local rival is on one, its top ten and AI answer counted once.
  for (const [which, title] of [
    ["saas", copy("report.top.title", { holder: "calendly.com" })],
    ["local", copy("report.top.title.none")],
  ] as const) {
    it(`${which}: the head, the headline and who gets your buyers draw from what was stored`, () => {
      const report = panelReport(which);
      const lines = shown(report);
      expectInOrder(lines, [
        copy("report.read.as.title"),
        copy("verdict.not-your-market"),
        title,
        copy("report.top.offer", { count: String(report.freePage!.totalPages) }),
        copy("verdict.score.label"),
        copy("report.buyers.title"),
        copy("ai-answers.title"),
        copy("presence.title"),
      ]);
    });
  }
});

describe("who buyers see is read off each result's own site", () => {
  const stored = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../market/rivals/fixtures/au-baker-d149c119.json"), "utf8")) as { organic: SerpResult["organic"] };
  const behindGoogle = { position: 2, domain: "google.com", url: "https://google.com/goto?url=https://www.brumbys.com.au/", title: "Brumby's Bakeries" };
  const baker = measured<SerpResult>({ organic: [stored.organic[0]!, behindGoogle, ...stored.organic.slice(2)], aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] } }, FIXTURE_REPORT.verdict.measuredAt);
  const rival = (domain: string) => ({ ...presence.rivals[0]!, domain });

  it("the AU baker top ten (d149c119): a rival behind a redirect is shown for baker, and google.com never is", () => {
    const buyers = buyersOf(
      { ...ai, rivals: [], customerCitations: 0 },
      { ...presence, you: { ...presence.you, top10Count: 0 }, rivals: [rival("google.com"), rival("brumbys.com.au")] },
      [baker, baker]
    );
    expect(buyers.holder).toBe("brumbys.com.au");
  });
});
