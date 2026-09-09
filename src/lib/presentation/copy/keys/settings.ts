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
  // The other two words the field Edit opens needs (issue #231), and the
  // same one-key-serving-several-positions rule: what the button does is
  // the same act on the domain and on the category, so it is one word each
  // and not two per control. Leaving a field is offered because opening
  // one must be undoable — a customer who presses Edit to see what is
  // there has changed nothing, and must not have to save to get out.
  "settings.save": ["TODO(copy)", { slots: {}, fixedBy: "REQ-071 c1" }],
  "settings.cancel-edit": ["TODO(copy)", { slots: {}, fixedBy: "REQ-071 c1" }],

  // ── Your market ────────────────────────────────────────────────────────
  "settings.market.title": ["Your site & market", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.market.category": ["market category", { slots: {}, fixedBy: "REQ-070 c1" }],
  "settings.market.domain": ["domain", { slots: {}, fixedBy: "BUILD §10 (`sites.domain`), §4.4" }],
  // §4.7 verbatim, including its lower-case opening.
  "settings.market.effect": [
    "changing this rebuilds the search set and the 12 questions next Monday",
    { slots: {}, fixedBy: "BUILD §4.7" },
  ],
  // REQ-071's two dated statements about the market (issue #204). Both take
  // their date from `effectiveOn()` and neither computes one: c1 states the
  // date a change being typed *would* take effect, before it is saved; c6
  // states the date a saved change takes effect, until the pass adopts it.
  // `TODO(copy)` and not the empty value, per DECISIONS 2026-09-05: a whole
  // card of finished controls must stay reviewable while the owner writes
  // the sentence, and an empty value takes the card down with it.
  "settings.market.pending": [
    "TODO(copy)",
    { slots: { date: "date", change: "text" }, fixedBy: "REQ-071 c1" },
  ],
  "settings.market.effectiveOn": [
    "TODO(copy)",
    { slots: { date: "date" }, fixedBy: "REQ-071 c6" },
  ],
  // The word each change kind is named by. One key per kind, because
  // `{change}` is a **sentence fragment the owner writes** and never the
  // engine's own `ChangeKind` handle: "domain" and "category" are internal
  // names, and REQ-071's line reads them out to a customer.
  "settings.market.change.domain": ["TODO(copy)", { slots: {}, fixedBy: "REQ-071 c1" }],
  "settings.market.change.category": ["TODO(copy)", { slots: {}, fixedBy: "REQ-071 c1" }],
  // The one way a market save is refused (issue #231). `saveDomain` answers
  // `unreachable` for a value that is not a registrable domain and for one
  // that does not resolve — one refusal, because the customer's remedy is
  // the same either way and REQ-071 c9 names one. A category save has no
  // refusal: any non-empty string is a market somebody could be measured in.
  "settings.market.refused.unreachable": ["TODO(copy)", { slots: {}, fixedBy: "REQ-071 c9" }],

  // ── Competitors ────────────────────────────────────────────────────────
  "settings.competitors.title": ["Competitors", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.competitors.add": ["add", { slots: {}, fixedBy: 'BUILD §4.7 ("chips ×5, add/remove")' }],
  "settings.competitors.remove": [
    "remove",
    { slots: {}, fixedBy: 'BUILD §4.7 ("chips ×5, add/remove")' },
  ],
  // The add field's own name (issue #270). It had been labelled with the
  // card's heading key, so the card read "Competitors … Competitors" — a
  // heading and the field beneath it saying the same word, which names
  // neither. The heading names the set; this names the one thing being
  // typed, and it is the field's label *and* its placeholder because
  // ADR-093's rendering half is "one string, once": `Input` omits a
  // placeholder equal to the label rather than printing it twice.
  //
  // It replaces `settings.market.domain` as the placeholder, which was that
  // card's word borrowed — a rival's domain is not this site's, and one key
  // read by two cards is a sentence the owner cannot reword for one of them.
  "settings.competitors.add-label": ["TODO(copy)", { slots: {}, fixedBy: "BUILD §4.7" }],
  // REQ-071 c16. An empty rival set is a state the product designed (§2.5),
  // not a blank: the line takes no slot, because there is no date and no
  // change to name — only that comparison begins when a rival is added.
  "settings.competitors.none-yet": ["TODO(copy)", { slots: {}, fixedBy: "REQ-071 c16" }],
  // `addRival`'s own five refusals, one sentence each (issue #231). The
  // rules are `setup/rivals.ts`'s — REQ-071 c4 says they are the same rules
  // — but the sentences are this screen's: `setup.competitors.refused.*`
  // speaks to a founder part-way through setup, and reusing those keys here
  // would put setup's voice on Settings. The map over them is total, so a
  // sixth refusal in the engine is a compile error rather than a refusal
  // that says nothing.
  "settings.competitors.refused.not-a-domain": ["TODO(copy)", { slots: {}, fixedBy: "REQ-071 c4" }],
  "settings.competitors.refused.does-not-resolve": ["TODO(copy)", { slots: {}, fixedBy: "REQ-071 c4" }],
  "settings.competitors.refused.own-domain": ["TODO(copy)", { slots: {}, fixedBy: "REQ-071 c4" }],
  "settings.competitors.refused.already-present": ["TODO(copy)", { slots: {}, fixedBy: "REQ-071 c4" }],
  "settings.competitors.refused.set-full": ["TODO(copy)", { slots: {}, fixedBy: "REQ-071 c4" }],

  // ── Publishing ─────────────────────────────────────────────────────────
  "settings.publishing.title": ["Publishing", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.publishing.veto": ["veto window", { slots: {}, fixedBy: "BUILD §4.7" }],
  // §4.7 asks for a "veto window stepper". A stepper's two ends are
  // symbols, not sentences — the same footing `unmeasured.dash` sits on in
  // `laws.ts` ("a transcription of REQ-004's own '—' character, on the same
  // footing as the thirteen band words"). They are keys rather than JSX
  // literals so that an owner who wants words there ("shorter" / "longer")
  // changes two values and no code. Flagged in this issue's PR body.
  // The stepper's value, in whole days — the unit the control offers and
  // the approved S18 draws ("1 day"). A key rather than a symbol appended
  // in code, because the word has a plural and a plural is the product
  // speaking; the count is the slot. Two keys and not one with a rule: this
  // registry interpolates, it does not pluralise, and a screen choosing
  // between them is choosing a written line rather than composing one.
  "settings.publishing.veto.one-day": ["{days} day", { slots: { days: "text" }, fixedBy: "BUILD §4.7" }],
  "settings.publishing.veto.days": ["{days} days", { slots: { days: "text" }, fixedBy: "BUILD §4.7" }],
  "settings.publishing.veto.less": ["−", { slots: {}, fixedBy: 'BUILD §4.7 ("stepper")' }],
  "settings.publishing.veto.more": ["+", { slots: {}, fixedBy: 'BUILD §4.7 ("stepper")' }],
  "settings.publishing.publish-time": ["publish time", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.publishing.time-zone": ["time zone", { slots: {}, fixedBy: "REQ-070 c1" }],
  "settings.publishing.enabled": ["Publishing", { slots: {}, fixedBy: "REQ-070 c1" }],
  "settings.publishing.destinations": ["destinations", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.publishing.reconnect": ["Reconnect", { slots: {}, fixedBy: "BUILD §4.7" }],
  // Issue #240 — the control on a destination that has never held a
  // credential. **Its own key, not `reconnect` reused**: a founder who
  // chose WordPress at setup has a destination row and has never connected
  // it, and "Reconnect" tells them they did something they did not.
  "settings.publishing.connect": ["TODO(copy)", { slots: {}, fixedBy: "BUILD §4.7 · REQ-060" }],
  // 2026-09-06, issue #46 (REQ-073 c2). One written line per selected pair,
  // stating what that pair does to a draft the customer never acts on.
  // Three keys, one per pair, and a fourth pair is a type error. The
  // sentences are the owner's; they render as the `TODO(copy)` marker until
  // written (#93's screen arm — the panel must stay reviewable).
  "settings.publishing.pair.autopilotWindow": [
    "TODO(copy)",
    { slots: {}, fixedBy: "REQ-073 c2" },
  ],
  "settings.publishing.pair.autopilotZero": [
    "TODO(copy)",
    { slots: {}, fixedBy: "REQ-073 c2" },
  ],
  "settings.publishing.pair.copilot": ["TODO(copy)", { slots: {}, fixedBy: "REQ-073 c2" }],

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

  // ── Issue #240: the credential form, and the whole of what it says.
  //
  // Four keys and no fifth. There is deliberately no key for a refusal:
  // the credential is validated by the health check, never by the act of
  // connecting, so what a customer reads after a refusal is the *state's*
  // own line (`destination.line.*`, minted by #48) on a redrawn card — not
  // a sentence this form composed, and never anything the site said back.
  "settings.destination.site-url": ["TODO(copy)", { slots: {}, fixedBy: "REQ-060" }],
  // The WordPress user the application password was issued to (master's
  // ruling, 2026-09-07). A WordPress application password authenticates as
  // `username:app-password` — it is scoped to the account that created it —
  // so without this field the REST index cannot be read and every real site
  // would refuse. The mockup's "two fields and no third" is amended by that
  // ruling: three, and no fourth.
  "settings.destination.username": ["TODO(copy)", { slots: {}, fixedBy: "REQ-060" }],
  // The word "application" is the point of this label: a WordPress
  // application password is not the account password, and the label is
  // where that distinction is made to a customer.
  "settings.destination.app-password": ["TODO(copy)", { slots: {}, fixedBy: "REQ-060" }],
  "settings.destination.app-password.help": ["TODO(copy)", { slots: {}, fixedBy: "REQ-060" }],
  "settings.destination.submit": ["TODO(copy)", { slots: {}, fixedBy: "REQ-060" }],
  "settings.destination.health.ok": [
    "ok",
    { slots: {}, fixedBy: "BUILD §10 (`health(ok/expired/error)`)" },
  ],
  "settings.destination.health.expired": ["expired", { slots: {}, fixedBy: "BUILD §10" }],
  "settings.destination.health.error": ["error", { slots: {}, fixedBy: "BUILD §10" }],

  // The other two actions a destination can offer, beside `Reconnect`
  // above. §4.7 names only Reconnect, so both are the owner's words.
  //
  // `reconnect-other-account` is a **control of its own** and not
  // `Reconnect` relabelled (ADR-086 decision 2): where the stored
  // credential is valid and simply cannot publish, re-entering it is the
  // one action guaranteed to change nothing, and the remedy is an account
  // that has the capability. `DestinationAction` makes that a union
  // member, so a screen that offered ordinary Reconnect there fails to
  // typecheck rather than failing a copy review — this key is the label
  // for the control that member selects.
  "settings.publishing.reconnect-other-account": [
    "TODO(copy)",
    { slots: {}, fixedBy: "ADR-086 · REQ-060 c7" },
  ],
  "settings.publishing.set-dns": ["TODO(copy)", { slots: {}, fixedBy: "BUILD §9 · REQ-059 c2" }],

  // ── Notifications ──────────────────────────────────────────────────────
  // One key per `stoppable: 'toggle'` row of `MAIL_KINDS`, named by the row's
  // own key, which is the word §12 prints for that mail. The panel projects
  // its rows from the register (never from a hand-written three), so a fourth
  // stoppable kind arrives as a missing-key compile error rather than as a
  // mail a customer cannot stop.
  "settings.notifications.title": ["Notifications", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.notifications.draft-ready": ["Daily draft-ready mail", { slots: {}, fixedBy: "BUILD §12" }],
  "settings.notifications.published": ["Published-page mail", { slots: {}, fixedBy: "BUILD §12" }],
  "settings.notifications.weekly": ["Monday movement mail", { slots: {}, fixedBy: "BUILD §12" }],

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
  // 2026-09-07, issue #136 — REQ-097 criterion 6: "they are told in writing,
  // on the screen they were on, that billing cannot be reached, that they may
  // try again, and one way to reach a person". Three statements, so three
  // keys: a single key would let the second and third be lost by writing the
  // first, and the criterion names all three. Owner-owed, and carrying the
  // renderable marker rather than the empty value — this line appears only
  // when a customer has pressed a billing control and Stripe refused, which
  // is precisely the state that must not be silent while the wording is
  // being decided.
  "settings.billing.unreachable": [
    "TODO(copy)",
    { slots: {}, fixedBy: "REQ-097 c6" },
  ],
  "settings.billing.try-again": ["TODO(copy)", { slots: {}, fixedBy: "REQ-097 c6" }],
  "settings.billing.reach-a-person": [
    "TODO(copy)",
    { slots: {}, fixedBy: "REQ-097 c6" },
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

  // 2026-09-06, issue #35 — REQ-077's four sentences on this card. Every
  // one is owner-owed and empty, like `settings.account.magic-link` two
  // lines above and for the same reason: nothing renders them yet. Identity
  // returns the *key* for each answer (`beginEmailChange`'s `lineKey`,
  // `accountCard`'s `noteKeys`) and speaks no sentence, and the panel that
  // will render them is not in this build — so `copy()`'s throw on an
  // empty value cannot take a screen down, and the marker's renderable
  // form would only put "TODO(copy)" where a customer will later read a
  // sentence.
  //
  // The first is REQ-077 criterion 1's second note line — "one saying
  // invoices and receipts go to the address held in the billing portal and
  // are changed there (REQ-076 criterion 2), not here". It is a note, not a
  // control: this screen offers no way to change an invoice address and
  // this key is the line that says where one is.
  //
  // The next three are the three answers `beginEmailChange` can give. Three
  // lines, not one with a variable: "that address already belongs to an
  // account", "that is not an address we can send to" and "we could not
  // start the change just now" are three different facts about what
  // happened, and a customer who is told the second when the third is true
  // will retype an address that was never the problem.
  "settings.account.invoices-elsewhere": ["", { slots: {}, fixedBy: "REQ-077 c1" }],
  "settings.account.email-in-use": ["", { slots: {}, fixedBy: "REQ-077 c2" }],
  "settings.account.email-invalid": ["", { slots: {}, fixedBy: "REQ-077 c2" }],
  "settings.account.email-change-unavailable": ["", { slots: {}, fixedBy: "REQ-077 c2" }],

  // 2026-09-07, issue #134 — the four the pending-change state needs, now
  // that something renders it. They take the **marker** and not the empty
  // value the four above take, and the difference is not inconsistency: it
  // is the #93 ruling applied to what each one is.
  //
  // Those four are *lines*. The card reads a line through the shell's
  // `writtenLine`, which renders an owner-owed key as nothing, so an
  // unwritten line costs a customer a sentence they never saw.
  //
  // Two of these four are *labels on controls* — a field and a button.
  // A control with no name is not a quiet omission, it is a control nobody
  // can use, and the empty value's throw would take the whole Settings
  // screen down instead. So all four carry the marker and render as
  // themselves, which is also what makes the state reviewable on a preview
  // — the design gate this issue opens with.
  //
  // `email-pending-expires` interpolates the moment, formatted by the
  // shell's one `formatDateTime` in the site's own zone: the card states no
  // date of its own and the sentence carries no second copy of one.
  "settings.account.new-email": ["TODO(copy)", { slots: {}, fixedBy: "REQ-077 c2" }],
  "settings.account.email-pending": ["TODO(copy)", { slots: {}, fixedBy: "REQ-077 c4" }],
  "settings.account.email-pending-expires": [
    "TODO(copy)",
    { slots: { at: "date" }, fixedBy: "REQ-077 c4" },
  ],
  "settings.account.cancel-change": ["TODO(copy)", { slots: {}, fixedBy: "REQ-077 c4" }],

  // ── Your content ───────────────────────────────────────────────────────
  // 2026-09-08, issue #374 — the approved screen set's S18 gives the two
  // content constraints a card of their own, "How your pages sound", and
  // ruling 11a makes its unbracketed strings approved copy. Filled from the
  // set, not written here (constitution rule 1.2 — copying a recorded owner
  // ruling is not inventing one).
  //
  // `placeholder` is the exception and stays owed: the set brackets it
  // ("[voice description — the customer writes this; one field, nothing is
  // learned about them]"), which is the set's own way of saying the words
  // are the owner's. It takes the marker rather than the empty value on the
  // #93 ruling — the field renders on a screen the customer reaches, and a
  // placeholder that throws would take the card down.
  "settings.voice.title": ["How your pages sound", { slots: {}, fixedBy: "REQ-055" }],
  "settings.voice.never-claim": ["Never claim", { slots: {}, fixedBy: "REQ-053" }],
  "settings.voice.add-claim": [
    "add a claim your pages must never make",
    { slots: {}, fixedBy: "REQ-053" },
  ],
  "settings.voice.add": ["Add", { slots: {}, fixedBy: "REQ-053" }],
  // REQ-053's own promise, in the set's words: the list is a filter and not
  // a preference, and a draft that matches one is held and named back.
  "settings.voice.filter-note": [
    "A hard filter on every page. A draft that matches an entry is held and returned to you naming it.",
    { slots: {}, fixedBy: "REQ-053" },
  ],
  "settings.voice.placeholder": ["TODO(copy)", { slots: {}, fixedBy: "REQ-055" }],

  // REQ-075's own promise, and the reason the three switches above it are
  // safe to offer: the mail a customer cannot lose is named, so turning all
  // three off is a decision rather than a risk. Approved (11a).
  "settings.notifications.always-on": [
    "Sign-in and account mail cannot be switched off.",
    { slots: {}, fixedBy: "REQ-075" },
  ],

  // REQ-073 c2's one line on what the mode pair does — both modes in one
  // sentence, which is what makes it a choice rather than two labels.
  // Approved (11a); the three `pair.*` keys beside it stay as they are,
  // because they answer a different question (what happens to THIS page,
  // stated where a page is).
  "settings.publishing.pair.note": [
    "Autopilot: a page publishes when its veto window ends unless you stop it. Copilot: nothing publishes without your approval.",
    { slots: {}, fixedBy: "REQ-073 c2" },
  ],

  "settings.content.title": ["Your content", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.content.pages": ["Pages", { slots: {}, fixedBy: 'BUILD §4.7 ("pages count")' }],
  "settings.content.export": ["Export everything", { slots: {}, fixedBy: "BUILD §4.7" }],
  // REQ-078 c5 (issue #52): "Given an export cannot be produced, when the
  // customer requests one, then they are told so in one written line and are
  // not given a partial archive presented as complete." One line, whatever
  // the reason — the four `ExportFailure` arms are an operator's fact, and
  // naming which one failed tells the customer nothing they can act on. The
  // sentence is the owner's; the key and the single-line shape are not.
  "export.failed": ["TODO(copy)", { slots: {}, fixedBy: "REQ-078 c5" }],
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
