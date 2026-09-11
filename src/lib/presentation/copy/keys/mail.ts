// 2026-09-10, issue #458: every key in this partition carries the owner's
// approved string. The owner approved the master's drafted set that day
// ("copy proposal approved"); the strings are applied byte for byte, and
// no key here is owner-owed any more — none is empty, none carries the
// `TODO(copy)` marker. Ruling 11a strings already here were not touched.
//
// src/lib/presentation/copy/keys/mail.ts — BP-020 decision 5, WO-041
//
// The mail seam's sentences, BP-016 and BP-029. Two keys seeded (WO-041
// step 4): the opt-out confirmation and invalid-token lines. BP-029 owns
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
   *  **It has to be its own key.** The set draws only the confirmation,
   *  so 11a writes no eyebrow for the other two arms, and "Opted out" over
   *  "that link isn’t valid any more" would be the page contradicting
   *  itself in its own head. */
  "optout.head.unresolved": ["Not opted out", { slots: {}, fixedBy: "REQ-010 c11 · UI-SPEC S7 (12a)" }],

  // 2026-09-05, issue #30 (the mail seam, BUILD §12). Six keys the shell
  // and the whole-mail line need. Five are sentences the product speaks in
  // its own voice (filled by #458). The sixth is the product's own name,
  // transcribed — not a sentence, on the
  // same footing as the em-dash and the removal address that two other
  // partitions transcribe. (Those two keys are not named here: issue #28's
  // `tests/app/scan-address/removal.test.tsx` asserts one of them appears
  // in exactly one file under `src/`, and a comment naming it is a second.)

  "mail.shell.wordmark": ["ReachKit", { slots: {}, fixedBy: "§12" }],
  "mail.nothing_to_report": ["There is nothing to report this week.", { slots: {}, fixedBy: "§12" }],
  "mail.week_unmeasured": ["This week could not be measured. The next measurement is due {nextDue}.", { slots: { nextDue: "date" }, fixedBy: "§12" }],
  "mail.week_partly_measured": ["Part of this week could not be measured: {sections}. Those sections are left out rather than shown as zero.", { slots: { sections: "text" }, fixedBy: "§12" }],

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
  // six different measurements, and a name is not a value.
  //
  // They are `mail.section.*` and not `mail.weekly.section.*`: the same
  // six parts are what §4.5's own account of a partial week names, and one
  // set of names is what stops a screen and a mail calling one measurement
  // two things.
  "mail.section.on_page": ["your pages", { slots: {}, fixedBy: "REQ-064 c4" }],
  "mail.section.market": ["your market", { slots: {}, fixedBy: "REQ-064 c4" }],
  "mail.section.rankings": ["Google search", { slots: {}, fixedBy: "REQ-064 c4" }],
  "mail.section.ai_answers": ["AI answers", { slots: {}, fixedBy: "REQ-064 c4" }],
  "mail.section.rivals": ["rivals", { slots: {}, fixedBy: "REQ-064 c4" }],
  "mail.section.score": ["Discoverability Score", { slots: {}, fixedBy: "REQ-064 c4" }],
  "mail.unsubscribe.label": ["Switch off this mail", { slots: {}, fixedBy: "§12" }],
  "mail.optout.label": ["Opt out of all follow-up mail", { slots: {}, fixedBy: "§12" }],

  // 2026-09-05, issue #31 (lead capture, the giveaway page and the nurture
  // sequence, `SPEC.md` §4.2). Twenty-one keys.
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
  "mail.firstPage.volume_label": ["asked", { slots: {}, fixedBy: "REQ-010 c4" }],
  "mail.firstPage.volume_note": ["Searches per month, measured on US Google in English.", { slots: {}, fixedBy: "REQ-010 c4" }],
  "mail.firstPage.first_of_n": [
    "The complete page, copy-ready, in Markdown and HTML. That’s page 1 of {pagesFound} we found for you.",
    { slots: { pagesFound: "text" }, fixedBy: "REQ-010 c4 · UI-SPEC S20 (11a)" },
  ],

  // The message that closes the request when no page is coming (c7), one
  // line per cause.
  "mail.firstPageUnavailable.subject": ["No page this time", { slots: {}, fixedBy: "REQ-010 c7" }],
  "mail.firstPageUnavailable.no-page-to-write": ["The page you asked for isn’t coming: the report for this domain no longer offers one to write, and no page is invented to fill the slot.", { slots: {}, fixedBy: "REQ-010 c7" }],
  "mail.firstPageUnavailable.writing-failed": ["The page you asked for isn’t coming: ReachKit could not write it. Nothing was sent in its place.", { slots: {}, fixedBy: "REQ-010 c7" }],
  "mail.firstPageUnavailable.writing-refused": ["The page you asked for isn’t coming: what was written did not pass ReachKit’s own checks, so it was not sent.", { slots: {}, fixedBy: "REQ-010 c7" }],
  "mail.firstPageUnavailable.delivery-failed": ["The page you asked for isn’t coming: it could not be delivered to the address you gave.", { slots: {}, fixedBy: "REQ-010 c7" }],

  // The three touches (c9). One subject and one line each; the touch is
  // carried by the key, never by a conditional inside a template.
  "mail.nurture.subject.1": ["The rest of the pages we found", { slots: {}, fixedBy: "REQ-010 c9" }],
  "mail.nurture.subject.2": ["What changes once the pages ship", { slots: {}, fixedBy: "REQ-010 c9" }],
  "mail.nurture.subject.3": ["One last note about your report", { slots: {}, fixedBy: "REQ-010 c9" }],
  "mail.nurture.body.1": ["You have page 1 for {domain}. ReachKit writes the rest — one page a day, published for you, and every page waits 24 hours for you to stop it before it goes live. €49 a month, cancel any time.", { slots: { domain: "text" }, fixedBy: "REQ-010 c9" }],
  "mail.nurture.body.2": ["Every page ReachKit writes for {domain} targets one search your rivals already answer. Each Monday it re-measures your whole market and tells you what moved — only what was measured, never a guess.", { slots: { domain: "text" }, fixedBy: "REQ-010 c9" }],
  "mail.nurture.body.3": ["This is the last follow-up about {domain}. Your report and your first page stay yours. When you want the rest written and published, ReachKit starts at €49 a month, cancel any time.", { slots: { domain: "text" }, fixedBy: "REQ-010 c9" }],

  // BUILD §4.3's setup reminder (REQ-025 c6). Three keys: the subject, the
  // one line asking them to finish, and the label on the sign-in link that
  // lands them back on the setup screen.
  "mail.setupReminder.subject": ["Finish your setup", { slots: {}, fixedBy: "REQ-025 c6" }],
  "mail.setupReminder.body": ["Setup is waiting for you: three questions, then your first page gets written.", { slots: {}, fixedBy: "REQ-025 c6" }],
  "mail.setupReminder.action": ["Finish setup", { slots: {}, fixedBy: "REQ-025 c6" }],

  // What `POST /api/lead` answers with. The adapter maps each arm of
  // `captureLead()` to one of these keys and never to a sentence of its
  // own or a vendor payload (REQ-003 c10, REQ-010 c1).
  "lead.accepted": ["Got it. Your page is being written and goes to that address as soon as it is done.", { slots: {}, fixedBy: "REQ-010 c1" }],
  "lead.invalid_address": ["That doesn’t look like an email address. Try the form you@company.com.", { slots: {}, fixedBy: "REQ-010 c1" }],
  "lead.unavailable": ["Your address couldn’t be saved just now, so nothing was sent. Try again in a few minutes.", { slots: {}, fixedBy: "REQ-003 c10" }],

  // The third arm of the opt-out page: the link is good and our store is
  // not. Telling the reader their link is invalid would be a false
  // statement about the one thing they came to do. This is the one key on
  // this list a *screen* reads through `copy()` (issue #261).
  "optout.unavailable": ["That opt-out couldn’t be applied just now, so nothing has changed. Try the link again in a few minutes, or reply to any ReachKit email with \"stop\" and we’ll stop by hand.", { slots: {}, fixedBy: "REQ-010 c11" }],

  // 2026-09-06, issue #33 (Stripe, provisioning and the two backstops,
  // `SPEC.md` §13). Nine keys.
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
  "mail.account.chase.subject": ["Payment received", { slots: {}, fixedBy: "REQ-024 c5" }],
  "mail.account.chase.link_ready": ["Your payment went through and your account is open. Nobody has signed in yet — here is your way in.", { slots: {}, fixedBy: "REQ-024 c5" }],
  "mail.account.chase.not_open_yet": ["Your payment went through. Your account is not open yet; we are opening it, and a sign-in link follows as soon as it is. Nothing more is charged.", { slots: {}, fixedBy: "REQ-024 c5" }],

  // The second-purchase mail (REQ-024 c3): what a founder whose second
  // purchase was charged is told.
  "mail.account.second_purchase.subject": ["A second payment", { slots: {}, fixedBy: "REQ-024 c3" }],
  "mail.account.no_second_subscription": ["A second payment from this address went through, but it bought no second subscription. You still have one account, one site and one running subscription; nothing else was created.", { slots: {}, fixedBy: "REQ-024 c3" }],

  // The one way to reach a person, named in every `account` mail REQ-024
  // requires it in (c3, c5). One key, so the address is written once.
  "mail.account.reach_a_person": ["To reach a person, reply to this mail.", { slots: {}, fixedBy: "REQ-024 c5" }],

  // 2026-09-06, issue #35 (identity, REQ-077 c3). The one `account` mail
  // that goes to the address an account has just stopped signing in with:
  // "saying the account now signs in at a different address and this one no
  // longer can". Two keys.
  //
  // No slot on either. The mail arrives at the old address, so naming it
  // says nothing, and naming the new one would put the account's live
  // credential-bearing address into the mailbox the customer is leaving.
  "mail.account.address_moved.subject": ["Sign-in changed", { slots: {}, fixedBy: "REQ-077 c3" }],
  "mail.account.address_moved": ["Your ReachKit account now signs in at a different email address. This one can no longer sign in, and every mail from ReachKit now goes to the new address.", { slots: {}, fixedBy: "REQ-077 c3" }],

  // 2026-09-06, issue #47 (REQ-063 c4, REQ-064, BUILD §12's `weekly` row:
  // "score delta, AI answers delta, pages verdicts, next 3 — all values
  // conditional: a missing number omits its section, never prints 0").
  // Eleven keys.
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
  // out at all, so the approved subject carries no number (issue #388).
  "mail.weekly.subject": ["Monday: what moved this week", { slots: {}, fixedBy: "§12" }],
  "mail.weekly.score": ["Discoverability Score", { slots: {}, fixedBy: "UI-SPEC 6a" }],
  "mail.weekly.aiAnswers": ["AI answers", { slots: {}, fixedBy: "§12 · UI-SPEC S20 (11a)" }],
  "mail.weekly.verdicts": ["pages judged", { slots: {}, fixedBy: "REQ-063 c4" }],
  "mail.weekly.verdicts.none": ["No pages published yet, so none to judge.", { slots: {}, fixedBy: "REQ-064 c3" }],
  "mail.weekly.next": ["next three", { slots: {}, fixedBy: "§12" }],
  "mail.weekly.next.none": ["Nothing next: no open opportunity is left, and the calendar is never padded.", { slots: {}, fixedBy: "REQ-064 c3" }],
  "mail.weekly.next.item": ["{search}", { slots: { search: "text" }, fixedBy: "§12" }],

  // The three forms a judged page's row takes. Three sentences and not one
  // with a conditional: "this page" and "this page, which moved from here
  // to there since the date it was measured" and "…, over an interval
  // longer than a week" are three different statements, and REQ-063 c4
  // requires the third whenever the measurement compared against is not
  // the previous week's. A template that chose between them with an `if`
  // would be one edit away from stating a span it did not have.
  "mail.weekly.page": ["{page}", { slots: { page: "text" }, fixedBy: "REQ-063 c4" }],
  "mail.weekly.page.moved": [
    "{page} · was {from}, now {to} · measured {measuredAt}",
    { slots: { page: "text", from: "text", to: "text", measuredAt: "date" }, fixedBy: "REQ-063 c3" },
  ],
  "mail.weekly.page.moved_over": [
    "{page} · was {from}, now {to} over {weeks} weeks · measured {measuredAt}",
    {
      slots: { page: "text", from: "text", to: "text", measuredAt: "date", weeks: "text" },
      fixedBy: "REQ-063 c4",
    },
  ],

  // The end of hosting (REQ-076 c11, issue #34): the two notices a customer
  // with pages on the hosted CMS is owed before those pages stop being
  // served — one when their access ends, however it ends, and one
  // HOSTING_END_REMINDER_DAYS before the day serving stops. Same `account`
  // kind.
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
  "mail.account.hosting_end.access_ended.subject": ["Your access ended", { slots: {}, fixedBy: "REQ-076 c11" }],
  "mail.account.hosting_end.seven_days.subject": ["Hosting ends soon", { slots: {}, fixedBy: "REQ-076 c11" }],
  "mail.account.hosting_end.stops_on": ["ReachKit stops serving your hosted pages on {date}. Until that day they stay live, unchanged.", { slots: { date: "date" }, fixedBy: "REQ-076 c11" }],
  "mail.account.hosting_end.export_stays": ["Your content export stays available afterwards, with no end date.", { slots: {}, fixedBy: "REQ-076 c11" }],

  // 2026-09-06, issue #46 (the telling, §9 · §12). Seven keys.
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
  // by the set; their lines are the owner's 2026-09-10 approval (#458).
  "mail.draftReady.autopilotWindow": [
    "Publishes {publishesAt} unless you say no.",
    { slots: { publishesAt: "date" }, fixedBy: "REQ-057 c1 · UI-SPEC S20 (11a)" },
  ],
  "mail.draftReady.autopilotZero": [
    "Publishes {publishesAt}. No veto window set.",
    { slots: { publishesAt: "date" }, fixedBy: "REQ-057 c7" },
  ],
  "mail.draftReady.copilot": ["It will not publish until you approve it.", { slots: {}, fixedBy: "REQ-057 c1" }],

  // Four for REQ-057 c9's destination clause — what the telling says about
  // a page bound for the customer's own site. `{site}` is the address the
  // page goes live at, never a credential.
  //
  // Three of them differ only in what they say about *when*, which is
  // exactly the distinction c9 draws: "it says the page goes live there
  // then" (an interval), "goes live there only once they approve"
  // (copilot), and the zero-window case where it goes live at the stated
  // moment with no interval at all.
  "mail.draftReady.dest.goesLiveThen": ["It goes live on {site} at that moment, readable by anyone. It does not wait there as a draft.", { slots: { site: "text" }, fixedBy: "REQ-057 c9" }],
  "mail.draftReady.dest.goesLiveAtOnce": ["It goes live on {site} the moment it publishes, readable by anyone. It does not wait there as a draft.", { slots: { site: "text" }, fixedBy: "REQ-057 c9" }],
  "mail.draftReady.dest.goesLiveOnApproval": [
    "It goes live on {site} only once you approve it, readable by anyone from then on. Nothing reaches the site before that.",
    { slots: { site: "text" }, fixedBy: "REQ-057 c9" },
  ],
  // The site cannot be published to as things stand. It says what the
  // customer must change — and it never says the page will not go live at
  // the moment the mail names, because c9's final sentence keeps the date,
  // the interval and the stop action exactly as the other criteria set
  // them.
  "mail.draftReady.dest.cannotPublish": ["ReachKit cannot publish to {site} as things stand. Open Settings › Publishing: the destination there says what to change before this page can go live.", { slots: { site: "text" }, fixedBy: "REQ-057 c9" }],

  // 2026-09-07, issue #174. The two the mail itself owed, beside the seven
  // the telling already had: §12's `draft-ready` had a decision and no
  // template, so the customer was never told a page was in review.
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
  // There is no key for the page's *title*. It is model-written, and it
  // travels in the `pageBody` block, whose label carries it —
  // `generated.page.written` is the sentence that names it, and it is
  // already minted. A `mail.draftReady.title` key would be that same title
  // with ADR-012's label stripped off.
  "mail.draftReady.why.search": ["Written for the search “{query}”.", { slots: { query: "text" }, fixedBy: "BUILD §12 · §7" }],
  "mail.draftReady.why.volume": ["asked", { slots: {}, fixedBy: "BUILD §12 · §7" }],
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
  // Sixteen keys.
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
  // schema test behind it (issue #388). The approved subject names no
  // title.
  "mail.published.subject": ["Your page, checked after 24 hours", { slots: {}, fixedBy: "REQ-062 c5" }],
  "mail.published.verified": ["Live at its address as of {checkedAt}.", { slots: { checkedAt: "date" }, fixedBy: "REQ-062 c5" }],
  "mail.published.not_found": ["No page at that address, {checkedAt}.", { slots: { checkedAt: "date" }, fixedBy: "REQ-062 c4" }],
  "mail.published.not_confirmed": ["Could not be confirmed, {checkedAt}.", { slots: { checkedAt: "date" }, fixedBy: "REQ-062 c4" }],
  "mail.published.address_label": ["address", { slots: {}, fixedBy: "REQ-062 c5" }],
  /** The second fact row's label, and it has to be its own key (issue
   *  #457).
   *
   *  `mail.published.verified` is the found arm's **paragraph** — it
   *  carries `{checkedAt}`, because criterion 5 makes the line state when
   *  the check ran. A facts label is read with no vars at all
   *  (`blocks/html.ts`'s `factRowsOf`), so the same key in both places
   *  throws at compose time the moment the owner's sentence lands, and
   *  every found-arm published mail with it. Two readings, two keys.
   *
   *  Written, not owed: S20 draws this row as "verified", unbracketed, so
   *  ruling 11a makes it approved copy and it is transcribed byte for
   *  byte. */
  "mail.published.verified_label": ["verified", { slots: {}, fixedBy: "REQ-062 c5 · UI-SPEC S20" }],

  // The four outcomes, as the four subjects of a `verdicts` block, and the
  // three words one of them can carry. Split this way so the four names
  // are written once each and the three verdicts once each, rather than
  // twelve sentences that could disagree with one another.
  //
  // `check_not_measured` is its own word and is never `check_failed`: a
  // check ReachKit could not observe is not a check this page failed, and
  // saying so would blame the customer's page for a condition of the site
  // it sits in (criterion 6).
  "mail.published.checks_label": ["24-hour checks", { slots: {}, fixedBy: "REQ-062 c5" }],
  "mail.published.checks_empty": ["No check outcomes were recorded.", { slots: {}, fixedBy: "REQ-062 c5" }],
  "mail.published.check.reachable": ["reachable", { slots: {}, fixedBy: "REQ-062 c1" }],
  "mail.published.check.indexable": ["indexable", { slots: {}, fixedBy: "REQ-062 c1" }],
  "mail.published.check.sitemap": ["in the sitemap", { slots: {}, fixedBy: "REQ-062 c1" }],
  "mail.published.check.ai_readable": ["AI-readable", { slots: {}, fixedBy: "REQ-062 c1" }],
  "mail.published.check_passed": ["passed", { slots: {}, fixedBy: "REQ-062 c3" }],
  "mail.published.check_failed": ["failed", { slots: {}, fixedBy: "REQ-062 c3" }],
  "mail.published.check_not_measured": ["not confirmed", { slots: {}, fixedBy: "REQ-062 c6" }],

  // Criterion 6's condition of the site, named separately from the page's
  // own outcomes and stated as the customer's own to act on. Two kinds,
  // two lines, each carrying the date it was found — a condition is only
  // ever as fresh as the last page checked on that site, and ReachKit
  // never goes back to look.
  "mail.published.site_condition.publishes_no_sitemap": [
    "Your site publishes no sitemap, as of {foundAt}. That is a condition of the site, not of this page, and it is yours to fix.",
    { slots: { foundAt: "date" }, fixedBy: "REQ-062 c6" },
  ],
  "mail.published.site_condition.robots_blocks_site": [
    "Your site’s robots policy blocks AI crawlers across the whole site, as of {foundAt}. That is a condition of the site, not of this page, and it is yours to change.",
    { slots: { foundAt: "date" }, fixedBy: "REQ-062 c6" },
  ],

  // ── The one `account` mail a deleted account leaves behind (issue #52)
  //
  // REQ-079 criterion 6. Deletion leaves the customer no ReachKit surface to
  // read, so the naming criterion 4 puts on such a surface is carried by
  // this mail instead — sent to the address being deleted, and only where
  // something of either kind is left behind. Same `account` kind.
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
  "mail.account.deleted.subject": ["Account deleted", { slots: {}, fixedBy: "REQ-079 c6" }],
  // The pages still live at a destination that could not be reached: the
  // mail "names it and says what they must do about it".
  "mail.account.deleted.still_live": ["Pages still live at a destination ReachKit could not reach: {count}. Taking them down there is now yours to do — ReachKit no longer can.", { slots: { count: "text" }, fixedBy: "REQ-079 c6" }],
  // "The mail says of every post still in that site that it is theirs to
  // keep or remove" — its own key, because a promise living inside another
  // sentence is one edit away from being dropped without anything failing.
  "mail.account.deleted.theirs_to_keep": ["Every post still in your site is yours to keep or remove.", { slots: {}, fixedBy: "REQ-079 c6" }],
  "mail.account.deleted.wordpress.returned_to_draft": [
    "Posts ReachKit made live in your WordPress and has now returned to draft: {count}. Nothing else about them changed. They come up together at {place}.",
    { slots: { count: "text", place: "text" }, fixedBy: "REQ-079 c6" },
  ],
  "mail.account.deleted.wordpress.returned_to_draft.no_place": [
    "Posts ReachKit made live in your WordPress and has now returned to draft: {count}. Nothing else about them changed. They are in your site; ReachKit cannot point to them there.",
    { slots: { count: "text" }, fixedBy: "REQ-079 c6" },
  ],
  "mail.account.deleted.wordpress.named_for_removal": [
    "Posts ReachKit created in your WordPress and never made live: {count}. Nobody published them, they were never public, and nothing was written into them. They come up together at {place}.",
    { slots: { count: "text", place: "text" }, fixedBy: "REQ-079 c6" },
  ],
  "mail.account.deleted.wordpress.named_for_removal.no_place": [
    "Posts ReachKit created in your WordPress and never made live: {count}. Nobody published them, they were never public, and nothing was written into them. They are in your site; ReachKit cannot point to them there.",
    { slots: { count: "text" }, fixedBy: "REQ-079 c6" },
  ],
  // No place form: "this sentence naming no place, because there is nothing
  // there to find."
  "mail.account.deleted.wordpress.already_gone": [
    "Posts no longer in your site when ReachKit went to return them: {count}. There was nothing there to change.",
    { slots: { count: "text" }, fixedBy: "REQ-079 c6" },
  ],
  "mail.account.deleted.wordpress.unreachable": [
    "Posts in a site ReachKit could not reach: {count}. They may still be live there, and nothing was written into them. They come up together at {place}.",
    { slots: { count: "text", place: "text" }, fixedBy: "REQ-079 c6" },
  ],
  "mail.account.deleted.wordpress.unreachable.no_place": [
    "Posts in a site ReachKit could not reach: {count}. They may still be live there, and nothing was written into them. ReachKit cannot point to them in that site.",
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
  "mail.account.destinationBroken.subject": ["Reconnect needed", { slots: {}, fixedBy: "BUILD §9 · REQ-074 c6" }],
  "mail.account.destinationBroken.body": ["A destination needs reconnecting. Pages are being held; reconnecting releases them.", { slots: {}, fixedBy: "BUILD §9 · REQ-074 c6" }],
  "mail.account.destinationBroken.held": ["pages held", { slots: {}, fixedBy: "BUILD §9 · REQ-074 c6" }],
  "mail.account.destinationBroken.action": ["Reconnect", { slots: {}, fixedBy: "BUILD §9 · REQ-074 c6" }],

  // ── 2026-09-08, issue #376: UI-SPEC S20, the approved mail shell ──────
  //
  // The owner approved the full screen set on 2026-09-08, and ruling 11a
  // makes its unbracketed strings approved copy as written. S20 is the one
  // mail shell and seven of the ten kinds; every string below is
  // transcribed from that screen, byte for byte. Its bracketed strings —
  // `mail.shell.imprint` is the one this partition gained — are the
  // owner's 2026-09-10 approval (#458).
  //
  // The three kinds the set does not draw — `first-page-unavailable`,
  // `setup-reminder`, `account` — gain nothing here.

  // The shell's own two. The wordmark is above; these are the rest of the
  // footer band the set draws: `ReachKit · [imprint line] · plain-text
  // version attached`.
  "mail.shell.imprint": ["[[imprint: owner fills legal entity, city]]", { slots: {}, fixedBy: "UI-SPEC S20" }],
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
  // One subject over all three occasions, three bodies. The occasions are
  // one event to the reader ("something about spending changed") and the
  // subject line is where that reader decides whether to look now, so
  // splitting it three ways would buy nothing and owe the owner two more
  // sentences. The body is where they differ, and they differ completely.
  "mail.ops.spend-ceiling.subject": ["Spend alert", { slots: {}, fixedBy: "BUILD §6.5 · issue 329" }],
  "mail.ops.spend-ceiling.heading": ["Spend ceiling", { slots: {}, fixedBy: "BUILD §6.5 · issue 329" }],
  /** Crossed `SPEND_ALERT_AT.warn` of the day's ceiling — nothing has been
   *  refused yet; this is the hour to look. */
  "mail.ops.spend-ceiling.warn": ["Today’s spend has crossed the warning line, most of the way to the daily ceiling. Nothing has been refused yet — this is the hour to look.", { slots: {}, fixedBy: "BUILD §6.5 · issue 329" }],
  /** Reached the ceiling: free scanning is refused for the rest of the UTC
   *  day and paid passes are holding. */
  "mail.ops.spend-ceiling.reached": ["Today’s spend has reached the daily ceiling. Free scanning is refused for the rest of the UTC day; paid passes are holding.", { slots: {}, fixedBy: "BUILD §6.5 · issue 329" }],
  /** The switch, found engaged. There is no released twin: a release
   *  cannot be told from an ordinary boot without durable state, so the
   *  sentence is not owed until the telling exists. */
  "mail.ops.spend-ceiling.kill-switch-engaged": ["The kill switch is engaged. Scanning, generating and publishing are stopped until it is released.", { slots: {}, fixedBy: "BUILD §6.5 · issue 329" }],
  /** The two mono fact rows the S20 shell draws under the line. The
   *  figures reach them as already-written values (cents, as integers);
   *  these are their labels, and the unit is the owner's word to choose. */
  "mail.ops.spend-ceiling.fact.spent": ["spent today, in cents", { slots: {}, fixedBy: "BUILD §6.5 · issue 329" }],
  "mail.ops.spend-ceiling.fact.ceiling": ["daily ceiling, in cents", { slots: {}, fixedBy: "BUILD §6.5 · issue 329" }],
}) satisfies CopyPartition;
