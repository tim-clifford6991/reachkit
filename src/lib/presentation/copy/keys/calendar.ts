// src/lib/presentation/copy/keys/calendar.ts — BP-020 decision 5, WO-041
//
// The calendar's sentences. Three keys seeded (WO-041 step 3): the
// no-presence-yet line for a date carrying no page, and the two cause
// lines. Empty value, owner-owed — no string is written here (constitution
// §1). The block that owns the calendar fills every other sentence this
// surface needs.
//
// 2026-09-05: issue #9 (BUILD §4.4) adds `calendar.head` — the one written
// line this screen states inside the app shell until its own content lands
// (issue #16, §4.6). Owner-owed and empty: it is a customer-visible sentence
// (constitution §1).
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
// Six are owner-owed and empty, because no sentence exists to transcribe:
// the three empty-date causes REQ-043 criterion 4 names but §4.6 does not
// word, the provenance line criterion 10 asks for, the veto-deadline line,
// and the supply half of the footnote — §4.6 states the supply *rule* to the
// builder ("the empty state says so") and never says it to the customer.
// Listed in issue #16's PR under "Owner owes".
//
// 2026-09-06, issue #20 (REQ-091 c2): these three keys are the ones the
// arbiter `src/lib/presentation/place/account.ts` resolves — the baseline
// cold-start line for a date carrying no page, and the two cause lines. They
// stay **owner-owed and empty**, deliberately: this screen reads every line
// through the shell's `writtenLine`, which renders an owner-owed key as
// nothing, and `copy()` refuses one outright. So `account()` throws naming
// the key rather than handing a place a blank — the outstanding obligation
// is recorded the moment a place is registered, and no screen can render an
// unwritten account by accident.
// 2026-09-06, separately again: issue #116 (REQ-092 c5) adds one —
// `calendar.empty.page-held`, the account a date carries when a page was
// planned for it and did not go live on it because a ReachKit stop held it.
// Owner-owed and **empty**, like the three empty-date causes beside it and
// for the same reason: this screen reads every line through the shell's
// `writtenLine`, and `account()` throws naming an unwritten key rather than
// handing a date a blank. It is a seventh cause, not a rewording of
// `calendar.empty.page-cannot-go-live` — that line says a page can no longer
// go live, and a held page still publishes.
import type { CopyPartition } from "../registry.ts";

export const CALENDAR_COPY = Object.freeze({
  "place.calendar.date.page": [
    "TODO(copy)",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-043 c5" },
  ],
  "cause.unrecognised": [
    "TODO(copy)",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-043 c4" },
  ],
  "cause.supply-exhausted": [
    "TODO(copy)",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-043 c3" },
  ],
  "calendar.head": ["One page a day. Every day.", { slots: {}, fixedBy: "BUILD §4.6" }],

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
  "calendar.action.reconnect": ["Reconnect", { slots: {}, fixedBy: "BUILD §4.6" }],
  "calendar.action.move": ["Move", { slots: {}, fixedBy: "BUILD §4.6" }],
  "calendar.action.skip": ["Skip", { slots: {}, fixedBy: "BUILD §4.6" }],
  "calendar.action.veto": ["Veto", { slots: {}, fixedBy: "BUILD §4.6" }],
  // 2026-09-07, issue #143. The customer's own restart — §9 opens
  // `needs_attention → generating` for them and for no one else, and no
  // surface offered it.
  //
  // **A word the product does not yet speak.** §4.6's control list for
  // needs-you is *Reconnect* and nothing more, so unlike the five above
  // this key is not transcribed from the spec — it is owner-owed, and it
  // carries the marker rather than the empty value on the #93 ruling: the
  // day panel reads its controls through `copy()`, and a screen the
  // customer reaches must stay reviewable on a preview.
  //
  // What it has to say is what happens: ReachKit writes the page again,
  // from the same opportunity, and it returns to the queue as a fresh
  // draft. What it must not say is that anything is being retried
  // automatically — nothing is, which is the whole reason the control
  // exists.
  "calendar.action.regenerate": ["TODO(copy)", { slots: {}, fixedBy: "BUILD §9 · REQ-043 c9" }],

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
  "calendar.footnote.planned": [
    "Planned pages are written the evening before from Monday's measurements.",
    { slots: {}, fixedBy: "BUILD §4.6" },
  ],
  "calendar.footnote.supply": ["", { slots: {}, fixedBy: "BUILD §4.6" }],

  // REQ-043 criterion 4's remaining causes, and criterion 10's one
  // provenance line. Owner-owed: each is a written sentence and no artifact
  // states it.
  "calendar.empty.instruction": ["", { slots: {}, fixedBy: "REQ-043 c5" }],
  "calendar.empty.page-cannot-go-live": ["", { slots: {}, fixedBy: "REQ-043 c4" }],
  "calendar.empty.customer-change-holds-pages": ["", { slots: {}, fixedBy: "REQ-043 c4" }],
  "calendar.empty.page-held": ["", { slots: {}, fixedBy: "REQ-092 c5" }],
  // REQ-071 c11 (issue #204). A market change holds generation until the
  // pass that adopts it, so the day names which change is holding pages and
  // the date they resume — both read from `generationHold()`, which has
  // already chosen one reason where two answers changed. `TODO(copy)`
  // rather than the empty value, per DECISIONS 2026-09-05: a day with an
  // account is never a blank cell while the owner writes the sentence.
  "calendar.empty.change-holds-pages": [
    "TODO(copy)",
    { slots: { date: "date", change: "text" }, fixedBy: "REQ-071 c11" },
  ],
  "calendar.provenance.measured": ["", { slots: { date: "date" }, fixedBy: "REQ-043 c10" }],
  "calendar.status.veto-deadline": ["", { slots: { at: "date" }, fixedBy: "BUILD §9" }],

  // §7's one statement of supply, as §4.6's calendar makes it: the three
  // arms of `supplyNotice`, in the engine's own precedence (exhausted >
  // short > arrival shortfall). Three keys and not one, because they are
  // three different claims — supply is gone / supply is running out /
  // this month stops before the month does — and a customer reads exactly
  // one of them. Owner-owed: §4.6 states the supply *rule* to the builder
  // and never words it for the customer, and `overview.supply.*` is the
  // same three claims on a different screen, so neither is the other's
  // string. `days` counts days of pages, so it is a text slot carrying a
  // numeral, exactly as `overview.supply.*` declares it.
  "calendar.supply.exhausted": ["", { slots: { since: "date" }, fixedBy: "BUILD §4.6" }],
  "calendar.supply.short": ["", { slots: { days: "text" }, fixedBy: "BUILD §4.6" }],
  "calendar.supply.first-arrival": ["", { slots: { days: "text" }, fixedBy: "BUILD §4.6" }],

  // §4.6's `done-when` row, from the acceptance test recorded when the
  // opportunity was created (§7: "top 20 for Q" / "named on question P" /
  // "gate passes"). Three forms, three keys: the test a page is judged
  // against is never rewritten, so the row must say which of the three it
  // is rather than a single line that fits none of them. Owner-owed.
  "calendar.done-when.top20": ["", { slots: { query: "text" }, fixedBy: "BUILD §7" }],
  "calendar.done-when.named-on": ["", { slots: { question: "text" }, fixedBy: "BUILD §7" }],
  "calendar.done-when.gate-cleared": ["", { slots: {}, fixedBy: "BUILD §7" }],

  // 2026-09-06, issue #50 (REQ-043 c12). The three grounds on which the
  // day panel says a way through leads nowhere **in place of** offering
  // it. Three keys, three sentences, all the owner's; `TODO(copy)` rather
  // than the empty value's throw, because these render on a screen (#93).
  //
  // There is no fourth ground, and in particular **there is no ground for
  // "the check could not be confirmed"**: that outcome's whole content is
  // that ReachKit does not know, and refusing a way on it would take a
  // page the record says nothing against and tell the customer the way
  // leads nowhere (ADR-085). The offered way claims only that this is
  // where the page was put, never that it is there now.
  "waythrough.unpublished-by-us": ["TODO(copy)", { slots: {}, fixedBy: "REQ-043 c12" }],
  "waythrough.page-not-found": ["TODO(copy)", { slots: {}, fixedBy: "REQ-043 c12" }],
  "waythrough.no-admin-address": ["TODO(copy)", { slots: {}, fixedBy: "REQ-043 c12" }],
}) satisfies CopyPartition;
