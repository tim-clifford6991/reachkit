// The mail seam's sentences. Strings marked drafted are named in their pull request for the owner to correct (#759).
import type { CopyPartition } from "../registry.ts";

export const MAIL_COPY = Object.freeze({
  // The opt-out card's line, with the address in a slot rather than two half-sentences.
  "optout.confirmed": "No more follow-up mail will go to {address}, about any site.",
  "optout.invalid": "That unsubscribe link isn’t valid any more. Reply to any ReachKit email with \"stop\" and we’ll stop by hand.",

  // The card's own head (UI-SPEC S7, 11a). The set draws one eyebrow over
  // the mail chip and it states what happened: "Unsubscribed".
  "optout.head": "Unsubscribed",
  // Its own key: where nothing was opted out, "Unsubscribed" would contradict the line beneath.
  "optout.head.unresolved": "Not Unsubscribed Yet",

  // The OptOut board (canvas V22): what an opt-out changes, which follow-ups
  // were sent, where the report stays, and the by-hand way when a link fails.
  "optout.changes.title": "What This Changes",
  "optout.changes.followups": "Follow-up emails about your free report",
  "optout.changes.signin": "Sign-in links, if you have an account",
  "optout.changes.account": "Receipts and account emails, if you have an account",
  "optout.changes.stopped": "Stopped",
  "optout.changes.still": "Still sent",
  "optout.report": "The page you asked for stays yours, and your free report stays at its address. To take the report down, write to {address}.",

  // The shell's keys: the product's own name, transcribed, and the whole-mail lines.

  "mail.shell.wordmark": "ReachKit",
  "mail.nothing_to_report": "Nothing new to report this week.",
  "mail.week_unmeasured": "We couldn't check this week. The next check is on {nextDue}.",
  "mail.week_partly_measured": "We couldn't check {sections} this week. We left them out rather than show a zero.",

  // The six parts a partly measured week names (REQ-064 c4): six measurements, so six keys, shared with §4.5's
  // account of a partial week so a screen and a mail never call one measurement two things.
  "mail.section.on_page": "your pages",
  "mail.section.market": "your market",
  "mail.section.rankings": "Google",
  "mail.section.ai_answers": "AI",
  "mail.section.rivals": "competitors",
  "mail.section.score": "Visibility Score",
  "mail.unsubscribe.label": "Unsubscribe",
  // The pages behind the Monday mail's Unsubscribe and Pause publishing links.
  "unsubscribe.head": "Unsubscribed",
  "unsubscribe.done": "You won’t get this mail any more: {mail}. Turn it back on in Settings › Pages.",
  "unsubscribe.changes.still": "Still sent",
  "unsubscribe.invalid": "That link isn’t valid, so nothing has changed. You can switch any ReachKit mail off in Settings › Pages.",
  "unsubscribe.unavailable": "That couldn’t go through just now, so nothing has changed. Try the link again in a few minutes, or switch the mail off in Settings › Pages.",
  "unsubscribe.settings": "Mail Settings",
  "unsubscribe.ask": "Press Unsubscribe to stop this mail: {mail}. Sign-in links and account mail still arrive.",
  "pause.head": "Publishing Is Paused",
  "pause.done": "No page goes live until you turn publishing on again in Settings › Pages. Pages already written wait there, and nothing is deleted.",
  "pause.head.unresolved": "Not Paused",
  "pause.invalid": "That link isn’t valid, so nothing has changed. You can pause publishing in Settings › Pages.",
  "pause.unavailable": "That couldn’t go through just now, so nothing has changed. Try the link again in a few minutes, or pause publishing in Settings › Pages.",
  "pause.settings": "Publishing Settings",
  "pause.ask": "Press Pause Publishing and no page goes live until you turn publishing on again in Settings › Pages. Nothing is deleted.",
  "mail.optout.label": "Opt out of all follow-up mail",

  // 2026-09-05, issue #31 (lead capture, the giveaway page and the nurture
  // sequence, `BUILD.md` §4.2). Twenty-one keys.
  //
  // The four `mail.firstPageUnavailable.<cause>` keys are named for the
  // four `FirstPageFailure` members verbatim: `FIRST_PAGE_UNAVAILABLE_COPY`
  // (`src/lib/mail/leads/giveaway.ts`) is a `Record` over that union, so a
  // cause with no key of its own is a compile error — which is what makes
  // REQ-010 criterion 7's "and why" enforceable rather than aspirational.

  // The page itself (REQ-010 c4).
  "mail.firstPage.subject": "Your free page is ready",
  "mail.firstPage.preheader": "Ready to copy onto your site.",
  "mail.firstPage.target_search": "search it answers",
  "mail.firstPage.first_of_n": "Here is your page, ready to copy. It's 1 of {pagesFound} pages we found for your site.",

  // The message that closes the request when no page is coming (c7), one
  // line per cause.
  "mail.firstPageUnavailable.subject": "Your free page isn't coming",
  "mail.firstPageUnavailable.preheader": "Your free report stays online.",
  "mail.firstPageUnavailable.no-page-to-write": "We found nothing worth writing for this site, so we sent nothing. Your free report stays online.",
  "mail.firstPageUnavailable.writing-failed": "We couldn't write your page, so we sent nothing. Your free report stays online.",
  "mail.firstPageUnavailable.writing-refused": "Your page didn't pass our own checks, so we didn't send it. Your free report stays online.",
  "mail.firstPageUnavailable.delivery-failed": "We couldn't deliver your page to this address. Your free report stays online.",

  // The three touches (c9). One subject and one line each; the touch is
  // carried by the key, never by a conditional inside a template.
  "mail.nurture.subject.1": "The rest of your pages",
  "mail.nurture.subject.2": "What changes once the pages ship",
  "mail.nurture.subject.3": "One last note about your report",
  "mail.nurture.body.1": "You have page 1 for {domain}. ReachKit takes it from here. Up to {weekPages} pages a week, new or updated, published for you. Each goes live on its own unless you stop it first. €49 a month, cancel any time.",
  "mail.nurture.body.2": "Every page ReachKit writes for {domain} targets one search your competitors already answer. Each Monday it scans your market again and shows how your pages are doing.",
  "mail.nurture.body.3": "This is the last follow-up about {domain}. Your report and your first page stay yours. When you want the rest written and published, ReachKit starts at €49 a month, cancel any time.",

  // BUILD §4.3's setup reminder (REQ-025 c6); the last three ask a stamped founder who is not live to connect (R15).
  "mail.setupReminder.subject": "Finish setup for your first page",
  "mail.setupReminder.body": "It takes about {setupMinutes} minutes. Then we write your first page.",
  "mail.setupReminder.preheader": "Your first page starts after setup.",
  // Headings are Title Case and subjects sentence case (SPEC §1), so a kind headed by its news has its own heading key.
  "mail.setupReminder.heading": "Finish Setup for Your First Page",
  "mail.setupReminder.action": "Finish Setup",
  "mail.setupReminder.written": "Your first page is written and waiting.",
  "mail.setupReminder.connect": "One setting at {provider} puts it live.",
  "mail.setupReminder.connectAny": "Connecting your website puts it live.",
  // SPEC §5: the connect steps a buyer sends to their web person, who never asked for mail from us.
  "mail.webPerson.subject": "Add one DNS record for {domain}",
  "mail.webPerson.heading": "Add One DNS Record for {domain}",
  "mail.webPerson.preheader": "One record, about 5 minutes. Reply to reach the person who asked.",
  "mail.webPerson.intro": "Someone at {domain} asked us to send you these steps. Replying reaches them, not us.",
  "mail.webPerson.done": "Once it’s saved, you’re done. We check for it every hour.",
  "mail.reason.webPerson": "Someone at {domain} typed your address to send you this. We keep no copy of it.",

  // What `POST /api/lead` answers with. The adapter maps each arm of
  // `captureLead()` to one of these keys and never to a sentence of its
  // own or a vendor payload (REQ-003 c10, REQ-010 c1).
  "lead.accepted": "Got it. Your report is on its way, and your page follows when it’s written.",
  "lead.invalid_address": "That isn’t an email address. Try one like you@example.com.",
  "lead.unavailable": "We couldn’t save your email. Try again in a few minutes.",

  // The third arm of the opt-out page: the link is good and our store is
  // not. Telling the reader their link is invalid would be a false
  // statement about the one thing they came to do. This is the one key on
  // this list a *screen* reads through `copy()` (issue #261).
  "optout.unavailable": "That unsubscribe couldn’t go through just now, so nothing has changed. Try the link again in a few minutes, or reply to any ReachKit email with \"stop\" and we’ll stop by hand.",

  // 2026-09-06, issue #33 (Stripe, provisioning and the two backstops,
  // `BUILD.md` §13). Nine keys.
  //
  // Two of the nine (`mail.account.reach_a_person`,
  // `mail.account.no_second_subscription`) carry obligations REQ-024
  // states in words rather than in structure — "names one way to reach a
  // person", "is told that it bought no second subscription" — and are
  // separate keys rather than clauses inside another line so that a mail
  // missing one fails to compose rather than shipping without it.

  // The sign-in link a completed payment sends (§13, REQ-024 c1).
  "mail.magicLink.subject": "Your sign-in link",
  "mail.magicLink.preheader": "One click signs you in.",
  // The lifetime is SPEC §3's 24 h, the OTP expiry Supabase is set to.
  "mail.magicLink.body": "One click signs you in on this device. The link works once and expires in 24 hours.",
  "mail.magicLink.action": "Sign In",
  "mail.magicLink.paid.subject": "Payment received: your account is ready",
  "mail.magicLink.paid.heading": "Payment Received",
  "mail.magicLink.paid.line": "Your payment went through and your account is ready. The button below opens setup.",

  // The 15-minute chase (REQ-024 c5): the payment succeeded, and either a
  // working link or a written statement that the account is not open yet.
  // Two bodies, not one with a conditional: "here is your way in" and "we
  // are still opening it" are two different things to say.
  "mail.account.chase.subject": "Payment received",
  "mail.account.chase.preheader": "Your payment went through.",
  "mail.account.chase.link_ready": "Your payment went through and your account is open. Sign in below.",
  "mail.account.chase.not_open_yet": "Your payment went through, and we're opening your account now. A sign-in link follows soon, and nothing more is charged.",

  // The second-purchase mail (REQ-024 c3): what a founder whose second
  // purchase was charged is told.
  "mail.account.second_purchase.subject": "We took a second payment",
  "mail.account.second_purchase.preheader": "You still have one subscription.",
  "mail.account.no_second_subscription": "A second payment from this address went through, but it bought no second subscription. You still have one account, one site and one running subscription; nothing else was created.",

  // The one way to reach a person, named in every `account` mail REQ-024
  // requires it in (c3, c5). One key, so the address is written once.
  "mail.account.reach_a_person": "To reach a person, reply to this mail.",

  // SPEC §8, Onboarding mails: once per site, setup done with what the first check found, then connected.
  "mail.account.setup_done.subject": "Your setup is done",
  "mail.account.setup_done.preheader": "What our first check found, and the pages planned for this week.",
  "mail.account.setup_done.found": "Your setup is done and our first check of {domain} is finished. Here is what we found.",
  "mail.account.setup_done.partial": "This first check could not measure everything. We check again every Monday, and that mail says what we found.",
  "mail.account.setup_done.market": "Market",
  "mail.account.setup_done.rivals": "Competitors",
  "mail.account.setup_done.searches": "Searches we can write for",
  "mail.account.setup_done.day": "{day}",
  "mail.account.setup_done.week_none": "No pages are planned yet. We look again on Monday and plan the week from what we find.",
  "mail.account.setup_done.action": "Open Your Plan",
  "mail.account.connected.subject": "Your website is connected",
  "mail.account.connected.preheader": "Your pages now have a place to go live.",
  "mail.account.connected.body": "Your website is connected. Your pages go live at {host}, starting {day}.",
  "mail.account.connected.body_no_day": "Your website is connected. Your pages go live at {host}.",

  // 2026-09-06, issue #35 (identity, REQ-077 c3). The one `account` mail
  // that goes to the address an account has just stopped signing in with:
  // "saying the account now signs in at a different address and this one no
  // longer can". Two keys.
  //
  // No slot on either. The mail arrives at the old address, so naming it
  // says nothing, and naming the new one would put the account's live
  // credential-bearing address into the mailbox the customer is leaving.
  "mail.account.address_moved.subject": "Your sign-in address changed",
  "mail.account.address_moved.preheader": "This address can no longer sign in.",
  "mail.account.address_moved": "Your ReachKit account now signs in with a different email address. This address can't sign in, and our mail goes to the new one.",

  // The `weekly` mail (owner ruling 78, 2026-11-22): what we did, Overview's tiles in their own words, this week's pages.
  // A page is named by its search, never by a model-written title (§8, REQ-093). The subject is the first that applies of
  // blocked, a first-ever event, pages went live, else the week; each is at most six words.
  "mail.weekly.blocked.subject": "Your pages are waiting on you",
  "mail.weekly.pages.subject": "{n} new pages went live",
  "mail.weekly.pages.one.subject": "Your new page went live",
  "mail.weekly.first-page.subject": "Your page reached Google's first page",
  "mail.weekly.first-page.preheader": "What we did, how your pages are doing, and this week's pages.",
  "mail.weekly.first-visit.subject": "Your pages got their first visit",
  "mail.weekly.first-visit.preheader": "Your pages had their first visit. Here is your week.",
  "mail.weekly.first-click.subject": "First click through to your business",
  "mail.weekly.first-click.preheader": "A visit went on to your business. Here is your week.",
  "mail.weekly.week.subject": "Week {week} for {business}",
  "mail.weekly.preheader": "What we did, how your pages are doing, and this week's pages.",
  "mail.weekly.preheader.blocked": "One thing needs you before your pages can go live.",
  "mail.weekly.needsYou": "One page needs you: {page}.",
  "mail.weekly.needsYou.action": "Open the Page",
  // What we did: last week's live pages by their search, the set-aside line, or what the week's pass checked.
  "mail.weekly.did": "What We Did",
  "mail.weekly.did.item.new": "New page · {search}",
  "mail.weekly.did.item.update": "Update · {search}",
  "mail.weekly.did.checked": "We checked {searches} Google searches and asked AI {questions} questions your buyers search.",
  // The week's stored days pick the arm: no gap is replaced, or updated where updates filled every one.
  "mail.weekly.setAside.one": "One page didn’t pass our checks. We set it aside and wrote the next one.",
  "mail.weekly.setAside.many": "{n} pages didn’t pass our checks. We set them aside and wrote the next ones.",
  "mail.weekly.setAside.one.unreplaced": "One page didn’t pass our checks, so we held it back.",
  "mail.weekly.setAside.many.unreplaced": "{n} pages didn’t pass our checks, so we held them back.",
  "mail.weekly.setAside.one.updated": "One page didn’t pass our checks. We set it aside and improved a live page instead.",
  "mail.weekly.setAside.many.updated": "{n} pages didn’t pass our checks. We set them aside and improved live pages instead.",
  "mail.weekly.results": "How Your Pages Are Doing",
  "mail.weekly.standing": "Your Overview shows where each page stands this week.",
  // The first row while the hosted address waits for its record, every Monday until it is connected. Drafted (#759).
  "mail.weekly.connect": "Your pages are written but can't go live at {host} yet. Add one line at the company you bought your address from.",
  "mail.weekly.connect.wordpress": "Your pages are written but can't go live on {host} yet. Connect your WordPress in Settings › Pages.",
  "mail.weekly.connect.action": "Connect Your Website",
  "mail.weekly.next": "This Week’s Pages",
  "mail.weekly.next.none": "No new pages this week, as we found nothing worth writing. We look again next Monday.",
  "mail.weekly.next.few": "{n} pages this week: the ones your business can answer well.",
  "mail.weekly.next.few.one": "One page this week: the one your business can answer well.",
  "mail.weekly.next.item": "{search}",
  // One row per page: its day, its search, why, and its two links.
  "mail.weekly.next.day.new.today": "{day} · New page · goes live today, {time}",
  "mail.weekly.next.day.new": "{day} · New page · goes live {date}, {time}",
  "mail.weekly.next.day.update.today": "{day} · Update · goes live today, {time}",
  "mail.weekly.next.day.update": "{day} · Update · goes live {date}, {time}",
  "mail.weekly.next.why": "Why: {reason}",
  "mail.weekly.next.stop": "Stop This Page",
  "mail.weekly.next.edit": "Edit",
  "mail.weekly.next.all": "See All {n} in This Week",
  "mail.weekly.calm": "Nothing needs you this week. Each page goes live at {time} on its day.",
  "mail.weekly.hi": "Hi {name}, here’s week {week} for {business}.",
  "mail.weekly.hi.unnamed": "Here’s week {week} for {business}.",
  "mail.weekly.pace": "Google finds a new page in a few days to a few weeks. Reaching Google's first page can take months.",
  "mail.weekly.footer.pause": "Pause Publishing",
  "mail.weekly.footer.settings": "Mail Settings",

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
  "mail.account.hosting_end.access_ended.subject": "Your ReachKit access has ended",
  "mail.account.hosting_end.seven_days.subject": "Your pages go offline soon",
  "mail.account.hosting_end.preheader": "You can still download all your pages.",
  "mail.account.hosting_end.stops_on": "Your ReachKit pages go offline on {date}. They stay as they are until then.",
  "mail.account.hosting_end.export_stays": "Your content export stays available afterwards, with no end date.",

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
  "mail.draftReady.autopilotWindow": "It goes live {publishesAt}. Until then, you can edit or stop it.",
  "mail.draftReady.autopilotZero": "It goes live {publishesAt}. You set no time to stop it.",

  // REQ-057 c9's destination clause for a page bound for the customer's own site. `{site}` is where the page goes live,
  // never a credential. The two `goesLive` keys differ only in *when*: after the interval, or at once with none.
  "mail.draftReady.dest.goesLiveThen": "It goes live on {site} for anyone to read.",
  "mail.draftReady.dest.goesLiveAtOnce": "It goes live on {site} at once, for anyone to read.",
  // A hosted address still waiting for its record: no page goes live there
  // until it is connected, so this mail names no moment. Drafted (#759).
  "mail.draftReady.dest.addressNotConnected": "This page can't go live at {site} until your website is connected. Add the line below at the company you bought your address from.",
  "mail.draftReady.dest.addressNotConnected.noRecord": "This page can't go live at {site} until your website is connected. Your Overview shows the one line to add.",
  "mail.draftReady.record.type": "Type",
  "mail.draftReady.record.name": "Name",
  "mail.draftReady.record.value": "Value",
  "mail.draftReady.waiting.subject": "Your page waits for your website",
  "mail.draftReady.waiting.preheader": "Connect your website and it goes live.",
  // A WordPress set up without its login is named by the site's domain, since no address is stored. Drafted (#759).
  "mail.draftReady.dest.wordpressNotConnected": "This page can't go live on {site} until your WordPress is connected. Connect it in Settings › Pages.",
  // The site cannot be published to as things stand: it says what to change, and c9 keeps the date, interval and stop.
  "mail.draftReady.dest.cannotPublish": "We can't publish to {site} right now. See what to change in Settings › Pages.",

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
  "mail.draftReady.why.volume": "asked",

  // ── SPEC §8 (2026-09-20, #933): the page-ready mail as the approved
  // board draws it — the line above the title, the fact rows beside the
  // number, the two buttons and the note under the second one.
  //
  // The stop note is the owner's own drafted sentence, used as it was
  // written. The line above the title names the page as the next one of the
  // daily autopilot (owner 2026-10-09, issue 1362); it was "Your page is
  // ready to read", which framed it as waiting on the customer. The four row labels and
  // the three answered-by values are drafted in the registry's voice under
  // the 2026-09-16 ruling (#759), and #933's PR names each one.
  //
  // The rows are labels, not sentences: a fact table's left column names
  // the fact and its right column is the value, already written by the
  // caller that read the stored evidence (`blocks/types.ts` says why the
  // value is the one field that is not a key).
  "mail.draftReady.ready": "Your next page is ready",
  "mail.draftReady.readAction": "Read the Full Page",
  "mail.draftReady.stopNote": "Stop This Page works without signing in, until the page goes live.",
  // The board already names two of the rows — `mail.draftReady.fact.search`
  // ("search") and `.fact.answeredBy` ("answered today by"), with
  // `.fact.you` for the value — and those are used as they stand. These two
  // are the rows it adds, and the two other values that row can take.
  //
  // "Nobody" is a measured result and not an absence: every engine answered
  // the search and named no one. A row nothing measured is not here at all.
  "mail.draftReady.fact.chances": "chance to show",
  "mail.draftReady.fact.writtenFrom": "based on",
  "mail.draftReady.fact.others": "other sites",
  "mail.draftReady.fact.nobody": "nobody",
  "mail.draftReady.subject": "Your next page is ready",
  "mail.draftReady.preheader": "Read it now, before it goes live.",
  "mail.draftReady.stopAction": "Stop This Page",

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
  // One subject per recorded outcome, so a page we could not find is never announced as live.
  "mail.published.subject": "Your first page is live",
  "mail.published.subject.not_found": "We can't find your first page",
  "mail.published.subject.not_confirmed": "We couldn't check your first page",
  "mail.published.preheader": "What we found when we checked it.",
  "mail.published.verified": "Anyone can open it now. We checked it on {checkedAt}.",
  "mail.published.not_found": "We found no page at its address on {checkedAt}.",
  "mail.published.not_confirmed": "We couldn't check it on {checkedAt}.",
  "mail.published.address_label": "address",

  // The four outcomes, as the four subjects of a `verdicts` block, and the
  // three words one of them can carry. Split this way so the four names
  // are written once each and the three verdicts once each, rather than
  // twelve sentences that could disagree with one another.
  //
  // `check_not_measured` is its own word and is never `check_failed`: a
  // check ReachKit could not observe is not a check this page failed, and
  // saying so would blame the customer's page for a condition of the site
  // it sits in (criterion 6).
  "mail.published.counting": "We count its visits from today. Your Monday email shows them.",
  "mail.published.checks_label": "What we checked",
  "mail.published.checks_empty": "No results were saved for these checks.",
  "mail.published.check.reachable": "Opens for anyone",
  "mail.published.check.indexable": "Google may show it",
  "mail.published.check.sitemap": "In your site map",
  "mail.published.check.ai_readable": "AI apps can read it",
  "mail.published.check_passed": "yes",
  "mail.published.check_failed": "no",
  "mail.published.check_not_measured": "couldn't check",

  // Criterion 6's condition of the site, named separately from the page's
  // own outcomes and stated as the customer's own to act on. Two kinds,
  // two lines, each carrying the date it was found — a condition is only
  // ever as fresh as the last page checked on that site, and ReachKit
  // never goes back to look.
  "mail.published.site_condition.publishes_no_sitemap": "Your site publishes no sitemap, as of {foundAt}. That is a condition of the site, not of this page, and it is yours to fix.",
  "mail.published.site_condition.robots_blocks_site": "Your site’s robots policy blocks AI crawlers across the whole site, as of {foundAt}. That is a condition of the site, not of this page, and it is yours to change.",

  // ── The one `account` mail a deleted account leaves behind (issue #52)
  //
  // REQ-079 criterion 6. Deletion leaves the customer no ReachKit surface to
  // read, so the naming criterion 4 puts on such a surface is carried by
  // this mail instead — sent to the address being deleted, and only where
  // something of either kind is left behind. Same `account` kind.
  //
  // Criterion 6 gives each of §9's four WordPress outcomes "one sentence of its own, carrying that outcome's own count
  // and, where there is anywhere to look, its own place — and no sentence carries two outcomes or one count for both".
  // Three come in two forms, one naming the place and one saying ReachKit cannot point to them there, "and it still
  // carries its count"; `already_gone` has one form only, "naming no place, because there is nothing there to find".
  //
  // Every one carries a `count` slot and none of them lists a post, "whatever the number".
  "mail.account.deleted.subject": "Goodbye from ReachKit",
  "mail.account.deleted.goodbye": "Your ReachKit account is closed, and your plan has ended with no more charges.",
  "mail.account.deleted.taken_down": "Every page we hosted for you is taken down.",
  "mail.account.deleted.erased_by": "We keep your invoices, refund records, name and email, and any opt-out from our mail. The rest is erased by {date}.",
  "mail.account.deleted.kept_removed": "Your name and email are kept to invite you back. To have them removed, reply to this mail.",
  // Pages still live where ReachKit could not reach: the mail "names it and says what they must do about it".
  "mail.account.deleted.still_live": "Pages still live at a destination ReachKit could not reach: {count}. Taking them down there is now yours to do; ReachKit no longer can.",
  // "The mail says of every post still in that site that it is theirs to
  // keep or remove" — its own key, because a promise living inside another
  // sentence is one edit away from being dropped without anything failing.
  "mail.account.deleted.theirs_to_keep": "Every post still in your site is yours to keep or remove.",
  "mail.account.deleted.wordpress.returned_to_draft": "Posts ReachKit made live in your WordPress and has now returned to draft: {count}. Nothing else about them changed. They come up together at {place}.",
  "mail.account.deleted.wordpress.returned_to_draft.no_place": "Posts ReachKit made live in your WordPress and has now returned to draft: {count}. Nothing else about them changed. They are in your site; ReachKit cannot point to them there.",
  "mail.account.deleted.wordpress.named_for_removal": "Posts ReachKit created in your WordPress and never made live: {count}. Nobody published them, they were never public, and nothing was written into them. They come up together at {place}.",
  "mail.account.deleted.wordpress.named_for_removal.no_place": "Posts ReachKit created in your WordPress and never made live: {count}. Nobody published them, they were never public, and nothing was written into them. They are in your site; ReachKit cannot point to them there.",
  // No place form: "this sentence naming no place, because there is nothing
  // there to find."
  "mail.account.deleted.wordpress.already_gone": "Posts no longer in your site when ReachKit went to return them: {count}. There was nothing there to change.",
  "mail.account.deleted.wordpress.unreachable": "Posts in a site ReachKit could not reach: {count}. They may still be live there, and nothing was written into them. They come up together at {place}.",
  "mail.account.deleted.wordpress.unreachable.no_place": "Posts in a site ReachKit could not reach: {count}. They may still be live there, and nothing was written into them. ReachKit cannot point to them in that site.",

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
  "mail.account.destinationBroken.subject": "Your pages can't reach your website",
  "mail.account.destinationBroken.preheader": "Nothing is lost while you fix it.",
  "mail.account.destinationBroken.body": "Your pages can't reach your website, so we're holding them. Reconnect and they go live.",
  "mail.account.destinationBroken.held": "pages waiting",
  "mail.account.destinationBroken.action": "Reconnect Your Website",

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

  // The footer band after the wordmark above: `ReachKit · [imprint line]`.
  "mail.shell.imprint": "Tim Clifford · Schwedter Straße 235, 10435 Berlin, Germany",

  // S20's footer line — why this mail arrived — one per kind the set
  // draws. `mail.reason.report` takes the removal address as a slot rather
  // than writing it: `removal.address` is its one home in the product
  // (REQ-002 c1), and a second copy here is exactly what that rule is for.
  "mail.reason.magicLink": "If you didn't ask for this, ignore it. Nothing changes.",
  "mail.reason.report": "Own this site and want the report taken down? Write to {address}.",
  "mail.reason.firstPage": "Sent once, because you asked for it on the report. Follow-up mail has an opt-out link.",
  "mail.reason.draftReady": "Sent for new pages in your first week. Turn it off in Settings › Pages.",
  "mail.reason.published": "Sent once, when your first page goes live. Turn it off in Settings › Pages.",
  "mail.reason.weekly": "You get this one mail each Monday.",
  // #640: SPEC §8 gives every mail a "why it arrived" line; the setup
  // reminder had none, and no approved sentence exists for it.
  "mail.reason.setupReminder": "Up to 3 reminders, until your first page is live.",
  "mail.reason.nurture": "Opt out of all follow-up: one link, every domain, for good.",

  // The `report` kind — registered in `MAIL_KINDS` since the seam was
  // built and drawn for the first time by the approved set, so this is
  // where its sentences arrive. The subject carries the score and its band
  // word because the set puts them there: a reader decides whether to open
  // it on the number, not on the domain alone (6a names the number).
  "mail.report.subject": "{domain}: Visibility Score {score}, {band}",
  "mail.report.subject.unmeasured": "{domain}: your free report",
  "mail.report.notMeasured": "Not measured",
  "mail.report.heading": "Your Report Is Ready",
  "mail.report.preheader": "Free, and it stays online.",
  "mail.report.body": "Your full report is free and stays online.",
  "mail.report.action": "Open the Report",
  // #638: the mail's next step, between the verdict and its one action.
  // No approved sentence says what a free-report reader does next, so the
  // key ships awaiting the owner's line.
  "mail.report.next": "Each problem says who can fix it. The full method is there too, free.",
  "mail.report.fact.score": "Visibility Score",
  "mail.report.fact.aiAnswers": "AI",
  "mail.report.fact.googleSearch": "Google",

  // The headings S20 gives the kinds whose heading is a sentence rather
  // than a page title. `first-page`, `draft-ready` and `published` head on
  // the page's own title, which is data and arrives through a slot.
  "mail.magicLink.heading": "Sign In to ReachKit",
  "mail.magicLink.fact.for": "for",
  "mail.firstPage.heading": "{title}",
  "mail.draftReady.heading": "{title}",
  "mail.draftReady.fact.search": "search",
  "mail.draftReady.fact.answeredBy": "answered today by",
  "mail.draftReady.fact.you": "you",
  "mail.published.action": "View the Page",
  // D28 (owner, 2026-10-02, #1185): what ReachKit changed about the market
  // it measures. Drafted, named in the pull request.
  "mail.weekly.market.changed": "We now compare you with others in {category}. {reason}",
  "mail.weekly.rival.added": "New competitor: {rival}. {reason}",
  "mail.weekly.rival.dropped": "We no longer compare you with {rival}.",
  "mail.weekly.action": "Open Your Overview",
  "mail.nurture.action": "Start ReachKit €49",

  // ── The one mail nobody outside this company ever receives (issue #329,
  // BUILD §6.5): the owner, told that the product's daily spend crossed a
  // line or that the kill switch moved.
  //
  // One subject over all three occasions, three bodies. The occasions are
  // one event to the reader ("something about spending changed") and the
  // subject line is where that reader decides whether to look now, so
  // splitting it three ways would buy nothing and owe the owner two more
  // sentences. The body is where they differ, and they differ completely.
  "mail.ops.spend-ceiling.subject": "Spend alert",
  "mail.ops.spend-ceiling.heading": "Spend Ceiling",
  /** Crossed `SPEND_ALERT_AT.warn` of the day's ceiling — nothing has been
   *  refused yet; this is the hour to look. */
  "mail.ops.spend-ceiling.warn": "Today’s spend has crossed the warning line, most of the way to the daily ceiling. Nothing has been refused yet — this is the hour to look.",
  /** Reached the ceiling: free scanning is refused for the rest of the UTC
   *  day and paid passes are holding. */
  "mail.ops.spend-ceiling.reached": "Today’s spend has reached the daily ceiling. Free scanning is refused for the rest of the UTC day; paid passes are holding.",
  /** Issue 885 — one site reached `CAPS.DAILY_SITE_C`, its own share of
   *  the day. The opposite news to `reached`: the product is still
   *  serving everybody else, and the fact row names which site. Drafted
   *  and shipped under the owner ruling of 2026-09-16 (#759); the owner
   *  corrects the wording. */
  "mail.ops.spend-ceiling.site-reached": "One site has reached its own daily cap. Its paid calls are refused for the rest of the UTC day; every other site is unaffected and the product’s own ceiling is untouched.",
  /** Issue 885 — a free-path bound filled. The fact row names which bound;
   *  the network key and the domain are never written into this mail. */
  "mail.ops.spend-ceiling.free-scan-bound": "A free-scan bound has been reached: one network, or one address, has had every free scan it gets in this window. Free scanning carries on for everyone else.",
  /** The switch, found engaged. No released twin: a release cannot be told
   *  from an ordinary boot without durable state. */
  "mail.ops.spend-ceiling.kill-switch-engaged": "The kill switch is engaged. Scanning, generating and publishing are stopped until it is released.",
  "mail.ops.spend-ceiling.ledger-unreadable": "We could not read the spend ledger ({reason}), so paid work has stopped. We tell you once a day until it reads again.",
  /** The two mono fact rows the S20 shell draws under the line. The
   *  figures reach them as already-written values (cents, as integers);
   *  these are their labels, and the unit is the owner's word to choose. */
  "mail.ops.spend-ceiling.fact.spent": "spent today, in cents",
  "mail.ops.spend-ceiling.fact.ceiling": "daily ceiling, in cents",
  /** Issue 885’s third row, drawn only where the alert is not about the
   *  product as a whole. Closed values: a site id, or one of two bound
   *  names — never a network key and never a domain. */
  "mail.ops.spend-ceiling.fact.site": "site",
  "mail.ops.spend-ceiling.fact.bound": "bound reached",

  // ── The owner's incident alert (issue 330): a job invocation failed, a
  // job exhausted its retries, or a deployment refused to boot. Drafted and
  // shipped under the owner ruling of 2026-09-16 (#759). The fact values are closed
  // names (a job id, an attempt, an error class, a boot check), never a message, a payload or an address.
  "mail.ops.incident.subject": "ReachKit incident",
  "mail.ops.incident.subject.down": "ReachKit is down: the database is not answering",
  "mail.ops.incident.heading": "Something Needs Your Attention",
  "mail.ops.incident.job-failed": "A job failed.",
  "mail.ops.incident.dead-lettered": "A job ran out of retries and was set aside.",
  "mail.ops.incident.boot-refused": "A deployment refused to boot.",
  "mail.ops.incident.fact.job": "Job",
  "mail.ops.incident.fact.attempt": "Attempt",
  "mail.ops.incident.fact.error": "Error",
  "mail.ops.incident.fact.check": "Check",
  // Issue #770: a paid pass read the market and found too little to plan from.
  "mail.ops.incident.market-too-small": "A paid pass found too little search demand to plan any pages.",
  "mail.ops.incident.fact.scan": "Scan",
  "mail.ops.incident.fact.tier": "Tier",
  // Issue 796: the Monday digest of weekly passes that found too little.
  "mail.ops.incident.market-too-small-week": "These weekly passes found too little search demand to plan any pages.",
  "mail.ops.incident.fact.week": "Week of",
  "mail.ops.incident.fact.cause": "Cause",
  "mail.ops.incident.untold-days-week": "These days had no page, and no alert went out for them. Each shows the site, the date and the recorded cause.",
  // Issue 1286 (D57): what the week cost, on the same Monday digest.
  "mail.ops.incident.costs-week": "What last week cost. Each site lists the average cost of one measurement and of one page written, stopped pages included, with how many there were. Free scans and smoke tests are counted apart.",
  "mail.ops.incident.fact.cost-measurement": "Cost per measurement",
  "mail.ops.incident.fact.cost-page": "Cost per page written",
  "mail.ops.incident.fact.cost-site": "Site total",
  "mail.ops.incident.fact.cost-free-scans": "Free scans (total × count)",
  "mail.ops.incident.fact.cost-smoke-tests": "Smoke tests (total × count)",
  "mail.ops.incident.fact.cost-total": "Week total, all spend",
  // Issue 1298 (D63, drafted): the week's Google SERP reads that timed out.
  "mail.ops.incident.fact.serp-timeouts": "Google SERP reads that timed out (timed out / all)",
  "mail.ops.incident.fact.serp-timeout-cost": "Billed for timed-out SERP reads",
  // Issue 1287 (D58, drafted): the passes one of their own health checks failed on. Owner-only, so the site is named.
  "mail.ops.incident.health-week": "These passes failed one of their own health checks in the last seven days. Their data is stored, and the headline numbers stay on the last healthy pass.",
  "mail.ops.incident.fact.health-check": "Failed check",
  // Issue #799: a scheduled job has gone quiet for twice its interval.
  "mail.ops.incident.job-stale": "A scheduled job has not run for more than twice its usual interval.",
  "mail.ops.incident.fact.last-run": "Last run",
  "mail.ops.incident.fact.interval": "Runs every (minutes)",

  "mail.ops.incident.no-draft-at-publish": "A site's publish time passed with no page for the day. The cause is the one its draft run recorded.",
  "mail.ops.incident.fact.date": "Date",
  // Issue 1536: a site on autopilot that has gone twice its cadence without a delivered page.
  "mail.ops.incident.autopilot-stalled": "A site on autopilot has had no page delivered for twice its publishing cadence. Its draft days in the database say why each day had none.",
  "mail.ops.incident.fact.last-delivered": "Last page delivered",
  "mail.ops.incident.fact.days-without": "Days without a page",
  // Issue 1187: a draft the writing rules stopped twice (owner, D27).
  "mail.ops.incident.draft-stopped-twice": "The writing rules stopped a page twice, so it was not published. Read the sentences below and decide whether the page or the rule is wrong.",
  "mail.ops.incident.fact.site": "Site",
  "mail.ops.incident.fact.draft": "Draft",
  "mail.ops.incident.fact.rule": "Rule",
  "mail.ops.incident.fact.sentence": "Sentence",
  // Issue 1587: DataForSEO credit runs out within a week, or is under ten dollars.
  "mail.ops.incident.vendor-low": "DataForSEO credit is running low. When it reaches zero every draft fails, so top up or turn on auto-recharge in the dashboard.",
  "mail.ops.incident.fact.balance": "Balance",
  "mail.ops.incident.fact.days-left": "Days left at last week's spend",
  "mail.ops.incident.fact.dashboard": "Dashboard",

  // ── SPEC §8, Retention (issue 569). Slots are named for what the sequence
  // can supply.
  "mail.paymentFailed.subject": "Your payment didn’t go through",
  "mail.paymentFailed.heading": "Your Payment Didn’t Go Through",
  "mail.paymentFailed.line": "Your latest {price} payment didn’t go through. Update your payment details to keep ReachKit running.",
  "mail.paymentFailed.stops": "Until it goes through, no new page is written or goes live. Pages already live stay live for at least 30 days.",
  "mail.paymentFailed.preheader": "Updating your payment details fixes it.",
  "mail.paymentFailed.action": "Update Payment Details",
  /** `{accessEndsOn}` is the day access ends (`paid_through`), in the customer's zone — SPEC §8's "cancellation (end date)". */
  "mail.cancellation.subject": "Your subscription is cancelled",
  "mail.cancellation.heading": "Your Subscription Is Cancelled",
  "mail.cancellation.preheader": "Nothing more is charged.",
  "mail.cancellation.resume": "Changed your mind? Press Resume my plan in Settings › Account.",
  "mail.cancellation.line": "You keep full access until {accessEndsOn}, and nothing more is charged.",
  "mail.winback.subject": "Your ReachKit settings are still saved",
  "mail.winback.preheader": "Resume and we start writing again.",
  "mail.winback.line": "ReachKit can start writing and publishing pages for your site again: up to {weekPages} pages a week, new or updated, each going live on its own unless you stop it first. €49 a month, cancel any time.",
  "mail.winback.action": "Resume ReachKit",
  "mail.reason.winback": "Sent once, {days} days after your access ended. No more mail follows.",
}) satisfies CopyPartition;
