// src/lib/presentation/copy/keys/report.ts — BP-020 decision 5, WO-041; the
// eight landing keys added by WO-070.
//
// The report surface's sentences. One key seeded (WO-041 step 3): the
// no-presence-yet line for the first page of the rival list, seeded as an
// empty value, owner-owed (constitution §1: customer-visible strings are
// the owner's). The block that owns the report surface fills
// every other sentence this surface needs.
//
// WO-070 adds the landing page's eight keys here rather than in a
// thirteenth partition (constitution rule 2.2/BP-020 decision 5's own
// reasoning, applied the same way WO-249 applied it to `laws.ts`): BP-022
// is "the leaf that owns the landing field, the report address, and
// everything that decides what loads there" (BP-022 `## Responsibility`)
// — one node, one partition file, so the landing headline, field label,
// submit label and the five `DomainProblem` lines (`src/lib/scan/domain.ts`,
// WO-051) sit beside the one key this surface already owned.
//
// 2026-09-03: the owner ruled on the headline, field label and submit
// label (WO-070 `## Log`, "landing copy approved"; strings per `BUILD.md`
// §3) — those three are filled verbatim, byte for byte, and no longer
// owner-owed.
//
// 2026-09-04: the owner ruled on the five `DomainProblem` lines (WO-070
// `## Log`, this date's ruling) — filled verbatim, byte for byte. All
// eight landing keys are now supplied; none is owner-owed. No `law` tag
// on any of the eight: none of `CopyMeta.law`'s four cross-cutting arms
// names this surface.
//
// 2026-09-04, separately: the owner also ruled on this file's other key,
// `place.report.first-page.rival` (WO-041 `## Log`, this date's ruling) —
// filled verbatim, byte for byte. Every key this partition declares now
// has a string; none is owner-owed.
//
// 2026-09-04, separately again: WO-278 (BP-024 decision 6, rule 1.1 — see
// `## Decision taken under rule 1.1`) adds the three `verdict.limiting.*`
// keys `LIMITING_LINES` (`src/lib/presentation/bands.ts`) resolves — one
// per `ScoreFactorName`. They ship owner-owed and empty: the one written
// line REQ-004 criterion 2 requires is a customer-visible string and
// therefore the owner's (constitution §1). No sentence is written here.
//
// 2026-09-04, separately again: WO-287 (owner ruling 2026-09-04, sheet 2 —
// `registry/evidence/RULING-copy-2026-09-04.json`) fills the three
// `verdict.limiting.*` values above, filled verbatim, byte for byte; none
// is owner-owed any longer. The same ruling adds thirteen new keys for the
// report address's own sentences — `removal.*`, `notice.*`, `control.*`
// and `copy-link.label` — the gap the design-guardian named on WO-282's
// v1 preview (its `## Log`, 2026-09-04 preview line). They land in this
// partition rather than a thirteenth (constitution rule 2.2/BP-020
// decision 5, the same reasoning WO-070 and WO-249 already applied here
// and to `laws.ts`): BP-022 owns the report address, and `report.ts` is
// its partition. No `law` tag on any of the thirteen: none of
// `CopyMeta.law`'s four cross-cutting arms names this surface.
//
// 2026-09-05, issue #13: the free report screen's own modules — the verdict
// strip's provenance line, the AI-answers card, the Google-presence card,
// the three problem cards, the three DIY sections and the free-page card
// (`BUILD.md` §4.1 modules 1 to 5, as amended by DECISIONS 2026-09-03 —
// no driver bars, no per-question volume, no market-total footnote). They
// land in this partition for the reason WO-070, WO-249 and WO-287 already
// landed theirs here: BP-022 owns the report address and `report.ts` is
// its partition (BP-020 decision 5 / constitution rule 2.2).
//
// Every one of them shipped with the value `TODO(copy)` — `CLAUDE.md`'s
// standing rule for this repo ("add the key, leave the value `TODO(copy)`,
// flag it in the PR") — until the owner approved their sentences on
// 2026-09-10 (#459).
//
// Module 6, the pricing card, mints nothing: its eight sentences are
// `offer.ts`'s `price.*`/`offer.*` keys, already ruled 2026-09-04.
//
// 2026-09-10, issue #459: the owner approved the drafted copy for
// every key this partition still owed ("copy proposal approved"; proposal
// sheet artifact 546f45a0-a996-4d25-b85e-fb03fda7b102), and the 64 approved
// strings are applied here byte for byte. Where a note above or below says
// a key ships owed, that was its standing before this date.
//
// 2026-09-11, issue #516: the two keys #459 left — `notice.site-unreadable`,
// which #479 minted after that approval, and `landing.step.3.title`, whose
// approved-set string promised a page a day the Autopilot brief rules out
// (DECISIONS 2026-09-10) — carry the owner's strings of that date
// (DECISIONS 2026-09-11), byte for byte. No key in this partition is
// owner-owed or `TODO(copy)` any more.
import type { CopyPartition } from "../registry.ts";

export const REPORT_COPY = Object.freeze({
  // Issue 1444 (owner, 2026-10-15): the biggest gap is a short title naming
  // the bar, and one line under it saying what that bar is. Presence shows
  // as its two bars, Google and AI; `.presence` is a stored report whose two
  // halves were not kept.
  "verdict.limiting.foundations": ["Biggest gap: Readiness", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "verdict.limiting.foundations.line": ["Google and AI can’t fully read your site.", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "verdict.limiting.answerability": ["Biggest gap: Content", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "verdict.limiting.answerability.line": ["Your pages don’t answer buyers’ questions directly.", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "verdict.limiting.google": ["Biggest gap: Google", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "verdict.limiting.google.line": ["You’re rarely on the first page of buyers’ searches.", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "verdict.limiting.ai": ["Biggest gap: AI", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "verdict.limiting.ai.line": ["AI answers rarely mention you.", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "verdict.limiting.presence": ["Biggest gap: Google and AI", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "verdict.limiting.presence.line": ["Buyers rarely find you on Google or in AI answers.", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "removal.address": ["remove@reachkit.app", { slots: {}, fixedBy: "REQ-002 c1" }],
  "removal.line.on-report": ["Own this site and want this report taken down? Write to {address}.", { slots: { address: "text" }, fixedBy: "REQ-002 c1" }],
  "removal.line.removed": ["This report was removed at the site owner’s request. To make {domain} scannable again, write to {address}.", { slots: { domain: "text", address: "text" }, fixedBy: "REQ-002 c3" }],
  "notice.incomplete": ["This report is incomplete: {what} wasn’t measured.", { slots: { what: "text" }, fixedBy: "REQ-001 c14" }],
  "notice.measurement-failed": ["The last measurement didn’t finish, so nothing new was stored.", { slots: {}, fixedBy: "REQ-001 c16" }],
  "notice.correction-failed": ["The correction didn’t finish. This is the report from before it.", { slots: {}, fixedBy: "REQ-094 c7" }],
  // #479. The pass could not read the site's own home page — the fetcher
  // refused it (too large, no answer, blocked) — so nothing after it was
  // attempted and the report stops there. Owner-owed until 2026-09-11, when
  // the owner approved this sentence (#516).
  "notice.site-unreadable": ["We couldn’t read this site’s home page, so nothing here could be measured. Check the address and scan again.", { slots: {}, fixedBy: "REQ-004 c6" }],
  // Issue 1379. The site's bot protection answered our reader with a page of
  // its own, so the site's own pages are unmeasured: never a zero, never
  // that page's facts. Drafted in this registry’s voice and shipped under
  // the owner ruling of 2026-09-16 (#759); the owner corrects the wording.
  "notice.bot-protected": ["This site’s bot protection blocked our reader, so its pages aren’t scored.", { slots: {}, fixedBy: "SPEC §2 · issue 1379" }],
  // SPEC §2 (owner, 2026-10-10, issue 1387): where the market was read from
  // the site's listing in search. Drafted (#759).
  // SPEC §2 (owner, 2026-10-15, issue 1440): the searches a free scan left
  // unread are being read in the background. Short on purpose (the issue's
  // own words). Drafted (#759).
  "report.finishing-reads": ["Still reading {count} searches…", { slots: { count: "text" }, fixedBy: "SPEC §2 · issue 1440" }],
  "report.finishing-reads.one": ["Still reading {count} search…", { slots: { count: "text" }, fixedBy: "SPEC §2 · issue 1440" }],
  // SPEC §2 (issue 1481): the deployed code would read this stored scan
  // differently and the re-score has not rewritten it yet. Drafted (#759).
  "report.reads-differently": ["Read on {date}. How ReachKit reads a site has changed since, and this report hasn’t been read again yet.", { slots: { date: "text" }, fixedBy: "SPEC §2 · issue 1481" }],
  // SPEC §2 (issue 1450): the site's pages were read and the model gave no
  // profile of them, so the market was read from its listing. Short on
  // purpose (master review on #1451). Drafted (#759).
  // Issue 1454: what ReachKit read of the business, in one short card on
  // the free report and on the app's Overview. Drafted (#759).
  "report.read.title": ["What we read", { slots: {}, fixedBy: "SPEC §2 · issue 1454" }],
  "report.read.name": ["Name", { slots: {}, fixedBy: "SPEC §2 · issue 1454" }],
  "report.read.sells": ["What you sell", { slots: {}, fixedBy: "SPEC §2 · issue 1454" }],
  "report.read.buyers": ["Who buys", { slots: {}, fixedBy: "SPEC §2 · issue 1454" }],
  "report.read.where": ["Where", { slots: {}, fixedBy: "SPEC §2 · issue 1454" }],
  "report.read.where.local": ["In and around {place}", { slots: { place: "text" }, fixedBy: "SPEC §2 · issue 1454" }],
  "report.read.where.national": ["Across {country}", { slots: { country: "text" }, fixedBy: "SPEC §2 · issue 1454" }],
  "report.read.where.international": ["Online, in more than one country", { slots: {}, fixedBy: "SPEC §2 · issue 1454" }],
  "report.read.where.measured": ["Measured in {country}", { slots: { country: "text" }, fixedBy: "SPEC §2 · issue 1454" }],
  "report.read.where.unread": ["Not read yet. Measured in {country}", { slots: { country: "text" }, fixedBy: "SPEC §2 · issue 1470" }],
  "report.read.kind": ["What it is", { slots: {}, fixedBy: "SPEC §2 · issue 1470" }],
  "report.read.kind.local-service": ["A local service, carried out in person", { slots: {}, fixedBy: "SPEC §2 · issue 1470" }],
  "report.read.kind.shop": ["A shop", { slots: {}, fixedBy: "SPEC §2 · issue 1470" }],
  "report.read.kind.hospitality": ["A restaurant, café, bar or hotel", { slots: {}, fixedBy: "SPEC §2 · issue 1470" }],
  "report.read.kind.professional-services": ["A firm or agency", { slots: {}, fixedBy: "SPEC §2 · issue 1470" }],
  "report.read.kind.software": ["Software or an online service", { slots: {}, fixedBy: "SPEC §2 · issue 1470" }],
  "report.read.kind.creator": ["Courses, teaching or writing", { slots: {}, fixedBy: "SPEC §2 · issue 1470" }],
  "report.read.none": ["Not read yet", { slots: {}, fixedBy: "SPEC §2 · issue 1454" }],
  "report.read.edit": ["Correct it in Settings", { slots: {}, fixedBy: "SPEC §4 · issue 1454" }],
  "report.market.from-listing": ["Market read from the site’s Google listing.", { slots: {}, fixedBy: "SPEC §2 · issue 1450" }],
  "report.market.from-search": ["Market read from Google, because the site’s pages couldn’t be read.", { slots: {}, fixedBy: "SPEC §2 · issue 1387" }],
  // Issue 898. The site read and its market did not — the profile call or
  // the suggestions did not answer — so there is no question, no answer
  // card and no band. Distinct from `notice.incomplete`, which names
  // drivers that were not measured while others were; here nothing was
  // measured from the market at all, and naming a driver would name the
  // consequence rather than the cause. Drafted in this registry’s voice
  // and shipped under the owner ruling of 2026-09-16 (#759); the owner
  // corrects the wording.
  "notice.market-unread": ["We couldn’t read this site’s market, so there’s no report yet. Scan again in a moment.", { slots: {}, fixedBy: "SPEC §2 · issue 898" }],
  "notice.refused.network-limit": ["That’s five scans from your network this hour. You can scan again in {wait}.", { slots: { wait: "text" }, fixedBy: "REQ-003 c6" }],
  // Issue 885's two free-path bounds. Drafted in this registry’s voice and
  // shipped under the owner ruling of 2026-09-16 (#759); the owner corrects
  // the wording. Neither borrows `network-limit`’s sentence: that one names
  // the hour and the five, and the day bound is neither — and the domain
  // bound is not about the visitor’s network at all, so a sentence that
  // said "from your network" would be telling a stranger they had done
  // something they had not.
  "notice.refused.network-day-limit": ["Your network has used today’s free scans. You can scan again in {wait}.", { slots: { wait: "text" }, fixedBy: "SPEC §2 · issue 885" }],
  "notice.refused.domain-day-limit": ["This address has had all its scans for today. Scan again in {wait}.", { slots: { wait: "text" }, fixedBy: "SPEC §2 · issue 885" }],
  "notice.refused.scan-running": ["A scan is already running from your network. It finishes in about {wait}, then this one can start.", { slots: { wait: "text" }, fixedBy: "REQ-003 c7" }],
  // #104. ReachKit's own stop, in writing — the one refusal the visitor
  // did not cause and the only one that names no wait, because nobody can
  // say when we start again (ADR-011).
  "notice.refused.stopped": ["Free scanning is paused for now. Every stored report stays readable.", { slots: {}, fixedBy: "REQ-003 c12" }],
  "control.rescan-age": ["Scan again", { slots: {}, fixedBy: "REQ-001 c15" }],
  "control.rescan-incomplete": ["Scan what’s missing", { slots: {}, fixedBy: "REQ-001 c14" }],
  "control.retry": ["Try again", { slots: {}, fixedBy: "REQ-001 c16" }],
  // Issue 715: the control on a part the pass's ceiling cut off — SPEC §2
  // quotes the words.
  "control.retry-part": ["Retry this part", { slots: {}, fixedBy: "SPEC §2 · issue 715" }],
  "copy-link.label": ["Copy link", { slots: {}, fixedBy: "REQ-001 c7" }],

  // ── Module 1, the verdict strip (BUILD §4.1) ──────────────────────────
  // The domain and the date ride beside the score so it is never a bare
  // specimen number (REQ-004 c1).
  // The four bars, named as subjects (issue 1444): Readiness, Content, and
  // Presence shown as its two halves, Google and AI. `LIMITING_LINES` holds
  // the *sentence* about a bar; these hold the bar's own name, for the
  // `{what}` slot of `unmeasured.undeterminable` / `.not-attempted`
  // (REQ-004 c3). `.presence` names both halves at once, where a stored
  // report kept Presence and not its halves.
  "verdict.factor.foundations": ["Readiness", { slots: {}, fixedBy: "REQ-004 c3 · issue 1444" }],
  "verdict.factor.answerability": ["Content", { slots: {}, fixedBy: "REQ-004 c3 · issue 1444" }],
  "verdict.factor.google": ["Google", { slots: {}, fixedBy: "REQ-004 c3 · issue 1444" }],
  "verdict.factor.ai": ["AI", { slots: {}, fixedBy: "REQ-004 c3 · issue 1444" }],
  "verdict.factor.presence": ["Google and AI", { slots: {}, fixedBy: "REQ-004 c3 · issue 1444" }],
  // The `{wait}` the two refusal lines take: the figure is the refusal's
  // own `retryAfterSeconds` in whole minutes, the unit word is the
  // owner's, so no duration is composed in a component.
  "report.wait.minutes": ["{minutes} min", { slots: { minutes: "text" }, fixedBy: "REQ-003 c6" }],
  // S2's provenance line under the domain: "measured 28 Aug · [category] ·
  // Not your market?" — approved as written (11a), less the two parts that
  // are not this key's: the category is a measured value and the
  // correction is a control. Two arms, because a scan that never
  // determined a category names none and guesses none (REQ-094 c1).
  "report.measured-at": ["measured {date} · {category}", { slots: { date: "text", category: "text" }, fixedBy: "REQ-004 c1" }],
  "report.measured-at.no-category": ["measured {date}", { slots: { date: "text" }, fixedBy: "REQ-094 c1" }],
  // Issue 715: SPEC §2 — "Measurement is US Google in English, stated in one
  // always-visible line." Owner-owed.
  "report.measurement": ["Measured in US Google, in English.", { slots: {}, fixedBy: "SPEC §2 · issue 715" }],
  // 6a: "Discoverability Score" is the number's name on every surface that
  // labels it — this eyebrow, the Overview tile, and the two mails.
  "verdict.score.label": ["Visibility Score", { slots: {}, fixedBy: "ruling 6a" }],
  // Issue 1068, board R12-2: the summary card's eyebrow and what the ring's
  // figure is out of. Drafted; the owner corrects the wording.
  "report.eyebrow": ["Your free report", { slots: {}, fixedBy: "issue 1068" }],
  "verdict.score.of": ["of 100", { slots: {}, fixedBy: "issue 1068" }],
  // Issue 1439: how sure the score is, beside it — the scores its range
  // allows. Drafted; the owner corrects the wording.
  "verdict.estimate.rough": ["rough estimate ({low}–{high})", { slots: { low: "text", high: "text" }, fixedBy: "issue 1439" }],
  "verdict.estimate.close": ["close estimate ({low}–{high})", { slots: { low: "text", high: "text" }, fixedBy: "issue 1439" }],
  // REQ-094 c1's correction control, as S2 draws it. #786 gives it its
  // destination: an inline field that posts the corrected market to
  // `POST /api/report/{domain}/correct` and follows the rerun's stages.
  "verdict.not-your-market": ["Not your market?", { slots: {}, fixedBy: "REQ-094 c1" }],
  // #786: the field, its line and its outcomes. Drafted in the registry's
  // voice under the 2026-09-16 ruling (#759) — named in the PR for the
  // owner to correct.
  "correction.field.label": ["Your market, in a few words", { slots: {}, fixedBy: "SPEC §2 · issue 786" }],
  "correction.submit": ["Scan again for this market", { slots: {}, fixedBy: "SPEC §2 · issue 786" }],
  "correction.cancel": ["Cancel", { slots: {}, fixedBy: "SPEC §2 · issue 786" }],
  "correction.line": [
    "You can correct the market once. The AI answers already read are reused.",
    { slots: {}, fixedBy: "SPEC §2 · issue 786" },
  ],
  "correction.running": [
    "Scanning again for the market you gave. This report updates when it finishes.",
    { slots: {}, fixedBy: "SPEC §2 · issue 786" },
  ],
  "correction.refused.running": ["A correction is already running for this report.", { slots: {}, fixedBy: "SPEC §2 · issue 786" }],
  "correction.refused.used": ["This report’s one correction has already been used.", { slots: {}, fixedBy: "SPEC §2 · issue 786" }],
  "correction.refused.too-old": [
    "This report is too old to correct. Scan it again instead.",
    { slots: {}, fixedBy: "SPEC §2 · issue 786" },
  ],
  "correction.refused.unavailable": [
    "The correction couldn’t start, and nothing was used. Try again in a few minutes.",
    { slots: {}, fixedBy: "SPEC §2 · issue 786" },
  ],

  // ── The scanning arm's six named stages (REQ-003 c1) ──────────────────
  // One key per `StageName` (`src/lib/scan/stages.ts`) — a stage with no
  // word cannot render, which is what makes "named stages, never an
  // unlabelled spinner" structural. WO-282 left these to BP-023's own
  // file plan; nothing created them, and the scanning arm cannot render
  // without them, so they are minted here with the rest of this surface.
  "stage.reading_your_site": ["Reading your site", { slots: {}, fixedBy: "REQ-003 c1" }],
  "stage.reading_access_rules": ["Reading your access rules", { slots: {}, fixedBy: "REQ-003 c1" }],
  "stage.reading_your_market": ["Finding your market and competitors", { slots: {}, fixedBy: "REQ-003 c1" }],
  "stage.checking_your_presence": ["Checking the 12 biggest searches", { slots: {}, fixedBy: "REQ-003 c1" }],
  "stage.asking_the_twelve": ["Asking AI the 12 searches", { slots: {}, fixedBy: "REQ-003 c1" }],
  "stage.scoring": ["Scoring", { slots: {}, fixedBy: "REQ-003 c1" }],
  // The elapsed time the approved set draws beside a finished stage, and
  // the one line the scanning screen ends on (S3, approved under 11a).
  "stage.elapsed": ["{seconds} s", { slots: { seconds: "text" }, fixedBy: "REQ-003 c1" }],
  "scan.waiting.line": [
    "Under a minute. This address is permanent — you can come back to it.",
    { slots: {}, fixedBy: "REQ-003 c1" },
  ],
  /** The line above the stages when a re-measure was started *from* a
   *  report that is already on screen (#935). It is not
   *  `scan.waiting.line` — that one tells a first-time visitor the address
   *  survives the wait, which this reader already knows — and it is not
   *  `correction.running`, which names the market they gave. Drafted under
   *  the owner's 2026-09-16 ruling (#759), in this registry's voice. */
  "scan.rescanning.line": [
    "Scanning again. This report updates when it finishes.",
    { slots: {}, fixedBy: "issue 935 · drafted" },
  ],

  // ── Module 2, left card — AI answers (REQ-006) ────────────────────────
  "ai-answers.title": ["AI", { slots: {}, fixedBy: "REQ-006 c1" }],
  "ai-answers.source": ["Google AI answers · {date}", { slots: { date: "text" }, fixedBy: "REQ-006 c9" }],
  // Issue 715: SPEC §2 — a category correction reuses the AI answers already
  // read, "and says so". Owner-owed.
  "ai-answers.coverage.cached-only": [
    "These AI answers were reused from an earlier scan.",
    { slots: {}, fixedBy: "SPEC §2 · issue 715" },
  ],
  /* Issue 715, owner ruling 2026-09-22 — the mark on answers a recent scan
     had already paid for. A second scan of the same address inside §6.4's
     SERP window is answered out of `fetches`: it spends nothing, which is
     the point of the window, and until now the card put today's date on
     those answers and said nothing about where they came from.

     The date is the ledger row's own (`AiAnswersSection.reusedFrom`),
     never a guess and never the report's measurement date — the report was
     read today, the answers were not. Where answers on one card came from
     more than one day it is the oldest of them, so the mark never claims
     an answer is fresher than it is.

     Drafted in this registry's voice under the 2026-09-16 ruling (#759);
     the owner corrects the wording. */
  "ai-answers.reused-from": ["Reused from {date}", { slots: { date: "text" }, fixedBy: "SPEC §2 · issue 715" }],
  /* Issue 715, owner ruling 2026-09-22 — what "Retry this part" says while
     it runs, and the three ways it can be turned down. Handles come off
     `RetryRefusal` (`src/lib/scan/retry.ts`) and become sentences here,
     never in the component.

     None of them borrows the correction's lines: a correction is a market
     the reader gave us and spends one of two attempts, and a retry is one
     part of a measurement we did not finish and spends only money the
     report's own 12¢ still holds. Saying so in the same words would tell a
     reader they had used something they had not.

     Drafted in this registry's voice under the 2026-09-16 ruling (#759);
     the owner corrects the wording. */
  "retry-part.running": [
    "Scanning this part again. This report updates when it finishes.",
    { slots: {}, fixedBy: "SPEC §2 · issue 715" },
  ],
  "retry-part.refused.no-budget": [
    "This scan has used its budget, so this part can’t be scanned again. Scan the whole site again instead.",
    { slots: {}, fixedBy: "SPEC §2 · issue 715" },
  ],
  "retry-part.refused.already-measured": [
    "This part has already been scanned. Reload the report to see it.",
    { slots: {}, fixedBy: "SPEC §2 · issue 715" },
  ],
  "retry-part.refused.unavailable": [
    "This part couldn’t be scanned again just now, and nothing was spent. Try again in a few minutes.",
    { slots: {}, fixedBy: "SPEC §2 · issue 715" },
  ],
  // Issue 1444: the card's figure is `{count} of {total}` (`report.figure.of`)
  // — the answers that mention the customer of those that appeared — and
  // this is the one line under it.
  "ai-answers.finding": ["AI answers that mention you", { slots: {}, fixedBy: "issue 1068 · issue 1444" }],
  // Issue 1439: AI answered none of the searches read, so AI presence is not
  // judged and the score counts search alone. Short, as titles are (#1444).
  "ai-answers.finding.unanswered": ["AI doesn't answer these searches yet.", { slots: {}, fixedBy: "issue 1439" }],
  // REQ-006 c6's one written line: what was measured, and no second
  // engine named anywhere on the card. S2 draws it as the source chip at
  // the foot of the card.
  // Issue 873: the count is the pass's, never the literal twelve. A free
  // pass asks as many questions as its market yielded and its purse can pay
  // to ask, so a card that said "12" over nine rows was stating a number
  // the report did not have.
  "ai-answers.method": [
    "= your market’s {total} biggest searches, asked as a buyer asks AI.",
    { slots: { total: "text" }, fixedBy: "REQ-006 c9 · issue 873" },
  ],
  "ai-answers.questions.title": ["The {total} searches", { slots: { total: "text" }, fixedBy: "REQ-006 c9 · issue 873" }],
  // Issue 873: what this report measured, in one line, so a founder does
  // not count rows to find out.
  "ai-answers.questions.measured": [
    "This report measured {measured} of these {total} searches.",
    { slots: { measured: "text", total: "text" }, fixedBy: "issue 873" },
  ],
  // Issue 1309: a pass that found more questions than its purse or its 50 s
  // could measure lists them all, so the list's count is not the report's
  // measured count. These two say which is which; the pair above stays for
  // a report that measured every question it lists.
  "ai-answers.questions.title.partial": ["Searches measured: {measured} of {total}", { slots: { total: "text", measured: "text" }, fixedBy: "issue 1309 · drafted" }],
  "ai-answers.questions.measured.partial": [
    "Of the {total} found, this report measured {measured} searches. One marked “not measured” counts nowhere here.",
    { slots: { measured: "text", total: "text" }, fixedBy: "issue 1309 · drafted" },
  ],
  "ai-answers.question.not-you": ["not you", { slots: {}, fixedBy: "REQ-006 c1" }],
  "ai-answers.question.no-answer": ["no answer", { slots: {}, fixedBy: "REQ-006 c1" }],
  // REQ-006 c9's provenance pair: the search a question was derived from
  // and the brands the answer named. No `{vol}/mo` slot — the owner
  // removed per-question volume on 2026-09-03.
  // S2 draws "from: [search] · 1,900/mo · named: [brands]". The volume is
  // **not** rendered: REQ-006 c9 forbids a monthly volume "beside it or
  // anywhere else on the questions module", the owner removed it on
  // 2026-09-03, and `StoredQuestion` has no member to render it from. The
  // scaffolding either side of it is the set's, as written.
  "ai-answers.question.provenance": ["from: {search} · mentioned: {brands}", { slots: { search: "text", brands: "text" }, fixedBy: "REQ-006 c9" }],
  // §6.2's three answer columns (issue #128). The data is measured and
  // stored; the *visual* — three columns on an approved card — is the
  // design gate #128 names and lands in its follow-up, so these four are
  // the words that gate needs before it can render.
  "ai-answers.engine.ai-overview": ["Google AI Overview", { slots: {}, fixedBy: "BUILD §6.2" }],
  "ai-answers.engine.ai-mode": ["Google AI Mode", { slots: {}, fixedBy: "BUILD §6.2" }],
  "ai-answers.engine.chatgpt": ["ChatGPT", { slots: {}, fixedBy: "BUILD §6.2" }],
  // The header over the column that carries each question's number. The
  // engine columns are a table of the twelve, and the row-label column is
  // a column like the other three — a header it does not have would be an
  // invented blank, not an absent sentence (issue #157).
  "ai-answers.engine.column.question": ["Search", { slots: {}, fixedBy: "BUILD §6.2" }],
  // What a cell says where that engine's answer named the customer. The
  // approved one-column card says this by rendering *nothing* beside the
  // question — the absence of the `not-you` badge is the good news. In a
  // three-column grid a blank cell is ambiguous (a hit, or an engine
  // nobody asked?), so the positive state states itself (issue #157).
  "ai-answers.engine.cell.cited": ["mentioned you", { slots: {}, fixedBy: "BUILD §6.2" }],
  // What a column says where the engine was never asked — the free
  // report's two battery columns, and any question a ceiling stopped the
  // pass reaching. It states a fact about the measurement, never a miss.
  "ai-answers.engine.not-measured": ["not measured", { slots: {}, fixedBy: "BUILD §6.2" }],
  "ai-answers.absent": ["AI answers couldn’t be measured this time. The rest of the report stands.", { slots: {}, fixedBy: "REQ-004 c10" }],

  // ── Module 2, right card — Google presence (REQ-008) ──────────────────
  "presence.title": ["Google", { slots: {}, fixedBy: "REQ-008 c1" }],
  // Issue 1309: the count is the card's own denominator, never the literal
  // twelve — the chip said 12 over a report that measured two.
  "presence.source": ["your market’s {measured} biggest searches", { slots: { measured: "text" }, fixedBy: "REQ-008 c1 · issue 1309" }],
  // Issue 1444: the card's figure is `{count} of {total}` — the searches
  // the customer is on the first page for, of those measured — and this is
  // the one line under it. The competitors' counts are the bars.
  "presence.finding": ["Searches where you’re on the first page", { slots: {}, fixedBy: "REQ-008 c1 · issue 1444" }],
  // A figure: one count out of another, as each card's head states it.
  "report.figure.of": ["{count} of {total}", { slots: { count: "text", total: "text" }, fixedBy: "issue 1444" }],
  "presence.no-rivals": ["No competitor was found across these searches, so there’s nothing to compare yet.", { slots: {}, fixedBy: "REQ-008 c6" }],
  "presence.absent-from.title": ["5 biggest searches you’re absent from", { slots: {}, fixedBy: "REQ-008 c4" }],
  // Issue 1309: the list holds five only where the report measured five
  // searches the customer is absent from; a shorter list names no number.
  "presence.absent-from.title.short": ["Biggest searches you’re absent from", { slots: {}, fixedBy: "issue 1309 · drafted" }],
  "presence.absent-from.column.search": ["Search", { slots: {}, fixedBy: "REQ-008 c4" }],
  "presence.absent-from.column.volume": ["Volume", { slots: {}, fixedBy: "REQ-008 c4" }],
  "presence.absent-from.column.holder": ["Holds #1", { slots: {}, fixedBy: "REQ-008 c4" }],
  "presence.absent-from.empty": ["You appear in every search measured.", { slots: {}, fixedBy: "REQ-008 c4" }],
  "presence.absent": ["Google couldn’t be measured this time. The rest of the report stands.", { slots: {}, fixedBy: "REQ-004 c10" }],

  // ── Module 3, the three problem cards (REQ-009) ───────────────────────
  // One title, one doer and one measured-zero line per problem; the three
  // severity words are BANDS_COPY's `severity.*` and are not restated.
  "problem.blocked-readers.title": ["AI readers blocked", { slots: {}, fixedBy: "SPEC §9 D14 · issue 1145" }],
  "problem.blocked-readers.doer": ["Free fix · 10 min", { slots: {}, fixedBy: "REQ-009 c2" }],
  "problem.blocked-readers.none-needed": ["Nothing to fix", { slots: {}, fixedBy: "REQ-009 c3" }],
  "problem.missing-pages.title": ["Missing pages", { slots: {}, fixedBy: "REQ-009 c1" }],
  "problem.missing-pages.doer": ["ReachKit writes", { slots: {}, fixedBy: "REQ-009 c5" }],
  "problem.missing-pages.none-needed": ["Nothing to fix", { slots: {}, fixedBy: "REQ-009 c3" }],
  "problem.unquotable-pages.title": ["Pages AI can’t answer from", { slots: {}, fixedBy: "REQ-009 c1" }],
  "problem.unquotable-pages.doer": ["ReachKit rewrites on WordPress", { slots: {}, fixedBy: "REQ-009 c5" }],
  "problem.unquotable-pages.none-needed": ["Nothing to fix", { slots: {}, fixedBy: "REQ-009 c3" }],
  // The one control any fix carries (REQ-009 c2), on the paste arm only.
  "problem.paste.label": ["Copy the lines", { slots: {}, fixedBy: "REQ-009 c2" }],
  // Issue 1068, board R12-2: the section's head, each card's one-line cause,
  // and the *show me* link the card opens. Drafted; the owner corrects them.
  "problem.section.title": ["What holds you back", { slots: {}, fixedBy: "issue 1068" }],
  "problem.section.sub": ["3 that cost you most, then 8 quick checks", { slots: {}, fixedBy: "issue 1068" }],
  "problem.blocked-readers.cause": ["AI can’t use a page its reader is turned away from, or a page that forbids snippets.", { slots: {}, fixedBy: "SPEC §9 D14 · issue 1145" }],
  "problem.missing-pages.cause": ["Questions your buyers ask that no page on your site answers.", { slots: {}, fixedBy: "issue 1068" }],
  "problem.unquotable-pages.cause": ["Pages with no line an AI answer could use and link to your name.", { slots: {}, fixedBy: "issue 1068" }],
  "problem.show.lines": ["Show me the lines", { slots: {}, fixedBy: "issue 1068" }],
  "problem.show.first-page": ["See the first one", { slots: {}, fixedBy: "issue 1068" }],
  "problem.show.method": ["Show me how", { slots: {}, fixedBy: "issue 1068" }],

  // ── Module 3, the technical checks (SPEC §9, issue 571) ──────────────
  // The doer words and the measured-zero line are SPEC §9's own; the eight
  // card titles and the line for a check the scan does not run yet are
  // owner-owed.
  "check.doer.free-fix": ["Free fix · 10 min", { slots: {}, fixedBy: "SPEC §9" }],
  "check.doer.reachkit-writes": ["ReachKit writes", { slots: {}, fixedBy: "SPEC §9" }],
  "check.doer.reachkit-rewrites": ["ReachKit rewrites on WordPress", { slots: {}, fixedBy: "SPEC §9" }],
  "check.none-needed": ["Nothing to fix", { slots: {}, fixedBy: "SPEC §9" }],
  "check.not-run": [
    "This check couldn’t run this time. That isn’t the same as nothing to fix.",
    { slots: {}, fixedBy: "issue 571" },
  ],
  // Issue 1068: the eight checks are one list, and a grey dot is the not-run
  // line said once under it.
  "check.legend": ["Grey dot: this check couldn’t run this time, which isn’t the same as nothing to fix.", { slots: {}, fixedBy: "issue 1068" }],
  "check.page-titles.title": ["Missing or duplicate titles", { slots: {}, fixedBy: "issue 571" }],
  "check.meta-descriptions.title": ["Missing or duplicate descriptions", { slots: {}, fixedBy: "issue 571" }],
  "check.noindex-pages.title": ["Pages hidden from search", { slots: {}, fixedBy: "issue 571" }],
  "check.sitemap.title": ["No sitemap", { slots: {}, fixedBy: "issue 571" }],
  "check.slow-pages.title": ["Slow pages", { slots: {}, fixedBy: "issue 571" }],
  "check.broken-links.title": ["Broken internal links", { slots: {}, fixedBy: "issue 571" }],
  "check.phone-usability.title": ["Hard to use on a phone", { slots: {}, fixedBy: "issue 571" }],
  "check.structured-data.title": ["Missing structured data", { slots: {}, fixedBy: "issue 571" }],
  // Issue 1550 (drafted): the one thing to do about each check the customer
  // fixes, on the account's Technical issues view.
  "check.noindex-pages.fix": ["Remove the noindex setting from these pages in your site builder or SEO plugin, so search engines can list them.", { slots: {}, fixedBy: "issue 1550 (drafted)" }],
  "check.sitemap.fix": ["Turn on your site’s sitemap in your site builder or SEO plugin, then add its address to your robots.txt.", { slots: {}, fixedBy: "issue 1550 (drafted)" }],
  "check.slow-pages.fix": ["Turn on page caching with your host or site builder, and shrink the largest images on these pages.", { slots: {}, fixedBy: "issue 1550 (drafted)" }],
  "check.broken-links.fix": ["Change or remove the links on your site that point to these addresses; each one answers with an error.", { slots: {}, fixedBy: "issue 1550 (drafted)" }],
  "check.phone-usability.fix": ["Add a viewport line to the head of these pages’ template, so phones draw them at their own width.", { slots: {}, fixedBy: "issue 1550 (drafted)" }],
  "check.ai-readers.fix": ["Let the AI answer readers in through your robots.txt, and remove any nosnippet setting that keeps a page out of AI answers.", { slots: {}, fixedBy: "issue 1550 (drafted)" }],

  // ── Module 4, the DIY sections (REQ-009 c6) ───────────────────────────
  // Instructional text is allowed here and nowhere else on this screen.
  // S2's eyebrow over the three collapses. The collapses' instructional
  // prose is the owner's (approved 2026-09-10, #459).
  "method.title": ["The complete method, free", { slots: {}, fixedBy: "REQ-009 c6" }],
  "method.blocked-readers.title": ["Unblock the AI readers", { slots: {}, fixedBy: "SPEC §9 D14 · issue 1145" }],
  "method.blocked-readers.body": ["Open the robots.txt file at the root of your site — your host or CMS usually has a setting for it. Find the rules that block the readers AI answers are drawn from and add the lines shown below, so each one is allowed. Save and publish; the readers pick up the change on their next visit. A page can also keep itself out of an answer: remove nosnippet or max-snippet:0 from its robots meta tag, and data-nosnippet from around its main content. If your home page carries a noindex rule in its head, remove that too — it tells every reader, Google included, to ignore the page. Nothing else in the file needs to change, and no other reader gains access.", { slots: {}, fixedBy: "SPEC §9 D14 · issue 1145" }],
  "method.blocked-readers.snippet-pages": ["These pages forbid snippets, so an AI answer can’t use them:", { slots: {}, fixedBy: "SPEC §9 D14 · issue 1145" }],
  "method.blocked-readers.training-choice": ["Your robots.txt turns away {crawlers}. That keeps your pages out of AI training and it is your choice — it doesn’t stop an AI answer from reading you, and it isn’t counted here.", { slots: { crawlers: "text" }, fixedBy: "SPEC §9 D14 · issue 1145" }],
  "method.missing-pages.title": ["Write the missing pages", { slots: {}, fixedBy: "REQ-009 c6" }],
  "method.missing-pages.body": ["Each missing page answers one question your market asks that mentions competitors and not you. Take the question, answer it plainly in the first paragraph, then back the answer with facts from your own site — numbers, dates, names, with a link to where each one lives. Publish it at a plain address on your own domain and link to it from a page that already ranks. One page a day is a good pace; one a week still moves the number. ReachKit writes these for subscribers, but nothing here needs a subscription.", { slots: {}, fixedBy: "REQ-009 c6" }],
  "method.unquotable-pages.title": ["Make pages AI can answer from", { slots: {}, fixedBy: "REQ-009 c6" }],
  "method.unquotable-pages.body": ["AI answers mention and link pages that answer a question directly. Writing for that is sometimes called GEO, generative engine optimisation. For each page of yours that has search value but reads like a brochure: turn its headings into the questions a buyer would ask, put a direct answer of two or three sentences right under each heading, and add evidence — a figure, a date, a source you link to. Keep the page’s address; rewriting in place keeps whatever it already ranks for.", { slots: {}, fixedBy: "REQ-009 c6" }],

  // ── Module 5, the free page card (REQ-010, BUILD §4.2's trade) ────────
  "free-page.title": ["Your first page", { slots: {}, fixedBy: "REQ-010 c1" }],
  "free-page.badge": ["free", { slots: {}, fixedBy: "REQ-010 c1" }],
  "free-page.of": ["That’s page 1 of {total} we found for you.", { slots: { total: "text" }, fixedBy: "REQ-010 c1" }],
  "free-page.row.target": ["target", { slots: {}, fixedBy: "REQ-010 c1" }],
  // The target row's own value: the search and its monthly volume, the
  // pair §4.2 says the giveaway email carries. Not the per-question
  // volume the owner removed on 2026-09-03 — that was the 12-questions
  // list, which carries no volume at all.
  "free-page.target.value": ["{keyword} · {volume}/mo", { slots: { keyword: "text", volume: "text" }, fixedBy: "REQ-010 c1" }],
  "free-page.row.beats": ["beats", { slots: {}, fixedBy: "REQ-010 c1" }],
  "free-page.row.format": ["format", { slots: {}, fixedBy: "REQ-010 c1" }],
  // The format row's value, one per Write type the report can offer (issue 787,
  // drafted — the owner corrects the wording).
  "free-page.format.answer_page": ["An answer page", { slots: {}, fixedBy: "REQ-010 c1" }],
  "free-page.format.comparison_page": ["A comparison page", { slots: {}, fixedBy: "REQ-010 c1" }],
  "free-page.format.format_page": ["A comparison, alternative, integration or template page", { slots: {}, fixedBy: "REQ-010 c1" }],
  "free-page.format.keyword_page": ["A page for this search", { slots: {}, fixedBy: "REQ-010 c1" }],
  // REQ-010 c2's trade: the address field and the one control beside it.
  "free-page.email.label": ["Where should we send it?", { slots: {}, fixedBy: "REQ-010 c2" }],
  "free-page.email.placeholder": ["you@company.com", { slots: {}, fixedBy: "REQ-010 c2" }],
  "free-page.submit": ["Email me the full page", { slots: {}, fixedBy: "REQ-010 c2" }],
  "free-page.absent": ["No first page this time: the scan found none worth writing.", { slots: {}, fixedBy: "REQ-004 c10" }],

  "place.report.first-page.rival": [
    "No competitor holds this yet",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-010 c1" },
  ],
  "landing.headline": [
    "Get found on Google and AI.",
    { slots: {}, fixedBy: "REQ-001 c1" },
  ],
  "landing.field.label": ["Your website", { slots: {}, fixedBy: "REQ-001 c1" }],
  "landing.submit.label": ["Scan my site", { slots: {}, fixedBy: "REQ-001 c1" }],
  "landing.problem.empty": ["Type your website’s address first — for example, example.com.", { slots: {}, fixedBy: "REQ-001 c3" }],
  "landing.problem.not-a-hostname": ["That doesn’t look like a website address. Try the form example.com.", { slots: {}, fixedBy: "REQ-001 c3" }],
  "landing.problem.ip-literal": ["That’s a numeric address, not a website name. Type the name people visit, like example.com.", { slots: {}, fixedBy: "REQ-001 c3" }],
  "landing.problem.no-public-suffix": ["That address is missing its ending — try example.com rather than example.", { slots: {}, fixedBy: "REQ-001 c3" }],
  "landing.problem.too-long": ["That’s longer than any website address can be — check for extra text pasted in.", { slots: {}, fixedBy: "REQ-001 c3" }],
  // ── The landing, composed (issue #266) ─────────────────────────────
  //
  // The owner ruled on 2026-09-02 that BUILD §3's landing is "much too
  // light: above the fold there must be the tagline, a subline, the CTA and
  // an enticing image/component giving them an immediate feel for what the
  // app is and looks like, then a product demo video, then a walk through
  // why-care / what-it-does / how-to-start." The card idiom drew that page
  // (`previews/app/src/app/idiom/landing`) and enumerated its owed strings
  // L1–L25 in `idiom/copy.ts` so they can be written in one pass; the keys
  // below are those slots, in that order, with the numbering kept in the
  // comments so the owner's list and this file cannot drift.
  //
  // `landing.headline` above is the tagline and is **approved** — BUILD §3
  // verbatim, the one string on this page approved before the rest. The
  // keys here carry the owner's approved sentences (2026-09-10, #459).
  //
  // L7–L10 were the demo video block. Issue 1396 replaced the frame with
  // *What happens every day* (`landing.day.*` in `chrome.ts`).
  "landing.subline": ["We research your business and your competitors, then put up to {weekPages} pages a week live on your site, while you get on with business.", { slots: { weekPages: "text" }, fixedBy: "board Landing · issue 1596" }],
  "landing.why.eyebrow": ["Why you should care", { slots: {}, fixedBy: "issue 266 · L11" }],
  "landing.why.heading": ["Your competitors are being found.", { slots: {}, fixedBy: "issue 266 · L12" }],
  "landing.why.body": ["Buyers now ask ChatGPT and Google’s AI what to use, and the answer mentions a handful of companies. If yours isn’t one of them, that buyer never meets you — and nothing on your side tells you it happened.", { slots: {}, fixedBy: "issue 266 · L13" }],
  "landing.start.eyebrow": ["How it works", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.start.heading": ["You scan. We write. You watch.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.start.body": ["Three steps. The first is free and takes under a minute.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.start.cta": ["Scan my site for free", { slots: {}, fixedBy: "issue 266 · L25" }],

  // ── S1, the owner-approved screen set (2026-09-08) ────────────────────
  //
  // The set redraws this page and ruling 11a settles its copy: "the
  // artifact's unbracketed strings are approved copy as written"; its
  // bracketed strings were the owner's to write, and the owner approved
  // them on 2026-09-10 (#459). The keys below are the strings S1 adds to
  // the twenty-five above.
  //
  // The keys the new screen no longer renders (L5–L10, the two numbered
  // eyebrows, L16–L21's three narrative cards, L22) are left in place: the
  // set replaced the specimen card with the hero component, the three
  // cards with three Step cards, and the eyebrows with 01 · 02 · 03. Issue
  // #347 is the landing's copy pass and owns that reconciliation.

  /** The field's placeholder. Approved (11a) — the set writes it. */
  "landing.field.placeholder": ["yourdomain.com", { slots: {}, fixedBy: "approved set S1 · 11a" }],
  /** The line under the field. Approved (11a). */
  "landing.hero.assurance": ["free · no account · under a minute", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  /** Under the field: what the free click gives, who it is for, and the way to read more. */
  "landing.hero.what": ["See who Google and AI send your buyers to instead of you.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.hero.for": ["Works for local services, shops, restaurants, firms, software and creators.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.hero.how": ["See how it works", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  /** The strip under the hero. The guarantee joins it only once refunds are live (#1042). */
  "landing.trust": ["{price} a month, VAT included · Cancel any time · Up to {checks} checks before any page goes live", { slots: { price: "text", checks: "text" }, fixedBy: "board Landing · issue 1596" }],
  /** The pace (owner, A1, 2026-10-19). The number is `WEEK_PLAN.days`. */
  "landing.pace": ["Up to {weekPages} pages a week, new or updated. Never filler.", { slots: { weekPages: "text" }, fixedBy: "owner A1 · 2026-10-19" }],
  /** The hero's story card: five frames, one example business. */
  "landing.story.title": ["How ReachKit works for you", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.story.1.title": ["Your business", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.story.1.line": ["Your website is the start. Nothing to fill in.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.story.2.title": ["We research it", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.story.2.line": ["What you do, who buys, and who they pick instead.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.story.3.title": ["Pages go live every week", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.story.3.line": ["Written from your site. Never filler.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.story.4.title": ["Found on Google and AI", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.story.4.line": ["An example of the goal, not a promise.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.story.5.title": ["You get on with business", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.story.5.line": ["A Monday email shows what moved. Nothing needs you.", { slots: {}, fixedBy: "board Landing · issue 1596" }],


  /** Section 03's three Step cards. The eyebrow and the three titles are
   *  approved (11a); the three bodies are bracketed in the set, and are the
   *  owner's approved sentences (2026-09-10, #459). */
  "landing.step.1.title": ["Scan your site", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.step.1.body": ["Type your website. See who Google and AI send your buyers to instead of you, what holds your site back, and your first page, proposed free.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.step.1.more": ["See what we research", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  // Step 2's approved-set pair told a founder to pick and confirm the market
  // and the rivals. SPEC §5 (2026-10-02, D28) rules that out: ReachKit
  // identifies both, and the founder may override them but never has to.
  // Both sentences are drafted (issue 1308) for the owner to correct.
  "landing.step.2.title": ["We choose and write your pages", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.step.2.body": ["ReachKit checks what your buyers search and ask AI, and who answers them today. With what your site says about your business, it plans up to {weekPages} pages for the week. Each one is written from facts on your own site, checked, and put live on your own web address or your WordPress.", { slots: { weekPages: "text" }, fixedBy: "board Landing · issue 1596" }],
  "landing.step.2.more": ["See how we pick and write your pages", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  // Step 3's title is the one approved-set string on this screen the owner
  // has since replaced: the set promised a page a day, and the Autopilot
  // brief (DECISIONS 2026-09-10) rules that out — a page goes live when one
  // is ready, at most one a day. Approved 2026-09-11 (#516).
  "landing.step.3.title": ["You see progress", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.step.3.body": ["Each page goes live on its own day. Every Monday an email shows what went live, where your pages sit in Google, and whether AI answers now link to them.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.step.3.more": ["See what you’ll see each Monday", { slots: {}, fixedBy: "board Landing · issue 1596" }],

  /* ── The hero component: "one week, one card" (#935) ──────────────────
     Owner ruling 2026-09-21: the landing hero is Round 11 `R11-H4-Week`.
     The approved headline and sub-line above are unchanged; what the
     ruling replaces is the picture beside them, and it is one card —
     autopilot on, the Discoverability Score, the week that produced it,
     the line it moved along, and the AI answer at the end of it.

     **Every sentence here is example content, and it is drafted** under
     the owner's 2026-09-16 ruling (#759): the ruling says the component's
     own sentences "go in the registry as keys", and none of them was
     written by the owner. Each is named in this PR's body for correction.

     **Why the business is named.**
     The ruling asks for "the AI answer that names the example business",
     which needs a business with a name — the board writes one, and the
     card's last line says in writing that it is an example and measures
     no site. The figures live in `_landing/specimen.ts`, which is the
     product's one home for a drawn number that measures nothing; the
     `{you}` slot below is filled from there, never from a visitor's
     input. */
  /** The pill at the head of the card. One sentence and one slot rather
   *  than a word plus a dangling fragment: "Autopilot on" and "· since 12
   *  Aug" are one claim, and a reader of the second half alone learns
   *  nothing. */
  "landing.hero.autopilot": ["Autopilot on since {since}", { slots: { since: "date" }, fixedBy: "issue 935 · drafted" }],
  /** Monday's cell: the one day of the six that measures rather than
   *  publishes, which is why it is the only cell that carries no page. */
  "landing.hero.week.measured": [
    "Checked {searches} searches, asked AI {questions} questions",
    { slots: { searches: "text", questions: "text" }, fixedBy: "issue 1596 · drafted" },
  ],
  /** Tuesday to Saturday: five page titles, as this example business's
   *  week would produce them. Titles and not sentences — they are what the
   *  calendar shows, so they read as the product's own rows. */
  "landing.hero.page.1": ["How much does slab leak repair cost in Austin?", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.hero.page.2": ["Tankless or tank: which suits an Austin home?", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.hero.page.3": ["Emergency plumber in Austin: what to do in the first hour", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.hero.page.4": ["Why a water heater pops, and when to call", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.hero.page.5": ["Drain cleaning prices in Austin", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  /** The AI answer the week earned. `{you}` is the example business's own
   *  name, so the card can draw it as the reader's own and the sentence
   *  still reads whole without the drawing. */
  "landing.hero.ai.answer": [
    "…for a slab leak in Austin, try {you}, which lists its prices, or Austin Pipeworks.",
    { slots: { you: "text" }, fixedBy: "issue 1596 · drafted" },
  ],
  /** The work line: the ruling's "how little the customer has to do",
   *  said as two halves of one trade rather than a claim about effort. */
  "landing.hero.work.you": ["You: about 10 minutes, once", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.hero.work.reachkit": [
    "ReachKit: up to {weekPages} pages a week, checked every Monday",
    { slots: { weekPages: "text" }, fixedBy: "board Landing · issue 1596" },
  ],
  /** Under the card. `landing.hero.specimen.caption` above says the same
   *  thing of a card that named `example.com` and no business; this card
   *  names a business, so it says so of a business. */
  "landing.hero.example": ["Example business. It measures no site.", { slots: {}, fixedBy: "board Landing · issue 1596" }],

  /* ── The landing in its 2026-09-24 order (#1067) ─────────────────────
     Boards `R12-1-Landing`, `R12-8-Phone-landing`, `R12-10-Dark-landing`
     (SPEC §1, 2026-09-24). Where the board writes the sentence, it is the
     board's; `drafted` marks a line the board draws and this issue wrote. */
  /** The hero preview's name and its three tabs. The app shows no weekly
   *  score (SPEC §1, D22), so the preview draws none (issue 1393). */
  "landing.inside.title": ["Inside ReachKit", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.inside.tab.week": ["This week", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.inside.tab.answers": ["AI answers", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.inside.tab.page": ["A page", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  /** *AI answers*: the line over the answer, and the one under it. */
  "landing.inside.answers.head": ["What Google’s AI answers say now", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.inside.answers.monday": [
    "Every month: how often AI answers mention you when buyers ask about your market, and which competitors they mention instead.",
    { slots: {}, fixedBy: "board R12-1 · issue 1067" },
  ],
  /** *Your page*: the page waiting for the owner's read. */
  "landing.inside.page.due": ["Goes live in {in} unless you stop it", { slots: { in: "text" }, fixedBy: "board R12-1 · issue 1067" }],
  "landing.inside.page.why.label": ["Why this page:", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.inside.page.why.body": [
    "people near you search it every month, and today a competitor answers them.",
    { slots: {}, fixedBy: "board R12-1 · issue 1067" },
  ],
  /** *Why you should care*: four features, each a title, a line and a
   *  small drawing whose words follow it. */
  "landing.feature.ai.title": ["Pages AI answers can link to", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.feature.ai.body": [
    "Every month we check what AI answers say about you. You see which competitors the answers mention, and whether they mention you. Then we write pages that give AI something true to link to.",
    { slots: {}, fixedBy: "board R12-1 · issue 1067" },
  ],
  /** The AI card's drawing: one answer, who it mentions, and the business it leaves out. */
  "landing.feature.ai.ask": ["Who’s a good emergency plumber in Austin?", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.feature.ai.mentions": ["An AI answer mentions", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.feature.ai.chain": ["a national plumbing chain", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.feature.ai.you": ["{you}: not mentioned", { slots: { you: "text" }, fixedBy: "board Landing · issue 1596" }],
  "landing.feature.google.title": ["Get found on Google", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.feature.google.body": [
    "We find the searches buyers in your market make where competitors show up and you don’t, and write pages for the ones a site your size can win, one page at a time.",
    { slots: {}, fixedBy: "board R12-1 · issue 1067" },
  ],
  "landing.feature.google.rival": ["your competitor", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.feature.google.you": ["you", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.feature.google.open": [
    "Open: no competitor holds these yet",
    { slots: {}, fixedBy: "board R12-1 · issue 1067" },
  ],
  "landing.feature.fix.title": ["Fix what holds you back", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.feature.fix.body": [
    "AI shut out of your site, missing titles, no page list for Google, slow pages. The free report shows each one with a 10-minute fix. On WordPress, ReachKit rewrites missing titles and descriptions for you.",
    { slots: {}, fixedBy: "board R12-1 · issue 1067" },
  ],
  "landing.feature.fix.readers": ["AI is let into your site", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.feature.fix.titles": ["Missing titles rewritten", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.feature.fix.sitemap": ["A page list for Google", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.feature.fix.free": ["Free fix · 10 min", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.feature.fix.ours": ["ReachKit, on WordPress", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.feature.daily.title": ["Pages written for you, every week", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.feature.daily.body": [
    "Up to {weekPages} a week, new or updated, written from facts on your own site and live on your own web address. Each goes live on its own after {hours} hours. You can edit or stop it first, and you never have to.",
    { slots: { weekPages: "text", hours: "text" }, fixedBy: "board Landing · issue 1596" },
  ],
  /** *What to do next*: the time each step takes. */
  "landing.step.1.tag": ["free · under a minute", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.step.2.tag": ["every Monday", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.step.3.tag": ["from week 1", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  /** The closing band: its heading, its line, and the line under its button. */
  "landing.close.heading": ["See who gets your buyers today.", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.close.body": [
    "The report is free and yours to keep. ReachKit is €49 a month, VAT included, when you want the pages written.",
    { slots: {}, fixedBy: "board R12-1 · issue 1067" },
  ],
  /** *What {price} a month gets you*: what the one plan holds, and its card. */
  "landing.price.heading": ["What {price} a month gets you", { slots: { price: "text" }, fixedBy: "board Landing · issue 1596" }],
  "landing.price.facts": ["Each page is written from facts on your site, with every fact linked to where it came from.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.price.ready": ["In your first week, an email when each page is ready, saying which search it answers and who answers it today.", { slots: {}, fixedBy: "board Landing · issue 1596 · decision 2026-10-19-1593 (drafted)" }],
  "landing.price.monday": ["Every Monday: where your pages sit in Google, which of your pages AI answers link to, and what is planned next.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.price.competitors": ["Your competitors, up to {rivals}, watched every week.", { slots: { rivals: "text" }, fixedBy: "board Landing · issue 1596" }],
  "landing.price.site": ["Your whole site checked for problems, with the fix for each.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.price.plan": ["ReachKit · one plan", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.price.terms": ["{price} a month, VAT included. One plan. Cancel any time.", { slots: { price: "text" }, fixedBy: "board Landing · issue 1596" }],
  "landing.price.more": ["See the full value, and how it compares", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  /** The questions owners ask, each a question and its answer. */
  "landing.faq.eyebrow": ["Questions", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.heading": ["Questions owners ask", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.spam.q": ["Is this AI spam?", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.spam.a": ["No. Pages are written with an AI model, but only from facts on your own site and from sources each page links to. Before a page goes live it is read against up to {checks} checks: no invented people, reviews or numbers, and nothing your site doesn’t back up. A page that fails twice never goes live. We plan a page only where your market has a real question to answer, so some weeks have fewer than {weekPages}. Google’s own guidance is that using AI is fine and using it mainly to game Google’s results is not. We write to answer your buyers.", { slots: { checks: "text", weekPages: "text" }, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.approve.q": ["Do I have to approve each page?", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.approve.a": ["No. Each page goes live on its own {hours} hours after it is written. In your first week we email each page to you first. After that, the Monday mail lists the week’s pages. You can read, edit or stop any page, or do nothing at all. You can set that window anywhere from {min} to {max} days.", { slots: { hours: "text", min: "text", max: "text" }, fixedBy: "board Landing · issue 1596 · decision 2026-10-19-1593 (drafted)" }],
  "landing.faq.results.q": ["How long until I see results?", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.results.a": ["In week 1 you see your pages go live on your site. From the first Monday you see where they sit in Google and whether AI answers link to them. Each page climbs at the search engines’ pace, not ours. Bing usually finds a new page within days. Google takes from a few days to a few weeks, and doesn’t list every page. Showing in results takes weeks. Reaching the first page takes months, and not every page gets there. No one can guarantee a top spot on Google, and we never promise one.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.stop.q": ["What if I want to stop?", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.stop.a": ["Cancel any time from Settings, and you’re not charged again. Section four of our Terms says when your access ends. Pages on your WordPress stay where they are. Pages on the blog address we run for you stay live for {days} days after your access ends, and we email you a week before they stop. Your export of every page stays available, with no end date.", { slots: { days: "text" }, fixedBy: "board Landing · issue 1596 · ruling D5 · ruling R22" }],
  "landing.faq.local.q": ["Will it work for a local business?", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.local.a": ["Yes. ReachKit reads what kind of business you are and measures the searches where your buyers are, including the ones with your town in them. Pages answer what local buyers ask: prices, what’s included, how long a job takes. One honest limit: for searches that show a map, Google lists businesses from Google Maps first, and your Google Maps listing (Business Profile) and reviews count most there. ReachKit’s pages help your website, not your Maps listing. In a small local market some weeks have fewer than {weekPages} good pages to write, and we never fill a week with filler.", { slots: { weekPages: "text" }, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.start.q": ["What do I need to start?", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.start.a": ["A website you can connect. You pay first, with no account form, then spend about 10 minutes on setup. Connecting is one setting where your web address is managed, for a blog address such as blog.yourdomain.com (we show you what to copy), or your WordPress login. Your first page is written while you do it.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.german.q": ["Does it work in German?", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.german.a": [
    "Yes. Sites in {germanCountries} are measured in German and get pages in German. Sites in {englishCountries} are measured and written in English. A site anywhere else is measured in the nearest of these countries, in English, and its report says so. This website and your dashboard are in English.",
    { slots: { germanCountries: "text", englishCountries: "text" }, fixedBy: "board Landing · issue 1689" },
  ],
  "landing.faq.trial.q": ["Why is there no free trial?", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.trial.a": ["The scan and your first page are free, so you can see what ReachKit would do before you pay. After that there’s one plan at {price} a month, and you can cancel any time.", { slots: { price: "text" }, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.results.more": ["See it week by week", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.close.assurance": ["free · no account · under a minute", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],

  /* ── The quiet pages (#936) ───────────────────────────────────────────
     A refusal, a scan that stopped, a removed report: the screens a
     stranger did not mean to land on. Each is now an icon tile, a
     heading, a line and at least one control (`src/app/_quiet/`), and
     these are the headings and the controls the 2026-09-20 board draws
     for them.

     **A refusal that carries a wait states it in the heading.** The
     approved refusal sentences below (`notice.refused.*`) already end
     with the wait, and they are unchanged — the heading is what a reader
     sees first, and "you can scan again in 38 minutes" is the answer to
     the only question they have. The sentence beneath it says why.
     `notice.refused.stopped` names no wait and so takes the second
     heading, which promises no time nobody can name (ADR-011).

     Every sentence here is **drafted** under the owner's 2026-09-16
     ruling (#759), in this registry's voice, and named in the PR body so
     the owner can correct it. */
  /** One heading per refusal reason: **what happened**, never when.
   *
   *  The first draft put the wait in the heading ("You can scan again in 37
   *  min") over the approved sentence, which ends with the same clause —
   *  the card said one thing twice (owner, 2026-09-21). The heading takes
   *  the other half of the message instead, and the approved line below it
   *  is unchanged and still carries the time.
   *
   *  One key per reason rather than one shared line, on the footing
   *  `notice.refused.*` already stands on: the reasons are not each other.
   *  A network that has spent its hour is not an address that has been
   *  measured enough, and neither is a scan that is simply still running.
   *  `refusal.ts` maps them with `satisfies`, so a sixth reason fails the
   *  build until it has a heading here too. */
  "quiet.refused.head.network-limit": ["Too many scans from your network", { slots: {}, fixedBy: "issue 936" }],
  "quiet.refused.head.network-day-limit": ["No free scans left today", { slots: {}, fixedBy: "issue 936" }],
  "quiet.refused.head.domain-day-limit": ["Scanned enough for today", { slots: {}, fixedBy: "issue 936" }],
  "quiet.refused.head.scan-running": ["A scan is already running", { slots: {}, fixedBy: "issue 936" }],
  "quiet.refused.head.stopped": ["Free scanning is paused", { slots: {}, fixedBy: "issue 936" }],
  "quiet.cooldown.head": ["We couldn’t finish measuring this site", { slots: {}, fixedBy: "issue 936" }],
  "quiet.removed.head": ["This report was removed", { slots: {}, fixedBy: "issue 936" }],
  "control.scan-another": ["Scan a different site", { slots: {}, fixedBy: "issue 936" }],
  "control.example-report": ["Read an example report", { slots: {}, fixedBy: "issue 936" }],
  "control.back-to-start": ["Back to the start", { slots: {}, fixedBy: "issue 936" }],

  /* ── The free-scans gallery, `/scans`, and the landing's strip (#1069) ── */
  // SPEC §2 2026-09-24 (#1058, #1059). The board's words where boards
  // `R12-3-Gallery` / `R12-9-Phone-gallery` / `R12-1-Landing` write them;
  // the rest drafted in the registry's voice for the owner to correct.
  "gallery.eyebrow": ["Free scans · live", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.heading": ["Every free scan, in the open.", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.subline": [
    "Each report is a permanent public link. See how any business here shows up on Google and AI, and where its competitors are found instead.",
    { slots: {}, fixedBy: "issue 1069 · R12-3" },
  ],
  "gallery.next.heading": ["Your site next?", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.search.label": ["Search by company or domain", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.filter.label": ["Market", { slots: {}, fixedBy: "issue 1069 · drafted" }],
  "gallery.filter.all": ["All", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  // The categories that are not pills (issue 1377): the button's word, and
  // its name to a screen reader.
  "gallery.filter.more": ["More", { slots: {}, fixedBy: "issue 1377 · drafted" }],
  "gallery.filter.more.label": ["More markets", { slots: {}, fixedBy: "issue 1377 · drafted" }],
  "gallery.showing": ["Showing {shown} of {total} reports", { slots: { shown: "text", total: "text" }, fixedBy: "issue 1069 · R12-3" }],
  "gallery.sort.label": ["Sort", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.sort.newest": ["Newest first", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.sort.highest": ["Highest score", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.sort.lowest": ["Lowest score", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.sort.az": ["A–Z", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.card.view": ["View report", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.card.no-logo": ["no logo found", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.card.no-score": ["—", { slots: {}, fixedBy: "issue 1069 · drafted" }],
  "gallery.more": ["Show more reports", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.removal": [
    "Own a site listed here and want its report taken down? Write to {address}.",
    { slots: { address: "text" }, fixedBy: "issue 1069 · R12-3" },
  ],
  "gallery.empty.heading": ["No free scan matches that yet.", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.empty.body": [
    "Scan it now — it takes under a minute, and it will be listed here.",
    { slots: {}, fixedBy: "issue 1069 · R12-3" },
  ],
  "gallery.empty.cta": ["Scan this site", { slots: {}, fixedBy: "issue 1069 · R12-3" }],

  // SPEC §6, owner D66 (issue 1311): the one line a report owes its reader
  // where the site named a country or a language that is not measured yet.
  // Drafted (#759).
  "report.locale.fell-back": [
    "Measured as searched in {country}, in {language}. ReachKit does not measure {unmeasured} yet.",
    { slots: { country: "text", language: "text", unmeasured: "text" }, fixedBy: "SPEC §6 · D66 · issue 1311" },
  ],
  // A country or language on the list is never called unmeasured: the line
  // names the pair the site read as and what ReachKit measures instead.
  // Drafted (#759).
  "report.locale.pair-fell-back": [
    "Measured as searched in {country}, in {language}. Your site reads as {readLanguage}; ReachKit measures {readCountry} in {ownLanguage}.",
    { slots: { country: "text", language: "text", readLanguage: "text", readCountry: "text", ownLanguage: "text" }, fixedBy: "SPEC §6 · D66 · issue 1689" },
  ],
  "report.locale.country-read-as": [
    "Measured as searched in {country}, in {language}, because your site read as {readLanguage}. ReachKit measures {readCountry} in {ownLanguage}: scan again to see it.",
    { slots: { country: "text", language: "text", readLanguage: "text", readCountry: "text", ownLanguage: "text" }, fixedBy: "SPEC §6 · D66 · issue 1689" },
  ],
  // A site that declares other markets: one is measured, chosen at setup.
  // Drafted (#759).
  "report.locale.also-serves": [
    "Your site also serves {n} other markets. We measure the one this address is for; choose another at setup.",
    { slots: { n: "text" }, fixedBy: "SPEC §6 · D66 · issue 1689" },
  ],
  "report.locale.also-serves.one": [
    "Your site also serves one other market. We measure the one this address is for; choose another at setup.",
    { slots: {}, fixedBy: "SPEC §6 · D66 · issue 1689" },
  ],
  "app.locale.also-serves": [
    "Your site also serves {n} other markets; we measure one. Change it at setup.",
    { slots: { n: "text" }, fixedBy: "SPEC §6 · D66 · issue 1689" },
  ],
  "app.locale.also-serves.one": [
    "Your site also serves one other market; we measure one. Change it at setup.",
    { slots: {}, fixedBy: "SPEC §6 · D66 · issue 1689" },
  ],
  "report.locale.site.pair": ["{country} in {language}", { slots: { country: "text", language: "text" }, fixedBy: "SPEC §6 · D66 · issue 1311" }],
  // The measurement line of a report measured anywhere but in US Google in
  // English (D66). Drafted (#759).
  "report.measurement.in": ["Measured in Google {country}, in {language}.", { slots: { country: "text", language: "text" }, fixedBy: "SPEC §6 · D66 · issue 1311" }],
  // The measurement line of a report measured in the town its site serves
  // (D67, owner ruling 2026-10-15). The search vendor gives volumes by
  // country only, so the line says so (issue 1480). Drafted (#759).
  "report.measurement.place": [
    "Measured in Google, {place}, in {language}. Search volumes are for all of {country}.",
    { slots: { place: "text", language: "text", country: "text" }, fixedBy: "SPEC §6 · D67 · issue 1480" },
  ],

  // SPEC §2, owner A3 and E1 (2026-10-19): the offer leads with the pages
  // the report found missing and lists every one. A3's heading and the
  // board's eyebrow and lead are the owner's; the rest is drafted.
  "report.offer.found": ["This report found {count} pages your site is missing", { slots: { count: "text" }, fixedBy: "owner A3 2026-10-19 · issue 1599" }],
  "report.offer.found.one": ["This report found {count} page your site is missing", { slots: { count: "text" }, fixedBy: "owner A3 2026-10-19 · issue 1599" }],
  "report.offer.free-path": ["Not ready? Get your first page free ↓", { slots: {}, fixedBy: "owner A3 2026-10-19 · issue 1599 · drafted" }],
  "report.missing.volume": ["searched {volume} times a month", { slots: { volume: "text" }, fixedBy: "owner E1 2026-10-19 · issue 1599 · drafted" }],
  "report.missing.holder": ["answered today by {holder}", { slots: { holder: "text" }, fixedBy: "owner E1 2026-10-19 · issue 1599 · drafted" }],
  "report.missing.all": ["All {count}, nothing hidden.", { slots: { count: "text" }, fixedBy: "board PubReport · owner Q3 2026-10-20 · issue 1599" }],
  "report.missing.eyebrow": ["Pages you’re missing", { slots: {}, fixedBy: "board PubReport · issue 1599" }],
  "report.missing.lead": [
    "Each one answers a question your buyers ask, that a competitor answers today and no page of yours does.",
    { slots: {}, fixedBy: "board PubReport · issue 1599" },
  ],
}) satisfies CopyPartition;
