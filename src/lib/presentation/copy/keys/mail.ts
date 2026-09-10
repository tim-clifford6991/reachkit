// src/lib/presentation/copy/keys/mail.ts — BP-020 decision 5, WO-041
//
// The mail seam's sentences, BP-016 and BP-029. Two keys seeded (WO-041
// step 4): the opt-out confirmation and invalid-token lines. Empty value,
// owner-owed — no string is written here (constitution §1). BP-029 owns
// the opt-out surface and lives in src/lib/mail/leads/**, so this is
// already the right module for its two lines; no thirteenth partition is
// needed for them.
//
// 2026-09-04: the owner ruled on both (WO-041 `## Log`, this date's
// ruling) — filled verbatim, byte for byte. Neither is owner-owed any
// more.
import type { CopyPartition } from "../registry.ts";

export const MAIL_COPY = Object.freeze({
  // 2026-09-08, UI-SPEC S7 (ruling 11a). The approved set draws this page
  // as one card — a mail chip over "Opted out", the address the link
  // belonged to inside the line, and a quiet way back — and 11a makes its
  // unbracketed strings approved copy as written. So this line is the
  // set's, not the 2026-09-04 ruling's: that ruling wrote a sentence for a
  // page nobody had drawn yet, and the drawing is the later word on the
  // same line. It carries the `{address}` slot because the set writes the
  // address inside the sentence, in mono, and a sentence with a value in
  // it has a slot rather than two half-sentences.
  "optout.confirmed": ["No more follow-up mail will reach {address} — for this domain or any other. The page you asked for stays yours.", { slots: { address: "text" }, fixedBy: "REQ-011 c3 · UI-SPEC S7 (11a)" }],
  "optout.invalid": ["That unsubscribe link isn’t valid any more. Reply to any ReachKit email with \"stop\" and we’ll stop by hand.", { slots: {}, fixedBy: "REQ-011 c3" }],

  // The card's own head (UI-SPEC S7, 11a). The set draws one eyebrow over
  // the mail chip and it states what happened: "Opted out".
  "optout.head": ["Opted out", { slots: {}, fixedBy: "REQ-010 c11 · UI-SPEC S7 (11a)" }],
  /** The same head on the two arms where nothing was opted out — an
   *  invalid link, or a store this product could not reach.
   *
   *  **Owner-owed, and it has to be its own key.** The set draws only the
   *  confirmation, so 11a writes no eyebrow for the other two arms, and
   *  "Opted out" over "that link isn’t valid any more" would be the page
   *  contradicting itself in its own head. The marker renders (the
   *  standing screen rule), so the card keeps its shape and says out loud
   *  which word is still the owner’s. */
  "optout.head.unresolved": ["TODO(copy)", { slots: {}, fixedBy: "REQ-010 c11 · UI-SPEC S7 (12a)" }],

  // 2026-09-05, issue #30 (the mail seam, BUILD §12). Six keys the shell
  // and the whole-mail line need. Five are owner-owed and empty: every one
  // of them is a sentence the product speaks in its own voice, so none is
  // written here (constitution §1 / CLAUDE.md "never invent copy"). The
  // sixth is the product's own name, transcribed — not a sentence, on the
  // same footing as the em-dash and the removal address that two other
  // partitions transcribe. (Those two keys are not named here: issue #28's
  // `tests/app/scan-address/removal.test.tsx` asserts one of them appears
  // in exactly one file under `src/`, and a comment naming it is a second.)
  //
  // Note on the empty five: `copy()` throws on an owner-owed key, so a
  // mail that would carry one of these lines fails loudly at compose time
  // rather than shipping an empty line to a customer. That is the intended
  // behaviour and `tests/mail/shell/whole-mail-line.test.ts` asserts it,
  // written so it keeps discriminating once the owner fills them.
  "mail.shell.wordmark": ["ReachKit", { slots: {}, fixedBy: "§12" }],
  "mail.nothing_to_report": ["", { slots: {}, fixedBy: "§12" }],
  "mail.week_unmeasured": ["", { slots: { nextDue: "date" }, fixedBy: "§12" }],
  "mail.week_partly_measured": ["", { slots: { sections: "text" }, fixedBy: "§12" }],

  // 2026-09-07, issue #181. The six names the line above interpolates.
  //
  // `mail.week_partly_measured` says a week was measured with sections it
  // did not reach, and names them — REQ-064 c4 — and until now nothing
  // could: `MeasurementState.partial` takes copy keys and no key existed
  // for any of the six parts `unmeasuredPartsOf` reports. So the sender
  // could state that *something* was missed and never what, which is the
  // half of the criterion that carries the information.
  //
  // Six keys and not one with the part interpolated: they are the names of
  // six different measurements, and a name is not a value. Every one is
  // **empty and owner-owed** on the mail arm of the 2026-09-05 ruling —
  // these are words a customer reads, and a mail never ships a
  // placeholder.
  //
  // They are `mail.section.*` and not `mail.weekly.section.*`: the same
  // six parts are what §4.5's own account of a partial week names, and one
  // set of names is what stops a screen and a mail calling one measurement
  // two things.
  "mail.section.on_page": ["", { slots: {}, fixedBy: "REQ-064 c4" }],
  "mail.section.market": ["", { slots: {}, fixedBy: "REQ-064 c4" }],
  "mail.section.rankings": ["", { slots: {}, fixedBy: "REQ-064 c4" }],
  "mail.section.ai_answers": ["", { slots: {}, fixedBy: "REQ-064 c4" }],
  "mail.section.rivals": ["", { slots: {}, fixedBy: "REQ-064 c4" }],
  "mail.section.score": ["", { slots: {}, fixedBy: "REQ-064 c4" }],
  "mail.unsubscribe.label": ["", { slots: {}, fixedBy: "§12" }],
  "mail.optout.label": ["", { slots: {}, fixedBy: "§12" }],

  // 2026-09-05, issue #31 (lead capture, the giveaway page and the nurture
  // sequence, `BUILD.md` §4.2). Twenty-one keys, every one owner-owed and
  // empty: each is a sentence the product speaks in its own voice, so none
  // is written here (constitution §1 / CLAUDE.md "never invent copy").
  // `copy()` throws on an owner-owed key, so a mail or a response that
  // would carry one of these fails loudly rather than shipping a blank
  // line to a founder.
  //
  // The four `mail.firstPageUnavailable.<cause>` keys are named for the
  // four `FirstPageFailure` members verbatim: `FIRST_PAGE_UNAVAILABLE_COPY`
  // (`src/lib/mail/leads/giveaway.ts`) is a `Record` over that union, so a
  // cause with no key of its own is a compile error — which is what makes
  // REQ-010 criterion 7's "and why" enforceable rather than aspirational.

  // The page itself (REQ-010 c4).
  "mail.firstPage.subject": [
    "Your first page: {title}",
    { slots: { title: "text" }, fixedBy: "REQ-010 c4 · UI-SPEC S20 (11a)" },
  ],
  "mail.firstPage.target_search": ["target search", { slots: {}, fixedBy: "REQ-010 c4 · UI-SPEC S20 (11a)" }],
  "mail.firstPage.volume_label": ["", { slots: {}, fixedBy: "REQ-010 c4" }],
  "mail.firstPage.volume_note": ["", { slots: {}, fixedBy: "REQ-010 c4" }],
  "mail.firstPage.first_of_n": [
    "The complete page, copy-ready, in Markdown and HTML. That’s page 1 of {pagesFound} we found for you.",
    { slots: { pagesFound: "text" }, fixedBy: "REQ-010 c4 · UI-SPEC S20 (11a)" },
  ],

  // The message that closes the request when no page is coming (c7), one
  // line per cause.
  "mail.firstPageUnavailable.subject": ["", { slots: {}, fixedBy: "REQ-010 c7" }],
  "mail.firstPageUnavailable.no-page-to-write": ["", { slots: {}, fixedBy: "REQ-010 c7" }],
  "mail.firstPageUnavailable.writing-failed": ["", { slots: {}, fixedBy: "REQ-010 c7" }],
  "mail.firstPageUnavailable.writing-refused": ["", { slots: {}, fixedBy: "REQ-010 c7" }],
  "mail.firstPageUnavailable.delivery-failed": ["", { slots: {}, fixedBy: "REQ-010 c7" }],

  // The three touches (c9). One subject and one line each; the touch is
  // carried by the key, never by a conditional inside a template.
  "mail.nurture.subject.1": ["", { slots: {}, fixedBy: "REQ-010 c9" }],
  "mail.nurture.subject.2": ["", { slots: {}, fixedBy: "REQ-010 c9" }],
  "mail.nurture.subject.3": ["", { slots: {}, fixedBy: "REQ-010 c9" }],
  "mail.nurture.body.1": ["", { slots: { domain: "text" }, fixedBy: "REQ-010 c9" }],
  "mail.nurture.body.2": ["", { slots: { domain: "text" }, fixedBy: "REQ-010 c9" }],
  "mail.nurture.body.3": ["", { slots: { domain: "text" }, fixedBy: "REQ-010 c9" }],

  // BUILD §4.3's setup reminder (REQ-025 c6). Three keys: the subject, the
  // one line asking them to finish, and the label on the sign-in link that
  // lands them back on the setup screen. Owner-owed as `''`, not as the
  // `TODO(copy)` marker the two setup *screens* use — DECISIONS 2026-09-05:
  // "mail keeps the throw (a mail never ships a placeholder)", and a
  // reminder that went out reading `TODO(copy)` would be worse than one
  // that did not go out.
  "mail.setupReminder.subject": ["", { slots: {}, fixedBy: "REQ-025 c6" }],
  "mail.setupReminder.body": ["", { slots: {}, fixedBy: "REQ-025 c6" }],
  "mail.setupReminder.action": ["", { slots: {}, fixedBy: "REQ-025 c6" }],

  // What `POST /api/lead` answers with. The adapter maps each arm of
  // `captureLead()` to one of these keys and never to a sentence of its
  // own or a vendor payload (REQ-003 c10, REQ-010 c1).
  "lead.accepted": ["", { slots: {}, fixedBy: "REQ-010 c1" }],
  "lead.invalid_address": ["", { slots: {}, fixedBy: "REQ-010 c1" }],
  "lead.unavailable": ["", { slots: {}, fixedBy: "REQ-003 c10" }],

  // The third arm of the opt-out page: the link is good and our store is
  // not. Telling the reader their link is invalid would be a false
  // statement about the one thing they came to do.
  //
  // **The marker and not the empty value** (issue #261). This is the one
  // key on this list a *screen* reads through `copy()`, and the screen rule
  // has no exceptions: an owner-owed sentence on a screen renders the
  // visible marker, so the owner can see which line is still theirs while
  // the rest of the page works (DECISIONS 2026-09-05, restated for #242 and
  // #255). The empty value's throw would take `/opt-out/{token}` down
  // whole — on the arm a reader reaches when the store is unavailable,
  // which is the moment they can least afford a blank page. Its neighbours
  // above stay empty because a *mail* reads them, and a mail never ships a
  // placeholder.
  "optout.unavailable": ["TODO(copy)", { slots: {}, fixedBy: "REQ-010 c11" }],

  // 2026-09-06, issue #33 (Stripe, provisioning and the two backstops,
  // `BUILD.md` §13). Nine keys, every one owner-owed and empty. Empty and
  // not the `TODO(copy)` marker: the owner's 2026-09-05 ruling on #93 is
  // that fixture *screens* render the marker and "mail keeps the throw (a
  // mail never ships a placeholder)". Every line below is a sentence the
  // product speaks in its own voice, so none is written here.
  //
  // Two of the nine (`mail.account.reach_a_person`,
  // `mail.account.no_second_subscription`) carry obligations REQ-024
  // states in words rather than in structure — "names one way to reach a
  // person", "is told that it bought no second subscription" — and are
  // separate keys rather than clauses inside another line so that a mail
  // missing one fails to compose rather than shipping without it.

  // The sign-in link a completed payment sends (§13, REQ-024 c1).
  "mail.magicLink.subject": ["Your sign-in link", { slots: {}, fixedBy: "REQ-024 c1 · UI-SPEC S20 (11a)" }],
  "mail.magicLink.body": [
    "One click signs you in on this device. The link works once and expires in 15 minutes.",
    { slots: {}, fixedBy: "REQ-024 c1 · UI-SPEC S20 (11a)" },
  ],
  "mail.magicLink.action": ["Sign in", { slots: {}, fixedBy: "REQ-024 c1 · UI-SPEC S20 (11a)" }],

  // The 15-minute chase (REQ-024 c5): the payment succeeded, and either a
  // working link or a written statement that the account is not open yet.
  // Two bodies, not one with a conditional: "here is your way in" and "we
  // are still opening it" are two different things to say.
  "mail.account.chase.subject": ["", { slots: {}, fixedBy: "REQ-024 c5" }],
  "mail.account.chase.link_ready": ["", { slots: {}, fixedBy: "REQ-024 c5" }],
  "mail.account.chase.not_open_yet": ["", { slots: {}, fixedBy: "REQ-024 c5" }],

  // The second-purchase mail (REQ-024 c3): what a founder whose second
  // purchase was charged is told.
  "mail.account.second_purchase.subject": ["", { slots: {}, fixedBy: "REQ-024 c3" }],
  "mail.account.no_second_subscription": ["", { slots: {}, fixedBy: "REQ-024 c3" }],

  // The one way to reach a person, named in every `account` mail REQ-024
  // requires it in (c3, c5). One key, so the address is written once.
  "mail.account.reach_a_person": ["", { slots: {}, fixedBy: "REQ-024 c5" }],

  // 2026-09-06, issue #35 (identity, REQ-077 c3). The one `account` mail
  // that goes to the address an account has just stopped signing in with:
  // "saying the account now signs in at a different address and this one no
  // longer can". Two keys, both owner-owed and empty — each is a sentence
  // the product speaks in its own voice, so neither is written here
  // (constitution §1 / CLAUDE.md "never invent copy"), and `copy()` throws
  // on an owner-owed key so this mail fails loudly at compose time rather
  // than reaching a customer blank.
  //
  // No slot on either. The mail arrives at the old address, so naming it
  // says nothing, and naming the new one would put the account's live
  // credential-bearing address into the mailbox the customer is leaving.
  "mail.account.address_moved.subject": ["", { slots: {}, fixedBy: "REQ-077 c3" }],
  "mail.account.address_moved": ["", { slots: {}, fixedBy: "REQ-077 c3" }],

  // 2026-09-06, issue #47 (REQ-063 c4, REQ-064, BUILD §12's `weekly` row:
  // "score delta, AI answers delta, pages verdicts, next 3 — all values
  // conditional: a missing number omits its section, never prints 0").
  // Eleven keys, every one owner-owed and **empty** on the #93 ruling the
  // account and setup-reminder lines above cite: these are mail lines, and
  // a mail never ships a placeholder.
  //
  // The four *verdict words* are not here — they are `keys/publish.ts`'s,
  // because Overview and the calendar speak the same four and a mail must
  // not word a verdict differently from the screen beside it.
  //
  // A page is named by **its address**, and a next opportunity by **the
  // search it targets**: both are measured fact. Neither is named by its
  // title, which is model-written text a mail may not speak in ReachKit's
  // own voice (§8, REQ-093) — so no slot below takes one.
  // S20's subject is "Monday: Discoverability Score 62 (▲ 8)" — a number
  // and its delta, both of which §12 lets be unmeasured. A subject has no
  // omission arm: a mail whose subject could not be composed does not go
  // out at all. Left owner-owed until the owner writes the line that holds
  // when the week produced no number (issue #388).
  "mail.weekly.subject": ["", { slots: {}, fixedBy: "§12" }],
  "mail.weekly.score": ["Discoverability Score", { slots: {}, fixedBy: "UI-SPEC 6a" }],
  "mail.weekly.aiAnswers": ["AI answers", { slots: {}, fixedBy: "§12 · UI-SPEC S20 (11a)" }],
  "mail.weekly.verdicts": ["", { slots: {}, fixedBy: "REQ-063 c4" }],
  "mail.weekly.verdicts.none": ["", { slots: {}, fixedBy: "REQ-064 c3" }],
  "mail.weekly.next": ["", { slots: {}, fixedBy: "§12" }],
  "mail.weekly.next.none": ["", { slots: {}, fixedBy: "REQ-064 c3" }],
  "mail.weekly.next.item": ["", { slots: { search: "text" }, fixedBy: "§12" }],

  // The three forms a judged page's row takes. Three sentences and not one
  // with a conditional: "this page" and "this page, which moved from here
  // to there since the date it was measured" and "…, over an interval
  // longer than a week" are three different statements, and REQ-063 c4
  // requires the third whenever the measurement compared against is not
  // the previous week's. A template that chose between them with an `if`
  // would be one edit away from stating a span it did not have.
  "mail.weekly.page": ["", { slots: { page: "text" }, fixedBy: "REQ-063 c4" }],
  "mail.weekly.page.moved": [
    "",
    { slots: { page: "text", from: "text", to: "text", measuredAt: "date" }, fixedBy: "REQ-063 c3" },
  ],
  "mail.weekly.page.moved_over": [
    "",
    {
      slots: { page: "text", from: "text", to: "text", measuredAt: "date", weeks: "text" },
      fixedBy: "REQ-063 c4",
    },
  ],

  // The end of hosting (REQ-076 c11, issue #34): the two notices a customer
  // with pages on the hosted CMS is owed before those pages stop being
  // served — one when their access ends, however it ends, and one
  // HOSTING_END_REMINDER_DAYS before the day serving stops. Same `account`
  // kind, same empty representation: these are mail, and a mail never ships
  // a placeholder.
  //
  // Four keys and not two. The subject differs between the two occasions
  // (one says access has ended, the other that a day is approaching) and
  // the body carries the day itself, so each is its own sentence. The day
  // is a `date` slot, filled at composition and expressed in the customer's
  // own stated time zone (REQ-073 c3) — never formatted in this file.
  //
  // `mail.account.hosting_end.export_stays` is a separate key rather than a
  // clause inside either body for the reason the two above are: c11
  // requires that the customer is told "their pages remain exportable
  // afterwards", and a promise that lives inside another sentence is one
  // edit away from being dropped without anything failing.
  "mail.account.hosting_end.access_ended.subject": ["", { slots: {}, fixedBy: "REQ-076 c11" }],
  "mail.account.hosting_end.seven_days.subject": ["", { slots: {}, fixedBy: "REQ-076 c11" }],
  "mail.account.hosting_end.stops_on": ["", { slots: { date: "date" }, fixedBy: "REQ-076 c11" }],
  "mail.account.hosting_end.export_stays": ["", { slots: {}, fixedBy: "REQ-076 c11" }],

  // 2026-09-06, issue #46 (the telling, §9 · §12). Seven keys, every one
  // owner-owed and empty — the #93 ruling's mail arm: "mail keeps the throw
  // (a mail never ships a placeholder)".
  //
  // Three for the three things §12's `draft-ready` mail can be, one per
  // governing pair. They are three keys and not one with a conditional
  // because "here is your window to stop it", "there is no window because
  // you set none" and "nothing happens until you approve" are three
  // different statements, and a mail missing the right one must fail to
  // compose rather than ship the wrong one.
  //
  // `{publishesAt}` is a date slot: the exact moment the page publishes,
  // stated in the customer's own zone (REQ-073 c3).
  // S20's one line on this mail, and the arm it draws: a page with a
  // window in which to stop it. "Publishes tomorrow at 07:00 unless you
  // say no." — the moment is the slot this key already declared, which is
  // what renders as "tomorrow at 07:00". The other two arms are not drawn
  // by the set and stay the owner's.
  "mail.draftReady.autopilotWindow": [
    "Publishes {publishesAt} unless you say no.",
    { slots: { publishesAt: "date" }, fixedBy: "REQ-057 c1 · UI-SPEC S20 (11a)" },
  ],
  "mail.draftReady.autopilotZero": [
    "",
    { slots: { publishesAt: "date" }, fixedBy: "REQ-057 c7" },
  ],
  "mail.draftReady.copilot": ["", { slots: {}, fixedBy: "REQ-057 c1" }],

  // Four for REQ-057 c9's destination clause — what the telling says about
  // a page bound for the customer's own site. `{site}` is the address the
  // page goes live at, never a credential.
  //
  // Three of them differ only in what they say about *when*, which is
  // exactly the distinction c9 draws: "it says the page goes live there
  // then" (an interval), "goes live there only once they approve"
  // (copilot), and the zero-window case where it goes live at the stated
  // moment with no interval at all.
  "mail.draftReady.dest.goesLiveThen": ["", { slots: { site: "text" }, fixedBy: "REQ-057 c9" }],
  "mail.draftReady.dest.goesLiveAtOnce": ["", { slots: { site: "text" }, fixedBy: "REQ-057 c9" }],
  "mail.draftReady.dest.goesLiveOnApproval": [
    "",
    { slots: { site: "text" }, fixedBy: "REQ-057 c9" },
  ],
  // The site cannot be published to as things stand. It says what the
  // customer must change — and it never says the page will not go live at
  // the moment the mail names, because c9's final sentence keeps the date,
  // the interval and the stop action exactly as the other criteria set
  // them. ADR-084 and ADR-086 both record this line as owner-owed and
  // unminted; nothing here mints it.
  "mail.draftReady.dest.cannotPublish": ["", { slots: { site: "text" }, fixedBy: "REQ-057 c9" }],

  // 2026-09-07, issue #174. The two the mail itself owed, beside the seven
  // the telling already had: §12's `draft-ready` had a decision and no
  // template, so the customer was never told a page was in review.
  //
  // Both are **empty and owner-owed**, on the same #93 ruling the seven
  // above take: a mail keeps the throw, because a mail never ships a
  // placeholder — `sendEmail` reports an unwritten line as
  // `not-composable` and the page stays untold and held, which is a state
  // the product can recover from. A `TODO(copy)` marker in an inbox is
  // not.
  //
  // `stopAction` is the label on §12's "one veto link" — one, and only on
  // the arm that has an interval to stop the page inside. It is the
  // customer's own action and says what pressing it does; it is not an
  // unsubscribe, and REQ-057 c7's zero-window mail carries neither.
  // 2026-09-07, issue #183. §12's "why-data", as two rows of §7's own
  // stored evidence: the search this page targets, and how often it is
  // searched. Read from the row §7 wrote when it chose the page and never
  // re-measured — a mail that measured again would state a number the page
  // was not chosen on.
  //
  // Two keys and not one line with the number in it: every numeral in this
  // product is written by one formatter (`stat`'s), and a volume folded
  // into a sentence would be a second. The volume's own row omits itself
  // where the measurement was never made, which is why it is `Measured`
  // and not a number.
  //
  // Both **empty** and owner-owed, like every other line of this mail: a
  // mail never ships a placeholder.
  //
  // There is no key for the page's *title*. It is model-written, and it
  // travels in the `pageBody` block, whose label carries it —
  // `generated.page.written` is the sentence that names it, and it is
  // already minted. A `mail.draftReady.title` key would be that same title
  // with ADR-012's label stripped off.
  "mail.draftReady.why.search": ["", { slots: { query: "text" }, fixedBy: "BUILD §12 · §7" }],
  "mail.draftReady.why.volume": ["", { slots: {}, fixedBy: "BUILD §12 · §7" }],
  // S20's subject, "Tomorrow 07:00: [page title 15]". Both halves are
  // data: the moment is the account's own publish time, written by
  // `writePublishesAt` — which is what renders as "Tomorrow 07:00" — and
  // the title is the page's. Filling 07:00 as a literal would bake one
  // customer's setting into every subject, so it takes the slot the rest
  // of this kind's lines already take.
  "mail.draftReady.subject": [
    "{publishesAt}: {title}",
    { slots: { publishesAt: "text", title: "text" }, fixedBy: "BUILD §12 · UI-SPEC S20 (11a)" },
  ],
  "mail.draftReady.stopAction": ["Stop this page", { slots: {}, fixedBy: "REQ-057 c1 · UI-SPEC S20 (11a)" }],

  // 2026-09-06, issue #50 (REQ-062 c5, BUILD §12's `published` mail).
  // Sixteen keys, every one owner-owed and empty — each is a sentence
  // the product speaks in its own voice, so none is written here. A mail
  // keeps the throw rather than the `TODO(copy)` marker (#93): a mail
  // never ships a placeholder, and `sendEmail` reports the unwritten line
  // as `not-composable` rather than sending a blank one.
  //
  // **Three lines for three outcomes, and the last two must stay two
  // (ADR-085).** `mail.published.not_found` says no page was found at the
  // address when the check ran; `mail.published.not_confirmed` says the
  // check could not be confirmed. They render as nearly the same grey line
  // and have opposite consequences — one retires the page from weekly
  // judgement for ever, the other leaves it fully judged — so a reviewer
  // looking at the two will propose one key. Neither may name a cause, and
  // neither may say who removed the page.
  //
  // Each of the three carries the date, and only the date: criterion 4
  // requires the outcome to carry when ReachKit looked, and criterion 7
  // forbids any surface stating anything about the page beyond what that
  // one check recorded on that date.
  // S20's subject is "Live: [page title]". The title is not here yet:
  // `PublishedTelling` reads the `publications` row, which carries the live
  // URL and no page title, and giving it one is a query change with a
  // schema test behind it (issue #388). Left owner-owed rather than filled
  // with half the sentence.
  "mail.published.subject": ["", { slots: {}, fixedBy: "REQ-062 c5" }],
  "mail.published.verified": ["", { slots: { checkedAt: "date" }, fixedBy: "REQ-062 c5" }],
  "mail.published.not_found": ["", { slots: { checkedAt: "date" }, fixedBy: "REQ-062 c4" }],
  "mail.published.not_confirmed": ["", { slots: { checkedAt: "date" }, fixedBy: "REQ-062 c4" }],
  "mail.published.address_label": ["", { slots: {}, fixedBy: "REQ-062 c5" }],

  // The four outcomes, as the four subjects of a `verdicts` block, and the
  // three words one of them can carry. Split this way so the four names
  // are written once each and the three verdicts once each, rather than
  // twelve sentences that could disagree with one another.
  //
  // `check_not_measured` is its own word and is never `check_failed`: a
  // check ReachKit could not observe is not a check this page failed, and
  // saying so would blame the customer's page for a condition of the site
  // it sits in (criterion 6).
  "mail.published.checks_label": ["", { slots: {}, fixedBy: "REQ-062 c5" }],
  "mail.published.checks_empty": ["", { slots: {}, fixedBy: "REQ-062 c5" }],
  "mail.published.check.reachable": ["", { slots: {}, fixedBy: "REQ-062 c1" }],
  "mail.published.check.indexable": ["", { slots: {}, fixedBy: "REQ-062 c1" }],
  "mail.published.check.sitemap": ["", { slots: {}, fixedBy: "REQ-062 c1" }],
  "mail.published.check.ai_readable": ["", { slots: {}, fixedBy: "REQ-062 c1" }],
  "mail.published.check_passed": ["", { slots: {}, fixedBy: "REQ-062 c3" }],
  "mail.published.check_failed": ["", { slots: {}, fixedBy: "REQ-062 c3" }],
  "mail.published.check_not_measured": ["", { slots: {}, fixedBy: "REQ-062 c6" }],

  // Criterion 6's condition of the site, named separately from the page's
  // own outcomes and stated as the customer's own to act on. Two kinds,
  // two lines, each carrying the date it was found — a condition is only
  // ever as fresh as the last page checked on that site, and ReachKit
  // never goes back to look.
  "mail.published.site_condition.publishes_no_sitemap": [
    "",
    { slots: { foundAt: "date" }, fixedBy: "REQ-062 c6" },
  ],
  "mail.published.site_condition.robots_blocks_site": [
    "",
    { slots: { foundAt: "date" }, fixedBy: "REQ-062 c6" },
  ],

  // ── The one `account` mail a deleted account leaves behind (issue #52)
  //
  // REQ-079 criterion 6. Deletion leaves the customer no ReachKit surface to
  // read, so the naming criterion 4 puts on such a surface is carried by
  // this mail instead — sent to the address being deleted, and only where
  // something of either kind is left behind. Same `account` kind, same empty
  // representation: a mail never ships a placeholder.
  //
  // **Ten keys, and the count is the point.** Criterion 6 gives each of §9's
  // four WordPress outcomes "one sentence of its own, carrying that
  // outcome's own count and, where there is anywhere to look, its own place
  // — and no sentence carries two outcomes or one count for both". So each
  // outcome is its own key; three of them come in two forms, one naming the
  // place and one saying the posts are in that site and ReachKit cannot
  // point to them there, "and it still carries its count"; and
  // `already_gone` has one form only, because that sentence "naming no
  // place, because there is nothing there to find".
  //
  // Every one carries a `count` slot and none of them lists a post,
  // "whatever the number".
  "mail.account.deleted.subject": ["", { slots: {}, fixedBy: "REQ-079 c6" }],
  // The pages still live at a destination that could not be reached: the
  // mail "names it and says what they must do about it".
  "mail.account.deleted.still_live": ["", { slots: { count: "text" }, fixedBy: "REQ-079 c6" }],
  // "The mail says of every post still in that site that it is theirs to
  // keep or remove" — its own key, because a promise living inside another
  // sentence is one edit away from being dropped without anything failing.
  "mail.account.deleted.theirs_to_keep": ["", { slots: {}, fixedBy: "REQ-079 c6" }],
  "mail.account.deleted.wordpress.returned_to_draft": [
    "",
    { slots: { count: "text", place: "text" }, fixedBy: "REQ-079 c6" },
  ],
  "mail.account.deleted.wordpress.returned_to_draft.no_place": [
    "",
    { slots: { count: "text" }, fixedBy: "REQ-079 c6" },
  ],
  "mail.account.deleted.wordpress.named_for_removal": [
    "",
    { slots: { count: "text", place: "text" }, fixedBy: "REQ-079 c6" },
  ],
  "mail.account.deleted.wordpress.named_for_removal.no_place": [
    "",
    { slots: { count: "text" }, fixedBy: "REQ-079 c6" },
  ],
  // No place form: "this sentence naming no place, because there is nothing
  // there to find."
  "mail.account.deleted.wordpress.already_gone": [
    "",
    { slots: { count: "text" }, fixedBy: "REQ-079 c6" },
  ],
  "mail.account.deleted.wordpress.unreachable": [
    "",
    { slots: { count: "text", place: "text" }, fixedBy: "REQ-079 c6" },
  ],
  "mail.account.deleted.wordpress.unreachable.no_place": [
    "",
    { slots: { count: "text" }, fixedBy: "REQ-079 c6" },
  ],

  // One mail per breakage (BUILD §9, issue #48): a destination has needed
  // reconnecting for 24 hours and the customer has not signed in since it
  // broke. It says pages are being held, how many, and that reconnecting
  // releases them.
  //
  // The count is a `stat` block and not a number inside a sentence: §12's
  // omission rule is the shell's to apply, and a sentence carrying its own
  // numeral would be a second place a count could be formatted. So the
  // body says what is happening, the stat says how many, and neither can
  // print the other's half.
  "mail.account.destinationBroken.subject": ["", { slots: {}, fixedBy: "BUILD §9 · REQ-074 c6" }],
  "mail.account.destinationBroken.body": ["", { slots: {}, fixedBy: "BUILD §9 · REQ-074 c6" }],
  "mail.account.destinationBroken.held": ["", { slots: {}, fixedBy: "BUILD §9 · REQ-074 c6" }],
  "mail.account.destinationBroken.action": ["", { slots: {}, fixedBy: "BUILD §9 · REQ-074 c6" }],

  // ── 2026-09-08, issue #376: UI-SPEC S20, the approved mail shell ──────
  //
  // The owner approved the full screen set on 2026-09-08, and ruling 11a
  // makes its unbracketed strings approved copy as written. S20 is the one
  // mail shell and seven of the ten kinds; every string below is
  // transcribed from that screen, byte for byte, and is **not** owner-owed
  // any more. Its bracketed strings are — `mail.shell.imprint` is the one
  // this partition gains, and it stays empty.
  //
  // The three kinds the set does not draw — `first-page-unavailable`,
  // `setup-reminder`, `account` — gain nothing here. They keep the empty
  // values they had, and `tests/mail/shell/footer.test.ts` names them as
  // the three mails that carry no reason line yet.

  // The shell's own two. The wordmark is above; these are the rest of the
  // footer band the set draws: `ReachKit · [imprint line] · plain-text
  // version attached`.
  "mail.shell.imprint": ["", { slots: {}, fixedBy: "UI-SPEC S20" }],
  "mail.shell.plaintext_note": ["plain-text version attached", { slots: {}, fixedBy: "UI-SPEC S20 (11a)" }],

  // S20's footer line — why this mail arrived — one per kind the set
  // draws. `mail.reason.report` takes the removal address as a slot rather
  // than writing it: `removal.address` is its one home in the product
  // (REQ-002 c1), and a second copy here is exactly what that rule is for.
  "mail.reason.magicLink": [
    "You asked for this link at reachkit.app/signin. If you didn’t, ignore this mail.",
    { slots: {}, fixedBy: "UI-SPEC S20 (11a)" },
  ],
  "mail.reason.report": [
    "Own this site and want the report taken down? Write to {address}.",
    { slots: { address: "text" }, fixedBy: "UI-SPEC S20 (11a)" },
  ],
  "mail.reason.firstPage": [
    "Sent once, because you asked for it on the report. Follow-up mail has an opt-out link.",
    { slots: {}, fixedBy: "UI-SPEC S20 (11a)" },
  ],
  "mail.reason.draftReady": [
    "Daily draft-ready mail · switch off in Settings › Notifications.",
    { slots: {}, fixedBy: "UI-SPEC S20 (11a)" },
  ],
  "mail.reason.published": [
    "Published-page mail · switch off in Settings › Notifications.",
    { slots: {}, fixedBy: "UI-SPEC S20 (11a)" },
  ],
  "mail.reason.weekly": [
    "Monday movement mail · switch off in Settings › Notifications.",
    { slots: {}, fixedBy: "UI-SPEC S20 (11a)" },
  ],
  "mail.reason.nurture": [
    "Opt out of all follow-up: one link, every domain, for good.",
    { slots: {}, fixedBy: "UI-SPEC S20 (11a)" },
  ],

  // The `report` kind — registered in `MAIL_KINDS` since the seam was
  // built and drawn for the first time by the approved set, so this is
  // where its sentences arrive. The subject carries the score and its band
  // word because the set puts them there: a reader decides whether to open
  // it on the number, not on the domain alone (6a names the number).
  "mail.report.subject": [
    "{domain} — Discoverability Score {score}, {band}",
    { slots: { domain: "text", score: "text", band: "text" }, fixedBy: "UI-SPEC S20 (11a)" },
  ],
  "mail.report.heading": ["Your report is ready", { slots: {}, fixedBy: "UI-SPEC S20 (11a)" }],
  "mail.report.body": [
    "The whole verdict is on the report, free and permanent.",
    { slots: {}, fixedBy: "UI-SPEC S20 (11a)" },
  ],
  "mail.report.action": ["Open the report", { slots: {}, fixedBy: "UI-SPEC S20 (11a)" }],
  "mail.report.fact.score": ["Discoverability Score", { slots: {}, fixedBy: "UI-SPEC 6a" }],
  "mail.report.fact.aiAnswers": ["AI answers", { slots: {}, fixedBy: "UI-SPEC S20 (11a)" }],
  "mail.report.fact.googleSearch": ["Google search", { slots: {}, fixedBy: "UI-SPEC S20 (11a)" }],

  // The headings S20 gives the kinds whose heading is a sentence rather
  // than a page title. `first-page`, `draft-ready` and `published` head on
  // the page's own title, which is data and arrives through a slot.
  "mail.magicLink.heading": ["Sign in to ReachKit", { slots: {}, fixedBy: "UI-SPEC S20 (11a)" }],
  "mail.magicLink.fact.for": ["for", { slots: {}, fixedBy: "UI-SPEC S20 (11a)" }],
  "mail.firstPage.heading": ["{title}", { slots: { title: "text" }, fixedBy: "UI-SPEC S20 (11a)" }],
  "mail.firstPage.fact.format": ["format", { slots: {}, fixedBy: "UI-SPEC S20 (11a)" }],
  "mail.draftReady.heading": ["{title}", { slots: { title: "text" }, fixedBy: "UI-SPEC S20 (11a)" }],
  "mail.draftReady.body": [
    "Publishes tomorrow at 07:00 unless you say no.",
    { slots: {}, fixedBy: "UI-SPEC S20 (11a)" },
  ],
  "mail.draftReady.fact.search": ["search", { slots: {}, fixedBy: "UI-SPEC S20 (11a)" }],
  "mail.draftReady.fact.answeredBy": ["answered today by", { slots: {}, fixedBy: "UI-SPEC S20 (11a)" }],
  "mail.draftReady.fact.you": ["you", { slots: {}, fixedBy: "UI-SPEC S20 (11a)" }],
  "mail.published.body": [
    "Verified at its address after 24 hours.",
    { slots: {}, fixedBy: "UI-SPEC S20 (11a)" },
  ],
  "mail.published.action": ["View the page", { slots: {}, fixedBy: "UI-SPEC S20 (11a)" }],
  "mail.weekly.heading": ["What moved this week", { slots: {}, fixedBy: "UI-SPEC S20 (11a)" }],
  "mail.weekly.body": [
    "Only what was measured. A number that was not measured is not here.",
    { slots: {}, fixedBy: "UI-SPEC S20 (11a)" },
  ],
  "mail.weekly.action": ["Open the overview", { slots: {}, fixedBy: "UI-SPEC S20 (11a)" }],
  "mail.nurture.action": ["Start ReachKit €49", { slots: {}, fixedBy: "UI-SPEC S20 (11a)" }],

  // ── The one mail nobody outside this company ever receives (issue #329,
  // BUILD §6.5): the owner, told that the product's daily spend crossed a
  // line or that the kill switch moved.
  //
  // **Owner-owed as `''`, never `TODO(copy)`** — DECISIONS 2026-09-05,
  // "mail keeps the throw (a mail never ships a placeholder)". Until the
  // owner writes these, `copy()` refuses the key, `sendEmail` answers
  // `not-composable`, and the alert does not go out. That is the designed
  // standing and not a gap: the guard itself — the refusal at the door and
  // the ceiling in the seam — is what stops the spend, and it works with
  // no sentence written at all. The mail only tells someone about it.
  //
  // One subject over all three occasions, three bodies. The occasions are
  // one event to the reader ("something about spending changed") and the
  // subject line is where that reader decides whether to look now, so
  // splitting it three ways would buy nothing and owe the owner two more
  // sentences. The body is where they differ, and they differ completely.
  "mail.ops.spend-ceiling.subject": ["", { slots: {}, fixedBy: "BUILD §6.5 · issue 329" }],
  "mail.ops.spend-ceiling.heading": ["", { slots: {}, fixedBy: "BUILD §6.5 · issue 329" }],
  /** Crossed `SPEND_ALERT_AT.warn` of the day's ceiling — nothing has been
   *  refused yet; this is the hour to look. */
  "mail.ops.spend-ceiling.warn": ["", { slots: {}, fixedBy: "BUILD §6.5 · issue 329" }],
  /** Reached the ceiling: free scanning is refused for the rest of the UTC
   *  day and paid passes are holding. */
  "mail.ops.spend-ceiling.reached": ["", { slots: {}, fixedBy: "BUILD §6.5 · issue 329" }],
  /** The switch, found engaged. There is no released twin: a release
   *  cannot be told from an ordinary boot without durable state, so the
   *  sentence is not owed until the telling exists. */
  "mail.ops.spend-ceiling.kill-switch-engaged": ["", { slots: {}, fixedBy: "BUILD §6.5 · issue 329" }],
  /** The two mono fact rows the S20 shell draws under the line. The
   *  figures reach them as already-written values (cents, as integers);
   *  these are their labels, and the unit is the owner's word to choose. */
  "mail.ops.spend-ceiling.fact.spent": ["", { slots: {}, fixedBy: "BUILD §6.5 · issue 329" }],
  "mail.ops.spend-ceiling.fact.ceiling": ["", { slots: {}, fixedBy: "BUILD §6.5 · issue 329" }],
}) satisfies CopyPartition;
