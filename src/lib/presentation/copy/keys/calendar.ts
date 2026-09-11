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
// written — the owner approved the master's drafted set ("copy proposal
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
// master's to amend — named under Corpus in this issue's PR body.
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
  "calendar.stage.your-review": ["Your review", { slots: {}, fixedBy: "REQ-043 c2" }],
  "calendar.stage.scheduled": ["Scheduled", { slots: {}, fixedBy: "REQ-043 c2" }],
  "calendar.stage.planned": ["Planned", { slots: {}, fixedBy: "REQ-043 c2" }],
  "calendar.stage.needs-you": ["Needs you", { slots: {}, fixedBy: "REQ-043 c2" }],

  // §4.6's stage-appropriate actions.
  "calendar.action.read-full-page": ["Read the full page", { slots: {}, fixedBy: "BUILD §4.6" }],
  "calendar.action.view-live-page": ["View live page", { slots: {}, fixedBy: "BUILD §4.6" }],
  // The approved S15 names the destination the control reconnects: a page
  // that stalled because WordPress refused the connection is reconnected to
  // WordPress, and "Reconnect" alone left the customer to guess which of
  // their settings it meant (ruling 11a, issue #354).
  "calendar.action.reconnect": ["Reconnect WordPress", { slots: {}, fixedBy: "BUILD §4.6" }],
  "calendar.action.move": ["Move", { slots: {}, fixedBy: "BUILD §4.6" }],
  "calendar.action.skip": ["Skip", { slots: {}, fixedBy: "BUILD §4.6" }],
  "calendar.action.veto": ["Veto", { slots: {}, fixedBy: "BUILD §4.6" }],
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

  // §4.6's "Why this page" block and its five rows.
  "calendar.why.title": ["Why this page", { slots: {}, fixedBy: "REQ-043 c8" }],
  "calendar.why.search": ["Search", { slots: {}, fixedBy: "REQ-043 c8" }],
  "calendar.why.asked": ["Asked", { slots: {}, fixedBy: "REQ-043 c8" }],
  "calendar.why.answered-today-by": ["Answered today by", { slots: {}, fixedBy: "REQ-043 c8" }],
  "calendar.why.you": ["You", { slots: {}, fixedBy: "REQ-043 c8" }],
  "calendar.why.done-when": ["Done when", { slots: {}, fixedBy: "REQ-043 c8" }],

  // §4.6's footnote. The first half is the section's own sentence; the
  // second is the supply rule stated to the builder, and the customer's
  // wording of it is the owner's.
  // Both halves are the approved S14's own footnote, verbatim (ruling
  // 11a): "Planned pages are written the evening before, from Monday's
  // measurements. When opportunities run out, future days are empty — the
  // calendar is never padded." The supply half was owner-owed and empty
  // until the set worded it; the planned half gains the set's comma.
  "calendar.footnote.planned": [
    "Planned pages are written the evening before, from Monday's measurements.",
    { slots: {}, fixedBy: "BUILD §4.6" },
  ],
  "calendar.footnote.supply": [
    "When opportunities run out, future days are empty — the calendar is never padded.",
    { slots: {}, fixedBy: "BUILD §4.6" },
  ],

  // REQ-043 criterion 4's remaining causes, and criterion 10's one
  // provenance line. Each is a written sentence no artifact states, so the
  // words are the owner's.
  "calendar.empty.instruction": ["This date holds a fix for you to make. Fixes are never written or automated — they’re yours to do.", { slots: {}, fixedBy: "REQ-043 c5" }],
  "calendar.empty.page-cannot-go-live": ["The page for this date was stopped or taken down, so it won’t go live. No page replaces it.", { slots: {}, fixedBy: "REQ-043 c4" }],
  "calendar.empty.customer-change-holds-pages": ["Held by your settings: publishing is off or your destination isn’t connected. Pages resume when that changes.", { slots: {}, fixedBy: "REQ-043 c4" }],
  "calendar.empty.page-held": ["The page for this date was held while ReachKit’s own work was stopped. It still publishes, in turn, once work resumes.", { slots: {}, fixedBy: "REQ-092 c5" }],
  // The day panel's whole account of an exhausted supply — S15's `empty`
  // arm, verbatim (ruling 11a, issue #354). Its cell states the first line
  // alone, from `cause.supply-exhausted` above (#209).
  "calendar.empty.supply-exhausted": [
    "Nothing worth publishing on this date — the supply of opportunities in your market is used up until Monday's re-measure finds more.",
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
  "calendar.status.veto-deadline": ["You can veto this page until {at}.", { slots: { at: "date" }, fixedBy: "BUILD §9" }],

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
  "calendar.supply.short": ["Supply is running short. Pages left: {days}. Monday’s re-measure looks for more.", { slots: { days: "text" }, fixedBy: "BUILD §4.6" }],
  "calendar.supply.first-arrival": ["Your first pass found less than a month of pages — {days} so far. We look for more every Monday.", { slots: { days: "text" }, fixedBy: "BUILD §4.6" }],

  // §4.6's `done-when` row, from the acceptance test recorded when the
  // opportunity was created (§7: "top 20 for Q" / "named on question P" /
  // "gate passes"). Three forms, three keys: the test a page is judged
  // against is never rewritten, so the row must say which of the three it
  // is rather than a single line that fits none of them.
  "calendar.done-when.top20": ["you rank in the top 20 for “{query}”", { slots: { query: "text" }, fixedBy: "BUILD §7" }],
  "calendar.done-when.named-on": ["AI names you on “{question}”", { slots: { question: "text" }, fixedBy: "BUILD §7" }],
  "calendar.done-when.gate-cleared": ["the access check passes", { slots: {}, fixedBy: "BUILD §7" }],

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
