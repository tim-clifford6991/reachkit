// tests/app/scan-address/report-copy.test.tsx
//
// BUILD §4.1 (issue #13), against the **real, unmocked** copy registry.
// `report-view.test.tsx` and `view.test.tsx` mock `copy()` so they can
// assert the tree without depending on the owner's wording; this file is
// the other half — that every key those trees name actually exists, that
// `copy()` renders it rather than throwing, and that every sentence still
// waiting on the owner is visibly waiting rather than silently blank.
//
// It asserts the key, never the sentence (WO-249's rule): the owner may
// write any of these strings tomorrow and nothing here changes.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import {
  AWAITING_COPY,
  COPY,
  COPY_META,
  TODO_COPY_MARKER,
  copy,
  type CopyKey,
} from "@/lib/presentation/copy";
import { OWNER_OWED } from "@/lib/presentation/copy/registry";
import { ReportView } from "@/app/(public)/scan/[domain]/_address/report-view";
import { FIXTURE_DEGRADED_REPORT, FIXTURE_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";

/** Every key this screen's own modules name. Transcribed here rather than
 *  read out of the source, so a key silently dropped from a module fails
 *  this list rather than shrinking it. */
/**
 *  **Nine keys came off this list in #352**, deliberately, and the list is
 *  shorter rather than the modules being wrong.
 *
 *  Five went when the two cards' rows became §2.4's own drawings rather
 *  than hand-built listings: `ai-answers.matrix.column.domain` / `.cited`
 *  / `.empty` and `presence.occupancy.column.domain` / `.count`.
 *
 *  Four more went with the approved screen set (S2). `presence.occupancy`
 *  and `ai-answers.customer-citations` each restated a count the drawing
 *  already labels on the row it belongs to — REQ-008 c3 asks for the
 *  customer's presence "exactly once … with no restatement of that count
 *  anywhere else on the card" — and `presence.legend` /
 *  `ai-answers.legend` are legends for drawings that have none, because
 *  §2.4 direct-labels every mark instead.
 *
 *  All nine stay declared in the registry: the owner may still write them
 *  for a listing elsewhere, and deleting a key moves `registry.test.ts`'s
 *  pinned totals. They are named in the PR.
 */
const SCREEN_KEYS: readonly CopyKey[] = [
  // 1 · the header card
  "report.measured-at",
  "report.measured-at.no-category",
  "verdict.score.label",
  "verdict.not-your-market",
  "verdict.limiting.foundations",
  "verdict.limiting.answerability",
  "verdict.limiting.presence",
  "verdict.factor.foundations",
  "verdict.factor.answerability",
  "verdict.factor.presence",
  "unmeasured.dash",
  "unmeasured.undeterminable",
  "unmeasured.not-attempted",
  "band.score.invisible",
  "band.score.hard-to-find",
  "band.score.findable",
  "band.score.dominant",
  "copy-link.label",
  // 2a · AI answers
  "ai-answers.title",
  "ai-answers.source",
  "ai-answers.denominator",
  "ai-answers.method",
  "ai-answers.questions.title",
  "ai-answers.questions.show-all",
  "ai-answers.question.not-you",
  "ai-answers.question.no-answer",
  "ai-answers.question.provenance",
  // §6.2's three answer columns (issue #157). Four headers and the two
  // cell states the columns add to the ones the questions list already
  // names.
  "ai-answers.engine.column.question",
  "ai-answers.engine.ai-overview",
  "ai-answers.engine.ai-mode",
  "ai-answers.engine.chatgpt",
  "ai-answers.engine.cell.cited",
  "ai-answers.engine.not-measured",
  "ai-answers.absent",
  // 2b · Google presence
  "presence.title",
  "presence.source",
  "presence.no-rivals",
  "presence.absent-from.title",
  "presence.absent-from.column.search",
  "presence.absent-from.column.volume",
  "presence.absent-from.column.holder",
  "presence.absent-from.empty",
  "presence.absent",
  "place.report.first-page.rival",
  // 3 · problem cards
  "problem.blocked-readers.title",
  "problem.blocked-readers.doer",
  "problem.blocked-readers.none-needed",
  "problem.missing-pages.title",
  "problem.missing-pages.doer",
  "problem.missing-pages.none-needed",
  "problem.unquotable-pages.title",
  "problem.unquotable-pages.doer",
  "problem.unquotable-pages.none-needed",
  "problem.paste.label",
  "severity.low",
  "severity.mid",
  "severity.high",
  // 4 · DIY collapses
  "method.title",
  "method.blocked-readers.title",
  "method.blocked-readers.body",
  "method.missing-pages.title",
  "method.missing-pages.body",
  "method.unquotable-pages.title",
  "method.unquotable-pages.body",
  // 5 · free page
  "free-page.title",
  "free-page.badge",
  "free-page.of",
  "free-page.email.label",
  "free-page.email.placeholder",
  "free-page.row.target",
  "free-page.target.value",
  "free-page.row.beats",
  "free-page.row.format",
  "free-page.submit",
  "free-page.absent",
  "generated.page.proposed",
  // 6 · pricing
  "price.amount",
  "price.interval",
  "offer.cadence.page",
  "offer.cadence.page.value",
  "offer.cadence.measure",
  "offer.cadence.measure.value",
  "offer.cadence.movement",
  "offer.cadence.movement.value",
  "offer.veto.window",
  "offer.veto.window.value",
  "offer.start",
  "offer.cancel_self_service",
  // the notices, the controls, the foot, the scanning stages
  "notice.incomplete",
  "notice.measurement-failed",
  "notice.correction-failed",
  "notice.refused.network-limit",
  "notice.refused.scan-running",
  "report.wait.minutes",
  "control.rescan-age",
  "control.rescan-incomplete",
  "control.retry",
  "control.correction-retry",
  "removal.address",
  "removal.line.on-report",
  "removal.line.removed",
  "stage.reading_your_site",
  "stage.reading_access_rules",
  "stage.reading_your_market",
  "stage.checking_your_presence",
  "stage.asking_the_twelve",
  "stage.scoring",
  "stage.elapsed",
  "scan.waiting.line",
];

describe("every sentence this screen speaks is a key in the registry", () => {
  it.each(SCREEN_KEYS)("%s is declared", (key) => {
    expect(Object.prototype.hasOwnProperty.call(COPY, key)).toBe(true);
  });

  it("none of them is on the empty-value representation, so none throws mid-render", () => {
    const throwing = SCREEN_KEYS.filter((key) => OWNER_OWED.includes(key));
    expect(throwing).toEqual([]);
  });

  it("every key renders through copy() without throwing, slots supplied from its own metadata", () => {
    // The slot list is `COPY_META`'s, not the stored string's: a
    // `TODO(copy)` value carries no `{name}` placeholder yet still
    // declares the slots the owner's sentence will take, and `copy()`
    // requires every declared slot whether the placeholder is there or
    // not. Reading the string would silently skip exactly the keys most
    // likely to break when the sentence lands.
    for (const key of SCREEN_KEYS) {
      const slotNames = Object.keys(COPY_META[key].slots);
      const vars = Object.fromEntries(slotNames.map((name) => [name, `<${name}>`]));
      expect(() => copy(key, vars), key).not.toThrow();
    }
  });
});

describe("the report renders end to end against the real registry", () => {
  it.each([
    ["complete", FIXTURE_REPORT],
    ["degraded", FIXTURE_DEGRADED_REPORT],
  ] as const)("the %s fixture renders with no copy() throw", (_name, report) => {
    expect(() =>
      renderToStaticMarkup(
        React.createElement(ReportView, {
          state: { report, notice: null, control: { kind: "none" } },
          canonicalUrl: "https://reachkit.app/scan/example.com",
        })
      )
    ).not.toThrow();
  });

  it("no rendered line is blank: an unwritten sentence shows its marker instead", () => {
    const html = renderToStaticMarkup(
      React.createElement(ReportView, {
        state: { report: FIXTURE_REPORT, notice: null, control: { kind: "none" } },
        canonicalUrl: "https://reachkit.app/scan/example.com",
      })
    );
    // The marker is on screen, which is the whole point of it: the owner
    // sees which sentence each module is waiting for, in place.
    expect(html).toContain(TODO_COPY_MARKER);
    // And nothing renders as an empty element where a sentence belongs.
    expect(html).not.toMatch(/<p[^>]*><\/p>/);
  });
});

describe("what the owner is owed, stated rather than discovered", () => {
  it("every key this screen still waits on carries the marker, and is listed", () => {
    const waiting = SCREEN_KEYS.filter((key) => AWAITING_COPY.includes(key));
    // Rule 5.5: the count is reported, not left implicit.
    expect(waiting.length).toBeGreaterThan(0);
    for (const key of waiting) expect(COPY[key]).toBe(TODO_COPY_MARKER);
  });

  it("the sentences the owner already ruled are untouched by this screen", () => {
    const ruled: readonly CopyKey[] = [
      "verdict.limiting.presence",
      "band.score.findable",
      "unmeasured.dash",
      "copy-link.label",
      "removal.address",
      "price.amount",
      "offer.start",
      "place.report.first-page.rival",
    ];
    for (const key of ruled) {
      expect(AWAITING_COPY).not.toContain(key);
      expect(OWNER_OWED).not.toContain(key);
    }
  });
});
