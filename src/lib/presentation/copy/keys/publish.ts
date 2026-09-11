// src/lib/presentation/copy/keys/publish.ts — BP-020 decision 5, WO-041
//
// Publishing's sentences. Seeded empty by WO-041; the block that owns
// publishing fills this file and touches no other partition.
//
// 2026-09-10, issue #459: the owner approved the master's drafted copy for
// every key this partition still owed ("copy proposal approved"; proposal
// sheet artifact 546f45a0-a996-4d25-b85e-fb03fda7b102), and the 38 approved
// strings are applied here byte for byte. Where a note below says how a
// key stood before, that was its standing before this date.
//
// 2026-09-11, issue #516: `record.verification.never.noLiveAddress` was the
// one key #459 held — its drafted sentence clipped the record's badge at
// 320 px — and the owner approved a badge-length string for it (DECISIONS
// 2026-09-11), applied byte for byte. No key in this partition is
// owner-owed or `TODO(copy)` any more.
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
  "verdict.page.working": ["Working", { slots: {}, fixedBy: "REQ-063 c1" }],
  "verdict.page.too_early": ["Too early to judge", { slots: {}, fixedBy: "REQ-063 c2" }],
  "verdict.page.not_working": ["Not working", { slots: {}, fixedBy: "REQ-063 c1" }],
  "verdict.page.not_judgeable": ["No longer judgeable", { slots: {}, fixedBy: "REQ-063 c6" }],

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
    "Nothing changed — this page is {state}, and that action isn’t open from there.",
    { slots: { state: "text" }, fixedBy: "REQ-056 c2" },
  ],
  "publish.action.refused.guard": [
    "Nothing changed — this page stays {state} until what is holding it clears.",
    { slots: { state: "text" }, fixedBy: "REQ-056 c2" },
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
  "record.address.publiclyReadableAt": ["Publicly readable at", { slots: {}, fixedBy: "REQ-056 c6" }],
  "record.address.wasPublishedAt": ["Was published at", { slots: {}, fixedBy: "REQ-056 c6" }],
  "record.address.neverMadeLive": ["This page hasn’t been made live, so it has no address yet.", { slots: {}, fixedBy: "REQ-056 c6" }],

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
  "record.title": ["Page record", { slots: {}, fixedBy: "REQ-056 c6" }],
  "record.label.address": ["Address", { slots: {}, fixedBy: "REQ-056 c6" }],
  "record.label.checked": ["Checked", { slots: {}, fixedBy: "REQ-062 c7" }],
  "record.label.taken-down": ["Taken down", { slots: {}, fixedBy: "REQ-056 c15" }],
  "record.verification.found": ["found live", { slots: {}, fixedBy: "REQ-062 c7" }],
  "record.verification.pageNotFound": ["no page found at this address", { slots: {}, fixedBy: "REQ-062 c7" }],
  "record.verification.couldNotConfirm": ["check not confirmed", { slots: {}, fixedBy: "REQ-062 c7" }],
  "record.verification.notYet": ["first check at", { slots: {}, fixedBy: "REQ-062 c7" }],
  "record.verification.due": ["check due now", { slots: {}, fixedBy: "REQ-062 c7" }],
  "record.verification.never.takenDownFirst": ["taken down before its check", { slots: {}, fixedBy: "REQ-062 c7" }],
  "record.verification.never.noLiveAddress": ["not checked", { slots: {}, fixedBy: "REQ-062 c7" }],
  "record.unpublished.removed": ["removed from your hosted blog", { slots: {}, fixedBy: "REQ-056 c15" }],
  "record.unpublished.returnedToDraft": ["returned to draft in your WordPress", { slots: {}, fixedBy: "REQ-056 c15" }],
  "record.unpublished.namedForRemoval": ["never live there — yours to remove", { slots: {}, fixedBy: "REQ-056 c16" }],
  "record.unpublished.alreadyGone": ["already gone from your site", { slots: {}, fixedBy: "REQ-056 c15" }],
  "record.unpublished.unreachable": ["your site couldn’t be reached — the post may still be live", { slots: {}, fixedBy: "REQ-056 c15" }],

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
  "publish.destination.line.never-connected": [
    "Not connected yet. Your pages are held as drafts you can read until it is.",
    { slots: {}, fixedBy: "§9 · REQ-028 c5" },
  ],
  "publish.destination.line.dns-unset": ["Waiting on your DNS record. Pages are held until it’s set — nothing is lost.", { slots: {}, fixedBy: "§9 · REQ-059 c2" }],
  "publish.destination.line.dns-elsewhere": [
    "The DNS record points elsewhere, so pages are waiting. Point it at us and they go out.",
    { slots: {}, fixedBy: "§9 · REQ-059 c2" },
  ],
  "publish.destination.line.credentials-expired": [
    "The connection has expired. Your pages are being held — nothing is lost — and reconnecting releases them.",
    { slots: {}, fixedBy: "§9 · REQ-074 c2" },
  ],
  "publish.destination.line.credentials-invalid": [
    "Your site refused the credential. Pages are being held, nothing is lost — reconnect with a working application password.",
    { slots: {}, fixedBy: "§9 · REQ-074 c2" },
  ],
  "publish.destination.line.unreachable": ["Your site couldn’t be reached. Pages are being held — nothing is lost — and go out once it answers again.", { slots: {}, fixedBy: "§9 · REQ-074 c2" }],
  "publish.destination.line.destination-rejected": [
    "Your site rejected the page. Pages are being held and nothing is lost; reconnect to try again.",
    { slots: {}, fixedBy: "§9 · REQ-074 c2" },
  ],
  "publish.destination.line.cannot-publish": [
    "Connected, but the WordPress account ReachKit uses there isn’t allowed to publish. Give it an account that can — re-entering this one changes nothing.",
    { slots: {}, fixedBy: "ADR-086 · REQ-060 c7" },
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
    "Publishes {when}",
    { slots: { when: "text" }, fixedBy: "REQ-057 c1 · S6 (11a)" },
  ],
  "publish.veto.ask.row.search": ["search", { slots: {}, fixedBy: "S6 (11a)" }],
  "publish.veto.ask.row.site": ["site", { slots: {}, fixedBy: "S6 (11a)" }],
  "publish.veto.ask.action": ["Stop this page", { slots: {}, fixedBy: "REQ-057 c1 · S6 (11a)" }],
  "publish.veto.ask.do-nothing": [
    "Or do nothing and it publishes as planned. You can read and edit it in the app.",
    { slots: {}, fixedBy: "REQ-057 c1 · S6 (11a)" },
  ],
  "publish.veto.done.head": ["Stopped", { slots: {}, fixedBy: "S6 (11a)" }],
  "publish.veto.calendar": ["Open the calendar", { slots: {}, fixedBy: "S6 (11a)" }],
  "publish.veto.stopped": [
    "This page will not publish. Tomorrow’s page is unaffected.",
    { slots: {}, fixedBy: "REQ-057 c1 · S6 (11a)" },
  ],
  "publish.veto.alreadyUsed": ["This link was already used. The page is stopped.", { slots: {}, fixedBy: "REQ-057 c1" }],
  "publish.veto.expired": ["The moment to stop this page has passed.", { slots: {}, fixedBy: "REQ-057 c1" }],
  "publish.veto.unknown": ["This isn’t a link ReachKit can act on.", { slots: {}, fixedBy: "REQ-057 c1" }],

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
  // `hosted.canonical` is the one line that names `reachkit.app`. It is
  // there in the set, and it is a statement about *our* preview host and
  // not a byline: the guardrail §9 and §14 fix — customer content never
  // ranks on our domain — written where a reader of the page can check it.
  "hosted.published": [
    "published {date} · by {publisher}",
    { slots: { date: "date", publisher: "text" }, fixedBy: "S19 (11a)" },
  ],
  "hosted.source": [
    "source: {source} · retrieved {date}",
    { slots: { source: "text", date: "date" }, fixedBy: "S19 (11a)" },
  ],
  "hosted.canonical": [
    "Written for {domain}. Canonical: {canonical} · noindex on *.reachkit.app",
    { slots: { domain: "text", canonical: "text" }, fixedBy: "S19 (11a)" },
  ],
  // The customer's own footer line. A key rather than a bare "©" in the
  // markup, so this surface has no string outside the registry at all —
  // and one slot rather than two, because the set's second half is an
  // imprint line the customer states and no column carries yet (#375's PR
  // body names it under owner owes).
  "hosted.footer": [
    "© {publisher}",
    { slots: { publisher: "text" }, fixedBy: "S19 (11a)" },
  ],

  "publish.wordpress.noSeoPlugin": ["No SEO plugin was found on your site, so the title and description weren’t written into one. The page is live all the same.", { slots: {}, fixedBy: "REQ-060 c4" }],
  "publish.wordpress.namedForRemoval": [
    "ReachKit never made this post live, so nothing in your site was changed. Removing the draft there is yours to do.",
    { slots: {}, fixedBy: "ADR-084 d4 · REQ-056 c16" },
  ],
}) satisfies CopyPartition;
