// src/lib/presentation/copy/keys/calendar.ts — BP-020 decision 5, WO-041
//
// The calendar's sentences. Three keys seeded (WO-041 step 3): the
// no-presence-yet line for a date carrying no page, and the two cause
// lines. Seeded with the empty value, owner-owed (constitution §1), and
// written since #460. The block that owns the calendar fills every other
// sentence this surface needs.
//
// 2026-09-05: issue #9 (BUILD §4.4) adds `calendar.head` — the one written
// line this screen states inside the app shell until its own content lands
// (issue #16, §4.6). Owner-owed and empty at first — it is a customer-
// visible sentence (constitution §1) — until issue #16 filled it below.
//
// 2026-09-05, separately: issue #16 (BUILD §4.6) fills the calendar itself.
// Twenty keys carry a value and **every one of them is a transcription of a
// word or a sentence `BUILD.md` §4.6 itself prints**, on the same footing as
// the thirteen band words in `bands.ts` and the five `shell.*` words issue
// #9 filled (constitution rule 1.2: copying a recorded owner ruling is not
// inventing one). Nothing here is composed:
//
//   `calendar.head`                — §4.6 `Head: "One page a day. Every day."`,
//                                    the sentence the section prints in quotes.
//                                    Superseded: the owner replaced it on
//                                    2026-09-11 (#516) — see the note below.
//   `calendar.stage.*`             — §4.6's filter cards, named there:
//                                    "All/Live/Your review/Scheduled/Planned/
//                                    Needs you" (and REQ-043 c2's same five).
//   `calendar.action.*`            — §4.6's own action words: "review →
//                                    *Read the full page* + Move/Veto; live →
//                                    *View live page*; needs-you →
//                                    *Reconnect*; planned → Move/Skip".
//   `calendar.why.*`               — §4.6's `"Why this page" (search / asked /
//                                    answered-today-by / you / done-when)`.
//                                    The five row labels are those five
//                                    handles with their hyphens read as the
//                                    spaces they stand for and a leading
//                                    capital — the same handle-versus-word
//                                    spelling BP-019 decision 6 blessed for
//                                    'not-yet' → "Not yet". No word is added
//                                    and none is dropped.
//
// Six were owner-owed and empty until #460, because no sentence existed to
// transcribe:
// the three empty-date causes REQ-043 criterion 4 names but §4.6 does not
// word, the provenance line criterion 10 asks for, the veto-deadline line,
// and the supply half of the footnote — §4.6 states the supply *rule* to the
// builder ("the empty state says so") and never says it to the customer.
// Listed in issue #16's PR under "Owner owes".
//
// 2026-09-06, issue #20 (REQ-091 c2): these three keys are the ones the
// arbiter `src/lib/presentation/place/account.ts` resolves — the baseline
// cold-start line for a date carrying no page, and the two cause lines. They
// were registered **owner-owed and empty**, deliberately, so `account()`
// threw naming the key rather than handing a place a blank; #460 wrote
// them.
// 2026-09-06, separately again: issue #116 (REQ-092 c5) adds one —
// `calendar.empty.page-held`, the account a date carries when a page was
// planned for it and did not go live on it because a ReachKit stop held it.
// Registered owner-owed and **empty**, like the three empty-date causes
// beside it and for the same reason, and written since #460. It is a
// seventh cause, not a rewording of
// `calendar.empty.page-cannot-go-live` — that line says a page can no longer
// go live, and a held page still publishes.
//
// 2026-09-10, issue #460: every sentence this partition still owed is now
// written — the owner approved the drafted set ("copy proposal
// approved", proposal sheet
// https://claude.ai/code/artifact/546f45a0-a996-4d25-b85e-fb03fda7b102)
// and the strings land here byte for byte. The values that approval names
// are the owner's; nothing here is composed.
//
// 2026-09-11, issue #516: `calendar.head` is rewritten. It was the last
// sentence in the product that promised a page every day, and the owner's
// Autopilot brief (DECISIONS 2026-09-10) rules that promise out: a day is
// filled only by an opportunity that passes readiness, so the grid is not
// guaranteed full and an empty day is competence, not an outage. The owner
// approved the replacement string (DECISIONS 2026-09-11), and it lands here
// byte for byte. BUILD §4.6's and UI-SPEC S14's printed headline are the
// amended in the same change.
import type { CopyPartition } from "../registry.ts";

export const CALENDAR_COPY = Object.freeze({
  "place.calendar.date.page": "No page on this date yet. The Monday check fills dates in.",
  "cause.unrecognised": "Nothing here yet, because of something on our side. It isn’t your market.",
  // 2026-09-08, issue #354. The approved screen set (S14) draws this line
  // on the one grid cell that has it, and ruling 11a makes its unbracketed
  // strings approved copy: "nothing worth publishing". Filled from the set,
  // not written here (constitution rule 1.2 — copying a recorded owner
  // ruling is not inventing one).
  //
  // It is the CELL's line. The panel states the whole account, under
  // `calendar.empty.supply-exhausted` below — DECISIONS 2026-09-07 (#209)
  // gives the cell the first line and the panel all of it, and S14/S15 draw
  // exactly that split for supply.
  "cause.supply-exhausted": "nothing worth publishing",
  // Plan's lead, cut to the board's first two sentences (SPEC §0 ≤20 words, owner R12 B11).

  // §4.6's stage filter cards. `all` is a filter, not a stage.
  "calendar.stage.all": "All",
  "calendar.stage.live": "Live",
  "calendar.stage.your-review": "Ready",
  "calendar.stage.scheduled": "Scheduled",
  "calendar.stage.planned": "Planned",
  "calendar.stage.needs-you": "Needs you",

  // E5: Plan's seven days, each in one of five states, the stop control on
  // a page that can still be stopped, and the week's spares. Drafted (#759).
  "calendar.day.written": "Written",
  "calendar.day.stopped": "Stopped",
  "calendar.day.skipped": "Skipped",
  "calendar.day.set-aside": "Set aside",
  "calendar.day.became-update": "Now an update",
  "calendar.day.became-update.line": "This day now improves a live page instead of a new one. Nothing is needed from you.",
  "calendar.week.stop": "Stop This Page",
  // Why the week holds a page: its most specific reason, one line.
  "calendar.week.why.near-page-one": "Close to Google’s first page",
  "calendar.week.why.not-moving": "No movement in 8 weeks",
  "calendar.week.why.ai-gap": "AI answers link a competitor",
  "calendar.week.why.linked-by-ai": "AI answers link your page on this topic",
  "calendar.week.why.searched": "Searched every month",
  "calendar.week.why.asked": "Buyers ask this",
  "calendar.week.why.fit": "A close fit for your business",
  "calendar.spares.title": "backup pages",
  "calendar.spares.note": "used if a day’s page can’t be written",

  // §4.6's stage-appropriate actions.
  "calendar.action.read-full-page": "Read the Full Page",
  "calendar.action.view-live-page": "View Live Page",
  // Issue 882 (owner, 2026-09-18): every written page is readable from the
  // calendar, not only the one in review. The review stage keeps §4.6's own
  // word above, which asks for a judgement; every other stage says plainly
  // what the way in opens. Drafted under issue 759's ruling.
  "calendar.action.read-page": "Read the Page as Written",
  // The approved S15 names the destination the control reconnects: a page
  // that stalled because WordPress refused the connection is reconnected to
  // WordPress, and "Reconnect" alone left the customer to guess which of
  // their settings it meant (ruling 11a, issue #354).
  "calendar.action.reconnect": "Reconnect WordPress",
  // Issue 880: a destination that carries no credential has nothing to
  // reconnect, so a page waiting on it opens where the founder fixes it
  // instead — and the WordPress sentence above is never shown to a hosted
  // site. Drafted under issue 759's ruling.
  "calendar.action.check-destination": "Open Settings › Pages",
  "calendar.action.skip": "Stop This Page",
  // SPEC §7 (2026-09-20, #908, issue #914) — "Screens and mail say *Stop
  // this page*. 'Veto' remains the internal word and the name of the
  // mechanism in this file." The key, the command, the column and the
  // route are all still `veto`; only what the customer reads changed.
  // The short form, and it is short because the canvas draws this control
  // in the day panel's two-column secondary row beside *Skip* and *Write
  // it again* — the full sentence belongs on the page itself, where the
  // draft screen says it in full.
  "calendar.action.veto": "Stop This Page",
  // 2026-09-07, issue #143. The customer's own restart — §9 opens
  // `needs_attention → generating` for them and for no one else, and no
  // surface offered it.
  //
  // **Not a spec word.** §4.6's control list for needs-you is *Reconnect*
  // and nothing more, so unlike the five above this key is not transcribed
  // from the spec — its word is the owner's.
  //
  // What it has to say is what happens: ReachKit writes the page again,
  // from the same opportunity, and it returns to the queue as a fresh
  // draft. What it must not say is that anything is being retried
  // automatically — nothing is, which is the whole reason the control
  // exists.
  "calendar.action.regenerate": "Write It Again",

  // SPEC §7 (2026-09-20, #908, issue #913) — "every action answers". Each
  // of the three writes the day panel offers says, in words, what became
  // of the page; a write the machine refused says that nothing changed.
  // The sentences are drafts in the registry's voice under issue 759's
  // ruling, and the owner may correct them.
  //
  // They are stated as facts about the page and never as progress
  // ("saving…"): the panel speaks only after the machine has answered, so
  // there is no moment at which one of these is a guess.
  "calendar.answer.veto": "Stopped. This page won’t go live.",
  "calendar.answer.skip": "Stopped. We won’t write this one.",
  // Issue 1196: "about two minutes" was not true — a page written again is
  // rewritten by the hourly draft tick (`src/jobs/draft-generate.ts`).
  "calendar.answer.regenerate": "We’re writing it again. It’s ready within the hour, and its page updates itself.",
  // One refusal sentence for all three. What a refused write has in common
  // is the only thing the customer needs: nothing moved. The machine's own
  // word for why (`not_a_transition`, a guard name) is a developer's
  // signal and is never shown.
  "calendar.answer.refused": "That didn’t work, so the page is unchanged. Try again.",

  // An answer engine's standing: a chip beside its engine, a chip beside its engine, each a statement of its own.
  "calendar.why.engine.names-you": "Mentions you",
  "calendar.why.engine.names-others": "Mentions competitors",
  "calendar.why.engine.names-no-one": "Names no one",
  "calendar.why.engine.no-answer": "No answer",

  // Issue 857 (owner, 2026-09-17): the plan reaches only the day before the
  // next weekly pass. The one quiet marker on the first date after it —
  // the owner's own words. Drafted under issue 759's ruling.
  "calendar.horizon.marker": "Planned a week ahead, closer to the day",

  // REQ-043 criterion 4's remaining causes, and criterion 10's one
  // provenance line. Each is a written sentence no artifact states, so the
  // words are the owner's.
  "calendar.empty.instruction": "This date holds a fix on your own site. Only you can make it.",
  "calendar.empty.page-cannot-go-live": "The page for this date was stopped or taken down, so it won’t go live. No page replaces it.",
  "calendar.empty.page-set-aside": "This page didn’t pass our checks, so we set it aside. Nothing is needed from you.",
  // #754 (owner 2026-09-16): the one held line offered both causes when the
  // app knows which it is. Split into one line per setting — and a host
  // waiting for its CNAME points at the record Settings shows. Drafted and
  // shipped under the owner ruling of 2026-09-16 (#759).
  "calendar.empty.customer-change-holds-pages.publishing-off": "Publishing is paused, so this page is waiting. It goes live once you turn publishing on in Settings.",
  "calendar.empty.customer-change-holds-pages.destination-pending-dns": "This page is ready. It goes live once your website is connected.",
  "calendar.empty.customer-change-holds-pages.destination-pending-connect": "This page is ready. It goes live once you connect your WordPress in Settings › Pages.",
  "calendar.empty.customer-change-holds-pages.destination-disconnected": "This page is ready. It goes live once you reconnect your website in Settings.",
  "calendar.empty.page-held": "We stopped our own work, so this page waited. It goes live, in turn, once we start again.",
  // The day panel's whole account of an exhausted supply — S15's `empty`
  // arm, verbatim (ruling 11a, issue #354). Its cell states the first line
  // alone, from `cause.supply-exhausted` above (#209).
  "calendar.empty.supply-exhausted": "Nothing worth publishing on this date. The Monday check looks for more.",
  // #765 (owner ruling 2026-09-16): a zero supply over a market that was
  // never measured — the current scan derived no questions, or the site has
  // never held an opportunity — is not "used up". Its own line, in the cell
  // and the panel alike. Drafted and shipped under #759's ruling.
  "calendar.empty.supply-unmeasured": "We haven’t found enough searches for your market yet. Name a broader one in Settings and we’ll check again.",
  // S15's `empty` arm leads with a chip carrying this word, so a date with
  // no page is named rather than left as a bare numeral. Approved (11a).
  // REQ-071 c11 (issue #204). A market change holds generation until the
  // pass that adopts it, so the day names which change is holding pages and
  // the date they resume — both read from `generationHold()`, which has
  // already chosen one reason where two answers changed.
  "calendar.empty.change-holds-pages": "No new page until the change to {change} takes effect. Pages resume on {date}.",
  // Issue 866: a category being replaced is measured again at once, so the
  // held day names the measurement it waits on rather than a Monday. A
  // domain change keeps the dated line above — that one does land at the
  // weekly pass. Drafted under issue 759's ruling.
  "calendar.empty.change-holds-pages.category": "No new page until we’ve checked your new market. Pages resume right after.",
  // REQ-043 c10's one line. Every one of S15's five arms ends on the same
  // measured tail — "measured Mon 8 Sep" — so that half is approved copy
  // and is filled here (11a). The per-arm prefixes the set draws beside it
  // ("written {ts}", "verified live {ts}", "last good delivery {date}")
  // are not: two of the three name a fact the month model does not carry,
  // and inventing a timestamp to print is the one thing this registry
  // exists to prevent. Named in #354's PR as engine-owed.
  // SPEC §7 (2026-09-20, #914): the customer's word for the interval.

  // §7's one statement of supply, as §4.6's calendar makes it: the three
  // arms of `supplyNotice`, in the engine's own precedence (exhausted >
  // short > arrival shortfall). Three keys and not one, because they are
  // three different claims — supply is gone / supply is running out /
  // this month stops before the month does — and a customer reads exactly
  // one of them. The words are the owner's: §4.6 states the supply *rule*
  // to the builder and never words it for the customer, and
  // `overview.supply.*` is the
  // same three claims on a different screen, so neither is the other's
  // string. `days` counts days of pages, so it is a text slot carrying a
  // numeral, exactly as `overview.supply.*` declares it.
  "calendar.supply.exhausted": "Nothing worth publishing is left since {since}. The Monday check looks for more.",
  // The same claim where the moment it ran out cannot be read (owner, PR
  // #961, 2026-09-21). `SupplyNotice`'s `since` is `Date | null` by
  // declaration, so this is a state a real site reaches and not only the
  // fixture's — and the sentence the screen used to render for it filled
  // the slot with an empty string: "… in your market, since . Monday’s
  // re-measure…". A variant without the clause, never a blank: a date the
  // product does not have is a date it does not mention.
  "calendar.supply.exhausted.undated": "Nothing worth publishing is left. The Monday check looks for more.",
  // issue 784: the same statement over a market that was never measured (issue 765)
  // — there was nothing to use up. Drafted under issue 759's ruling.
  "calendar.supply.unmeasured": "We haven’t found enough searches in your market to plan pages yet. Name a broader one in Settings and we’ll check again.",
  // issue 855: the same zero while the market is still being measured — a pass
  // stopped on a ceiling, measured again. Drafted under issue 759's ruling.
  "calendar.supply.measuring": "We’re still checking your market, so no pages are planned yet. Nothing is needed from you.",
  "calendar.supply.short": "Only {days} pages are left. The Monday check looks for more.",
  // Issue 1559: the depth is a week and its spares, not a month. Drafted.
  "calendar.supply.first-arrival": "Your first check found {days} pages so far. We look for more every Monday.",
  // Why pages stall, as one line under the statement of supply; a rule's own name never reaches the customer.
  "calendar.supply.stalled": "We wrote {written} pages in the last 7 days. Our writing rules stopped {stopped}.",

  // §4.6's `done-when` row, from the acceptance test recorded when the
  // opportunity was created (§7: "top 20 for Q" / "named on question P" /
  // "gate passes"). Three forms, three keys: the test a page is judged
  // against is never rewritten, so the row must say which of the three it
  // is rather than a single line that fits none of them.
  "calendar.done-when.top20": "your page is on Google’s first two pages for “{query}”",
  // SPEC §4 2026-09-29 (D16, issue 1147): the page is credited only where
  // the answer cites the page itself. Drafted (#759).
  "calendar.done-when.named-on": "an AI answer to “{question}” links this page",
  "calendar.done-when.gate-cleared": "the access check passes",

  // ── The day card and the day panel (SPEC §7, 2026-09-20, #908; issue 930)
  //
  // "A day card holds the date and exactly one number …, the title cut to
  // two lines, and one stage word … A day with no page says why in at most
  // two words; the day panel carries the full reason."
  //
  // So every cause the calendar speaks now has **two** forms and not one:
  // the ≤2-word hint the card carries, and the whole account the panel
  // already carried. The pair is the same split DECISIONS 2026-09-07 (#209)
  // made for supply, applied to every cause — and the short form is never a
  // truncation of the long one, because two words cannot be a sentence cut
  // in half. Drafted under issue 759's ruling; the owner corrects them.
  "calendar.empty.short.instruction": "Your fix",
  "calendar.empty.short.page-cannot-go-live": "Stopped",
  "calendar.empty.short.page-set-aside": "Didn’t pass our checks",
  "calendar.empty.short.change-holds-pages": "On hold",
  "calendar.empty.short.customer-change-holds-pages": "Held back",
  "calendar.empty.short.page-held": "Held back",
  // The two supply causes never reach a card — §7 (issue 857) states supply
  // once, at the top of the screen — but the map the card reads is total
  // over the causes, so a cause added to the union fails to compile rather
  // than drawing a blank word.
  "calendar.empty.short.supply-unmeasured": "No market yet",
  "calendar.empty.short.supply-exhausted": "No page",
  // ReachKit's own stop, where one is recorded for the day.
  "calendar.empty.short.reachkit-stopped": "We stopped",
  // A day the product cannot explain (SPEC §7, 2026-10-07, issue 1321): its
  // own two words and its own panel line, and neither says ReachKit
  // stopped. Drafted under issue 759's ruling; the owner corrects them.
  "calendar.empty.short.unexplained": "No page",
  "calendar.empty.unexplained": "No page is planned for this date yet.",
  // Issue 857's quiet marker, in the room a card has for it. The full line
  // (`calendar.horizon.marker`) is the panel's.
  "calendar.horizon.short": "Planned later",

  // The card's whole label, for a reader who never sees it. Three shapes,
  // because a card has three: a page, a date that says why it has none, and
  // a date with nothing to say at all. Composed from a key rather than
  // joined in the renderer, so the punctuation a screen reader pauses on is
  // the owner's.
  "calendar.card.aria.page": "{date}. {stage}. {title}",
  "calendar.card.aria.written": "{date}. {stage}. {title}. {label}",
  "calendar.card.aria.empty": "{date}. {reason}",
  "calendar.card.aria.date": "{date}",

  // What the page is: a new page, or an update of one the site already has
  // (SPEC §7, 2026-09-20 — "a mark for an update"). The card carries the
  // mark and this word names it; the panel says it in full.
  "calendar.card.update": "Update",
  "calendar.card.new-page": "New page",

  // The panel's two section heads, and the one control that closes it.

  // 2026-09-06, issue #50 (REQ-043 c12). The three grounds on which the
  // day panel says a way through leads nowhere **in place of** offering
  // it. Three keys, three sentences, all the owner's.
  //
  // There is no fourth ground, and in particular **there is no ground for
  // "the check could not be confirmed"**: that outcome's whole content is
  // that ReachKit does not know, and refusing a way on it would take a
  // page the record says nothing against and tell the customer the way
  // leads nowhere (ADR-085). The offered way claims only that this is
  // where the page was put, never that it is there now.
  "waythrough.unpublished-by-us": "This page was taken down through ReachKit, so its address isn’t offered.",
  "waythrough.page-not-found": "Our one check found no page at its address, so there’s nothing to open there.",
  "waythrough.no-admin-address": "No address inside your WordPress could be formed for this post.",

  // Board Plan: the head, the four numbers, the week card, how the week was
  // chosen, the day states and the live pages. Drafted (#759).
  "calendar.eyebrow": "Week {n}",
  "calendar.title": "This Week’s {n} Pages",
  "calendar.title.one": "This Week’s Page",
  "calendar.title.none": "This Week’s Pages",
  "calendar.head.undated": "Each goes live on its day unless you stop it.",
  "calendar.first-week": "Your first week is being chosen. It shows here by Monday morning.",
  "calendar.week.today": "Goes live today, {time}",
  "calendar.chip.new": "New",
  // Why the week holds a page, as a sentence from its most specific stored part.
  "calendar.reason.near-page-one": "Your page is close to Google’s first page for this search. This update adds what the pages above cover.",
  "calendar.reason.not-moving": "Your page has not moved in 8 weeks. This rewrite matches what Google now shows for it.",
  "calendar.reason.ai-gap": "AI answers link to a competitor’s page for this question. Yours can answer it from your own work.",
  "calendar.reason.linked-by-ai": "An AI answer linked your page on this topic. This one builds on it.",
  "calendar.reason.searched": "Buyers search for this every month.",
  "calendar.reason.asked": "Buyers ask this question before they buy.",
  "calendar.reason.fit": "A close fit for what your business offers.",
  "calendar.day.held-for-fix": "Waiting on your fix: {fix}.",
  "calendar.day.held-for-fix.link": "Open This Fix in Technical Issues",
  "calendar.day.stopped.line": "Stopped by you on {day}. Other days are not affected.",
  "calendar.day.skipped.line": "Nothing worth writing for this day, so no page.",
  "calendar.live.title": "Live Pages",
  "calendar.live.google": "Google: {step}",
  "calendar.live.ai": "AI: {step}",
  "calendar.live.place": "Place {n}.",
  "calendar.live.place-up": "Place {n}, up {up} since {date}.",
  "calendar.live.no-gain": "Place {n}, flat for {weeks} weeks.",
  "calendar.live.linked": "Linked by {engines}.",
  "calendar.live.update": "Update goes live {day}.",
  "calendar.live.found": "Found by Google {date}. Not in results yet.",
  "calendar.live.ai-unread": "not read yet",
  "calendar.live.showing": "Showing in results",
  "calendar.live.unread": "Live since {date}. We check it on Monday.",
  "calendar.live.all": "Show All {m} Live Pages",
  "calendar.head.line": "Chosen {date} · each goes live at {time} unless you stop it · next check {next}",
  "calendar.head.line.held": "Chosen {date} · next check {next}",
  "calendar.head.paused": "Publishing is paused, so nothing goes live. Turn it on in Settings › Pages.",
  "calendar.day.writing": "Being written",
  "calendar.day.writing.line": "Being written now, started {time}",
  "calendar.day.stopped.line.system": "Stopped on {day}. Other days are not affected.",
  "calendar.card.live": "Live since {date} · Google reading {next}",
  "calendar.card.place": "Place {n}, up {k} since {date}",
  "calendar.card.place.now": "Place {n}",
  "calendar.card.linked": "Linked by {engine}",
  "calendar.card.goes-live": "Goes live {day}, {time}",
  "calendar.card.volume": "{n} a month",
  "calendar.card.rival.place": "{domain}, place {n}",
  "calendar.card.yours": "Yours: place {n}",
  "calendar.pane.planned.title": "Going after “{search}”",
  "calendar.pane.searched": "Searched",
  "calendar.why.volume": "Each month",
  "calendar.why.volume.value": "{count} searches",
  "calendar.why.answered-today-by": "Best competitor",
  "calendar.pane.yours": "Your page",
  "calendar.pane.planned.next": "We write it before its day, and you can read it here once it’s written. It goes live on its own at {time} on {day}, unless you stop it.",
  "calendar.pane.written.next": "It goes live on its own at {time} on {day}. You can edit or stop it until then.",
  "calendar.pane.stopped.next": "Nothing goes live on {weekday}. Monday’s check picks the next 7.",
  "calendar.pane.writing": "Being written now, started {time}. It shows here to read when it’s done.",
  "calendar.pane.body.label": "{title}, the page",
  "calendar.next": "{date}: we check again and pick the next {n}.",
  "calendar.chosen.title": "How this week’s pages were chosen",
  "calendar.chosen.body": "Every Monday we check where your pages stand on Google and in AI answers. Then we pick the {n} most likely to bring you buyers.",
  "calendar.chosen.stored": "Each reason is the one saved when the page was chosen.",
  "calendar.pane.body.unread": "We couldn’t load the page here. Read the Full Page to see it.",
  "calendar.live.none": "No page is live yet. Each shows here once it goes live, with how far it has got.",
}) satisfies CopyPartition;
