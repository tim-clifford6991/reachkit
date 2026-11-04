// A stored report whose market was withdrawn still holds the searches,
// answers and rivals bought under it. The report draws none of them, and
// shows the not-measured cards instead; a market read from search keeps both.
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { measured, unmeasured } from "@/lib/measure/measured";
import type { StoredReport } from "@/lib/scan/report";
import { ReportView } from "@/app/(public)/scan/[domain]/_address/report-view";
import type { AddressNotice } from "@/app/(public)/scan/[domain]/_address/state";
import { cardsOf } from "@/app/(public)/scan/[domain]/_problems/model";
import { FIXTURE_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";

const AT = new Date("2026-11-03T00:00:00.000Z");
const SLOT = "\u0001";

/** A sentence's fixed words, each part long enough to mean only that sentence. */
function words(key: CopyKey, slots: readonly string[] = []): string[] {
  return copy(key, Object.fromEntries(slots.map((slot) => [slot, SLOT])))
    .split(SLOT)
    .map((part) => part.trim())
    .filter((part) => part.length >= 8);
}

/** Every line on the report that only a market's searches can say. */
const MARKET_LINES = [
  ...words("ai-answers.source", ["total", "answered"]),
  ...words("report.ai.asked", ["total"]),
  ...words("report.google.waffle", ["leader", "x", "total", "you"]),
  ...words("report.google.waffle.you-lead", ["you", "total"]),
  ...words("presence.absent-from.title"),
  ...words("presence.absent-from.empty"),
  ...words("report.measurement.in", ["country", "language"]),
  ...words("report.measurement"),
];

function render(report: StoredReport, notice: AddressNotice | null = null): string {
  return renderToStaticMarkup(
    <ReportView state={{ report, notice, control: { kind: "none" }, correction: { offered: true, as: "first" } }} />
  );
}

/** What the stored blob measured in its market: the searches, the questions and the rivals. */
function measuredIn(report: StoredReport): string[] {
  return [
    ...(report.presence?.absentFrom.map((row) => row.keyword) ?? []),
    ...(report.aiAnswers?.rows.map((row) => row.question.wording.text) ?? []),
    ...(report.rivals.kind === "unmeasured" ? [] : report.rivals.value.map((rival) => rival.domain)),
  ];
}

const withdrawn = (report: StoredReport, because: string): StoredReport => ({ ...report, market: unmeasured("undeterminable", AT, because), freePage: null });
const fromSearch = (report: StoredReport): StoredReport => ({ ...report, marketFrom: "search" });

/** A blob measured in a market of its own, cut off by the time ceiling, outside the US. */
const MEASURED: StoredReport = { ...FIXTURE_REPORT, locale: { country: "GB", language: "en" }, stoppedReason: "time_ceiling" };

/** A pass that asked no search: the blob's sections are there and hold zeros. */
const ASKED_NONE: StoredReport = {
  ...FIXTURE_REPORT,
  questions: measured([], AT),
  rivals: measured([], AT),
  serps: [],
  aiAnswers: { ...FIXTURE_REPORT.aiAnswers!, measuredSearches: 0, answeredSearches: 0, customerCitations: 0, rivals: [], rows: [] },
  presence: { measuredSearches: 0, you: { domain: FIXTURE_REPORT.domain, top10Count: 0 }, rivals: [], absentFrom: [], framing: "suppressed_no_rivals" },
};

describe("a report whose market was withdrawn draws nothing measured in it", () => {
  it("behind bot protection: no search, question, rival or first-page count, and the not-measured cards", () => {
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    try {
      const control = render(fromSearch(MEASURED));
      const html = render(withdrawn(MEASURED, "bot_protection"), { kind: "bot_protected" });
      const drawn = measuredIn(MEASURED);
      expect(drawn.length).toBeGreaterThan(0);
      for (const line of [...drawn, ...words("ai-answers.source", ["total", "answered"]), ...words("report.measurement.in", ["country", "language"])]) {
        expect(control).toContain(line);
      }
      expect(control).toContain('data-testid="report-top-offer"');

      for (const line of [...drawn, ...MARKET_LINES]) expect(html).not.toContain(line);
      expect(html).not.toMatch(/\b0 buyer searches/);
      expect(html).not.toContain('data-testid="report-top-offer"');
      expect(html).not.toContain(copy("report.missing.title"));
      expect(html).toContain(copy("ai-answers.absent"));
      expect(html).toContain(copy("presence.absent"));
      // The re-scan answers it; no part is retried in a market that does not stand.
      expect(html).toContain(copy("control.rescan-incomplete"));
      expect(html).not.toContain(copy("control.retry-part"));
      // What does not hang on the market stays.
      expect(html).toContain(copy("notice.bot-protected"));
      const cards = cardsOf(withdrawn(MEASURED, "bot_protection"), []);
      expect(cards.find((card) => card.problem === "missing_pages")?.count.kind).toBe("unmeasured");
      expect(cards.find((card) => card.problem === "blocked_readers")?.count.kind).toBe("measured");
      expect(fetched).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("off a home page with no words, over a pass that asked nothing: no zero drawn as a measurement", () => {
    const control = render(fromSearch(ASKED_NONE));
    expect(control).toContain(copy("presence.absent-from.empty"));
    expect(control).toContain(copy("ai-answers.source", { total: "0", answered: "0" }).split(" 0 ")[0]);

    const html = render(withdrawn(ASKED_NONE, "home_wordless"));
    for (const line of MARKET_LINES) expect(html).not.toContain(line);
    expect(html).not.toMatch(/\b0 buyer searches/);
    expect(html).toContain(copy("ai-answers.absent"));
    expect(html).toContain(copy("presence.absent"));
  });

  it("a market read from the search listing keeps both cards", () => {
    const html = render(fromSearch(FIXTURE_REPORT));
    expect(html).not.toContain(copy("ai-answers.absent"));
    expect(html).not.toContain(copy("presence.absent"));
    for (const line of measuredIn(FIXTURE_REPORT)) expect(html).toContain(line);
  });
});
