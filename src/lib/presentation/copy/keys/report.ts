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
  // Owner-owed (#479). The pass could not read the site's own home page —
  // the fetcher refused it (too large, no answer, blocked) — so nothing
  // after it was attempted and the report stops there. No approved line
  // exists; ships as `TODO(copy)`, which renders as itself (2026-09-07).
  "notice.site-unreadable": ["TODO(copy)", { slots: {}, fixedBy: "REQ-004 c6" }],
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
  // S2's provenance line under the domain: "measured 28 Aug · [category] ·
  // Not your market?" — approved as written (11a), less the two parts that
  // are not this key's: the category is a measured value and the
  // correction is a control. Two arms, because a scan that never
  // determined a category names none and guesses none (REQ-094 c1).
  "report.measured-at": ["measured {date} · {category}", { slots: { date: "text", category: "text" }, fixedBy: "REQ-004 c1" }],
  "report.measured-at.no-category": ["measured {date}", { slots: { date: "text" }, fixedBy: "REQ-094 c1" }],
  // 6a: "Discoverability Score" is the number's name on every surface that
  // labels it — this eyebrow, the Overview tile, and the two mails.
  "verdict.score.label": ["Discoverability Score", { slots: {}, fixedBy: "ruling 6a" }],
  // REQ-094 c1's correction control, as S2 draws it. The correction flow
  // itself (the form, the 7-day window, the re-measure) is REQ-094's own
  // work and not this screen's: the control is offered with no destination
  // rather than an invented one, exactly as the pricing card's Start was
  // until checkout landed.
  "verdict.not-your-market": ["Not your market?", { slots: {}, fixedBy: "REQ-094 c1" }],

  // ── The scanning arm's six named stages (REQ-003 c1) ──────────────────
  // One key per `StageName` (`src/lib/scan/stages.ts`) — a stage with no
  // word cannot render, which is what makes "named stages, never an
  // unlabelled spinner" structural. WO-282 left these to BP-023's own
  // file plan; nothing created them, and the scanning arm cannot render
  // without them, so they are minted here with the rest of this surface.
  "stage.reading_your_site": ["Reading your site", { slots: {}, fixedBy: "REQ-003 c1" }],
  "stage.reading_access_rules": ["TODO(copy)", { slots: {}, fixedBy: "REQ-003 c1" }],
  "stage.reading_your_market": ["Finding your market and rivals", { slots: {}, fixedBy: "REQ-003 c1" }],
  "stage.checking_your_presence": ["Checking the 12 biggest searches", { slots: {}, fixedBy: "REQ-003 c1" }],
  "stage.asking_the_twelve": ["Asking AI the 12 questions", { slots: {}, fixedBy: "REQ-003 c1" }],
  "stage.scoring": ["Scoring", { slots: {}, fixedBy: "REQ-003 c1" }],
  // The elapsed time the approved set draws beside a finished stage, and
  // the one line the scanning screen ends on (S3, approved under 11a).
  "stage.elapsed": ["{seconds} s", { slots: { seconds: "text" }, fixedBy: "REQ-003 c1" }],
  "scan.waiting.line": [
    "Under a minute. This address is permanent — you can come back to it.",
    { slots: {}, fixedBy: "REQ-003 c1" },
  ],

  // ── Module 2, left card — AI answers (REQ-006) ────────────────────────
  "ai-answers.title": ["AI answers", { slots: {}, fixedBy: "REQ-006 c1" }],
  "ai-answers.source": ["Google AI answers · {date}", { slots: { date: "text" }, fixedBy: "REQ-006 c9" }],
  "ai-answers.denominator": ["AI answers appear on {answered} of your {measured} biggest searches", { slots: { answered: "text", measured: "text" }, fixedBy: "REQ-006 c1" }],
  "ai-answers.customer-citations": ["TODO(copy)", { slots: { cited: "text", answered: "text" }, fixedBy: "REQ-006 c1" }],
  "ai-answers.legend": ["TODO(copy)", { slots: {}, fixedBy: "REQ-006 c1" }],
  // REQ-006 c6's one written line: what was measured, and no second
  // engine named anywhere on the card. S2 draws it as the source chip at
  // the foot of the card.
  "ai-answers.method": ["= your market’s 12 biggest searches, asked as a buyer asks AI.", { slots: {}, fixedBy: "REQ-006 c9" }],
  "ai-answers.questions.title": ["The 12 questions", { slots: {}, fixedBy: "REQ-006 c9" }],
  "ai-answers.questions.show-all": ["Show all {total}", { slots: { total: "text" }, fixedBy: "REQ-006 c9" }],
  "ai-answers.question.not-you": ["not you", { slots: {}, fixedBy: "REQ-006 c1" }],
  "ai-answers.question.no-answer": ["TODO(copy)", { slots: {}, fixedBy: "REQ-006 c1" }],
  // REQ-006 c9's provenance pair: the search a question was derived from
  // and the brands the answer named. No `{vol}/mo` slot — the owner
  // removed per-question volume on 2026-09-03.
  // S2 draws "from: [search] · 1,900/mo · named: [brands]". The volume is
  // **not** rendered: REQ-006 c9 forbids a monthly volume "beside it or
  // anywhere else on the questions module", the owner removed it on
  // 2026-09-03, and `StoredQuestion` has no member to render it from. The
  // scaffolding either side of it is the set's, as written.
  "ai-answers.question.provenance": ["from: {search} · named: {brands}", { slots: { search: "text", brands: "text" }, fixedBy: "REQ-006 c9" }],
  // §6.2's three answer columns (issue #128). The data is measured and
  // stored; the *visual* — three columns on an approved card — is the
  // design gate #128 names and lands in its follow-up, so these four are
  // the words that gate needs and are owed before it can render. Each
  // carries the marker rather than the empty value: the card reads through
  // `copy()`, which throws on an owner-owed key and would take the whole
  // report down.
  "ai-answers.engine.ai-overview": ["TODO(copy)", { slots: {}, fixedBy: "BUILD §6.2" }],
  "ai-answers.engine.ai-mode": ["TODO(copy)", { slots: {}, fixedBy: "BUILD §6.2" }],
  "ai-answers.engine.chatgpt": ["TODO(copy)", { slots: {}, fixedBy: "BUILD §6.2" }],
  // The header over the column that carries each question's number. The
  // engine columns are a table of the twelve, and the row-label column is
  // a column like the other three — a header it does not have would be an
  // invented blank, not an absent sentence (issue #157).
  "ai-answers.engine.column.question": ["TODO(copy)", { slots: {}, fixedBy: "BUILD §6.2" }],
  // What a cell says where that engine's answer named the customer. The
  // approved one-column card says this by rendering *nothing* beside the
  // question — the absence of the `not-you` badge is the good news. In a
  // three-column grid a blank cell is ambiguous (a hit, or an engine
  // nobody asked?), so the positive state states itself (issue #157).
  "ai-answers.engine.cell.cited": ["TODO(copy)", { slots: {}, fixedBy: "BUILD §6.2" }],
  // What a column says where the engine was never asked — the free
  // report's two battery columns, and any question a ceiling stopped the
  // pass reaching. It states a fact about the measurement, never a miss.
  "ai-answers.engine.not-measured": ["TODO(copy)", { slots: {}, fixedBy: "BUILD §6.2" }],
  "ai-answers.matrix.column.domain": ["TODO(copy)", { slots: {}, fixedBy: "REQ-006 c1" }],
  "ai-answers.matrix.column.cited": ["TODO(copy)", { slots: {}, fixedBy: "REQ-006 c1" }],
  "ai-answers.matrix.empty": ["TODO(copy)", { slots: {}, fixedBy: "REQ-006 c1" }],
  "ai-answers.absent": ["TODO(copy)", { slots: {}, fixedBy: "REQ-004 c10" }],

  // ── Module 2, right card — Google presence (REQ-008) ──────────────────
  "presence.title": ["Google search", { slots: {}, fixedBy: "REQ-008 c1" }],
  "presence.source": ["your market’s 12 biggest searches", { slots: {}, fixedBy: "REQ-008 c1" }],
  "presence.occupancy": ["TODO(copy)", { slots: { you: "text", measured: "text" }, fixedBy: "REQ-008 c1" }],
  "presence.legend": ["TODO(copy)", { slots: {}, fixedBy: "REQ-008 c2" }],
  "presence.no-rivals": ["TODO(copy)", { slots: {}, fixedBy: "REQ-008 c6" }],
  "presence.occupancy.column.domain": ["TODO(copy)", { slots: {}, fixedBy: "REQ-008 c1" }],
  "presence.occupancy.column.count": ["TODO(copy)", { slots: {}, fixedBy: "REQ-008 c1" }],
  "presence.absent-from.title": ["5 biggest searches you’re absent from", { slots: {}, fixedBy: "REQ-008 c4" }],
  "presence.absent-from.column.search": ["Search", { slots: {}, fixedBy: "REQ-008 c4" }],
  "presence.absent-from.column.volume": ["Volume", { slots: {}, fixedBy: "REQ-008 c4" }],
  "presence.absent-from.column.holder": ["Holds #1", { slots: {}, fixedBy: "REQ-008 c4" }],
  "presence.absent-from.empty": ["TODO(copy)", { slots: {}, fixedBy: "REQ-008 c4" }],
  "presence.absent": ["TODO(copy)", { slots: {}, fixedBy: "REQ-004 c10" }],

  // ── Module 3, the three problem cards (REQ-009) ───────────────────────
  // One title, one doer and one measured-zero line per problem; the three
  // severity words are BANDS_COPY's `severity.*` and are not restated.
  "problem.blocked-readers.title": ["AI readers blocked", { slots: {}, fixedBy: "REQ-009 c1" }],
  "problem.blocked-readers.doer": ["Free fix · 10 min", { slots: {}, fixedBy: "REQ-009 c2" }],
  "problem.blocked-readers.none-needed": ["Nothing to fix", { slots: {}, fixedBy: "REQ-009 c3" }],
  "problem.missing-pages.title": ["Missing pages", { slots: {}, fixedBy: "REQ-009 c1" }],
  "problem.missing-pages.doer": ["ReachKit writes", { slots: {}, fixedBy: "REQ-009 c5" }],
  "problem.missing-pages.none-needed": ["Nothing to fix", { slots: {}, fixedBy: "REQ-009 c3" }],
  "problem.unquotable-pages.title": ["Unquotable pages", { slots: {}, fixedBy: "REQ-009 c1" }],
  "problem.unquotable-pages.doer": ["ReachKit rewrites", { slots: {}, fixedBy: "REQ-009 c5" }],
  "problem.unquotable-pages.none-needed": ["Nothing to fix", { slots: {}, fixedBy: "REQ-009 c3" }],
  // The one control any fix carries (REQ-009 c2), on the paste arm only.
  "problem.paste.label": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c2" }],

  // ── Module 4, the DIY sections (REQ-009 c6) ───────────────────────────
  // Instructional text is allowed here and nowhere else on this screen.
  // S2's eyebrow over the three collapses. The collapses themselves stay
  // owner-owed: instructional prose is the owner's to write.
  "method.title": ["The complete method, free", { slots: {}, fixedBy: "REQ-009 c6" }],
  "method.blocked-readers.title": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c6" }],
  "method.blocked-readers.body": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c6" }],
  "method.missing-pages.title": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c6" }],
  "method.missing-pages.body": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c6" }],
  "method.unquotable-pages.title": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c6" }],
  "method.unquotable-pages.body": ["TODO(copy)", { slots: {}, fixedBy: "REQ-009 c6" }],

  // ── Module 5, the free page card (REQ-010, BUILD §4.2's trade) ────────
  "free-page.title": ["Your first page", { slots: {}, fixedBy: "REQ-010 c1" }],
  "free-page.badge": ["free", { slots: {}, fixedBy: "REQ-010 c1" }],
  "free-page.of": ["That’s page 1 of {total} we found for you.", { slots: { total: "text" }, fixedBy: "REQ-010 c1" }],
  "free-page.row.target": ["target", { slots: {}, fixedBy: "REQ-010 c1" }],
  // The target row's own value: the search and its monthly volume, the
  // pair §4.2 says the giveaway email carries. Not the per-question
  // volume the owner removed on 2026-09-03 — that was the 12-questions
  // list, which carries no volume at all.
  "free-page.target.value": ["TODO(copy)", { slots: { keyword: "text", volume: "text" }, fixedBy: "REQ-010 c1" }],
  "free-page.row.beats": ["beats", { slots: {}, fixedBy: "REQ-010 c1" }],
  "free-page.row.format": ["format", { slots: {}, fixedBy: "REQ-010 c1" }],
  // REQ-010 c2's trade: the address field and the one control beside it.
  "free-page.email.label": ["Your email", { slots: {}, fixedBy: "REQ-010 c2" }],
  "free-page.email.placeholder": ["you@company.com", { slots: {}, fixedBy: "REQ-010 c2" }],
  "free-page.submit": ["Email me the full page", { slots: {}, fixedBy: "REQ-010 c2" }],
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
  // verbatim, the one string on this page that is not owed. Every key here
  // carries the marker: the shape of the argument renders and the argument
  // itself stays the owner's.
  //
  // L7–L10 (the demo video block) are declared and **not rendered**: the
  // video is *absent* until an asset exists, and tokens.md §9.4 decides
  // that the absent block does not render at all — no placeholder, no
  // "coming soon", no empty frame. They are here so the block has its
  // sentences the day the asset lands, and `tests/app/landing/` asserts the
  // section is not in the document until then.
  "landing.subline": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L1" }],
  "landing.hero.specimen.label": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L5" }],
  "landing.hero.specimen.caption": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L6" }],
  "landing.video.eyebrow": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L7" }],
  "landing.video.heading": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L8" }],
  "landing.video.blocked": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L9" }],
  "landing.video.open": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L10" }],
  "landing.why.eyebrow": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L11" }],
  "landing.why.heading": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L12" }],
  "landing.why.body": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L13" }],
  "landing.does.eyebrow": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L14" }],
  "landing.does.heading": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L15" }],
  "landing.does.item-1.title": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L16" }],
  "landing.does.item-1.line": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L17" }],
  "landing.does.item-2.title": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L18" }],
  "landing.does.item-2.line": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L19" }],
  "landing.does.item-3.title": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L20" }],
  "landing.does.item-3.line": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L21" }],
  "landing.start.eyebrow": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L22" }],
  "landing.start.heading": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L23" }],
  "landing.start.body": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L24" }],
  "landing.start.cta": ["TODO(copy)", { slots: {}, fixedBy: "issue 266 · L25" }],

  // ── S1, the owner-approved screen set (2026-09-08) ────────────────────
  //
  // The set redraws this page and ruling 11a settles its copy: "the
  // artifact's unbracketed strings are approved copy as written"; only its
  // bracketed strings stay owner-owed. The keys below are the strings S1
  // adds to the twenty-five above — filled where the set writes them,
  // marked where it brackets them.
  //
  // The keys the new screen no longer renders (L5–L10, the two numbered
  // eyebrows, L16–L21's three narrative cards, L22) are left in place: the
  // set replaced the specimen card with the hero component, the three
  // cards with three Step cards, and the eyebrows with 01 · 02 · 03. Issue
  // #347 is the landing's copy pass and owns that reconciliation.

  /** The field's placeholder. Approved (11a) — the set writes it. */
  "landing.field.placeholder": ["yourdomain.com", { slots: {}, fixedBy: "approved set S1 · 11a" }],
  /** The line under the field. Approved (11a). */
  "landing.hero.assurance": ["free · no account · permanent link", { slots: {}, fixedBy: "approved set S1 · 11a" }],
  /** The address in the hero component's browser frame — a value, not a
   *  sentence: this product's own app address, in the mono face like every
   *  other address (§2.3). */
  "landing.shot.address": ["reachkit.app/app", { slots: {}, fixedBy: "approved set S1 · 11a" }],
  /** The badge beside the hero component's headline. The Overview's own
   *  badge reads "every week since you started"; the set's miniature shows
   *  the short form, and it is the miniature that renders here. */
  "landing.shot.badge": ["every week", { slots: {}, fixedBy: "approved set S1 · 11a" }],

  /** The video block (ruling 4c): "renders a 16:9 frame with a play control
   *  and one written line before the asset exists". Both strings are
   *  bracketed in the set and stay owed; the block renders regardless,
   *  which is what 4c changed about REQ-099 c6. */
  "landing.video.line": ["TODO(copy)", { slots: {}, fixedBy: "approved set S1 · 4c" }],
  "landing.video.caption": ["TODO(copy)", { slots: {}, fixedBy: "approved set S1 · 4c" }],

  /** Section 01's own line, under the live AI-answers matrix. Approved
   *  (11a) — it is the sentence that makes the matrix an argument. */
  "landing.why.matrix.line": ["Every filled row is a rival being recommended. The empty one is you.", { slots: {}, fixedBy: "approved set S1 · 11a" }],
  /** Section 02's body line beneath its heading. */
  "landing.does.body": ["TODO(copy)", { slots: {}, fixedBy: "approved set S1" }],
  /** Section 02's This-week card: the head badge, and the panel under the
   *  week strip. The page's own title is data this specimen has none of, so
   *  it is owed; the line is approved. */
  "landing.week.badge": ["on schedule", { slots: {}, fixedBy: "approved set S1 · 11a" }],
  "landing.week.page.title": ["TODO(copy)", { slots: {}, fixedBy: "approved set S1" }],
  "landing.week.page.line": ["publishes in 6 h 12 m unless you say otherwise", { slots: {}, fixedBy: "approved set S1 · 11a" }],

  /** Section 03's three Step cards. The eyebrow and the three titles are
   *  approved (11a); the three bodies are bracketed and owed. */
  "landing.step.eyebrow": ["Step {n}", { slots: { n: "text" }, fixedBy: "approved set S1 · 11a" }],
  "landing.step.1.title": ["Scan your domain", { slots: {}, fixedBy: "approved set S1 · 11a" }],
  "landing.step.1.body": ["TODO(copy)", { slots: {}, fixedBy: "approved set S1" }],
  "landing.step.2.title": ["Pick your market and rivals", { slots: {}, fixedBy: "approved set S1 · 11a" }],
  "landing.step.2.body": ["TODO(copy)", { slots: {}, fixedBy: "approved set S1" }],
  "landing.step.3.title": ["One page goes live every day", { slots: {}, fixedBy: "approved set S1 · 11a" }],
  "landing.step.3.body": ["TODO(copy)", { slots: {}, fixedBy: "approved set S1" }],
  /** Under the closing CTA. Approved (11a). The pricing card carries the
   *  same sentence through `offer.cancel-line`, which is still empty and is
   *  #369's to fill — one key per screen, neither borrowed. */
  "landing.start.cancel": ["Cancel in one click.", { slots: {}, fixedBy: "approved set S1 · 11a" }],
}) satisfies CopyPartition;
