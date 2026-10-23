/** @vitest-environment jsdom */
// tests/app/overview/done.test.tsx — SPEC §4 (2026-10-10), issue 1395: the
// process under Settings › Market. Every figure is the stored one, and one
// nobody has read yet says so.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { COPY } from "@/lib/presentation/copy";
import { ProcessTimeline } from "@/app/(account)/app/_shell/ProcessTimeline";
import { processSteps, type DoneFacts } from "@/app/(account)/app/_overview/done";

const MONDAY = new Date(Date.UTC(2026, 9, 5, 4, 0, 0));

/** A SaaS site in a full week: every step ran. */
const SAAS: DoneFacts = {
  checks: 19,
  lastMeasured: { searches: 12, questions: 25, engines: ["ai_mode", "chatgpt"], at: MONDAY },
  rivals: 5,
  ready: 30,
  pagesRead: 84,
  publishTime: "07:00",
  remeasureOn: new Date(Date.UTC(2026, 9, 12, 12, 0, 0)),
};

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
