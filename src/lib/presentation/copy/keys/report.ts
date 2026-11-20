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
// (DECISIONS 2026-09-11), byte for byte.
import type { CopyPartition } from "../registry.ts";

export const REPORT_COPY = Object.freeze({
  // Issue 1444 (owner, 2026-10-15): the biggest gap is a short title naming
  // the bar, and one line under it saying what that bar is. Presence shows
  // as its two bars, Google and AI; `.presence` is a stored report whose two
  // halves were not kept.
  "verdict.limiting.foundations": ["Biggest gap: Website basics", { slots: {} }],
  "verdict.limiting.foundations.line": ["AI and Google can’t fully read your site.", { slots: {} }],
  "verdict.limiting.answerability": ["Biggest gap: Answers questions", { slots: {} }],
  "verdict.limiting.answerability.line": ["Your pages don’t answer buyers’ questions directly.", { slots: {} }],
  "verdict.limiting.google": ["Biggest gap: Google", { slots: {} }],
  "verdict.limiting.google.line": ["You’re rarely on Google’s first page.", { slots: {} }],
  "verdict.limiting.ai": ["Biggest gap: AI", { slots: {} }],
  "verdict.limiting.ai.line": ["AI answers rarely mention you.", { slots: {} }],
  "verdict.limiting.presence": ["Biggest gap: AI and Google", { slots: {} }],
  "verdict.limiting.presence.line": ["Buyers rarely find you on Google or in AI answers.", { slots: {} }],
  "removal.address": ["remove@reachkit.app", { slots: {} }],
  "removal.line.removed": ["The site’s owner asked us to remove this report. To scan {domain} again, write to {address}.", { slots: { domain: "text", address: "text" } }],
  "notice.incomplete": ["We couldn’t scan {what}, so this report is incomplete.", { slots: { what: "text" } }],
  "notice.measurement-failed": ["The last scan didn’t finish, so nothing changed.", { slots: {} }],
  "notice.correction-failed": ["The correction didn’t finish. This is the report from before.", { slots: {} }],
  // #479. The pass could not read the site's own home page — the fetcher
  // refused it (too large, no answer, blocked) — so nothing after it was
  // attempted and the report stops there. Owner-owed until 2026-09-11, when
  // the owner approved this sentence (#516).
  "notice.site-unreadable": ["We couldn’t read this site’s home page. Check the address and scan again.", { slots: {} }],
  // Issue 1379. The site's bot protection answered our reader with a page of
  // its own, so the site's own pages are unmeasured: never a zero, never
  // that page's facts. Drafted in this registry’s voice and shipped under
  // the owner ruling of 2026-09-16 (#759); the owner corrects the wording.
  "notice.bot-protected": ["This site’s bot protection blocked us, so we couldn’t score its pages.", { slots: {} }],
  // SPEC §2 (owner, 2026-10-10, issue 1387): where the market was read from
  // the site's listing in search. Drafted (#759).
  // SPEC §2 (owner, 2026-10-15, issue 1440): the searches a free scan left
  // unread are being read in the background. Short on purpose (the issue's
  // own words). Drafted (#759).
  "report.finishing-reads": ["Still scanning {count} searches…", { slots: { count: "text" } }],
  "report.finishing-reads.one": ["Still scanning {count} search…", { slots: { count: "text" } }],
  // SPEC §2 (issue 1481): the deployed code would read this stored scan
  // differently and the re-score has not rewritten it yet. Drafted (#759).
  "report.reads-differently": ["Scanned {date}. We’ve changed how we scan since. Scan again for a fresh report.", { slots: { date: "text" } }],
  // SPEC §2 (issue 1450): the site's pages were read and the model gave no
  // profile of them, so the market was read from its listing. Short on
  // purpose (master review on #1451). Drafted (#759).
  // Issue 1454: the scanning page's section title, and where the business sells. Drafted (#759).
  "report.read.title": ["What We Read", { slots: {} }],
  "report.read.where.local": ["In and around {place}", { slots: { place: "text" } }],
  "report.read.where.national": ["Across {country}", { slots: { country: "text" } }],
  "report.read.where.international": ["Online, in more than one country", { slots: {} }],
  "report.market.from-listing": ["We read your market from your Google listing.", { slots: {} }],
  "report.market.from-search": ["We couldn’t read your pages, so we found your market on Google.", { slots: {} }],
  // Issue 898. The site read and its market did not — the profile call or
  // the suggestions did not answer — so there is no question, no answer
  // card and no band. Distinct from `notice.incomplete`, which names
  // drivers that were not measured while others were; here nothing was
  // measured from the market at all, and naming a driver would name the
  // consequence rather than the cause. Drafted in this registry’s voice
  // and shipped under the owner ruling of 2026-09-16 (#759); the owner
  // corrects the wording.
  "notice.market-unread": ["We couldn’t work out this site’s market. Scan again in a minute.", { slots: {} }],
  "notice.refused.network-limit": ["Your network has used this hour’s free scans. Scan again in {wait}.", { slots: { wait: "text" } }],
  // Issue 885's two free-path bounds. Drafted in this registry’s voice and
  // shipped under the owner ruling of 2026-09-16 (#759); the owner corrects
  // the wording. Neither borrows `network-limit`’s sentence: that one names
  // the hour and the five, and the day bound is neither — and the domain
  // bound is not about the visitor’s network at all, so a sentence that
  // said "from your network" would be telling a stranger they had done
  // something they had not.
  "notice.refused.network-day-limit": ["Your network has used today’s free scans. Scan again in {wait}.", { slots: { wait: "text" } }],
  "notice.refused.domain-day-limit": ["This site has had today’s free scans. Scan again in {wait}.", { slots: { wait: "text" } }],
  "notice.refused.scan-running": ["A scan from your network is still running. Try again in about {wait}.", { slots: { wait: "text" } }],
  // #104. ReachKit's own stop, in writing — the one refusal the visitor
  // did not cause and the only one that names no wait, because nobody can
  // say when we start again (ADR-011).
  "notice.refused.stopped": ["Free scans are paused for now. Every report stays open to read.", { slots: {} }],
  "control.rescan-age": ["Scan Again", { slots: {} }],
  "control.rescan-incomplete": ["Scan What’s Missing", { slots: {} }],
  "control.retry": ["Scan Again", { slots: {} }],
  // Issue 715: the control on a part the pass's ceiling cut off — SPEC §2
  // quotes the words.
  "control.retry-part": ["Scan This Part Again", { slots: {} }],
  "copy-link.label": ["Copy Link", { slots: {} }],

  // ── Module 1, the verdict strip (BUILD §4.1) ──────────────────────────
  // The domain and the date ride beside the score so it is never a bare
  // specimen number (REQ-004 c1).
  // The four bars, named as subjects (issue 1444): Readiness, Content, and
  // Presence shown as its two halves, Google and AI. `LIMITING_LINES` holds
  // the *sentence* about a bar; these hold the bar's own name, for the
  // `{what}` slot of `unmeasured.undeterminable` / `.not-attempted`
  // (REQ-004 c3). `.presence` names both halves at once, where a stored
  // report kept Presence and not its halves.
  "verdict.factor.foundations": ["Website basics", { slots: {} }],
  "verdict.factor.answerability": ["Answers questions", { slots: {} }],
  "verdict.factor.google": ["Google", { slots: {} }],
  "verdict.factor.ai": ["AI", { slots: {} }],
  "verdict.factor.presence": ["AI and Google", { slots: {} }],
  // The `{wait}` the two refusal lines take: the figure is the refusal's
  // own `retryAfterSeconds` in whole minutes, the unit word is the
  // owner's, so no duration is composed in a component.
  "report.wait.minutes": ["{minutes} min", { slots: { minutes: "text" } }],
  // S2's provenance line under the domain: "measured 28 Aug · [category] ·
  // Not your market?" — approved as written (11a), less the two parts that
  // are not this key's: the category is a measured value and the
  // correction is a control. Two arms, because a scan that never
  // determined a category names none and guesses none (REQ-094 c1).
  "report.measured-at": ["Scanned {date} · {what}.", { slots: { date: "text", what: "text" } }],
  "report.measured-at.no-category": ["Scanned {date}.", { slots: { date: "text" } }],
  // Issue 715: SPEC §2 — "Measurement is US Google in English, stated in one
  // always-visible line." Owner-owed.
  "report.measurement": ["Searched on Google in the US, in English.", { slots: {} }],
  // 6a: "Discoverability Score" is the number's name on every surface that
  // labels it — this eyebrow, the Overview tile, and the two mails.
  "verdict.score.label": ["Visibility Score", { slots: {} }],
  // Issue 1068, board R12-2: the summary card's eyebrow and what the ring's
  // figure is out of. Drafted; the owner corrects the wording.
  "report.eyebrow": ["Your free report", { slots: {} }],
  "verdict.score.of": ["of 100", { slots: {} }],
  // Issue 1932: beside the range, where a re-score moved the score because
  // the Google half moved. `{before}` is the score as first stored. Drafted;
  // the owner corrects the wording.
  "verdict.rescored": ["Updated {date}, when we changed how the Google part counts. It was {before}.", { slots: { date: "text", before: "text" } }],
  // REQ-094 c1's correction control, as S2 draws it. #786 gives it its
  // destination: an inline field that posts the corrected market to
  // `POST /api/report/{domain}/correct` and follows the rerun's stages.
  "verdict.not-your-market": ["Not Your Market? Correct It", { slots: {} }],
  // #786: the field, its line and its outcomes. Drafted in the registry's
  // voice under the 2026-09-16 ruling (#759) — named in the PR for the
  // owner to correct.
  "correction.field.label": ["Your market, in a few words", { slots: {} }],
  "correction.submit": ["Scan Again for This Market", { slots: {} }],
  "correction.cancel": ["Cancel", { slots: {} }],
  "correction.line": [
    "You can correct this once. We reuse the AI answers we have.",
    { slots: {} },
  ],
  "correction.running": [
    "Scanning again for your market. This page updates when it’s done.",
    { slots: {} },
  ],
  "correction.refused.running": ["A correction is already running for this report.", { slots: {} }],
  "correction.refused.used": ["You’ve already used this report’s one correction.", { slots: {} }],
  "correction.refused.too-old": [
    "This report is too old to correct. Scan it again instead.",
    { slots: {} },
  ],
  "correction.refused.unavailable": [
    "That didn’t start, and your correction is still unused. Try again in a few minutes.",
    { slots: {} },
  ],

  // ── The scanning arm's six named stages (REQ-003 c1) ──────────────────
  // One key per `StageName` (`src/lib/scan/stages.ts`) — a stage with no
  // word cannot render, which is what makes "named stages, never an
  // unlabelled spinner" structural. WO-282 left these to BP-023's own
  // file plan; nothing created them, and the scanning arm cannot render
  // without them, so they are minted here with the rest of this surface.
  "stage.reading_your_site": ["Reading your site", { slots: {} }],
  "stage.reading_access_rules": ["Checking what Google and AI may read", { slots: {} }],
  "stage.reading_your_market": ["Finding your market and competitors", { slots: {} }],
  "stage.checking_your_presence": ["Checking {searches} searches buyers make", { slots: { searches: "text" } }],
  "stage.asking_the_twelve": ["Asking Google’s AI the same searches", { slots: {} }],
  "stage.scoring": ["Working out your score", { slots: {} }],
  "stage.reading_your_site.line": ["What you sell, who buys it and where.", { slots: {} }],
  "stage.reading_access_rules.line": ["Whether your site lets them in.", { slots: {} }],
  "stage.reading_your_market.line": ["Who shows up when your buyers search.", { slots: {} }],
  "stage.checking_your_presence.line": ["Who is on Google’s first page for each.", { slots: {} }],
  "stage.asking_the_twelve.line": ["Which businesses the answers mention.", { slots: {} }],
  "stage.scoring.line": ["One number for how easy you are to find.", { slots: {} }],
  "stage.status.done": ["Done", { slots: {} }],
  "stage.status.working": ["Working on it", { slots: {} }],
  "stage.status.next": ["Next", { slots: {} }],
  "stage.started": ["started {time}", { slots: { time: "text" } }],
  // The elapsed time the approved set draws beside a finished stage, and
  // the one line the scanning screen ends on (S3, approved under 11a).
  "stage.elapsed": ["{seconds} s", { slots: { seconds: "text" } }],
  "scan.eyebrow": ["Your free scan", { slots: {} }],
  "scan.head": ["Scanning {domain}", { slots: { domain: "text" } }],
  "scan.progress.title": ["Progress", { slots: {} }],
  "scan.get.score": ["Your Visibility Score", { slots: {} }],
  "scan.filling.title": ["Your Report So Far", { slots: {} }],
  "scan.filling.grey": ["Still loading…", { slots: {} }],
  "scan.filling.readers": ["Who Can Read Your Site", { slots: {} }],
  "scan.filling.competitors": ["Your Competitors", { slots: {} }],
  "scan.filling.searches": ["{searches} Searches Buyers Make", { slots: { searches: "text" } }],
  "scan.filling.ai": ["What AI Answers Say", { slots: {} }],
  "scan.filling.pages": ["{pages} pages read", { slots: { pages: "text" } }],
  "scan.filling.buyer": ["Who buys: {buyer}", { slots: { buyer: "text" } }],
  "scan.filling.reader.google": ["Google", { slots: {} }],
  "scan.filling.reader.ai": ["AI", { slots: {} }],
  "scan.filling.reader.in": ["let in", { slots: {} }],
  "scan.filling.reader.out": ["shut out", { slots: {} }],
  "scan.filling.reader.fix": ["Your report will show the free fix.", { slots: {} }],
  "scan.filling.search.in": ["first page", { slots: {} }],
  "scan.filling.search.out": ["not on first page", { slots: {} }],
  "scan.filling.found": ["found", { slots: {} }],
  "scan.waiting.line": ["This takes under a minute. Your report stays at this link.", { slots: {} }],
  /** The line above the stages when a re-measure was started *from* a
   *  report that is already on screen (#935). It is not
   *  `scan.waiting.line` — that one tells a first-time visitor the address
   *  survives the wait, which this reader already knows — and it is not
   *  `correction.running`, which names the market they gave. Drafted under
   *  the owner's 2026-09-16 ruling (#759), in this registry's voice. */
  "scan.rescanning.line": [
    "Scanning again. This page updates when it’s done.",
    { slots: {} },
  ],

  // ── Module 2, left card — AI answers (REQ-006) ────────────────────────
  "ai-answers.title": ["AI", { slots: {} }],
  "ai-answers.source": ["We asked Google’s AI {total} buyer searches. It answered {answered}.", { slots: { total: "text", answered: "text" } }],
  // Issue 715: SPEC §2 — a category correction reuses the AI answers already
  // read, "and says so". Owner-owed.
  "ai-answers.coverage.cached-only": [
    "These AI answers come from an earlier scan.",
    { slots: {} },
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
  "ai-answers.reused-from": ["Reused from {date}", { slots: { date: "text" } }],
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
    "Scanning this part again. This page updates when it’s done.",
    { slots: {} },
  ],
  "retry-part.refused.no-budget": [
    "This part can’t be scanned again. Scan the whole site again instead.",
    { slots: {} },
  ],
  "retry-part.refused.already-measured": [
    "This part is done. Reload the page to see it.",
    { slots: {} },
  ],
  "retry-part.refused.unavailable": [
    "That didn’t start. Try again in a few minutes.",
    { slots: {} },
  ],
  // Issue 1444: the card's figure is `{count} of {total}` (`report.figure.of`)
  // — the answers that mention the customer of those that appeared — and
  // this is the one line under it.
  "ai-answers.finding": ["AI answers that mention you", { slots: {} }],
  // Issue 1439: AI answered none of the searches read, so AI presence is not
  // judged and the score counts search alone. Short, as titles are (#1444).
  "ai-answers.finding.unanswered": ["AI doesn't answer these searches yet.", { slots: {} }],
  // REQ-006 c6's one written line: what was measured, and no second
  // engine named anywhere on the card. S2 draws it as the source chip at
  // the foot of the card.
  "ai-answers.questions.title": ["The {total} searches", { slots: { total: "text" } }],
  // Issue 873: what this report measured, in one line, so a founder does
  // not count rows to find out.
  "ai-answers.questions.measured": [
    "We scanned {measured} of these {total} searches.",
    { slots: { measured: "text", total: "text" } },
  ],
  // Issue 1309: a pass that found more questions than its purse or its 50 s
  // could measure lists them all, so the list's count is not the report's
  // measured count. These two say which is which; the pair above stays for
  // a report that measured every question it lists.
  "ai-answers.questions.title.partial": ["Searches Scanned: {measured} of {total}", { slots: { total: "text", measured: "text" } }],
  "ai-answers.questions.measured.partial": [
    "We scanned {measured} of the {total} we found. Rows marked not measured don’t count.",
    { slots: { measured: "text", total: "text" } },
  ],
  "ai-answers.question.not-you": ["not you", { slots: {} }],
  "ai-answers.question.no-answer": ["no answer", { slots: {} }],
  // REQ-006 c9's provenance pair: the search a question was derived from
  // and the brands the answer named. No `{vol}/mo` slot — the owner
  // removed per-question volume on 2026-09-03.
  // S2 draws "from: [search] · 1,900/mo · named: [brands]". The volume is
  // **not** rendered: REQ-006 c9 forbids a monthly volume "beside it or
  // anywhere else on the questions module", the owner removed it on
  // 2026-09-03, and `StoredQuestion` has no member to render it from. The
  // scaffolding either side of it is the set's, as written.
  "ai-answers.question.provenance": ["from: {search} · mentioned: {brands}", { slots: { search: "text", brands: "text" } }],
  // §6.2's three answer columns (issue #128). The data is measured and
  // stored; the *visual* — three columns on an approved card — is the
  // design gate #128 names and lands in its follow-up, so these four are
  // the words that gate needs before it can render.
  "ai-answers.engine.ai-overview": ["Google AI Overview", { slots: {} }],
  "ai-answers.engine.ai-mode": ["Google AI Mode", { slots: {} }],
  "ai-answers.engine.chatgpt": ["ChatGPT", { slots: {} }],
  // The header over the column that carries each question's number. The
  // engine columns are a table of the twelve, and the row-label column is
  // a column like the other three — a header it does not have would be an
  // invented blank, not an absent sentence (issue #157).
  "ai-answers.engine.column.question": ["Search", { slots: {} }],
  // What a cell says where that engine's answer named the customer. The
  // approved one-column card says this by rendering *nothing* beside the
  // question — the absence of the `not-you` badge is the good news. In a
  // three-column grid a blank cell is ambiguous (a hit, or an engine
  // nobody asked?), so the positive state states itself (issue #157).
  "ai-answers.engine.cell.cited": ["mentioned you", { slots: {} }],
  // What a column says where the engine was never asked — the free
  // report's two battery columns, and any question a ceiling stopped the
  // pass reaching. It states a fact about the measurement, never a miss.
  "ai-answers.engine.not-measured": ["not measured", { slots: {} }],
  "ai-answers.absent": ["We couldn’t scan AI answers this time. The rest of the report still holds.", { slots: {} }],

  // ── Module 2, right card — Google presence (REQ-008) ──────────────────
  "presence.title": ["Google", { slots: {} }],
  // Issue 1309: the count is the card's own denominator, never the literal
  // twelve — the chip said 12 over a report that measured two.
  "presence.source": ["Out of {measured} searches buyers in your market make.", { slots: { measured: "text" } }],
  // Issue 1444: the card's figure is `{count} of {total}` — the searches
  // the customer is on the first page for, of those measured — and this is
  // the one line under it. The competitors' counts are the bars.
  "presence.finding": ["Searches where you’re on Google’s first page", { slots: {} }],
  // A figure: one count out of another, as each card's head states it.
  "report.figure.of": ["{count} of {total}", { slots: { count: "text", total: "text" } }],
  "presence.no-rivals": ["No competitor showed up in these searches.", { slots: {} }],
  "presence.absent-from.title": ["Searches Where You Don’t Show Up", { slots: {} }],
  "presence.absent-from.column.search": ["Search", { slots: {} }],
  "presence.absent-from.column.volume": ["Searches a month", { slots: {} }],
  "presence.absent-from.column.holder": ["Who’s first", { slots: {} }],
  "presence.absent-from.empty": ["You show up in every search we scanned.", { slots: {} }],
  "presence.absent": ["We couldn’t scan Google this time. The rest of the report still holds.", { slots: {} }],

  // ── Module 3, the three problem cards (REQ-009) ───────────────────────
  // One title and one doer per problem; the severity words are BANDS_COPY's `severity.*`.
  "problem.blocked-readers.title": ["AI Shut Out of Your Site", { slots: {} }],
  "problem.blocked-readers.doer": ["Free fix · 10 min", { slots: {} }],
  "problem.missing-pages.title": ["Missing Pages", { slots: {} }],
  "problem.missing-pages.doer": ["ReachKit writes", { slots: {} }],
  "problem.unquotable-pages.title": ["Pages AI Can’t Quote", { slots: {} }],
  "problem.unquotable-pages.doer": ["ReachKit rewrites on WordPress", { slots: {} }],
  // The one control any fix carries (REQ-009 c2), on the paste arm only.
  "problem.paste.label": ["Copy the Lines", { slots: {} }],
  // The fixes' heads, each card's one-line cause, and the *show me* link it opens. Drafted; the owner corrects them.
  "problem.section.title": ["Site Fixes", { slots: {} }],
  "problem.section.sub": ["The {problems} that cost you most, then {checks} quick checks", { slots: { problems: "text", checks: "text" } }],
  "problem.section.sub.problems": ["The {problems} that cost you most", { slots: { problems: "text" } }],
  "problem.section.sub.checks": ["{checks} quick checks", { slots: { checks: "text" } }],
  // With nothing to list: the problems measured and the checks that ran, all passed. Owner-owed wording (#1034).
  "problem.section.none": ["All {n} checks passed.", { slots: { n: "text" } }],
  "problem.top.title": ["Fix These First", { slots: {} }],
  "problem.blocked-readers.cause": ["Your site blocks AI, or asks Google and AI to skip pages.", { slots: {} }],
  "problem.missing-pages.cause": ["Questions your buyers ask that no page on your site answers.", { slots: {} }],
  "problem.unquotable-pages.cause": ["These pages have no clear answer AI can quote.", { slots: {} }],
  "problem.show.lines": ["Show Me the Lines", { slots: {} }],
  "problem.show.first-page": ["See the First One", { slots: {} }],
  "problem.show.method": ["Show Me How", { slots: {} }],

  // ── Module 3, the technical checks (SPEC §9, issue 571) ──────────────
  // The doer words are SPEC §9’s own; the eight card titles and the not-run line are owner-owed.
  "check.doer.free-fix": ["Free fix · 10 min", { slots: {} }],
  "check.doer.reachkit-writes": ["ReachKit writes", { slots: {} }],
  "check.doer.reachkit-rewrites": ["ReachKit rewrites on WordPress", { slots: {} }],
  "check.not-run": [
    "We couldn’t run this check. It may still need a fix.",
    { slots: {} },
  ],
  // Issue 1068: the eight checks are one list, and a grey dot is the not-run
  // line said once under it.
  "check.legend": ["A grey dot means we couldn’t run that check.", { slots: {} }],
  "check.page-titles.title": ["Missing or duplicate titles", { slots: {} }],
  "check.meta-descriptions.title": ["Missing or duplicate descriptions", { slots: {} }],
  "check.noindex-pages.title": ["Pages hidden from search", { slots: {} }],
  "check.sitemap.title": ["No page list for Google", { slots: {} }],
  "check.slow-pages.title": ["Slow pages", { slots: {} }],
  "check.broken-links.title": ["Broken internal links", { slots: {} }],
  "check.phone-usability.title": ["Hard to use on a phone", { slots: {} }],
  // The report's plain name; the account's Technical issues view keeps "Broken internal links" (board AppIssues).
  "check.broken-links.plain": ["Links between pages that go nowhere", { slots: {} }],
  "check.status.not-run": ["Couldn’t run", { slots: {} }],
  "check.structured-data.title": ["Pages with no labels for Google", { slots: {} }],
  // The report's plain name (board PubReport); the account surfaces read the problem in `.title`.
  "check.structured-data.plain": ["Page labels Google can read", { slots: {} }],
  // Who the labels say runs the site, under the structured-data row; no line where it was not measured.
  "check.identity.found": ["The labels say who runs the site: {type}.", { slots: { type: "text" } }],
  "check.identity.none": ["No label says who runs the site.", { slots: {} }],
  // Issue 1550 (drafted): the one thing to do about each check the customer
  // fixes, on the account's Technical issues view.
  "check.noindex-pages.fix": ["Turn off noindex on these pages in your site builder or plugin. Then Google can list them.", { slots: {} }],
  "check.sitemap.fix": ["Turn on your sitemap in your site builder or plugin. Add its address to robots.txt.", { slots: {} }],
  "check.slow-pages.fix": ["Turn on page caching with your host. Shrink the biggest images on these pages.", { slots: {} }],
  "check.broken-links.fix": ["These links lead to error pages. Fix or remove them.", { slots: {} }],
  "check.phone-usability.fix": ["Add a viewport tag to these pages’ template. Then they fit a phone screen.", { slots: {} }],
  "check.ai-readers.fix": ["Let AI in through your robots.txt. Remove any nosnippet setting from your pages.", { slots: {} }],

  // ── Module 4, the DIY sections (REQ-009 c6) ───────────────────────────
  // Instructional text is allowed here and nowhere else on this screen.
  // S2's eyebrow over the three collapses. The collapses' instructional
  // prose is the owner's (approved 2026-09-10, #459).
  "method.title": ["Do It Yourself, Free", { slots: {} }],
  "method.blocked-readers.title": ["Let AI In", { slots: {} }],
  "method.blocked-readers.body": ["Open your site’s robots.txt file. Your host usually has a setting for it.", { slots: {} }],
  "method.blocked-readers.step.1": ["Add the lines shown, so AI tools are let in.", { slots: {} }],
  "method.blocked-readers.step.2": ["Remove nosnippet or max-snippet:0 from any page that has it.", { slots: {} }],
  "method.blocked-readers.step.3": ["If your home page says noindex, remove that too.", { slots: {} }],
  "method.blocked-readers.snippet-pages": ["AI answers can’t quote these pages:", { slots: {} }],
  "method.blocked-readers.training-choice": ["Your robots.txt keeps {crawlers} out. That only stops AI training, so we don’t count it.", { slots: { crawlers: "text" } }],
  "method.missing-pages.title": ["Write the Missing Pages", { slots: {} }],
  "method.missing-pages.body": ["You don’t need ReachKit for any of this.", { slots: {} }],
  "method.missing-pages.step.1": ["Answer the buyer’s question in the first lines.", { slots: {} }],
  "method.missing-pages.step.2": ["Back it with facts from your own site, each one linked.", { slots: {} }],
  "method.missing-pages.step.3": ["Put it on your own website, at a plain address.", { slots: {} }],
  "method.missing-pages.step.4": ["Link to it from a page that already does well.", { slots: {} }],
  "method.missing-pages.step.5": ["A few pages a week is a good pace. One a week still helps.", { slots: {} }],
  "method.unquotable-pages.title": ["Make Pages AI Can Quote", { slots: {} }],
  "method.unquotable-pages.body": ["AI quotes pages that answer a question directly.", { slots: {} }],
  "method.unquotable-pages.step.1": ["Turn each heading into a question a buyer asks.", { slots: {} }],
  "method.unquotable-pages.step.2": ["Put a direct answer of 2 or 3 sentences under it.", { slots: {} }],
  "method.unquotable-pages.step.3": ["Add proof: a figure, a date, a source you link to.", { slots: {} }],
  "method.unquotable-pages.step.4": ["Keep the page’s address, so it keeps what it has earned.", { slots: {} }],

  // ── Module 5, the free page card (REQ-010, BUILD §4.2's trade) ────────
  "free-page.title": ["Your First Page, Free", { slots: {} }],
  "free-page.badge": ["free", { slots: {} }],
  // The facts list, in the board's order and words (owner R26).
  "free-page.row.target": ["answers", { slots: {} }],
  "free-page.row.searched": ["searched", { slots: {} }],
  // The page's own target volume, not the per-question volume removed on 2026-09-03.
  "free-page.searched.value": ["{volume} times a month", { slots: { volume: "text" } }],
  "free-page.row.beats": ["answered today by", { slots: {} }],
  "free-page.row.format": ["type of page", { slots: {} }],
  // Shown only once the page is written: its stored first lines, a source they cite, and what they are.
  "free-page.source": ["from {source}", { slots: { source: "text" } }],
  "free-page.caption": ["The first lines, written by AI from your site. We email you the full page.", { slots: {} }],
  // The format row's value, one per Write type the report can offer (issue 787,
  // drafted — the owner corrects the wording).
  "free-page.format.answer_page": ["An answer page", { slots: {} }],
  "free-page.format.comparison_page": ["A comparison page", { slots: {} }],
  "free-page.format.format_page": ["A comparison, alternative, integration or template page", { slots: {} }],
  "free-page.format.keyword_page": ["A page for this search", { slots: {} }],
  // REQ-010 c2's trade: the address field and the one control beside it.
  "free-page.email.label": ["Your email", { slots: {} }],
  "free-page.email.placeholder": ["you@yourdomain.example", { slots: {} }],
  // True to the nurture sequence: at most NURTURE_MAX_TOUCHES follow-ups, each with a one-click opt-out.
  "free-page.consent": ["We’ll email this report and this page, then up to {touches} short notes. Unsubscribe in one click.", { slots: { touches: "text" } }],
  "free-page.submit": ["Email Me This Report", { slots: {} }],
  "free-page.absent": ["No free page this time. We found nothing worth writing.", { slots: {} }],

  "place.report.first-page.rival": [
    "No competitor yet",
    { law: "no-presence-yet", slots: {} },
  ],
  "landing.headline": ["Get Found Where Your Competitors Are and Customers Search", { slots: {} }],
  "landing.field.label": ["Your website", { slots: {} }],
  "landing.submit.label": ["Scan My Site", { slots: {} }],
  "landing.problem.empty": ["Type your website’s address, like example.com.", { slots: {} }],
  "landing.problem.not-a-hostname": ["That isn’t a website address. Try one like example.com.", { slots: {} }],
  "landing.problem.ip-literal": ["That’s a number, not a website name. Try one like example.com.", { slots: {} }],
  "landing.problem.no-public-suffix": ["That address has no ending. Try one like example.com.", { slots: {} }],
  "landing.problem.too-long": ["That’s too long for a website address. Check for extra text.", { slots: {} }],
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
  "landing.subline": ["We research your business and competitors, then write pages that get you found, on autopilot.", { slots: {} }],
  "landing.why.heading": ["Why Is This Important?", { slots: {} }],
  "landing.why.sub": ["If you’re not in the answer, that buyer never meets you.", { slots: {} }],
  "landing.start.eyebrow": ["How it works", { slots: {} }],
  "landing.start.heading": ["You Scan. We Write. You Watch", { slots: {} }],
  "landing.start.cta": ["Scan My Site for Free", { slots: {} }],

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
  "landing.field.placeholder": ["yourdomain.com", { slots: {} }],
  /** The line under the field. Approved (11a). */
  "landing.hero.assurance": ["free · no account · under a minute", { slots: {} }],
  "landing.hero.how": ["See how it works", { slots: {} }],
  /** The pace (owner, A1, 2026-10-19). The number is `WEEK_PLAN.days`. */
  "landing.pace": ["Up to {weekPages} pages a week, new or updated. Never filler.", { slots: { weekPages: "text" } }],
  "landing.how.full": ["How it works, in full", { slots: {} }],


  /** Section 03's three Step cards. The eyebrow and the three titles are
   *  approved (11a); the three bodies are bracketed in the set, and are the
   *  owner's approved sentences (2026-09-10, #459). */
  "landing.step.1.title": ["Scan Your Site", { slots: {} }],
  "landing.step.1.body": ["Type your website. See who Google and its AI answers pick over you, and what to fix first.", { slots: {} }],
  "landing.glance.rivals": ["Who buyers pick instead", { slots: {} }],
  "landing.glance.first": ["Your first page, proposed free:", { slots: {} }],
  "landing.mail.inbox": ["Inbox", { slots: {} }],
  "landing.step.2.title": ["We Choose and Write Your Pages", { slots: {} }],
  "landing.step.2.body": ["Every Monday we plan up to {weekPages} pages. Each is written from facts on your site, then checked.", { slots: { weekPages: "text" } }],
  // Step 3's title is the one approved-set string on this screen the owner
  // has since replaced: the set promised a page a day, and the Autopilot
  // brief (DECISIONS 2026-09-10) rules that out — a page goes live when one
  // is ready, at most one a day. Approved 2026-09-11 (#516).
  "landing.step.3.title": ["You See Progress", { slots: {} }],
  "landing.step.3.body": ["Each page goes live on its own day. Every Monday an email shows what went live and your totals so far.", { slots: {} }],

  /* ── The landing in its 2026-09-24 order (#1067) ─────────────────────
     Boards `R12-1-Landing`, `R12-8-Phone-landing`, `R12-10-Dark-landing`
     (SPEC §1, 2026-09-24). Where the board writes the sentence, it is the
     board's; `drafted` marks a line the board draws and this issue wrote. */
  /** Step 2's week: the preview's name. */
  "landing.inside.title": ["Inside ReachKit", { slots: {} }],
  /** *Why you should care*: two cards, each a title, a line and a small
   *  drawing whose words follow it. */
  "landing.feature.ai.title": ["Get Mentioned in AI Answers", { slots: {} }],
  "landing.feature.ai.body": ["Every Monday we ask Google’s AI and ChatGPT your buyers’ questions. You see if they name you, or a competitor.", { slots: {} }],
  /** The AI card's drawing: one answer, who it mentions, and the business it leaves out. */
  "landing.feature.ai.ask": ["What’s the best booking app for a small team?", { slots: {} }],
  "landing.feature.ai.mentions": ["An AI answer mentions", { slots: {} }],
  "landing.feature.ai.you": ["{you}: not mentioned", { slots: { you: "text" } }],
  "landing.feature.google.title": ["Get Found on Google", { slots: {} }],
  "landing.feature.google.body": [
    "We find searches where competitors show up and you don’t. Then we write pages for the ones you can win.",
    { slots: {} },
  ],
  /** The Google card's drawing: one search, a rival's page at its place, and the business nowhere near. */
  "landing.feature.google.search": ["“how to stop double bookings”", { slots: {} }],
  "landing.feature.google.chain": ["a booking app’s page", { slots: {} }],
  "landing.feature.google.you": ["You", { slots: {} }],
  "landing.feature.google.absent": ["not on Google’s first two pages", { slots: {} }],
  "landing.feature.fix.free": ["Free fix · 10 min", { slots: {} }],
  /** *What to do next*: the time each step takes. */
  "landing.step.1.tag": ["free · under a minute", { slots: {} }],
  "landing.step.2.tag": ["every Monday", { slots: {} }],
  "landing.step.3.tag": ["from week 1", { slots: {} }],
  /** The closing band: its heading, and the line under its button. */
  "landing.close.heading": ["See Who Gets Your Buyers Today", { slots: {} }],
  "landing.price.heading": ["What’s Included for {price}/month?", { slots: { price: "text" } }],
  "landing.price.month": ["a month", { slots: {} }],
  "landing.price.terms": ["{price} a month. One plan. Cancel any time.", { slots: { price: "text" } }],
  /** The questions owners ask, each a question and its answer. */
  "landing.faq.eyebrow": ["Questions", { slots: {} }],
  "landing.faq.heading": ["Questions Owners Ask", { slots: {} }],
  "landing.faq.spam.q": ["Is this AI spam?", { slots: {} }],
  "landing.faq.spam.a": ["No. Claude, an AI model, writes each page from your site and linked sources. A page that fails its checks twice never goes live.", { slots: {} }],
  "landing.faq.approve.q": ["Do I have to approve each page?", { slots: {} }],
  "landing.faq.approve.a": ["No. Each page goes live by itself {hours} hours after it is written. You can edit or stop it first, or do nothing.", { slots: { hours: "text" } }],
  "landing.faq.results.q": ["How long until I see results?", { slots: {} }],
  "landing.faq.results.a": ["Your pages go live in week 1. Each Monday email shows what went live and your totals so far.", { slots: {} }],
  "landing.faq.stop.q": ["What if I want to stop?", { slots: {} }],
  "landing.faq.stop.a": ["Cancel any time from Settings, and you’re not charged again. Section four of our Terms says when your access ends. Pages on the blog address we run for you stay live for {days} days after your access ends, and we email you a week before they stop. Your export of every page stays available, with no end date.", { slots: { days: "text" } }],
  "landing.faq.any.q": ["Will it work for my business?", { slots: {} }],
  "landing.faq.any.a": ["Yes, if it has a website: a local service, shop, restaurant, firm, software or creator. We help your website where buyers search and ask AI, not your Google Maps listing.", { slots: {} }],
  "landing.faq.start.q": ["What do I need to start?", { slots: {} }],
  "landing.faq.start.a": ["A website. After you pay, copy one line into your domain’s settings to connect it.", { slots: {} }],
  "landing.faq.german.q": ["Does it work in German?", { slots: {} }],
  "landing.faq.german.a": [
    "Yes. Sites in {germanCountries} are checked and written in German. Sites in {englishCountries}, and everywhere else, get English.",
    { slots: { germanCountries: "text", englishCountries: "text" } },
  ],
  "landing.faq.trial.q": ["Why is there no free trial?", { slots: {} }],
  "landing.faq.trial.a": ["The scan and your first page are free, so you see the work first. Then it’s one plan at {price} a month.", { slots: { price: "text" } }],
  /** The landing's short answers; How it works and Pricing keep the full ones above. */
  "landing.faq.approve.short": ["No. Each page goes live by itself {hours} hours after it is written. You can edit or stop it first.", { slots: { hours: "text" } }],
  "landing.faq.results.short": ["Pages go live in week 1. Google takes weeks to months; each Monday email shows your totals so far.", { slots: {} }],
  "landing.faq.stop.short": ["Cancel any time in Settings; you’re not charged again. Your export of every page stays available.", { slots: {} }],
  "landing.faq.german.short": ["Yes, sites in {germanCountries} are checked and written in German. Everywhere else gets English.", { slots: { germanCountries: "text" } }],
  "landing.faq.trial.short": ["The scan and your first page are free, so you see the work first.", { slots: {} }],
  "landing.faq.more": ["See all questions", { slots: {} }],
  "landing.close.assurance": ["free · no account · under a minute", { slots: {} }],

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
  "quiet.refused.head.network-limit": ["Too Many Scans From Your Network", { slots: {} }],
  "quiet.refused.head.network-day-limit": ["No Free Scans Left Today", { slots: {} }],
  "quiet.refused.head.domain-day-limit": ["No More Scans of This Site Today", { slots: {} }],
  "quiet.refused.head.scan-running": ["A Scan Is Already Running", { slots: {} }],
  "quiet.refused.head.stopped": ["Free Scanning Is Paused", { slots: {} }],
  "quiet.cooldown.head": ["We Couldn’t Finish Scanning This Site", { slots: {} }],
  "quiet.removed.head": ["This Report Was Removed", { slots: {} }],
  "control.scan-another": ["Scan a Different Site", { slots: {} }],
  "control.example-report": ["Read an Example Report", { slots: {} }],
  "control.back-to-start": ["Back to the Start", { slots: {} }],

  /* ── The free-scans gallery, `/scans`, and the landing's strip (#1069) ── */
  // SPEC §2 Gallery board. The words of board `PubScans`; the
  // rest drafted in the registry's voice for the owner to correct.
  "gallery.eyebrow": ["Scan Library", { slots: {} }],
  "gallery.heading": ["Every Free Scan, in the Open", { slots: {} }],
  "gallery.subline": [
    "{count} free reports, each at a lasting public link. See how businesses like yours show up on Google and AI.",
    { slots: { count: "text" } },
  ],
  "gallery.next.assurance": ["free · no account · under a minute · listed here when it’s done", { slots: {} }],
  "gallery.list.heading": ["Free reports", { slots: {} }],
  "gallery.search.label": ["Search by company or domain", { slots: {} }],
  "gallery.filter.label": ["Kind of business", { slots: {} }],
  "gallery.filter.all": ["All", { slots: {} }],
  // One word per kind of business (`src/lib/market/kinds.ts`).
  "gallery.kind.local-service": ["Local services", { slots: {} }],
  "gallery.kind.shop": ["Shops", { slots: {} }],
  "gallery.kind.hospitality": ["Restaurants & venues", { slots: {} }],
  "gallery.kind.professional-services": ["Agencies & firms", { slots: {} }],
  "gallery.kind.software": ["Software", { slots: {} }],
  "gallery.kind.creator": ["Creators & courses", { slots: {} }],
  "gallery.showing": ["Showing {shown} of {total} reports", { slots: { shown: "text", total: "text" } }],
  "gallery.sort.label": ["Sort", { slots: {} }],
  "gallery.sort.newest": ["Newest first", { slots: {} }],
  "gallery.sort.highest": ["Highest score", { slots: {} }],
  "gallery.sort.lowest": ["Lowest score", { slots: {} }],
  "gallery.sort.az": ["A–Z", { slots: {} }],
  "gallery.card.view": ["View report", { slots: {} }],
  "gallery.card.score": ["{score} of {max}", { slots: { score: "text", max: "text" } }],
  "gallery.card.no-score": ["Not scored", { slots: {} }],
  "gallery.more": ["Show more reports", { slots: {} }],
  "gallery.empty.heading": ["No free scan matches that yet.", { slots: {} }],
  "gallery.empty.body": ["Scan it now. It takes under a minute, then it shows here.", { slots: {} }],
  "gallery.empty.cta": ["Scan this site", { slots: {} }],

  // SPEC §6, owner D66 (issue 1311): the one line a report owes its reader
  // where the site named a country or a language that is not measured yet.
  // Drafted (#759).
  "report.locale.fell-back": [
    "Searched on Google in {country}, in {language}. We don’t scan {unmeasured} yet.",
    { slots: { country: "text", language: "text", unmeasured: "text" } },
  ],
  // A country or language on the list is never called unmeasured: the line
  // names the pair the site read as and what ReachKit measures instead.
  // Drafted (#759).
  "report.locale.pair-fell-back": [
    "Searched on Google in {country}, in {language}. Your site is in {readLanguage}, and we scan {readCountry} in {ownLanguage}.",
    { slots: { country: "text", language: "text", readLanguage: "text", readCountry: "text", ownLanguage: "text" } },
  ],
  "report.locale.country-read-as": [
    "Searched in {country}, in {language}, because your site is in {readLanguage}. Scan again to see {readCountry} in {ownLanguage}.",
    { slots: { country: "text", language: "text", readLanguage: "text", readCountry: "text", ownLanguage: "text" } },
  ],
  // A site that declares other markets: one is measured, chosen at setup.
  // Drafted (#759).
  "report.locale.also-serves": [
    "Your site serves {n} more markets. You can choose another at setup.",
    { slots: { n: "text" } },
  ],
  "report.locale.also-serves.one": [
    "Your site serves one more market. You can choose it at setup.",
    { slots: {} },
  ],
  "app.locale.also-serves": [
    "Your site also serves {n} other markets; we measure one. Change it in Settings.",
    { slots: { n: "text" } },
  ],
  "app.locale.also-serves.one": [
    "Your site also serves one other market; we measure one. Change it in Settings.",
    { slots: {} },
  ],
  // The measurement line of a report whose site could not be read, measured
  // in D66's default, and what its Google listing reads as. Drafted (#759).
  "report.locale.guessed": [
    "We couldn’t read your site, so we searched Google in {country}, in {language}.",
    { slots: { country: "text", language: "text" } },
  ],
  "report.locale.listing-reads": ["Your Google listing says {country}.", { slots: { country: "text" } }],
  "report.locale.site.pair": ["{country} in {language}", { slots: { country: "text", language: "text" } }],
  // The measurement line of a report measured anywhere but in US Google in
  // English (D66). Drafted (#759).
  "report.measurement.in": ["Searched on Google in {country}, in {language}.", { slots: { country: "text", language: "text" } }],
  // The measurement line of a report measured in the town its site serves
  // (D67, owner ruling 2026-10-15). The search vendor gives volumes by
  // country only, so the line says so (issue 1480). Drafted (#759).
  "report.measurement.place": [
    "Searched on Google near {place}, in {language}. Search counts are for all of {country}.",
    { slots: { place: "text", language: "text", country: "text" } },
  ],

  // SPEC §2, owner A3 and E1 (2026-10-19): the report lists every page it
  // found missing; the count is said once, in the headline (owner R12).
  "report.offer.free-path.lead": ["Not ready?", { slots: {} }],
  "report.offer.free-path": ["Get Your First Page Free ↓", { slots: {} }],
  "report.missing.volume": ["searched {volume} times a month", { slots: { volume: "text" } }],
  "report.missing.holder": ["answered today by {holder}", { slots: { holder: "text" } }],
  "report.missing.rest": ["Topics 6 to {last}: the search each one answers", { slots: { last: "text" } }],
  "report.missing.all": ["All {count}, nothing hidden.", { slots: { count: "text" } }],
  "report.missing.page": ["page {n}", { slots: { n: "text" } }],
  "report.missing.free": ["free · written for you", { slots: {} }],
  "report.missing.free.read": ["Read It Free ↓", { slots: {} }],
  "report.rest.eyebrow": ["More in your report", { slots: {} }],
  "report.missing.title": ["Pages You’re Missing", { slots: {} }],
  "report.missing.lead": [
    "Each one answers a question your buyers ask.",
    { slots: {} },
  ],
  // Board PubReport, the report's head (canvas V22): what we read the site
  // as, the headline of who gets the buyers, and the score's parts. Drafted in the board's words; the owner corrects them.
  "report.read.as.title": ["We read you as", { slots: {} }],
  "report.read.as.what": ["{kind} · {category}", { slots: { category: "text", kind: "text" } }],
  "report.read.as.locale": ["{language}, {country}", { slots: { language: "text", country: "text" } }],
  "report.read.as.kind.local-service": ["Local service", { slots: {} }],
  "report.read.as.kind.shop": ["Shop", { slots: {} }],
  "report.read.as.kind.hospitality": ["Restaurant or venue", { slots: {} }],
  "report.read.as.kind.professional-services": ["Agency or firm", { slots: {} }],
  "report.read.as.kind.software": ["Software", { slots: {} }],
  "report.read.as.kind.creator": ["Creator or course", { slots: {} }],
  "verdict.estimate.range": ["likely {low} to {high}", { slots: { low: "text", high: "text" } }],
  "verdict.score.split": ["How This Score Is Split", { slots: {} }],
  "verdict.score.parts": ["Four parts, combined into one score. They are not added up.", { slots: {} }],
  "verdict.score.parts.three": ["Three parts, combined into one score. They are not added up.", { slots: {} }],
  // The top names Google's AI, the one AI the free scan asks, and never sums a count over both cards.
  "report.top.title": ["{domain}: {score}/100, {verdict}", { slots: { domain: "text", score: "text", verdict: "text" } }],
  "report.top.line": ["Buyers who ask Google’s AI or Google about {category} are sent to {competitor} most.", { slots: { category: "text", competitor: "text" } }],
  "report.top.line.you-lead": ["Buyers who ask Google’s AI or Google about {category} find you most.", { slots: { category: "text" } }],
  "report.top.line.none": ["Buyers who ask Google’s AI or Google about {category} can’t find you yet.", { slots: { category: "text" } }],
  "report.top.ai": ["Google’s AI answers mentioned you in {a} of {A}.", { slots: { a: "text", A: "text" } }],
  "report.top.google": ["You are on Google’s first page for {g} of {G} searches.", { slots: { g: "text", G: "text" } }],
  "report.top.offer": ["We found {count} questions your buyers ask that no page of yours answers.", { slots: { count: "text" } }],
  "report.top.offer.one": ["We found 1 question your buyers ask that no page of yours answers.", { slots: {} }],
  "report.independent": ["An independent report by ReachKit. {company} has not endorsed it.", { slots: { company: "text" } }],
  "report.buyers.title": ["Who Gets Your Buyers", { slots: {} }],
  "report.you": ["You", { slots: {} }],
  "report.ai.waffle": ["AI mentioned {leader} in {x} of {total} answers, and you in {you}.", { slots: { leader: "text", x: "text", total: "text", you: "text" } }],
  "report.ai.waffle.you-lead": ["AI mentioned you most, in {you} of {total} answers.", { slots: { you: "text", total: "text" } }],
  "report.ai.quote": ["One answer, for {search}", { slots: { search: "text" } }],
  "report.ai.quote.said": ["“{quote}”", { slots: { quote: "text" } }],
  "report.ai.asked": ["The {total} Searches We Asked", { slots: { total: "text" } }],
  "report.google.waffle": ["{leader} is on Google’s first page for {x} of {total} searches. You are on {you}.", { slots: { leader: "text", x: "text", total: "text", you: "text" } }],
  "report.google.waffle.you-lead": ["You are on Google’s first page most often, for {you} of {total} searches.", { slots: { you: "text", total: "text" } }],
  "report.google.most": ["Most searched: {search}, about {volume} times a month. First on Google: {holder}.", { slots: { search: "text", volume: "text", holder: "text" } }],
  "report.google.most.none": ["Most searched: {search}, about {volume} times a month.", { slots: { search: "text", volume: "text" } }],
}) satisfies CopyPartition;
