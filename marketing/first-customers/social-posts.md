# R10: Six LinkedIn and X posts, one finding each

**Audience:** owners of small businesses with a website: local services, shops, hospitality,
professional services, software and creators. Mostly the owner's own network on LinkedIn and X,
from 30 Nov 2026, when outreach starts.
**Message, every post:** "You can see, free, who Google and AI send your buyers to instead of you."
**Call to action, every post:** run the free scan on your own site:
`https://reachkit.app/?ref=linkedin` on LinkedIn, `https://reachkit.app/?ref=x` on X (README ›
Channel links). Nothing else is asked for: no call, no price, no offer.

Each post carries one finding from **our own site's** free report or **our own** live pages,
the only examples we may show (SPEC §1 *Our own report only*, `docs/SPEC.md:87`). None of the six
uses an aggregate figure across stored scans; one may be added only under the conditions below.
Our own site is never presented as a customer.

## Owner to do

- [ ] Edit each post into your own voice before you post it. They are drafts.
- [ ] **On the morning of each post, open `https://reachkit.app/scan/reachkit.app`** and check the
      numbers in that post against it. The report quoted here was scanned on 9 Nov 2026. If it has
      been scanned again, use the new numbers or skip the post; never post a number the report
      no longer shows.
- [ ] Take the screenshots named under each post (they are also part of R9, the proof pack).
      Crop to the card named; leave out the "We read you as" block.
- [ ] Post 3 times a week from the calendar below. You post; nothing here is posted by an agent.
- [ ] Reply to comments yourself, using the replies at the end.

## Rules for every post

| Rule | Why |
|---|---|
| One finding, one ask: the free scan | Simplicity; playbook §3 (R10) |
| Say "up to 7 pages a week, new or updated". Never "a page a day", and nothing that implies a daily count, such as a run of days in a row | SPEC §1 *The pace* (`docs/SPEC.md:94`); `offer.cadence.page` (`src/lib/presentation/copy/keys/offer.ts:36`) |
| Name no rival product. Say "the biggest name in our market" | `offer.md`; `scripts.md` rules |
| No refund, ranking or result promised. Only the setup promise may be said, in its own words (D2, lifted 2026-11-20) | README rule 1; `about.never.promise` (`chrome.ts:414`); Terms §7 (`chrome.ts:197`) |
| No other company's report, ever | SPEC §1 *Our own report only* |
| A figure across many scans only when it is true as stated: no site, business or person named (rivals in AI answers included); at least 20 sites behind every figure and every slice; the population stated as "Of {N} sites scanned with ReachKit between {d1} and {d2}"; the owner's, test and fixture scans and removed domains excluded; the query, date and N kept with the post. Never call the sample "businesses" in general | README › *Aggregate figures across stored scans* |
| Never scan a reader's site for them; they run it | README rule 2 |
| Link with the channel tag; ask every new payer where they heard of us | D7; the landing stores the tag with the scan (#2692), a purchase from `/pricing` reads none (README › Channel links) |

Facts checked on production on 15 Nov 2026 (curl of `reachkit.app/scan/reachkit.app`,
`reachkit.app/how-it-works`, `reachkit.app/about`, `content.reachkit.app` and its sitemap).

---

## Post 1: A tidy website is not a found website

**Finding:** our own site scores 10 of 10 on website basics, and 0 of 10 on Google and 0 of 10 on AI.
Visibility Score 16 of 100, "Invisible".
**Visual:** screenshot of the score card and "How this score is split" (the four bars:
Website basics 10/10, Answers questions 4/10, Google 0/10, AI 0/10).

**LinkedIn**

> I built a tool that checks whether Google and AI can find a business.
>
> Then I ran it on my own site.
>
> Website basics: 10 out of 10.
> Found on Google: 0 out of 10.
> Named by AI: 0 out of 10.
>
> Overall: 16 out of 100. "Invisible."
>
> That's the lesson for every business owner I know: a fast, tidy website is the entry ticket.
> It doesn't mean anyone finds you. Buyers find the businesses whose pages answer their questions.
>
> The scan is free, takes under a minute and needs no account. Run it on your own site and see
> where you stand: https://reachkit.app/?ref=linkedin

**X**

> I ran my own visibility scan on my own site.
>
> Website basics: 10/10
> Google: 0/10
> AI answers: 0/10
>
> A tidy site isn't a found site. Check yours free, under a minute, no account:
> https://reachkit.app/?ref=x

**Evidence:** `reachkit.app/scan/reachkit.app` shows "Visibility Score 16 of 100 Invisible" and
"Website basics 10/10 · Answers questions 4/10 · Google 0/10 · AI 0/10" (scanned 9 Nov 2026).
"free · no account · under a minute" is `landing.hero.assurance` (`report.ts:596`).

---

## Post 2: AI names a few businesses, and the rest are invisible

**Finding:** we asked Google's AI 12 questions a buyer of our kind of product asks. It answered
all 12. It named the biggest name in our market in 3 of 12 answers, and us in 0.
**Visual:** screenshot of the "Who gets your buyers" card ("AI 0 of 12 · AI answers that mention
you"). Blur or crop the rival names if you prefer; the post names none.

**LinkedIn**

> Your buyers don't only search any more. They ask AI: "what's the best ___ for ___?"
>
> And AI doesn't give ten links. It names a few businesses.
>
> Our free report asked Google's AI 12 questions that buyers in our own market ask.
> It answered all 12.
> It named the biggest name in our market in 3 of them.
> It named us in 0.
>
> If you run a bakery, a law firm or an online shop, your buyers ask AI too. The only question
> is whose name comes up.
>
> See who AI names instead of you. Free, under a minute: https://reachkit.app/?ref=linkedin

**X**

> We asked Google's AI 12 questions our buyers ask.
>
> It named the biggest player in our market 3 times.
> Us: 0.
>
> AI names a few businesses. See if it names yours, free:
> https://reachkit.app/?ref=x

**Evidence:** `reachkit.app/scan/reachkit.app`: "We asked Google's AI 12 buyer searches. It
answered 12." and "AI named {rival} in 3 of 12 answers, and you in 0." Card title "Who gets your
buyers" is `report.buyers.title` (`report.ts:876`).

---

## Post 3: The questions nobody on your site answers

**Finding:** the report found 5 questions our buyers ask that no page of ours answers. One of
them is searched 90 times a month, and another site answers it today.
**Visual:** screenshot of "Pages you're missing", page 1 ("What ai search visibility tools are
available?", searched 90 times a month, answered today by another site). Crop the other site's
name.

**LinkedIn**

> The most useful line in my own site's report wasn't the score.
>
> It was this: "We found 5 questions your buyers ask that no page of yours answers."
>
> One of them gets searched 90 times a month. Today another website answers it. Every one of
> those searchers meets them, not us.
>
> Every business has these questions. "How much does a bathroom refit cost?" "Is this café
> dog-friendly?" "Which accountant handles freelancers?" If no page of yours answers them,
> Google and AI send the buyer to someone whose page does.
>
> The free report lists yours, with how often each is searched:
> https://reachkit.app/?ref=linkedin

**X**

> My own site's report: "5 questions your buyers ask that no page of yours answers."
>
> One is searched 90 times a month. Someone else answers it.
>
> Find your missing questions, free: https://reachkit.app/?ref=x

**Evidence:** `reachkit.app/scan/reachkit.app`: "We found 5 questions your buyers ask that no page
of yours answers." (`report.top.offer`, `report.ts:873`) and the "Pages you're missing" list
(`report.missing.title`, `report.ts:846`), page 1 "searched 90 times a month · answered today by"
another site.

---

## Post 4: The free report tells you how to fix it yourself

**Finding:** the report's do-it-yourself steps end with "You don't need ReachKit for any of this."
**Visual:** screenshot of the "Do it yourself, free" block (Let AI in · Write the missing pages ·
Make pages AI can quote).

**LinkedIn**

> A free report that only says "you need us" isn't worth much.
>
> So ours tells you how to fix it yourself. From my own site's report:
>
> 1. Let AI in: check your robots.txt so AI tools can read your site.
> 2. Write the missing pages: answer the buyer's question in the first lines, back it with facts
>    from your own site.
> 3. Make pages AI can quote: turn each heading into a question a buyer asks, with a direct
>    2 or 3 sentence answer under it.
>
> And then, in the report itself: "You don't need ReachKit for any of this."
>
> If you'd rather not do it yourself, that's what we're for. Either way, start with your own
> report, free: https://reachkit.app/?ref=linkedin

**X**

> Our free report ends its fix list with: "You don't need ReachKit for any of this."
>
> Let AI in. Write the missing pages. Make them easy to quote.
>
> Get your own list, free: https://reachkit.app/?ref=x

**Evidence:** `reachkit.app/scan/reachkit.app`, "Do it yourself, free": "Let AI in", "Write the
missing pages", "You don't need ReachKit for any of this.", "Answer the buyer's question in the
first lines.", "Make pages AI can quote", "Turn each heading into a question a buyer asks.",
"Put a direct answer of 2 or 3 sentences under it."

---

## Post 5: Every fact from your own site

**Finding:** our own blog's pages are written with AI from facts on our own site and checked
before they go live. One reads: "Written with AI from 5 facts on reachkit.app, checked against
22 rules before publishing."
**Visual:** screenshot of the top of `https://content.reachkit.app/how-to-rank-on-chatgpt` (title,
date line, the "Written with AI from 5 facts…" line and the short answer).

**LinkedIn**

> The fear with AI-written pages is simple: it makes things up.
>
> Here is a page live on our own site, written by ReachKit. Under the title it says:
> "Written with AI from 5 facts on reachkit.app, checked against 22 rules before publishing."
> The sources are listed at the bottom.
>
> That's the rule for every business we write for: we never invent prices, people or reviews.
> If a fact isn't on your site, it won't be in your pages.
>
> Your result: pages on your own website that answer your buyers' questions in your facts, up
> to 7 a week, new or updated, without you writing a word.
>
> See which questions your site is missing, free: https://reachkit.app/?ref=linkedin

**X**

> A page live on our own site says, under the title:
>
> "Written with AI from 5 facts on reachkit.app, checked against 22 rules before publishing."
>
> No invented prices, people or reviews. Only your facts.
>
> See what your site is missing, free: https://reachkit.app/?ref=x

**Evidence:** `https://content.reachkit.app/how-to-rank-on-chatgpt` (200 on 15 Nov 2026) shows
that line and a Sources list. "We never invent prices, people or reviews. If a fact isn't on your
site, it won't be in your pages." is `setup.business.assurance` (`setup.ts:456`). Pace:
`offer.cadence.page` (`offer.ts:36`).

---

## Post 6: Old pages kept fresh, not just new ones

**Finding:** the same page on our own site was published on 9 Oct 2026 and updated on 9 Nov 2026.
The pace is up to 7 pages a week, new or updated.
**Visual:** screenshot of the page's date line ("published 9 Oct 2026 · updated 9 Nov 2026") and
the `content.reachkit.app` index with its list of recent guides.

**LinkedIn**

> Most business blogs die the same way: three posts in a burst, then nothing for two years.
>
> On our own site, ReachKit writes and publishes the pages itself. Look at this one:
> "published 9 Oct 2026 · updated 9 Nov 2026". A month later it was brought up to date, without
> anyone opening an editor.
>
> That's what you get: up to 7 pages a week, new or updated, on your own website. Each Monday
> an email shows what went live and your totals so far. You can edit or stop any page before it goes
> live, or just let it run.
>
> Start by seeing where you stand. Free, under a minute: https://reachkit.app/?ref=linkedin

**X**

> A page on our own site: "published 9 Oct · updated 9 Nov".
>
> Nobody opened an editor. Up to 7 pages a week, new or updated, live on your own site.
>
> See where you stand first, free: https://reachkit.app/?ref=x

**Evidence:** `https://content.reachkit.app/how-to-rank-on-chatgpt`: "published 9 Oct 2026 ·
updated 9 Nov 2026". Pace and Monday email: `offer.cadence.page`, `offer.cadence.movement`
(`offer.ts:36-37`). Edit or stop: `/how-it-works` ("you can edit or stop any page"; "Each page goes
live 24 hours after it is written, unless you stop it").

---

## Calendar (the first two weeks of outreach)

Mon, Wed and Fri, around 08:30 Berlin time on LinkedIn; the same day on X. Two weeks, one round of
six. Repeat the round once, from Mon 14 Dec, only with fresh numbers from the report on that day.

| Date | Post | Channel tag |
|---|---|---|
| Mon 30 Nov 2026 (outreach starts) | 1. A tidy website is not a found website | `linkedin`, `x` |
| Wed 2 Dec | 2. AI names a few businesses | `linkedin`, `x` |
| Fri 4 Dec | 3. The questions nobody on your site answers | `linkedin`, `x` |
| Mon 7 Dec | 4. The free report tells you how to fix it yourself | `linkedin`, `x` |
| Wed 9 Dec | 5. Every fact from your own site | `linkedin`, `x` |
| Fri 11 Dec | 6. Old pages kept fresh | `linkedin`, `x` |

**What to measure** (Progress table, weekly): free scans and payments tagged `linkedin` or `x`
(stored since #2692; the two queries in `docs/RUNBOOK.md` §8), plus payers who say "LinkedIn" or "X"
in `heard_from`. The deciding number for a
post is replies or direct messages that end in a scan. If a whole round of six brings no scan,
stop the posts and put the time into warm messages instead.

## Replies to likely comments (one to one in the comments; same rules)

| They say | Reply |
|---|---|
| "Can you scan my site?" | "Run it yourself here, it takes under a minute: {link with the channel tag}. Happy to walk you through the result." (README rule 2) |
| "Is my report public?" | "Yes: every free report is listed in our scan library. If you want yours taken down, email remove@reachkit.app." (SPEC §2 *Gallery lists every report*, `docs/SPEC.md:162`; site footer) |
| "What does it cost?" | "The scan and report are free. Writing and publishing the pages is €49 a month, VAT included, cancel any time." (`landing.plan.terms`, `landing.ts:69`) |
| "Will Google penalise AI pages?" | "No. Google has said that using AI to write pages isn't against its rules. What it acts on is pages churned out in bulk just to game search, with nothing new in them, however they were written. ReachKit writes each page from facts on your own site and linked public sources, holds back any page with an invented fact or one that repeats an existing page, and only writes a new page when it has something the top results don't already say." Offer the written answer by message (`scripts.md` §7). Never say "no penalty" or "Google can't detect AI" (seo-master, #2693) |
| "Does this guarantee I rank?" | "No. Google takes weeks to months, and not every page reaches the first page. The Monday email shows your totals so far." (`/how-it-works` "What to expect, when"; Terms §7) |
