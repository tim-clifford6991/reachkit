// src/lib/presentation/copy/keys/settings.ts — BP-020 decision 5, WO-041
//
// Settings' sentences. No string was seeded here at WO-041. The block that owns Settings fills this file and touches no other
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
//   **The owner's.** A sentence nothing in the spec writes — the magic-link
//   note, and the line an action that is not yet wired reports. Its words
//   are the owner's, never composed here.
//
// Three transcriptions read as lower-case fragments because that is how the
// spec prints them ("changing this rebuilds …", "cancelling keeps …",
// "add/remove"). They are left exactly as printed rather than sentence-cased:
// capitalising is a wording decision and wording is the owner's
// (constitution §1). Flagged in this issue's PR body.
//
// 2026-09-10, issue #460: every sentence this partition still owed is now
// written — the owner approved the master's drafted set ("copy proposal
// approved", proposal sheet
// https://claude.ai/code/artifact/546f45a0-a996-4d25-b85e-fb03fda7b102)
// and the strings land here byte for byte. The values that approval names
// are the owner's; nothing here is composed.
import type { CopyPartition } from "../registry.ts";

export const SETTINGS_COPY = Object.freeze({
  "settings.head": ["What you’re measured as, how pages go out, and your account.", { slots: {}, fixedBy: "BUILD §4.7" }],

  // ── One control word, several positions ────────────────────────────────
  // §4.7 prints "Edit" beside the market chip. Every other value on this
  // screen that is changed rather than switched is changed the same way, and
  // one key serving several positions is WO-070's precedent (constitution
  // rule 1.1) — naming a control by what it does, rather than minting a
  // second, third and fourth word for the same act.
  "settings.edit": ["Edit", { slots: {}, fixedBy: 'BUILD §4.7 ("chip + Edit")' }],
  // S18 draws two words for the act, and both are approved (ruling 11a):
  // "Edit" beside the market, "Change" beside the domain, the publish time
  // and the time zone (issue #506). One key per drawn word, each serving
  // every position the set gives it.
  "settings.change": ["Change", { slots: {}, fixedBy: "S18 (11a)" }],
  // The other two words the field Edit opens needs (issue #231), and the
  // same one-key-serving-several-positions rule: what the button does is
  // the same act on the domain and on the category, so it is one word each
  // and not two per control. Leaving a field is offered because opening
  // one must be undoable — a customer who presses Edit to see what is
  // there has changed nothing, and must not have to save to get out.
  "settings.save": ["Save", { slots: {}, fixedBy: "REQ-071 c1" }],
  "settings.cancel-edit": ["Cancel", { slots: {}, fixedBy: "REQ-071 c1" }],

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
  "settings.market.pending": [
    "A new {change} takes effect on {date}. Until then no new page is written, and earlier measurements are kept apart, not carried across.",
    { slots: { date: "date", change: "text" }, fixedBy: "REQ-071 c1" },
  ],
  "settings.market.effectiveOn": [
    "Saved. Takes effect with the re-measure on {date}.",
    { slots: { date: "date" }, fixedBy: "REQ-071 c6" },
  ],
  // The word each change kind is named by. One key per kind, because
  // `{change}` is a **sentence fragment the owner writes** and never the
  // engine's own `ChangeKind` handle: "domain" and "category" are internal
  // names, and REQ-071's line reads them out to a customer.
  "settings.market.change.domain": ["domain", { slots: {}, fixedBy: "REQ-071 c1" }],
  "settings.market.change.category": ["market", { slots: {}, fixedBy: "REQ-071 c1" }],
  // The one way a market save is refused (issue #231). `saveDomain` answers
  // `unreachable` for a value that is not a registrable domain and for one
  // that does not resolve — one refusal, because the customer's remedy is
  // the same either way and REQ-071 c9 names one. A category save has no
  // refusal: any non-empty string is a market somebody could be measured in.
  "settings.market.refused.unreachable": ["We can’t reach that domain, so it wasn’t saved. Check the spelling.", { slots: {}, fixedBy: "REQ-071 c9" }],

  // ── Competitors ────────────────────────────────────────────────────────
  "settings.competitors.title": ["Competitors", { slots: {}, fixedBy: "BUILD §4.7" }],
  // S18's head count, in the set's own words (11a): "5 of 5". A key and not
  // a slash written in code — "of" is a word, and a word the product speaks
  // is a key. Both numerals are slots, so the cap comes from
  // `BATTERY.COMPETITORS_MAX` and never from a five typed twice.
  "settings.competitors.count": [
    "{taken} of {max}",
    { slots: { taken: "text", max: "text" }, fixedBy: "REQ-071 c16" },
  ],
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
  "settings.competitors.add-label": ["Add a rival", { slots: {}, fixedBy: "BUILD §4.7" }],
  // REQ-071 c16. An empty rival set is a state the product designed (§2.5),
  // not a blank: the line takes no slot, because there is no date and no
  // change to name — only that comparison begins when a rival is added.
  "settings.competitors.none-yet": ["No rivals yet — comparison begins when you add one. Everything else runs as before.", { slots: {}, fixedBy: "REQ-071 c16" }],
  // `addRival`'s own five refusals, one sentence each (issue #231). The
  // rules are `setup/rivals.ts`'s — REQ-071 c4 says they are the same rules
  // — but the sentences are this screen's: `setup.competitors.refused.*`
  // speaks to a founder part-way through setup, and reusing those keys here
  // would put setup's voice on Settings. The map over them is total, so a
  // sixth refusal in the engine is a compile error rather than a refusal
  // that says nothing.
  "settings.competitors.refused.not-a-domain": ["Enter a rival’s domain, like rival.com.", { slots: {}, fixedBy: "REQ-071 c4" }],
  "settings.competitors.refused.does-not-resolve": ["That domain doesn’t resolve, so it can’t be added. Check the spelling.", { slots: {}, fixedBy: "REQ-071 c4" }],
  "settings.competitors.refused.own-domain": ["That’s your own domain. Rivals are other sites.", { slots: {}, fixedBy: "REQ-071 c4" }],
  "settings.competitors.refused.already-present": ["That domain is already one of your rivals.", { slots: {}, fixedBy: "REQ-071 c4" }],
  "settings.competitors.refused.set-full": ["Your set is full. Remove a rival before adding another.", { slots: {}, fixedBy: "REQ-071 c4" }],

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
  "settings.publishing.connect": ["Connect WordPress", { slots: {}, fixedBy: "BUILD §4.7 · REQ-060" }],
  // 2026-09-06, issue #46 (REQ-073 c2). One written line per selected pair,
  // stating what that pair does to a draft the customer never acts on.
  // Three keys, one per pair, and a fourth pair is a type error. The
  // sentences are the owner's.
  "settings.publishing.pair.autopilotWindow": [
    "A draft you don’t touch publishes at the first publish time after its veto window ends.",
    { slots: {}, fixedBy: "REQ-073 c2" },
  ],
  "settings.publishing.pair.autopilotZero": [
    "With no veto window, a draft you don’t touch publishes at your next publish time — there is no interval in which to stop it.",
    { slots: {}, fixedBy: "REQ-073 c2" },
  ],
  "settings.publishing.pair.copilot": ["A draft you don’t touch stays in review and never publishes on its own.", { slots: {}, fixedBy: "REQ-073 c2" }],

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
  "settings.destination.site-url": ["Site URL", { slots: {}, fixedBy: "REQ-060" }],
  // The WordPress user the application password was issued to (master's
  // ruling, 2026-09-07). A WordPress application password authenticates as
  // `username:app-password` — it is scoped to the account that created it —
  // so without this field the REST index cannot be read and every real site
  // would refuse. The mockup's "two fields and no third" is amended by that
  // ruling: three, and no fourth.
  "settings.destination.username": ["Username", { slots: {}, fixedBy: "REQ-060" }],
  // The word "application" is the point of this label: a WordPress
  // application password is not the account password, and the label is
  // where that distinction is made to a customer.
  "settings.destination.app-password": ["Application password", { slots: {}, fixedBy: "REQ-060" }],
  "settings.destination.app-password.help": ["Made in WordPress under Users → Profile → Application Passwords. It isn’t your login password, and you can revoke it there at any time.", { slots: {}, fixedBy: "REQ-060" }],
  "settings.destination.submit": ["Connect", { slots: {}, fixedBy: "REQ-060" }],
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
    "Connect a different account",
    { slots: {}, fixedBy: "ADR-086 · REQ-060 c7" },
  ],
  "settings.publishing.set-dns": ["Set up the DNS record", { slots: {}, fixedBy: "BUILD §9 · REQ-059 c2" }],

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
  // The plan's state, as the approved S18 draws it: a pill beside the
  // figure rather than a row of its own. "active" is the set's own word
  // (11a); "cancelled" is its opposite and the only other state
  // `PlanState` has, so the pair is closed. There is one plan (REQ-022 c3),
  // which is why the pill states the STATE and the plan word beside it was
  // saying nothing the figure had not.
  "settings.billing.active": ["active", { slots: {}, fixedBy: "REQ-076 c3" }],
  "settings.billing.cancelled": ["cancelled", { slots: {}, fixedBy: "REQ-076 c3" }],
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
  // first, and the criterion names all three. The words are the owner's;
  // this line appears only when a customer has pressed a billing control
  // and Stripe refused.
  "settings.billing.unreachable": [
    "Billing can’t be reached right now. Nothing about your plan has changed.",
    { slots: {}, fixedBy: "REQ-097 c6" },
  ],
  "settings.billing.try-again": ["Try again in a moment.", { slots: {}, fixedBy: "REQ-097 c6" }],
  "settings.billing.reach-a-person": [
    "Or write to hello@reachkit.app.",
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
  // §4.7 names a "magic-link note" and prints no note; nothing else in the
  // spec writes one, so the words are the owner's.
  "settings.account.magic-link": ["You sign in with a link we send to this address. There is no password.", { slots: {}, fixedBy: 'BUILD §4.7 ("magic-link note")' }],

  // 2026-09-06, issue #35 — REQ-077's four sentences on this card. Every
  // one is the owner's, like `settings.account.magic-link` two lines above.
  // Identity returns the *key* for each answer (`beginEmailChange`'s
  // `lineKey`, `accountCard`'s `noteKeys`) and speaks no sentence.
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
  "settings.account.invoices-elsewhere": ["Invoices and receipts go to the address in your billing portal, and change there — not here.", { slots: {}, fixedBy: "REQ-077 c1" }],
  "settings.account.email-in-use": ["That address already belongs to a ReachKit account.", { slots: {}, fixedBy: "REQ-077 c2" }],
  "settings.account.email-invalid": ["That isn’t an address we can send to.", { slots: {}, fixedBy: "REQ-077 c2" }],
  "settings.account.email-change-unavailable": ["The change couldn’t start just now. Nothing has changed — try again in a moment.", { slots: {}, fixedBy: "REQ-077 c2" }],

  // 2026-09-07, issue #134 — the four the pending-change state needs, now
  // that something renders it. Two of them are *labels on controls* — a
  // field and a button.
  //
  // `email-pending-expires` interpolates the moment, formatted by the
  // shell's one `formatDateTime` in the site's own zone: the card states no
  // date of its own and the sentence carries no second copy of one.
  "settings.account.new-email": ["New email", { slots: {}, fixedBy: "REQ-077 c2" }],
  "settings.account.email-pending": ["Unconfirmed", { slots: {}, fixedBy: "REQ-077 c4" }],
  "settings.account.email-pending-expires": [
    "A sign-in link went to this address. Use it before {at}, or the change lapses and nothing moves.",
    { slots: { at: "date" }, fixedBy: "REQ-077 c4" },
  ],
  "settings.account.cancel-change": ["Undo change", { slots: {}, fixedBy: "REQ-077 c4" }],

  // ── Your content ───────────────────────────────────────────────────────
  // 2026-09-08, issue #374 — the approved screen set's S18 gives the two
  // content constraints a card of their own, "How your pages sound", and
  // ruling 11a makes its unbracketed strings approved copy. Filled from the
  // set, not written here (constitution rule 1.2 — copying a recorded owner
  // ruling is not inventing one).
  //
  // `placeholder` is the exception: the set brackets it ("[voice
  // description — the customer writes this; one field, nothing is learned
  // about them]"), which is the set's own way of saying the words are the
  // owner's, so its value is the owner's approved wording, not the set's.
  "settings.voice.title": ["How your pages sound", { slots: {}, fixedBy: "REQ-055" }],
  "settings.voice.never-claim": ["Never claim", { slots: {}, fixedBy: "REQ-053" }],
  "settings.voice.add-claim": [
    "add a claim your pages must never make",
    { slots: {}, fixedBy: "REQ-053" },
  ],
  "settings.voice.add": ["Add", { slots: {}, fixedBy: "REQ-053" }],
  // The accessible name on a never-claim tag's × (issue #488), naming the
  // claim it takes out. The set draws the glyph and no words — the footing
  // `setup.competitors.remove` is on — so the sentence was the owner's, and
  // was owed until they approved it on 2026-09-11 (#516).
  "settings.voice.remove-claim": ["Remove {claim}", { slots: { claim: "text" }, fixedBy: "REQ-053" }],
  // REQ-053's own promise, in the set's words: the list is a filter and not
  // a preference, and a draft that matches one is held and named back.
  "settings.voice.filter-note": [
    "A hard filter on every page. A draft that matches an entry is held and returned to you naming it.",
    { slots: {}, fixedBy: "REQ-053" },
  ],
  "settings.voice.placeholder": ["Plain and direct. Short sentences. We say “customers”, never “users”.", { slots: {}, fixedBy: "REQ-055" }],

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
  "export.failed": ["The export couldn’t be produced just now. Nothing partial was sent — try again in a moment.", { slots: {}, fixedBy: "REQ-078 c5" }],
  "settings.content.voice": ["Brand voice", { slots: {}, fixedBy: "BUILD §8 rule 7" }],
  "settings.content.do-not-claim": ["Do-not-claim list", { slots: {}, fixedBy: "BUILD §8 rule 4" }],

  // ── An action that has no wiring yet ───────────────────────────────────
  // The seven actions call their declared interfaces
  // (`actions.ts`); on this build every one of those interfaces answers "not
  // wired yet, and here is the issue that wires it". That answer is a state
  // the customer is entitled to be told about in writing — and the sentence
  // telling them is the owner's, never a composed placeholder.
  "settings.action.not-yet": ["This isn’t available yet.", { slots: {}, fixedBy: "BUILD §4.7" }],
}) satisfies CopyPartition;
