// src/lib/presentation/copy/keys/publish.ts — BP-020 decision 5, WO-041
//
// Publishing's sentences. Seeded empty by WO-041; the block that owns
// publishing fills this file and touches no other partition.
//
// 2026-09-10, issue #459: the owner approved the drafted copy for
// every key this partition still owed ("copy proposal approved"; proposal
// sheet artifact 546f45a0-a996-4d25-b85e-fb03fda7b102), and the 38 approved
// strings are applied here byte for byte. Where a note below says how a
// key stood before, that was its standing before this date.
//
// 2026-09-11, issue #516: `record.verification.never.noLiveAddress` was the
// one key #459 held — its drafted sentence clipped the record's badge at
// 320 px — and the owner approved a badge-length string for it (DECISIONS
// 2026-09-11), applied byte for byte.
//
// 2026-09-06, issue #47 (REQ-063): the four words a published page's
// weekly standing is spoken as. They live here, and not in `keys/mail.ts`,
// because they are not the mail's: §4.5's Overview and §4.6's calendar
// speak the same four, and one home is what stops a screen and a mail
// wording the same verdict differently. The first surface to read these is
// the Monday mail, where "a mail never ships a placeholder" (the owner's
// 2026-09-05 ruling on #93); they stood empty until the owner approved
// them on 2026-09-10 (#459).
//
// The fourth is not a fourth verdict: REQ-063 c6's page carries it "in
// place of the three", and the line naming *which* of the five causes
// happened, with the date of the last verdict it received, is a separate
// sentence a screen speaks — owner-owed and not minted here (the mail
// carries the standing, not the explanation).
import type { CopyPartition } from "../registry.ts";

export const PUBLISH_COPY = Object.freeze({
  "verdict.page.working": ["Working", { slots: {} }],
  "verdict.page.too_early": ["Too early to judge", { slots: {} }],
  "verdict.page.not_working": ["Not working", { slots: {} }],
  "verdict.page.not_judgeable": ["No longer judgeable", { slots: {} }],

  // 2026-09-06, issue #46 (BUILD §9, REQ-045 c4). The two things the three
  // draft actions can answer when the state machine refuses.
  //
  // They are two keys and not one because the two refusals are two
  // different facts about the customer's page: the action is not one the
  // page can take from where it is (`not_a_transition` — someone else
  // already moved it, or the control was stale), or it is and something
  // named is holding it (`guard`). Collapsing them would tell a customer
  // whose page had already published that "something is holding it".
  //
  // The `{state}` slot is the state the page still holds — the refusal
  // never leaves it somewhere else.
  "publish.action.refused.notATransition": [
    "Nothing changed. That can’t be done while the page is {state}.",
    { slots: { state: "text" } },
  ],
  "publish.action.refused.guard": [
    "Nothing changed. The reason is shown on this page.",
    { slots: {} },
  ],

  // 2026-09-06, issue #50 (REQ-062 / REQ-056 c6). The page record's
  // address labels. Three keys, all three sentences the owner's.
  //
  // **The pair is two keys and never one key with the tense interpolated
  // into it.** "The address this page is publicly readable at" and "the
  // address this page was published at" are a customer-visible
  // distinction — the second is said of a page ReachKit has stopped
  // serving, and ReachKit never goes back to look — so making the tense a
  // variable substitution would put half a sentence in the module that
  // supplies the address. Which of the two a record earns is decided by
  // the page's **current state**, not by what ReachKit once did to it
  // (`src/lib/publish/record/index.ts`).
  //
  // The third is said **in place of** an address, for a page ReachKit
  // never made live at its destination: that arm of `RecordedAddress`
  // carries no `url` field at all, so this line is the whole of what the
  // record offers there.
  "record.address.publiclyReadableAt": ["Publicly readable at", { slots: {} }],
  "record.address.wasPublishedAt": ["Was published at", { slots: {} }],
  "record.address.neverMadeLive": ["This page hasn’t been made live, so it has no address yet.", { slots: {} }],

  // The record as a customer reads it (issue #217): the block's heading,
  // its three row labels, the seven verification lines and the five
  // unpublish outcomes. Until #217 the record had no surface at all, so
  // none of these had a place to be said.
  //
  // **`pageNotFound` and `couldNotConfirm` are two keys and must stay
  // two** — ADR-085's landmine, at the surface. They are the same quiet
  // line to look at and have opposite consequences: one stops the page
  // being shown as live and retires it from weekly judgement, the other
  // asserts nothing and leaves the page exactly as it was. Wording them
  // apart is the owner's, and it is the point of them being separate keys
  // rather than one with a variable in it.
  //
  // **`due` states no moment.** "The check is due" is about now, and a
  // date printed beside it would read as an observation ReachKit has not
  // made. The two `never` arms state none either: no check will run, so
  // there is nothing to date.
  "record.title": ["Page Record", { slots: {} }],
  "record.label.address": ["Address", { slots: {} }],
  "record.label.checked": ["Checked", { slots: {} }],
  "record.label.taken-down": ["Taken down", { slots: {} }],
  "record.verification.found": ["found live", { slots: {} }],
  "record.verification.pageNotFound": ["no page found at this address", { slots: {} }],
  "record.verification.couldNotConfirm": ["check not confirmed", { slots: {} }],
  "record.verification.notYet": ["first check at", { slots: {} }],
  "record.verification.due": ["check due now", { slots: {} }],
  "record.verification.never.takenDownFirst": ["taken down before its check", { slots: {} }],
  "record.verification.never.noLiveAddress": ["not checked", { slots: {} }],
  "record.unpublished.removed": ["removed from your hosted blog", { slots: {} }],
  "record.unpublished.returnedToDraft": ["returned to draft in your WordPress", { slots: {} }],
  "record.unpublished.namedForRemoval": ["never live there, yours to remove", { slots: {} }],
  "record.unpublished.alreadyGone": ["already gone from your site", { slots: {} }],
  "record.unpublished.unreachable": ["your site couldn’t be reached; the post may still be live", { slots: {} }],

  // The eight below are the destination lines (§9, issue #48): one written
  // line per `HealthReason`, which is what a broken destination says under
  // the state word beside it. The state words themselves are
  // `settings.destination.health.*` and are not restated here — one
  // sentence lives in one key.
  //
  // **These are lines, not error messages.** §9 makes a broken destination
  // a state the customer can fix — "expired credential is a **state**
  // (reconnect prompt, queue holds), not an error loop" — so each says what
  // is true of their pages and what fixes it, and none is a technical
  // message anybody is asked to interpret. No vendor payload, status code
  // or credential fragment can reach one: the view these hang off carries
  // only a state, a reason token, a count and these keys.
  //
  // `publish.destination.line.cannot-publish` carries a second, stated
  // constraint (ADR-086 decision 3): its sentence must **not** say pages
  // are being held and nothing has been lost, because in that state the
  // credential is valid and the page has already failed rather than been
  // held. Wording that distinction is the owner's.
  // What a short pack lacked, one phrase per handle; the draft's pack card lists them.
  "publish.needs-you.pack.need.options": [
    "three options to compare, each competitor with a fact from its own pricing or feature page",
    { slots: {} },
  ],
  "publish.needs-you.pack.need.own_price": [
    "your own price, from your business profile or a page of your site",
    { slots: {} },
  ],
  "publish.needs-you.pack.need.difference": [
    "one thing that sets you apart, from your business profile or your answers",
    { slots: {} },
  ],
  "publish.needs-you.pack.need.facts_on_topic": [
    "enough facts about your business that speak to this page’s question",
    { slots: {} },
  ],
  "publish.needs-you.pack.need.facts_few": [
    "more facts about what you sell and who you serve",
    { slots: {} },
  ],
  "publish.needs-you.pack.need.outside_sources": [
    "public pages, such as the official guidance on this task, with facts to cite",
    { slots: {} },
  ],
  "publish.needs-you.pack.need.product_page": [
    "a product, features or pricing page on your site to link to",
    { slots: {} },
  ],
  "publish.needs-you.pack.need.measured_questions": [
    "a finished scan of your site with enough searches measured",
    { slots: {} },
  ],
  "publish.needs-you.pack.need.changed_figures": [
    "a figure that has changed since your last research page",
    { slots: {} },
  ],
  "publish.needs-you.pack.need.buyer_questions": [
    "enough questions that buyers were measured or recorded asking",
    { slots: {} },
  ],
  "publish.needs-you.pack.need.recent_results": [
    "enough recent web results, each with its date and something it says",
    { slots: {} },
  ],
  "publish.needs-you.pack.need.live_page": [
    "the text of the live page this one updates",
    { slots: {} },
  ],
  "publish.needs-you.pack.need.new_fact": [
    "a fact the live page doesn’t already state",
    { slots: {} },
  ],
  "publish.needs-you.pack.need.rival_evidence": [
    "a fact about each competitor from its own site or a study",
    { slots: {} },
  ],
  // Why a page needs the customer, one sentence per cause that can be critical (owner O7), from the page's own record
  // (`src/lib/publish/record/needs-you.ts`). Drafted under issue 759's ruling; the owner corrects the wording.
  "publish.needs-you.destination": [
    "This page is written but couldn’t reach your site. It goes live once your site connects again.",
    { slots: {} },
  ],
  "publish.needs-you.delivery": [
    "We tried several times, but this page didn’t reach your site. Nothing is lost, so check your connection.",
    { slots: {} },
  ],
  "publish.needs-you.live-edit": [
    "Your change to this page breaks one of our checks. Open it to fix your words.",
    { slots: {} },
  ],
  "publish.needs-you.unknown": [
    "This page stopped before going live. Read it to see why, or write it again.",
    { slots: {} },
  ],
  "publish.destination.line.never-connected": [
    "Not connected yet. Your pages wait here, and you can read them.",
    { slots: {} },
  ],
  "publish.destination.line.dns-unset": ["We can’t see your setting yet. Your pages wait, and nothing is lost.", { slots: {} }],
  "publish.destination.line.dns-elsewhere": [
    "Your setting points somewhere else, so pages are waiting. Fix it and they go live.",
    { slots: {} },
  ],
  "publish.destination.line.credentials-expired": [
    "The connection expired. Reconnect and your waiting pages go live.",
    { slots: {} },
  ],
  "publish.destination.line.credentials-invalid": [
    "Your site refused our password, so pages are waiting. Reconnect with a new application password.",
    { slots: {} },
  ],
  "publish.destination.line.unreachable": ["We couldn’t reach your site, so pages are waiting. They go live once it’s back.", { slots: {} }],
  "publish.destination.line.destination-rejected": [
    "Your site refused the page, so pages are waiting. Reconnect to try again.",
    { slots: {} },
  ],
  "publish.destination.line.cannot-publish": [
    "Connected, but this WordPress account can’t publish. Use an account that can.",
    { slots: {} },
  ],

  // 2026-09-06, issue #144 (§9, §12's `draft-ready` "one veto link"). The
  // four lines `GET /veto/{token}` can speak — one per arm of the closed
  // switch over what redeeming a stop link did, and no fifth.
  //
  // `expired` covers two refusals on purpose. A token past its expiry and a
  // token still good for a page that has already left review are, to the
  // person holding the link, the same fact: the moment to stop this page
  // has passed. Two keys would be two sentences for one thing, and the
  // second of them would have to name what became of the page — which this
  // screen does not know and, holding no session, must not guess at.
  // ── S6, the stop page (issue #371) ──────────────────────────────────
  //
  // The approved set draws two arms, and every string on both is
  // unbracketed — approved copy as written under ruling 11a. The set draws
  // no line for the three refusals below — a link that was already used,
  // has run out, or names no page; those are the owner's approved
  // sentences of 2026-09-10 (#459).
  "publish.veto.ask.head": [
    "Goes Live {when}",
    { slots: { when: "text" } },
  ],
  // Owner ruling Q11 (2026-10-20): no go-live time while the address is unconnected.
  "publish.veto.ask.head.unconnected": ["Goes Live Once Your Website Is Connected", { slots: {} }],
  "publish.veto.ask.row.search": ["Search", { slots: {} }],
  // After the search itself, which is set in the code face as the board draws it.
  "publish.veto.ask.row.volume": ["· searched about {volume} times a month", { slots: { volume: "text" } }],
  "publish.veto.ask.action": ["Stop This Page", { slots: {} }],
  // Board Veto v36: the choice not to act, then the way to the page.
  "publish.veto.ask.do-nothing": [
    "Do nothing and it goes live on its own.",
    { slots: {} },
  ],
  "publish.veto.ask.signin": [
    "Sign In to Edit It",
    { slots: {} },
  ],
  "publish.veto.done.head": ["Stopped", { slots: {} }],
  // SPEC §4 (2026-09-20, #914): *Plan* is the calendar's on-screen name.
  // The key keeps the internal word, as the route `/veto/{token}` does.
  /** Changed 2026-09-21 (#937), and the destination with it. This control
   *  linked a **signed-out** reader — `(public)/veto/[token]/page.tsx`
   *  takes no session, by construction — straight to `/app/calendar`,
   *  which `src/middleware.ts` gates: the reader was bounced to a sign-in
   *  wall with no word about why. It goes to `/signin` now and says so, so
   *  the word and the destination cannot come apart. Drafted (#759). */
  "publish.veto.calendar": ["Sign In to Open This Week", { slots: {} }],
  /** The Veto board's line: other pages are unaffected, and the topic is dropped for good. */
  "publish.veto.stopped": [
    "Your other pages go ahead. ReachKit won’t write this topic again.",
    { slots: {} },
  ],
  /** The rest of the done arm's alert, after `publish.veto.done.head`'s
   *  "Stopped" — two keys because the board bolds the first word and reads
   *  on, and one key holding "Stopped. This page won’t go live." would
   *  make the bold a matter of where a full stop happens to fall.
   *  Drafted (#759). */
  "publish.veto.done.line": ["This page won’t go live.", { slots: {} }],
  /** The pill on the stopped page in the accent half, as the board draws it. */
  "publish.veto.panel.stopped": ["Won’t go live", { slots: {} }],
  "publish.veto.alreadyUsed": ["This link was already used. The page is stopped.", { slots: {} }],
  // Board Veto v36's line, with "stop" for its "take it down" (E7: Stop is Stop everywhere).
  "publish.veto.expired": [
    "The time to stop it from your mail has passed, so it may be live. Sign in to stop it from This week.",
    { slots: {} },
  ],
  "publish.veto.unknown": [
    "ReachKit can’t act on this link. Sign in to stop or edit a page.",
    { slots: {} },
  ],
  // The heads of the arms where nothing was stopped; the line under each says why.
  "publish.veto.closed.head": ["This Link Has Closed", { slots: {} }],
  "publish.veto.unknown.head": ["We Can’t Use This Link", { slots: {} }],
  "publish.veto.used.head": ["Already Stopped", { slots: {} }],
  // The stop that did not go through: never says Stopped.
  "publish.veto.failed.head": ["Not Stopped Yet", { slots: {} }],
  "publish.veto.failed": [
    "That didn’t go through. Press Stop This Page again, or sign in to stop it.",
    { slots: {} },
  ],
  "publish.veto.failed.still": ["Still goes live {when}, unless stopped.", { slots: { when: "text" } }],
  // The ask arm: why the week chose the page, the window, and what Stop does.
  "publish.veto.why": ["Why ReachKit chose it:", { slots: {} }],
  "publish.veto.timeline.sent": ["Mail sent {at}", { slots: { at: "text" } }],
  "publish.veto.consequence": [
    "It won’t go live and the topic is dropped. Other pages are not affected.",
    { slots: {} },
  ],
  // Issue 1674: the Monday mail's link to a page planned but not written yet (drafted).
  "publish.veto.planned.title": ["Planned for {day}", { slots: { day: "text" } }],
  "publish.veto.written": [
    "This page is written now. Sign in to edit or stop it from This week.",
    { slots: {} },
  ],
  // A page set aside for a newer standard: its old link stops nothing, and what goes live has its own.
  "publish.veto.set-aside.head": ["This Version Was Set Aside", { slots: {} }],
  "publish.veto.set-aside": [
    "Our page checks changed, so this version won’t go live. Sign in to stop or edit what goes live on This week.",
    { slots: {} },
  ],

  // 2026-09-06, issue #54 (BUILD §9 · REQ-060). The two sentences the
  // WordPress destination speaks, and they are the only two: everything
  // else that destination does is a state, an address or an outcome token,
  // and none of those is a sentence.
  //
  // `noSeoPlugin` is REQ-060 criterion 4's line, and its whole job is to
  // say what did **not** happen to a page that *did*: the page is live on
  // the customer's own site and no SEO plugin was found to write its title
  // and description into. It says that on the page's own record and on no
  // other surface — a delivery with no plugin to write into is not a
  // failure, is not a degradation, and must not read as one.
  //
  // `namedForRemoval` is **kept minted and unreached** (ADR-084 Decision
  // 4). Its arm has had no members since 2026-09-01: every WordPress post
  // ReachKit creates is made live, so every WordPress unpublish that
  // reaches the site is `returned_to_draft`. The key stays because the arm
  // stays — it is the outcome §9 promises for a page ReachKit created but
  // did not make live — and because a deleted key is how an empty arm
  // becomes unrenderable and therefore deletable next. It is not the same
  // sentence as `already_gone`'s: one tells the customer removing the post
  // is theirs to do, the other that nothing is theirs to remove, and a
  // customer sent to delete a post that is not there was told the wrong
  // one.
  // 2026-09-09, issue #375 (UI-SPEC S19 · REQ-059). The three lines the
  // **hosted page** carries, and they live here rather than in a partition
  // of their own because they are publishing's: a hosted page is what §9
  // publishes, and the fifteenth `keys/*.ts` file would be a partition for
  // one screen.
  //
  // **These are the only sentences on a surface that has had none**, and
  // every one is structure around the customer's own data rather than the
  // product speaking about itself. The set writes all three unbracketed, so
  // ruling 11a makes them approved copy as written; what is bracketed there
  // — the brand, the category, the imprint line — is the customer's data
  // and not the owner's copy, so none of it is minted as a key.
  //
  // The set also drew a canonical note naming `reachkit.app`; SPEC §5 puts
  // no ReachKit text on a customer's page, so it is gone (#1129).
  "hosted.published": [
    "published {date} · by {publisher}",
    { slots: { date: "date", publisher: "text" } },
  ],
  // SPEC §7 (2026-09-29, issue 1137): the same line once the page has been
  // refreshed. `{publisher}` is the byline — the founder's name and line
  // from setup, else the business's name — on both. Drafted under #759's
  // ruling; the owner corrects it.
  "hosted.updated": [
    "published {date} · updated {updated} · by {publisher}",
    { slots: { date: "date", updated: "date", publisher: "text" } },
  ],
  // Owner R1 (2026-10-22): an offering page is the business's own, so its
  // line states the dates and no byline. Drafted under #759's ruling.
  "hosted.dated": ["Published {date}", { slots: { date: "date" } }],
  "hosted.dated.updated": [
    "Published {date} · Updated {updated}",
    { slots: { date: "date", updated: "date" } },
  ],
  // Owner R1 (2026-10-22): an address a live site no longer serves names
  // whose site it is and the way back to its guides. Board HostedGone.
  "hosted.gone.heading": ["This page is no longer available", { slots: {} }],
  "hosted.gone.line": ["{publisher} has removed this guide.", { slots: { publisher: "text" } }],
  "hosted.gone.index": ["Browse all guides", { slots: {} }],
  // A sentence, drawn as a link to the page it names.
  "hosted.source": [
    "Source: {source} · retrieved {date}.",
    { slots: { source: "text", date: "date" } },
  ],
  // The customer's own footer line. A key rather than a bare "©" in the
  // markup, so this surface has no string outside the registry at all —
  // and one slot rather than two, because the set's second half is an
  // imprint line the customer states and no column carries yet (#375's PR
  // body names it under owner owes).
  "hosted.footer": [
    "© {publisher}",
    { slots: { publisher: "text" } },
  ],
  // The footer's link to the site's feed.
  "hosted.footer.rss": ["RSS", { slots: {} }],
  // The hosted index at `/` (owner 2026-09-16): every live page of the
  // site, newest first, with a search. Drafted under #759's ruling; the
  // owner corrects the wording. None names ReachKit — the index is served
  // on the customer's host exactly as a page is.
  // SPEC §7 (2026-09-20, issue 929) — the two labels the richer published
  // blocks carry. They are the **body's**, not the hosted chrome's: one
  // serialiser draws them, so the review screen, the hosted page, the
  // WordPress post and the copy-out all say the same two words in the same
  // two places. Both are eyebrows over their block in the approved viewer
  // (`R2-VW-C`) rather than headings, so neither joins the page's heading
  // outline — a structural claim about the page is not theirs to make.
  // Drafted under the 2026-09-16 ruling (#759); the owner corrects them.
  "body.answer.heading": ["The short answer", { slots: {} }],
  // SPEC §7 (owner, 2026-09-29, D4): the label over the `:::takeaways` box,
  // an eyebrow like the one above. Drafted under #759's ruling (issue 1137);
  // the owner corrects it.
  "body.takeaways.heading": ["Key takeaways", { slots: {} }],
  // SPEC §7 (owner, 2026-10-17, issue 1489): the heading over the buyer
  // questions code draws above the sources list. A heading, not an
  // eyebrow: the section is part of the page's outline. Drafted under
  // #759's ruling; the owner corrects it.
  "body.faq.heading": ["Questions buyers ask", { slots: {} }],
  // The name the table's own scrolling box carries (owner, PR #973). It is
  // a **landmark label**, not a caption: a box that scrolls has to be
  // reachable from a keyboard (axe `scrollable-region-focusable`, the rule
  // #962 fixed on every other scrolling pane), and a focusable region needs
  // a name to be announced by. The second clause is what a reader who
  // lands on it needs to know, because the columns past the edge are the
  // reason it is focusable at all.
  "body.table.label": [
    "Table: scroll sideways to see every column",
    { slots: {} },
  ],
  // The publisher is the customer, by name: these are their other guides
  // on their own domain, and the line says so rather than naming ReachKit.
  "body.guides.heading": [
    "More guides from {publisher}",
    { slots: { publisher: "text" } },
  ],

  "hosted.index.heading": ["Articles", { slots: {} }],
  "hosted.index.searchLabel": ["Search the guides", { slots: {} }],
  "hosted.index.searchSubmit": ["Search", { slots: {} }],
  "hosted.index.empty": [
    "Nothing has been published here yet.",
    { slots: {} },
  ],
  "hosted.index.noMatch": [
    "No articles match “{query}”.",
    { slots: { query: "text" } },
  ],

  // SPEC §7 (2026-09-29, issue 1140) — the hosted blog carries the
  // customer's identity. Every line is structure around their own name and
  // pages, and none names ReachKit. Drafted under #759's ruling; the owner
  // corrects the wording.
  "hosted.visit": ["Visit {site}", { slots: { site: "text" } }],
  "hosted.toc": ["On this page", { slots: {} }],
  "hosted.readingTime": ["{minutes} min read", { slots: { minutes: "text" } }],
  "hosted.about": ["About {publisher}", { slots: { publisher: "text" } }],
  // Issue 1509: the about card names the person a page is by, where it is
  // by a person — linked to the main site's page that names them, where it
  // has one. Drafted under #759's ruling; the owner corrects the wording.
  "hosted.about.author": ["Written by {author}", { slots: { author: "text" } }],
  // The one place the adopted market stores that the business serves, never
  // inferred: a business with none says nothing. Drafted; the owner corrects it.
  "hosted.about.serves": ["Serves {place}.", { slots: { place: "text" } }],
  // The business's own actions: its stored phone, and its main site's own
  // book and quote pages. None claims more than that the number or page
  // exists. The headline asks in the adopted market's own category and
  // place, else names the business. Drafted under #759's ruling; the owner
  // corrects the wording.
  "hosted.action.call": ["Call {phone}", { slots: { phone: "text" } }],
  "hosted.action.book": ["Book a visit", { slots: {} }],
  "hosted.action.book.demo": ["Book a demo", { slots: {} }],
  "hosted.action.book.call": ["Book a call", { slots: {} }],
  "hosted.action.book.online": ["Book online", { slots: {} }],
  "hosted.action.quote": ["Ask for a quote", { slots: {} }],
  "hosted.compact.heading": ["Need {category}?", { slots: { category: "text" } }],
  "hosted.compact.heading.place": ["Need {category} in {place}?", { slots: { category: "text", place: "text" } }],
  "hosted.compact.heading.name": ["Questions for {publisher}?", { slots: { publisher: "text" } }],
  // SPEC §7 (2026-10-11, issue 1397): how the page was made, under its
  // byline. Both numbers are read off the page's own row and neither is
  // typed here; `.one` is the same line for a page with a single fact.
  // `.sources` follows it, as a link, where the body ends with its sources
  // list. None names ReachKit. Drafted under #759's ruling; the owner
  // corrects the wording.
  "hosted.made": [
    "Written with AI from {facts} facts on {site}, checked against {rules} rules before publishing.",
    { slots: { facts: "text", site: "text", rules: "text" } },
  ],
  "hosted.made.one": [
    "Written with AI from one fact on {site}, checked against {rules} rules before publishing.",
    { slots: { site: "text", rules: "text" } },
  ],
  "hosted.made.sources": ["Sources are listed below.", { slots: {} }],
  // The breadcrumb's name as a landmark; its three parts are the
  // customer's name, `hosted.index.heading` and the page's own title.
  "hosted.breadcrumb": ["Breadcrumb", { slots: {} }],
  // The index's description in a search result and in the feed, for a
  // business with no line of its own (issue 1141). Drafted under #759's
  // ruling; the owner corrects the wording.
  "hosted.index.description": [
    "Articles and guides from {publisher}.",
    { slots: { publisher: "text" } },
  ],
  "hosted.index.latest": ["Latest", { slots: {} }],
  "hosted.index.pages": ["Pages of articles", { slots: {} }],
  "hosted.index.newer": ["Previous page", { slots: {} }],
  "hosted.index.older": ["Next page", { slots: {} }],
  // The index's H1 and its grid's heading; the head, breadcrumb and feed keep `hosted.index.heading`.
  "hosted.index.title": ["Guides from {publisher}", { slots: { publisher: "text" } }],
  "hosted.index.recent": ["Recent guides", { slots: {} }],
  "hosted.index.pageOf": [
    "Page {page} of {pages}",
    { slots: { page: "text", pages: "text" } },
  ],
  // Every live guide one click from the index, by topic (owner R1, 2026-10-22).
  "hosted.index.all": ["All guides", { slots: {} }],
  "hosted.index.allLead": ["Every guide on this site, by topic.", { slots: {} }],
  "hosted.index.topicCount": ["{count} guides", { slots: { count: "text" } }],
  "hosted.index.other": ["Other guides", { slots: {} }],

  // Issue 2091: a plugin was detected but did not take the title and description (drafted).
  "publish.wordpress.seoNotAccepted": ["A plugin was found, and it didn’t take the title and description. The page is live all the same.", { slots: {} }],
  "publish.wordpress.noSeoPlugin": ["No SEO plugin was found on your site, so the title and description weren’t written into one. The page is live all the same.", { slots: {} }],
}) satisfies CopyPartition;
