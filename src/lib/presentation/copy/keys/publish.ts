// src/lib/presentation/copy/keys/publish.ts — BP-020 decision 5, WO-041
//
// Publishing's sentences. Seeded empty by WO-041; the block that owns
// publishing fills this file and touches no other partition.
//
// 2026-09-06, issue #47 (REQ-063): the four words a published page's
// weekly standing is spoken as. They live here, and not in `keys/mail.ts`,
// because they are not the mail's: §4.5's Overview and §4.6's calendar
// speak the same four, and one home is what stops a screen and a mail
// wording the same verdict differently. Every one is owner-owed and
// **empty** rather than carrying the `TODO(copy)` marker — the owner's
// 2026-09-05 ruling on #93 divides the two representations by destination,
// and the first surface to read these is the Monday mail, where "a mail
// never ships a placeholder": `copy()` throws on the key and the send is
// logged `not-composable` rather than a customer receiving a blank verdict
// on their own page.
//
// The fourth is not a fourth verdict: REQ-063 c6's page carries it "in
// place of the three", and the line naming *which* of the five causes
// happened, with the date of the last verdict it received, is a separate
// sentence a screen speaks — owner-owed and not minted here (the mail
// carries the standing, not the explanation).
import type { CopyPartition } from "../registry.ts";

export const PUBLISH_COPY = Object.freeze({
  "verdict.page.working": ["", { slots: {}, fixedBy: "REQ-063 c1" }],
  "verdict.page.too_early": ["", { slots: {}, fixedBy: "REQ-063 c2" }],
  "verdict.page.not_working": ["", { slots: {}, fixedBy: "REQ-063 c1" }],
  "verdict.page.not_judgeable": ["", { slots: {}, fixedBy: "REQ-063 c6" }],

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
    "TODO(copy)",
    { slots: { state: "text" }, fixedBy: "REQ-056 c2" },
  ],
  "publish.action.refused.guard": [
    "TODO(copy)",
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
  //
  // `TODO(copy)` rather than the empty value's throw, on the same #93
  // ruling the four verdicts above cite from the other side: these three
  // render on *screens* — the day panel, the draft view and Overview —
  // and the throw would take a whole screen down over one unwritten line.
  "record.address.publiclyReadableAt": ["TODO(copy)", { slots: {}, fixedBy: "REQ-056 c6" }],
  "record.address.wasPublishedAt": ["TODO(copy)", { slots: {}, fixedBy: "REQ-056 c6" }],
  "record.address.neverMadeLive": ["TODO(copy)", { slots: {}, fixedBy: "REQ-056 c6" }],

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
  "record.title": ["TODO(copy)", { slots: {}, fixedBy: "REQ-056 c6" }],
  "record.label.address": ["TODO(copy)", { slots: {}, fixedBy: "REQ-056 c6" }],
  "record.label.checked": ["TODO(copy)", { slots: {}, fixedBy: "REQ-062 c7" }],
  "record.label.taken-down": ["TODO(copy)", { slots: {}, fixedBy: "REQ-056 c15" }],
  "record.verification.found": ["TODO(copy)", { slots: {}, fixedBy: "REQ-062 c7" }],
  "record.verification.pageNotFound": ["TODO(copy)", { slots: {}, fixedBy: "REQ-062 c7" }],
  "record.verification.couldNotConfirm": ["TODO(copy)", { slots: {}, fixedBy: "REQ-062 c7" }],
  "record.verification.notYet": ["TODO(copy)", { slots: {}, fixedBy: "REQ-062 c7" }],
  "record.verification.due": ["TODO(copy)", { slots: {}, fixedBy: "REQ-062 c7" }],
  "record.verification.never.takenDownFirst": ["TODO(copy)", { slots: {}, fixedBy: "REQ-062 c7" }],
  "record.verification.never.noLiveAddress": ["TODO(copy)", { slots: {}, fixedBy: "REQ-062 c7" }],
  "record.unpublished.removed": ["TODO(copy)", { slots: {}, fixedBy: "REQ-056 c15" }],
  "record.unpublished.returnedToDraft": ["TODO(copy)", { slots: {}, fixedBy: "REQ-056 c15" }],
  "record.unpublished.namedForRemoval": ["TODO(copy)", { slots: {}, fixedBy: "REQ-056 c16" }],
  "record.unpublished.alreadyGone": ["TODO(copy)", { slots: {}, fixedBy: "REQ-056 c15" }],
  "record.unpublished.unreachable": ["TODO(copy)", { slots: {}, fixedBy: "REQ-056 c15" }],

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
  // Every value is the **marker**, not the empty string: the first surface
  // to read one is a screen (§4.7's destinations list), and the owner's
  // 2026-09-05 ruling on #93 gives a fixture screen the marker where the
  // four verdict words above take the throw.
  //
  // `publish.destination.line.cannot-publish` is owner-owed for a second,
  // stated reason (ADR-086 decision 3): its sentence must **not** say pages
  // are being held and nothing has been lost, because in that state the
  // credential is valid and the page has already failed rather than been
  // held. Wording that distinction is the owner's.
  "publish.destination.line.never-connected": [
    "TODO(copy)",
    { slots: {}, fixedBy: "§9 · REQ-028 c5" },
  ],
  "publish.destination.line.dns-unset": ["TODO(copy)", { slots: {}, fixedBy: "§9 · REQ-059 c2" }],
  "publish.destination.line.dns-elsewhere": [
    "TODO(copy)",
    { slots: {}, fixedBy: "§9 · REQ-059 c2" },
  ],
  "publish.destination.line.credentials-expired": [
    "TODO(copy)",
    { slots: {}, fixedBy: "§9 · REQ-074 c2" },
  ],
  "publish.destination.line.credentials-invalid": [
    "TODO(copy)",
    { slots: {}, fixedBy: "§9 · REQ-074 c2" },
  ],
  "publish.destination.line.unreachable": ["TODO(copy)", { slots: {}, fixedBy: "§9 · REQ-074 c2" }],
  "publish.destination.line.destination-rejected": [
    "TODO(copy)",
    { slots: {}, fixedBy: "§9 · REQ-074 c2" },
  ],
  "publish.destination.line.cannot-publish": [
    "TODO(copy)",
    { slots: {}, fixedBy: "ADR-086 · REQ-060 c7" },
  ],

  // 2026-09-06, issue #144 (§9, §12's `draft-ready` "one veto link"). The
  // four lines `GET /veto/{token}` can speak — one per arm of the closed
  // switch over what redeeming a stop link did, and no fifth. They are
  // screen sentences, so they carry the `TODO(copy)` marker rather than the
  // empty string: the arm renders and is reviewable on a preview, which is
  // what a screen owes (DECISIONS 2026-09-05, issue #93), where a mail owes
  // the opposite.
  //
  // `expired` covers two refusals on purpose. A token past its expiry and a
  // token still good for a page that has already left review are, to the
  // person holding the link, the same fact: the moment to stop this page
  // has passed. Two keys would be two sentences for one thing, and the
  // second of them would have to name what became of the page — which this
  // screen does not know and, holding no session, must not guess at.
  "publish.veto.stopped": ["TODO(copy)", { slots: {}, fixedBy: "REQ-057 c1" }],
  "publish.veto.alreadyUsed": ["TODO(copy)", { slots: {}, fixedBy: "REQ-057 c1" }],
  "publish.veto.expired": ["TODO(copy)", { slots: {}, fixedBy: "REQ-057 c1" }],
  "publish.veto.unknown": ["TODO(copy)", { slots: {}, fixedBy: "REQ-057 c1" }],

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
  "publish.wordpress.noSeoPlugin": ["TODO(copy)", { slots: {}, fixedBy: "REQ-060 c4" }],
  "publish.wordpress.namedForRemoval": [
    "TODO(copy)",
    { slots: {}, fixedBy: "ADR-084 d4 · REQ-056 c16" },
  ],
}) satisfies CopyPartition;
