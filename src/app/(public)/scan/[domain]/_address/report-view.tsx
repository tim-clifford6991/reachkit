// BUILD §4.1 — the report, whole
//
// The six modules, at most one notice, exactly one control
// (or none), and the removal address at the foot. A screen composition,
// daisyUI classes in the route (DESIGN rule 1): `alert` for the notice,
// `btn` for the one control; every module below is its own card.
//
// The order is SPEC §2's of 2026-10-07 (owner, issue 1328): the result and
// the action first, everything longer closed beneath them.
//   1. the head — what we read you as, the biggest gap, the jump chips —
//      beside the score card (board PubReport).
//   2. who gets your buyers — two equal cards, side by side, AI · Google,
//      each with its figure and a waffle of who was named. Each card's
//      list is closed under the list's own name.
//   3. pricing card — the offer.
//   4. three problem cards and the eight checks, closed.
//   5. three DIY collapses.
//   6. free page card, closed.
//
// **Nothing on this screen branches on payment, session or tier.** There
// is no parameter here that could carry one, which is how REQ-004 c5's "no
// part hidden, blurred, rounded down, locked, or marked as available on
// payment" is discharged — by there being nothing to pass.
//
// A section the scan could not produce renders as a named absent section
// with one written line (REQ-004 c10/c11) — never an empty card, never a
// spinner — and the rest of the report stays usable.
import type React from "react";
import { CircleAlert, Wrench } from "lucide-react";
import { Surface } from "@/ui/layout";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { ScoreFactorName } from "@/lib/measure/score";
import { COUNTRIES, isCountry, isLanguage, measuredLocale } from "@/lib/locale/locales";
import { countryOfDomain } from "@/lib/locale/read";
import { stillReading, type StoredReport } from "@/lib/scan/report";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { CorrectionOffer } from "@/lib/market/coherence/offer";
import { AiAnswersAbsent, AiAnswersCard } from "../_modules/ai-answers";
import {
  GooglePresenceAbsent,
  GooglePresenceCard,
} from "../_modules/google-presence";
import { FreePageAbsent, FreePageCard } from "../_modules/free-page";
import { PricingCard } from "../_modules/pricing";
import { MissingPagesList } from "../_modules/missing-pages";
import { CheckCards, ProblemCards } from "../_problems/cards";
import { checkCardsOf, readingsOf } from "../_problems/checks";
import { identityReading } from "@/lib/site-issues/checks";
import { MethodSections } from "../_problems/method";
import { answerReadersOf, cardsOf, missingPagesOf, PROBLEM_ORDER, storedQuestionOf, type MissingPage, type ProblemCard, type ProblemName } from "../_problems/model";
import { unblockLines } from "../_problems/unblock";
import { RemovalAddressLine } from "./removal";
import type { AddressControl, AddressNotice, WrittenPage } from "./state";
import { refusalLine } from "./refusal";
import { VerdictStrip } from "./verdict";
import { rescoredOf } from "./rescored";
import { RescanControl } from "./rescan";
import { startReportCheckout } from "./checkout";
import { StillReading } from "./still-reading";
import { ReadSection, whereLine } from "@/app/_business/WhatWeRead";
import type { BusinessUnderstanding } from "@/lib/business/types";
import { profileOfReport, understandBusiness } from "@/lib/business/understanding";
import { BuyersSection } from "../_modules/buyers";
import { TIMING, WEEK_PLAN } from "@/lib/config/constants";
import { BOT_PROTECTION, HOME_TIMEOUT } from "@/lib/measure/challenge";
// #103: the category has one home — the market the profile inferred.
// `categoryOf` is the one derivation of it, and the screen reads it here
// rather than from a second member the blob used to carry.
import { categoryOf, trainingOptOutOf } from "@/lib/scan/sections";

/** The report is read in English, whatever it was measured in (SPEC §6,
 *  owner 2026-10-15, issue 1443), so its dates and the names of countries
 *  and languages are written in that one locale. */
const REPORT_TAG = "en-US";

/** The factor's own name, for the notice line that lists what was not
 *  measured. The same three keys the verdict strip's own missing-factor
 *  lines resolve — one name per factor, one home. */
const FACTOR_NAME_KEY: Readonly<Record<ScoreFactorName, CopyKey>> =
  Object.freeze({
    foundations: "verdict.factor.foundations",
    answerability: "verdict.factor.answerability",
    presence: "verdict.factor.presence",
  });

function formatMeasuredOn(at: Date): string {
  return at.toLocaleDateString(REPORT_TAG, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** The drivers the pass could not measure, named in the notice's own slot.
 *  The separator is `", "` and is not a sentence — the artboard draws
 *  "and", which is the owner's to say. */
function incompleteLine(unmeasured: readonly ScoreFactorName[]): string {
  return copy("notice.incomplete", {
    what: unmeasured.map((factor) => copy(FACTOR_NAME_KEY[factor])).join(", "),
  });
}

/** The label of the control that answers a notice, so the panel and the
 *  standalone button cannot name the same action two different ways. */
function controlLabel(control: AddressControl & { kind: "rescan" }): string {
  return copy(control.because === "incomplete" ? "control.rescan-incomplete" : "control.rescan-age");
}

/** REQ-001 c14: the notice carries the sentence and the one control that
 *  answers it together. `role="alert"` keeps it announced once. */
function IncompleteNotice(p: {
  domain: CanonicalDomain;
  unmeasured: readonly ScoreFactorName[];
  control: AddressControl & { kind: "rescan" };
}): React.JSX.Element {
  return (
    <div role="alert" className="alert alert-warning flex flex-wrap">
      <CircleAlert size={20} strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 flex-1">{incompleteLine(p.unmeasured)}</span>
      {/* **It measures** (#935). This was a `<button type="button">` with
          no handler until SPEC §1's line of 2026-09-20 named it — the one
          control that answers this notice, drawn and doing nothing. */}
      <RescanControl
        domain={p.domain}
        label={controlLabel(p.control)}
        incomplete={p.control.because === "incomplete"}
        testId="report-rescan-notice"
      />
    </div>
  );
}

/** A total switch: at most one line, ever, and `null` is an arm rather
 *  than a missing value. `warn` is whether the line takes the warning tone. */
function noticeOf(notice: AddressNotice): { line: string; warn: boolean } {
  switch (notice.kind) {
    // The list is a non-empty tuple (`state.ts`), so `{what}` is never
    // filled with the empty string: `resolve.ts` sends `null` instead of
    // an empty `incomplete` (#541).
    case "incomplete":
      return { line: incompleteLine(notice.unmeasured), warn: true };
    case "site_unreadable":
      return { line: copy("notice.site-unreadable"), warn: true };
    case "bot_protected":
      return { line: copy("notice.bot-protected"), warn: true };
    // Issue 898: the site read and its market did not.
    case "market_unread":
      return { line: copy("notice.market-unread"), warn: true };
    case "measurement_failed":
      return { line: copy("notice.measurement-failed"), warn: true };
    case "correction_failed":
      return { line: copy("notice.correction-failed"), warn: true };
    case "refused":
      return { line: refusalLine(notice.refusal), warn: false };
    default: {
      const exhaustive: never = notice;
      return exhaustive;
    }
  }
}

/** Issue 1449: a home page that did not answer in time is a page that
 *  couldn't be read, as one behind bot protection is. */
function homeUnread(report: StoredReport): boolean {
  return report.onPage.kind === "unmeasured" && (report.onPage.because === BOT_PROTECTION || report.onPage.because === HOME_TIMEOUT);
}

/** Whether the report was measured in D66's default because nothing of the
 *  site was read. A report stored before the marker is read the same way
 *  from what it holds: its market read from search, its home unread, and no
 *  locale, on an address that names no country. */
function guessedLocale(report: StoredReport): boolean {
  if (report.locale !== undefined) return report.locale.basis === "default";
  return report.marketFrom === "search" && homeUnread(report) && countryOfDomain(report.domain) === null;
}

/**
 * SPEC §2 (owner, 2026-10-10, issue 1387): where bot protection kept the
 * reader off the site's own pages and its market was read from its listing
 * in search, the report says so in one line. Where the pages were read and
 * only their profile did not come back (issue 1450), the line says just
 * where the market was read from. Nothing is drawn otherwise.
 */
function MarketFromSearchLine(p: { report: StoredReport }): React.JSX.Element | null {
  if (p.report.marketFrom !== "search" || p.report.market.kind === "unmeasured") return null;
  const blocked = homeUnread(p.report);
  return (
    <p className="col-span-full text-sm text-base-content/70" data-testid="report-market-from-search">
      {copy(blocked ? "report.market.from-search" : "report.market.from-listing")}
    </p>
  );
}

/**
 * SPEC §2 (owner, 2026-10-15, issue 1440): while the searches a free scan
 * left unread are read in the background, the report says how many, briefly,
 * and refreshes itself when they are done. Nothing is drawn otherwise.
 */
function FinishingReadsLine(p: { report: StoredReport }): React.JSX.Element | null {
  const searches = stillReading(p.report, new Date());
  if (searches === null || p.report.finishingReads == null) return null;
  const count = String(searches);
  const line = copy(searches === 1 ? "report.finishing-reads.one" : "report.finishing-reads", { count });
  const untilMs = new Date(p.report.finishingReads.since).getTime() + TIMING.finishReadsNoticeS * 1000;
  return <StillReading line={line} untilMs={untilMs} />;
}

/**
 * SPEC §2 (issue 1481): a report the deployed code would read differently,
 * and that the re-score has not rewritten yet, says when it was read and
 * that the reading has changed since. Never silently stale.
 */
function ReadsDifferentlyLine(p: { report: StoredReport; shown: boolean }): React.JSX.Element | null {
  if (!p.shown) return null;
  const readOn = formatMeasuredOn(new Date(p.report.rescoredAt ?? p.report.verdict.measuredAt));
  return (
    <p className="col-span-full text-sm text-base-content/70" data-testid="report-reads-differently">
      {copy("report.reads-differently", { date: readOn })}
    </p>
  );
}

/**
 * SPEC §6 (owner D66, issue 1311): where the site said a country or a
 * language ReachKit does not measure yet, the report was measured in the
 * nearest supported country in English, and says so in one line. A country
 * or language on the list is never called unmeasured: a supported country
 * read in another language, or a supported language read in a country that
 * does not use it, names that pair and what is measured instead. Nothing is
 * drawn for a report measured in what its site said.
 */
function MeasuredInLine(p: { report: StoredReport }): React.JSX.Element | null {
  const fellBack = p.report.locale?.fellBack;
  const guessed = guessedLocale(p.report);
  if (fellBack === undefined && !guessed) return null;
  const measured = measuredLocale(p.report);
  const tag = REPORT_TAG;
  const countries = new Intl.DisplayNames(tag, { type: "region" });
  const languages = new Intl.DisplayNames(tag, { type: "language" });
  const named = (code: string, names: Intl.DisplayNames): string => {
    try {
      return names.of(code) ?? code;
    } catch {
      return code;
    }
  };
  const where = { country: named(measured.country, countries), language: named(measured.language, languages) };
  const line = (text: string): React.JSX.Element => (
    <p className="col-span-full text-sm text-base-content/70" data-testid="report-measured-in">
      {text}
    </p>
  );
  // The one "Not your market?" offer stays the verdict strip's correction.
  if (guessed) {
    const listing = p.report.locale?.listingReads;
    const guess = copy("report.locale.guessed", where);
    return line(listing === undefined ? guess : `${guess} ${copy("report.locale.listing-reads", { country: named(listing, countries) })}`);
  }
  if (fellBack === undefined) return null;
  if (isCountry(fellBack.country)) {
    return line(
      copy("report.locale.country-read-as", {
        ...where,
        readLanguage: named(fellBack.language ?? measured.language, languages),
        readCountry: named(fellBack.country, countries),
        ownLanguage: named(COUNTRIES[fellBack.country].language, languages),
      })
    );
  }
  const country = fellBack.country === null ? null : named(fellBack.country, countries);
  const language = fellBack.language === null || isLanguage(fellBack.language) ? null : named(fellBack.language, languages);
  if (country === null && language === null) {
    if (!isLanguage(fellBack.language) || fellBack.language === measured.language) return null;
    return line(
      copy("report.locale.pair-fell-back", {
        ...where,
        readLanguage: named(fellBack.language, languages),
        readCountry: where.country,
        ownLanguage: named(COUNTRIES[measured.country].language, languages),
      })
    );
  }
  const unmeasured = country !== null && language !== null ? copy("report.locale.site.pair", { country, language }) : (country ?? language ?? "");
  return line(copy("report.locale.fell-back", { ...where, unmeasured }));
}

/** A site that declares other markets is told one is measured, and where
 *  another is chosen; nothing is drawn for a site that declares none. */
function AlsoServesLine(p: { report: StoredReport }): React.JSX.Element | null {
  const n = p.report.locale?.alsoServes?.length ?? 0;
  if (n === 0) return null;
  return (
    <p className="col-span-full text-sm text-base-content/70" data-testid="report-also-serves">
      {n === 1 ? copy("report.locale.also-serves.one") : copy("report.locale.also-serves", { n: String(n) })}
    </p>
  );
}

/** SPEC §2's measurement line for a report measured outside US Google in
 *  English (D66), or in the town its site serves (D67, issue 1441), whose
 *  search volumes are the country's (issue 1480); `null`
 *  for one measured in the United States in English, whose line is
 *  unchanged. */
function measurementLine(report: StoredReport): string | null {
  if (report.locale === undefined) return null;
  const measured = measuredLocale(report);
  const tag = REPORT_TAG;
  const place = report.locale.place?.name;
  if (place !== undefined && place !== "") {
    return copy("report.measurement.place", {
      place,
      language: new Intl.DisplayNames(tag, { type: "language" }).of(measured.language) ?? measured.language,
      country: new Intl.DisplayNames(tag, { type: "region" }).of(measured.country) ?? measured.country,
    });
  }
  if (measured.country === "US" && measured.language === "en") return null;
  return copy("report.measurement.in", {
    country: new Intl.DisplayNames(tag, { type: "region" }).of(measured.country) ?? measured.country,
    language: new Intl.DisplayNames(tag, { type: "language" }).of(measured.language) ?? measured.language,
  });
}

function NoticeLine(p: { notice: AddressNotice | null }): React.JSX.Element | null {
  if (p.notice === null) return null;
  const { line, warn } = noticeOf(p.notice);
  return (
    <div role="alert" className={warn ? "alert alert-warning" : "alert"}>
      <CircleAlert size={20} strokeWidth={1.75} aria-hidden />
      <span>{line}</span>
    </div>
  );
}

/**
 * Exactly one control, or none, and never a second alongside it — and
 * since #935 the one that is drawn acts.
 *
 * A total switch, with two arms that draw nothing and say why:
 *
 * **`none`** is the arm `resolve.ts` chooses when there is nothing to
 * offer, and has always drawn nothing.
 *
 * **`correction_retry`** draws nothing *here*, and this is the ruling's
 * "act or are not drawn" taken at its word rather than a gap. That arm is
 * reached only when `correctionRetryOffered` is true, which is
 * `correction.retryOffered && offer.offered` — and an offer that stands is
 * exactly the condition under which the verdict strip above is already
 * rendering `CategoryCorrection`, a working control that submits the
 * corrected market and follows the rerun. Drawing a second button beside
 * it would be the one thing REQ-001 c16 forbids outright: two controls
 * that start a measurement on one screen. The retry a reader needs is on
 * the screen, in the place the correction was offered from.
 *
 * **`rescan` and `retry`** are the same act — measure this domain again —
 * so both go through `RescanControl`, which posts to the same door the
 * landing field uses. They differ in one word and in whether the start
 * says it is answering an incomplete report.
 */
function ControlButton(p: { domain: CanonicalDomain; control: AddressControl }): React.JSX.Element | null {
  const control = p.control;
  switch (control.kind) {
    case "none":
    case "correction_retry":
      return null;
    case "rescan":
      return (
        <div>
          <RescanControl
            domain={p.domain}
            label={controlLabel(control)}
            incomplete={control.because === "incomplete"}
            testId="report-rescan"
          />
        </div>
      );
    case "retry":
      return (
        <div>
          <RescanControl domain={p.domain} label={copy("control.retry")} incomplete={false} testId="report-retry" />
        </div>
      );
    default: {
      const exhaustive: never = control;
      return exhaustive;
    }
  }
}

/** The lines a problem's fix carries — the paste arm's, and no other. */
function pasteLinesOf(cards: readonly ProblemCard[], problem: ProblemName): readonly string[] | undefined {
  const fix = cards.find((card) => card.problem === problem)?.fix;
  return fix?.kind === "paste" ? fix.lines : undefined;
}

/** Where the business sells, as a badge where it names a place or a country
 *  of its own; an international or unread reach is a line under the badges,
 *  and a local one with no town is the market's own badge already. */
function whereOf(understanding: BusinessUnderstanding | null): { badge: string | null; line: string | null } {
  if (understanding === null) return { badge: null, line: null };
  const { where } = understanding;
  if (where.place !== null || where.reach === "national") return { badge: whereLine(where), line: null };
  if (where.reach === "international" || where.reach === null) return { badge: null, line: whereLine(where) };
  return { badge: null, line: null };
}

/** What the scan read the business as, one badge each: what it is, who
 *  buys, where, and the market it was measured in. A field nothing was read
 *  for draws no badge. */
function readAsOf(report: StoredReport, understanding: BusinessUnderstanding | null, where: string | null): string[] {
  const category = categoryOf(report.market);
  const kind = understanding?.kind == null ? null : copy(`report.read.as.kind.${understanding.kind}`);
  const what = category !== null && kind !== null ? copy("report.read.as.what", { category, kind }) : (category ?? kind);
  const measured = measuredLocale(report);
  const locale = copy("report.read.as.locale", {
    language: new Intl.DisplayNames(REPORT_TAG, { type: "language" }).of(measured.language) ?? measured.language,
    country: new Intl.DisplayNames(REPORT_TAG, { type: "region" }).of(measured.country) ?? measured.country,
  });
  return [
    ...(what === null ? [] : [what]),
    ...(understanding?.buyers[0] === undefined ? [] : [understanding.buyers[0]]),
    ...(where === null ? [] : [where]),
    locale,
  ];
}

/** Owner A3 (2026-10-19): the pages the report found, under their count,
 *  ahead of the offer that writes them (board PubReport). */
function MissingPagesSection(p: { pages: readonly MissingPage[] | null; freeSearch: string | null }): React.JSX.Element | null {
  const found = p.pages?.length ?? 0;
  if (p.pages === null || found === 0) return null;
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <p className="eyebrow">{copy("report.missing.eyebrow")}</p>
      <h2 className="text-3xl font-bold">
        {copy(found === 1 ? "report.offer.found.one" : "report.offer.found", { count: String(found) })}
      </h2>
      <MissingPagesList pages={p.pages} freeSearch={p.freeSearch} />
    </section>
  );
}

/** The offer names the missing pages where the report measured some, and
 *  keeps a free path to the first page where there is one. */
function offerOf(
  report: StoredReport,
  cards: readonly ProblemCard[]
): { heading?: string; line?: string; free?: React.ReactNode } {
  const missing = cards.find((card) => card.problem === "missing_pages")?.count;
  const named = missing !== undefined && missing.kind === "measured" && missing.value > 0;
  return {
    ...(named
      ? { heading: copy("offer.found.heading"), line: copy("offer.found.line", { weekPages: String(WEEK_PLAN.days) }) }
      : {}),
    ...(report.freePage === null
      ? {}
      : {
          free: (
            <a href="#first-page" className="link link-primary text-center text-sm" data-testid="report-free-path">
              {copy("report.offer.free-path")}
            </a>
          ),
        }),
  };
}

/** SPEC §2: a part is cut off when the pass stopped at one of its two
 *  ceilings — not when it finished, failed, or could not read the site. */
function cutByCeiling(report: StoredReport): boolean {
  return report.stoppedReason === "time_ceiling" || report.stoppedReason === "spend_ceiling";
}

export function ReportView(p: {
  state: {
    report: StoredReport;
    notice: AddressNotice | null;
    control: AddressControl;
    correction: CorrectionOffer;
    readsDifferently?: boolean;
    writtenPage?: WrittenPage;
  };
  checkoutRefused?: boolean;
}): React.JSX.Element {
  const { report, notice, control, correction } = p.state;
  const measuredOn = formatMeasuredOn(report.verdict.measuredAt);
  const measurement = measurementLine(report);
  const rescored = rescoredOf(report);
  const cards = cardsOf(report, unblockLines(report.blockedAgents));
  const cutOff = cutByCeiling(report);
  const missingPages = missingPagesOf(report);
  const profile = profileOfReport(report);
  const understanding =
    profile === null ? null : understandBusiness({ domain: report.domain, profile, locale: measuredLocale(report) });
  const where = whereOf(understanding);

  return (
    // ADR-093 decision 6: the report is a screen, so it is a screen root,
    // and its three band arms are declared rather than defaulted. Compact
    // is one column — §4.1's "two equal cards, side by side" and the
    // three-card grid both stack. Medium is where they sit side by side.
    // Wide adds no further structural change to this screen, so it says
    // so rather than repeating the arm below it.
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "columns", count: 2 },
        wide: { kind: "same-as-below" },
      }}
    >
      {/* 2026-09-07, issue #241: the arm draws the columns. This screen
          declares `medium: columns:2`, and until `surface.css` existed that
          declaration rendered nothing — so the two-up rows carried their own
          `lg:grid-cols-2`, the same 1024px boundary written a second time,
          and the column's own width and air were three raw values
          (`max-w-[1060px]`, `mx-auto`, `p-6`) beside the two ruled measures.
          All of it is the container's now: `--w-wide` 1216px is
          `design/tokens.md` §2b's "multi-column content column — the public
          report's six modules", which is this screen by name.

          `<main>` stays the landmark and spans the arm's tracks, and
          `grid-cols-subgrid` puts the rows below on *those* tracks rather
          than on a second set of its own: the two-up cards take one track
          each, and a row that spans the screen says so once, in
          `col-span-full`. At compact the grid is one column and every span
          is a no-op. `display: contents` would read the same and is wrong
          here — an element with no box has no border box for conformance
          check 2 to contain its children in, so every row reported as
          escaping. */}
      {/* The rows stretch (#1068, the calm layer's "cards in a row stretch
          to one height"): the AI-answers and Google-search cards stand at
          one height. It was `items-start` (#244), because daisyUI's
          `.card-body p { flex-grow: 1 }` handed a shorter card's slack to
          its paragraphs; every paragraph directly in those two card bodies
          is `grow-0`, so the slack now sits under the card's last line. */}
      <main className="col-span-full grid grid-cols-subgrid gap-y-5">
        {/* REQ-001 c14: the notice and the one control that answers it sit
          together, so a visitor reads what happened and what they can do
          about it in one place. */}
        <div className="col-span-full flex flex-col gap-3">
          {notice !== null && notice.kind === "incomplete" && control.kind === "rescan" ? (
            <IncompleteNotice domain={report.domain} unmeasured={notice.unmeasured} control={control} />
          ) : (
            <>
              <NoticeLine notice={notice} />
              <ControlButton domain={report.domain} control={control} />
            </>
          )}
        </div>

        {/* The copy control is in the header's bar (UI-SPEC S2, issue #357),
            once, on the screen that owns the address. */}
        <div className="col-span-full">
          <VerdictStrip
            verdict={report.verdict}
            category={categoryOf(report.market)}
            measuredOn={measuredOn}
            correction={correction}
            {...(measurement === null ? {} : { measurement })}
            {...(rescored === null ? {} : { rescored: { on: formatMeasuredOn(rescored.at), before: rescored.before } })}
            readAs={readAsOf(report, understanding, where.badge)}
            notes={
              <>
                {where.line === null ? null : (
                  <p className="text-base-content/70 text-sm" data-testid="report-read-where">
                    {where.line}
                  </p>
                )}
                <MeasuredInLine report={report} />
                <AlsoServesLine report={report} />
                <MarketFromSearchLine report={report} />
              </>
            }
            seeMissing={(missingPages?.length ?? 0) > 0 || (report.supply.missingPages.kind === "measured" && report.supply.missingPages.value > 0)}
          />
        </div>
        <FinishingReadsLine report={report} />
        <ReadsDifferentlyLine report={report} shown={p.state.readsDifferently === true} />

        {/* Issue 715: an absent card carries the address its retry posts
            to; the route asks `retryOffer` again from the row's own facts. */}
        <BuyersSection ai={report.aiAnswers} presence={report.presence}>
          {report.aiAnswers === null ? (
            <AiAnswersAbsent cutOff={cutOff} domain={report.domain} />
          ) : (
            <AiAnswersCard section={report.aiAnswers} serps={report.serps} />
          )}
          {report.presence === null ? (
            <GooglePresenceAbsent cutOff={cutOff} domain={report.domain} />
          ) : (
            <GooglePresenceCard section={report.presence} />
          )}
        </BuyersSection>

        {/* SPEC §2 (owner, 2026-10-07, issue 1328): the offer is the fourth
            thing on the report, under the score and the two results, and
            everything longer opens from below it. Issue #785: Start buys
            from this report — its scan is the checkout's origin, so the
            site is provisioned on this domain. #1068: the report's price
            close spans the screen, its heading and terms beside the price. */}
        <div id="start" className="col-span-full flex scroll-mt-20 flex-col gap-8">
          <MissingPagesSection pages={missingPages} freeSearch={report.freePage?.target.keyword ?? null} />
          <PricingCard
            startAction={startReportCheckout.bind(null, report.domain, report.scanId)}
            refused={p.checkoutRefused === true}
            close
            {...offerOf(report, cards)}
          />
        </div>

        <p className="eyebrow col-span-full">{copy("report.rest.eyebrow")}</p>

        {/* What holds you back (#1068): the three that cost most as cards,
            then SPEC §9's eight checks as one list (#570) — a check that
            could not run has a grey dot and its why-line. Closed under its
            own name since issue 1328: daisyUI `collapse` on a `details`, so
            it is in the first response and opens with no script. `px-px`
            keeps the cards' 1px ring inside the collapse's clip. */}
        <details id="holds" className="collapse collapse-arrow col-span-full scroll-mt-20 rounded-none" data-testid="report-problems">
          <summary className="collapse-title min-h-0 px-px py-2 pe-10 after:end-2 after:top-6">
            <div className="flex items-center gap-3">
              <span aria-hidden className="rounded-field grid size-9 shrink-0 place-items-center bg-base-200">
                <Wrench className="size-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <h2 className="text-2xl font-bold">{copy("problem.section.title")}</h2>
                <p className="text-base-content/70 text-sm font-normal">{copy("problem.section.sub")}</p>
              </div>
            </div>
          </summary>
          <div className="collapse-content flex min-w-0 flex-col gap-3 px-px">
            <ProblemCards cards={cards} firstPage={report.freePage !== null} />
            <CheckCards
              cards={checkCardsOf(
                readingsOf(report.siteIssues, report.verdict.measuredAt),
                identityReading(report.siteIssues, report.onPage.kind === "unmeasured" ? null : report.onPage.value.schemaTypes)
              )}
            />
          </div>
        </details>
        {/* The method: three sections, each closed, where each problem
            card's link lands — following one opens the section it is in. */}
        <div className="col-span-full">
          <MethodSections
            for={PROBLEM_ORDER}
            lines={{ blocked_readers: pasteLinesOf(cards, "blocked_readers") }}
            readers={{
              snippetPages: answerReadersOf(report).snippetPages,
              trainingOptOut: trainingOptOutOf(report.robots),
            }}
          />
        </div>

        {/* Issue 1454: what the scan read of the business, in full, where the
            board puts it — after the method, before the first page. */}
        {understanding === null ? null : (
          <div className="col-span-full">
            <ReadSection understanding={understanding} correction={correction} />
          </div>
        )}

        {/* The giveaway is a full-width row (UI-SPEC S2). The proposal is
            closed under the card's own name (issue 1328); a report with no
            page to propose is not closed, because its one line is the whole
            of what the section says. */}
        <div className="col-span-full">
          {report.freePage === null ? (
            <FreePageAbsent cutOff={cutOff} domain={report.domain} />
          ) : (
            <FreePageCard
              section={report.freePage}
              question={storedQuestionOf(report, report.freePage.target.keyword)}
              scanId={report.scanId}
              domain={report.domain}
              written={p.state.writtenPage}
            />
          )}
        </div>

        <div className="text-base-content/70 col-span-full text-center text-xs">
          <RemovalAddressLine />
        </div>
      </main>
    </Surface>
  );
}
