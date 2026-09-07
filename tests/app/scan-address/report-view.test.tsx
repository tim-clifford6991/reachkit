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
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("@/lib/presentation/copy", () => ({
  copy: (key: string, vars?: Record<string, string>) =>
    vars === undefined ? key : `${key}(${Object.values(vars).join("|")})`,
}));

import { ReportView } from "@/app/(public)/scan/[domain]/_address/report-view";
import { RemovalAddressLine, RemovedView } from "@/app/(public)/scan/[domain]/_address/removal";
import {
  FIXTURE_COLD_START_REPORT,
  FIXTURE_DEGRADED_REPORT,
  FIXTURE_REPORT,
} from "@/app/(public)/scan/[domain]/_fixture/states";
import type { AddressControl, AddressNotice } from "@/app/(public)/scan/[domain]/_address/state";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { StoredReport } from "@/lib/scan/report";

const CANONICAL = "https://reachkit.app/scan/example.com";

function render(
  report: StoredReport,
  notice: AddressNotice | null = null,
  control: AddressControl = { kind: "none" }
): string {
  return renderToStaticMarkup(
    React.createElement(ReportView, { state: { report, notice, control }, canonicalUrl: CANONICAL })
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

describe("REQ-004 c1 — the verdict strip names the score, its band, the domain and the date", () => {
  const html = render(FIXTURE_REPORT);

  it("renders the score as a mono numeral", () => {
    expect(html).toContain('class="num min-w-0">62<');
  });

  it("renders the band as one of the four ruled words, through SCORE_BANDS", () => {
    expect(html).toContain("band.score.findable");
  });

  it("renders the domain and the date beside it, so the score is never a bare specimen", () => {
    expect(html).toContain("report.measured-at(example.com|");
  });

  it("renders the one line naming the limiting factor", () => {
    expect(html).toContain("verdict.limiting.presence");
  });

  it("names the category beside the score", () => {
    expect(html).toContain("product analytics");
  });
});

describe("DECISIONS 2026-09-03 — no driver bars, no per-question volume, no market-total footnote", () => {
  const html = render(FIXTURE_REPORT);

  it("renders no progress element inside the verdict strip", () => {
    // The presence card's occupancy bars are §4.1 module 2's and are a
    // different thing; what the ruling removed is the three driver bars on
    // the strip. `Verdict` carries no `factors` member at all, so the
    // stronger statement is that no factor *value* appears anywhere.
    const strip = html.slice(0, html.indexOf("ai-answers.title"));
    expect(strip).not.toContain("<progress");
  });

  it("names no score factor's value anywhere on the page", () => {
    // The three factor names appear only as `{what}` subjects of an
    // unmeasured line; a *value* would have to be a number beside one, and
    // `Verdict` has no member to read one from.
    expect(html).not.toContain("verdict.factor.foundations(");
    expect(html).not.toContain("verdict.factor.presence(");
  });

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
    { kind: "measurement_failed", failedAt: new Date("2026-09-05T00:00:00.000Z") },
    { kind: "correction_failed" },
    { kind: "refused", refusal: { reason: "network-limit", retryAfterSeconds: 2220 } },
  ];

  it.each(notices.map((n) => [n.kind, n] as const))("%s renders exactly one alert", (_kind, notice) => {
    const html = render(FIXTURE_REPORT, notice);
    expect(count(html, 'role="alert"')).toBe(1);
  });

  it("null renders no alert at all", () => {
    expect(count(render(FIXTURE_REPORT, null), 'role="alert"')).toBe(0);
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
  const controls: AddressControl[] = [
    { kind: "rescan", because: "age" },
    { kind: "rescan", because: "incomplete" },
    { kind: "retry" },
    { kind: "correction_retry" },
  ];
  const CONTROL_KEYS = [
    "control.rescan-age",
    "control.rescan-incomplete",
    "control.retry",
    "control.correction-retry",
  ];

  it.each(controls.map((c) => [`${c.kind}${"because" in c ? `/${c.because}` : ""}`, c] as const))(
    "%s renders exactly one of the four control labels",
    (_name, control) => {
      const html = render(FIXTURE_REPORT, null, control);
      const rendered = CONTROL_KEYS.filter((key) => html.includes(key));
      expect(rendered).toHaveLength(1);
    }
  );

  it("none renders no control label at all", () => {
    const html = render(FIXTURE_REPORT, null, { kind: "none" });
    expect(CONTROL_KEYS.filter((key) => html.includes(key))).toEqual([]);
  });

  it("the copy-link control is not one of the four and coexists with none of them", () => {
    // REQ-001 c7's control starts no measurement, so it rides on every arm
    // — including `none`, where the union renders nothing.
    expect(render(FIXTURE_REPORT, null, { kind: "none" })).toContain("copy-link.label");
    expect(render(FIXTURE_REPORT, null, { kind: "retry" })).toContain("copy-link.label");
  });
});

describe("BUILD §4.1 — the six modules, in order", () => {
  const html = render(FIXTURE_REPORT);
  const ORDER = [
    "report.measured-at", // 1 · verdict strip
    "ai-answers.title", // 2a · AI answers
    "presence.title", // 2b · Google search
    "problem.blocked-readers.title", // 3 · problem cards
    "method.blocked-readers.title", // 4 · DIY collapses
    "free-page.title", // 5 · free page
    "price.amount", // 6 · pricing
    "removal.line.on-report", // the foot
  ];

  it("every module renders", () => {
    for (const key of ORDER) expect(html).toContain(key);
  });

  it("they render in §4.1's order", () => {
    const positions = ORDER.map((key) => html.indexOf(key));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("all three problem cards render, and all three method sections", () => {
    for (const problem of ["blocked-readers", "missing-pages", "unquotable-pages"]) {
      expect(html).toContain(`problem.${problem}.title`);
      expect(html).toContain(`method.${problem}.title`);
    }
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
});

describe("REQ-091/092 — cold start: a domain that ranks for nothing still reads", () => {
  const html = render(FIXTURE_COLD_START_REPORT);

  it("shows a measured zero as a zero, never as a dash", () => {
    // The score is 8 and the three counts are measured zeros. A dash here
    // would be REQ-004 c7's exact failure: reading "we measured, and the
    // answer is none" as "we could not measure".
    expect(html).not.toContain("unmeasured.dash");
    expect(html).toContain('class="num min-w-0">8<');
    expect(html).toContain("band.score.invisible");
  });

  it("says so in writing where the rival list would be, rather than drawing an empty one", () => {
    expect(html).toContain("presence.no-rivals");
  });

  it("the AI matrix keeps the customer's own row and drops every rival row", () => {
    // The customer's row is not a rival row and never goes away — "you
    // were named in none of them" is the card's answer, and a card with
    // no rows at all would be that answer withheld. `Table`'s required
    // `emptyMessage` therefore has no path on this card today, which is
    // what a required prop with no default is for: it is supplied, and it
    // is not reachable by accident.
    expect(html).toContain("ai-answers.customer-citations(0|9)");
    const table = html.slice(
      html.indexOf("ai-answers.matrix.column.domain"),
      html.indexOf("ai-answers.legend")
    );
    expect(table).toContain("example.com");
    // Scoped to the table: the answers themselves still named rivals, and
    // the 12-questions list below says so. What a cold start empties is
    // the *derived rival set*, which is the matrix's rows.
    expect(table).not.toContain("rival-one.example.net");
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

  it("the removed arm offers no control, no form and no link", () => {
    const html = renderToStaticMarkup(
      React.createElement(RemovedView, { domain: "example.com" as CanonicalDomain })
    );
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("<input");
  });

  it("the foot line and the removed line resolve the address from one key", () => {
    const foot = renderToStaticMarkup(React.createElement(RemovalAddressLine));
    expect(foot).toContain("removal.address");
  });
});
