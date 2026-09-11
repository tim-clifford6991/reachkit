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


function render(
  report: StoredReport,
  notice: AddressNotice | null = null,
  control: AddressControl = { kind: "none" }
): string {
  return renderToStaticMarkup(
    React.createElement(ReportView, { state: { report, notice, control } })
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

  it("the incomplete line names the one factor that has no value (#541)", () => {
    const html = render(FIXTURE_REPORT, { kind: "incomplete", unmeasured: ["foundations"] });
    expect(html).toContain("notice.incomplete(verdict.factor.foundations)");
  });

  it("with two or more, it names all of them (#541)", () => {
    const html = render(FIXTURE_REPORT, {
      kind: "incomplete",
      unmeasured: ["foundations", "answerability", "presence"],
    });
    expect(html).toContain(
      "notice.incomplete(verdict.factor.foundations, verdict.factor.answerability, verdict.factor.presence)"
    );
  });

  it("the slot is never filled with the empty string — the sentence production served on 2026-09-11 (#541)", () => {
    // `AddressNotice`'s `incomplete` arm carries `UnmeasuredFactors`, a
    // non-empty list, so there is no notice this component can be handed
    // that renders the slot blank. The degraded fixture is the report the
    // owner reviews this screen on, and the notice beside it is the same
    // arm, so both are checked.
    for (const html of [
      render(FIXTURE_REPORT, { kind: "incomplete", unmeasured: ["presence"] }),
      render(FIXTURE_DEGRADED_REPORT, {
        kind: "incomplete",
        unmeasured: ["foundations", "presence"],
      }),
    ]) {
      expect(html).not.toContain("notice.incomplete()");
    }
  });

  it("a report with nothing unmeasured renders no incomplete line and no alert — `resolve.ts` hands it `null` (#541)", () => {
    const html = render(FIXTURE_REPORT, null);
    expect(html).not.toContain("notice.incomplete");
    expect(count(html, 'role="alert"')).toBe(0);
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

// tokens.md §9.1's ranks on the one public screen that has two calls to
// action (issue #291). The report offers the free page and the
// subscription; the idiom gives a screen one solid accent fill, and the
// owner ruled Start keeps it. The classes are the ranks — `btn-primary` is
// the fill, `rk-btn-outline` the outline — and the free-page control's tone
// is what keeps it reading as a call to action rather than an aside.
describe("ruling 2b (2026-09-08) — this screen has two solids, and they are the two trades", () => {
  const html = render(FIXTURE_REPORT);

  /** The opening tag of the `<button>` whose label is `key`. The markup is
   *  server-rendered and the label is the last thing in the element, so the
   *  tag is what precedes it — enough to read the classes and the tone, and
   *  no DOM needed in a file that asserts strings. */
  function buttonTag(key: string): string {
    const match = new RegExp(`<button([^>]*)>${key}</button>`).exec(html);
    expect(match, `no <button> labelled ${key} in the rendered report`).not.toBeNull();
    return match?.[1] ?? "";
  }

  it("draws exactly two solid accent buttons — never a third", () => {
    // Ruling 2b: "two solid primaries per screen are allowed **where the
    // artifact draws them** … report: Email me + Start". Two, because the
    // report carries two trades; the ceiling is what this row holds.
    expect(count(html, "btn-primary")).toBe(2);
  });

  it("they are the giveaway's Email me and the pricing card's Start, and nothing else", () => {
    expect(buttonTag("free-page.submit")).toContain("btn-primary");
    // The offer's control carries the price in its label since #369 — the
    // set draws "Start ReachKit €49" on it, and `offer.start` stays the two
    // words the owner ruled, which is what the pricing page's eyebrow says.
    expect(buttonTag("offer.start.priced")).toContain("btn-primary");
  });

  it("every other control on the screen is a quieter rank", () => {
    // The copy-link and the correction are tertiary; a third fill would
    // make the two trades stop reading as the two trades.
    // (The copy control moved to the header's bar in #357, and its rank is
    // asserted there.)
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
    // were named in none of them" is the card's answer, and a drawing with
    // no rows at all would be that answer withheld.
    // `role="img"` is `ChartFrame`'s own and only a registered chart
    // carries it; a card head's decorative glyph is an `<svg>` too.
    const start = html.indexOf('role="img"');
    const matrix = html.slice(start, html.indexOf("</svg>", start));
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
