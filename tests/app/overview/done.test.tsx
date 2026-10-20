/** @vitest-environment jsdom */
// tests/app/overview/done.test.tsx — SPEC §4 (2026-10-10), issue 1395: what
// ReachKit did this week, and the process.
//
// What a customer can observe: every figure on a line is the stored one, a
// step that did not run says so, a count that could not be read draws no
// line, and the same lines hold for a cafe, a SaaS site and a site that is
// not in English.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { COPY } from "@/lib/presentation/copy";
import { DoneThisWeek } from "@/app/(account)/app/_overview/DoneThisWeek";
import { ProcessTimeline } from "@/app/(account)/app/_shell/ProcessTimeline";
import { doneLines, processSteps, type DoneFacts } from "@/app/(account)/app/_overview/done";

const MONDAY = new Date(Date.UTC(2026, 9, 5, 4, 0, 0));

/** A SaaS site in a full week: every step ran. */
const SAAS: DoneFacts = {
  checks: 19,
  measured: { searches: 12, questions: 25, engines: ["ai_mode", "chatgpt"], at: MONDAY },
  lastMeasured: { searches: 12, questions: 25, engines: ["ai_mode", "chatgpt"], at: MONDAY },
  rivals: 5,
  wrote: { pages: 5, fresh: 4, updated: 1, held: 0 },
  published: 4,
  nextLiveAt: new Date(Date.UTC(2026, 9, 9, 5, 0, 0)),
  setAside: { covered: 3, tooHard: 4, lowFit: 0, resting: 0 },
  ready: 30,
  pagesRead: 84,
  publishTime: "07:00",
  remeasureOn: new Date(Date.UTC(2026, 9, 12, 12, 0, 0)),
};

/** A cafe in its first days: the pass asked no AI prompts and nothing has
 *  been written or published yet. */
const CAFE: DoneFacts = {
  checks: 19,
  measured: { searches: 7, questions: 0, engines: [], at: MONDAY },
  rivals: 3,
  wrote: { pages: 0, fresh: 0, updated: 0, held: null },
  published: 0,
  nextLiveAt: null,
  setAside: { covered: 0, tooHard: 0, lowFit: 0, resting: 0 },
};

/** A German bakery whose week has had no pass. */
const BAKERY: DoneFacts = { ...SAAS, measured: null, rivals: null };

function week(facts: DoneFacts, timeZone = "Europe/Berlin"): string {
  return renderToStaticMarkup(<DoneThisWeek facts={facts} timeZone={timeZone} />);
}

describe("this week's lines state the stored figures", () => {
  it("a full week names the searches, the questions, the engines and the hour of the pass", () => {
    const html = week(SAAS);
    expect(html).toContain("Measured 12 searches in Google and 25 AI questions");
    expect(html).toContain(`${COPY["ai-answers.engine.ai-mode"]} + ${COPY["ai-answers.engine.chatgpt"]}`);
    // The line claims no run count: branded and unbranded prompts are asked a different number of times.
    expect(html).not.toContain("each asked");
    // 04:00 UTC on a Monday is 06:00 in Berlin.
    expect(html).toContain("Mon 6:00 AM");
    expect(html).toContain("Pages written: 5 · 4 new, 1 updated · all passed 19 checks");
    expect(html).toContain("Pages published: 4 · the next goes live Fri 7:00 AM");
    expect(html).toContain("Topics set aside: 7");
  });

  it("each line opens one closed note", () => {
    const html = week(SAAS);
    expect(html.split("<details").length - 1).toBe(doneLines(SAAS).length);
    expect(html).not.toContain("<details open");
  });

  it("a page a check held is counted, never called passed", () => {
    const html = week({ ...SAAS, wrote: { pages: 5, fresh: 5, updated: 0, held: 2 } });
    expect(html).toContain("2 held by a check");
    expect(html).not.toContain("all passed");
  });

  it("a page with no record of its checks says nothing about them", () => {
    const html = week({ ...SAAS, wrote: { pages: 5, fresh: 5, updated: 0, held: null } });
    expect(html).toContain("Pages written: 5");
    expect(html).not.toContain("all passed");
    expect(html).not.toContain("held by a check");
  });
});

describe("a step that did not run says so, and nothing is invented", () => {
  it("a week with no pass reads not measured this week", () => {
    const html = week(BAKERY);
    expect(html).toContain(COPY["overview.done.measured.none"]);
    expect(html).toContain(COPY["overview.done.rivals.none"]);
    expect(html).toContain('data-testid="overview-done-measured" data-ran="false"');
    expect(html).not.toContain("Measured ");
  });

  it("a pass that asked no AI question names the searches alone", () => {
    const html = week(CAFE, "Europe/London");
    expect(html).toContain("Measured 7 searches in Google");
    expect(html).not.toContain("AI questions (");
    expect(html).toContain(COPY["overview.done.wrote.none"]);
    expect(html).toContain(COPY["overview.done.published.none"]);
    // Nothing set aside: no line, never "0 topics".
    expect(html).not.toContain('data-testid="overview-done-set-aside"');
  });

  it("a count that could not be read draws no line", () => {
    expect(doneLines({ checks: 19 })).toEqual([]);
    expect(week({ checks: 19 })).toBe("");
  });

  it("keeps costs, vendors and rule ids off the screen", () => {
    const html = week(SAAS) + week(CAFE) + week(BAKERY);
    expect(html).not.toMatch(/DataForSEO|¢|€|\bD\d{2}\b|#\d{3,}|TODO\(copy\)/);
  });
});

describe("the process", () => {
  function timeline(facts: DoneFacts): string {
    return renderToStaticMarkup(<ProcessTimeline facts={facts} timeZone="Europe/Berlin" />);
  }

  it("is eight steps, each figure the site's own and linked to its screen", () => {
    const html = timeline(SAAS);
    expect(processSteps(SAAS)).toHaveLength(8);
    for (const [figure, href] of [
      ["Pages read: 84", "/app/settings"],
      ["Searches: 12", "/app/search"],
      ["AI questions: 25", "/app/ai-answers"],
      ["Competitors tracked: 5", "/app/rivals"],
      ["Topics ready: 30", "/app/calendar"],
      ["Daily at 7:00 AM", "/app/settings/publishing"],
    ] as const) {
      expect(html).toContain(`href="${href}">${figure}</a>`);
    }
    expect(html).toContain("Checks: 19");
    expect(html).not.toContain(COPY["overview.process.pending"]);
  });

  it("a figure nobody has read yet says so", () => {
    const html = timeline({ checks: 19 });
    for (const step of ["read", "measure", "rivals", "pick"]) {
      expect(html).toContain(`data-testid="process-pending-${step}"`);
    }
    expect(html).not.toContain("Pages read");
  });
});
