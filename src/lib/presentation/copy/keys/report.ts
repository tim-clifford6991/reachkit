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
// 2026-09-04: the owner ruled on the five `DomainProblem` lines (WO-070
// `## Log`, this date's ruling) — filled verbatim, byte for byte. All
// eight landing keys are now supplied; none is owner-owed.
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
// its partition.
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
  "verdict.limiting.foundations": "Biggest gap: Website basics",
  "verdict.limiting.foundations.line": "AI and Google can’t fully read your site.",
  "verdict.limiting.answerability": "Biggest gap: Answers questions",
  "verdict.limiting.answerability.line": "Your pages don’t answer buyers’ questions directly.",
  "verdict.limiting.google": "Biggest gap: Google",
  "verdict.limiting.google.line": "You’re rarely on Google’s first page.",
  "verdict.limiting.ai": "Biggest gap: AI",
  "verdict.limiting.ai.line": "AI answers rarely mention you.",
  "verdict.limiting.presence": "Biggest gap: AI and Google",
  "verdict.limiting.presence.line": "Buyers rarely find you on Google or in AI answers.",
  "removal.address": "remove@reachkit.app",
  "removal.line.removed": "The site’s owner asked us to remove this report. To scan {domain} again, write to {address}.",
  "notice.incomplete": "We couldn’t scan {what}, so this report is incomplete.",
  "notice.measurement-failed": "The last scan didn’t finish, so nothing changed.",
  "notice.correction-failed": "The correction didn’t finish. This is the report from before.",
  // #479. The pass could not read the site's own home page — the fetcher
  // refused it (too large, no answer, blocked) — so nothing after it was
  // attempted and the report stops there. Owner-owed until 2026-09-11, when
  // the owner approved this sentence (#516).
  "notice.site-unreadable": "We couldn’t read this site’s home page. Check the address and scan again.",
  // Issue 1379. The site's bot protection answered our reader with a page of
  // its own, so the site's own pages are unmeasured: never a zero, never
  // that page's facts. Drafted in this registry’s voice and shipped under
  // the owner ruling of 2026-09-16 (#759); the owner corrects the wording.
  "notice.bot-protected": "This site’s bot protection blocked us, so we couldn’t score its pages.",
  // SPEC §2 (owner, 2026-10-10, issue 1387): where the market was read from
  // the site's listing in search. Drafted (#759).
  // SPEC §2 (owner, 2026-10-15, issue 1440): the searches a free scan left
  // unread are being read in the background. Short on purpose (the issue's
  // own words). Drafted (#759).
  "report.finishing-reads": "Still scanning {count} searches…",
  "report.finishing-reads.one": "Still scanning {count} search…",
  // SPEC §2 (issue 1481): the deployed code would read this stored scan
  // differently and the re-score has not rewritten it yet. Drafted (#759).
  "report.reads-differently": "Scanned {date}. We’ve changed how we scan since. Scan again for a fresh report.",
  // SPEC §2 (issue 1450): the site's pages were read and the model gave no
  // profile of them, so the market was read from its listing. Short on
  // purpose (master review on #1451). Drafted (#759).
  // Issue 1454: the scanning page's section title, and where the business sells. Drafted (#759).
  "report.read.title": "What We Read",
  "report.read.where.local": "In and around {place}",
  "report.read.where.national": "Across {country}",
  "report.read.where.international": "Online, in more than one country",
  "report.market.from-listing": "We read your market from your Google listing.",
  "report.market.from-search": "We couldn’t read your pages, so we found your market on Google.",
  // Issue 898. The site read and its market did not — the profile call or
  // the suggestions did not answer — so there is no question, no answer
  // card and no band. Distinct from `notice.incomplete`, which names
  // drivers that were not measured while others were; here nothing was
  // measured from the market at all, and naming a driver would name the
  // consequence rather than the cause. Drafted in this registry’s voice
  // and shipped under the owner ruling of 2026-09-16 (#759); the owner
  // corrects the wording.
  "notice.market-unread": "We couldn’t work out this site’s market. Scan again in a minute.",
  "notice.refused.network-limit": "Your network has used this hour’s free scans. Scan again in {wait}.",
  // Issue 885's two free-path bounds. Drafted in this registry’s voice and
  // shipped under the owner ruling of 2026-09-16 (#759); the owner corrects
  // the wording. Neither borrows `network-limit`’s sentence: that one names
  // the hour and the five, and the day bound is neither — and the domain
  // bound is not about the visitor’s network at all, so a sentence that
  // said "from your network" would be telling a stranger they had done
  // something they had not.
  "notice.refused.network-day-limit": "Your network has used today’s free scans. Scan again in {wait}.",
  "notice.refused.domain-day-limit": "This site has had today’s free scans. Scan again in {wait}.",
  "notice.refused.scan-running": "A scan from your network is still running. Try again in about {wait}.",
  // #104. ReachKit's own stop, in writing — the one refusal the visitor
  // did not cause and the only one that names no wait, because nobody can
  // say when we start again (ADR-011).
  "notice.refused.stopped": "Free scans are paused for now. Every report stays open to read.",
  "control.rescan-age": "Scan Again",
  "control.rescan-incomplete": "Scan What’s Missing",
  "control.retry": "Scan Again",
  // Issue 715: the control on a part the pass's ceiling cut off — SPEC §2
  // quotes the words.
  "control.retry-part": "Scan This Part Again",
  "copy-link.label": "Copy Link",

  // ── Module 1, the verdict strip (BUILD §4.1) ──────────────────────────
  // The domain and the date ride beside the score so it is never a bare
  // specimen number (REQ-004 c1).
  // The four bars, named as subjects (issue 1444): Readiness, Content, and
  // Presence shown as its two halves, Google and AI. `LIMITING_LINES` holds
  // the *sentence* about a bar; these hold the bar's own name, for the
  // `{what}` slot of `unmeasured.undeterminable` / `.not-attempted`
  // (REQ-004 c3). `.presence` names both halves at once, where a stored
  // report kept Presence and not its halves.
  "verdict.factor.foundations": "Website basics",
  "verdict.factor.answerability": "Answers questions",
  "verdict.factor.google": "Google",
  "verdict.factor.ai": "AI",
  "verdict.factor.presence": "AI and Google",
  // The `{wait}` the two refusal lines take: the figure is the refusal's
  // own `retryAfterSeconds` in whole minutes, the unit word is the
  // owner's, so no duration is composed in a component.
  "report.wait.minutes": "{minutes} min",
  // S2's provenance line under the domain: "measured 28 Aug · [category] ·
  // Not your market?" — approved as written (11a), less the two parts that
  // are not this key's: the category is a measured value and the
  // correction is a control. Two arms, because a scan that never
  // determined a category names none and guesses none (REQ-094 c1).
  "report.measured-at": "Scanned {date} · {what}.",
  "report.measured-at.no-category": "Scanned {date}.",
  // Issue 715: SPEC §2 — "Measurement is US Google in English, stated in one
  // always-visible line." Owner-owed.
  "report.measurement": "Searched on Google in the US, in English.",
  // 6a: "Discoverability Score" is the number's name on every surface that
  // labels it — this eyebrow, the Overview tile, and the two mails.
  "verdict.score.label": "Visibility Score",
  // Issue 1068, board R12-2: the summary card's eyebrow and what the ring's
  // figure is out of. Drafted; the owner corrects the wording.
  "report.eyebrow": "Your free report",
  "verdict.score.of": "of 100",
  // Issue 1932: beside the range, where a re-score moved the score because
  // the Google half moved. `{before}` is the score as first stored. Drafted;
  // the owner corrects the wording.
  "verdict.rescored": "Updated {date}, when we changed how the Google part counts. It was {before}.",
  // REQ-094 c1's correction control, as S2 draws it. #786 gives it its
  // destination: an inline field that posts the corrected market to
  // `POST /api/report/{domain}/correct` and follows the rerun's stages.
  "verdict.not-your-market": "Not Your Market? Correct It",
  // #786: the field, its line and its outcomes. Drafted in the registry's
  // voice under the 2026-09-16 ruling (#759) — named in the PR for the
  // owner to correct.
  "correction.field.label": "Your market, in a few words",
  "correction.submit": "Scan Again for This Market",
  "correction.cancel": "Cancel",
  "correction.line": "You can correct this once. We reuse the AI answers we have.",
  "correction.running": "Scanning again for your market. This page updates when it’s done.",
  "correction.refused.running": "A correction is already running for this report.",
  "correction.refused.used": "You’ve already used this report’s one correction.",
  "correction.refused.too-old": "This report is too old to correct. Scan it again instead.",
  "correction.refused.unavailable": "That didn’t start, and your correction is still unused. Try again in a few minutes.",

  // ── The scanning arm's six named stages (REQ-003 c1) ──────────────────
  // One key per `StageName` (`src/lib/scan/stages.ts`) — a stage with no
  // word cannot render, which is what makes "named stages, never an
  // unlabelled spinner" structural. WO-282 left these to BP-023's own
  // file plan; nothing created them, and the scanning arm cannot render
  // without them, so they are minted here with the rest of this surface.
  "stage.reading_your_site": "Reading your site",
  "stage.reading_access_rules": "Checking what Google and AI may read",
  "stage.reading_your_market": "Finding your market and competitors",
  "stage.checking_your_presence": "Checking {searches} searches buyers make",
  "stage.asking_the_twelve": "Asking Google’s AI the same searches",
  "stage.scoring": "Working out your score",
  "stage.reading_your_site.line": "What you sell, who buys it and where.",
  "stage.reading_access_rules.line": "Whether your site lets them in.",
  "stage.reading_your_market.line": "Who shows up when your buyers search.",
  "stage.checking_your_presence.line": "Who is on Google’s first page for each.",
  "stage.asking_the_twelve.line": "Which businesses the answers mention.",
  "stage.scoring.line": "One number for how easy you are to find.",
  "stage.status.done": "Done",
  "stage.status.working": "Working on it",
  "stage.status.next": "Next",
  "stage.started": "started {time}",
  // The elapsed time the approved set draws beside a finished stage, and
  // the one line the scanning screen ends on (S3, approved under 11a).
  "stage.elapsed": "{seconds} s",
  "scan.eyebrow": "Your free scan",
  "scan.head": "Scanning {domain}",
  "scan.progress.title": "Progress",
  "scan.get.score": "Your Visibility Score",
  "scan.filling.title": "Your Report So Far",
  "scan.filling.grey": "Still loading…",
  "scan.filling.readers": "Who Can Read Your Site",
  "scan.filling.competitors": "Your Competitors",
  "scan.filling.searches": "{searches} Searches Buyers Make",
  "scan.filling.ai": "What AI Answers Say",
  "scan.filling.pages": "{pages} pages read",
  "scan.filling.buyer": "Who buys: {buyer}",
  "scan.filling.reader.google": "Google",
  "scan.filling.reader.ai": "AI",
  "scan.filling.reader.in": "let in",
  "scan.filling.reader.out": "shut out",
  "scan.filling.reader.fix": "Your report will show the free fix.",
  "scan.filling.search.in": "first page",
  "scan.filling.search.out": "not on first page",
  "scan.filling.found": "found",
  "scan.waiting.line": "This takes under a minute. Your report stays at this link.",
  /** The line above the stages when a re-measure was started *from* a
   *  report that is already on screen (#935). It is not
   *  `scan.waiting.line` — that one tells a first-time visitor the address
   *  survives the wait, which this reader already knows — and it is not
   *  `correction.running`, which names the market they gave. Drafted under
   *  the owner's 2026-09-16 ruling (#759), in this registry's voice. */
  "scan.rescanning.line": "Scanning again. This page updates when it’s done.",

  // ── Module 2, left card — AI answers (REQ-006) ────────────────────────
  "ai-answers.title": "AI",
  "ai-answers.source": "We asked Google’s AI {total} buyer searches. It answered {answered}.",
  // Issue 715: SPEC §2 — a category correction reuses the AI answers already
  // read, "and says so". Owner-owed.
  "ai-answers.coverage.cached-only": "These AI answers come from an earlier scan.",
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
  "ai-answers.reused-from": "Reused from {date}",
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
  "retry-part.running": "Scanning this part again. This page updates when it’s done.",
  "retry-part.refused.no-budget": "This part can’t be scanned again. Scan the whole site again instead.",
  "retry-part.refused.already-measured": "This part is done. Reload the page to see it.",
  "retry-part.refused.unavailable": "That didn’t start. Try again in a few minutes.",
  // The one line under the card's figure: the answers that mention the customer, of those that appeared.
  "ai-answers.finding": "AI answers that mention you",
  // Issue 1439: AI answered none of the searches read, so AI presence is not
  // judged and the score counts search alone. Short, as titles are (#1444).
  "ai-answers.finding.unanswered": "AI doesn't answer these searches yet.",
  // REQ-006 c6's one written line: what was measured, and no second
  // engine named anywhere on the card. S2 draws it as the source chip at
  // the foot of the card.
  "ai-answers.questions.title": "The {total} searches",
  // Issue 873: what this report measured, in one line, so a founder does
  // not count rows to find out.
  "ai-answers.questions.measured": "We scanned {measured} of these {total} searches.",
  // Issue 1309: a pass that found more questions than its purse or its 50 s
  // could measure lists them all, so the list's count is not the report's
  // measured count. These two say which is which; the pair above stays for
  // a report that measured every question it lists.
  "ai-answers.questions.title.partial": "Searches Scanned: {measured} of {total}",
  "ai-answers.questions.measured.partial": "We scanned {measured} of the {total} we found. Rows marked not measured don’t count.",
  "ai-answers.question.not-you": "not you",
  "ai-answers.question.no-answer": "no answer",
  // REQ-006 c9's provenance pair: the search a question was derived from
  // and the brands the answer named. No `{vol}/mo` slot — the owner
  // removed per-question volume on 2026-09-03.
  // S2 draws "from: [search] · 1,900/mo · named: [brands]". The volume is
  // **not** rendered: REQ-006 c9 forbids a monthly volume "beside it or
  // anywhere else on the questions module", the owner removed it on
  // 2026-09-03, and `StoredQuestion` has no member to render it from. The
  // scaffolding either side of it is the set's, as written.
  "ai-answers.question.provenance": "from: {search} · mentioned: {brands}",
  // §6.2's three answer columns (issue #128). The data is measured and
  // stored; the *visual* — three columns on an approved card — is the
  // design gate #128 names and lands in its follow-up, so these four are
  // the words that gate needs before it can render.
  "ai-answers.engine.ai-overview": "Google AI Overview",
  "ai-answers.engine.ai-mode": "Google AI Mode",
  "ai-answers.engine.chatgpt": "ChatGPT",
  // The header over the column that carries each question's number. The
  // engine columns are a table of the twelve, and the row-label column is
  // a column like the other three — a header it does not have would be an
  // invented blank, not an absent sentence (issue #157).
  "ai-answers.engine.column.question": "Search",
  // What a cell says where that engine's answer named the customer. The
  // approved one-column card says this by rendering *nothing* beside the
  // question — the absence of the `not-you` badge is the good news. In a
  // three-column grid a blank cell is ambiguous (a hit, or an engine
  // nobody asked?), so the positive state states itself (issue #157).
  "ai-answers.engine.cell.cited": "mentioned you",
  // What a column says where the engine was never asked — the free
  // report's two battery columns, and any question a ceiling stopped the
  // pass reaching. It states a fact about the measurement, never a miss.
  "ai-answers.engine.not-measured": "not measured",
  "report.ai.unmeasured": "We couldn’t measure AI answers for this market yet.",
  "ai-answers.absent": "We couldn’t scan AI answers this time. The rest of the report still holds.",

  // ── Module 2, right card — Google presence (REQ-008) ──────────────────
  "presence.title": "Google",
  // The count is the card's own denominator, never a literal.
  "presence.source": "Out of {measured} searches buyers in your market make.",
  // Issue 1444: the card's figure is `{count} of {total}` — the searches
  // the customer is on the first page for, of those measured — and this is
  // the one line under it. The competitors' counts are the bars.
  "presence.finding": "Searches where you’re on Google’s first page",
  // A figure: one count out of another, as each card's head states it.
  "report.figure.of": "{count} of {total}",
  "presence.no-rivals": "No competitor showed up in these searches.",
  "presence.absent-from.title": "Searches Where You Don’t Show Up",
  "presence.absent-from.column.search": "Search",
  "presence.absent-from.column.volume": "Searches a month",
  "presence.absent-from.column.holder": "Who’s first",
  "presence.absent-from.empty": "You show up in every search we scanned.",
  "report.presence.unmeasured": "We couldn’t measure Google searches for this market yet.",
  "presence.absent": "We couldn’t scan Google this time. The rest of the report still holds.",

  // ── Module 3, the three problem cards (REQ-009) ───────────────────────
  // One title and one doer per problem; the severity words are BANDS_COPY's `severity.*`.
  "problem.blocked-readers.title": "AI Shut Out of Your Site",
  "problem.blocked-readers.doer": "Free fix · 10 min",
  "problem.missing-pages.title": "Missing Pages",
  "problem.missing-pages.doer": "ReachKit writes",
  "problem.unquotable-pages.title": "Pages AI Can’t Quote",
  "problem.unquotable-pages.doer": "ReachKit rewrites on WordPress",
  // The one control any fix carries (REQ-009 c2), on the paste arm only.
  "problem.paste.label": "Copy the Lines",
  // The fixes' heads, each card's one-line cause, and the *show me* link it opens. Drafted; the owner corrects them.
  "problem.section.title": "Site Fixes",
  "problem.section.sub": "The {problems} that cost you most, then {checks} quick checks",
  "problem.section.sub.problems": "The {problems} that cost you most",
  "problem.section.sub.checks": "{checks} quick checks",
  // With nothing to list: the problems measured and the checks that ran, all passed. Owner-owed wording (#1034).
  "problem.section.none": "All {n} checks passed.",
  "problem.top.title": "Fix These First",
  "problem.blocked-readers.cause": "Your site blocks AI, or asks Google and AI to skip pages.",
  "problem.missing-pages.cause": "Questions your buyers ask that no page on your site answers.",
  "problem.unquotable-pages.cause": "These pages have no clear answer AI can quote.",
  "problem.show.lines": "Show Me the Lines",
  "problem.show.first-page": "See the First One",
  "problem.show.method": "Show Me How",

  // ── Module 3, the technical checks (SPEC §9, issue 571) ──────────────
  // The doer words are SPEC §9’s own; the eight card titles and the not-run line are owner-owed.
  "check.doer.free-fix": "Free fix · 10 min",
  "check.doer.reachkit-writes": "ReachKit writes",
  "check.doer.reachkit-rewrites": "ReachKit rewrites on WordPress",
  "check.not-run": "We couldn’t run this check. It may still need a fix.",
  // Issue 1068: the eight checks are one list, and a grey dot is the not-run
  // line said once under it.
  "check.legend": "A grey dot means we couldn’t run that check.",
  "check.page-titles.title": "Missing or duplicate titles",
  "check.meta-descriptions.title": "Missing or duplicate descriptions",
  "check.noindex-pages.title": "Pages hidden from search",
  "check.sitemap.title": "No page list for Google",
  "check.slow-pages.title": "Slow pages",
  "check.broken-links.title": "Broken internal links",
  "check.phone-usability.title": "Hard to use on a phone",
  // The report's plain name; the account's Technical issues view keeps "Broken internal links" (board AppIssues).
  "check.broken-links.plain": "Links between pages that go nowhere",
  "check.status.not-run": "Couldn’t run",
  "check.structured-data.title": "Pages with no labels for Google",
  // The report's plain name (board PubReport); the account surfaces read the problem in `.title`.
  "check.structured-data.plain": "Page labels Google can read",
  // Who the labels say runs the site, under the structured-data row; no line where it was not measured.
  "check.identity.found": "The labels say who runs the site: {type}.",
  "check.identity.none": "No label says who runs the site.",
  // Issue 1550 (drafted): the one thing to do about each check the customer
  // fixes, on the account's Technical issues view.
  "check.noindex-pages.fix": "Turn off noindex on these pages in your site builder or plugin. Then Google can list them.",
  "check.sitemap.fix": "Turn on your sitemap in your site builder or plugin. Add its address to robots.txt.",
  "check.slow-pages.fix": "Turn on page caching with your host. Shrink the biggest images on these pages.",
  "check.broken-links.fix": "These links lead to error pages. Fix or remove them.",
  "check.phone-usability.fix": "Add a viewport tag to these pages’ template. Then they fit a phone screen.",
  "check.ai-readers.fix": "Let AI in through your robots.txt. Remove any nosnippet setting from your pages.",

  // ── Module 4, the DIY sections (REQ-009 c6) ───────────────────────────
  // Instructional text is allowed here and nowhere else on this screen.
  // S2's eyebrow over the three collapses. The collapses' instructional
  // prose is the owner's (approved 2026-09-10, #459).
  "method.title": "Do It Yourself, Free",
  "method.blocked-readers.title": "Let AI In",
  "method.blocked-readers.body": "Open your site’s robots.txt file. Your host usually has a setting for it.",
  "method.blocked-readers.step.1": "Add the lines shown, so AI tools are let in.",
  "method.blocked-readers.step.2": "Remove nosnippet or max-snippet:0 from any page that has it.",
  "method.blocked-readers.step.3": "If your home page says noindex, remove that too.",
  "method.blocked-readers.snippet-pages": "AI answers can’t quote these pages:",
  "method.blocked-readers.training-choice": "Your robots.txt keeps {crawlers} out. That only stops AI training, so we don’t count it.",
  "method.missing-pages.title": "Write the Missing Pages",
  "method.missing-pages.body": "You don’t need ReachKit for any of this.",
  "method.missing-pages.step.1": "Answer the buyer’s question in the first lines.",
  "method.missing-pages.step.2": "Back it with facts from your own site, each one linked.",
  "method.missing-pages.step.3": "Put it on your own website, at a plain address.",
  "method.missing-pages.step.4": "Link to it from a page that already does well.",
  "method.missing-pages.step.5": "A few pages a week is a good pace. One a week still helps.",
  "method.unquotable-pages.title": "Make Pages AI Can Quote",
  "method.unquotable-pages.body": "AI quotes pages that answer a question directly.",
  "method.unquotable-pages.step.1": "Turn each heading into a question a buyer asks.",
  "method.unquotable-pages.step.2": "Put a direct answer of 2 or 3 sentences under it.",
  "method.unquotable-pages.step.3": "Add proof: a figure, a date, a source you link to.",
  "method.unquotable-pages.step.4": "Keep the page’s address, so it keeps what it has earned.",

  // ── Module 5, the free page card (REQ-010, BUILD §4.2's trade) ────────
  "free-page.title": "Your First Page, Free",
  "free-page.badge": "free",
  // The facts list, in the board's order and words (owner R26).
  "free-page.row.target": "answers",
  "free-page.row.searched": "searched",
  // The page's own target volume, not the per-question volume removed on 2026-09-03.
  "free-page.searched.value": "{volume} times a month",
  "free-page.row.beats": "answered today by",
  "free-page.row.format": "type of page",
  // Shown only once the page is written: its stored first lines, a source they cite, and what they are.
  "free-page.source": "from {source}",
  "free-page.caption": "The first lines, written by AI from your site. We email you the full page.",
  // The format row's value, one per Write type the report can offer (issue 787,
  // drafted — the owner corrects the wording).
  "free-page.format.answer_page": "An answer page",
  "free-page.format.comparison_page": "A comparison page",
  "free-page.format.format_page": "A comparison, alternative, integration or template page",
  "free-page.format.keyword_page": "A page for this search",
  // REQ-010 c2's trade: the address field and the one control beside it.
  "free-page.email.label": "Your email",
  "free-page.email.placeholder": "you@yourdomain.example",
  // True to the nurture sequence: at most NURTURE_MAX_TOUCHES follow-ups, each with a one-click opt-out.
  "free-page.consent": "We’ll email this report and this page, then up to {touches} short notes. Unsubscribe in one click.",
  "free-page.submit": "Email Me This Report",
  "free-page.absent": "No free page this time. We found nothing worth writing.",

  "place.report.first-page.rival": "No competitor yet",
  "presence.holder.source": "not a competitor",
  "landing.headline": "Get Found Where Your Competitors Are and Customers Search",
  "landing.field.label": "Your website",
  "landing.submit.label": "Scan My Site",
  "landing.problem.empty": "Type your website’s address, like example.com.",
  "landing.problem.not-a-hostname": "That isn’t a website address. Try one like example.com.",
  "landing.problem.ip-literal": "That’s a number, not a website name. Try one like example.com.",
  "landing.problem.no-public-suffix": "That address has no ending. Try one like example.com.",
  "landing.problem.too-long": "That’s too long for a website address. Check for extra text.",
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
  "landing.subline": "We research your business and competitors, then write pages that get you found, on autopilot.",
  "landing.why.heading": "Why Is This Important?",
  "landing.why.sub": "If you’re not in the answer, that buyer never meets you.",
  "landing.start.eyebrow": "How it works",
  "landing.start.heading": "You Scan. We Write. You Watch",
  "landing.start.cta": "Scan My Site for Free",

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
  "landing.field.placeholder": "yourdomain.com",
  /** The line under the field. Approved (11a). */
  "landing.hero.assurance": "free · no account · under a minute",
  "landing.hero.how": "See how it works",
  /** The pace (owner, A1, 2026-10-19). The number is `WEEK_PLAN.days`. */
  "landing.pace": "Up to {weekPages} pages a week, new or updated. Never filler.",
  "landing.how.full": "How it works, in full",


  /** Section 03's three Step cards. The eyebrow and the three titles are
   *  approved (11a); the three bodies are bracketed in the set, and are the
   *  owner's approved sentences (2026-09-10, #459). */
  "landing.step.1.title": "Scan Your Site",
  "landing.step.1.body": "Type your website. See who Google and its AI answers pick over you, and what to fix first.",
  "landing.glance.rivals": "Who buyers pick instead",
  "landing.glance.first": "Your first page, proposed free:",
  "landing.step.2.title": "We Choose and Write Your Pages",
  "landing.step.2.body": "Every Monday we plan up to {weekPages} pages. Each is written from facts on your site, then checked.",
  // Step 3's title is the one approved-set string on this screen the owner
  // has since replaced: the set promised a page a day, and the Autopilot
  // brief (DECISIONS 2026-09-10) rules that out — a page goes live when one
  // is ready, at most one a day. Approved 2026-09-11 (#516).
  "landing.step.3.title": "You See Progress",
  "landing.step.3.body": "Each page goes live on its own day. Every Monday an email shows what went live and how your pages are doing.",

  /* ── The landing in its 2026-09-24 order (#1067) ─────────────────────
     Boards `R12-1-Landing`, `R12-8-Phone-landing`, `R12-10-Dark-landing`
     (SPEC §1, 2026-09-24). Where the board writes the sentence, it is the
     board's; `drafted` marks a line the board draws and this issue wrote. */
  /** Step 2's week: the preview's name. */
  "landing.inside.title": "Inside ReachKit",
  /** *Why you should care*: two cards, each a title, a line and a small
   *  drawing whose words follow it. */
  "landing.feature.ai.title": "Get Mentioned in AI Answers",
  "landing.feature.ai.body": "Every Monday we ask Google’s AI and ChatGPT your buyers’ questions. You see if they name you, or a competitor.",
  /** The AI card's drawing: one answer, who it mentions, and the business it leaves out. */
  "landing.feature.ai.ask": "What’s the best booking app for a small team?",
  "landing.feature.ai.mentions": "An AI answer mentions",
  "landing.feature.ai.you": "{you}: not mentioned",
  "landing.feature.google.title": "Get Found on Google",
  "landing.feature.google.body": "We find searches where competitors show up and you don’t. Then we write pages for the ones you can win.",
  /** The Google card's drawing: one search, a rival's page at its place, and the business nowhere near. */
  "landing.feature.google.search": "“how to stop double bookings”",
  "landing.feature.google.chain": "a booking app’s page",
  "landing.feature.google.you": "You",
  "landing.feature.google.absent": "not on Google’s first two pages",
  "landing.feature.fix.free": "Free fix · 10 min",
  /** *What to do next*: the time each step takes. */
  "landing.step.1.tag": "free · under a minute",
  "landing.step.2.tag": "every Monday",
  "landing.step.3.tag": "from week 1",
  /** The closing band: its heading, and the line under its button. */
  "landing.close.heading": "See Who Gets Your Buyers Today",
  "landing.price.heading": "What’s Included for {price}/month?",
  "landing.price.month": "a month",
  "landing.price.terms": "{price} a month. One plan. Cancel any time.",
  /** The questions owners ask, each a question and its answer. */
  "landing.faq.heading": "Questions Owners Ask",
  "landing.faq.spam.q": "Is this AI spam?",
  "landing.faq.spam.a": "No. Claude, an AI model, writes each page from your site and linked sources. A page that fails its checks twice never goes live.",
  "landing.faq.approve.q": "Do I have to approve each page?",
  "landing.faq.approve.a": "No. Each page goes live by itself {hours} hours after it is written. You can edit or stop it first, or do nothing.",
  "landing.faq.results.q": "How long until I see results?",
  "landing.faq.results.a": "Your pages go live in week 1. Each Monday email shows what went live and how your pages are doing.",
  "landing.faq.stop.q": "What if I want to stop?",
  "landing.faq.stop.a": "Cancel any time from Settings, and you’re not charged again. Section four of our Terms says when your access ends. Pages on the blog address we run for you stay live for {days} days after your access ends, and we email you a week before they stop. Your export of every page stays available, with no end date.",
  "landing.faq.any.q": "Will it work for my business?",
  "landing.faq.any.a": "Yes, if it has a website: a local service, shop, restaurant, firm, software or creator. We help your website where buyers search and ask AI, not your Google Maps listing.",
  "landing.faq.start.q": "What do I need to start?",
  "landing.faq.start.a": "A website. After you pay, copy one line into your domain’s settings to connect it.",
  "landing.faq.german.q": "Does it work in German?",
  "landing.faq.german.a": "Yes. Sites in {germanCountries} are checked and written in German. Sites in {englishCountries}, and everywhere else, get English.",
  "landing.faq.trial.q": "Why is there no free trial?",
  "landing.faq.trial.a": "The scan and your first page are free, so you see the work first. Then it’s one plan at {price} a month.",
  /** The landing's short answers; How it works and Pricing keep the full ones above. */
  "landing.faq.approve.short": "No. Each page goes live by itself {hours} hours after it is written. You can edit or stop it first.",
  "landing.faq.results.short": "Pages go live in week 1. Google takes weeks to months; each Monday email shows how your pages are doing.",
  "landing.faq.stop.short": "Cancel any time in Settings; you’re not charged again. Your export of every page stays available.",
  "landing.faq.german.short": "Yes, sites in {germanCountries} are checked and written in German. Everywhere else gets English.",
  "landing.faq.trial.short": "The scan and your first page are free, so you see the work first.",
  "landing.faq.more": "See all questions",
  "landing.close.assurance": "free · no account · under a minute",

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
  "quiet.refused.head.network-limit": "Too Many Scans From Your Network",
  "quiet.refused.head.network-day-limit": "No Free Scans Left Today",
  "quiet.refused.head.domain-day-limit": "No More Scans of This Site Today",
  "quiet.refused.head.scan-running": "A Scan Is Already Running",
  "quiet.refused.head.stopped": "Free Scanning Is Paused",
  "quiet.cooldown.head": "We Couldn’t Finish Scanning This Site",
  "quiet.removed.head": "This Report Was Removed",
  "control.scan-another": "Scan a Different Site",
  "control.example-report": "Read an Example Report",
  "control.back-to-start": "Back to the Start",

  /* ── The free-scans gallery, `/scans`, and the landing's strip (#1069) ── */
  // SPEC §2 Gallery board. The words of board `PubScans`; the
  // rest drafted in the registry's voice for the owner to correct.
  "gallery.eyebrow": "Scan Library",
  "gallery.heading": "Every Free Scan, in the Open",
  "gallery.subline": "{count} free reports, each at a lasting public link. See how businesses like yours show up on Google and AI.",
  "gallery.next.assurance": "free · no account · under a minute · listed here when it’s done",
  "gallery.list.heading": "Free reports",
  "gallery.search.label": "Search by company or domain",
  "gallery.filter.label": "Kind of business",
  "gallery.filter.all": "All",
  // One word per kind of business (`src/lib/market/kinds.ts`).
  "gallery.kind.local-service": "Local services",
  "gallery.kind.shop": "Shops",
  "gallery.kind.hospitality": "Restaurants & venues",
  "gallery.kind.professional-services": "Agencies & firms",
  "gallery.kind.software": "Software",
  "gallery.kind.creator": "Creators & courses",
  "gallery.showing": "Showing {shown} of {total} reports",
  "gallery.sort.label": "Sort",
  "gallery.sort.newest": "Newest first",
  "gallery.sort.highest": "Highest score",
  "gallery.sort.lowest": "Lowest score",
  "gallery.sort.az": "A–Z",
  "gallery.card.view": "View report",
  "gallery.card.score": "{score} of {max}",
  "gallery.card.no-score": "Not scored",
  "gallery.more": "Show more reports",
  "gallery.empty.heading": "No free scan matches that yet.",
  "gallery.empty.body": "Scan it now. It takes under a minute, then it shows here.",
  "gallery.empty.cta": "Scan this site",

  // SPEC §6, owner D66 (issue 1311): the one line a report owes its reader
  // where the site named a country or a language that is not measured yet.
  // Drafted (#759).
  "report.locale.fell-back": "Searched on Google in {country}, in {language}. We don’t scan {unmeasured} yet.",
  // A country or language on the list is never called unmeasured: the line
  // names the pair the site read as and what ReachKit measures instead.
  // Drafted (#759).
  "report.locale.pair-fell-back": "Searched on Google in {country}, in {language}. Your site is in {readLanguage}, and we scan {readCountry} in {ownLanguage}.",
  "report.locale.country-read-as": "Searched in {country}, in {language}, because your site is in {readLanguage}. Scan again to see {readCountry} in {ownLanguage}.",
  // A site that declares other markets: one is measured, chosen at setup.
  // Drafted (#759).
  "report.locale.also-serves": "Your site serves {n} more markets. You can choose another at setup.",
  "report.locale.also-serves.one": "Your site serves one more market. You can choose it at setup.",
  "app.locale.also-serves": "Your site also serves {n} other markets; we measure one. Change it in Settings.",
  "app.locale.also-serves.one": "Your site also serves one other market; we measure one. Change it in Settings.",
  // The measurement line of a report whose site could not be read, measured
  // in D66's default, and what its Google listing reads as. Drafted (#759).
  "report.locale.guessed": "We couldn’t read your site, so we searched Google in {country}, in {language}.",
  "report.locale.listing-reads": "Your Google listing says {country}.",
  "report.locale.site.pair": "{country} in {language}",
  // The measurement line of a report measured anywhere but in US Google in
  // English (D66). Drafted (#759).
  "report.measurement.in": "Searched on Google in {country}, in {language}.",
  // The measurement line of a report measured in the town its site serves
  // (D67, owner ruling 2026-10-15). The search vendor gives volumes by
  // country only, so the line says so (issue 1480). Drafted (#759).
  "report.measurement.place": "Searched on Google near {place}, in {language}. Search counts are for all of {country}.",

  // SPEC §2, owner A3 and E1 (2026-10-19): the report lists every page it
  // found missing; the count is said once, in the headline (owner R12).
  "report.offer.free-path.lead": "Not ready?",
  "report.offer.free-path": "Get Your First Page Free ↓",
  "report.missing.volume": "searched {volume} times a month",
  "report.missing.holder": "answered today by {holder}",
  "report.missing.rest": "Topics 6 to {last}: the search each one answers",
  "report.missing.all": "All {count}, nothing hidden.",
  "report.missing.page": "page {n}",
  "report.missing.free": "free · written for you",
  "report.missing.free.read": "Read It Free ↓",
  "report.rest.eyebrow": "More in your report",
  "report.missing.title": "Pages You’re Missing",
  "report.missing.lead": "Each one answers a question your buyers ask.",
  // Board PubReport, the report's head (canvas V22): what we read the site
  // as, the headline of who gets the buyers, and the score's parts. Drafted in the board's words; the owner corrects them.
  "report.read.as.title": "We read you as",
  "report.read.as.what": "{kind} · {category}",
  "report.read.as.locale": "{language}, {country}",
  "report.read.as.kind.local-service": "Local service",
  "report.read.as.kind.shop": "Shop",
  "report.read.as.kind.hospitality": "Restaurant or venue",
  "report.read.as.kind.professional-services": "Agency or firm",
  "report.read.as.kind.software": "Software",
  "report.read.as.kind.creator": "Creator or course",
  "verdict.estimate.range": "likely {low} to {high}",
  "verdict.score.split": "How This Score Is Split",
  "verdict.score.parts": "Four parts, combined into one score. They are not added up.",
  "verdict.score.parts.three": "Three parts, combined into one score. They are not added up.",
  // The top names Google's AI, the one AI the free scan asks, and never sums a count over both cards.
  "report.top.title": "{domain}: {score}/100, {verdict}",
  "report.top.line": "Buyers who ask Google’s AI or Google about {category} see {competitor} most.",
  "report.top.line.you-lead": "Buyers who ask Google’s AI or Google about {category} find you most.",
  "report.top.line.none": "Buyers who ask Google’s AI or Google about {category} can’t find you yet.",
  "report.top.ai": "Google’s AI answers mentioned you in {a} of {A}.",
  "report.top.google": "You are on Google’s first page for {g} of {G} searches.",
  "report.top.offer": "We found {count} questions your buyers ask that no page of yours answers.",
  "report.top.offer.one": "We found 1 question your buyers ask that no page of yours answers.",
  "report.independent": "An independent report by ReachKit. {company} has not endorsed it.",
  "report.buyers.title": "Who Gets Your Buyers",
  "report.you": "You",
  "report.ai.waffle": "AI mentioned {leader} in {x} of {total} answers, and you in {you}.",
  "report.ai.waffle.you-lead": "AI mentioned you most, in {you} of {total} answers.",
  "report.ai.quote": "One answer, for {search}",
  "report.ai.quote.said": "“{quote}”",
  "report.ai.asked": "The {total} Searches We Asked",
  "report.google.waffle": "{leader} is on Google’s first page for {x} of {total} searches. You are on {you}.",
  "report.google.waffle.you-lead": "You are on Google’s first page most often, for {you} of {total} searches.",
  "report.google.most": "Most searched: {search}, about {volume} times a month. First on Google: {holder}.",
  "report.google.most.none": "Most searched: {search}, about {volume} times a month.",
  "report.google.most.you": "Most searched: {search}, about {volume} times a month. You are first on Google.",
}) satisfies CopyPartition;
