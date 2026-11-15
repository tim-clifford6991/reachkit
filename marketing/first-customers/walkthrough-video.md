# R6: The 5-minute report walkthrough (video template)

**Audience:** one owner who has just run their free scan. **Message:** "Here's who gets your buyers,
and the pages that would win them back." **Call to action:** book 15 minutes, or start from the
report. One video per prospect, sent with script 3 in `scripts.md` within 24 hours of their scan.

## Owner to do

- [ ] Record each one yourself (screen plus face bubble; Loom free or any screen recorder).
- [ ] Send it one to one only. Never post a prospect's walkthrough: it shows their report and their
      competitors.
- [ ] Do a test recording on our own site's report first (https://reachkit.app/scan/reachkit.app),
      and keep it private. It is the one report we may show as an example (SPEC §1 *Our own report
      only*, `docs/SPEC.md:87`).

## Rules

- Record only **their** report at `https://reachkit.app/scan/{domain}`, which they ran. Never run a
  scan of their site for them (every scan is a public card on `/scans`, SPEC §2).
- Show their result, not the machinery. Say "pages that answer what your buyers ask", not
  "keywords", "SERP", "schema" or "LLM".
- No promise of a ranking, mention or date. "Google takes weeks to months" is the live line
  (`landing.faq.results.short`, `report.ts:678`).
- The pace is "up to 7 pages a week, new or updated".
- Format: 16:9 screen recording, browser at about 1280 wide, face bubble bottom right. Their domain
  is in the first frame so they know it's for them.

## The template (time codes for a 5-minute video)

| Time | On screen (route and section) | Say (fill the braces from their report) |
|---|---|---|
| 0:00–0:10 | Top of `/scan/{domain}`: their domain and logo | **Hook:** "Hi {name}, this is your report for {domain}. In five minutes you'll see who Google and AI send your buyers to, and what would bring them to you." |
| 0:10–0:40 | The headline: "{domain}: {score}/100, {verdict}" and the line under it (`report.top.title`, `report.top.line`, `report.ts:867–869`) | "Here's the headline. When buyers ask Google or its AI about {category}, they're sent to {rival} most. You came up in {n} of {m}." Point at the split: "{g} of {gTotal} Google searches, {a} of {aTotal} AI answers." |
| 0:40–0:55 | "We read you as" (`report.read.as.title`) | "This is how we read your business: {kind}, {category}, {country and language}. If that's wrong, the pages would be too, so tell me." |
| 0:55–2:00 | *Who gets your buyers*, the AI card (`report.buyers.title`, `report.ai.waffle`, `report.ai.quote`) | "We asked AI {total} questions your buyers ask. It named {leader} in {x} and you in {you}. Here's one real answer, for '{search}': it quotes {who}." Read one line of the quote aloud. |
| 2:00–2:40 | The Google card (`report.google.waffle`, `report.google.most`) | "On Google it's similar. {leader} is on the first page for {x} of {total} searches; you're on {you}. The most searched one, '{search}', about {volume} a month, goes to {holder}." |
| 2:40–3:40 | *Pages you're missing* (`report.missing.title`, `report.ts:846`) | "This is the part I'd care about. These are questions your buyers ask that no page of yours answers. The top one: '{topic}', searched {volume} times a month, answered today by {holder}. Each is a page we'd write and put on your site." |
| 3:40–4:05 | The free first page, opened from "Get your first page free" (`report.offer.free-path`, `report.ts:837`) | "You can read the first one free, right here. It's written from facts on your own site." Scroll a few lines. Skip this row if their report has no first page. |
| 4:05–4:25 | The top one or two site fixes | "Two things on your site worth fixing anyway: {fix 1}, {fix 2}. That's free advice, whatever you decide." |
| 4:25–5:00 | The offer at the foot of the report; then your face full screen | "Here's what I'd suggest. ReachKit writes up to 7 pages a week, new or updated, and publishes them on your site, and each Monday you get an email with what went live and what moved. I'm setting up 50 founding customers myself: €49 a month, VAT included, cancel any time, price locked while you stay. Wave {wave} closes {close date}. The link to book 15 minutes is in my message." |

**On-screen text** (optional, as captions in the recorder):

| Time | Caption |
|---|---|
| 0:00 | Your report: {domain} |
| 0:55 | Who gets your buyers |
| 2:40 | Pages you're missing |
| 4:25 | Book 15 minutes: link in the message |

## If the report is unusual

| Report says | Do |
|---|---|
| They lead ("find you most", `report.top.line.you-lead`) | Say so honestly. The pitch is keeping the lead and the missing pages, not a gap that isn't there |
| "can't find you yet" (0 of {m}) | Lead with *Pages you're missing*; don't dwell on the zero |
| "Not scored", or the scan is still finishing | Don't record yet. Wait for the finished report |
| No *Pages you're missing* rows, or "market too small" | Don't pitch. Thank them and stop: we can't plan pages for a market that small yet (`setup.release.market-too-small`, `setup.ts`) |
| Wrong market read | Say it, and tell them they can correct the market at setup (`setup.market.change`) |

## Evidence

The report's order (headline, score, *Who gets your buyers* over the AI and Google cards, *Pages
you're missing*, the top fixes, then the offer) is SPEC §2 *Report order*. Every phrase in quotes
above is a live copy key in `src/lib/presentation/copy/keys/report.ts` (lines 846–886) or the offer
keys in `offer.ts:36–44`.
