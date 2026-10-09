// src/lib/presentation/copy/keys/calendar.ts — BP-020 decision 5, WO-041
//
// The calendar's sentences. Three keys seeded (WO-041 step 3): the
// no-presence-yet line for a date carrying no page, and the two cause
// lines. Seeded with the empty value, owner-owed (constitution §1), and
// written since #460. The block that owns the calendar fills every other
// sentence this surface needs.
//
// 2026-09-05: issue #9 (BUILD §4.4) adds `calendar.head` — the one written
// line this screen states inside the app shell until its own content lands
// (issue #16, §4.6). Owner-owed and empty at first — it is a customer-
// visible sentence (constitution §1) — until issue #16 filled it below.
//
// 2026-09-05, separately: issue #16 (BUILD §4.6) fills the calendar itself.
// Twenty keys carry a value and **every one of them is a transcription of a
// word or a sentence `BUILD.md` §4.6 itself prints**, on the same footing as
// the thirteen band words in `bands.ts` and the five `shell.*` words issue
// #9 filled (constitution rule 1.2: copying a recorded owner ruling is not
// inventing one). Nothing here is composed:
//
//   `calendar.head`                — §4.6 `Head: "One page a day. Every day."`,
//                                    the sentence the section prints in quotes.
//                                    Superseded: the owner replaced it on
//                                    2026-09-11 (#516) — see the note below.
//   `calendar.stage.*`             — §4.6's filter cards, named there:
//                                    "All/Live/Your review/Scheduled/Planned/
//                                    Needs you" (and REQ-043 c2's same five).
//   `calendar.action.*`            — §4.6's own action words: "review →
//                                    *Read the full page* + Move/Veto; live →
//                                    *View live page*; needs-you →
//                                    *Reconnect*; planned → Move/Skip".
//   `calendar.why.*`               — §4.6's `"Why this page" (search / asked /
//                                    answered-today-by / you / done-when)`.
//                                    The five row labels are those five
//                                    handles with their hyphens read as the
//                                    spaces they stand for and a leading
//                                    capital — the same handle-versus-word
//                                    spelling BP-019 decision 6 blessed for
//                                    'not-yet' → "Not yet". No word is added
//                                    and none is dropped.
//   `calendar.footnote.planned`    — §4.6's footnote, verbatim: "planned pages
//                                    are written the evening before from
//                                    Monday's measurements", sentence-cased.
//
// Six were owner-owed and empty until #460, because no sentence existed to
// transcribe:
// the three empty-date causes REQ-043 criterion 4 names but §4.6 does not
// word, the provenance line criterion 10 asks for, the veto-deadline line,
// and the supply half of the footnote — §4.6 states the supply *rule* to the
// builder ("the empty state says so") and never says it to the customer.
// Listed in issue #16's PR under "Owner owes".
//
// 2026-09-06, issue #20 (REQ-091 c2): these three keys are the ones the
// arbiter `src/lib/presentation/place/account.ts` resolves — the baseline
// cold-start line for a date carrying no page, and the two cause lines. They
// were registered **owner-owed and empty**, deliberately, so `account()`
// threw naming the key rather than handing a place a blank; #246 moved them
// to the marker, and #460 wrote them.
// 2026-09-06, separately again: issue #116 (REQ-092 c5) adds one —
// `calendar.empty.page-held`, the account a date carries when a page was
// planned for it and did not go live on it because a ReachKit stop held it.
// Registered owner-owed and **empty**, like the three empty-date causes
// beside it and for the same reason, and written since #460. It is a
// seventh cause, not a rewording of
// `calendar.empty.page-cannot-go-live` — that line says a page can no longer
// go live, and a held page still publishes.
//
// 2026-09-10, issue #460: every sentence this partition still owed is now
// written — the owner approved the drafted set ("copy proposal
// approved", proposal sheet
// https://claude.ai/code/artifact/546f45a0-a996-4d25-b85e-fb03fda7b102)
// and the strings land here byte for byte. The values that approval names
// are the owner's; nothing here is composed.
//
// 2026-09-11, issue #516: `calendar.head` is rewritten. It was the last
// sentence in the product that promised a page every day, and the owner's
// Autopilot brief (DECISIONS 2026-09-10) rules that promise out: a day is
// filled only by an opportunity that passes readiness, so the grid is not
// guaranteed full and an empty day is competence, not an outage. The owner
// approved the replacement string (DECISIONS 2026-09-11), and it lands here
// byte for byte. BUILD §4.6's and UI-SPEC S14's printed headline are the
// amended in the same change.
import type { CopyPartition } from "../registry.ts";

export const CALENDAR_COPY = Object.freeze({
  "place.calendar.date.page": [
    "No page on this date yet. Dates fill in as your measurement finds pages worth writing.",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-043 c5" },
  ],
  "cause.unrecognised": [
    "Nothing is shown here yet, for a reason on our side we haven’t named. It isn’t that your market had nothing to offer.",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-043 c4" },
  ],
  // 2026-09-08, issue #354. The approved screen set (S14) draws this line
  // on the one grid cell that has it, and ruling 11a makes its unbracketed
  // strings approved copy: "nothing worth publishing". Filled from the set,
  // not written here (constitution rule 1.2 — copying a recorded owner
  // ruling is not inventing one).
  //
  // It is the CELL's line. The panel states the whole account, under
  // `calendar.empty.supply-exhausted` below — DECISIONS 2026-09-07 (#209)
  // gives the cell the first line and the panel all of it, and S14/S15 draw
  // exactly that split for supply.
  "cause.supply-exhausted": [
    "nothing worth publishing",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-043 c3" },
  ],
  // 2026-09-11 (#516): the owner replaces §4.6's headline. "One page a day.
  // Every day." promised a filled grid, which the Autopilot brief rules out
  // (DECISIONS 2026-09-10 §1.9 / §8) — a day is filled only by an
  // opportunity that passes readiness, so the head states the rule instead.
  "calendar.head": ["Pages go live when one is ready — at most one a day.", { slots: {}, fixedBy: "BUILD §4.6" }],

  // §4.6's stage filter cards. `all` is a filter, not a stage.
  "calendar.stage.all": ["All", { slots: {}, fixedBy: "BUILD §4.6" }],
  "calendar.stage.live": ["Live", { slots: {}, fixedBy: "REQ-043 c2" }],
  "calendar.stage.your-review": ["Ready", { slots: {}, fixedBy: "REQ-043 c2" }],
  "calendar.stage.scheduled": ["Scheduled", { slots: {}, fixedBy: "REQ-043 c2" }],
  "calendar.stage.planned": ["Planned", { slots: {}, fixedBy: "REQ-043 c2" }],
  "calendar.stage.needs-you": ["Needs you", { slots: {}, fixedBy: "REQ-043 c2" }],

  // §4.6's stage-appropriate actions.
  "calendar.action.read-full-page": ["Read the full page", { slots: {}, fixedBy: "BUILD §4.6" }],
  "calendar.action.view-live-page": ["View live page", { slots: {}, fixedBy: "BUILD §4.6" }],
  // Issue 882 (owner, 2026-09-18): every written page is readable from the
  // calendar, not only the one in review. The review stage keeps §4.6's own
  // word above, which asks for a judgement; every other stage says plainly
  // what the way in opens. Drafted under issue 759's ruling.
  "calendar.action.read-page": ["Read the page as written", { slots: {}, fixedBy: "issue 882" }],
  // The approved S15 names the destination the control reconnects: a page
  // that stalled because WordPress refused the connection is reconnected to
  // WordPress, and "Reconnect" alone left the customer to guess which of
  // their settings it meant (ruling 11a, issue #354).
  "calendar.action.reconnect": ["Reconnect WordPress", { slots: {}, fixedBy: "BUILD §4.6" }],
  // Issue 880: a destination that carries no credential has nothing to
  // reconnect, so a page waiting on it opens where the founder fixes it
  // instead — and the WordPress sentence above is never shown to a hosted
  // site. Drafted under issue 759's ruling.
  "calendar.action.check-destination": ["Check where your pages publish", { slots: {}, fixedBy: "issue 880" }],
  "calendar.action.skip": ["Skip", { slots: {}, fixedBy: "BUILD §4.6" }],
  // SPEC §7 (2026-09-20, #908, issue #914) — "Screens and mail say *Stop
  // this page*. 'Veto' remains the internal word and the name of the
  // mechanism in this file." The key, the command, the column and the
  // route are all still `veto`; only what the customer reads changed.
  // The short form, and it is short because the canvas draws this control
  // in the day panel's two-column secondary row beside *Skip* and *Write
  // it again* — the full sentence belongs on the page itself, where the
  // draft screen says it in full.
  "calendar.action.veto": ["Stop it", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  // 2026-09-07, issue #143. The customer's own restart — §9 opens
  // `needs_attention → generating` for them and for no one else, and no
  // surface offered it.
  //
  // **Not a spec word.** §4.6's control list for needs-you is *Reconnect*
  // and nothing more, so unlike the five above this key is not transcribed
  // from the spec — its word is the owner's.
  //
  // What it has to say is what happens: ReachKit writes the page again,
  // from the same opportunity, and it returns to the queue as a fresh
  // draft. What it must not say is that anything is being retried
  // automatically — nothing is, which is the whole reason the control
  // exists.
  "calendar.action.regenerate": ["Write it again", { slots: {}, fixedBy: "BUILD §9 · REQ-043 c9" }],

  // SPEC §7 (2026-09-20, #908, issue #913) — "every action answers". Each
  // of the three writes the day panel offers says, in words, what became
  // of the page; a write the machine refused says that nothing changed.
  // The sentences are drafts in the registry's voice under issue 759's
  // ruling, and the owner may correct them.
  //
  // They are stated as facts about the page and never as progress
  // ("saving…"): the panel speaks only after the machine has answered, so
  // there is no moment at which one of these is a guess.
  "calendar.answer.veto": ["Stopped. This page won’t go live.", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  "calendar.answer.skip": ["Skipped. We won’t write this one.", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  // Issue 1196: "about two minutes" was not true — a page written again is
  // rewritten by the hourly draft tick (`src/jobs/draft-generate.ts`).
  "calendar.answer.regenerate": ["We’re writing it again. It’s ready within the hour, and its page updates itself.", { slots: {}, fixedBy: "SPEC §7 2026-09-20 · issue 1196" }],
  // One refusal sentence for all three. What a refused write has in common
  // is the only thing the customer needs: nothing moved. The machine's own
  // word for why (`not_a_transition`, a guard name) is a developer's
  // signal and is never shown.
  "calendar.answer.refused": ["That didn’t go through. The page is as it was.", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],

  // §4.6's "Why this page" block and its five rows.
  "calendar.why.title": ["Why this page", { slots: {}, fixedBy: "REQ-043 c8" }],
  // SPEC §7 (2026-09-20, #908, issue 930): the day panel is label-and-value
  // rows, and the labels are the founder's words for the facts rather than
  // the measurement's own names. Four of the six below were reworded for
  // that pass; every one of them is still the same fact, stated once and
  // read by both screens (`calendar/TargetRows.tsx`).
  "calendar.why.search": ["Going after", { slots: {}, fixedBy: "issue 930" }],
  "calendar.why.asked": ["Asked", { slots: {}, fixedBy: "REQ-043 c8" }],
  "calendar.why.answered-today-by": ["Best rival", { slots: {}, fixedBy: "issue 930" }],
  // The rival and where it stands, as one value: a domain alone does not
  // say it is ahead of you.
  "calendar.why.answered-today-by.value": [
    "{domain} · #{position}",
    { slots: { domain: "text", position: "text" }, fixedBy: "issue 930" },
  ],
  "calendar.why.you": ["You today", { slots: {}, fixedBy: "issue 930" }],
  // §6.6's cold-start law: a measured zero is a measurement — the site
  // holds no place — and it is said in words rather than as a 0, which
  // would read as a position. An *unmeasured* place still renders the dash
  // and its own line, and never this.
  "calendar.why.not-ranking": ["Not ranking", { slots: {}, fixedBy: "issue 930" }],
  "calendar.why.done-when": ["Done when", { slots: {}, fixedBy: "REQ-043 c8" }],

  // Issue 867 (owner, 2026-09-17): "I don't believe we are currently showing
  // the users the SEO or GEO metrics their content is currently optimizing
  // for." The rows that state them, on the day panel and — the same labels,
  // one place the product words them — in the draft screen's "What this page
  // is for" block. Plain words for both dimensions, never "SEO" or "GEO" as
  // jargon (SPEC §4, 2026-09-17). Drafted under issue 759's ruling; the
  // owner corrects the wording.
  "calendar.why.volume": ["Each month", { slots: {}, fixedBy: "issue 930" }],
  // The demand as a value, with its unit in words: a bare count in a row
  // labelled "Each month" does not say what is counted.
  "calendar.why.volume.value": [
    "{count} searches",
    { slots: { count: "text" }, fixedBy: "issue 930" },
  ],
  "calendar.why.difficulty": ["Difficulty", { slots: {}, fixedBy: "issue 867" }],
  // The difficulty against the ceiling this site is judged by (§6, issue
  // 858) — a number is not a verdict until it is beside the bar it is
  // measured against.
  "calendar.why.difficulty.of-ceiling": [
    "{difficulty} · your limit is {ceiling}",
    { slots: { difficulty: "text", ceiling: "text" }, fixedBy: "issue 930" },
  ],
  "calendar.why.band": ["Winnability", { slots: {}, fixedBy: "issue 867" }],
  // Where the AI engines stood on this question when the pass measured it.
  "calendar.why.engines": ["AI Visibility", { slots: {}, fixedBy: "issue 867" }],
  // Issue 930: each standing is a chip beside its engine rather than half
  // of a composed phrase, so each one is now a statement of its own and is
  // capitalised as one.
  "calendar.why.engine.names-you": ["Names you", { slots: {}, fixedBy: "issue 930" }],
  "calendar.why.engine.names-others": ["Names rivals", { slots: {}, fixedBy: "issue 930" }],
  "calendar.why.engine.no-answer": ["No answer", { slots: {}, fixedBy: "issue 930" }],
  // One engine's standing, as one phrase: "ChatGPT — names others".
  "calendar.why.engine.line": [
    "{engine} — {standing}",
    { slots: { engine: "text", standing: "text" }, fixedBy: "issue 867" },
  ],

  // §4.6's footnote. The first half is the section's own sentence; the
  // second is the supply rule stated to the builder, and the customer's
  // wording of it is the owner's.
  // Both halves are the approved S14's own footnote, verbatim (ruling
  // 11a): "Planned pages are written the evening before, from Monday's
  // measurements. When opportunities run out, future days are empty — the
  // calendar is never padded." The supply half was owner-owed and empty
  // until the set worded it; the planned half gains the set's comma.
  // Issue 1337: a page is no longer written at one evening hour. It is
  // written a full time-to-stop before its day's publish time, so the
  // planned half is drafted again for the owner to correct.
  "calendar.footnote.planned": [
    "Planned pages are written ahead of their day, leaving your time to stop them, from Monday's measurements.",
    { slots: {}, fixedBy: "BUILD §4.6" },
  ],
  "calendar.footnote.supply": [
    "When opportunities run out, future days are empty — the plan is never padded.",
    { slots: {}, fixedBy: "BUILD §4.6" },
  ],

  // Issue 857 (owner, 2026-09-17): the plan reaches only the day before the
  // next weekly pass. The one quiet marker on the first date after it —
  // the owner's own words. Drafted under issue 759's ruling.
  "calendar.horizon.marker": ["Planned after Monday’s scan", { slots: {}, fixedBy: "issue 857" }],

  // REQ-043 criterion 4's remaining causes, and criterion 10's one
  // provenance line. Each is a written sentence no artifact states, so the
  // words are the owner's.
  "calendar.empty.instruction": ["This date holds a fix for you to make. Fixes are never written or automated — they’re yours to do.", { slots: {}, fixedBy: "REQ-043 c5" }],
  "calendar.empty.page-cannot-go-live": ["The page for this date was stopped or taken down, so it won’t go live. No page replaces it.", { slots: {}, fixedBy: "REQ-043 c4" }],
  // #754 (owner 2026-09-16): the one held line offered both causes when the
  // app knows which it is. Split into one line per setting — and a host
  // waiting for its CNAME points at the record Settings shows. Drafted and
  // shipped under the owner ruling of 2026-09-16 (#759).
  "calendar.empty.customer-change-holds-pages.publishing-off": ["Publishing is off, so this page is waiting. Turn it on in Settings and pages resume.", { slots: {}, fixedBy: "REQ-043 c4" }],
  "calendar.empty.customer-change-holds-pages.destination-pending-dns": ["Your domain isn’t connected yet, so this page is waiting. Check the connection in Settings — once the DNS record is picked up, pages resume.", { slots: {}, fixedBy: "REQ-043 c4" }],
  "calendar.empty.customer-change-holds-pages.destination-disconnected": ["There’s no connected place to publish to, so this page is waiting. Connect one in Settings and pages resume.", { slots: {}, fixedBy: "REQ-043 c4" }],
  "calendar.empty.page-held": ["The page for this date was held while ReachKit’s own work was stopped. It still publishes, in turn, once work resumes.", { slots: {}, fixedBy: "REQ-092 c5" }],
  // The day panel's whole account of an exhausted supply — S15's `empty`
  // arm, verbatim (ruling 11a, issue #354). Its cell states the first line
  // alone, from `cause.supply-exhausted` above (#209).
  "calendar.empty.supply-exhausted": [
    "Nothing worth publishing on this date — the supply of opportunities in your market is used up until Monday's re-measure finds more.",
    { slots: {}, fixedBy: "REQ-043 c3" },
  ],
  // #765 (owner ruling 2026-09-16): a zero supply over a market that was
  // never measured — the current scan derived no questions, or the site has
  // never held an opportunity — is not "used up". Its own line, in the cell
  // and the panel alike. Drafted and shipped under #759's ruling.
  "calendar.empty.supply-unmeasured": [
    "We couldn’t find enough searches for your market yet. Pick a broader category and we’ll measure again right away.",
    { slots: {}, fixedBy: "REQ-043 c3" },
  ],
  // S15's `empty` arm leads with a chip carrying this word, so a date with
  // no page is named rather than left as a bare numeral. Approved (11a).
  "calendar.empty.day-badge": ["Empty day", { slots: {}, fixedBy: "REQ-043 c11" }],
  // REQ-071 c11 (issue #204). A market change holds generation until the
  // pass that adopts it, so the day names which change is holding pages and
  // the date they resume — both read from `generationHold()`, which has
  // already chosen one reason where two answers changed.
  "calendar.empty.change-holds-pages": [
    "No new page until the change to {change} takes effect. Pages resume on {date}.",
    { slots: { date: "date", change: "text" }, fixedBy: "REQ-071 c11" },
  ],
  // Issue 866: a category being replaced is measured again at once, so the
  // held day names the measurement it waits on rather than a Monday. A
  // domain change keeps the dated line above — that one does land at the
  // weekly pass. Drafted under issue 759's ruling.
  "calendar.empty.change-holds-pages.category": [
    "No new page until your market has been measured again with your new category. Pages resume as soon as that measurement finishes.",
    { slots: {}, fixedBy: "issue 866" },
  ],
  // REQ-043 c10's one line. Every one of S15's five arms ends on the same
  // measured tail — "measured Mon 8 Sep" — so that half is approved copy
  // and is filled here (11a). The per-arm prefixes the set draws beside it
  // ("written {ts}", "verified live {ts}", "last good delivery {date}")
  // are not: two of the three name a fact the month model does not carry,
  // and inventing a timestamp to print is the one thing this registry
  // exists to prevent. Named in #354's PR as engine-owed.
  "calendar.provenance.measured": [
    "measured {date}",
    { slots: { date: "date" }, fixedBy: "REQ-043 c10" },
  ],
  // SPEC §7 (2026-09-20, #914): the customer's word for the interval.
  "calendar.status.veto-deadline": ["It goes live on its own. You can edit or stop it until {at}.", { slots: { at: "date" }, fixedBy: "issue 1337" }],

  // §7's one statement of supply, as §4.6's calendar makes it: the three
  // arms of `supplyNotice`, in the engine's own precedence (exhausted >
  // short > arrival shortfall). Three keys and not one, because they are
  // three different claims — supply is gone / supply is running out /
  // this month stops before the month does — and a customer reads exactly
  // one of them. The words are the owner's: §4.6 states the supply *rule*
  // to the builder and never words it for the customer, and
  // `overview.supply.*` is the
  // same three claims on a different screen, so neither is the other's
  // string. `days` counts days of pages, so it is a text slot carrying a
  // numeral, exactly as `overview.supply.*` declares it.
  "calendar.supply.exhausted": ["Nothing worth publishing is left in your market, since {since}. Monday’s re-measure looks for more.", { slots: { since: "date" }, fixedBy: "BUILD §4.6" }],
  // The same claim where the moment it ran out cannot be read (owner, PR
  // #961, 2026-09-21). `SupplyNotice`'s `since` is `Date | null` by
  // declaration, so this is a state a real site reaches and not only the
  // fixture's — and the sentence the screen used to render for it filled
  // the slot with an empty string: "… in your market, since . Monday’s
  // re-measure…". A variant without the clause, never a blank: a date the
  // product does not have is a date it does not mention.
  "calendar.supply.exhausted.undated": [
    "Nothing worth publishing is left in your market. Monday’s re-measure looks for more.",
    { slots: {}, fixedBy: "owner, PR 961" },
  ],
  // issue 784: the same statement over a market that was never measured (issue 765)
  // — there was nothing to use up. Drafted under issue 759's ruling.
  "calendar.supply.unmeasured": ["We couldn’t find enough searches in your market to plan pages yet. Pick a broader category and we’ll measure your market again right away.", { slots: {}, fixedBy: "issue 784" }],
  // issue 855: the same zero while the market is still being measured — a pass
  // stopped on a ceiling, measured again. Drafted under issue 759's ruling.
  // Issue 1071 (board R12-5-Plan): the unmeasured notice carries its two
  // actions inline — the first broader category, and the founder's own
  // words. Drafted under issue 759's ruling; the owner corrects the wording.
  "calendar.supply.try": ["Try “{category}”", { slots: { category: "text" }, fixedBy: "issue 1071" }],
  "calendar.supply.describe": ["Describe it yourself", { slots: {}, fixedBy: "issue 1071" }],
  // Issue 1071: the header's way back to the month and day it is now.
  "calendar.month.today": ["Today", { slots: {}, fixedBy: "issue 1071" }],
  "calendar.supply.measuring": ["Your market is still being measured, so no pages are planned yet. ReachKit measures it again automatically.", { slots: {}, fixedBy: "issue 855" }],
  // Issue 881 (owner's dogfood, 2026-09-18): the site holds targets and
  // every one of them is outsized for it — the day is empty for a reason
  // that is neither a used-up market nor an unmeasured one, and the line
  // says what changes it. Drafted under issue 759's ruling; the owner
  // corrects the wording.
  "calendar.supply.outsized": [
    "No page today: every search we've measured for your market is still too big for your site. Smaller ones come into reach as your site grows, and a new measurement can find them sooner.",
    { slots: {}, fixedBy: "issue 881" },
  ],
  "calendar.supply.short": ["Supply is running short. Pages left: {days}. Monday’s re-measure looks for more.", { slots: { days: "text" }, fixedBy: "BUILD §4.6" }],
  "calendar.supply.first-arrival": ["Your first pass found less than a month of pages — {days} so far. We look for more every Monday.", { slots: { days: "text" }, fixedBy: "BUILD §4.6" }],
  // Issue 1184 (drafted): why pages stall, as one line under the statement
  // of supply. `{rule}` is the writing rule's own name with its underscores
  // read as spaces.
  "calendar.supply.stalled": ["Pages written in the last 7 days: {written}. Stopped before review: {stopped}.", { slots: { written: "text", stopped: "text" }, fixedBy: "issue 1184 (drafted)" }],
  "calendar.supply.stalled.rule": [
    "Pages written in the last 7 days: {written}. Stopped before review: {stopped}. The writing rule that stopped most: {rule}.",
    { slots: { written: "text", stopped: "text", rule: "text" }, fixedBy: "issue 1184 (drafted)" },
  ],

  // §4.6's `done-when` row, from the acceptance test recorded when the
  // opportunity was created (§7: "top 20 for Q" / "named on question P" /
  // "gate passes"). Three forms, three keys: the test a page is judged
  // against is never rewritten, so the row must say which of the three it
  // is rather than a single line that fits none of them.
  "calendar.done-when.top20": ["you rank in the top 20 for “{query}”", { slots: { query: "text" }, fixedBy: "BUILD §7" }],
  // SPEC §4 2026-09-29 (D16, issue 1147): the page is credited only where
  // the answer cites the page itself. Drafted (#759).
  "calendar.done-when.named-on": ["an AI answer to “{question}” cites this page", { slots: { question: "text" }, fixedBy: "SPEC §4 2026-09-29 D16" }],
  "calendar.done-when.gate-cleared": ["the access check passes", { slots: {}, fixedBy: "BUILD §7" }],

  // ── The day card and the day panel (SPEC §7, 2026-09-20, #908; issue 930)
  //
  // "A day card holds the date and exactly one number …, the title cut to
  // two lines, and one stage word … A day with no page says why in at most
  // two words; the day panel carries the full reason."
  //
  // So every cause the calendar speaks now has **two** forms and not one:
  // the ≤2-word hint the card carries, and the whole account the panel
  // already carried. The pair is the same split DECISIONS 2026-09-07 (#209)
  // made for supply, applied to every cause — and the short form is never a
  // truncation of the long one, because two words cannot be a sentence cut
  // in half. Drafted under issue 759's ruling; the owner corrects them.
  "calendar.empty.short.instruction": ["Your fix", { slots: {}, fixedBy: "issue 930" }],
  "calendar.empty.short.page-cannot-go-live": ["Stopped", { slots: {}, fixedBy: "issue 930" }],
  "calendar.empty.short.change-holds-pages": ["On hold", { slots: {}, fixedBy: "issue 930" }],
  "calendar.empty.short.customer-change-holds-pages": ["Held back", { slots: {}, fixedBy: "issue 930" }],
  "calendar.empty.short.page-held": ["Held back", { slots: {}, fixedBy: "issue 930" }],
  // The two supply causes never reach a card — §7 (issue 857) states supply
  // once, at the top of the screen — but the map the card reads is total
  // over the causes, so a cause added to the union fails to compile rather
  // than drawing a blank word.
  "calendar.empty.short.supply-unmeasured": ["No market yet", { slots: {}, fixedBy: "issue 930" }],
  "calendar.empty.short.supply-exhausted": ["No page", { slots: {}, fixedBy: "issue 930" }],
  // ReachKit's own stop, where one is recorded for the day.
  "calendar.empty.short.reachkit-stopped": ["We stopped", { slots: {}, fixedBy: "issue 930" }],
  // A day the product cannot explain (SPEC §7, 2026-10-07, issue 1321): its
  // own two words and its own panel line, and neither says ReachKit
  // stopped. Drafted under issue 759's ruling; the owner corrects them.
  "calendar.empty.short.unexplained": ["No page", { slots: {}, fixedBy: "issue 1321" }],
  "calendar.empty.unexplained": ["No page is planned for this date yet.", { slots: {}, fixedBy: "issue 1321" }],
  // Issue 857's quiet marker, in the room a card has for it. The full line
  // (`calendar.horizon.marker`) is the panel's.
  "calendar.horizon.short": ["Planned Mon", { slots: {}, fixedBy: "issue 930" }],

  // The card's whole label, for a reader who never sees it. Three shapes,
  // because a card has three: a page, a date that says why it has none, and
  // a date with nothing to say at all. Composed from a key rather than
  // joined in the renderer, so the punctuation a screen reader pauses on is
  // the owner's.
  "calendar.card.aria.page": [
    "{date}. {stage}. {title}",
    { slots: { date: "text", stage: "text", title: "text" }, fixedBy: "issue 930" },
  ],
  "calendar.card.aria.empty": [
    "{date}. {reason}",
    { slots: { date: "text", reason: "text" }, fixedBy: "issue 930" },
  ],
  "calendar.card.aria.date": ["{date}", { slots: { date: "text" }, fixedBy: "issue 930" }],

  // What the page is: a new page, or an update of one the site already has
  // (SPEC §7, 2026-09-20 — "a mark for an update"). The card carries the
  // mark and this word names it; the panel says it in full.
  "calendar.card.update": ["Update", { slots: {}, fixedBy: "issue 930" }],
  "calendar.card.new-page": ["New page", { slots: {}, fixedBy: "issue 930" }],

  // The panel's two section heads, and the one control that closes it.
  "calendar.panel.search": ["Search", { slots: {}, fixedBy: "issue 930" }],
  "calendar.panel.close": ["Close", { slots: {}, fixedBy: "issue 930" }],

  // The one note under the month: what the number on a live card is. It is
  // not a supply statement and does not repeat one — it explains a value,
  // which is the only thing on the card a founder cannot read off the word
  // beside it.
  "calendar.note.live-number": [
    "On live pages the number is this week's Google position.",
    { slots: {}, fixedBy: "issue 930" },
  ],

  // 2026-09-06, issue #50 (REQ-043 c12). The three grounds on which the
  // day panel says a way through leads nowhere **in place of** offering
  // it. Three keys, three sentences, all the owner's.
  //
  // There is no fourth ground, and in particular **there is no ground for
  // "the check could not be confirmed"**: that outcome's whole content is
  // that ReachKit does not know, and refusing a way on it would take a
  // page the record says nothing against and tell the customer the way
  // leads nowhere (ADR-085). The offered way claims only that this is
  // where the page was put, never that it is there now.
  "waythrough.unpublished-by-us": ["This page was taken down through ReachKit, so its address isn’t offered.", { slots: {}, fixedBy: "REQ-043 c12" }],
  "waythrough.page-not-found": ["Our one check found no page at its address, so there’s nothing to open there.", { slots: {}, fixedBy: "REQ-043 c12" }],
  "waythrough.no-admin-address": ["No address inside your WordPress could be formed for this post.", { slots: {}, fixedBy: "REQ-043 c12" }],
}) satisfies CopyPartition;
