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
  "verdict.limiting.foundations": ["Biggest gap: Website basics", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "verdict.limiting.foundations.line": ["Google and AI can’t fully read your site.", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "verdict.limiting.answerability": ["Biggest gap: Answers questions", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "verdict.limiting.answerability.line": ["Your pages don’t answer buyers’ questions directly.", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "verdict.limiting.google": ["Biggest gap: Google", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "verdict.limiting.google.line": ["You’re rarely on Google’s first page.", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "verdict.limiting.ai": ["Biggest gap: AI", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "verdict.limiting.ai.line": ["AI answers rarely mention you.", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "verdict.limiting.presence": ["Biggest gap: Google and AI", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "verdict.limiting.presence.line": ["Buyers rarely find you on Google or in AI answers.", { slots: {}, fixedBy: "REQ-004 c2 · issue 1444" }],
  "removal.address": ["remove@reachkit.app", { slots: {}, fixedBy: "REQ-002 c1" }],
  "removal.line.on-report": ["Own this site and want this report taken down? Write to {address}.", { slots: { address: "text" }, fixedBy: "REQ-002 c1" }],
  "removal.line.removed": ["The site’s owner asked us to remove this report. To scan {domain} again, write to {address}.", { slots: { domain: "text", address: "text" }, fixedBy: "REQ-002 c3" }],
  "notice.incomplete": ["We couldn’t scan {what}, so this report is incomplete.", { slots: { what: "text" }, fixedBy: "REQ-001 c14" }],
  "notice.measurement-failed": ["The last scan didn’t finish, so nothing changed.", { slots: {}, fixedBy: "REQ-001 c16" }],
  "notice.correction-failed": ["The correction didn’t finish. This is the report from before.", { slots: {}, fixedBy: "REQ-094 c7" }],
  // #479. The pass could not read the site's own home page — the fetcher
  // refused it (too large, no answer, blocked) — so nothing after it was
  // attempted and the report stops there. Owner-owed until 2026-09-11, when
  // the owner approved this sentence (#516).
  "notice.site-unreadable": ["We couldn’t read this site’s home page. Check the address and scan again.", { slots: {}, fixedBy: "REQ-004 c6" }],
  // Issue 1379. The site's bot protection answered our reader with a page of
  // its own, so the site's own pages are unmeasured: never a zero, never
  // that page's facts. Drafted in this registry’s voice and shipped under
  // the owner ruling of 2026-09-16 (#759); the owner corrects the wording.
  "notice.bot-protected": ["This site’s bot protection blocked us, so we couldn’t score its pages.", { slots: {}, fixedBy: "SPEC §2 · issue 1379" }],
  // SPEC §2 (owner, 2026-10-10, issue 1387): where the market was read from
  // the site's listing in search. Drafted (#759).
  // SPEC §2 (owner, 2026-10-15, issue 1440): the searches a free scan left
  // unread are being read in the background. Short on purpose (the issue's
  // own words). Drafted (#759).
  "report.finishing-reads": ["Still scanning {count} searches…", { slots: { count: "text" }, fixedBy: "SPEC §2 · issue 1440" }],
  "report.finishing-reads.one": ["Still scanning {count} search…", { slots: { count: "text" }, fixedBy: "SPEC §2 · issue 1440" }],
  // SPEC §2 (issue 1481): the deployed code would read this stored scan
  // differently and the re-score has not rewritten it yet. Drafted (#759).
  "report.reads-differently": ["Scanned {date}. We’ve changed how we scan since. Scan again for a fresh report.", { slots: { date: "text" }, fixedBy: "SPEC §2 · issue 1481" }],
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
  "report.read.where.measured": ["Searched in {country}", { slots: { country: "text" }, fixedBy: "SPEC §2 · issue 1454" }],
  "report.read.where.unread": ["Not found yet. Searched in {country}", { slots: { country: "text" }, fixedBy: "SPEC §2 · issue 1470" }],
  "report.read.kind": ["What it is", { slots: {}, fixedBy: "SPEC §2 · issue 1470" }],
  "report.read.kind.local-service": ["A local service, done in person", { slots: {}, fixedBy: "SPEC §2 · issue 1470" }],
  "report.read.kind.shop": ["A shop", { slots: {}, fixedBy: "SPEC §2 · issue 1470" }],
  "report.read.kind.hospitality": ["A restaurant, café, bar or hotel", { slots: {}, fixedBy: "SPEC §2 · issue 1470" }],
  "report.read.kind.professional-services": ["A firm or agency", { slots: {}, fixedBy: "SPEC §2 · issue 1470" }],
  "report.read.kind.software": ["Software or an online service", { slots: {}, fixedBy: "SPEC §2 · issue 1470" }],
  "report.read.kind.creator": ["Courses, teaching or writing", { slots: {}, fixedBy: "SPEC §2 · issue 1470" }],
  "report.read.none": ["Not found yet", { slots: {}, fixedBy: "SPEC §2 · issue 1454" }],
  "report.read.edit": ["Correct it in Settings", { slots: {}, fixedBy: "SPEC §4 · issue 1454" }],
  "report.market.from-listing": ["We read your market from your Google listing.", { slots: {}, fixedBy: "SPEC §2 · issue 1450" }],
  "report.market.from-search": ["We couldn’t read your pages, so we found your market on Google.", { slots: {}, fixedBy: "SPEC §2 · issue 1387" }],
  // Issue 898. The site read and its market did not — the profile call or
  // the suggestions did not answer — so there is no question, no answer
  // card and no band. Distinct from `notice.incomplete`, which names
  // drivers that were not measured while others were; here nothing was
  // measured from the market at all, and naming a driver would name the
  // consequence rather than the cause. Drafted in this registry’s voice
  // and shipped under the owner ruling of 2026-09-16 (#759); the owner
  // corrects the wording.
  "notice.market-unread": ["We couldn’t work out this site’s market. Scan again in a minute.", { slots: {}, fixedBy: "SPEC §2 · issue 898" }],
  "notice.refused.network-limit": ["Your network has used this hour’s free scans. Scan again in {wait}.", { slots: { wait: "text" }, fixedBy: "REQ-003 c6" }],
  // Issue 885's two free-path bounds. Drafted in this registry’s voice and
  // shipped under the owner ruling of 2026-09-16 (#759); the owner corrects
  // the wording. Neither borrows `network-limit`’s sentence: that one names
  // the hour and the five, and the day bound is neither — and the domain
  // bound is not about the visitor’s network at all, so a sentence that
  // said "from your network" would be telling a stranger they had done
  // something they had not.
  "notice.refused.network-day-limit": ["Your network has used today’s free scans. Scan again in {wait}.", { slots: { wait: "text" }, fixedBy: "SPEC §2 · issue 885" }],
  "notice.refused.domain-day-limit": ["This site has had today’s free scans. Scan again in {wait}.", { slots: { wait: "text" }, fixedBy: "SPEC §2 · issue 885" }],
  "notice.refused.scan-running": ["A scan from your network is still running. Try again in about {wait}.", { slots: { wait: "text" }, fixedBy: "REQ-003 c7" }],
  // #104. ReachKit's own stop, in writing — the one refusal the visitor
  // did not cause and the only one that names no wait, because nobody can
  // say when we start again (ADR-011).
  "notice.refused.stopped": ["Free scans are paused for now. Every report stays open to read.", { slots: {}, fixedBy: "REQ-003 c12" }],
  "control.rescan-age": ["Scan again", { slots: {}, fixedBy: "REQ-001 c15" }],
  "control.rescan-incomplete": ["Scan what’s missing", { slots: {}, fixedBy: "REQ-001 c14" }],
  "control.retry": ["Try again", { slots: {}, fixedBy: "REQ-001 c16" }],
  // Issue 715: the control on a part the pass's ceiling cut off — SPEC §2
  // quotes the words.
  "control.retry-part": ["Try this part again", { slots: {}, fixedBy: "SPEC §2 · issue 715" }],
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
  "verdict.factor.foundations": ["Website basics", { slots: {}, fixedBy: "REQ-004 c3 · issue 1444" }],
  "verdict.factor.answerability": ["Answers questions", { slots: {}, fixedBy: "REQ-004 c3 · issue 1444" }],
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
  "report.measured-at": ["Scanned {date} · {category}.", { slots: { date: "text", category: "text" }, fixedBy: "REQ-004 c1" }],
  "report.measured-at.no-category": ["Scanned {date}.", { slots: { date: "text" }, fixedBy: "REQ-094 c1" }],
  // Issue 715: SPEC §2 — "Measurement is US Google in English, stated in one
  // always-visible line." Owner-owed.
  "report.measurement": ["Searched on Google in the US, in English.", { slots: {}, fixedBy: "SPEC §2 · issue 715" }],
  // 6a: "Discoverability Score" is the number's name on every surface that
  // labels it — this eyebrow, the Overview tile, and the two mails.
  "verdict.score.label": ["Visibility Score", { slots: {}, fixedBy: "ruling 6a" }],
  // Issue 1068, board R12-2: the summary card's eyebrow and what the ring's
  // figure is out of. Drafted; the owner corrects the wording.
  "report.eyebrow": ["Your free report", { slots: {}, fixedBy: "issue 1068" }],
  "verdict.score.of": ["of 100", { slots: {}, fixedBy: "issue 1068" }],
  // Issue 1932: beside the range, where a re-score moved the score because
  // the Google half moved. `{before}` is the score as first stored. Drafted;
  // the owner corrects the wording.
  "verdict.rescored": ["Updated {date}, when we changed how the Google part counts. It was {before}.", { slots: { date: "text", before: "text" }, fixedBy: "issue 1932 · drafted" }],
  // REQ-094 c1's correction control, as S2 draws it. #786 gives it its
  // destination: an inline field that posts the corrected market to
  // `POST /api/report/{domain}/correct` and follows the rerun's stages.
  "verdict.not-your-market": ["Not your market? Correct it", { slots: {}, fixedBy: "REQ-094 c1" }],
  // #786: the field, its line and its outcomes. Drafted in the registry's
  // voice under the 2026-09-16 ruling (#759) — named in the PR for the
  // owner to correct.
  "correction.field.label": ["Your market, in a few words", { slots: {}, fixedBy: "SPEC §2 · issue 786" }],
  "correction.submit": ["Scan again for this market", { slots: {}, fixedBy: "SPEC §2 · issue 786" }],
  "correction.cancel": ["Cancel", { slots: {}, fixedBy: "SPEC §2 · issue 786" }],
  "correction.line": [
    "You can correct this once. We reuse the AI answers we have.",
    { slots: {}, fixedBy: "SPEC §2 · issue 786" },
  ],
  "correction.running": [
    "Scanning again for your market. This page updates when it’s done.",
    { slots: {}, fixedBy: "SPEC §2 · issue 786" },
  ],
  "correction.refused.running": ["A correction is already running for this report.", { slots: {}, fixedBy: "SPEC §2 · issue 786" }],
  "correction.refused.used": ["You’ve already used this report’s one correction.", { slots: {}, fixedBy: "SPEC §2 · issue 786" }],
  "correction.refused.too-old": [
    "This report is too old to correct. Scan it again instead.",
    { slots: {}, fixedBy: "SPEC §2 · issue 786" },
  ],
  "correction.refused.unavailable": [
    "That didn’t start, and your correction is still unused. Try again in a few minutes.",
    { slots: {}, fixedBy: "SPEC §2 · issue 786" },
  ],

  // ── The scanning arm's six named stages (REQ-003 c1) ──────────────────
  // One key per `StageName` (`src/lib/scan/stages.ts`) — a stage with no
  // word cannot render, which is what makes "named stages, never an
  // unlabelled spinner" structural. WO-282 left these to BP-023's own
  // file plan; nothing created them, and the scanning arm cannot render
  // without them, so they are minted here with the rest of this surface.
  "stage.reading_your_site": ["Reading your site", { slots: {}, fixedBy: "REQ-003 c1" }],
  "stage.reading_access_rules": ["Checking what Google and AI may read", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "stage.reading_your_market": ["Finding your market and competitors", { slots: {}, fixedBy: "REQ-003 c1" }],
  "stage.checking_your_presence": ["Checking {searches} searches buyers make", { slots: { searches: "text" }, fixedBy: "board PubScanning · issue 1725" }],
  "stage.asking_the_twelve": ["Asking Google’s AI the same searches", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "stage.scoring": ["Working out your score", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "stage.reading_your_site.line": ["What you sell, who buys it and where.", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "stage.reading_access_rules.line": ["Whether your site lets them in.", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "stage.reading_your_market.line": ["Who shows up when your buyers search.", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "stage.checking_your_presence.line": ["Who is on Google’s first page for each.", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "stage.asking_the_twelve.line": ["Which businesses the answers mention.", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "stage.scoring.line": ["One number for how easy you are to find.", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "stage.status.done": ["Done", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "stage.status.working": ["Working on it", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "stage.status.next": ["Next", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "stage.started": ["started {time}", { slots: { time: "text" }, fixedBy: "board PubScanning · issue 1725" }],
  // The elapsed time the approved set draws beside a finished stage, and
  // the one line the scanning screen ends on (S3, approved under 11a).
  "stage.elapsed": ["{seconds} s", { slots: { seconds: "text" }, fixedBy: "REQ-003 c1" }],
  "scan.eyebrow": ["Your free scan", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "scan.head": ["Scanning {domain}", { slots: { domain: "text" }, fixedBy: "board PubScanning · issue 1725" }],
  "scan.progress.title": ["Progress", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "scan.get.title": ["What you’ll get", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "scan.get.score": ["Your Visibility Score", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "scan.get.score.line": ["out of 100", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "scan.get.rivals": ["Who shows up instead of you", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "scan.get.rivals.line": ["on Google and in AI answers", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "scan.get.held": ["Your site fixes", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "scan.get.held.line": ["each one free to fix", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "scan.get.first-page": ["Your first page, free", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "scan.get.first-page.line": ["and how many more you’re missing", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "scan.get.after": ["After that, we can write the missing pages for you.", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "scan.filling.title": ["Your report so far", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "scan.filling.grey": ["Still loading", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "scan.filling.readers": ["Who can read your site", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "scan.filling.competitors": ["Your competitors", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "scan.filling.searches": ["{searches} searches buyers make", { slots: { searches: "text" }, fixedBy: "board PubScanning · issue 1725" }],
  "scan.filling.ai": ["What AI answers say", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "scan.filling.pages": ["{pages} pages read", { slots: { pages: "text" }, fixedBy: "board PubScanning · issue 1905" }],
  "scan.filling.buyer": ["Who buys: {buyer}", { slots: { buyer: "text" }, fixedBy: "board PubScanning · E44 · issue 2064" }],
  "scan.filling.reader.google": ["Google", { slots: {}, fixedBy: "board PubScanning · issue 1905" }],
  "scan.filling.reader.ai": ["AI", { slots: {}, fixedBy: "board PubScanning · issue 1905" }],
  "scan.filling.reader.in": ["let in", { slots: {}, fixedBy: "board PubScanning · issue 1905" }],
  "scan.filling.reader.out": ["shut out", { slots: {}, fixedBy: "board PubScanning · issue 1905" }],
  "scan.filling.reader.fix": ["Your report will show the free fix.", { slots: {}, fixedBy: "board PubScanning · issue 1905" }],
  "scan.filling.search.in": ["first page", { slots: {}, fixedBy: "board PubScanning · issue 1905" }],
  "scan.filling.search.out": ["not on first page", { slots: {}, fixedBy: "board PubScanning · issue 1905" }],
  "scan.filling.found": ["found", { slots: {}, fixedBy: "board PubScanning · issue 1725" }],
  "scan.waiting.line": ["This takes under a minute. Your report stays at this link.", { slots: {}, fixedBy: "REQ-003 c1 · owner O6 2026-10-31" }],
  /** The line above the stages when a re-measure was started *from* a
   *  report that is already on screen (#935). It is not
   *  `scan.waiting.line` — that one tells a first-time visitor the address
   *  survives the wait, which this reader already knows — and it is not
   *  `correction.running`, which names the market they gave. Drafted under
   *  the owner's 2026-09-16 ruling (#759), in this registry's voice. */
  "scan.rescanning.line": [
    "Scanning again. This page updates when it’s done.",
    { slots: {}, fixedBy: "issue 935 · drafted" },
  ],

  // ── Module 2, left card — AI answers (REQ-006) ────────────────────────
  "ai-answers.title": ["AI", { slots: {}, fixedBy: "REQ-006 c1" }],
  "ai-answers.source": ["We asked Google’s AI {total} buyer searches. It answered {answered}.", { slots: { total: "text", answered: "text" }, fixedBy: "REQ-006 c9 · owner O6 2026-10-31" }],
  // Issue 715: SPEC §2 — a category correction reuses the AI answers already
  // read, "and says so". Owner-owed.
  "ai-answers.coverage.cached-only": [
    "These AI answers come from an earlier scan.",
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
    "Scanning this part again. This page updates when it’s done.",
    { slots: {}, fixedBy: "SPEC §2 · issue 715" },
  ],
  "retry-part.refused.no-budget": [
    "This part can’t be scanned again. Scan the whole site again instead.",
    { slots: {}, fixedBy: "SPEC §2 · issue 715" },
  ],
  "retry-part.refused.already-measured": [
    "This part is done. Reload the page to see it.",
    { slots: {}, fixedBy: "SPEC §2 · issue 715" },
  ],
  "retry-part.refused.unavailable": [
    "That didn’t start. Try again in a few minutes.",
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
  "ai-answers.questions.title": ["The {total} searches", { slots: { total: "text" }, fixedBy: "REQ-006 c9 · issue 873" }],
  // Issue 873: what this report measured, in one line, so a founder does
  // not count rows to find out.
  "ai-answers.questions.measured": [
    "We scanned {measured} of these {total} searches.",
    { slots: { measured: "text", total: "text" }, fixedBy: "issue 873" },
  ],
  // Issue 1309: a pass that found more questions than its purse or its 50 s
  // could measure lists them all, so the list's count is not the report's
  // measured count. These two say which is which; the pair above stays for
  // a report that measured every question it lists.
  "ai-answers.questions.title.partial": ["Searches scanned: {measured} of {total}", { slots: { total: "text", measured: "text" }, fixedBy: "issue 1309 · drafted" }],
  "ai-answers.questions.measured.partial": [
    "We scanned {measured} of the {total} we found. Rows marked not measured don’t count.",
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
  "ai-answers.absent": ["We couldn’t scan AI answers this time. The rest of the report still holds.", { slots: {}, fixedBy: "REQ-004 c10" }],

  // ── Module 2, right card — Google presence (REQ-008) ──────────────────
  "presence.title": ["Google", { slots: {}, fixedBy: "REQ-008 c1" }],
  // Issue 1309: the count is the card's own denominator, never the literal
  // twelve — the chip said 12 over a report that measured two.
  "presence.source": ["Out of {measured} searches buyers in your market make.", { slots: { measured: "text" }, fixedBy: "REQ-008 c1 · issue 1309" }],
  // Issue 1444: the card's figure is `{count} of {total}` — the searches
  // the customer is on the first page for, of those measured — and this is
  // the one line under it. The competitors' counts are the bars.
  "presence.finding": ["Searches where you’re on Google’s first page", { slots: {}, fixedBy: "REQ-008 c1 · issue 1444" }],
  // A figure: one count out of another, as each card's head states it.
  "report.figure.of": ["{count} of {total}", { slots: { count: "text", total: "text" }, fixedBy: "issue 1444" }],
  "presence.no-rivals": ["No competitor showed up in these searches.", { slots: {}, fixedBy: "REQ-008 c6" }],
  "presence.absent-from.title": ["Searches where you don’t show up", { slots: {}, fixedBy: "REQ-008 c4 · owner O6 2026-10-31" }],
  "presence.absent-from.column.search": ["Search", { slots: {}, fixedBy: "REQ-008 c4" }],
  "presence.absent-from.column.volume": ["Searches a month", { slots: {}, fixedBy: "REQ-008 c4" }],
  "presence.absent-from.column.holder": ["Who’s first", { slots: {}, fixedBy: "REQ-008 c4" }],
  "presence.absent-from.empty": ["You show up in every search we scanned.", { slots: {}, fixedBy: "REQ-008 c4" }],
  "presence.absent": ["We couldn’t scan Google this time. The rest of the report still holds.", { slots: {}, fixedBy: "REQ-004 c10" }],

  // ── Module 3, the three problem cards (REQ-009) ───────────────────────
  // One title, one doer and one measured-zero line per problem; the three
  // severity words are BANDS_COPY's `severity.*` and are not restated.
  "problem.blocked-readers.title": ["AI shut out of your site", { slots: {}, fixedBy: "SPEC §0 · owner R12 B2 2026-10-22 · issue 1724" }],
  "problem.blocked-readers.doer": ["Free fix · 10 min", { slots: {}, fixedBy: "REQ-009 c2" }],
  "problem.blocked-readers.none-needed": ["Nothing to fix", { slots: {}, fixedBy: "REQ-009 c3" }],
  "problem.missing-pages.title": ["Missing pages", { slots: {}, fixedBy: "REQ-009 c1" }],
  "problem.missing-pages.doer": ["ReachKit writes", { slots: {}, fixedBy: "REQ-009 c5" }],
  "problem.missing-pages.none-needed": ["Nothing to fix", { slots: {}, fixedBy: "REQ-009 c3" }],
  "problem.unquotable-pages.title": ["Pages AI can’t quote", { slots: {}, fixedBy: "REQ-009 c1" }],
  "problem.unquotable-pages.doer": ["ReachKit rewrites on WordPress", { slots: {}, fixedBy: "REQ-009 c5" }],
  "problem.unquotable-pages.none-needed": ["Nothing to fix", { slots: {}, fixedBy: "REQ-009 c3" }],
  // The one control any fix carries (REQ-009 c2), on the paste arm only.
  "problem.paste.label": ["Copy the lines", { slots: {}, fixedBy: "REQ-009 c2" }],
  // Issue 1068, board R12-2: the section's head, each card's one-line cause,
  // and the *show me* link the card opens. Drafted; the owner corrects them.
  "problem.section.title": ["Site fixes", { slots: {}, fixedBy: "issue 1068" }],
  "problem.section.sub": ["The {problems} that cost you most, then {checks} quick checks", { slots: { problems: "text", checks: "text" }, fixedBy: "issue 1068" }],
  "problem.blocked-readers.cause": ["Your site blocks AI, or asks Google and AI to skip pages.", { slots: {}, fixedBy: "board PubReport · issue 1724" }],
  "problem.missing-pages.cause": ["Questions your buyers ask that no page on your site answers.", { slots: {}, fixedBy: "issue 1068" }],
  "problem.unquotable-pages.cause": ["These pages have no clear answer AI can quote.", { slots: {}, fixedBy: "issue 1068" }],
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
    "We couldn’t run this check. It may still need a fix.",
    { slots: {}, fixedBy: "issue 571" },
  ],
  // Issue 1068: the eight checks are one list, and a grey dot is the not-run
  // line said once under it.
  "check.legend": ["A grey dot means we couldn’t run that check.", { slots: {}, fixedBy: "issue 1068" }],
  "check.page-titles.title": ["Missing or duplicate titles", { slots: {}, fixedBy: "issue 571" }],
  "check.meta-descriptions.title": ["Missing or duplicate descriptions", { slots: {}, fixedBy: "issue 571" }],
  "check.noindex-pages.title": ["Pages hidden from search", { slots: {}, fixedBy: "issue 571" }],
  "check.sitemap.title": ["No page list for Google", { slots: {}, fixedBy: "board PubReport · issue 1724" }],
  "check.slow-pages.title": ["Slow pages", { slots: {}, fixedBy: "issue 571" }],
  "check.broken-links.title": ["Broken internal links", { slots: {}, fixedBy: "issue 571" }],
  "check.phone-usability.title": ["Hard to use on a phone", { slots: {}, fixedBy: "issue 571" }],
  // The report's plain name; the account's Technical issues view keeps "Broken internal links" (board AppIssues).
  "check.broken-links.plain": ["Links between pages that go nowhere", { slots: {}, fixedBy: "SPEC §0 · owner R12 B2 2026-10-22 · issue 1724" }],
  "check.status.not-run": ["Couldn’t run", { slots: {}, fixedBy: "board PubReport · issue 1724" }],
  "check.structured-data.title": ["Pages with no labels for Google", { slots: {}, fixedBy: "issue 1909 · seo-master 2026-10-23" }],
  // The report's plain name (board PubReport); the account surfaces read the problem in `.title`.
  "check.structured-data.plain": ["Page labels Google can read", { slots: {}, fixedBy: "board PubReport · issue 1724 · issue 1909 · seo-master 2026-10-23" }],
  // Who the labels say runs the site, under the structured-data row; no line where it was not measured.
  "check.identity.found": ["The labels say who runs the site: {type}.", { slots: { type: "text" }, fixedBy: "board PubReport · issue 1915 · ux-designer 2026-10-23" }],
  "check.identity.none": ["No label says who runs the site.", { slots: {}, fixedBy: "board PubReport · issue 1915 · ux-designer 2026-10-23" }],
  // Issue 1550 (drafted): the one thing to do about each check the customer
  // fixes, on the account's Technical issues view.
  "check.noindex-pages.fix": ["Turn off noindex on these pages in your site builder or plugin. Then Google can list them.", { slots: {}, fixedBy: "issue 1550 (drafted)" }],
  "check.sitemap.fix": ["Turn on your sitemap in your site builder or plugin. Add its address to robots.txt.", { slots: {}, fixedBy: "issue 1550 (drafted)" }],
  "check.slow-pages.fix": ["Turn on page caching with your host. Shrink the biggest images on these pages.", { slots: {}, fixedBy: "issue 1550 (drafted)" }],
  "check.broken-links.fix": ["These links lead to error pages. Fix or remove them.", { slots: {}, fixedBy: "issue 1550 (drafted)" }],
  "check.phone-usability.fix": ["Add a viewport tag to these pages’ template. Then they fit a phone screen.", { slots: {}, fixedBy: "issue 1550 (drafted)" }],
  "check.ai-readers.fix": ["Let AI in through your robots.txt. Remove any nosnippet setting from your pages.", { slots: {}, fixedBy: "issue 1550 (drafted)" }],

  // ── Module 4, the DIY sections (REQ-009 c6) ───────────────────────────
  // Instructional text is allowed here and nowhere else on this screen.
  // S2's eyebrow over the three collapses. The collapses' instructional
  // prose is the owner's (approved 2026-09-10, #459).
  "method.title": ["Do it yourself, free", { slots: {}, fixedBy: "REQ-009 c6 · owner O6 2026-10-31" }],
  "method.blocked-readers.title": ["Let AI in", { slots: {}, fixedBy: "board PubReport · issue 1724" }],
  "method.blocked-readers.body": ["Open your site’s robots.txt file. Your host usually has a setting for it.", { slots: {}, fixedBy: "board PubReport · owner O6 2026-10-31" }],
  "method.blocked-readers.step.1": ["Add the lines shown, so AI tools are let in.", { slots: {}, fixedBy: "board PubReport · owner O6 2026-10-31" }],
  "method.blocked-readers.step.2": ["Remove nosnippet or max-snippet:0 from any page that has it.", { slots: {}, fixedBy: "board PubReport · owner O6 2026-10-31" }],
  "method.blocked-readers.step.3": ["If your home page says noindex, remove that too.", { slots: {}, fixedBy: "board PubReport · owner O6 2026-10-31" }],
  "method.blocked-readers.snippet-pages": ["AI answers can’t quote these pages:", { slots: {}, fixedBy: "SPEC §9 D14 · issue 1145" }],
  "method.blocked-readers.training-choice": ["Your robots.txt keeps {crawlers} out. That only stops AI training, so we don’t count it.", { slots: { crawlers: "text" }, fixedBy: "SPEC §9 D14 · issue 1145" }],
  "method.missing-pages.title": ["Write the missing pages", { slots: {}, fixedBy: "REQ-009 c6" }],
  "method.missing-pages.body": ["You don’t need ReachKit for any of this.", { slots: {}, fixedBy: "board PubReport · owner O6 2026-10-31" }],
  "method.missing-pages.step.1": ["Answer the buyer’s question in the first lines.", { slots: {}, fixedBy: "board PubReport · owner O6 2026-10-31" }],
  "method.missing-pages.step.2": ["Back it with facts from your own site, each one linked.", { slots: {}, fixedBy: "board PubReport · owner O6 2026-10-31" }],
  "method.missing-pages.step.3": ["Put it on your own website, at a plain address.", { slots: {}, fixedBy: "board PubReport · owner O6 2026-10-31" }],
  "method.missing-pages.step.4": ["Link to it from a page that already does well.", { slots: {}, fixedBy: "board PubReport · owner O6 2026-10-31" }],
  "method.missing-pages.step.5": ["A few pages a week is a good pace. One a week still helps.", { slots: {}, fixedBy: "board PubReport · owner O6 2026-10-31" }],
  "method.unquotable-pages.title": ["Make pages AI can quote", { slots: {}, fixedBy: "REQ-009 c6" }],
  "method.unquotable-pages.body": ["AI quotes pages that answer a question directly.", { slots: {}, fixedBy: "board PubReport · owner O6 2026-10-31" }],
  "method.unquotable-pages.step.1": ["Turn each heading into a question a buyer asks.", { slots: {}, fixedBy: "board PubReport · owner O6 2026-10-31" }],
  "method.unquotable-pages.step.2": ["Put a direct answer of 2 or 3 sentences under it.", { slots: {}, fixedBy: "board PubReport · owner O6 2026-10-31" }],
  "method.unquotable-pages.step.3": ["Add proof: a figure, a date, a source you link to.", { slots: {}, fixedBy: "board PubReport · owner O6 2026-10-31" }],
  "method.unquotable-pages.step.4": ["Keep the page’s address, so it keeps what it has earned.", { slots: {}, fixedBy: "board PubReport · owner O6 2026-10-31" }],

  // ── Module 5, the free page card (REQ-010, BUILD §4.2's trade) ────────
  "free-page.title": ["Your first page, free", { slots: {}, fixedBy: "REQ-010 c1 · board PubReport" }],
  "free-page.badge": ["free", { slots: {}, fixedBy: "REQ-010 c1" }],
  "free-page.of": ["1 of the {total} pages we found.", { slots: { total: "text" }, fixedBy: "REQ-010 c1" }],
  // The facts list, in the board's order and words (owner R26).
  "free-page.row.target": ["answers", { slots: {}, fixedBy: "REQ-010 c1 · board PubReport · owner R26" }],
  "free-page.row.searched": ["searched", { slots: {}, fixedBy: "board PubReport · owner R26" }],
  // The page's own target volume, not the per-question volume removed on 2026-09-03.
  "free-page.searched.value": ["{volume} times a month", { slots: { volume: "text" }, fixedBy: "board PubReport · owner R26" }],
  "free-page.row.beats": ["answered today by", { slots: {}, fixedBy: "REQ-010 c1 · board PubReport · owner R26" }],
  "free-page.row.format": ["type of page", { slots: {}, fixedBy: "REQ-010 c1 · board PubReport · owner R26" }],
  // Shown only once the page is written: its stored first lines, a source they cite, and what they are.
  "free-page.source": ["from {source}", { slots: { source: "text" }, fixedBy: "board PubReport · owner R26" }],
  "free-page.caption": ["The first lines, written by AI from your site. We email you the full page.", { slots: {}, fixedBy: "board PubReport · owner R26 · owner O6 2026-10-31" }],
  // The format row's value, one per Write type the report can offer (issue 787,
  // drafted — the owner corrects the wording).
  "free-page.format.answer_page": ["An answer page", { slots: {}, fixedBy: "REQ-010 c1" }],
  "free-page.format.comparison_page": ["A comparison page", { slots: {}, fixedBy: "REQ-010 c1" }],
  "free-page.format.format_page": ["A comparison, alternative, integration or template page", { slots: {}, fixedBy: "REQ-010 c1" }],
  "free-page.format.keyword_page": ["A page for this search", { slots: {}, fixedBy: "REQ-010 c1" }],
  // REQ-010 c2's trade: the address field and the one control beside it.
  "free-page.email.label": ["Where should we send it?", { slots: {}, fixedBy: "REQ-010 c2" }],
  "free-page.email.placeholder": ["you@yourdomain.example", { slots: {}, fixedBy: "REQ-010 c2 · board PubReport · issue 1724" }],
  // True to the nurture sequence: at most NURTURE_MAX_TOUCHES follow-ups, each with a one-click opt-out.
  "free-page.consent": ["We’ll email this page, then up to {touches} short notes about your report. Unsubscribe in one click.", { slots: { touches: "text" }, fixedBy: "board PubReport · issue 1724" }],
  "free-page.submit": ["Email me the full page", { slots: {}, fixedBy: "REQ-010 c2" }],
  "free-page.absent": ["No free page this time. We found nothing worth writing.", { slots: {}, fixedBy: "REQ-004 c10" }],

  "place.report.first-page.rival": [
    "No competitor yet",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-010 c1" },
  ],
  "landing.headline": [
    "Google and AI find your competitors. Why not you?",
    { slots: {}, fixedBy: "REQ-001 c1 · owner O1 · 2026-10-31" },
  ],
  "landing.field.label": ["Your website", { slots: {}, fixedBy: "REQ-001 c1" }],
  "landing.submit.label": ["Scan my site", { slots: {}, fixedBy: "REQ-001 c1" }],
  "landing.problem.empty": ["Type your website’s address, like example.com.", { slots: {}, fixedBy: "REQ-001 c3" }],
  "landing.problem.not-a-hostname": ["That isn’t a website address. Try one like example.com.", { slots: {}, fixedBy: "REQ-001 c3" }],
  "landing.problem.ip-literal": ["That’s a number, not a website name. Try one like example.com.", { slots: {}, fixedBy: "REQ-001 c3" }],
  "landing.problem.no-public-suffix": ["That address has no ending. Try one like example.com.", { slots: {}, fixedBy: "REQ-001 c3" }],
  "landing.problem.too-long": ["That’s too long for a website address. Check for extra text.", { slots: {}, fixedBy: "REQ-001 c3" }],
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
  "landing.subline": ["We research your business and competitors, then write pages that get you found, on autopilot.", { slots: {}, fixedBy: "owner O2 · 2026-10-31" }],
  "landing.why.eyebrow": ["Why you should care", { slots: {}, fixedBy: "issue 266 · L11" }],
  "landing.why.heading": ["Buyers ask AI what to use.", { slots: {}, fixedBy: "issue 266 · L12" }],
  "landing.why.sub": ["If you’re not in the answer, that buyer never meets you.", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
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
  "landing.hero.how": ["See how it works", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  /** The pace (owner, A1, 2026-10-19). The number is `WEEK_PLAN.days`. */
  "landing.pace": ["Up to {weekPages} pages a week, new or updated. Never filler.", { slots: { weekPages: "text" }, fixedBy: "owner A1 · 2026-10-19" }],
  /** Under the three steps: the loop, and the owner's one-time part. */
  "landing.loop": ["Steps 2 and 3 repeat every week, without you", { slots: {}, fixedBy: "board Landing · issue 1726 · drafted" }],
  "landing.part.once": ["Your part, once · about {minutes} minutes", { slots: { minutes: "text" }, fixedBy: "board Landing · issue 1726 · drafted" }],
  "landing.part.answer": ["Answer a few questions", { slots: {}, fixedBy: "board Landing · issue 1726 · drafted" }],
  "landing.part.done": ["Done", { slots: {}, fixedBy: "board Landing · issue 1726 · drafted" }],
  "landing.part.after": ["Every week after: ReachKit", { slots: {}, fixedBy: "board Landing · issue 1726 · drafted" }],
  "landing.part.body": ["Answer a few questions, then connect your site with one setting where your web address is managed (we show you what to copy), or your WordPress login. ReachKit’s part: everything after that.", { slots: {}, fixedBy: "board Landing · issue 1726 · drafted" }],
  "landing.how.full": ["How it works, in full", { slots: {}, fixedBy: "board Landing · issue 1726 · drafted" }],
  "landing.inside.buyers": ["{place} buyers", { slots: { place: "text" }, fixedBy: "board Landing · issue 1726 · drafted" }],


  /** Section 03's three Step cards. The eyebrow and the three titles are
   *  approved (11a); the three bodies are bracketed in the set, and are the
   *  owner's approved sentences (2026-09-10, #459). */
  "landing.step.1.title": ["Scan your site", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.step.1.body": ["Type your website. See who Google and AI send your buyers to instead of you, what holds your site back, and your first page, proposed free.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.step.1.more": ["See what we research", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.glance.rivals": ["Who buyers pick instead", { slots: {}, fixedBy: "board PubLanding · issue 1997 · drafted" }],
  "landing.glance.first": ["Your first page, proposed free:", { slots: {}, fixedBy: "board PubLanding · issue 1997 · drafted" }],
  "landing.mail.inbox": ["Inbox", { slots: {}, fixedBy: "board PubLanding · issue 1997" }],
  "landing.glance.caption": ["{business} · example. It measures no site.", { slots: { business: "text" }, fixedBy: "board PubLanding · issue 1997" }],
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
  "landing.hero.example": ["Example. Not a promise.", { slots: {}, fixedBy: "board Landing · issue 1596" }],

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
  /** *Why you should care*: two cards, each a title, a line and a small
   *  drawing whose words follow it. */
  "landing.feature.ai.title": ["Get mentioned in AI answers", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.feature.ai.body": ["Every Monday we ask AI your buyers’ questions. You see if it names you, or a competitor.", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  /** The AI card's drawing: one answer, who it mentions, and the business it leaves out. */
  "landing.feature.ai.ask": ["Who’s a good emergency plumber in Austin?", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.feature.ai.mentions": ["An AI answer mentions", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.feature.ai.chain": ["a national plumbing chain", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.feature.ai.you": ["{you}: not mentioned", { slots: { you: "text" }, fixedBy: "board Landing · issue 1596" }],
  "landing.feature.google.title": ["Get found on Google", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.feature.google.body": [
    "We find searches where competitors show up and you don’t. Then we write pages for the ones you can win.",
    { slots: {}, fixedBy: "board R12-1 · issue 1067" },
  ],
  /** The Google card's drawing: one search, a rival's page at its place, and the business nowhere near. */
  "landing.feature.google.search": ["“water heater replacement cost austin”", { slots: {}, fixedBy: "board PubLanding · issue 1727 · drafted" }],
  "landing.feature.google.chain": ["a national plumbing chain’s page", { slots: {}, fixedBy: "board PubLanding · issue 1727 · drafted" }],
  "landing.feature.google.you": ["You", { slots: {}, fixedBy: "board PubLanding · issue 1727 · drafted" }],
  "landing.feature.google.absent": ["not on Google’s first two pages", { slots: {}, fixedBy: "board PubLanding · issue 1727 · drafted" }],
  "landing.feature.fix.free": ["Free fix · 10 min", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  /** *What to do next*: the time each step takes. */
  "landing.step.1.tag": ["free · under a minute", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.step.2.tag": ["every Monday", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  "landing.step.3.tag": ["from week 1", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  /** The closing band: its heading, and the line under its button. */
  "landing.close.heading": ["See who gets your buyers today.", { slots: {}, fixedBy: "board R12-1 · issue 1067" }],
  /** *What {price} a month gets you*: what the one plan holds, and its card. */
  "landing.price.heading": ["What {price} a month gets you", { slots: { price: "text" }, fixedBy: "board Landing · issue 1596" }],
  "landing.price.facts": ["Each page is written from facts on your site, with every fact linked to where it came from.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.price.ready": ["In your first week, an email when each page is ready, saying which search it answers and who answers it today.", { slots: {}, fixedBy: "board Landing · issue 1596 · decision 2026-10-19-1593 (drafted)" }],
  "landing.price.monday": ["Every Monday: where your pages sit in Google, which of your pages AI answers link to, and what is planned next.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.price.competitors": ["Your competitors, up to {rivals}, watched every week.", { slots: { rivals: "text" }, fixedBy: "board Landing · issue 1596" }],
  "landing.price.site": ["Your whole site checked for problems, with the fix for each.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.price.all": ["Everything in the one plan", { slots: {}, fixedBy: "board PubLanding · issue 1727 · drafted" }],
  /** Read from our own logs, so only where we run the address (owner R12 · B14). */
  "landing.price.found": ["Which of your pages Google and Bing have found, on the address we run.", { slots: {}, fixedBy: "board PubLanding · issue 1727 · ruling R12 (B14)" }],
  "landing.price.month": ["a month", { slots: {}, fixedBy: "board PubLanding · issue 1727 · drafted" }],
  "landing.price.see": ["See pricing", { slots: {}, fixedBy: "board PubLanding · issue 1727 · drafted" }],
  "landing.price.terms": ["{price} a month. One plan. Cancel any time.", { slots: { price: "text" }, fixedBy: "board Landing · issue 1596" }],
  "landing.price.more": ["See how it compares", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  /** The questions owners ask, each a question and its answer. */
  "landing.faq.eyebrow": ["Questions", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.heading": ["Questions owners ask", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.spam.q": ["Is this AI spam?", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.spam.a": ["No. Claude, an AI model, writes each page from your site and linked sources. A page that fails its checks twice never goes live.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.approve.q": ["Do I have to approve each page?", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.approve.a": ["No. Each page goes live by itself {hours} hours after it is written. You can edit or stop it first, or do nothing.", { slots: { hours: "text" }, fixedBy: "board Landing · issue 1596 · decision 2026-10-19-1593 (drafted)" }],
  "landing.faq.results.q": ["How long until I see results?", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.results.a": ["Your pages go live in week 1. Each Monday email shows where they sit on Google, and whether AI links to them.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.stop.q": ["What if I want to stop?", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.stop.a": ["Cancel any time from Settings, and you’re not charged again. Section four of our Terms says when your access ends. Pages on your WordPress stay where they are. Pages on the blog address we run for you stay live for {days} days after your access ends, and we email you a week before they stop. Your export of every page stays available, with no end date.", { slots: { days: "text" }, fixedBy: "board Landing · issue 1596 · ruling D5 · ruling R22" }],
  "landing.faq.any.q": ["Will it work for my business?", { slots: {}, fixedBy: "board PubLanding v36 · owner 2026-11-01" }],
  "landing.faq.any.a": ["Yes, if it has a website: a local service, shop, restaurant, firm, software or creator. We help your website where buyers search and ask AI, not your Google Maps listing.", { slots: {}, fixedBy: "board PubLanding v36 · owner 2026-11-01" }],
  "landing.faq.start.q": ["What do I need to start?", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.start.a": ["A website and about {minutes} minutes. After you pay, copy one line to connect it, or log in with WordPress.", { slots: { minutes: "text" }, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.german.q": ["Does it work in German?", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.german.a": [
    "Yes. Sites in {germanCountries} are checked and written in German. Sites in {englishCountries}, and everywhere else, get English.",
    { slots: { germanCountries: "text", englishCountries: "text" }, fixedBy: "board Landing · issue 1689" },
  ],
  "landing.faq.trial.q": ["Why is there no free trial?", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.faq.trial.a": ["The scan and your first page are free, so you see the work first. Then it’s one plan at {price} a month.", { slots: { price: "text" }, fixedBy: "board Landing · issue 1596" }],
  /** The landing's short answers; How it works and Pricing keep the full ones above. */
  "landing.faq.approve.short": ["No. Each page goes live by itself {hours} hours after it is written. You can edit or stop it first.", { slots: { hours: "text" }, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.faq.results.short": ["Your pages go live in week 1. Each Monday email shows where they sit on Google and whether AI links to them.", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.faq.stop.short": ["Cancel any time in Settings; you’re not charged again. Your export of every page stays available.", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.faq.german.short": ["Yes, sites in {germanCountries} are checked and written in German. Everywhere else gets English.", { slots: { germanCountries: "text" }, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.faq.trial.short": ["The scan and your first page are free, so you see the work first.", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.faq.more": ["See all questions", { slots: {}, fixedBy: "board PubLanding · issue 1727 · drafted" }],
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
  "quiet.refused.head.domain-day-limit": ["No more scans of this site today", { slots: {}, fixedBy: "issue 936" }],
  "quiet.refused.head.scan-running": ["A scan is already running", { slots: {}, fixedBy: "issue 936" }],
  "quiet.refused.head.stopped": ["Free scanning is paused", { slots: {}, fixedBy: "issue 936" }],
  "quiet.cooldown.head": ["We couldn’t finish scanning this site", { slots: {}, fixedBy: "issue 936" }],
  "quiet.removed.head": ["This report was removed", { slots: {}, fixedBy: "issue 936" }],
  "control.scan-another": ["Scan a different site", { slots: {}, fixedBy: "issue 936" }],
  "control.example-report": ["Read an example report", { slots: {}, fixedBy: "issue 936" }],
  "control.back-to-start": ["Back to the start", { slots: {}, fixedBy: "issue 936" }],

  /* ── The free-scans gallery, `/scans`, and the landing's strip (#1069) ── */
  // SPEC §2 2026-09-24 (#1058, #1059). The words of board `PubScans`; the
  // rest drafted in the registry's voice for the owner to correct.
  "gallery.eyebrow": ["Free scans · live", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.heading": ["Every free scan, in the open.", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.subline": [
    "{count} free reports, each at a lasting public link. See how businesses like yours show up on Google and AI.",
    { slots: { count: "text" }, fixedBy: "board PubScans · issue 1732" },
  ],
  "gallery.next.assurance": ["free · no account · under a minute · listed here when it’s done", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.strip.title": ["The {n} newest, by Visibility Score", { slots: { n: "text" }, fixedBy: "board PubScans · issue 1732" }],
  "gallery.strip.label": ["Scores of the {n} newest reports", { slots: { n: "text" }, fixedBy: "board PubScans · issue 1732" }],
  "gallery.strip.caption": ["Visibility Score: one number for how easy a business is to find, out of 100.", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.strip.unscored.one": ["One of the {n}, {domain}, is not scored.", { slots: { n: "text", domain: "text" }, fixedBy: "board PubScans · issue 1732" }],
  "gallery.strip.unscored.many": ["{count} of the {n} are not scored.", { slots: { count: "text", n: "text" }, fixedBy: "board PubScans · issue 1732 · drafted" }],
  "gallery.list.heading": ["Free reports", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.search.label": ["Search by company or domain", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.filter.label": ["Kind of business", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.filter.all": ["All", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  // One word per kind of business (`src/lib/market/kinds.ts`).
  "gallery.kind.local-service": ["Local services", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.kind.shop": ["Shops", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.kind.hospitality": ["Restaurants & venues", { slots: {}, fixedBy: "board PubScans v36 · owner 2026-11-01" }],
  "gallery.kind.professional-services": ["Agencies & firms", { slots: {}, fixedBy: "board PubScans v36 · owner 2026-11-01" }],
  "gallery.kind.software": ["Software", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.kind.creator": ["Creators & courses", { slots: {}, fixedBy: "board PubScans v36 · owner 2026-11-01" }],
  "gallery.showing": ["Showing {shown} of {total} reports", { slots: { shown: "text", total: "text" }, fixedBy: "issue 1069 · R12-3" }],
  "gallery.sort.label": ["Sort", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.sort.newest": ["Newest first", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.sort.highest": ["Highest score", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.sort.lowest": ["Lowest score", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.sort.az": ["A–Z", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.card.view": ["View report", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.card.no-logo": ["no logo found", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.card.score": ["{score} of {max}", { slots: { score: "text", max: "text" }, fixedBy: "board PubScans · issue 1732" }],
  "gallery.card.no-score": ["Not scored", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.more": ["Show more reports", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.removal": [
    "Own a site listed here and want its report taken down? Write to {address}.",
    { slots: { address: "text" }, fixedBy: "issue 1069 · R12-3" },
  ],
  "gallery.empty.heading": ["No free scan matches that yet.", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.empty.body": ["Scan it now. It takes under a minute, then it shows here.", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.empty.cta": ["Scan this site", { slots: {}, fixedBy: "issue 1069 · R12-3" }],
  "gallery.inside.eyebrow": ["Inside a report", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.inside.heading": ["What every free report shows", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.inside.lead": ["Every report answers the same four questions. Compare one like yours with your own.", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.inside.rivals": ["On Google’s first page instead", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.inside.1.title": ["Visibility Score", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.inside.1.line": ["One number for how easy you are to find.", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.inside.2.title": ["Who gets your buyers", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.inside.2.line": ["The businesses Google and AI pick instead of you.", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.inside.3.title": ["AI answers", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.inside.3.line": ["Whether AI answers mention or link you.", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.inside.4.title": ["Pages you’re missing", { slots: {}, fixedBy: "board PubScans · issue 1732" }],
  "gallery.inside.4.line": ["Questions buyers ask that no page of yours answers.", { slots: {}, fixedBy: "board PubScans · issue 1732" }],

  // SPEC §6, owner D66 (issue 1311): the one line a report owes its reader
  // where the site named a country or a language that is not measured yet.
  // Drafted (#759).
  "report.locale.fell-back": [
    "Searched on Google in {country}, in {language}. We don’t scan {unmeasured} yet.",
    { slots: { country: "text", language: "text", unmeasured: "text" }, fixedBy: "SPEC §6 · D66 · issue 1311" },
  ],
  // A country or language on the list is never called unmeasured: the line
  // names the pair the site read as and what ReachKit measures instead.
  // Drafted (#759).
  "report.locale.pair-fell-back": [
    "Searched on Google in {country}, in {language}. Your site is in {readLanguage}, and we scan {readCountry} in {ownLanguage}.",
    { slots: { country: "text", language: "text", readLanguage: "text", readCountry: "text", ownLanguage: "text" }, fixedBy: "SPEC §6 · D66 · issue 1689" },
  ],
  "report.locale.country-read-as": [
    "Searched in {country}, in {language}, because your site is in {readLanguage}. Scan again to see {readCountry} in {ownLanguage}.",
    { slots: { country: "text", language: "text", readLanguage: "text", readCountry: "text", ownLanguage: "text" }, fixedBy: "SPEC §6 · D66 · issue 1689" },
  ],
  // A site that declares other markets: one is measured, chosen at setup.
  // Drafted (#759).
  "report.locale.also-serves": [
    "Your site serves {n} more markets. You can choose another at setup.",
    { slots: { n: "text" }, fixedBy: "SPEC §6 · D66 · issue 1689" },
  ],
  "report.locale.also-serves.one": [
    "Your site serves one more market. You can choose it at setup.",
    { slots: {}, fixedBy: "SPEC §6 · D66 · issue 1689" },
  ],
  "app.locale.also-serves": [
    "Your site also serves {n} other markets; we measure one. Change it in Settings.",
    { slots: { n: "text" }, fixedBy: "SPEC §6 · D66 · issue 1689" },
  ],
  "app.locale.also-serves.one": [
    "Your site also serves one other market; we measure one. Change it in Settings.",
    { slots: {}, fixedBy: "SPEC §6 · D66 · issue 1689" },
  ],
  // The measurement line of a report whose site could not be read, measured
  // in D66's default, and what its Google listing reads as. Drafted (#759).
  "report.locale.guessed": [
    "We couldn’t read your site, so we searched Google in {country}, in {language}.",
    { slots: { country: "text", language: "text" }, fixedBy: "SPEC §6 · D66 · issue 1797" },
  ],
  "report.locale.listing-reads": ["Your Google listing says {country}.", { slots: { country: "text" }, fixedBy: "SPEC §6 · D66 · issue 1797" }],
  "report.locale.site.pair": ["{country} in {language}", { slots: { country: "text", language: "text" }, fixedBy: "SPEC §6 · D66 · issue 1311" }],
  // The measurement line of a report measured anywhere but in US Google in
  // English (D66). Drafted (#759).
  "report.measurement.in": ["Searched on Google in {country}, in {language}.", { slots: { country: "text", language: "text" }, fixedBy: "SPEC §6 · D66 · issue 1311" }],
  // The measurement line of a report measured in the town its site serves
  // (D67, owner ruling 2026-10-15). The search vendor gives volumes by
  // country only, so the line says so (issue 1480). Drafted (#759).
  "report.measurement.place": [
    "Searched on Google near {place}, in {language}. Search counts are for all of {country}.",
    { slots: { place: "text", language: "text", country: "text" }, fixedBy: "SPEC §6 · D67 · issue 1480" },
  ],

  // SPEC §2, owner A3 and E1 (2026-10-19): the report lists every page it
  // found missing; the count is said once, in the headline (owner R12).
  "report.offer.free-path": ["Not ready? Get your first page free ↓", { slots: {}, fixedBy: "owner A3 2026-10-19 · issue 1599 · drafted" }],
  "report.missing.volume": ["searched {volume} times a month", { slots: { volume: "text" }, fixedBy: "owner E1 2026-10-19 · issue 1599 · drafted" }],
  "report.missing.holder": ["answered today by {holder}", { slots: { holder: "text" }, fixedBy: "owner E1 2026-10-19 · issue 1599 · drafted" }],
  "report.missing.all": ["All {count}, nothing hidden.", { slots: { count: "text" }, fixedBy: "board PubReport · owner Q3 2026-10-20 · issue 1599" }],
  "report.missing.all.six": ["All 6, nothing hidden. Page 6 shows its search.", { slots: {}, fixedBy: "board PubReport · 2026-10-24 E16 · issue 1982" }],
  "report.missing.all.rest": [
    "All {count}, nothing hidden. Pages 6 to {count} show their search.",
    { slots: { count: "text" }, fixedBy: "board PubReport · 2026-10-24 E16 · issue 1982" },
  ],
  "report.missing.page": ["page {n}", { slots: { n: "text" }, fixedBy: "board PubReport · 2026-10-24 E16 · issue 1982" }],
  "report.missing.free": ["free · written for you", { slots: {}, fixedBy: "board PubReport · issue 1968" }],
  "report.missing.free.read": ["Read it free ↓", { slots: {}, fixedBy: "board PubReport · issue 1968" }],
  "report.rest.eyebrow": ["More in your report", { slots: {}, fixedBy: "board PubReport · issue 1724" }],
  "report.missing.title": ["Pages you’re missing", { slots: {}, fixedBy: "board PubReport · owner R12 2026-10-31" }],
  "report.missing.lead": [
    "Each one answers a question your buyers ask.",
    { slots: {}, fixedBy: "board PubReport · issue 1599 · issue 2193" },
  ],
  // Board PubReport, the report's head (canvas V22): what we read the site
  // as, the headline of who gets the buyers, and the score's parts. Drafted in the board's words; the owner corrects them.
  "report.read.as.title": ["We read you as", { slots: {}, fixedBy: "board PubReport · issue 1723" }],
  "report.read.as.what": ["{category} · {kind}", { slots: { category: "text", kind: "text" }, fixedBy: "board PubReport · issue 1723" }],
  "report.read.as.locale": ["{language}, {country}", { slots: { language: "text", country: "text" }, fixedBy: "board PubReport · issue 1723" }],
  "report.read.as.kind.local-service": ["local service", { slots: {}, fixedBy: "board PubReport · issue 1723" }],
  "report.read.as.kind.shop": ["shop", { slots: {}, fixedBy: "board PubReport · issue 1723 · drafted" }],
  "report.read.as.kind.hospitality": ["restaurant, café, bar or hotel", { slots: {}, fixedBy: "board PubReport · issue 1723 · drafted" }],
  "report.read.as.kind.professional-services": ["firm or agency", { slots: {}, fixedBy: "board PubReport · issue 1723 · drafted" }],
  "report.read.as.kind.software": ["software", { slots: {}, fixedBy: "board PubReport · issue 1723 · drafted" }],
  "report.read.as.kind.creator": ["courses, teaching or writing", { slots: {}, fixedBy: "board PubReport · issue 1723 · drafted" }],
  "verdict.estimate.range": ["likely {low} to {high}", { slots: { low: "text", high: "text" }, fixedBy: "board PubReport · issue 1723" }],
  "verdict.score.split": ["How this score is split", { slots: {}, fixedBy: "board PubReport · owner R12 2026-10-31" }],
  "verdict.score.parts": ["Four parts, combined into one score. They are not added up.", { slots: {}, fixedBy: "board PubReport · owner O6 2026-10-31" }],
  "verdict.score.parts.three": ["Three parts, combined into one score. They are not added up.", { slots: {}, fixedBy: "board PubReport · owner O6 2026-10-31" }],
  "report.top.title": ["Buyers are sent to {holder}", { slots: { holder: "text" }, fixedBy: "board PubReport · owner R12 2026-10-31" }],
  "report.top.title.you-lead": ["Buyers find you most often", { slots: {}, fixedBy: "board PubReport · owner R12 2026-10-31" }],
  "report.top.title.none": ["Buyers can’t find you yet", { slots: {}, fixedBy: "board PubReport · owner R12 2026-10-31" }],
  "report.top.line": ["You came up {n} times in {m} Google results and AI answers.", { slots: { n: "text", m: "text" }, fixedBy: "board PubReport · owner R12 2026-10-31" }],
  "report.top.line.one": ["You came up once in {m} Google results and AI answers.", { slots: { m: "text" }, fixedBy: "board PubReport · owner R12 2026-10-31 · drafted" }],
  "report.top.offer": ["We found {count} pages your site is missing. The first one is free.", { slots: { count: "text" }, fixedBy: "board PubReport · owner R12 2026-10-31" }],
  "report.top.offer.one": ["We found 1 page your site is missing. It’s yours free.", { slots: {}, fixedBy: "board PubReport · owner R12 2026-10-31" }],
  "report.top.offer.no-free": ["We found {count} pages your site is missing.", { slots: { count: "text" }, fixedBy: "board PubReport · owner R12 2026-10-31" }],
  "report.top.offer.no-free.one": ["We found 1 page your site is missing.", { slots: {}, fixedBy: "board PubReport · owner R12 2026-10-31 · drafted" }],
  "report.independent": ["An independent report by ReachKit. {company} has not endorsed it.", { slots: { company: "text" }, fixedBy: "board PubReport · owner O6 2026-10-31" }],
  "report.buyers.title": ["Who gets your buyers", { slots: {}, fixedBy: "board PubReport · owner R12 2026-10-31" }],
  "report.you": ["You", { slots: {}, fixedBy: "board PubReport · issue 1723" }],
  "report.ai.waffle": ["Who the answers mention. Each square is one answer.", { slots: {}, fixedBy: "board PubReport · issue 1723" }],
  "report.ai.quote": ["One answer, for {search}", { slots: { search: "text" }, fixedBy: "board PubReport · issue 1723" }],
  "report.ai.asked": ["The {total} searches we asked", { slots: { total: "text" }, fixedBy: "board PubReport · issue 1723" }],
  "report.google.waffle": ["Who is on Google’s first page. Each square is one search.", { slots: {}, fixedBy: "board PubReport · issue 1723" }],
  "report.google.most": ["Most searched: {search}, about {volume} times a month. First on Google: {holder}.", { slots: { search: "text", volume: "text", holder: "text" }, fixedBy: "board PubReport · issue 1723" }],
  "report.google.most.none": ["Most searched: {search}, about {volume} times a month.", { slots: { search: "text", volume: "text" }, fixedBy: "board PubReport · issue 1723 · drafted" }],
}) satisfies CopyPartition;
