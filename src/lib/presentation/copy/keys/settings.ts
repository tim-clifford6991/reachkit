// src/lib/presentation/copy/keys/settings.ts — BP-020 decision 5, WO-041
//
// Settings' sentences. No string was seeded here at WO-041. The block that owns Settings fills this file and touches no other
// partition.
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
//   three recurring mails' own names.
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
// written — the owner approved the drafted set ("copy proposal
// approved", proposal sheet
// https://claude.ai/code/artifact/546f45a0-a996-4d25-b85e-fb03fda7b102)
// and the strings land here byte for byte. The values that approval names
// are the owner's; nothing here is composed.
import type { CopyPartition } from "../registry.ts";

export const SETTINGS_COPY = Object.freeze({

  // ── One control word, several positions ────────────────────────────────
  // S18 draws one word for the act beside the market, the domain, the publish
  // time and the time zone, so one key serves every position.
  "settings.change": "Change",
  // The other two words the field Edit opens needs (issue #231), and the
  // same one-key-serving-several-positions rule: what the button does is
  // the same act on the domain and on the category, so it is one word each
  // and not two per control. Leaving a field is offered because opening
  // one must be undoable — a customer who presses Edit to see what is
  // there has changed nothing, and must not have to save to get out.
  "settings.save": "Save",
  "settings.cancel-edit": "Cancel",

  // SPEC §4 (2026-09-20, #908, issue #913) — "every Settings change
  // confirms or refuses in words on screen". One pair of sentences for
  // every card, because what a saved setting has in common is the only
  // thing the customer needs: it is stored, and when it starts to matter.
  // Drafts in the registry's voice under issue 759's ruling; the owner may
  // correct them.
  //
  // Two "saved" sentences and not one with a `{when}` slot, because the
  // two answers are different facts rather than one fact with a variable
  // in it: the time to stop a page, the zone, the switch, the mail switches and
  // the never-claim list all bite the moment they are written, and the
  // publish time bites on the next page that goes out. A slot would make
  // the screen compose the difference; two written lines let the owner
  // word each of them.
  "settings.answer.saved": "Saved. It takes effect straight away.",
  "settings.answer.saved-next-page": "Saved. Your next page goes live at the new time.",
  "settings.answer.refused": "That didn’t save, so nothing changed. Try again.",
  /** Issue 1196: a press whose request never came back — the network or the
   *  server failed, not a refusal. Drafted; the owner may correct it. */
  "settings.answer.could-not-ask": "This wasn’t saved. Check your connection and press again.",
  // The canvas's own badge on a settings card (R4-11), shown where the
  // last change on that card was stored. It is the quiet half of the same
  // answer the toast speaks — a customer who looked away still sees that
  // the card is saved.
  "settings.answer.saved-badge": "Saved",

  // ── Your market ────────────────────────────────────────────────────────
  /* ── Your business (SPEC §7, 2026-09-20 · #926) ────────────────────────
     "**What a page is written from.** The confirmed business profile — what
     the business does, sells and promises, who it serves, its vocabulary —
     joins the writer's inputs."

     Every sentence below is **drafted** under the owner's 2026-09-16 ruling
     (#759), and seven of them are the ones #926 itself proposes, taken
     verbatim from its "Drafted sentences (owner may correct)" list. The
     rest are the labels and the answers those seven need to stand up.

     **Nothing here names a field the crawl does not store.** #926: show
     only what is already measured. Each group's head is the label for one
     stored field, and a field the site was not read for has no group on the
     screen at all rather than an empty one — so there is no "not measured"
     sentence per field, only the one for a profile nobody has read. */
  "settings.business.title": "What We Read from Your Site",
  "settings.business.lead": "Change any line. Your next page follows it.",
  // The group heads (#926).
  "settings.business.job": "What you do",
  "settings.business.offering": "Kind of business",
  "settings.business.products": "What you sell",
  "settings.business.claims": "What you promise",
  "settings.business.audienceTerms": "Who you serve",
  "settings.business.vocabulary": "Words you use",

  // The controls. `remove` is an icon-only button's accessible name, which names the item it removes.
  "settings.business.add": "Add",
  "settings.business.add.label": "Add to {group}",
  "settings.business.remove": "Remove {item}",

  // Facts we can quote — #926's own head and its own second clause.
  "settings.business.facts.title": "Facts we can quote",
  "settings.business.facts.lead": "Word for word, each linked to where we read it.",
  // How many of the site's pages carry the passage. Two keys, because the
  // unit is a word with a plural and "1 pages" is not a sentence the
  // product says.
  "settings.business.facts.quote": "“{passage}”",
  "settings.business.facts.pages": "· on {count} pages",
  "settings.business.facts.switch-off": "Don’t Quote This",
  "settings.business.facts.switch-on": "Quote This Again",
  "settings.business.facts.off": "Off",
  "settings.business.facts.none": "No page of your site has given us a fact to quote yet.",

  // The last read, and the way to ask for another. The action is
  // `remeasureNowAction`'s — #837's bounded re-measure, reused rather than
  // given a second bound — so its refusals speak `setup.remeasure.*`, which
  // the registry already carries.
  // One setting line and its dialog: *Change* is named for its line, a list shows two and how many more.
  "settings.change.name": "Change {label}",
  "settings.close": "Close",
  "settings.line.empty": "Nothing read yet",
  "settings.line.more": "+{n}",
  "settings.dialog.add.placeholder": "Add one",
  "settings.business.asks.value": "{n} questions",
  "settings.business.asks.one": "1 question",
  "settings.business.read-at": "Last read {on}",
  "settings.business.read-never": "Not read yet",
  "settings.business.read-line": "Last read {on} · {count} pages",
  // SPEC §0 and §5 (2026-09-29, issue 1133): the knowledge base — what the
  // pages were read to say, each with its page, and the founder's five
  // answers. Every line is drafted for the owner; the five questions
  // themselves are `setup.business.question.*`.
  "settings.knowledge.lead": "Read from your own pages, each with the page it came from. Your pages are written from this.",
  "settings.knowledge.things.lead": "Optional. Each one you add can appear on a page.",
  "settings.knowledge.questions": "What buyers ask",
  "settings.knowledge.from-you": "You told us",
  "settings.business.read-again": "Read My Site Again Now",

  // ── The tab bar (owner R7, 2026-10-31): Your business · Pages · Account. Account reuses `settings.account.title`.
  "settings.tabs.label": "Settings sections",
  "settings.tab.business": "Your Business",
  "settings.tab.pages": "Pages",

  "settings.market.title": "Your Site and Market",
  "settings.market.domain": "Your website",
  "settings.market.your-market": "Your market",
  // What a pass reads for this market, from the same stored rows the Competitors tab reads.
  // Issue 837 (owner ruling 2026-09-17): a category change measures again right away.
  "settings.market.consequence.market": "Read from your site. Change it and we check it again at once.",
  // REQ-071's two dated statements about the market (issue #204). Both take
  // their date from `effectiveOn()` and neither computes one: c1 states the
  // date a change being typed *would* take effect, before it is saved; c6
  // states the date a saved change takes effect, until the pass adopts it.
  "settings.market.pending": "Your new {change} starts on {date}. No new page is written until then.",
  // Issue 837 (owner ruling 2026-09-17): a saved category measures the
  // market again right away. Drafted under issue 759's ruling.
  "settings.market.remeasuring": "Saved. We’re checking your market again now.",
  // Issue 866 (owner decision 2026-09-17): a category is measured again at
  // once, so the category's own statements never name a Monday. Four lines,
  // drafted under issue 759's ruling — what saving one will do (before the
  // press, in place of REQ-071 c1's dated line, which stays the domain's),
  // what an unchanged save did, and a saved category no pass has adopted yet.
  "settings.market.category.starts-now": "Saving a new market starts a new check right away.",
  "settings.market.category.unchanged": "Saved. That’s your current market, so nothing changed.",
  "settings.market.category.cleared": "Saved. We’ll use the market we read from your site.",
  "settings.market.category.not-measured-yet": "Saved, not checked yet. Press Check my market now, or wait for {date}.",
  // The standalone control (issue 866, fault 3): the only plain way to start
  // a pass early. What it does is said before it spends; a refused press
  // reads the same two sentences the thin-market choice is refused with
  // (`setup.remeasure.refused.*`), because the bound and the remedy are the
  // same one.
  "settings.market.remeasure.action": "Check My Market Now",
  // The weekday is the weekly pass's own, read off the next check, never written in.
  "settings.market.checked": "Checked every {day}: {searches} searches, {questions} questions to AI, {competitors} competitors",
  "settings.market.next": "Next check {date}",
  "settings.market.remeasure.started": "We’re checking your market again. Your pages follow when it’s done.",
  "settings.market.effectiveOn": "Saved. Takes effect with the check on {date}.",
  // The word each change kind is named by. One key per kind, because
  // `{change}` is a **sentence fragment the owner writes** and never the
  // engine's own `ChangeKind` handle: "domain" and "category" are internal
  // names, and REQ-071's line reads them out to a customer.
  "settings.market.change.domain": "website",
  "settings.market.change.category": "market",
  // The one way a market save is refused (issue #231). `saveDomain` answers
  // `unreachable` for a value that is not a registrable domain and for one
  // that does not resolve — one refusal, because the customer's remedy is
  // the same either way and REQ-071 c9 names one. A category save has no
  // refusal: any non-empty string is a market somebody could be measured in.
  "settings.market.refused.unreachable": "We can’t reach that website, so it wasn’t saved. Check the spelling.",
  // D66 after setup (issue 1692). Drafted (#759).
  "settings.locale.note": "Changing it starts a new check. Older results stay, with their dates.",
  "settings.locale.unchanged": "That’s your current country and language, so nothing changed.",
  "settings.locale.refused": "We don’t cover that country in that language, so it wasn’t saved.",

  // ── Competitors ────────────────────────────────────────────────────────
  // D28 (owner, 2026-10-02, #1185): drafted, named in the pull request.
  "settings.market.overridden": "This is the market you set. We use it until you change it.",
  "settings.competitors.concluded": "Found in your market. Remove or add any.",
  "settings.competitors.overridden": "These are the competitors you set. ReachKit keeps your list as it is.",
  "settings.competitors.title": "Competitors",
  // S18's head count, in the set's own words (11a): "5 of 5". A key and not
  // a slash written in code — "of" is a word, and a word the product speaks
  // is a key. Both numerals are slots, so the cap comes from
  // `BATTERY.COMPETITORS_MAX` and never from a five typed twice.
  "settings.competitors.count": "{taken} of {max}",
  // The add field's own name, apart from the card's heading (issue #270).
  "settings.competitors.add-label": "Add a competitor",
  // REQ-071 c16. An empty rival set is a state the product designed (§2.5),
  // not a blank: the line takes no slot, because there is no date and no
  // change to name — only that comparison begins when a rival is added.
  "settings.competitors.placeholder": "competitor.com",
  // One card per competitor (issue 1974): who found it, and its figures from the Competitors tab's readers.
  "settings.competitors.added": "Added by you",
  "settings.competitors.google": "On Google’s first page",
  "settings.competitors.ai": "In AI answers",
  "settings.competitors.figure": "{n} of {of}",
  "settings.competitors.not-measured": "not checked yet",
  "settings.competitors.measured-from": "First check {date}",
  "settings.competitors.you": "You",
  // Issue 858: a far larger competitor stays named apart from the comparison.
  "settings.competitors.full": "You can follow up to {max} competitors. Remove one to add another.",
  "settings.competitors.row": "On Google’s first page {google} · In AI answers {ai}",
  "settings.competitors.you.line": "You, for comparison: on Google’s first page {google} · in AI answers {ai}",
  "settings.competitors.leaders": "For now we don’t compare you with {names}. They’re far larger.",
  "settings.competitors.none-yet": "No competitors yet. Comparison begins when you add one.",
  // `addRival`'s own five refusals, one sentence each (issue #231). The
  // rules are `setup/rivals.ts`'s — REQ-071 c4 says they are the same rules
  // — but the sentences are this screen's: `setup.competitors.refused.*`
  // speaks to a founder part-way through setup, and reusing those keys here
  // would put setup's voice on Settings. The map over them is total, so a
  // sixth refusal in the engine is a compile error rather than a refusal
  // that says nothing.
  "settings.competitors.refused.not-a-domain": "Enter a web address, like competitor.com.",
  "settings.competitors.refused.does-not-resolve": "We can’t find a website at that address. Check the spelling.",
  "settings.competitors.refused.own-domain": "That’s your own website.",
  "settings.competitors.refused.already-present": "That site is already on your list.",
  "settings.competitors.refused.set-full": "Your list is full. Remove a competitor before adding another.",

  // ── Publishing ─────────────────────────────────────────────────────────
  "settings.publishing.title": "Publishing",
  // SPEC §7 (2026-09-20, #908, issue #914) — "Screens and mail say *Stop
  // this page*. 'Veto' remains the internal word". §4.7's own label was
  // the internal word; the canvas (R4-11) gives the customer's, and the
  // note under it says what the number measures. The key keeps its name:
  // the mechanism, the column and the stepper are still the veto window.
  // Drafted from the canvas under issue 759's ruling; the owner may
  // correct both sentences.
  "settings.publishing.veto": "Time to stop a page",
  // The stepper's value, in whole days — the unit the control offers and
  // the approved S18 draws ("1 day"). A key rather than a symbol appended
  // in code, because the word has a plural and a plural is the product
  // speaking; the count is the slot. Two keys and not one with a rule: this
  // registry interpolates, it does not pluralise, and a screen choosing
  // between them is choosing a written line rather than composing one.
  "settings.publishing.veto.one-day": "{days} day",
  "settings.publishing.veto.days": "{days} days",
  /** The stepper draws lucide Minus and Plus; its buttons are named in words, in the setting's own wording. */
  "settings.publishing.veto.less.label": "One day less",
  "settings.publishing.veto.more.label": "One day more",
  "settings.publishing.publish-time": "Publish time",
  "settings.publishing.time-zone": "Time zone",
  "settings.publishing.destinations": "Where pages go live",
  // The card's head, the timeline and the help lines, in the board's words (issue 1751).
  "settings.publishing.on": "On",
  "settings.publishing.off": "Off",
  "settings.publishing.on.lead": "On. A page goes live on each planned day.",
  "settings.publishing.off.lead": "Paused: no page goes live until you turn publishing on. Your pages are kept.",
  "settings.publishing.flow.title": "How each page goes out",
  "settings.publishing.flow.written": "Written and emailed",
  "settings.publishing.flow.window": "{window} to edit or stop it",
  // "This week" is the link to the calendar.
  "settings.publishing.flow.window.note": "From the mail or This week",
  "settings.publishing.flow.live": "Goes live",
  "settings.publishing.flow.paused": "Paused: nothing goes live",
  "settings.publishing.where.same": "Your website stays as it is.",
  "settings.publishing.time-zone.note": "From your browser.",
  "settings.publishing.reconnect": "Reconnect WordPress",
  // Issue #240 — the control on a destination that has never held a
  // credential. **Its own key, not `reconnect` reused**: a founder who
  // chose WordPress at setup has a destination row and has never connected
  // it, and "Reconnect" tells them they did something they did not.
  "settings.publishing.connect": "Connect WordPress",
  // 2026-09-06, issue #46 (REQ-073 c2). One written line per selected pair,
  // stating what that pair does to a draft the customer never acts on.
  // Three keys, one per pair, and a fourth pair is a type error. The
  // sentences are the owner's.
  "settings.publishing.pair.autopilotWindow": "A page you leave alone goes live by itself. It goes at the first publish time after its time to stop.",
  "settings.publishing.pair.autopilotZero": "With no time to stop, a page goes live at your next publish time.",


  // The two destination kinds and the three health states. §10's
  // `destinations` row prints `kind(hosted/wordpress)` and
  // `health(ok/expired/error)`; §9 prints the two kinds as customer-facing
  // names ("Hosted CMS", "WordPress"). Health is a state, never an error
  // (ADR-086), so all three read as states here and none as a failure.
  "settings.destination.hosted": "Hosted",
  "settings.destination.wordpress": "WordPress",

  // ── Issue #240: the credential form, and the whole of what it says.
  //
  // A refused credential reads the state's own line on the redrawn card;
  // the form's one line of its own is the https refusal, before any check.
  "settings.destination.site-url": "Site URL",
  "settings.destination.https-only": "The site URL must start with https://, so your password stays private. If your site has no https:// address, ask your web host to add one.",
  // The WordPress user the application password was issued to (ruling,
  // 2026-09-07). A WordPress application password authenticates as
  // `username:app-password` — it is scoped to the account that created it —
  // so without this field the REST index cannot be read and every real site
  // would refuse. The mockup's "two fields and no third" is amended by that
  // ruling: three, and no fourth.
  "settings.destination.username": "Username",
  // The word "application" is the point of this label: a WordPress
  // application password is not the account password, and the label is
  // where that distinction is made to a customer.
  "settings.destination.app-password": "Application password",
  "settings.destination.app-password.help": "Made in WordPress under Users → Profile → Application Passwords. It isn’t your login password, and you can revoke it there at any time.",
  "settings.destination.submit": "Connect",
  "settings.destination.health.ok": "ok",
  "settings.destination.health.expired": "expired",
  "settings.destination.health.error": "error",

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
  "settings.publishing.reconnect-other-account": "Connect a Different Account",
  "settings.publishing.set-dns": "Connect Your Website",

  // ── The customer's own subdomain (SPEC §5, ruling of 2026-09-12) ───────
  //
  // **Two words, and the ruling writes both.** §5: "settings shows 'live'
  // or 'waiting for DNS'", and §12 ruling 7 says it again. They are the
  // owner's own strings, quoted here rather than composed: nothing about
  // them was chosen by the code.
  //
  // They are not `settings.destination.health.*` renamed. Health is what
  // the destination's end can be seen to be; these say whether the
  // customer's own record has resolved yet, and a destination can be
  // perfectly healthy with a record nobody has pointed.
  "settings.destination.hostname.live": "Live",
  "settings.destination.hostname.waiting": "waiting for the setting",

  // ── Check connection (issue #757; owner ruling 2026-09-16) ────────────
  //
  // The founder's own press, beside the CNAME record on `/setup` and in
  // Settings. Three answers the screen must not fold into two — the domain
  // list said live, the domain list said waiting, or nothing could be asked
  // — and the press inside the floor, which asked nothing and says when it
  // may. Drafted and shipped under the owner ruling of 2026-09-16 (#759).
  "settings.destination.check.button": "Check Connection Now",
  "settings.destination.check.live": "Connected. Your pages will publish to this address.",
  "settings.destination.check.pending-dns": "Not connected yet. New settings can take a few hours, and we check every hour.",
  "settings.destination.check.could-not-ask": "We couldn’t check just now. Try again in a moment.",
  // A deployment with no verification bound: pressing again changes nothing,
  // so this line never says to try again, and it is ReachKit's to fix, not
  // the founder's DNS (issue 840). Since issue 856 it is the second step's
  // line only, under the public DNS answer, and says what that answer
  // confirmed: `not-configured` where the record points here,
  // `not-configured.unconfirmed` where it does not, or could not be read.
  "settings.destination.check.not-configured": "Your setting is in place. We finish the secure connection, with nothing more for you to do.",
  "settings.destination.check.not-configured.unconfirmed": "Once your setting points to the right place, we finish the rest.",
  // The press's first step (issue 856): what public DNS says about the
  // record, before any vendor is asked. `{target}` is where the record
  // points instead — a host name, or an address where a proxy answers.
  "settings.destination.check.dns.points-here": "Record found, pointing at the right place.",
  "settings.destination.check.dns.points-elsewhere": "Your setting points to {target}. Change it to the value shown above.",
  "settings.destination.check.dns.not-yet": "No setting found yet. It can take a few hours.",
  "settings.destination.check.dns.unknown": "We couldn’t look up your setting just now. Try again in a minute.",
  /** `seconds` is how long until the press may ask again, as a whole
   *  number, counting down on screen. The registry does not pluralise, so
   *  the number stands after a colon (issue 840). */
  "settings.destination.check.too-soon": "We last checked at {time}, and the answer above is that check. You can check again in {seconds} seconds.",

  // ── Notifications ──────────────────────────────────────────────────────
  // One key per `stoppable: 'toggle'` row of `MAIL_KINDS`, named by the row's
  // own key, which is the word §12 prints for that mail. The panel projects
  // its rows from the register (never from a hand-written three), so a fourth
  // stoppable kind arrives as a missing-key compile error rather than as a
  // mail a customer cannot stop.
  "settings.notifications.title": "Mail",
  "settings.notifications.draft-ready": "A page is ready",
  // Under the switch while it is off: turning the mail off never holds a page. "This week" is the link to the calendar.
  "settings.notifications.draft-ready.off": "Pages still go live on their day. You can stop them from This week.",
  "settings.notifications.published": "When your first page goes live",
  "settings.notifications.weekly": "Monday mail",
  // The card's lead and each row's line (issue 1751; Q10 for the page-ready row). No send time: owner R29, 2026-10-23.
  "settings.notifications.to": "Sent to {email}",
  "settings.notifications.weekly.note": "Mondays. What went live, your totals so far, and the next {days} pages.",
  "settings.notifications.draft-ready.note": "One mail per page, {window} before it goes live, until your first Monday mail. Turn on to keep getting them.",
  "settings.notifications.none": "You get no ReachKit mail except sign-in and account mail. Pages still go live on their day.",

  // ── Billing ────────────────────────────────────────────────────────────
  // Every word here names a value or a destination; not one of them is a
  // figure. REQ-097 c5: the values rendered beside these words are read from
  // Stripe's own surface and carry that provenance in the model
  // (`billing.ts`); ReachKit computes none of them.
  "settings.billing.title": "Billing",
  // The plan's state, one pill per `PlanState`: there is one plan (REQ-022 c3), so the pill names the state.
  "settings.billing.active": "Active",
  "settings.billing.cancelled": "Cancelled",
  "settings.billing.ended": "Ended",
  "settings.billing.ended.line": "Your access has ended, so we’ve stopped writing and publishing pages.",
  "settings.billing.ended.pages": "Your pages go offline on {date}.",
  "settings.billing.ended.contact": "To start again, write to hello@reachkit.app.",
  "settings.billing.payment-failed": "Your last payment didn’t go through.",
  "settings.billing.pay": "Pay in Stripe",
  "settings.billing.next-invoice": "Next invoice",
  "settings.billing.status": "Status",
  "settings.billing.plan": "Plan",
  "settings.billing.billed": "Billed in euros. Cancel any time, and it all runs until the period ends.",
  // 2026-09-21, issue #925 — the three controls that all opened the same
  // Stripe surface are one control. REQ-097 c1 always said there was one
  // destination ("the only thing ReachKit offers for it is a control to that
  // same one destination"); three pills in front of it read as three
  // destinations, and the customer had to guess which pill held the thing
  // they came for.
  //
  // So the control says where it goes, and the line under it says what is
  // there. The three things it names are §4.7's own three — `Update card`,
  // `invoices`, `Cancel plan` — and this sentence is the only place they are
  // now spoken, so it is drafted (#759) rather than transcribed: §4.7 prints
  // them as three control words and not as a sentence.
  "settings.billing.manage": "Manage Billing in Stripe",
  "settings.billing.manage.note": "Update your card, download invoices, or cancel.",
  "settings.billing.resume": "Resume My Subscription",
  // 2026-09-07, issue #136 — REQ-097 criterion 6: "they are told in writing,
  // on the screen they were on, that billing cannot be reached, that they may
  // try again, and one way to reach a person". Three statements, so three
  // keys: a single key would let the second and third be lost by writing the
  // first, and the criterion names all three. The words are the owner's;
  // this line appears only when a customer has pressed a billing control
  // and Stripe refused.
  "settings.billing.unreachable": "Billing didn’t load. Your subscription hasn’t changed.",
  "settings.billing.try-again": "Try again in a moment.",
  /** Issue 1196: a plan resumed in place. Drafted; the owner may correct it. */
  "settings.billing.resumed": "Your subscription is running again.",
  "settings.billing.reach-a-person": "Or write to hello@reachkit.app.",

  // The cancelled arm, in the board's words. The date is `paid_through`.
  "settings.billing.cancelling": "Cancelled. Everything keeps running until {date}.",

  // The cancel route (owner E13, 2026-10-19). Drafted.
  // {control} is filled from `settings.billing.manage`, so the line names the card's real button.
  "settings.billing.route": "Reply to any ReachKit email or use {control}.",

  // Billing's "What you got this month" (owner E3, 2026-10-19). Drafted.
  "settings.month.title": "This Month",
  "settings.month.period": "{from} to {to}. All included in {price}.",
  "settings.month.live": "pages went live",
  "settings.month.reports": "Monday mails",
  "settings.month.asked": "searches and AI questions checked",
  // Only where the AI questions were not checked, so the tile's figure is never read as including them.
  "settings.month.asked.split.unmeasured": "{searches} searches, checked each week. AI questions weren’t checked this time.",
  "settings.month.planned": "pages planned this week",
  "settings.month.not-measured": "not checked",
  "settings.month.first": "Your first page goes live {when}.",
  "settings.month.unread": "This month didn’t load. Your subscription is unaffected.",
  "settings.panel.unread": "This part didn’t load. Try again in a minute.",

  // ── Account ────────────────────────────────────────────────────────────
  "settings.account.title": "Account",
  "settings.account.name": "Name",
  "settings.account.email": "Email",
  "settings.account.change-email": "Change Email",
  "settings.account.sign-out": "Sign Out",
  // §4.7 names a "magic-link note" and prints no note; nothing else in the
  // spec writes one, so the words are the owner's.
  "settings.account.magic-link": "You sign in with a link sent here. No password.",

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
  "settings.account.invoices-elsewhere": "Invoices and receipts go to the address in your billing portal, and change there, not here.",
  "settings.account.email-in-use": "That address already belongs to a ReachKit account.",
  "settings.account.email-invalid": "That isn’t an address we can send to.",
  "settings.account.email-change-unavailable": "That didn’t work, so nothing changed. Try again in a minute.",

  // 2026-09-07, issue #134 — the four the pending-change state needs, now
  // that something renders it. Two of them are *labels on controls* — a
  // field and a button.
  //
  // `email-pending-expires` interpolates the moment, formatted by the
  // shell's one `formatDateTime` in the site's own zone: the card states no
  // date of its own and the sentence carries no second copy of one.
  "settings.account.new-email": "New email",
  "settings.account.email-pending": "Unconfirmed",
  "settings.account.email-pending-expires": "Open the link we sent before {at}, or nothing changes.",
  "settings.account.cancel-change": "Undo Change",
  // The export row, in the board's words. Two keys: this registry does not pluralise.
  "settings.account.pages": "Your pages",
  "settings.account.pages.count": "{pages} pages, with images",
  "settings.account.pages.one": "1 page, with images",

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
  "settings.voice.title": "How Your Pages Sound",
  "settings.voice.never-claim": "Never say",
  "settings.voice.add-claim": "Add something your pages must never say",
  // The accessible name on a never-claim tag's × (issue #488), naming the
  // claim it takes out. The set draws the glyph and no words — the footing
  // `setup.competitors.remove` is on — so the sentence was the owner's, and
  // was owed until they approved it on 2026-09-11 (#516).
  // REQ-053's own promise, in the set's words: the list is a filter and not
  // a preference, and a draft that matches one is held and named back.
  "settings.voice.filter-note": "A page that says one of these doesn’t go live. We show you which one it matched.",
  /** The voice card's save control (SPEC.md §5, 2026-09-12: "the same
   *  voice summary is editable in settings"). The field itself is
   *  `settings.content.voice`, which the owner has already written; this
   *  is the press that stores it, and it is owner-owed. */
  // SPEC §7 (owner, 2026-10-10; issue 1390): who speaks on the customer's
  // pages. Drafted (issue 759); the pull request lists each for the owner.
  "settings.voice.writing.label": "Write as",
  "settings.voice.writing.ours": "Your business, as “we”",
  "settings.voice.writing.guide": "A neutral guide, naming your business",
  "settings.voice.writing.unset": "ReachKit chooses for each page",
  // Board SettingsVoice and E15 (ux-designer, 2026-10-24): fixed example words, one set for every
  // kind of business, never a model's output and never presented as written for this customer.
  "settings.voice.lead": "In your own words. Every new page follows it.",
  "settings.voice.writing.ours.example": "“We answer every question the same day.”",
  "settings.voice.writing.guide.example": "“{business} answers every question the same day.”",
  "settings.voice.placeholder": "Plain and direct. Short sentences. We say “customers”, never “users”.",

  // REQ-075's own promise, and the reason the three switches above it are
  // safe to offer: the mail a customer cannot lose is named, so turning all
  // three off is a decision rather than a risk. Approved (11a).
  "settings.notifications.always-on": "Sign-in and account mail can’t be switched off.",

  "settings.content.export": "Download All My Pages",
  // REQ-078 c5 (issue #52): "Given an export cannot be produced, when the
  // customer requests one, then they are told so in one written line and are
  // not given a partial archive presented as complete." One line, whatever
  // the reason — the four `ExportFailure` arms are an operator's fact, and
  // naming which one failed tells the customer nothing they can act on. The
  // sentence is the owner's; the key and the single-line shape are not.
  "export.failed": "The export didn’t work, and nothing was sent. Try again in a minute.",
  "settings.content.voice": "Your note",


  // ── SPEC §7 (2026-09-20, #928): "Content we already know about" (R4-11).
  //
  // The head and the note are the owner's own drafted sentences; the three
  // source labels and the two count lines are drafted in the registry's
  // voice under the 2026-09-16 ruling (#759), and the PR names each one.
  // The site link map (SPEC §7, 2026-10-10, issue 1391).
  "settings.linkmap.head": "How Your Pages Link Your Site",
  "settings.linkmap.none": "None of our pages is live yet. Once one is, this shows which of your pages it links.",
  "settings.linkmap.receiving": "Pages on your site we link to",
  "settings.linkmap.receiving.none": "None of our pages link to your site yet.",
  "settings.linkmap.alone": "Pages that stand alone",
  "settings.linkmap.alone.none": "Every live page links to your site, and another page links to it.",
  "settings.linkmap.alone.in": "No other page links to it yet.",
  "settings.linkmap.alone.out": "It links to no page of yours.",
  "settings.linkmap.alone.both": "No other page links to it, and it links to none of yours.",
  "settings.linkmap.receiving.one": "Linked from 1 page",
  "settings.linkmap.note": "We choose and check these links. When a page goes live, we update older pages to link it.",
  "settings.linkmap.receiving.count": "Linked from {count} pages",
  "settings.known.head": "Content we already know about",
  "settings.known.note": "Checked before every page, so we link to what exists and never write it twice.",
  "settings.known.total": "{count} pages, from three places:",
  "settings.known.none": "Nothing yet. We read your site on Monday, and your blog the moment you connect one.",
  "settings.known.ours": "{count} pages we wrote",
  "settings.known.wordpress": "{count} posts on your blog",
  "settings.known.wordpress.unread": "Posts on your blog: not read",
  "settings.known.site": "{count} pages on your site",
}) satisfies CopyPartition;
