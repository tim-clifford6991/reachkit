// Board PubReport, the report's lower half: the offer to the consent line, in
// the board's order and words, on the customer panel's stored reports (0¢).
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { copy } from "@/lib/presentation/copy";
import { measured, measuredZero } from "@/lib/measure/measured";
import { CheckCards } from "@/app/(public)/scan/[domain]/_problems/cards";
import { checkCardsOf } from "@/app/(public)/scan/[domain]/_problems/checks";
import { FIXTURE_DEGRADED_REPORT, FIXTURE_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";
import { panelReport, renderReport } from "./panel-report";

/** The visible text, one space between blocks, entities read back. */
function text(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

/** Each line's place in `page`, failing on the first one that is absent or out of order. */
function expectInOrder(page: string, lines: readonly string[]): void {
  let from = 0;
  for (const line of lines) {
    const at = page.indexOf(line, from);
    expect(at, `"${line}" after position ${from}`).toBeGreaterThanOrEqual(0);
    from = at + line.length;
  }
}

describe.each(["saas", "local"] as const)("the %s panel report, offer to consent line", (which) => {
  const report = panelReport(which);
  const html = renderReport(report);
  const page = text(html);

  it("names the pages found, then offers to write them, as the board's offer card", () => {
    expectInOrder(page, [
      copy("report.offer.found", { count: String(report.freePage!.totalPages) }),
      "Let ReachKit write the missing pages",
      "ReachKit writes them from facts on your own site and publishes up to 7 a week, on autopilot.",
      "1 You’ve scanned",
      "2 We choose and write",
      "3 You see progress every Monday",
      "Written from facts on your own site",
      "Up to ",
      " checks",
      "Edit or stop any page",
      "Live on your website by itself",
      "Up to 7 pages a week for your site, new or updated",
      "Your market and your pages checked every Monday",
      "What moved, in your inbox every Monday",
      "Every page goes live on its own after 24 hours. You can edit or stop it before then.",
      "Your part: about 10 minutes, once.",
      "What you do",
      "€49",
      "per month, VAT included",
      "Billed in euros. €49 is the total, wherever you are.",
      "Start ReachKit €49",
      "Cancel any time from Settings. No account before payment.",
      "Not ready? Get your first page free ↓",
      "Everything else in your report · open any",
      "What holds you back",
      "The complete method, free",
      "How to do it all yourself, step by step",
      "Where should we send it?",
      "Email me the full page",
      "We’ll email this page, then up to 3 short notes about your report. Unsubscribe in one click.",
    ]);
    expect(html).toContain('href="/how-it-works#you-do"');
    expect(page).not.toContain("cancel any time, yourself");
    // The guarantee waits for the launch gate (owner 2026-10-20, Q13).
    expect(page).not.toMatch(/money-back/i);
  });

  it("says what holds the site back in plain words, and the method without jargon", () => {
    expect(page).toContain("AI shut out of your site");
    for (const name of ["No page list for Google", "Links between pages that go nowhere", "Business details Google can read"]) {
      expect(page).toContain(name);
    }
    for (const old of ["AI readers blocked", "No sitemap", "Broken internal links", "Missing structured data", "GEO", "Unblock the AI readers"]) {
      expect(page).not.toContain(old);
    }
    expectInOrder(page, ["Let AI in", "Write the missing pages", "Make pages AI can answer from"]);
    // The method is closed under its own name, like the sections around it.
    expect(html).toMatch(/<details id="method"[^>]*><summary/);
  });

  it("asks for an address on a reserved example domain", () => {
    expect(html).toContain('placeholder="you@yourdomain.example"');
  });
});

describe("a site that turns AI readers away", () => {
  it("is told so in the board's plain cause line", () => {
    const page = text(renderReport(FIXTURE_REPORT));
    expectInOrder(page, [
      "AI shut out of your site",
      "AI can’t use a page it is turned away from, or a page that tells Google and AI not to use it.",
    ]);
  });
});

describe("each check row says its status in a word", () => {
  const at = new Date("2026-10-20T09:00:00.000Z");
  const page = text(
    renderToStaticMarkup(
      <CheckCards
        cards={checkCardsOf({
          page_titles: { count: measured(3, at), severity: measured("mid", at) },
          noindex_pages: { count: measuredZero(0, at), severity: measured("low", at) },
        })}
      />
    )
  );

  it("a count, Nothing to fix on a zero, Couldn't run where no reading came back", () => {
    expectInOrder(page, ["Missing or duplicate titles 3", "Pages hidden from search Nothing to fix", "No page list for Google Couldn’t run"]);
    expect(page).toContain("Business details Google can read Couldn’t run");
  });
});

describe("a report with no missing pages measured", () => {
  const page = text(renderReport(FIXTURE_DEGRADED_REPORT));

  it("keeps the offer's own heading and no free path, since there is no page to send", () => {
    expect(page).toContain(copy("offer.close.heading"));
    expect(page).not.toContain("Let ReachKit write the missing pages");
    expect(page).not.toContain(copy("report.offer.free-path"));
  });
});
