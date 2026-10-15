// tests/app/scan-address/report-view.test.tsx
//
// BUILD §4.1 (issue #13), as amended by DECISIONS 2026-09-03. The report
// arm: the verdict strip in both its measured and unmeasured forms, the
// notice's total switch, the control's "exactly one, or none", the six
// modules in order, the absent-section rule, and the two things the owner
// removed on 2026-09-03.
//
// **Rendering convention**: `tests/app/**` runs under Vitest's `node`
// project, so this renders with `react-dom/server`'s
// `renderToStaticMarkup`, the same convention `landing.test.tsx` uses.
//
// **`copy()` is mocked to `(key) => key`.** These suites are about the
// rendered tree — which key a line resolves from, how many controls exist,
// which module is present — and mocking lets them see that without
// depending on the owner's wording either way. Most of this screen's keys
// are `TODO(copy)` today; asserting against the key is what stays true when
// the owner writes the sentence.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("@/lib/presentation/copy", () => ({
  copy: (key: string, vars?: Record<string, string>) =>
    vars === undefined ? key : `${key}(${Object.values(vars).join("|")})`,
}));

// The "still reading" line's leaf asks the router to refresh (issue 1440).
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import { ReportView } from "@/app/(public)/scan/[domain]/_address/report-view";
import ReportLoading from "@/app/(public)/scan/[domain]/loading";
import { RemovalAddressLine, RemovedView } from "@/app/(public)/scan/[domain]/_address/removal";
import {
  FIXTURE_COLD_START_REPORT,
  FIXTURE_DEGRADED_REPORT,
  FIXTURE_REPORT,
} from "@/app/(public)/scan/[domain]/_fixture/states";
import type { AddressControl, AddressNotice } from "@/app/(public)/scan/[domain]/_address/state";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { CorrectionOffer } from "@/lib/market/coherence/offer";
import type { StoredReport } from "@/lib/scan/report";


function render(
  report: StoredReport,
  notice: AddressNotice | null = null,
  control: AddressControl = { kind: "none" },
  correction: CorrectionOffer = { offered: true, as: "first" }
): string {
  return renderToStaticMarkup(
    React.createElement(ReportView, { state: { report, notice, control, correction } })
  );
}

/** Counts non-overlapping occurrences — `String.split` is enough and
 *  cannot be defeated by an overlapping match, since every needle here is
 *  a distinct key. */
function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** Line and block comments removed, so a source assertion measures the
 *  code and not the prose explaining it. Deliberately blunt: it does not
 *  understand a `//` inside a string literal, and none of the files it is
 *  pointed at contains one. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("SPEC §6, D66 (issue 1311) — the report says where it was measured", () => {
  it("a report measured in US Google in English keeps its one measurement line and says nothing more", () => {
    const html = render(FIXTURE_REPORT);
    expect(html).toContain("report.measurement");
    expect(html).not.toContain("report.measurement.in");
    expect(html).not.toContain("report.locale.fell-back");
  });

  it("a German site's report names Germany and German", () => {
    const html = render({ ...FIXTURE_REPORT, locale: { country: "DE", language: "de" } });
    expect(html).toContain("report.measurement.in(Germany|German)");
    expect(html).not.toContain("report.locale.fell-back");
  });

  it("a site in a country and language that are not measured is told so in one line", () => {
    const html = render({ ...FIXTURE_REPORT, locale: { country: "GB", language: "en", fellBack: { country: "FR", language: "fr" } } });
    expect(count(html, "report.locale.fell-back(")).toBe(1);
    expect(html).toContain("report.locale.fell-back(United Kingdom|English|report.locale.site.pair(France|French))");
  });
});

describe("SPEC §2 (issue 1387) — a market read from the site's listing in search says so", () => {
  it("in one line, and only on such a report", () => {
    const blocked = { ...FIXTURE_REPORT, onPage: { kind: "unmeasured", reason: "undeterminable", because: "bot_protection", at: FIXTURE_REPORT.onPage.at } } as StoredReport;
    expect(render(FIXTURE_REPORT)).not.toContain("report.market.from-");
    expect(count(render({ ...blocked, marketFrom: "search" }), "report.market.from-search")).toBe(1);
    expect(render({ ...blocked, marketFrom: "search" })).not.toContain("report.market.from-listing");
  });

  it("where the pages were read and only their profile failed (issue 1450), says only where the market came from", () => {
    const html = render({ ...FIXTURE_REPORT, marketFrom: "search" });
    expect(count(html, "report.market.from-listing")).toBe(1);
    expect(html).not.toContain("report.market.from-search");
  });
});

describe("SPEC §2 (issue 1440) — while the unread searches are read, the report says so briefly", () => {
  it("names how many, in one line, and only while the job's window is open", () => {
    const since = new Date();
    expect(count(render({ ...FIXTURE_REPORT, finishingReads: { searches: 3, since } }), "report.finishing-reads(3)")).toBe(1);
    expect(render({ ...FIXTURE_REPORT, finishingReads: { searches: 1, since } })).toContain("report.finishing-reads.one(1)");
    expect(render(FIXTURE_REPORT)).not.toContain("report.finishing-reads");
    expect(render({ ...FIXTURE_REPORT, finishingReads: null })).not.toContain("report.finishing-reads");
    const lapsed = new Date(Date.now() - 60 * 60 * 1000);
    expect(render({ ...FIXTURE_REPORT, finishingReads: { searches: 3, since: lapsed } })).not.toContain("report.finishing-reads");
  });
});

describe("REQ-004 c1 — the verdict strip names the score, its band, the domain and the date", () => {
  const html = render(FIXTURE_REPORT);

  it("renders the score as a big figure — the UI face at 600, tabular (#1062)", () => {
    expect(html).toContain('class="figure min-w-0">62<');
  });

  it("renders the band as one of the four ruled words, through SCORE_BANDS", () => {
    expect(html).toContain("band.score.findable");
  });

  it("renders the domain and the date beside it, so the score is never a bare specimen", () => {
    // The domain is the card's own head now (UI-SPEC S2: a mono h3), and
    // the date rides with the category on the line under it.
    expect(html).toContain(">example.com<");
    expect(html).toContain("report.measured-at(");
  });

  it("renders the one line naming the limiting factor", () => {
    expect(html).toContain("verdict.limiting.presence");
  });

  it("names the category beside the score", () => {
    expect(html).toContain("product analytics");
  });

  it("says how sure the score is beside it, with its range (issue 1439)", () => {
    expect(html).toContain("verdict.estimate.close(58|66)");
    expect(render(FIXTURE_COLD_START_REPORT)).toContain("verdict.estimate.rough(8|21)");
  });

  it("draws no range where there is no score, nor on a report scored before it", () => {
    expect(render(FIXTURE_DEGRADED_REPORT)).not.toContain("verdict.estimate");
    const older = { ...FIXTURE_REPORT.verdict };
    delete older.estimate;
    expect(render({ ...FIXTURE_REPORT, verdict: older })).not.toContain("verdict.estimate");
  });
});

describe("ruling 1b (2026-09-08) — the driver bars are back, on the header strip and nowhere else", () => {
  const html = render(FIXTURE_REPORT);
  const strip = html.slice(0, html.indexOf("ai-answers.title"));

  it("draws one determinate bar per factor, in the registered component", () => {
    // `components.md` §1: the registered `Progress` "is also the three
    // driver mini-bars of the report's header strip (§4.1); mini-bars are
    // *not* a sixth chart".
    expect(strip.split("<progress").length - 1).toBe(3);
  });

  it("writes each factor's value in tenths beside its own name, never colour-alone", () => {
    // The fixture's three are 70 / 90 / 40, which is what the approved set
    // draws as 7/10, 9/10 and 4/10.
    for (const [name, tenths] of [
      ["verdict.factor.foundations", "7/10"],
      ["verdict.factor.answerability", "9/10"],
      ["verdict.factor.presence", "4/10"],
    ] as const) {
      expect(strip).toContain(name);
      expect(strip).toContain(`>${tenths}<`);
    }
  });

  it("the bar and the label are the same reading — one conversion, not two", () => {
    // A bar drawn from the unrounded 46 under a label reading 5/10 would
    // be two claims about one measurement.
    expect(strip).toContain('value="7" max="10"');
    expect(strip).toContain('value="9" max="10"');
    expect(strip).toContain('value="4" max="10"');
  });

  it("no factor value reaches any other module — the ruling amends the header strip only", () => {
    const below = html.slice(html.indexOf("ai-answers.title"));
    expect(below).not.toContain("/10<");
  });
});

describe("DECISIONS 2026-09-03 — no per-question volume, no market-total footnote", () => {
  const html = render(FIXTURE_REPORT);

  it("the 12-questions list carries no per-question volume", () => {
    // `StoredQuestion` has no `volume` member; the provenance line's slots
    // are the search and the brands, and nothing else.
    const provenance = "ai-answers.question.provenance(";
    expect(html).toContain(provenance);
    const first = html.slice(html.indexOf(provenance));
    const rendered = first.slice(0, first.indexOf(")"));
    expect(rendered.split("|")).toHaveLength(2);
  });

  it("the presence card carries no market-total line", () => {
    expect(html).not.toContain("presence.total");
    expect(html).not.toContain("totalMonthlyVolume");
  });
});

describe("REQ-004 c3 — the unmeasured verdict is a dash, no band, and one line per missing factor", () => {
  const html = render(FIXTURE_DEGRADED_REPORT);

  it("renders the dash in place of the score", () => {
    expect(html).toContain("unmeasured.dash");
  });

  it("renders no band element at all", () => {
    for (const band of ["invisible", "hard-to-find", "findable", "dominant"]) {
      expect(html).not.toContain(`band.score.${band}`);
    }
  });

  it("still names the domain and the date", () => {
    expect(html).toContain("report.measured-at(");
  });

  it("names each missing factor with the reason that applies to it, and no other", () => {
    expect(html).toContain("unmeasured.undeterminable(verdict.factor.foundations)");
    expect(html).toContain("unmeasured.not-attempted(verdict.factor.presence)");
    expect(html).not.toContain("unmeasured.undeterminable(verdict.factor.presence)");
  });

  it("renders no limiting-factor line when the score could not be computed", () => {
    expect(html).not.toContain("verdict.limiting.");
  });
});

describe("REQ-001 c14/c16, REQ-003 c12 — at most one notice, ever", () => {
  const notices: AddressNotice[] = [
    { kind: "incomplete", unmeasured: ["foundations"] },
    { kind: "site_unreadable" },
    { kind: "measurement_failed", failedAt: new Date("2026-09-05T00:00:00.000Z") },
    { kind: "correction_failed" },
    { kind: "refused", refusal: { reason: "network-limit", retryAfterSeconds: 2220 } },
  ];

  it.each(notices.map((n) => [n.kind, n] as const))("%s renders exactly one alert", (_kind, notice) => {
    const html = render(FIXTURE_REPORT, notice);
    expect(count(html, 'role="alert"')).toBe(1);
  });

  it("a pass that could not read the site renders its own line (#479), and no factor list", () => {
    const html = render(FIXTURE_REPORT, { kind: "site_unreadable" });
    expect(count(html, "notice.site-unreadable")).toBe(1);
    expect(html).not.toContain("notice.incomplete");
  });

  // #541: the drivers reach the sentence's own `{what}` slot, all of them.
  // `copy` is mocked to `key(vars)` here, so the slot's contents are
  // readable in the markup: one driver names one, two name both.
  it("the incomplete line names every driver it could not measure (#541)", () => {
    const one = render(FIXTURE_REPORT, { kind: "incomplete", unmeasured: ["presence"] });
    expect(one).toContain("notice.incomplete(verdict.factor.presence)");
    const both = render(FIXTURE_REPORT, {
      kind: "incomplete",
      unmeasured: ["foundations", "presence"],
    });
    expect(both).toContain(
      "notice.incomplete(verdict.factor.foundations, verdict.factor.presence)"
    );
  });

  it("null renders no alert at all", () => {
    const html = render(FIXTURE_REPORT, null);
    expect(count(html, 'role="alert"')).toBe(0);
    // #541: nothing unmeasured, so the sentence is absent — not rendered
    // with an empty slot.
    expect(html).not.toContain("notice.incomplete");
  });

  it("the refusal's wait is whole minutes, from one place", () => {
    const html = render(FIXTURE_REPORT, {
      kind: "refused",
      refusal: { reason: "network-limit", retryAfterSeconds: 2220 },
    });
    expect(html).toContain("report.wait.minutes(37)");
  });
});

describe("REQ-001 c16 — exactly one measurement-starting control, or none", () => {
  const CONTROL_KEYS = [
    "control.rescan-age",
    "control.rescan-incomplete",
    "control.retry",
    "control.correction-retry",
  ];

  /** The three arms that draw a control here. `correction_retry` is the
   *  fourth and draws none — see its own row below. */
  const DRAWN: AddressControl[] = [
    { kind: "rescan", because: "age" },
    { kind: "rescan", because: "incomplete" },
    { kind: "retry" },
  ];

  it.each(DRAWN.map((c) => [`${c.kind}${"because" in c ? `/${c.because}` : ""}`, c] as const))(
    "%s renders exactly one of the four control labels",
    (_name, control) => {
      const html = render(FIXTURE_REPORT, null, control);
      const rendered = CONTROL_KEYS.filter((key) => html.includes(key));
      expect(rendered).toHaveLength(1);
    }
  );

  it.each(DRAWN.map((c) => [`${c.kind}${"because" in c ? `/${c.because}` : ""}`, c] as const))(
    "%s is a control that acts: it posts the domain to the scan API (#935)",
    (_name, control) => {
      // SPEC §1, 2026-09-20: "the report's *Try again*, *Measure what's
      // missing* and its one notice control act or are not drawn." Each of
      // the three was a `<button type="button">` with no handler. The form
      // is the whole control with no JavaScript, so the markup is what
      // proves it acts.
      const html = render(FIXTURE_REPORT, null, control);
      expect(html).toContain('<form action="/api/scan" method="post">');
      expect(html).toContain('name="value" value="example.com"');
      expect(html).toContain('type="submit"');
      // And no bare, handler-less button is left standing beside it.
      expect(html).not.toContain('<button type="button" class="btn btn-outline">');
    }
  );

  it("only the incomplete rescan tells the route why, so it is not offered on its own result", () => {
    // `scans.from_incomplete_rescan` is read back off the stored report by
    // `resolve.ts`, which is how "measure what's missing" is offered once
    // and not for ever. Nothing was setting it until this control did.
    const incomplete = render(FIXTURE_REPORT, null, { kind: "rescan", because: "incomplete" });
    expect(incomplete).toContain('name="rescan" value="incomplete"');
    for (const control of [{ kind: "rescan", because: "age" } as const, { kind: "retry" } as const]) {
      expect(render(FIXTURE_REPORT, null, control)).not.toContain('name="rescan"');
    }
  });

  it("correction_retry draws none here, because the working one is already on the screen", () => {
    // That arm is reached only where the correction offer still stands,
    // and an offer that stands is exactly when the verdict strip renders
    // `CategoryCorrection` — a control that submits the corrected market
    // and follows the rerun. A second button beside it would be the one
    // thing this criterion forbids: two controls that start a measurement
    // on one screen. So the ruling's "act or are not drawn" is taken at
    // its word.
    const html = render(FIXTURE_REPORT, null, { kind: "correction_retry" });
    expect(CONTROL_KEYS.filter((key) => html.includes(key))).toEqual([]);
    // The one that does act is there, and it is the correction's own.
    expect(html).toContain("verdict.not-your-market");
  });

  it("none renders no control label at all", () => {
    const html = render(FIXTURE_REPORT, null, { kind: "none" });
    expect(CONTROL_KEYS.filter((key) => html.includes(key))).toEqual([]);
  });

  it("the copy-link control is not one of the four, and is not on this tree at all", () => {
    // REQ-001 c7's control starts no measurement, so it never was one of
    // the four. Since #357 it is not in this component either: ruling 3a
    // gave the public header a per-route right slot, and the report's slot
    // is that control — on the screen once, in the bar. Asserted here so
    // that the day it returns to the module tree, it returns deliberately.
    for (const control of ["none", "retry"] as const) {
      expect(render(FIXTURE_REPORT, null, { kind: control })).not.toContain("copy-link.label");
    }
  });
});

describe("SPEC §2, 2026-10-07 (issue 1328) — the result and the action first, the rest closed", () => {
  const html = render(FIXTURE_REPORT);
  const ORDER = [
    "report.measured-at", // 1 · the score
    "ai-answers.title", // 2a · AI answers
    "presence.title", // 2b · Google search
    "price.amount", // 3 · the offer
    "problem.blocked-readers.title", // 4 · problem cards
    "method.blocked-readers.title", // 5 · DIY collapses
    "free-page.title", // 6 · free page
    "removal.line.on-report", // the foot
  ];

  /** The markup of every outermost `details` on the page, each cut at its
   *  own end, so what is inside a closed section can be told from what is
   *  not. Depth is counted so a nested `details` could never split one. */
  function closedParts(markup: string): string {
    const parts: string[] = [];
    let depth = 0;
    let from = 0;
    for (const tag of markup.matchAll(/<details|<\/details>/g)) {
      if (tag[0] === "<details") {
        if (depth === 0) from = tag.index;
        depth += 1;
      } else {
        depth -= 1;
        if (depth === 0) parts.push(markup.slice(from, tag.index));
      }
    }
    return parts.join("");
  }

  it("the score, the two results and the offer come before anything longer", () => {
    const positions = ORDER.map((key) => html.indexOf(key));
    expect(positions).not.toContain(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("no section starts open", () => {
    expect(count(html, "<details")).toBeGreaterThan(0);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
  });

  it("the score, each card's finding and drawing, and Start are outside every closed section", () => {
    const closed = closedParts(html);
    for (const key of ["verdict.score.label", "ai-answers.finding", "presence.finding", "offer.start.priced"]) {
      expect(html).toContain(key);
      expect(closed).not.toContain(key);
    }
  });

  it("the questions, the searches, the problems, the checks, the method and the first page are all on the page, closed", () => {
    const closed = closedParts(html);
    for (const key of [
      "ai-answers.questions.measured",
      "ai-answers.method",
      "presence.absent-from.column.search",
      "problem.blocked-readers.title",
      "problem.missing-pages.title",
      "problem.unquotable-pages.title",
      "check.legend",
      "method.blocked-readers.body",
      "method.missing-pages.body",
      "method.unquotable-pages.body",
      "free-page.row.target",
    ]) {
      expect(closed).toContain(key);
    }
  });

  it("each closed section opens from its own name", () => {
    const summaries = (html.match(/<summary[\s\S]*?<\/summary>/g) ?? []).join("");
    for (const key of [
      "ai-answers.questions.title",
      "presence.absent-from.title",
      "problem.section.title",
      "method.blocked-readers.title",
      "free-page.title",
    ]) {
      expect(summaries).toContain(key);
    }
  });

  it("a link to the first page lands inside its closed section, so following it opens it", () => {
    expect(html).toMatch(/<details[^>]*data-testid="report-first-page"[^>]*>[\s\S]*?<div id="first-page"/);
    expect(html).not.toMatch(/<details[^>]*id="first-page"/);
  });

  it("a section the scan did not produce is not closed — it says so in its own line", () => {
    const degraded = render(FIXTURE_DEGRADED_REPORT);
    const closed = closedParts(degraded);
    for (const key of ["ai-answers.absent", "presence.absent", "free-page.absent"]) {
      if (degraded.includes(key)) expect(closed).not.toContain(key);
    }
    expect(degraded).toContain("free-page.absent");
  });

  it("the waiting state stands on the same columns the report does", () => {
    const surface = (markup: string): string | undefined => /<[^>]*data-surface[^>]*>/.exec(markup)?.[0];
    expect(surface(html)).toBeDefined();
    expect(surface(renderToStaticMarkup(ReportLoading()))).toBe(surface(html));
  });
});

// DESIGN rule 1: one solid primary button per screen. On the report it is
// the offer's Start — the paying path; the free page's control is soft (2026-09-24).
describe("DESIGN rule 1 — the report has one solid primary, and it is Start", () => {
  const html = render(FIXTURE_REPORT);

  /** The opening tag of the `<button>` whose label is `key` (an icon may
   *  sit either side of it). */
  function buttonTag(key: string): string {
    const match = new RegExp(`<button([^>]*)>(?:(?!</?button)[^])*?${key}`).exec(html);
    expect(match, `no <button> labelled ${key} in the rendered report`).not.toBeNull();
    return match?.[1] ?? "";
  }

  it("draws exactly one solid primary button", () => {
    const solids = [...html.matchAll(/<button[^>]*class="([^"]*)"/g)]
      .map((m) => m[1] ?? "")
      .filter((cls) => cls.split(" ").includes("btn-primary") && !/\bbtn-(soft|outline|ghost)\b/.test(cls));
    expect(solids).toHaveLength(1);
    expect(buttonTag("offer.start.priced")).not.toContain("btn-outline");
  });

  it("the free page's control and the correction are quieter ranks", () => {
    expect(buttonTag("free-page.submit")).toContain("btn-soft");
    expect(buttonTag("verdict.not-your-market")).not.toContain("btn-primary");
  });
});

describe("REQ-004 c10/c11 — an absent section is named, and the rest stays usable", () => {
  const html = render(FIXTURE_DEGRADED_REPORT);

  it("names each absent section in one written line", () => {
    expect(html).toContain("ai-answers.absent");
    expect(html).toContain("presence.absent");
    expect(html).toContain("free-page.absent");
  });

  it("renders no empty card and no spinner in their place", () => {
    expect(html).not.toContain("loading");
    expect(html).not.toContain("spinner");
  });

  it("the modules that could be produced are still there", () => {
    expect(html).toContain("problem.missing-pages.title");
    expect(html).toContain("price.amount");
    expect(html).toContain("removal.line.on-report");
  });

  it("offers the missing part again on each absent card, and once in the notice", () => {
    const withNotice = render(
      FIXTURE_DEGRADED_REPORT,
      { kind: "incomplete", unmeasured: ["presence"] },
      { kind: "rescan", because: "incomplete" }
    );
    // The two absent sections and the notice — and the notice's control is
    // inside it, so the screen never offers the same action twice over.
    expect(count(withNotice, "control.rescan-incomplete")).toBe(3);
    expect(count(withNotice, 'role="alert"')).toBe(1);
  });
});

describe("REQ-091/092 — cold start: a domain that ranks for nothing still reads", () => {
  const html = render(FIXTURE_COLD_START_REPORT);

  it("shows a measured zero as a zero, never as a dash", () => {
    // The score is 8 and the three counts are measured zeros. A dash here
    // would be REQ-004 c7's exact failure: reading "we measured, and the
    // answer is none" as "we could not measure".
    expect(html).not.toContain("unmeasured.dash");
    expect(html).toContain('class="figure min-w-0">8<');
    expect(html).toContain("band.score.invisible");
  });

  it("says so in writing where the rival list would be, rather than drawing an empty one", () => {
    expect(html).toContain("presence.no-rivals");
  });

  it("the AI matrix keeps the customer's own row and drops every rival row", () => {
    // The customer's row is not a rival row and never goes away — "you
    // were named in none of them" is the card's answer, and a drawing with
    // no rows at all would be that answer withheld.
    // The matrix is the CSS grid (issue 730): from its root to the
    // questions list that follows it on the card.
    const start = html.indexOf('data-testid="ai-matrix"');
    expect(start).toBeGreaterThan(-1);
    const matrix = html.slice(start, html.indexOf('role="columnheader"', start));
    // The count is on the row, not in a sentence beside it (#352).
    expect(matrix).toContain("0/9");
    expect(matrix).toContain("example.com");
    // Scoped to the drawing: the answers themselves still named rivals,
    // and the 12-questions list below says so. What a cold start empties
    // is the *derived rival set*, which is the matrix's rows.
    expect(matrix).not.toContain("rival-one.example.net");
  });

  it("names the empty absent-from table in one written line", () => {
    expect(html).toContain("presence.absent-from.empty");
  });

  it("offers the free page's own absent line when the scan found nothing to write", () => {
    expect(html).toContain("free-page.absent");
  });

  it("renders no empty element anywhere a sentence belongs", () => {
    expect(html).not.toMatch(/<p[^>]*><\/p>/);
    expect(html).not.toMatch(/<td[^>]*><\/td>/);
  });

  it("the rest of the report is still there — nothing is suppressed by the emptiness", () => {
    for (const key of ["problem.blocked-readers.title", "method.missing-pages.title", "price.amount"]) {
      expect(html).toContain(key);
    }
  });
});

describe("the fixture is the shape this build reads", () => {
  it("is written at the current report version", () => {
    // `_fixture/states.ts` cannot import the constant: it is reachable
    // from `src/middleware.ts`, and a **runtime** import of the report
    // leaf pulls the db and env chain into the Edge bundle and fails the
    // build. Neither can this file — the same chain throws on a missing
    // env binding under the node project. So the pin is read off the
    // source, which is the one thing both sides can agree on (#352).
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/lib/scan/report.ts"),
      "utf8"
    );
    const declared = /export const REPORT_VERSION = (\d+);/.exec(source)?.[1];
    expect(declared, "REPORT_VERSION is not declared as a literal any more").toBeDefined();
    for (const report of [FIXTURE_REPORT, FIXTURE_DEGRADED_REPORT, FIXTURE_COLD_START_REPORT]) {
      expect(String(report.version)).toBe(declared);
    }
  });
});

describe("REQ-004 c5 — nothing is hidden, blurred or paywalled", () => {
  it("the report renders one unconditional tree with no tier, session or payment branch", () => {
    // Structural: `ReportView`'s props are the state, the canonical URL and
    // the chart slots. There is no parameter that could carry a tier, so
    // the promise is discharged by there being nothing to pass — asserted
    // here by reading the source rather than by rendering twice.
    //
    // Comments are stripped first: this file's own header explains *why*
    // it has no tier parameter, in prose that names one, and a plain
    // substring match over the whole file would flag its own documentation
    // (the same trap `tests/presentation/generated/text.test.ts` records
    // for its import-graph check).
    const code = stripComments(
      readFileSync(
        new URL("../../../src/app/(public)/scan/[domain]/_address/report-view.tsx", import.meta.url),
        "utf8"
      )
    );
    expect(code).not.toMatch(/\btier\b/i);
    expect(code).not.toMatch(/\bpaid\b/i);
    expect(code).not.toMatch(/\bsession\b/i);
    expect(code).not.toMatch(/\bhasActiveAccess\b/);
  });
});

describe("REQ-002 c1/c3 — one removal address, two surfaces", () => {
  it("every report names it at the foot", () => {
    expect(render(FIXTURE_REPORT)).toContain("removal.line.on-report(removal.address)");
  });

  it("the removed arm names the same address, from the same key", () => {
    const html = renderToStaticMarkup(
      React.createElement(RemovedView, { domain: "example.com" as CanonicalDomain })
    );
    expect(html).toContain("removal.line.removed(example.com|removal.address)");
  });

  it("the removed arm offers nothing that re-measures, and exactly one way back (#936)", () => {
    const html = renderToStaticMarkup(
      React.createElement(RemovedView, { domain: "example.com" as CanonicalDomain })
    );
    // REQ-001 c18's substance, unchanged: no retry control and nothing
    // that could start a scan. Its "no route back", superseded by SPEC §1
    // (2026-09-20) — one link, to the landing, and not to a report.
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
    expect([...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1])).toEqual(["/"]);
  });

  it("the foot line and the removed line resolve the address from one key", () => {
    const foot = renderToStaticMarkup(React.createElement(RemovalAddressLine));
    expect(foot).toContain("removal.address");
  });
});

describe("issue 715 — SPEC §2: what was measured, what was reused, what the ceiling cut off", () => {
  const cutOff: StoredReport = { ...FIXTURE_DEGRADED_REPORT, complete: false, stoppedReason: "time_ceiling", aiAnswers: FIXTURE_REPORT.aiAnswers };

  it("every report state carries the measurement line once; the reuse disclosure only when cached_only", () => {
    for (const report of [FIXTURE_REPORT, FIXTURE_DEGRADED_REPORT, cutOff]) expect(count(render(report), ">report.measurement<")).toBe(1);
    expect(render(FIXTURE_REPORT)).not.toContain("ai-answers.coverage.cached-only");
    expect(render({ ...FIXTURE_REPORT, aiAnswers: { ...FIXTURE_REPORT.aiAnswers!, coverage: "cached_only" } })).toContain("ai-answers.coverage.cached-only");
  });

  it("a ceiling-cut report keeps its measured card and offers 'Retry this part' only on the parts it lost", () => {
    const html = render(cutOff);
    expect(html).toContain("ai-answers.finding");
    expect(count(html, ">control.retry-part<")).toBe(2);
    expect(render({ ...FIXTURE_DEGRADED_REPORT, stoppedReason: "failed" })).not.toContain("control.retry-part");
  });

  // Owner ruling 2026-09-22, box 2: the mark carries the date the answers
  // were bought, read off the section. The chip beside it is the date the
  // *report* was read, which is a different fact and was the only one the
  // card had.
  it("marks reused answers with their own date, and only where the section carries one", () => {
    expect(render(FIXTURE_REPORT)).not.toContain("ai-answers.reused-from");
    const reused = render({
      ...FIXTURE_REPORT,
      aiAnswers: { ...FIXTURE_REPORT.aiAnswers!, reusedFrom: "2026-09-02T09:00:00.000Z" },
    });
    // The date in the report's one locale, not the ISO instant the blob
    // stores — and the key's slot, so the sentence stays the registry's.
    expect(reused).toContain("ai-answers.reused-from(Sep 2, 2026)");
    expect(reused).not.toContain("2026-09-02T09:00:00.000Z");
  });

  // Owner ruling 2026-09-22, box 3: the control acts. SPEC §1's
  // 2026-09-20 line — a control on this screen "does something or is not
  // drawn" — so each retry button carries the address its post goes to.
  it("each 'Retry this part' is a live control on its own card, named by its part", () => {
    const html = render(cutOff);
    expect(html).toContain('data-testid="retry-presence"');
    expect(html).toContain('data-testid="retry-free_page"');
    // The card that *was* measured draws no control at all — there is
    // nothing on it to retry.
    expect(html).not.toContain('data-testid="retry-ai_answers"');
    const lost = render({ ...cutOff, aiAnswers: null });
    expect(lost).toContain('data-testid="retry-ai_answers"');
  });
});

describe("issue #785 — the report's offer begins checkout, and states a refusal on itself", () => {
  it("Start is a submit inside a form, not an inert button", () => {
    const html = render(FIXTURE_REPORT);
    expect(html).toMatch(/<form[^>]*>\s*<button type="submit" class="btn btn-primary btn-lg btn-block">offer\.start\.priced<svg/);
  });

  it("a refused checkout renders the offer's written line, and only then", () => {
    const refused = renderToStaticMarkup(
      React.createElement(ReportView, {
        state: { report: FIXTURE_REPORT, notice: null, control: { kind: "none" }, correction: { offered: true, as: "first" } },
        checkoutRefused: true,
      })
    );
    expect(count(refused, "offer.checkout.refused")).toBe(1);
    expect(render(FIXTURE_REPORT)).not.toContain("offer.checkout.refused");
  });
});
