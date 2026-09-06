// src/lib/presentation/copy/keys/settings.ts — BP-020 decision 5, WO-041
//
// Settings' sentences. Empty on purpose at WO-041: no string was seeded
// here. The block that owns Settings fills this file and touches no other
// partition.
//
// 2026-09-05: issue #9 (BUILD §4.4) added `settings.head` — the one written
// line the screen stated inside the app shell until its own content landed.
//
// 2026-09-05: issue #18 (BUILD §4.7) fills the screen. Every key below is
// one of exactly two things, and the distinction is the whole rule this
// file is written under:
//
//   **A transcription.** A word or a sentence `BUILD.md` itself prints,
//   filled verbatim, byte for byte — the footing `laws.ts` records for the
//   thirteen band words and the five `shell.*` words ("every one of them is
//   a **transcription** of a word `BUILD.md` itself prints … Nothing here is
//   composed"). §4.7 prints the seven card names, the control words (`Edit`,
//   `add`, `remove`, `Reconnect`, `Update card`, `Cancel plan`, `change
//   email`, `sign out`, `Export everything`) and three of the screen's
//   sentences outright; §8 prints "Brand voice" and "Do-not-claim list"; §10
//   prints the destination kinds and the three health words; §12 prints the
//   three recurring mails' own names. Each key's `fixedBy` names the clause
//   it transcribes, so a reviewer can check the byte-for-byte claim without
//   leaving the file.
//
//   **Owner-owed.** A sentence nothing in the spec writes — the magic-link
//   note, and the line an action that is not yet wired reports. Empty value,
//   `copy()` refuses it, and the screen renders nothing in its place (never
//   a placeholder).
//
// Three transcriptions read as lower-case fragments because that is how the
// spec prints them ("changing this rebuilds …", "cancelling keeps …",
// "add/remove"). They are left exactly as printed rather than sentence-cased:
// capitalising is a wording decision and wording is the owner's
// (constitution §1). Flagged in this issue's PR body.
import type { CopyPartition } from "../registry.ts";

export const SETTINGS_COPY = Object.freeze({
  "settings.head": ["", { slots: {}, fixedBy: "BUILD §4.7" }],

  // ── One control word, several positions ────────────────────────────────
  // §4.7 prints "Edit" beside the market chip. Every other value on this
  // screen that is changed rather than switched is changed the same way, and
  // one key serving several positions is WO-070's precedent (constitution
  // rule 1.1) — naming a control by what it does, rather than minting a
  // second, third and fourth word for the same act.
  "settings.edit": ["Edit", { slots: {}, fixedBy: 'BUILD §4.7 ("chip + Edit")' }],

  // ── Your market ────────────────────────────────────────────────────────
  "settings.market.title": ["Your market", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.market.category": ["market category", { slots: {}, fixedBy: "REQ-070 c1" }],
  "settings.market.domain": ["domain", { slots: {}, fixedBy: "BUILD §10 (`sites.domain`), §4.4" }],
  // §4.7 verbatim, including its lower-case opening.
  "settings.market.effect": [
    "changing this rebuilds the search set and the 12 questions next Monday",
    { slots: {}, fixedBy: "BUILD §4.7" },
  ],

  // ── Competitors ────────────────────────────────────────────────────────
  "settings.competitors.title": ["Competitors", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.competitors.add": ["add", { slots: {}, fixedBy: 'BUILD §4.7 ("chips ×5, add/remove")' }],
  "settings.competitors.remove": [
    "remove",
    { slots: {}, fixedBy: 'BUILD §4.7 ("chips ×5, add/remove")' },
  ],

  // ── Publishing ─────────────────────────────────────────────────────────
  "settings.publishing.title": ["Publishing", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.publishing.veto": ["veto window", { slots: {}, fixedBy: "BUILD §4.7" }],
  // §4.7 asks for a "veto window stepper". A stepper's two ends are
  // symbols, not sentences — the same footing `unmeasured.dash` sits on in
  // `laws.ts` ("a transcription of REQ-004's own '—' character, on the same
  // footing as the thirteen band words"). They are keys rather than JSX
  // literals so that an owner who wants words there ("shorter" / "longer")
  // changes two values and no code. Flagged in this issue's PR body.
  "settings.publishing.veto.less": ["−", { slots: {}, fixedBy: 'BUILD §4.7 ("stepper")' }],
  "settings.publishing.veto.more": ["+", { slots: {}, fixedBy: 'BUILD §4.7 ("stepper")' }],
  "settings.publishing.publish-time": ["publish time", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.publishing.time-zone": ["time zone", { slots: {}, fixedBy: "REQ-070 c1" }],
  "settings.publishing.enabled": ["whether pages publish at all", { slots: {}, fixedBy: "REQ-070 c1" }],
  "settings.publishing.destinations": ["destinations", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.publishing.reconnect": ["Reconnect", { slots: {}, fixedBy: "BUILD §4.7" }],
  // §4.7's own footnote, verbatim and complete, including its full stop.
  "settings.publishing.fix-note": [
    "Fix-type tasks are never automated, whatever the mode.",
    { slots: {}, fixedBy: "BUILD §4.7" },
  ],

  // The two destination kinds and the three health states. §10's
  // `destinations` row prints `kind(hosted/wordpress)` and
  // `health(ok/expired/error)`; §9 prints the two kinds as customer-facing
  // names ("Hosted CMS", "WordPress"). Health is a state, never an error
  // (ADR-086), so all three read as states here and none as a failure.
  "settings.destination.hosted": ["Hosted", { slots: {}, fixedBy: 'BUILD §9 ("Hosted CMS")' }],
  "settings.destination.wordpress": ["WordPress", { slots: {}, fixedBy: "BUILD §9" }],
  "settings.destination.health.ok": [
    "ok",
    { slots: {}, fixedBy: "BUILD §10 (`health(ok/expired/error)`)" },
  ],
  "settings.destination.health.expired": ["expired", { slots: {}, fixedBy: "BUILD §10" }],
  "settings.destination.health.error": ["error", { slots: {}, fixedBy: "BUILD §10" }],

  // ── Notifications ──────────────────────────────────────────────────────
  // One key per `stoppable: 'toggle'` row of `MAIL_KINDS`, named by the row's
  // own key, which is the word §12 prints for that mail. The panel projects
  // its rows from the register (never from a hand-written three), so a fourth
  // stoppable kind arrives as a missing-key compile error rather than as a
  // mail a customer cannot stop.
  "settings.notifications.title": ["Notifications", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.notifications.draft-ready": ["draft-ready", { slots: {}, fixedBy: "BUILD §12" }],
  "settings.notifications.published": ["published", { slots: {}, fixedBy: "BUILD §12" }],
  "settings.notifications.weekly": ["weekly", { slots: {}, fixedBy: "BUILD §12" }],

  // ── Billing ────────────────────────────────────────────────────────────
  // Every word here names a value or a destination; not one of them is a
  // figure. REQ-097 c5: the values rendered beside these words are read from
  // Stripe's own surface and carry that provenance in the model
  // (`billing.ts`); ReachKit computes none of them.
  "settings.billing.title": ["Billing", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.billing.plan": ["plan", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.billing.next-invoice": ["next invoice", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.billing.card": ["card", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.billing.invoices": ["invoices", { slots: {}, fixedBy: 'BUILD §4.7 ("invoices link")' }],
  "settings.billing.update-card": ["Update card", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.billing.cancel": ["Cancel plan", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.billing.resume": [
    "resume",
    { slots: {}, fixedBy: 'REQ-070 c2 ("cancelling or resuming the plan")' },
  ],
  // §4.7 verbatim, including its lower-case opening and its `{date}` slot.
  // The date is Stripe's (REQ-097 c5), never one ReachKit worked out.
  "settings.billing.cancelling": [
    "cancelling keeps everything running until {date}",
    { slots: { date: "date" }, fixedBy: "BUILD §4.7" },
  ],

  // ── Account ────────────────────────────────────────────────────────────
  "settings.account.title": ["Account", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.account.name": ["name", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.account.email": ["email", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.account.change-email": ["change email", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.account.sign-out": ["sign out", { slots: {}, fixedBy: "BUILD §4.7" }],
  // Owner-owed. §4.7 names a "magic-link note" and prints no note; nothing
  // else in the spec writes one, so composing one here would be inventing the
  // product's voice. The key exists, so filling it is the whole change.
  "settings.account.magic-link": ["", { slots: {}, fixedBy: 'BUILD §4.7 ("magic-link note")' }],

  // ── Your content ───────────────────────────────────────────────────────
  "settings.content.title": ["Your content", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.content.pages": ["pages", { slots: {}, fixedBy: 'BUILD §4.7 ("pages count")' }],
  "settings.content.export": ["Export everything", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.content.voice": ["Brand voice", { slots: {}, fixedBy: "BUILD §8 rule 7" }],
  "settings.content.do-not-claim": ["Do-not-claim list", { slots: {}, fixedBy: "BUILD §8 rule 4" }],

  // ── An action that has no wiring yet ───────────────────────────────────
  // Owner-owed. The seven actions call their declared interfaces
  // (`actions.ts`); on this build every one of those interfaces answers "not
  // wired yet, and here is the issue that wires it". That answer is a state
  // the customer is entitled to be told about in writing — and the sentence
  // telling them is the owner's, so the screen states nothing until it is
  // written rather than composing a placeholder.
  "settings.action.not-yet": ["", { slots: {}, fixedBy: "BUILD §4.7" }],
}) satisfies CopyPartition;
