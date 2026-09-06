// src/lib/presentation/copy/keys/report.ts — BP-020 decision 5, WO-041; the
// eight landing keys added by WO-070.
//
// The report surface's sentences. One key seeded (WO-041 step 3): the
// no-presence-yet line for the first page of the rival list. Empty value,
// owner-owed — no string is written here (constitution §1: customer-visible
// strings are the owner's). The block that owns the report surface fills
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
// **Every one of them ships with the value `TODO(copy)`** — `CLAUDE.md`'s
// standing rule for this repo ("add the key, leave the value `TODO(copy)`,
// flag it in the PR"), which supersedes the archived corpus's
// empty-string-plus-throw convention for keys minted from here on. The
// difference is deliberate and visible: an empty value makes `copy()`
// throw, which would take the whole screen down and hide the other
// eleven modules from the owner's review; `TODO(copy)` renders as itself,
// so the owner sees exactly which sentence each module is waiting for,
// in place, in both themes. No sentence is written here.
//
// Module 6, the pricing card, mints nothing: its eight sentences are
// `offer.ts`'s `price.*`/`offer.*` keys, already ruled 2026-09-04.
import type { CopyPartition } from "../registry.ts";

export const REPORT_COPY = Object.freeze({
  "verdict.limiting.foundations": ["What holds your score down most: the foundations — how your site is built and how easily it can be read.", { slots: {}, fixedBy: "REQ-004 c2" }],
  "verdict.limiting.answerability": ["What holds your score down most: answerability — how well your pages answer the questions buyers actually ask.", { slots: {}, fixedBy: "REQ-004 c2" }],
  "verdict.limiting.presence": ["What holds your score down most: presence — how often you appear where buyers look, in Google and in AI answers.", { slots: {}, fixedBy: "REQ-004 c2" }],
  "removal.address": ["remove@reachkit.app", { slots: {}, fixedBy: "REQ-002 c1" }],
  "removal.line.on-report": ["Own this site and want this report taken down? Write to {address}.", { slots: { address: "text" }, fixedBy: "REQ-002 c1" }],
  "removal.line.removed": ["This report was removed at the site owner’s request. To make {domain} scannable again, write to {address}.", { slots: { domain: "text", address: "text" }, fixedBy: "REQ-002 c3" }],
  "notice.incomplete": ["This report is incomplete — {what} wasn’t measured.", { slots: { what: "text" }, fixedBy: "REQ-001 c14" }],
  "notice.measurement-failed": ["The last measurement didn’t finish, so nothing new was stored.", { slots: {}, fixedBy: "REQ-001 c16" }],
  "notice.correction-failed": ["The correction didn’t finish — this is the report from before it.", { slots: {}, fixedBy: "REQ-094 c7" }],
  "notice.refused.network-limit": ["That’s five scans from your network in the last hour — you can scan again in {wait}.", { slots: { wait: "text" }, fixedBy: "REQ-003 c6" }],
  "notice.refused.scan-running": ["A scan is already running from your network. It finishes in about {wait}, then this one can start.", { slots: { wait: "text" }, fixedBy: "REQ-003 c7" }],
  // Owner-owed (#104). ReachKit's own stop, in writing — the one refusal
  // the visitor did not cause and the only one that names no wait, because
  // nobody can say when we start again (ADR-011). Ships as `TODO(copy)`,
  // which renders as itself on the screen rather than as a blank.
  "notice.refused.stopped": ["TODO(copy)", { slots: {}, fixedBy: "REQ-003 c12" }],
  "control.rescan-age": ["Measure again", { slots: {}, fixedBy: "REQ-001 c15" }],
  "control.rescan-incomplete": ["Measure what’s missing", { slots: {}, fixedBy: "REQ-001 c14" }],
  "control.retry": ["Try again", { slots: {}, fixedBy: "REQ-001 c16" }],
  "control.correction-retry": ["Try the correction again", { slots: {}, fixedBy: "REQ-094 c7" }],
  "copy-link.label": ["Copy link", { slots: {}, fixedBy: "REQ-001 c7" }],

  // ── Module 1, the verdict strip (BUILD §4.1) ──────────────────────────
  // The domain and the date ride beside the score so it is never a bare
  // specimen number (REQ-004 c1).
  // The three score factors, named as subjects. `LIMITING_LINES` holds the
  // *sentence* about a factor; these three hold the factor's own name, for
  // the `{what}` slot of `unmeasured.undeterminable` / `.not-attempted`
  // (REQ-004 c3: "naming every driver that has no value, and stating for
  // each which of the two reasons applies"). One key per `ScoreFactorName`.
  "verdict.factor.foundations": ["TODO(copy)", { slots: {}, fixedBy: "REQ-004 c3" }],
  "verdict.factor.answerability": ["TODO(copy)", { slots: {}, fixedBy: "REQ-004 c3" }],
  "verdict.factor.presence": ["TODO(copy)", { slots: {}, fixedBy: "REQ-004 c3" }],
  // The `{wait}` the two refusal lines take: the figure is the refusal's
  // own `retryAfterSeconds` in whole minutes, the unit word is the
  // owner's, so no duration is composed in a component.
  "report.wait.minutes": ["TODO(copy)", { slots: { minutes: "text" }, fixedBy: "REQ-003 c6" }],
  "report.measured-at": ["TODO(copy)", { slots: { domain: "text", date: "text" }, fixedBy: "REQ-004 c1" }],

  // ── The scanning arm's six named stages (REQ-003 c1) ──────────────────
  // One key per `StageName` (`src/lib/scan/stages.ts`) — a stage with no
  // word cannot render, which is what makes "named stages, never an
  // unlabelled spinner" structural. WO-282 left these to BP-023's own
  // file plan; nothing created them, and the scanning arm cannot render
  // without them, so they are minted here with the rest of this surface.
  "stage.reading_your_site": ["TODO(copy)", { slots: {}, fixedBy: "REQ-003 c1" }],
  "stage.reading_access_rules": ["TODO(copy)", { slots: {}, fixedBy: "REQ-003 c1" }],
  "stage.reading_your_market": ["TODO(copy)", { slots: {}, fixedBy: "REQ-003 c1" }],
  "stage.checking_your_presence": ["TODO(copy)", { slots: {}, fixedBy: "REQ-003 c1" }],
  "stage.asking_the_twelve": ["TODO(copy)", { slots: {}, fixedBy: "REQ-003 c1" }],
  "stage.scoring": ["TODO(copy)", { slots: {}, fixedBy: "REQ-003 c1" }],

  // ── Module 2, left card — AI answers (REQ-006) ────────────────────────
  "ai-answers.title": ["TODO(copy)", { slots: {}, fixedBy: "REQ-006 c1" }],
  "ai-answers.source": ["TODO(copy)", { slots: { date: "text" }, fixedBy: "REQ-006 c9" }],
  "ai-answers.denominator": ["TODO(copy)", { slots: { answered: "text", measured: "text" }, fixedBy: "REQ-006 c1" }],
  "ai-answers.customer-citations": ["TODO(copy)", { slots: { cited: "text", answered: "text" }, fixedBy: "REQ-006 c1" }],
  "ai-answers.legend": ["TODO(copy)", { slots: {}, fixedBy: "REQ-006 c1" }],
  "ai-answers.method": ["TODO(copy)", { slots: {}, fixedBy: "REQ-006 c9" }],
  "ai-answers.questions.title": ["TODO(copy)", { slots: {}, fixedBy: "REQ-006 c9" }],
  "ai-answers.questions.show-all": ["TODO(copy)", { slots: { total: "text" }, fixedBy: "REQ-006 c9" }],
  "ai-answers.question.not-you": ["TODO(copy)", { slots: {}, fixedBy: "REQ-006 c1" }],
  "ai-answers.question.no-answer": ["TODO(copy)", { slots: {}, fixedBy: "REQ-006 c1" }],
  // REQ-006 c9's provenance pair: the search a question was derived from
  // and the brands the answer named. No `{vol}/mo` slot — the owner
  // removed per-question volume on 2026-09-03.
  "ai-answers.question.provenance": ["TODO(copy)", { slots: { search: "text", brands: "text" }, fixedBy: "REQ-006 c9" }],
  "ai-answers.matrix.column.domain": ["TODO(copy)", { slots: {}, fixedBy: "REQ-006 c1" }],
  "ai-answers.matrix.column.cited": ["TODO(copy)", { slots: {}, fixedBy: "REQ-006 c1" }],
  "ai-answers.matrix.empty": ["TODO(copy)", { slots: {}, fixedBy: "REQ-006 c1" }],
  "ai-answers.absent": ["TODO(copy)", { slots: {}, fixedBy: "REQ-004 c10" }],

  // ── Module 2, right card — Google presence (REQ-008) ──────────────────
  "presence.title": ["TODO(copy)", { slots: {}, fixedBy: "REQ-008 c1" }],
  "presence.source": ["TODO(copy)", { slots: {}, fixedBy: "REQ-008 c1" }],
  "presence.occupancy": ["TODO(copy)", { slots: { you: "text", measured: "text" }, fixedBy: "REQ-008 c1" }],
  "presence.legend": ["TODO(copy)", { slots: {}, fixedBy: "REQ-008 c2" }],
  "presence.no-rivals": ["TODO(copy)", { slots: {}, fixedBy: "REQ-008 c6" }],
  "presence.occupancy.column.domain": ["TODO(copy)", { slots: {}, fixedBy: "REQ-008 c1" }],
  "presence.occupancy.column.count": ["TODO(copy)", { slots: {}, fixedBy: "REQ-008 c1" }],
  "presence.absent-from.title": ["TODO(copy)", { slots: {}, fixedBy: "REQ-008 c4" }],
  "presence.absent-from.column.search": ["TODO(copy)", { slots: {}, fixedBy: "REQ-008 c4" }],
  "presence.absent-from.column.volume": ["TODO(copy)", { slots: {}, fixedBy: "REQ-008 c4" }],
  "presence.absent-from.column.holder": ["TODO(copy)", { slots: {}, fixedBy: "REQ-008 c4" }],
  "presence.absent-from.empty": ["TODO(copy)", { slots: {}, fixedBy: "REQ-008 c4" }],
  "presence.absent": ["TODO(copy)", { slots: {}, fixedBy: "REQ-004 c10" }],

  // ── Module 3, the three problem cards (REQ-009) ───────────────────────
  // One title, one doer and one measured-zero line per problem; the three
  // severity words are BANDS_COPY's `severity.*` and are not restated.
  "problem.blocked-readers.title": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c1" }],
  "problem.blocked-readers.doer": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c2" }],
  "problem.blocked-readers.none-needed": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c3" }],
  "problem.missing-pages.title": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c1" }],
  "problem.missing-pages.doer": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c5" }],
  "problem.missing-pages.none-needed": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c3" }],
  "problem.unquotable-pages.title": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c1" }],
  "problem.unquotable-pages.doer": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c5" }],
  "problem.unquotable-pages.none-needed": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c3" }],
  // The one control any fix carries (REQ-009 c2), on the paste arm only.
  "problem.paste.label": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c2" }],

  // ── Module 4, the DIY sections (REQ-009 c6) ───────────────────────────
  // Instructional text is allowed here and nowhere else on this screen.
  "method.blocked-readers.title": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c6" }],
  "method.blocked-readers.body": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c6" }],
  "method.missing-pages.title": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c6" }],
  "method.missing-pages.body": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c6" }],
  "method.unquotable-pages.title": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c6" }],
  "method.unquotable-pages.body": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c6" }],

  // ── Module 5, the free page card (REQ-010, BUILD §4.2's trade) ────────
  "free-page.title": ["TODO(copy)", { slots: {}, fixedBy: "REQ-010 c1" }],
  "free-page.of": ["TODO(copy)", { slots: { total: "text" }, fixedBy: "REQ-010 c1" }],
  "free-page.row.target": ["TODO(copy)", { slots: {}, fixedBy: "REQ-010 c1" }],
  // The target row's own value: the search and its monthly volume, the
  // pair §4.2 says the giveaway email carries. Not the per-question
  // volume the owner removed on 2026-09-03 — that was the 12-questions
  // list, which carries no volume at all.
  "free-page.target.value": ["TODO(copy)", { slots: { keyword: "text", volume: "text" }, fixedBy: "REQ-010 c1" }],
  "free-page.row.beats": ["TODO(copy)", { slots: {}, fixedBy: "REQ-010 c1" }],
  "free-page.row.format": ["TODO(copy)", { slots: {}, fixedBy: "REQ-010 c1" }],
  "free-page.submit": ["TODO(copy)", { slots: {}, fixedBy: "REQ-010 c2" }],
  "free-page.absent": ["TODO(copy)", { slots: {}, fixedBy: "REQ-004 c10" }],

  "place.report.first-page.rival": [
    "No rival holds this ground yet",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-010 c1" },
  ],
  "landing.headline": [
    "See what AI tells buyers about your market — and write your way in.",
    { slots: {}, fixedBy: "REQ-001 c1" },
  ],
  "landing.field.label": ["Your website", { slots: {}, fixedBy: "REQ-001 c1" }],
  "landing.submit.label": ["Scan my site", { slots: {}, fixedBy: "REQ-001 c1" }],
  "landing.problem.empty": ["Type your website’s address first — for example, example.com.", { slots: {}, fixedBy: "REQ-001 c3" }],
  "landing.problem.not-a-hostname": ["That doesn’t look like a website address. Try the form example.com.", { slots: {}, fixedBy: "REQ-001 c3" }],
  "landing.problem.ip-literal": ["That’s a numeric address, not a website name. Type the name people visit, like example.com.", { slots: {}, fixedBy: "REQ-001 c3" }],
  "landing.problem.no-public-suffix": ["That address is missing its ending — try example.com rather than example.", { slots: {}, fixedBy: "REQ-001 c3" }],
  "landing.problem.too-long": ["That’s longer than any website address can be — check for extra text pasted in.", { slots: {}, fixedBy: "REQ-001 c3" }],
}) satisfies CopyPartition;
