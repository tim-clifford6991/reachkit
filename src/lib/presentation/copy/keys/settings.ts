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
// written — the owner approved the drafted set ("copy proposal
// approved", proposal sheet
// https://claude.ai/code/artifact/546f45a0-a996-4d25-b85e-fb03fda7b102)
// and the strings land here byte for byte. The values that approval names
// are the owner's; nothing here is composed.
import type { CopyPartition } from "../registry.ts";

export const SETTINGS_COPY = Object.freeze({
  "settings.head": ["What you’re measured as, how pages go out, and your account.", { slots: {}, fixedBy: "BUILD §4.7" }],

  // ── One control word, several positions ────────────────────────────────
  // S18 draws one word for the act beside the market, the domain, the publish
  // time and the time zone, so one key serves every position.
  "settings.change": ["Change", { slots: {}, fixedBy: "S18 (11a)" }],
  // The other two words the field Edit opens needs (issue #231), and the
  // same one-key-serving-several-positions rule: what the button does is
  // the same act on the domain and on the category, so it is one word each
  // and not two per control. Leaving a field is offered because opening
  // one must be undoable — a customer who presses Edit to see what is
  // there has changed nothing, and must not have to save to get out.
  "settings.save": ["Save", { slots: {}, fixedBy: "REQ-071 c1" }],
  "settings.cancel-edit": ["Cancel", { slots: {}, fixedBy: "REQ-071 c1" }],

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
  "settings.answer.saved": ["Saved. It takes effect straight away.", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "settings.answer.saved-next-page": ["Saved. Your next page goes live at the new time.", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "settings.answer.refused": ["That didn’t save. Nothing changed.", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  /** Issue 1196: a press whose request never came back — the network or the
   *  server failed, not a refusal. Drafted; the owner may correct it. */
  "settings.answer.could-not-ask": ["We couldn’t reach ReachKit just now. Nothing changed. Try again in a moment.", { slots: {}, fixedBy: "issue 1196" }],
  // The canvas's own badge on a settings card (R4-11), shown where the
  // last change on that card was stored. It is the quiet half of the same
  // answer the toast speaks — a customer who looked away still sees that
  // the card is saved.
  "settings.answer.saved-badge": ["Saved", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],

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
     sentence per field, only the one for a profile nobody has read.

     The eight page-purpose words are NOT here: `setup.ts` already carries
     them (`setup.profile.purpose.*`) and so is the line above them
     (`setup.profile.purposes`). A second spelling of a word the product
     already says is a second place to change it. */
  // The strip above the card: what this tab does to a page, in three steps.
  "settings.business.flow.head": ["How this tab shapes your pages", { slots: {}, fixedBy: "issue 1750 (drafted)" }],
  "settings.business.flow.read": ["We read your site", { slots: {}, fixedBy: "issue 1750 (drafted)" }],
  "settings.business.flow.read.detail": [
    "{count} pages of your site, last on {on}",
    { slots: { count: "text", on: "date" }, fixedBy: "issue 1750 (drafted)" },
  ],
  "settings.business.flow.check": ["You check what we learned", { slots: {}, fixedBy: "issue 1750 (drafted)" }],
  "settings.business.flow.check.detail": ["Change any line below. Nothing here is required.", { slots: {}, fixedBy: "issue 1750 (drafted)" }],
  "settings.business.flow.write": ["Every page is written from it", { slots: {}, fixedBy: "issue 1750 (drafted)" }],
  "settings.business.flow.write.next": [
    "Next: {when}.",
    { slots: { when: "date" }, fixedBy: "issue 1750 (drafted)" },
  ],
  "settings.business.flow.plan": ["See the plan", { slots: {}, fixedBy: "issue 1750 (drafted)" }],
  // One sentence quoted from a live page, and which of the lists it uses.
  "settings.business.example.head": ["How it shows on a page", { slots: {}, fixedBy: "issue 1750 (drafted)" }],
  "settings.business.example.from.claims": ["from What you promise", { slots: {}, fixedBy: "issue 1750 (drafted)" }],
  "settings.business.example.from.vocabulary": ["from Words you use", { slots: {}, fixedBy: "issue 1750 (drafted)" }],
  "settings.business.example.from.both": ["from What you promise and Words you use", { slots: {}, fixedBy: "issue 1750 (drafted)" }],
  "settings.business.example.note": ["Example. Change a line above and your next page follows it.", { slots: {}, fixedBy: "issue 1750 (drafted)" }],
  // The three folds under the card, named for a screen reader.
  "settings.business.more": ["More about your business", { slots: {}, fixedBy: "issue 1750 (drafted)" }],
  "settings.business.title": [
    "What we know about {business}",
    { slots: { business: "text" }, fixedBy: "SPEC §7 2026-09-20" },
  ],
  // The same head where the crawl read no site name. Its own key rather
  // than a slot filled with a pronoun: "What we know about your business"
  // is a sentence, and composing it from the one above would put the
  // product's grammar in a component.
  "settings.business.title.no-name": [
    "What we know about your business",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.business.lead": [
    "Learned from your site. Change anything; your next page is written from what’s here.",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  // The group heads. #926 proposes the first four; the last two name
  // the two claim lists the voice summary already stores and that no screen
  // has ever shown.
  "settings.business.job": ["What you do", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  "settings.business.job.hint": ["one sentence", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  "settings.business.offering": ["Kind of business", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  "settings.business.products": ["What you sell", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  "settings.business.claims": ["What you promise", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  "settings.business.claims.hint": [
    "we may repeat these",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.business.audienceTerms": ["Who you serve", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  "settings.business.vocabulary": ["Words you use", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  "settings.business.vocabulary.hint": [
    "so pages sound like you",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.business.claimsToKeep": [
    "Claims worth repeating",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.business.claimsToAvoid": [
    "Claims we won’t make",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.business.tone": ["Tone", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  "settings.business.person": ["How you refer to yourself", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],

  // The controls. `remove` is an icon-only button's accessible name, which
  // is why it names the item it removes.
  "settings.business.add": ["Add", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  "settings.business.add.label": [
    "Add to {group}",
    { slots: { group: "text" }, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.business.remove": [
    "Remove {item}",
    { slots: { item: "text" }, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.business.reword": ["Reword", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  // The two marks on an item. "new" is what
  // `@/lib/site-profile/business/confirm` sets on a derived item the
  // customer has never been shown — the visible half of "the refresh may
  // only add new findings as suggestions". "yours" is an item they typed,
  // which no refresh will touch.
  "settings.business.mark.new": ["new", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  "settings.business.mark.yours": ["yours", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  // The one sentence for a site nobody has read. Not per field: a profile
  // with nothing in it has nothing to say field by field.
  "settings.business.unread": [
    "We haven’t read your site yet. The next read fills this in.",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],

  // Facts we can quote — #926's own head and its own second clause.
  "settings.business.facts.title": [
    "Facts we can quote",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.business.facts.lead": [
    "Word for word, each linked to where we read it.",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  // How many of the site's pages carry the passage. Two keys, because the
  // unit is a word with a plural and "1 pages" is not a sentence the
  // product says.
  "settings.business.facts.quote": [
    "“{passage}”",
    { slots: { passage: "text" }, fixedBy: "issue 1750 (drafted)" },
  ],
  "settings.business.facts.pages": [
    "· on {count} pages",
    { slots: { count: "text" }, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.business.facts.switch-off": [
    "Don’t quote this",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.business.facts.switch-on": [
    "Quote this again",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.business.facts.off": ["Off", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  "settings.business.facts.none": [
    "No page of your site has given us a fact to quote yet.",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],

  // What every page is written from — the five sources, and #926's closing
  // sentence, which is the point of the card: it is a closed list.
  "settings.business.written-from.title": [
    "What every page is written from",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.business.written-from.closed": [
    "Facts about you come only from your site. Facts about the market come from public pages, each linked.",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.business.source.business": [
    "Your business",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.business.source.voice": ["Your voice", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  "settings.business.source.search": [
    "The search it’s going after",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.business.source.facts": [
    "Facts read from your site",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.business.source.pages": [
    "Your own pages",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  // The last read, and the way to ask for another. The action is
  // `remeasureNowAction`'s — #837's bounded re-measure, reused rather than
  // given a second bound — so its refusals speak `setup.remeasure.*`, which
  // the registry already carries.
  "settings.business.read-at": [
    "Last read {on}",
    { slots: { on: "date" }, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.business.read-never": [
    "Not read yet",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.business.read-line": [
    "Last read {on} · {count} pages read",
    { slots: { on: "date", count: "text" }, fixedBy: "issue 1750 (drafted)" },
  ],
  // SPEC §0 and §5 (2026-09-29, issue 1133): the knowledge base — what the
  // pages were read to say, each with its page, and the founder's five
  // answers. Every line is drafted for the owner; the five questions
  // themselves are `setup.business.question.*`.
  "settings.knowledge.title": [
    "What buyers ask and why you",
    { slots: {}, fixedBy: "issue 1133 (drafted)" },
  ],
  "settings.knowledge.lead": [
    "Read from your own pages, each with the page it came from. Your pages are written from this.",
    { slots: {}, fixedBy: "issue 1133 (drafted)" },
  ],
  "settings.knowledge.things.lead": ["Optional. Each one you add can appear on a page.", { slots: {}, fixedBy: "issue 1750 (drafted)" }],
  "settings.knowledge.thing": [
    "Thing {n}",
    { slots: { n: "text" }, fixedBy: "issue 1750 (drafted)" },
  ],
  "settings.knowledge.none": [
    "Nothing read yet. Read your site again and this fills in.",
    { slots: {}, fixedBy: "issue 1133 (drafted)" },
  ],
  "settings.knowledge.offerings": ["What you sell", { slots: {}, fixedBy: "issue 1133 (drafted)" }],
  "settings.knowledge.audience": ["Who you serve", { slots: {}, fixedBy: "issue 1133 (drafted)" }],
  "settings.knowledge.problems": ["Problems you solve", { slots: {}, fixedBy: "issue 1133 (drafted)" }],
  "settings.knowledge.differentiators": ["How you differ", { slots: {}, fixedBy: "issue 1133 (drafted)" }],
  "settings.knowledge.proof": ["Proof", { slots: {}, fixedBy: "issue 1133 (drafted)" }],
  "settings.knowledge.questions": ["What buyers ask", { slots: {}, fixedBy: "issue 1133 (drafted)" }],
  "settings.knowledge.integrations": ["Works with", { slots: {}, fixedBy: "issue 1133 (drafted)" }],
  "settings.knowledge.places": ["Places", { slots: {}, fixedBy: "issue 1133 (drafted)" }],
  "settings.knowledge.from-you": ["You told us", { slots: {}, fixedBy: "issue 1133 (drafted)" }],
  "settings.knowledge.against": [
    "against {rival}",
    { slots: { rival: "text" }, fixedBy: "issue 1133 (drafted)" },
  ],
  "settings.business.read-again": [
    "Read my site again now",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],

  // ── The tab bar (SPEC §4, 2026-09-20 · #925) ───────────────────────────
  // "Settings is tabs: Your business, Market and rivals, Publishing, Your
  // voice, Mail, Billing, Account."
  //
  // Only four words are here. Three of the seven are already in this file
  // under the name the product speaks them by — `settings.publishing.title`,
  // `settings.billing.title` and `settings.account.title` — and a second
  // spelling of a word the product already says is a second place to change
  // it (the rule `overview.ts` states for three of its own four tabs).
  //
  // Each of the four is **drafted** under the owner's 2026-09-16 ruling
  // (#759): written here in the registry's voice and shipped, never left as
  // a marker, and named in the PR so the owner can correct it. Two are the
  // redesign's own words for a tab no card is titled with; the voice tab's
  // card title is a sentence a bar has no room for ("How your pages sound"),
  // and the mail tab and its card share one word, "Mail".
  "settings.tabs.label": ["Settings sections", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "settings.tab.business": ["Your business", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "settings.tab.market": ["Market and competitors", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "settings.tab.voice": ["Your voice", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "settings.tab.mail": ["Mail", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],

  "settings.market.title": ["Your site and market", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.market.category": ["market", { slots: {}, fixedBy: "REQ-070 c1" }],
  "settings.market.domain": ["Your website", { slots: {}, fixedBy: "BUILD §10 (`sites.domain`), §4.4 · board SettingsMarket" }],
  "settings.market.lead": ["Where you’re measured, and against whom.", { slots: {}, fixedBy: "issue 1974 · board SettingsMarket" }],
  // What a pass reads for this market, from the same stored rows the Competitors tab reads.
  "settings.market.sets.title": ["What your market sets, each Monday", { slots: {}, fixedBy: "issue 1974 · board SettingsMarket" }],
  "settings.market.sets.searches": ["{n} searches your buyers make most", { slots: { n: "text" }, fixedBy: "issue 1974 · board SettingsMarket" }],
  "settings.market.sets.questions": ["{n} questions we ask AI for you", { slots: { n: "text" }, fixedBy: "issue 1974 · board SettingsMarket" }],
  "settings.market.sets.competitors": ["{n} competitors to compare", { slots: { n: "text" }, fixedBy: "issue 1974 · board SettingsMarket" }],
  "settings.market.sets.plan": ["Your plan of pages comes from these.", { slots: {}, fixedBy: "issue 1974 · board SettingsMarket" }],
  "settings.market.sets.plan-link": ["See this week’s pages", { slots: {}, fixedBy: "issue 1974 · board SettingsMarket" }],
  // Issue 837 (owner ruling 2026-09-17): a category change measures again right away.
  "settings.market.consequence.website": [
    "Change your website: your searches are rebuilt next Monday.",
    { slots: {}, fixedBy: "BUILD §4.7 · board SettingsMarket" },
  ],
  "settings.market.consequence.market": [
    "Change your market: we scan it again right away.",
    { slots: {}, fixedBy: "BUILD §4.7 · issue 837 · board SettingsMarket" },
  ],
  // REQ-071's two dated statements about the market (issue #204). Both take
  // their date from `effectiveOn()` and neither computes one: c1 states the
  // date a change being typed *would* take effect, before it is saved; c6
  // states the date a saved change takes effect, until the pass adopts it.
  "settings.market.pending": [
    "A new {change} takes effect on {date}. Until then no new page is written, and earlier measurements are kept apart, not carried across.",
    { slots: { date: "date", change: "text" }, fixedBy: "REQ-071 c1" },
  ],
  // Issue 837 (owner ruling 2026-09-17): a saved category measures the
  // market again right away. Drafted under issue 759's ruling.
  "settings.market.remeasuring": [
    "Saved. We’re scanning your market again now.",
    { slots: {}, fixedBy: "issue 837" },
  ],
  // Issue 866 (owner decision 2026-09-17): a category is measured again at
  // once, so the category's own statements never name a Monday. Four lines,
  // drafted under issue 759's ruling — what saving one will do (before the
  // press, in place of REQ-071 c1's dated line, which stays the domain's),
  // what an unchanged save did, and a saved category no pass has adopted yet.
  "settings.market.category.starts-now": [
    "Saving a different market scans it again right away. It uses one of the few scans allowed each day.",
    { slots: {}, fixedBy: "issue 866" },
  ],
  "settings.market.category.unchanged": [
    "Saved. That’s the market we already measure, so nothing was scanned again.",
    { slots: {}, fixedBy: "issue 866" },
  ],
  "settings.market.category.cleared": [
    "Saved. With no market of your own we go back to the one read from your site, and nothing was scanned again.",
    { slots: {}, fixedBy: "issue 866" },
  ],
  "settings.market.category.not-measured-yet": [
    "Your market is saved and hasn’t been scanned yet. Scan again now, or the weekly scan on {date} picks it up.",
    { slots: { date: "date" }, fixedBy: "issue 866" },
  ],
  // The standalone control (issue 866, fault 3): the only plain way to start
  // a pass early. What it does is said before it spends; a refused press
  // reads the same two sentences the thin-market choice is refused with
  // (`setup.remeasure.refused.*`), because the bound and the remedy are the
  // same one.
  "settings.market.remeasure.action": ["Scan again now", { slots: {}, fixedBy: "issue 866" }],
  "settings.market.remeasure.effect": [
    "Scans your market again now. It rebuilds your searches, and your pages follow. It uses one of the few scans allowed each day.",
    { slots: {}, fixedBy: "issue 866" },
  ],
  "settings.market.remeasure.started": [
    "We’re scanning your market again now. Your pages follow as soon as it finishes.",
    { slots: {}, fixedBy: "issue 866" },
  ],
  "settings.market.effectiveOn": [
    "Saved. Takes effect with the scan on {date}.",
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
  // D66 after setup (issue 1692). Drafted (#759).
  "settings.locale.note": [
    "Changing it starts a new scan. Earlier results stay, marked with the date.",
    { slots: {}, fixedBy: "SPEC §6 · D66 · issue 1692" },
  ],
  "settings.locale.unchanged": [
    "That’s the country and language we already measure, so nothing was scanned again.",
    { slots: {}, fixedBy: "SPEC §6 · D66 · issue 1692" },
  ],
  "settings.locale.refused": [
    "We don’t measure that country in that language, so it wasn’t saved.",
    { slots: {}, fixedBy: "SPEC §6 · D66 · issue 1692" },
  ],

  // ── Competitors ────────────────────────────────────────────────────────
  // D28 (owner, 2026-10-02, #1185): drafted, named in the pull request.
  "settings.market.concluded": [
    "Found by ReachKit from your site. Checked again every Monday.",
    { slots: {}, fixedBy: "SPEC §5 2026-10-02 D28, issue 1185" },
  ],
  "settings.market.overridden": [
    "This is the market you set. ReachKit measures it until you change it.",
    { slots: {}, fixedBy: "SPEC §5 2026-10-02 D28, issue 1185" },
  ],
  "settings.competitors.concluded": [
    "Found by ReachKit in your market and checked every Monday. Remove or add any if you like.",
    { slots: {}, fixedBy: "SPEC §5 2026-10-02 D28, issue 1185" },
  ],
  "settings.competitors.overridden": [
    "These are the competitors you set. ReachKit keeps your list as it is.",
    { slots: {}, fixedBy: "SPEC §5 2026-10-02 D28, issue 1185" },
  ],
  "settings.competitors.title": ["Competitors", { slots: {}, fixedBy: "BUILD §4.7" }],
  // S18's head count, in the set's own words (11a): "5 of 5". A key and not
  // a slash written in code — "of" is a word, and a word the product speaks
  // is a key. Both numerals are slots, so the cap comes from
  // `BATTERY.COMPETITORS_MAX` and never from a five typed twice.
  "settings.competitors.count": [
    "{taken} of {max}",
    { slots: { taken: "text", max: "text" }, fixedBy: "REQ-071 c16" },
  ],
  "settings.competitors.add": ["Add", { slots: {}, fixedBy: 'BUILD §4.7 ("chips ×5, add/remove")' }],
  // The add field's own name, apart from the card's heading (issue #270).
  "settings.competitors.add-label": ["Add a competitor", { slots: {}, fixedBy: "BUILD §4.7" }],
  // REQ-071 c16. An empty rival set is a state the product designed (§2.5),
  // not a blank: the line takes no slot, because there is no date and no
  // change to name — only that comparison begins when a rival is added.
  "settings.competitors.more": ["{n} more can be added", { slots: { n: "text" }, fixedBy: "issue 1974 · board SettingsMarket" }],
  "settings.competitors.placeholder": ["competitor.com", { slots: {}, fixedBy: "issue 1974 · board SettingsMarket" }],
  // One card per competitor (issue 1974): who found it, and its figures from the Competitors tab's readers.
  "settings.competitors.found": ["Found by ReachKit", { slots: {}, fixedBy: "SPEC §5 D28 · board SettingsMarket" }],
  "settings.competitors.added": ["Added by you", { slots: {}, fixedBy: "SPEC §5 D28 · board SettingsMarket" }],
  "settings.competitors.google": ["On Google’s first page", { slots: {}, fixedBy: "issue 1974 · board SettingsMarket" }],
  "settings.competitors.ai": ["Mentioned in AI answers", { slots: {}, fixedBy: "issue 1974 · board SettingsMarket" }],
  "settings.competitors.figure": ["{n} of {of}", { slots: { n: "text", of: "text" }, fixedBy: "issue 1974 · board SettingsMarket" }],
  "settings.competitors.not-measured": ["not measured", { slots: {}, fixedBy: "REQ-004 · issue 1974" }],
  "settings.competitors.measured-from": ["Measured from {date}.", { slots: { date: "date" }, fixedBy: "REQ-071 c6 · board SettingsMarket" }],
  "settings.competitors.remove": ["Remove", { slots: {}, fixedBy: "issue 1974 · board SettingsMarket" }],
  "settings.competitors.you": ["You, for comparison", { slots: {}, fixedBy: "issue 1974 · board SettingsMarket" }],
  "settings.competitors.you.ai": [
    "Mentioned in {n} of {of} AI answers, last {weeks} weeks",
    { slots: { n: "text", of: "text", weeks: "text" }, fixedBy: "issue 1974 · board SettingsMarket" },
  ],
  "settings.competitors.see": ["See Competitors →", { slots: {}, fixedBy: "issue 1974 · board SettingsMarket" }],
  // Issue 858: a far larger competitor stays named apart from the comparison.
  "settings.competitors.leaders": [
    "Far larger in your searches, and not compared with you for now: {names}.",
    { slots: { names: "text" }, fixedBy: "issue 858 · board SettingsMarket" },
  ],
  "settings.competitors.detail": ["Show the detail", { slots: {}, fixedBy: "issue 1974 · board SettingsMarket" }],
  "settings.competitors.detail.google": [
    "Google figures are from {date}: the {n} searches your buyers make most.",
    { slots: { date: "date", n: "text" }, fixedBy: "issue 1974 · board SettingsMarket" },
  ],
  "settings.competitors.detail.ai": [
    "AI figures are the last {weeks} weeks of answers to the {n} questions a buyer in your market might ask AI.",
    { slots: { weeks: "text", n: "text" }, fixedBy: "issue 1974 · board SettingsMarket" },
  ],
  "settings.competitors.detail.change": [
    "A competitor you add is measured from the next Monday scan. A competitor you remove is no longer compared with you; pages already planned stay planned.",
    { slots: {}, fixedBy: "REQ-071 · board SettingsMarket" },
  ],
  "settings.competitors.none-yet": ["No competitors yet. Comparison begins when you add one.", { slots: {}, fixedBy: "REQ-071 c16" }],
  // `addRival`'s own five refusals, one sentence each (issue #231). The
  // rules are `setup/rivals.ts`'s — REQ-071 c4 says they are the same rules
  // — but the sentences are this screen's: `setup.competitors.refused.*`
  // speaks to a founder part-way through setup, and reusing those keys here
  // would put setup's voice on Settings. The map over them is total, so a
  // sixth refusal in the engine is a compile error rather than a refusal
  // that says nothing.
  "settings.competitors.refused.not-a-domain": ["Enter a competitor’s domain, like competitor.com.", { slots: {}, fixedBy: "REQ-071 c4" }],
  "settings.competitors.refused.does-not-resolve": ["That domain doesn’t resolve, so it can’t be added. Check the spelling.", { slots: {}, fixedBy: "REQ-071 c4" }],
  "settings.competitors.refused.own-domain": ["That’s your own domain. Competitors are other sites.", { slots: {}, fixedBy: "REQ-071 c4" }],
  "settings.competitors.refused.already-present": ["That domain is already one of your competitors.", { slots: {}, fixedBy: "REQ-071 c4" }],
  "settings.competitors.refused.set-full": ["Your list is full. Remove a competitor before adding another.", { slots: {}, fixedBy: "REQ-071 c4" }],

  // ── Publishing ─────────────────────────────────────────────────────────
  "settings.publishing.title": ["Publishing", { slots: {}, fixedBy: "BUILD §4.7" }],
  // SPEC §7 (2026-09-20, #908, issue #914) — "Screens and mail say *Stop
  // this page*. 'Veto' remains the internal word". §4.7's own label was
  // the internal word; the canvas (R4-11) gives the customer's, and the
  // note under it says what the number measures. The key keeps its name:
  // the mechanism, the column and the stepper are still the veto window.
  // Drafted from the canvas under issue 759's ruling; the owner may
  // correct both sentences.
  "settings.publishing.veto": ["time to stop a page", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  "settings.publishing.veto.note": [
    "How long you get to read each page before it goes live.",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
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
  /** What the two stepper buttons are *called*, as against what they draw.
   *  The glyph is right on screen — a stepper is a minus and a plus — and
   *  wrong in an ear: `aria-label` carried the glyph too, so a screen
   *  reader said "minus, button", which names no purpose (WCAG 2.4.6
   *  Headings and Labels; #328). These are the same control said in words,
   *  in the setting's own wording — `settings.publishing.veto` is "time to
   *  stop a page". Drafted in the registry's voice (#328); the owner may
   *  correct. */
  "settings.publishing.veto.less.label": [
    "Shorter time to stop a page",
    { slots: {}, fixedBy: "issue 328 · board SettingsPublishing" },
  ],
  "settings.publishing.veto.more.label": [
    "Longer time to stop a page",
    { slots: {}, fixedBy: "issue 328 · board SettingsPublishing" },
  ],
  "settings.publishing.publish-time": ["publish time", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.publishing.time-zone": ["time zone", { slots: {}, fixedBy: "REQ-070 c1" }],
  "settings.publishing.enabled": ["Publishing", { slots: {}, fixedBy: "REQ-070 c1" }],
  "settings.publishing.destinations": ["Where pages go live", { slots: {}, fixedBy: "BUILD §4.7 · board SettingsPublishing" }],
  // The card's head, the timeline and the help lines, in the board's words (issue 1751).
  "settings.publishing.on": ["On", { slots: {}, fixedBy: "issue 1751 · board SettingsPublishing · drafted" }],
  "settings.publishing.off": ["Off", { slots: {}, fixedBy: "issue 1751 · board SettingsPublishing · drafted" }],
  "settings.publishing.on.lead": ["On. A page goes live on each planned day.", { slots: {}, fixedBy: "issue 1751 · board SettingsPublishing · drafted" }],
  "settings.publishing.off.lead": ["Paused. No page goes live until you turn this back on. Your plan and pages are kept.", { slots: {}, fixedBy: "issue 1751 · board SettingsPublishing · drafted" }],
  "settings.publishing.flow.title": ["How each page goes out", { slots: {}, fixedBy: "issue 1751 · board SettingsPublishing · drafted" }],
  "settings.publishing.flow.page": ["Today’s page: {title}", { slots: { title: "text" }, fixedBy: "issue 1751 · board SettingsPublishing · drafted" }],
  "settings.publishing.flow.written": ["Written", { slots: {}, fixedBy: "issue 1751 · board SettingsPublishing · drafted" }],
  "settings.publishing.flow.written.note": ["Checked against your facts and your never-claim list", { slots: {}, fixedBy: "issue 1751 · board SettingsPublishing · drafted" }],
  "settings.publishing.flow.emailed": ["Emailed to you", { slots: {}, fixedBy: "issue 1751 · board SettingsPublishing · drafted" }],
  "settings.publishing.flow.emailed.note": ["With Read, Edit and Stop", { slots: {}, fixedBy: "issue 1751 · board SettingsPublishing · drafted" }],
  "settings.publishing.flow.window": ["{window} to read, edit or stop it", { slots: { window: "text" }, fixedBy: "issue 1751 · board SettingsPublishing · drafted" }],
  // "Plan" is the link to Plan.
  "settings.publishing.flow.window.note": ["From the mail or from Plan. Do nothing and it goes live on its own.", { slots: {}, fixedBy: "issue 1751 · board SettingsPublishing · drafted" }],
  "settings.publishing.flow.live": ["Goes live", { slots: {}, fixedBy: "issue 1751 · board SettingsPublishing · drafted" }],
  "settings.publishing.flow.paused": ["Paused: nothing goes live", { slots: {}, fixedBy: "issue 1751 · board SettingsPublishing · drafted" }],
  "settings.publishing.flow.note": ["This line follows the publish time and the time to stop a page, set below. Turn publishing off to pause every page at once.", { slots: {}, fixedBy: "issue 1751 · board SettingsPublishing · drafted" }],
  "settings.publishing.where.site": ["Your website, unchanged", { slots: {}, fixedBy: "issue 1751 · board SettingsPublishing · drafted" }],
  "settings.publishing.where.pages": ["Your pages, on your own address", { slots: {}, fixedBy: "issue 1751 · board SettingsPublishing · drafted" }],
  "settings.publishing.time-zone.note": ["Taken from your browser.", { slots: {}, fixedBy: "issue 1751 · board SettingsPublishing · drafted" }],
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
    "A draft you don’t touch publishes at the first publish time after your time to stop it runs out.",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.publishing.pair.autopilotZero": [
    "With no time to stop a page, a draft you don’t touch publishes at your next publish time.",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
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
  // The WordPress user the application password was issued to (ruling,
  // 2026-09-07). A WordPress application password authenticates as
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

  // ── The customer's own subdomain (SPEC §5, ruling of 2026-09-12) ───────
  //
  // **Two words, and the ruling writes both.** §5: "settings shows 'live'
  // or 'waiting for DNS'", and §12 ruling 7 says it again. They are the
  // owner's own strings, quoted here rather than composed — which is why
  // they are values and not `TODO(copy)`: nothing about them was chosen by
  // the code.
  //
  // They are not `settings.destination.health.*` renamed. Health is what
  // the destination's end can be seen to be; these say whether the
  // customer's own record has resolved yet, and a destination can be
  // perfectly healthy with a record nobody has pointed.
  "settings.destination.hostname.live": [
    "live",
    { slots: {}, fixedBy: "SPEC §5 · §12 ruling 7 (2026-09-12)" },
  ],
  "settings.destination.hostname.waiting": [
    "waiting for DNS",
    { slots: {}, fixedBy: "SPEC §5 · §12 ruling 7 (2026-09-12)" },
  ],

  // ── Check connection (issue #757; owner ruling 2026-09-16) ────────────
  //
  // The founder's own press, beside the CNAME record on `/setup` and in
  // Settings. Three answers the screen must not fold into two — the domain
  // list said live, the domain list said waiting, or nothing could be asked
  // — and the press inside the floor, which asked nothing and says when it
  // may. Drafted and shipped under the owner ruling of 2026-09-16 (#759).
  "settings.destination.check.button": ["Check connection", { slots: {}, fixedBy: "SPEC §5 (2026-09-16, issue 757)" }],
  "settings.destination.check.live": ["Connected. Your pages will publish to this address.", { slots: {}, fixedBy: "SPEC §5 (2026-09-16, issue 757)" }],
  "settings.destination.check.pending-dns": ["Not connected yet. A new DNS record usually takes a few minutes, sometimes a few hours. Check again shortly.", { slots: {}, fixedBy: "SPEC §5 (2026-09-16, issue 757)" }],
  "settings.destination.check.could-not-ask": ["We couldn’t check just now. Try again in a moment.", { slots: {}, fixedBy: "SPEC §5 (2026-09-16, issue 757)" }],
  // A deployment with no verification bound: pressing again changes nothing,
  // so this line never says to try again, and it is ReachKit's to fix, not
  // the founder's DNS (issue 840). Since issue 856 it is the second step's
  // line only, under the public DNS answer, and says what that answer
  // confirmed: `not-configured` where the record points here,
  // `not-configured.unconfirmed` where it does not, or could not be read.
  "settings.destination.check.not-configured": ["Your record is in place. The last step, ReachKit confirming the secure connection, is on our side. There’s nothing more for you to do.", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issues 840, 856)" }],
  "settings.destination.check.not-configured.unconfirmed": ["The last step, ReachKit confirming the secure connection, is on our side. Once your record points at the right place, there’s nothing more for you to do.", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  // The press's first step (issue 856): what public DNS says about the
  // record, before any vendor is asked. `{target}` is where the record
  // points instead — a host name, or an address where a proxy answers.
  "settings.destination.check.dns.points-here": ["Record found, pointing at the right place.", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "settings.destination.check.dns.points-elsewhere": ["Record found, pointing elsewhere: {target}. Change it to the target shown above.", { slots: { target: "text" }, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "settings.destination.check.dns.not-yet": ["No record yet. DNS changes can take a few minutes. Check again shortly.", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "settings.destination.check.dns.unknown": ["We couldn’t look up your record in public DNS just now.", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  /** `seconds` is how long until the press may ask again, as a whole
   *  number, counting down on screen. The registry does not pluralise, so
   *  the number stands after a colon (issue 840). */
  "settings.destination.check.too-soon": ["Just checked. Seconds until you can check again: {seconds}", { slots: { seconds: "text" }, fixedBy: "SPEC §5 (2026-09-17, issue 840)" }],

  // ── Notifications ──────────────────────────────────────────────────────
  // One key per `stoppable: 'toggle'` row of `MAIL_KINDS`, named by the row's
  // own key, which is the word §12 prints for that mail. The panel projects
  // its rows from the register (never from a hand-written three), so a fourth
  // stoppable kind arrives as a missing-key compile error rather than as a
  // mail a customer cannot stop.
  "settings.notifications.title": ["Mail", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.notifications.draft-ready": ["A page is ready, before it goes live", { slots: {}, fixedBy: "issue 1574" }],
  // Under the switch while it is off: turning the mail off never holds a page.
  "settings.notifications.draft-ready.off": [
    "Pages still go live on their day. You can stop them from Plan.",
    { slots: {}, fixedBy: "issue 1574" },
  ],
  "settings.notifications.published": ["When your first page goes live", { slots: {}, fixedBy: "decision 2026-10-19-1593 (drafted)" }],
  "settings.notifications.weekly": ["Monday mail: your week’s pages", { slots: {}, fixedBy: "BUILD §12 · board SettingsMail" }],
  // The card's lead, each row's help and preview, and the week strip (issue 1751; Q10 for the page-ready row).
  // "Account" is the link to the Account tab.
  "settings.notifications.to": ["Mail goes to {email}. Change it under Account.", { slots: { email: "text" }, fixedBy: "issue 1751 · board SettingsMail · drafted" }],
  "settings.notifications.weekly.note": ["What went live, what moved, and the {days} pages planned next.", { slots: { days: "text" }, fixedBy: "issue 1751 · board SettingsMail · drafted" }],
  "settings.notifications.weekly.preview": ["Your week: {days} pages planned", { slots: { days: "text" }, fixedBy: "issue 1751 · board SettingsMail · drafted" }],
  "settings.notifications.weekly.preview.climbing": ["Your week: {days} pages planned, {n} pages climbing", { slots: { days: "text", n: "text" }, fixedBy: "issue 1911 · board SettingsMail · owner R29 2026-10-23" }],
  "settings.notifications.weekly.preview.climbing-one": ["Your week: {days} pages planned, 1 page climbing", { slots: { days: "text" }, fixedBy: "issue 1911 · board SettingsMail · owner R29 2026-10-23" }],
  "settings.notifications.weekly.when": ["Mondays", { slots: {}, fixedBy: "issue 1751 · board SettingsMail · drafted" }],
  "settings.notifications.draft-ready.note": [
    "One mail per page, {window} before it goes live, with Read, Edit and Stop. It is sent until your first Monday mail. After that, the Monday mail lists each page with its day and Stop. Turn this on to keep both.",
    { slots: { window: "text" }, fixedBy: "Q10 · ux-designer · issue 1751" },
  ],
  "settings.notifications.draft-ready.preview": ["Your next page is written: {title}", { slots: { title: "text" }, fixedBy: "issue 1751 · board SettingsMail · drafted" }],
  "settings.notifications.draft-ready.preview.when": ["{written} · goes live {live}", { slots: { written: "text", live: "text" }, fixedBy: "issue 1751 · board SettingsMail · drafted" }],
  "settings.notifications.week.title": ["Your week of mail", { slots: {}, fixedBy: "issue 1751 · board SettingsMail · drafted" }],
  "settings.notifications.week.label": ["The mail you get in a week", { slots: {}, fixedBy: "issue 1751 · board SettingsMail · drafted" }],
  "settings.notifications.week.monday": ["Monday mail", { slots: {}, fixedBy: "issue 1751 · board SettingsMail · drafted" }],
  "settings.notifications.week.ready": ["A page is ready, one per page", { slots: {}, fixedBy: "issue 1751 · board SettingsMail · drafted" }],
  "settings.notifications.week.no-ready": ["No page-ready mail. Pages still go live.", { slots: {}, fixedBy: "issue 1751 · board SettingsMail · drafted" }],
  "settings.notifications.week.none": ["You get no ReachKit mail except sign-in and account mail. Pages still go live on their day.", { slots: {}, fixedBy: "issue 1751 · board SettingsMail · drafted" }],

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
  "settings.billing.next-invoice": ["next invoice", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.billing.card": ["card", { slots: {}, fixedBy: "BUILD §4.7" }],
  "settings.billing.card-ending": ["ending {last4}", { slots: { last4: "text" }, fixedBy: "issue 1751 · board SettingsBilling · drafted" }],
  "settings.billing.status": ["Status", { slots: {}, fixedBy: "issue 1751 · board SettingsBilling · drafted" }],
  "settings.billing.plan": ["Plan", { slots: {}, fixedBy: "issue 1751 · board SettingsBilling · drafted" }],
  "settings.billing.billed": ["Billed in euros. Cancel any time; everything keeps running until the period ends.", { slots: {}, fixedBy: "issue 1751 · board SettingsBilling · drafted" }],
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
  "settings.billing.manage": [
    "Manage billing in Stripe",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20 · REQ-097 c1" },
  ],
  "settings.billing.manage.note": [
    "Update your card, download invoices, or cancel your plan.",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20 · REQ-097 c1" },
  ],
  "settings.billing.resume": [
    "Resume my plan",
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
  /** Issue 1196: a plan resumed in place. Drafted; the owner may correct it. */
  "settings.billing.resumed": ["Your plan is running again.", { slots: {}, fixedBy: "issue 1196" }],
  "settings.billing.reach-a-person": [
    "Or write to hello@reachkit.app.",
    { slots: {}, fixedBy: "REQ-097 c6" },
  ],

  // The cancelled arm, in the board's words. The date is `paid_through`.
  "settings.billing.cancelling": [
    "Cancelled. Everything keeps running until {date}.",
    { slots: { date: "date" }, fixedBy: "BUILD §4.7 · board SettingsBilling" },
  ],

  // The cancel route and the first-14-days refund (owner E13 and D4, 2026-10-19). Drafted.
  // {control} is filled from `settings.billing.manage`, so the line names the card's real button.
  "settings.billing.route": [
    "Reply to any ReachKit email or use {control}.",
    { slots: { control: "text" }, fixedBy: "E13 · owner R24 2026-10-23 · drafted" },
  ],
  "settings.billing.refund-window": [
    "Billed in euros. Cancel by {date} for a full, automatic refund. ReachKit stops at once.",
    { slots: { date: "date" }, fixedBy: "D4 · ux-designer · owner R5 2026-10-22" },
  ],

  // Billing's "What you got this month" (owner E3, 2026-10-19). Drafted.
  "settings.month.title": ["What you got this month", { slots: {}, fixedBy: "E3 · drafted" }],
  "settings.month.period": ["Billing period {from} to {to}. Everything is included in {price}.", { slots: { from: "date", to: "date", price: "text" }, fixedBy: "E3 · board SettingsBilling · drafted" }],
  "settings.month.all": ["See every page →", { slots: {}, fixedBy: "issue 1751 · board SettingsBilling · drafted" }],
  "settings.month.live": ["pages went live", { slots: {}, fixedBy: "E3 · drafted" }],
  "settings.month.live.where": ["on {host}", { slots: { host: "text" }, fixedBy: "issue 1751 · board SettingsBilling · drafted" }],
  "settings.month.reports": ["Monday reports", { slots: {}, fixedBy: "issue 1751 · board SettingsBilling · drafted" }],
  "settings.month.asked": ["searches and AI questions", { slots: {}, fixedBy: "issue 1751 · board SettingsBilling · drafted" }],
  "settings.month.asked.split": ["{searches} searches and {questions} AI questions, checked each week", { slots: { searches: "text", questions: "text" }, fixedBy: "issue 1751 · board SettingsBilling · drafted" }],
  "settings.month.asked.split.unmeasured": ["{searches} searches, checked each week. AI questions were not measured this pass.", { slots: { searches: "text" }, fixedBy: "issue 1907 · drafted" }],
  "settings.month.planned": ["pages planned this week", { slots: {}, fixedBy: "issue 1751 · board SettingsBilling · drafted" }],
  "settings.month.planned.cap": ["up to {days} a week, never filler", { slots: { days: "text" }, fixedBy: "issue 1751 · board SettingsBilling · drafted" }],
  "settings.month.not-measured": ["not measured", { slots: {}, fixedBy: "E3 · drafted" }],
  "settings.month.bar": ["This billing period, {from} to {to}: {live} pages live so far, {planned} planned this week", { slots: { from: "date", to: "date", live: "text", planned: "text" }, fixedBy: "issue 1751 · board SettingsBilling · drafted" }],
  "settings.month.today": ["Today", { slots: {}, fixedBy: "issue 1751 · board SettingsBilling · drafted" }],
  "settings.month.legend.live": ["A page went live", { slots: {}, fixedBy: "issue 1751 · board SettingsBilling · drafted" }],
  "settings.month.legend.planned": ["Planned this week", { slots: {}, fixedBy: "issue 1751 · board SettingsBilling · drafted" }],
  "settings.month.first": ["Your first page goes live {when}.", { slots: { when: "date" }, fixedBy: "issue 1751 · board SettingsBilling · drafted" }],
  "settings.month.detail": ["Show the detail", { slots: {}, fixedBy: "issue 1751 · board SettingsBilling · drafted" }],
  "settings.month.unread": [
    "This month could not be read just now. Your plan below is unaffected.",
    { slots: {}, fixedBy: "E3 · drafted" },
  ],
  "settings.month.note": [
    "Counted from your own pages and measurements. A page that went live is one that is on your address today. The searches and AI questions are the ones in Market and competitors.",
    { slots: {}, fixedBy: "E3 · board SettingsBilling · drafted" },
  ],
  // "Overview" is the link to Overview.
  "settings.month.climb": ["Pages climb at Google’s pace, not ours. What moved is on Overview.", { slots: {}, fixedBy: "issue 1751 · board SettingsBilling · drafted" }],

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
  "settings.account.invoices-elsewhere": ["Invoices and receipts go to the address in your billing portal, and change there, not here.", { slots: {}, fixedBy: "REQ-077 c1" }],
  "settings.account.email-in-use": ["That address already belongs to a ReachKit account.", { slots: {}, fixedBy: "REQ-077 c2" }],
  "settings.account.email-invalid": ["That isn’t an address we can send to.", { slots: {}, fixedBy: "REQ-077 c2" }],
  "settings.account.email-change-unavailable": ["The change couldn’t start just now. Nothing has changed. Try again in a moment.", { slots: {}, fixedBy: "REQ-077 c2" }],

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
  // How a sign-in goes, and the export, in the board's words (issue 1751).
  "settings.account.signin.label": ["How you sign in", { slots: {}, fixedBy: "issue 1751 · board SettingsAccount · drafted" }],
  "settings.account.signin.mail": ["We mail you a link", { slots: {}, fixedBy: "issue 1751 · board SettingsAccount · drafted" }],
  "settings.account.signin.open": ["You open it", { slots: {}, fixedBy: "issue 1751 · board SettingsAccount · drafted" }],
  "settings.account.signin.in": ["You’re in. No password.", { slots: {}, fixedBy: "issue 1751 · board SettingsAccount · drafted" }],
  "settings.account.export.note": ["Every page we wrote for you, {pages} so far, live or not, as files with their images. Always available, whatever your plan.", { slots: { pages: "text" }, fixedBy: "REQ-078 · board SettingsAccount · drafted" }],

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
  /** The voice card's save control (SPEC.md §5, 2026-09-12: "the same
   *  voice summary is editable in settings"). The field itself is
   *  `settings.content.voice`, which the owner has already written; this
   *  is the press that stores it, and it is owner-owed. */
  "settings.voice.save": ["Save", { slots: {}, fixedBy: "SPEC.md §5 (2026-09-12)" }],
  // SPEC §7 (owner, 2026-10-10; issue 1390): who speaks on the customer's
  // pages. Drafted (issue 759); the pull request lists each for the owner.
  "settings.voice.writing.label": ["Who speaks on your pages", { slots: {}, fixedBy: "SPEC.md §7 (2026-10-10, issue 1390)" }],
  "settings.voice.writing.auto": ["Let ReachKit choose for each page", { slots: {}, fixedBy: "SPEC.md §7 (2026-10-10, issue 1390)" }],
  "settings.voice.writing.ours": ["Your business, as “we”", { slots: {}, fixedBy: "SPEC.md §7 (2026-10-10, issue 1390)" }],
  "settings.voice.writing.guide": ["A neutral guide, naming your business", { slots: {}, fixedBy: "SPEC.md §7 (2026-10-10, issue 1390)" }],
  "settings.voice.writing.short": ["Short answers, 600 to 900 words", { slots: {}, fixedBy: "SPEC.md §7 (2026-10-10, issue 1390)" }],
  "settings.voice.writing.note": [
    "ReachKit picks the voice that fits your business and each question. Change it here whenever you like; your next page follows it.",
    { slots: {}, fixedBy: "SPEC.md §7 (2026-10-10, issue 1390)" },
  ],
  "settings.voice.placeholder": ["Plain and direct. Short sentences. We say “customers”, never “users”.", { slots: {}, fixedBy: "REQ-055" }],

  // REQ-075's own promise, and the reason the three switches above it are
  // safe to offer: the mail a customer cannot lose is named, so turning all
  // three off is a decision rather than a risk. Approved (11a).
  "settings.notifications.always-on": [
    "Sign-in and account mail cannot be switched off.",
    { slots: {}, fixedBy: "REQ-075" },
  ],

  "settings.content.export": ["Export everything", { slots: {}, fixedBy: "BUILD §4.7" }],
  // REQ-078 c5 (issue #52): "Given an export cannot be produced, when the
  // customer requests one, then they are told so in one written line and are
  // not given a partial archive presented as complete." One line, whatever
  // the reason — the four `ExportFailure` arms are an operator's fact, and
  // naming which one failed tells the customer nothing they can act on. The
  // sentence is the owner's; the key and the single-line shape are not.
  "export.failed": ["The export couldn’t be produced just now. Nothing partial was sent. Try again in a moment.", { slots: {}, fixedBy: "REQ-078 c5" }],
  "settings.content.voice": ["Brand voice", { slots: {}, fixedBy: "BUILD §8 rule 7" }],


  // ── SPEC §7 (2026-09-20, #928): "Content we already know about" (R4-11).
  //
  // The head and the note are the owner's own drafted sentences; the three
  // source labels and the two count lines are drafted in the registry's
  // voice under the 2026-09-16 ruling (#759), and the PR names each one.
  // The site link map (SPEC §7, 2026-10-10, issue 1391).
  "settings.linkmap.head": ["How your articles link your site", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "settings.linkmap.none": ["No article is live yet. Once one is, this shows which of your pages it links.", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "settings.linkmap.receiving": ["Your pages that articles link to", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "settings.linkmap.receiving.none": ["No live article links a page of your site yet.", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "settings.linkmap.alone": ["Articles that stand alone", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "settings.linkmap.alone.none": ["Every live article links to your site and is linked from another article.", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "settings.linkmap.alone.in": ["No other article links to it yet.", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "settings.linkmap.alone.out": ["It links to no page of yours.", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "settings.linkmap.alone.both": ["No other article links to it, and it links to no page of yours.", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "settings.linkmap.receiving.one": ["Linked from 1 article", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "settings.linkmap.note": ["We choose and check these links. When a new article goes live, the closest older ones are updated to link it.", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "settings.linkmap.receiving.count": ["Linked from {count} articles", { slots: { count: "text" }, fixedBy: "issue 1391 (drafted)" }],
  "settings.known.head": [
    "Content we already know about",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.known.note": [
    "Checked before every page, so we link to what exists and never write it twice.",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.known.total": [
    "{count} pages, from three places:",
    { slots: { count: "text" }, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.known.none": [
    "Nothing yet. We read your site on Monday, and your blog the moment you connect one.",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "settings.known.ours": ["{count} pages we wrote", { slots: { count: "text" }, fixedBy: "issue 1750 (drafted)" }],
  "settings.known.wordpress": ["{count} posts on your blog", { slots: { count: "text" }, fixedBy: "issue 1750 (drafted)" }],
  "settings.known.wordpress.unread": ["Posts on your blog: not read", { slots: {}, fixedBy: "issue 1750 (drafted)" }],
  "settings.known.site": ["{count} pages on your site", { slots: { count: "text" }, fixedBy: "issue 1750 (drafted)" }],
}) satisfies CopyPartition;
