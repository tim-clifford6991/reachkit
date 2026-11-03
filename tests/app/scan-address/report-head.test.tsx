// Board PubReport, the top half: the head, what we read you as, the headline
// of who gets your buyers (owner 2026-11-03), the biggest gap, the score card, and
// the AI and Google panels, in the board's order and words. Against the real
// registry, on the reserved-name fixture and the customer panel's stored
// reports (a SaaS and a local business). 0¢: nothing is measured.
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";
import { measured } from "@/lib/measure/measured";
import type { SerpResult } from "@/lib/vendors/dataforseo/types";
import { copy } from "@/lib/presentation/copy";
import { FIXTURE_COLD_START_REPORT, FIXTURE_DEGRADED_REPORT, FIXTURE_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";
import { answerQuoteOf } from "@/app/(public)/scan/[domain]/_modules/ai-answers";
import { buyersOf, headlineOf } from "@/app/(public)/scan/[domain]/_modules/buyers";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";
import { shownView } from "@/lib/scan/shown-report";
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
/** A top line with its breakdown, the one count explained once. */
type TopKey = "report.top.line" | "report.top.line.one" | "report.top.line.you-lead" | "report.top.line.none";
const top = (key: TopKey, slots: Record<string, string>): string => copy(key, { ...slots, split: copy("report.top.split", slots) });
/** The fixture's one count over both cards: 1 of 12 Google searches plus 3 of the 9 answers the AI gave. */
const TOP = top("report.top.line", { category: "product analytics", rival: "rival-one.example.net", n: "4", m: "21", g: "1", gTotal: "12", a: "3", aTotal: "9" });

describe("the head reads as the board: domain, where it was measured, what we read, the headline, the gap, the score", () => {
  const lines = shown(FIXTURE_REPORT);

  it("names the domain, says where it was measured in one line, and that the report is independent", () => {
    expectInOrder(lines, [
      copy("report.eyebrow"),
      "example.com",
      // The kind leads the line (board PubReport v36); its date is written as every public page writes one.
      `${copy("report.measured-at", { date: "5 Sep 2026", what: copy("report.read.as.kind.software") })} ${copy("report.measurement")}`,
      copy("report.independent", { company: "example" }),
    ]);
  });

  it("says what we read you as, with the market's language and country, and offers the correction once", () => {
    expectInOrder(lines, [
      copy("report.read.as.title"),
      copy("report.read.as.what", { kind: copy("report.read.as.kind.software"), category: "product analytics" }),
      "product teams",
      copy("report.read.as.locale", { language: "English", country: "United States" }),
      copy("verdict.not-your-market"),
    ]);
    const head = lines.slice(0, at(lines, copy("verdict.score.label")));
    expect(head.filter((line) => line === copy("verdict.not-your-market"))).toHaveLength(1);
  });

  it("leads with three lines, the score, who gets the buyers over one count, and the questions found, before the gap and the score ring", () => {
    expectInOrder(lines, [
      copy("verdict.not-your-market"),
      copy("report.top.title", { domain: "example.com", score: "31", verdict: "hard to find" }),
      TOP,
      copy("report.top.offer", { count: "7" }),
      copy("report.offer.free-path"),
      copy("verdict.limiting.answerability"),
      copy("verdict.score.label"),
      copy("report.buyers.title"),
    ]);
    const html = renderReport(FIXTURE_REPORT);
    expect(html.indexOf('data-testid="report-top"')).toBeLessThan(html.indexOf("radial-progress"));
    expect(html).toMatch(/<a href="#first-page"[^>]*data-testid="report-top-free">/);
    // The domain and the rival are set in mono.
    const top = parse(html).querySelector('[data-testid="report-top"]')!;
    expect(top.querySelectorAll(".num").map((el) => el.text)).toEqual(["example.com", "rival-one.example.net"]);
  });

  it("the one denominator is explained once, and no line names an AI the free scan did not ask", () => {
    expect(TOP).toBe("Buyers who ask Google or its AI about product analytics are sent to rival-one.example.net most. You came up in 4 of 21: 1 of 12 Google searches, 3 of 9 AI answers.");
    expect(lines.filter((line) => line.includes(" of 21"))).toEqual([TOP]);
    for (const report of [FIXTURE_REPORT, FIXTURE_COLD_START_REPORT, panelReport("saas"), panelReport("local")]) {
      expect(renderReport(report)).not.toContain(copy("ai-answers.engine.chatgpt"));
    }
  });

  it("a report with no first page offers the questions without the button", () => {
    const html = renderReport({ ...FIXTURE_REPORT, freePage: null });
    expect(segments(html)).toContain(copy("report.top.offer", { count: "7" }));
    expect(html).not.toContain('data-testid="report-top-free"');
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
    expect(lines.filter((line) => line === TOP)).toHaveLength(1);
  });

  it("the AI panel: the figure, what it counts, the waffle, one answer quoted as written, the questions", () => {
    expectInOrder(lines, [
      copy("report.buyers.title"),
      copy("ai-answers.title"),
      `${copy("report.figure.of", { count: "3", total: "9" })} ${copy("ai-answers.finding")}`,
      copy("ai-answers.source", { total: "12", answered: "9" }),
      // Each card names its own leader.
      copy("report.ai.waffle", { leader: "rival-one.example.net", x: "6", total: "9", you: "3" }),
      copy("report.ai.quote", { search: "product analytics tools" }),
      // One sentence, as written, never the whole answer, inside its quotation marks.
      copy("report.ai.quote.said", { quote: "For a small team, many start with Rival One or Rival Two, which need no data warehouse." }),
      copy("report.ai.asked", { total: "12" }),
    ]);
  });

  it("the Google panel: the figure, its source, the waffle, the biggest search, and the searches you're missing", () => {
    const start = at(lines, copy("report.ai.asked", { total: "12" }));
    expectInOrder(lines.slice(start), [
      copy("presence.title"),
      `${copy("report.figure.of", { count: "1", total: "12" })} ${copy("presence.finding")}`,
      copy("presence.source", { measured: "12" }),
      copy("report.google.waffle", { leader: "rival-one.example.net", x: "10", total: "12", you: "1" }),
      copy("report.google.most", { search: "product analytics tools", volume: "8,100", holder: "rival-one.example.net" }),
      `${copy("presence.absent-from.title")} 5`,
      copy("presence.absent-from.column.search"),
      copy("presence.absent-from.column.volume"),
      copy("presence.absent-from.column.holder"),
    ]);
    // The first on Google is a domain: mono, broken anywhere, never at its hyphen in the UI face.
    const holder = parse(renderReport(FIXTURE_REPORT)).querySelector('[data-testid="presence-most-holder"]')!;
    expect([holder.text, holder.classList.contains("font-mono"), holder.classList.contains("break-all")]).toEqual(["rival-one.example.net", true, true]);
  });

  it("each waffle row is named and tallied, the customer's last and marked as theirs", () => {
    const html = renderReport(FIXTURE_REPORT);
    const waffle = html.slice(html.indexOf('data-testid="presence-waffle"'));
    const rows = [...waffle.matchAll(/role="rowheader"[^>]*>([\s\S]*?)<\/span><div/g)].map((m) => m[1]!.replace(/<[^>]+>/g, " ").trim());
    const tallies = [...waffle.matchAll(/<span class="text-sm font-bold tabular-nums">(\d+)<\/span>/g)].map((m) => m[1]);
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
    expect(answerQuoteOf(ai, [long, kept("Short and true. Then more.")])).toEqual({ search: ai.rows[1]!.question.search, text: "Short and true.", bold: [] });
  });

  it("a word that starts with a mark keeps its space, and its dot does not end the sentence", () => {
    expect(answerQuoteOf(ai, [kept("Teams build on .NET and Azure. Then more.")])?.text).toBe("Teams build on .NET and Azure.");
    expect(answerQuoteOf(ai, [kept("Pick a .io domain.")])?.text).toBe("Pick a .io domain.");
  });

  it("a space before a closing mark and the markdown marks are still removed", () => {
    expect(answerQuoteOf(ai, [kept("**Acme** , the `leader` . Then more.")])?.text).toBe("Acme, the leader.");
  });

  it("the names the answer itself set in bold are drawn bold, and only those in the quoted sentence (board PubReport v36)", () => {
    expect(answerQuoteOf(ai, [kept("Many start with **Acme** or **Beta**. Then **Gamma**.")])?.bold).toEqual(["Acme", "Beta"]);
    const quote = parse(renderReport(FIXTURE_REPORT)).querySelector('[data-testid="ai-answers-quote"] blockquote')!;
    expect(quote.querySelectorAll("strong").map((s) => s.text)).toEqual(["Rival One", "Rival Two"]);
    expect(quote.text).not.toContain("*");
  });

  it("nobody found and the customer at zero: buyers can't find you yet, before the score", () => {
    const b = buyersOf(FIXTURE_COLD_START_REPORT.aiAnswers!, FIXTURE_COLD_START_REPORT.presence!, FIXTURE_COLD_START_REPORT.serps);
    expect(b).toMatchObject({ holder: null, ai: 0, google: 0 });
    expectInOrder(shown(FIXTURE_COLD_START_REPORT), [
      copy("report.top.title", { domain: "example.com", score: "8", verdict: "invisible" }),
      top("report.top.line.none", { category: "invoicing software", m: String(b.out), g: "0", gTotal: "12", a: "0", aTotal: "9" }),
      copy("verdict.score.label"),
    ]);
  });

  it("a panel not measured: no buyers line, so no count is summed over the missing half or shown as 0", () => {
    expect(headlineOf(FIXTURE_DEGRADED_REPORT).line).toBeNull();
    expect(headlineOf({ ...FIXTURE_REPORT, presence: null }).line).toBeNull();
    expect(at(shown(FIXTURE_DEGRADED_REPORT), copy("report.buyers.title"))).toBeGreaterThan(-1);
    expect(renderReport(FIXTURE_DEGRADED_REPORT)).not.toContain('data-testid="report-top-line"');
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
    expect(headlineOf({ ...FIXTURE_REPORT, aiAnswers: a, presence: p, serps }).line?.sentence).toBe(
      top("report.top.line.none", { category: "product analytics", m: "21", g: "0", gTotal: "12", a: "0", aTotal: "9" })
    );
  });

  it("a rival on two searches is named, and only above the customer's own count", () => {
    const found = { "rival-a.com": { top: [0], ai: [1] }, "rival-b.com": { top: [2] } };
    expect(buyersOf(...market(found)).holder).toBe("rival-a.com");
    expect(buyersOf(...market(found, { ai: 1, google: 1 })).holder).toBeNull();
  });
});

describe("the customer panel's stored reports, a SaaS and a local business", () => {
  it("the customer found at least as often as every competitor leads, and is never told buyers can't find it", () => {
    for (const [walk, domain, slots] of [
      ["2026-10-15-1441-after", "austinplumbery.com", { category: "plumbing services", n: "4", m: "6", g: "4", gTotal: "4", a: "0", aTotal: "2" }],
      ["2026-10-15", "alexander.co.uk", { category: "accountants and tax advisors", n: "5", m: "9", g: "3", gTotal: "5", a: "2", aTotal: "4" }],
    ] as const) {
      const report = walkReport(walk, domain);
      expect(buyersOf(report.aiAnswers!, report.presence!, report.serps).holder, domain).toBeNull();
      expectInOrder(shown(report), [top("report.top.line.you-lead", slots), copy("verdict.score.label")]);
    }
  });

  it("draws no headline where both panels measured nothing", () => {
    for (const domain of ["ifleeds.com", "flintplumb.com"]) {
      const report = walkReport("2026-10-15-1441-after", domain);
      expect(buyersOf(report.aiAnswers!, report.presence!, report.serps).out, domain).toBe(0);
      const html = renderReport(report);
      expect(html, domain).toContain(`id="buyers-h"`);
      expect(html, domain).not.toContain('data-testid="report-top-line"');
    }
  });

  it("quotes the AI answer in plain words, without its markdown marks", () => {
    const report = panelReport("saas");
    expect(answerQuoteOf(report.aiAnswers!, report.serps)?.text).toBe(
      "Scheduling software helps you manage calendars, meetings, employee shifts, or project timelines."
    );
  });

  // The SaaS's leader is on three searches; every local rival is on one, its top ten and AI answer counted once.
  for (const [which, line] of [
    ["saas", top("report.top.line", { category: "scheduling software", rival: "calendly.com", n: "0", m: "9", g: "0", gTotal: "5", a: "0", aTotal: "4" })],
    ["local", top("report.top.line.none", { category: "plumbing services", m: "9", g: "0", gTotal: "7", a: "0", aTotal: "2" })],
  ] as const) {
    it(`${which}: the head, the headline and who gets your buyers draw from what was stored`, () => {
      const report = panelReport(which);
      const lines = shown(report);
      expectInOrder(lines, [
        copy("report.read.as.title"),
        copy("verdict.not-your-market"),
        line,
        copy("report.top.offer", { count: String(report.freePage!.totalPages) }),
        copy("report.offer.free-path"),
        copy("verdict.score.label"),
        copy("report.buyers.title"),
        copy("ai-answers.title"),
        copy("presence.title"),
      ]);
    });
  }
});

describe("Site fixes lists only what needs work (owner 2026-11-03)", () => {
  const holds = (report: StoredReport) => parse(renderReport(report)).querySelector("#holds");

  it("a measured zero draws no card, and only a found problem carries its fix chip", () => {
    const fixes = holds(panelReport("saas"))!;
    const cards = fixes.querySelectorAll("a.card");
    expect(cards.map((card) => card.querySelector("h3")!.text)).toEqual([copy("problem.missing-pages.title"), copy("problem.unquotable-pages.title")]);
    expect(cards.map((card) => card.querySelectorAll(".badge-primary").map((badge) => badge.text))).toEqual([[copy("problem.missing-pages.doer")], []]);
    expect(fixes.querySelector("summary")!.text).toContain(copy("problem.section.sub", { problems: "2", checks: "2" }));
  });

  it("a half with nothing to list is left out of the count, never said as zero", () => {
    expect(holds(FIXTURE_COLD_START_REPORT)!.querySelector("summary")!.text).toContain(copy("problem.section.sub.checks", { checks: "8" }));
    expect(holds(walkReport("2026-10-15", "alexander.co.uk"))!.querySelector("summary")!.text).toContain(copy("problem.section.sub.problems", { problems: "2" }));
  });
});

it("the cached view-model draws the same page as the stored report", () => {
  for (const report of [FIXTURE_REPORT, panelReport("saas"), panelReport("local"), walkReport("2026-10-15", "alexander.co.uk")]) {
    expect(shown(readStoredReport(shownView(report)))).toEqual(shown(report));
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
