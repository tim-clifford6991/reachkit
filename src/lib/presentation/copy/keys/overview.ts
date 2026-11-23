// src/lib/presentation/copy/keys/overview.ts — Overview's sentences, in the registry's voice.
import type { CopyPartition } from "../registry.ts";

export const OVERVIEW_COPY = Object.freeze({
  "place.overview.weekly-presence.chart": "No Monday check yet. The line starts with the first one.",
  "place.overview.weekly-presence.week": "Not checked this week yet. Next check: Monday.",
  "place.overview.weekly-presence.partial-week": "Part of this week wasn’t checked. What was checked shows its date.",
  // ── The tiles.
  "overview.tile.ai-answers.label": "AI",
  // The set's own two lines on the pages tile, both unbracketed and so
  // approved (11a): the badge beside the count, and the dim line under it.
  // Both numbers are slots — the ranking count is measured and the three
  // weeks are `TOO_EARLY_WEEKS`, which is a pin and is never re-written.
  "overview.tile.pages.ranking": "{count} already showing on Google",

  // §4.5's "goal: 6", with the number left to `GOAL_VALUES`.
  "overview.delta.up": "▲",
  "overview.delta.down": "▼",

  // ── How far ahead each rival is.
  "overview.rivals.line.shrinking": "A line going down means the gap is closing.",
  // §6.6's own "render the rivals' absolute numbers with `you: 0`" — the
  // word that names whose number the cold-start arm shows beside the rivals'.
  "overview.rivals.you": "you",
  // The cold-start arm's line, and the one key on this screen whose value is
  // constrained by what it must **not** say: nothing is shrinking yet, so it
  // can never be `overview.rivals.line.shrinking` (REQ-041 c9).
  "overview.rivals.line.absolute": "Each line is a competitor’s own count beside yours.",

  // ── This week.
  "overview.week.title": "This Week",
  // SPEC §4 (2026-09-20, #914): *Plan* is the calendar's on-screen name;
  // the key still says where the link goes.
  "overview.week.calendar-link": "See Why Each Page →",
  "overview.week.day.done": "done",
  "overview.week.day.today": "today",
  "overview.week.day.to-come": "next",

  // ── The alerts, and the one remainder line.
  // A page in review is the next page of the daily autopilot, not something
  // to read before it can go out (owner 2026-10-09, issue 1362).
  "overview.alert.pending-veto": "{title} goes live on its own",
  "overview.alert.pending-veto.action": "Read or Edit",
  "overview.alert.needs-you": "{title} needs you before it can go out",
  // "Reconnect" is unbracketed in the approved set (ruling 11a) — the word
  // on the accent panel's outline pill. The alert's own title and the line
  // saying what broke are bracketed there; their words below are the
  // owner's (#460).
  "overview.alert.needs-you.action": "Reconnect WordPress",
  // The cause: "[cause line — owner's]" in the set, written by the owner
  // (#460). One short line
  // under the title, never a paragraph (§2.5's dim line).
  "overview.alert.needs-you.cause": "We couldn’t put this page on your site.",
  // Issue 880: the word for a page that is not waiting on a destination —
  // one the writing rules stopped, or a step that could not run. It is read
  // and resolved on the page itself, which is where this alert already
  // points; "Reconnect" above is for a delivery the founder must fix.
  // Drafted under issue 759's ruling. The cause line for each of the five
  // causes is `publish.needs-you.*`, stated from the page's own record.
  "overview.alert.needs-you.read": "Read the Page",
  // The veto panel's own line, unbracketed in the set and therefore
  // approved. `left` is how long the window has to run, from the draft's
  // own stored `veto_deadline` (issue 794) — never a number typed here.
  "overview.alert.pending-veto.due": "goes live in {left} unless you stop it",
  // A page in review with no veto window running: nothing publishes it on
  // a clock, so the line states no countdown. Drafted (issue 794); the
  // owner corrects the wording.
  "overview.alert.pending-veto.no-window": "has no go-live time yet",
  "overview.alert.overflow": "{remaining} more in This week.",
  // A technical issue the customer fixes (SPEC §9): its title is the check's own, its line the severity word.
  // The control's word and the count of the issues not shown are owner-owed.
  "overview.alert.site-issue.action": "See the Fix",
  "overview.alert.site-issue.overflow": "{remaining} more in Site Fixes.",
  /* ── Technical issues, the account's view of the checks it fixes (issue 1550, drafted) */
  "overview.issues.title": "Site Fixes",
  "overview.issues.lead": "Optional. Whoever runs your website can make them; ReachKit can’t.",
  "overview.issues.found": "Found {date}.",
  "overview.issues.empty": "Nothing to fix. We read {count} pages on {date} and check again on {next}.",
  "overview.issues.unscanned": "Your site hasn’t been checked yet. What the first check finds shows here.",
  "overview.issues.unreadable": "This list didn’t load. Try again in a minute.",
  "overview.issues.site": "Applies to the whole site.",
  "overview.issues.seconds": "{seconds} s",
  "overview.issues.slow-note": "Each took {seconds} seconds or more, twice.",
  "overview.issues.unnamed": "This check counted pages with a problem but kept no list of them.",
  "overview.issues.read": "Your site, {count} pages read",
  "overview.issues.fine": "pages with nothing to fix",
  "overview.issues.affected": "{pages} pages have a problem.",
  "overview.issues.affected.one-page": "One page has a problem.",
  "overview.issues.ours": "Your ReachKit pages are checked before they go live.",
  "overview.issues.share": "{count} of {over} pages",
  "overview.issues.fix": "The fix:",
  "overview.issues.pages": "The {count} Pages",
  "overview.issues.pages.one": "The Page",
  "overview.issues.back": "Back to Site Fixes",
  "overview.alerts.empty": "Nothing needs you today.",

  // ── The one supply statement Overview may make, resolved in this order.
  "overview.supply.exhausted": "Nothing is left worth writing. Monday’s check looks for more.",
  // issue 784 (issue 765's distinction, 2026-09-16): zero supply over a market that
  // was never measured is not "no pages left". Drafted under issue 759's ruling.
  "overview.supply.unmeasured": "We haven’t found enough searches for your market yet. Name a broader one in Settings and we’ll check again.",
  // issue 855: zero supply because the pass that should have filled it stopped
  // on a ceiling. Drafted under issue 759's ruling.
  "overview.supply.measuring": "We’re still checking your market, so no pages are planned yet. Nothing is needed from you.",
  "overview.supply.short": "Less than a week of pages is left. Monday’s check looks for more.",
  // Issue 1559: the depth is a week and its spares, not a month. Drafted.
  "overview.supply.first-arrival": "Your first check found less than a week of pages. We look for more every Monday.",

  // 2026-09-07, issue #205 — the account a broken series puts on its own
  // break. REQ-071 c12/c13 forbid drawing a difference across a date the
  // site's answers changed, so every week-spanning form on this screen
  // stops at one; these are the lines that say which answer changed. One
  // key per `ChangeKind` and no default: a change this screen cannot name
  // is a change it must not stand a nameless rule for.
  //
  // The marker they name is a value the customer chose (a domain, a
  // category), and the value itself renders beside the line as a value
  // rather than as voice — §2.3's rule, the same one the draft screen's
  // matched-entry line follows.
  "overview.change.domain": "Website changed. Figures start again from here.",
  "overview.change.category": "Market changed. Your searches start again from here.",
  "overview.change.rivals": "Competitors changed. Comparison starts again from here.",
  "overview.change.locale": "Country or language changed. Figures start again from here.",
  // REQ-071 c13's other half: a card that compares two readings has to say
  // which span it compared over when a change falls inside it, rather than
  // quietly comparing across one.
  "overview.comparison.window": "Shown from {since}, when your settings changed. Older figures are kept apart.",

  // The detail screens' names.
  "overview.tab.rivals": "Competitors",

  // ── The page waiting for review.
  // A page in review with no window running: nothing publishes it on a
  // clock, so the line states no time.
  "overview.waiting.waits": "Its go-live time isn’t set yet.",
  // The four arms of the reason, one per shape of evidence the opportunity
  // carries. Never composed at a call site: the screen picks the arm and the
  // registry says the sentence.
  "overview.waiting.why.answered-by": "{volume} people a month search “{search}”. {rival} shows up, and you don’t.",
  "overview.waiting.why.not-high-enough": "{volume} people a month search “{search}”. Your page for it isn’t high enough yet.",
  // The search was chosen but its demand was never read back: the screen
  // states what the page is for and claims no number (REQ-004).
  "overview.waiting.why.search": "This page is written to win “{search}”.",
  // A Fix page has no market target at all (SPEC §9).
  "overview.waiting.why.fix": "This page fixes something on your own site that is holding your pages back.",
  "overview.waiting.badge.new": "New page",
  "overview.waiting.badge.update": "Update",
  // The screen's second control. "Stop this page" is the product's word on
  // every screen and in every mail (SPEC §4 · §7, 2026-09-20); "veto" stays
  // internal.
  "overview.waiting.stop": "Stop This Page",
  // Every action answers (SPEC §4, 2026-09-20): the two words the control
  // says back, on the screen, in place of silence.
  "overview.waiting.stopped": "Stopped. This page won’t go live.",
  "overview.waiting.stop-refused": "Not stopped: this page may already be going live. You can still stop it in This Week.",

  // ── This week: the word a day carries when nothing is scheduled on it.
  // The five stage words are the calendar's own (`calendar.stage.*`).
  "overview.week.day.no-page": "No page",

  // ── The search words Competitors and On Google share: the head's date, the columns, and what is done this week.
  "overview.search.measured": "Checked {on}.",
  "overview.search.column.search": "Search",
  "overview.search.column.volume": "Searches a month",
  // The phone shape has no column heads, so a volume says what it counts.
  "overview.search.a-month": "a month",
  "overview.search.status.live": "Page is live",
  "overview.search.show-all": "Show All {total} Searches",
  "overview.tab.eyebrow": "Overview · week {n}",
  "overview.means": "What this means",
  "overview.search.doing.today": "Goes live today",
  "overview.search.doing.page": "Page {day}",
  "overview.search.doing.update": "Update {day}",
  "overview.search.doing.climbing": "Climbing, so we wait",

  // ── On Google's detail (plates O4, O8): each live page on its own search, its place and who leads it.
  "overview.google.title": "Google",
  "overview.google.lead": "A page counts once Google has added it or shown it in a search. Most new pages take weeks.",
  "overview.google.filter.label": "Show pages",
  "overview.google.filter.all": "All {n}",
  "overview.google.filter.on": "On Google {k}",
  "overview.google.filter.not-yet": "Not yet {m}",
  "overview.google.col.search": "Your Page’s Search",
  "overview.google.col.volume": "Searches a Month",
  "overview.google.col.place": "Place",
  "overview.google.col.rival": "Best Competitor",
  "overview.google.col.doing": "What We’re Doing",
  "overview.google.rival": "{name}, place {n}",
  // A dash alone reads as "none"; these say why the cell is empty.
  "overview.google.unread.sr": "Not read this week",
  "overview.google.unmeasured.sr": "Not measured",
  "overview.google.caption": "Place 1 is the top result, not counting maps.",
  "overview.google.none": "No page is live yet, so Google has nothing of yours to show.",
  "overview.google.none.next": "Your first goes live {day} at {time}.",
  "overview.google.empty.showing": "No page is on Google yet. Most new pages take a few weeks.",
  "overview.google.empty.due": "Google is first checked {date}. Until then, All shows your live pages.",
  "overview.google.empty.not-yet": "Every live page is on Google.",
  "overview.google.line.added": "Added by Google. Not shown in a search yet.",
  "overview.google.line.unchecked": "Not checked yet. Next check {date}.",
  "overview.google.unread": "We couldn’t check Google this week. These are the places from {date}.",

  // ── Linked by AI's detail (plate O3): each page's question, one mark per engine asked, and who else the answer named.
  "overview.ai.lead": "{k} of {n} AI answers mentioned or linked you in the last {weeks} weeks.",
  "overview.ai.caption": "Your pages’ questions in AI answers",
  "overview.ai.col.question": "Question",
  "overview.ai.col.page": "Your Page",
  "overview.ai.col.also": "Also Mentioned",
  // The wording never appears without the search it was phrased from.
  // A phone's engine line: "ChatGPT:" before its mark.
  "overview.ai.engine": "{engine}:",
  "overview.ai.from": "from {search} · last asked {date}",
  "overview.ai.also.none": "no one else",
  // A report from before rivals were kept: not recorded is not "no one".
  "overview.ai.also.unrecorded.sr": "Not recorded that week",
  "overview.ai.none": "We ask about each page’s question on the Monday after it goes live. First check {date}.",
  "overview.detail.show-all.questions": "Show All {n} Questions",
  "overview.detail.show-all.searches": "Show All {n} Searches",
  // Against Competitors' detail (plate O5): competitors are read on Google's first page, the site to place 100.
  "overview.rivals.lead": "Your {m} main searches on Google, you beside each competitor. Bold is Google’s first page.",
  "overview.rivals.failed": "We couldn’t check Google this week. These are the places from {date}.",
  "overview.rivals.first": "First page on",
  "overview.rivals.first.you": "{n} of {m}",
  "overview.rivals.started": "You started at {k}",
  "overview.rivals.col.search": "Search",
  "overview.rivals.col.volume": "Searches a Month",
  "overview.rivals.col.you": "You",
  "overview.rivals.col.doing": "What We’re Doing",
  "overview.rivals.off-page.sr": "Not on page 1",
  "overview.rivals.off-top.sr": "Not in the top 100",
  "overview.rivals.map": "Map",
  "overview.rivals.caption.map": "Map means Google’s map listings at the top of the page.",
  "overview.rivals.caption": "We read Google’s first page for competitors, and your place down to 100. A dash means not on page 1.",
  // Questions with the business's own name are answered about it, so they are not counted.
  "overview.rivals.ai": "AI answers that mentioned each, last {w} weeks: {list}, of {m}. Questions with your business name are left out.",
  // A pass no check passed yet: its count is the first, with no rate.
  "overview.tile.mention-rate.first": "First check. A rate shows after {weeks} weeks.",
  "overview.prompts.share.you": "You",
  // The hosted pages' readers, on a live page's screen.
  "overview.answers.visits.label": "Visits from AI",
  "overview.answers.who.title": "Which AI Read and Sent Visits",
  "overview.answers.who.reads": "Reads",

  // ── 2026-09-20 (#908, #921): the AI engines that read the hosted pages.
  // ChatGPT is `ai-answers.engine.chatgpt` — a second spelling of it would be
  // the second place the product speaks (ADR-001).
  "overview.blog.engine.perplexity": "Perplexity",
  "overview.blog.engine.claude": "Claude",
  "overview.blog.engine.gemini": "Gemini",
  "overview.blog.engine.copilot": "Microsoft Copilot",
  // A card that was measured and counted no tracked rival anywhere says so
  // once, in place of a row of empty bars, and the rivals neither card
  // counted are named under them (SPEC §4, 2026-10-09). Drafted (issue
  // 759); the owner corrects the wording.
  "overview.rivals.first-page.none": "None of your competitors is on Google’s first page here.",
  "overview.rivals.first-page.none.holders": "None of your competitors is on Google’s first page here. Most often there: {holders}.",

  // A card whose reading the pass never took. It claims nothing about the
  // rivals; it says what is true of the measurement.
  "overview.rivals.card.unmeasured": "Not checked yet. The first Monday check fills this in.",

  // What ReachKit is doing about one of the twelve; the site already on page 1 with nothing planned is "Page is live".
  "overview.rivals.status.in-review": "Page scheduled",
  "overview.rivals.status.up-next": "Up next",
  "overview.rivals.status.needs-page": "Needs a page on your main site",
  "overview.rivals.status.too-big": "Too hard for now",

  // SPEC §5 (2026-09-20): Overview while the address waits for its DNS
  // record, as board OverviewDNS draws it. No line names a go-live time:
  // none is true until it is live (Q11). Drafted (#759); the PR names each.
  // No day is known where the address's start was not stored: the screen's name alone.
  "overview.connect.eyebrow.plain": "Overview",
  "overview.connect.day": "Overview · day {n}",
  "overview.connect.head": "Your Pages Wait for Your Website",
  "overview.connect.head.ready": "Your First Page Is Ready",
  "overview.connect.lead": "They go live once your website is connected. Everything else runs on its own.",
  "overview.connect.lead.ready": "It goes live once your website is connected.",
  "overview.connect.eyebrow": "Needs you",
  "overview.connect.title": "Add One Setting to Your Domain",
  "overview.connect.step.open": "Open Your Domain Settings",
  "overview.connect.step.open.line": "Where you bought {domain}.",
  "overview.connect.step.paste": "Paste the Three Values",
  "overview.connect.step.rest": "We Do the Rest",
  "overview.connect.step.rest.line": "Your pages appear on {host}.",
  "overview.connect.copy.type": "Copy the type",
  "overview.connect.copy.name": "Copy the name",
  "overview.connect.copy.value": "Copy the value",
  "overview.connect.check": "Check Connection Now",
  "overview.connect.guide": "Step-by-Step for Your Domain Host →",
  "overview.connect.checked": "Checked {time}: not found yet.",
  "overview.connect.unchecked": "Not found yet.",
  "overview.connect.hourly": "We check every hour. It can take a few hours.",
  "overview.connect.other": "Other ways to connect",
  "overview.connect.wordpress": "On WordPress? Connect with an app password instead.",
  "overview.connect.wordpress.link": "Connect WordPress →",
  "overview.connect.wordpress.action": "Connect WordPress",
  "overview.connect.later": "The setting is also in your mail, to add later from a computer.",
  "overview.connect.page.eyebrow": "Ready to go live",
  "overview.connect.page.read": "Read or Edit It →",
  "overview.connect.progress": "Progress shows here once your first page is live.",

  // SPEC §4 (2026-09-20, #908), issue 912 — the first day after setup.
  //
  // "Overview shows the pass's named steps (done / now / next) in the hero
  // and skeletons for the week; it fills in when the pass ends."
  //
  // All three are **issue 912's own drafted wording, byte for byte**. The
  // owner may correct them; they are named in the pull request.
  //
  // The fourth sentence that issue drafts — "First measured Monday
  // {date}." — is deliberately **not** here: the rule it states ("a number
  // not yet measured is an em-dash with the date it will be") is already
  // shipped and already approved, as `overview.tile.score.first-due`
  // ("first measurement due {due}", S13 · REQ-040 c7). Adding a second
  // sentence for one fact would be two wordings of it on one screen, and
  // replacing an owner-approved string with a drafted one is not this
  // issue's to do.
  "overview.first-day.choosing": "We’re choosing a first page you can win.",
  "overview.first-day.mail": "We’ll email you when it’s written. You can edit or stop it before it goes live.",
  "overview.first-day.week": "Your week is planned when the first check finishes.",

  /* ── The owner's cost page (issue 1478, drafted) ──────────────────── */
  // Owner-only: `/app/costs` answers a 404 to every other account. No
  // figure here is a customer's, and no vendor name reaches a customer.
  "overview.costs.title": "Costs",
  "overview.costs.eyebrow": "Owner only",
  "overview.costs.lead": "The seven UTC days to {today}.",
  "overview.costs.unreadable": "The ledger could not be read just now. Nothing is lost; open this page again in a minute.",
  "overview.costs.stat.week": "This week",
  "overview.costs.stat.estimated.of": "estimated, our price list",
  "overview.costs.stat.billed.of": "billed, on {billed} of {calls} calls",
  "overview.costs.stat.today": "Today against the cap",
  "overview.costs.stat.today.cap": "of €{cap}",
  "overview.costs.stat.today.of": "warning at €{warn}",
  "overview.costs.cents": "{cents}¢",
  "overview.costs.eur": "€{eur}",
  "overview.costs.share": "€{eur} · {share}%",
  "overview.costs.unbilled": "Not billed",
  "overview.costs.unreported": "Not reported",
  "overview.costs.col.site": "Site",
  "overview.costs.col.day": "Day",
  "overview.costs.col.estimated": "Estimated",
  "overview.costs.col.billed": "Billed",
  "overview.costs.col.month": "A month, against €{price}",
  "overview.costs.col.activity": "Activity",
  "overview.costs.col.failed": "Failed or timed out",
  "overview.costs.col.recorded": "Recorded",
  "overview.costs.col.vendor-billed": "Vendor billed",
  "overview.costs.col.gap": "Gap",
  "overview.costs.col.judged": "Judged",
  "overview.costs.col.cap": "Against €2",
  "overview.costs.week.title": "Each site this week",
  "overview.costs.week.note": "A month is this week × {weeks} plus a share of fixed costs, against €{net} net. A free scan counts to the site it became.",
  "overview.costs.week.month": "Month vs €{price}",
  "overview.costs.week.sub": "{estimated} est. · {billed} billed",
  "overview.costs.week.sub.unbilled": "{estimated} est. · not billed",
  "overview.costs.week.empty": "Nothing was spent this week.",
  "overview.costs.days.title": "Each site, each day",
  "overview.costs.days.sub": "One row per site and day.",
  "overview.costs.activities.title": "This week by activity",
  "overview.costs.activities.sub": "Writing, measuring, scans and checks.",
  "overview.costs.vendors.title": "Against the vendors",
  "overview.costs.vendors.sub": "Our estimate against each vendor's bill.",
  "overview.costs.vendors.note": "Recorded is the ledger and the box: billed where the vendor said, estimated where not. Vendor billed is the vendor's own account for that UTC day; it is read the day after.",
  "overview.costs.vendors.no-ai": "Anthropic's own bill is not read, so AI spend is our estimate. The deployment needs an admin key to read it.",
  "overview.costs.cap.title": "The €2 a day",
  "overview.costs.cap.summary": "{over}, {warn}",
  "overview.costs.cap.over-days.one": "1 day over",
  "overview.costs.cap.over-days.other": "{count} days over",
  "overview.costs.cap.warn-days.one": "1 day past the warning",
  "overview.costs.cap.warn-days.other": "{count} days past the warning",
  "overview.costs.cap.line": "cap €{cap}",
  "overview.costs.cap.warn-line": "warning €{warn}",
  "overview.costs.cap.key.line": "solid line: cap €{cap}",
  "overview.costs.cap.key.warn-line": "dashed line: warning €{warn}",
  "overview.costs.cap.table": "Show the days as a table",
  "overview.costs.cap.ok": "Under",
  "overview.costs.cap.warn": "Past €1.50",
  "overview.costs.cap.over": "Over €2",
  "overview.costs.fixed.title": "Fixed costs, {month}",
  "overview.costs.fixed.sub": "Hosting, mail and the rest, per month.",
  "overview.costs.segment.free": "Free scans",
  "overview.costs.segment.smoke": "Smoke tests",
  "overview.costs.segment.test": "Test domains",
  "overview.costs.segment.box": "Box tests",
  "overview.costs.activity.free_scan": "Free scan",
  "overview.costs.activity.onboarding": "First deep pass",
  "overview.costs.activity.weekly": "Weekly pass",
  "overview.costs.activity.topup": "Weekly top-up",
  "overview.costs.activity.draft": "Pages",
  "overview.costs.activity.rescore": "Later deep pass",
  "overview.costs.activity.smoke": "Smoke test",
  "overview.costs.activity.test": "Test domain",
  "overview.costs.activity.box": "Box test",
  "overview.costs.vendor.dataforseo": "DataForSEO",
  "overview.costs.vendor.anthropic": "Anthropic",
  "overview.costs.vendor.vercel": "Vercel",
  "overview.costs.vendor.supabase": "Supabase",
  "overview.costs.vendor.jobs": "Job platform",
  "overview.costs.vendor.resend": "Resend",
  "overview.costs.vendor.stripe": "Stripe fees",
  // ── Today's page and the ladder (owner E4, 2026-10-19; board Main): each step is the stored reading's own, drafted.
  "overview.today.eyebrow": "Goes live today at {time}",
  "overview.today.eyebrow.tomorrow": "Goes live tomorrow at {time}",
  "overview.today.eyebrow.on": "Goes live {day} at {time}",
  "overview.today.stop-note": "Stop: it won’t go live. Tomorrow’s page is not affected.",
  // A page published since the last reading is left out of each step's count.
  "overview.ladder.unread": "{k} not checked yet",
  // ── The head, this week's pages, the site-fix line and the states without
  // a today card (board Main). Drafted (#759), the owner corrects them.
  "overview.head.eyebrow": "Week {n} · {day}",
  "overview.head.title": "Nothing Needs You This Week",
  "overview.head.lead.chosen": "This week’s {n} were picked this morning.",
  "overview.head.lead.chosen-on": "This week’s {n} were picked on {weekday}. Checked {date}.",
  "overview.head.lead.week1": "Your first {n} were picked on {weekday}. Google and AI are first checked {date}.",
  "overview.head.first-live": "Your first page went live {date}.",
  "overview.week.pages": "This Week’s {n} Pages",
  "overview.week.summary": "{live} live, {left} to come",
  "overview.week.next": "Next Monday, {date}, we pick the next {n}.",
  "overview.fixes.line": "{n} fixes for your own site.",
  "overview.fixes.line.one": "One fix for your own site.",
  "overview.fixes.optional": "Optional.",
  "overview.fixes.see": "See the Fixes →",
  "overview.today.live": "Today’s page went live at {time}.",
  "overview.paused.line": "Publishing is paused. Your pages are kept.",
  "overview.paused.action": "Turn Publishing On",

  // ── Overview's four tiles (owner, 2026-11-20, #2982). A week down is information, never an alarm.
  "overview.tiles.label": "Your results",
  "overview.tile.pages.name": "Pages Live",
  "overview.tile.pages.of": "of {total} published",
  "overview.tile.pages.none.of": "None live yet",
  "overview.tile.pages.none.change": "First page goes live {day}",
  // "Up to": a planned day can still be stopped or skipped.
  "overview.tile.pages.coming": "Up to {n} more this week",
  "overview.tile.google.name": "Pages on Google",
  "overview.tile.google.of": "of {m} live",
  "overview.tile.google.of.unchecked": "of {m} live · {u} not checked yet",
  "overview.tile.google.shown": "Shown {n} times in 28 days",
  "overview.tile.google.shown.one": "Shown once in 28 days",
  "overview.tile.google.shown.none": "Not shown in a search in 28 days",
  "overview.tile.google.visited": "{c} visited by Google · Google’s counts start {date}",
  "overview.tile.google.visited.not-in": "{c} visited by Google · Google’s counts are not in yet",
  "overview.tile.google.counts-start": "Google’s counts start {date}",
  "overview.tile.google.not-in": "Google’s counts are not in yet",
  "overview.tile.google.no-console": "Google’s counts need Search Console",
  "overview.tile.google.none.of": "No live pages yet",
  "overview.tile.ai.name": "AI Answers Mentioning You",
  "overview.tile.ai.of": "of {n} answers, last {weeks} weeks",
  "overview.tile.ai.read": "AI apps read {x} of your pages in 28 days",
  "overview.tile.ai.read.none": "No AI app read your pages in 28 days",
  "overview.tile.visits.name": "Visits to Your Pages",
  "overview.tile.visits.of": "visits in the last 28 days",
  "overview.tile.visits.since": "visits since {date}",
  "overview.tile.visits.due": "Counting starts when your first page goes live.",
  "overview.tile.visits.wordpress": "We can’t see visits on WordPress sites.",
  "overview.tile.visits.clicks": "{c} clicked through to you",
  "overview.tile.visits.clicks.one": "1 clicked through to you",
  "overview.tile.visits.clicks.none": "No clicks through to you yet",
  "overview.tile.unread.visits": "visits",
  "overview.rivals.start": "Starting point, scan {date}",
  "google.rivals.title": "Against Competitors",
  "google.rivals.line": "First page on {k} of {m} · {competitor} {n}",
  "google.rivals.line.alone": "First page on {k} of {m}",
  "google.rivals.all": "See All {m} Against Competitors",
  "overview.tile.see": "See Details",
  "overview.tile.change.up": "Up {n} on last week",
  "overview.tile.change.down": "Down {n} on last week",
  "overview.tile.change.same": "Same as last week",
  // The change compares only the searches both weeks checked; this says how many were swapped.
  "overview.tile.change.moved": "{change} · {n} searches changed",
  "overview.tile.change.moved.one": "{change} · 1 search changed",
  // The first count is a starting point, never "+n".
  "overview.tile.change.first": "First count, {date}",
  "overview.tile.change.unread": "We couldn’t check {what} this week.",
  "overview.tile.unread.ai": "AI answers",
  "overview.tile.due.of": "Not counted yet",
  "overview.tile.due.change": "First check {date}",
  "overview.tile.due.sr": "Not counted yet",
  "overview.tile.short.pages": "Pages",
  "overview.tile.short.google": "Google",
  "overview.tile.short.ai": "AI",
  "overview.tile.short.visits": "Visits",
  "overview.tiles.how.title": "What These Numbers Count",
  "overview.tiles.how.pages": "Pages Live: our pages on your site now, out of every page we have published.",
  "overview.tiles.how.google": "Pages on Google: live pages Google has added or shown in a search. “Shown” is how often Google showed them in the last 28 days.",
  "overview.tiles.how.google.no-console": "Without Search Console, we only see the searches we check ourselves.",
  "overview.tiles.how.ai": "AI answers mentioning you: answers that name or link your site. We ask AI your buyers’ questions over {weeks} weeks, leaving out ones that name you.",
  "overview.tiles.how.ai.read": "AI apps read: your pages an AI app opened to answer someone, in the last 28 days.",
  "overview.tiles.how.visits": "Visits from Google, AI apps and other sites to the pages we host. AI reading your pages is counted on the AI tile, not here. Some apps hide where visitors came from, so the real number can be higher.",
  "overview.tiles.how.change": "Each change compares with the week before. A week we couldn’t check is a gap, never a 0.",
  "overview.detail.checked": "Checked {date}",

  // ── The AI mark and the place words every Overview detail states.
  "overview.mark.links": "Links to you",
  "overview.mark.mentions": "Mentions you",
  "overview.mark.none": "Doesn’t mention you",
  "overview.mark.unchecked": "Not checked",
  "overview.place.up": "Place {n}, up {k}",
  "overview.place.down": "Place {n}, down {k}",
  "overview.place.new": "Place {n}, new this week",
  "overview.place.same": "Place {n}, same for {k} weeks",
  "overview.place.gsc": "About place {n}, from your Search Console",
  "overview.place.none": "Not in results yet",
}) satisfies CopyPartition;
