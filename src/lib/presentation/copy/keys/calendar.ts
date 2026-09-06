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
import type { CopyPartition } from "../registry.ts";

export const CALENDAR_COPY = Object.freeze({
  "place.calendar.date.page": [
    "",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-043 c5" },
  ],
  "cause.unrecognised": [
    "",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-043 c4" },
  ],
  "cause.supply-exhausted": [
    "",
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
  "calendar.provenance.measured": ["", { slots: { date: "date" }, fixedBy: "REQ-043 c10" }],
  "calendar.status.veto-deadline": ["", { slots: { at: "date" }, fixedBy: "BUILD §9" }],
}) satisfies CopyPartition;
