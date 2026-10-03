# D19's tracked buyer prompts — the cost, measured (issue 1162)

Run 2026-10-03 by `node scripts/d19-cost.mjs --run`. Rewritten by that command; the arithmetic below is the script's, from the vendors' own reported cost of each call. Nothing in the product changed: no score, no copy, no database row.

**The run spent 36.25¢** of the 150¢ the owner allowed (250 vendor tasks, 50 Haiku reads).

## What was run

- **The set.** Templates over the structured market (`scripts/d19-cost/markets.json`, in the shape of `sites.market`): 5 category, 7 use-case with a constraint, 4 persona, 4 comparison, 3 problem, 2 branded.
- **The pre-check.** Each prompt asked once on Google AI Mode; Haiku 4.5 lists the brands the answer names; a prompt whose answer names none is dropped. Paid once per prompt, not weekly.
- **The measure.** Every kept prompt on 2 engines (Google AI Mode, ChatGPT) × 2 runs, on the standard queue a weekly pass uses. Run 2 was posted after run 1 was collected.
- **Named** is the site's name or domain in the answer's text; **linked** is one of its pages among the answer's cited addresses.

## Cost per call, as the vendor reported it

| Call | Price book | Measured, per call | Calls |
|---|---|---|---|
| Google AI Mode, standard queue | 0.06¢ | 0.12¢ | 150 |
| ChatGPT scraper, standard queue | 0.12¢ | 0.12¢ | 100 |
| Haiku reading one pre-check answer | — | 0.12¢ | 50 |

## Cost per site

| | reachkit.app (subject) | plausible.io (control) |
|---|---|---|
| Prompts generated | 25 | 25 |
| Kept by the pre-check | 25 | 25 |
| Dropped: the answer named no brand, or there was no answer | 0 | 0 |
| Pre-check, once: AI Mode | 3.00¢ | 3.00¢ |
| Pre-check, once: Haiku | 3.31¢ | 2.94¢ |
| Asks in one week (kept × 2 engines × 2 runs) | 100 | 100 |
| …that came back answered | 100 of 100 | 100 of 100 |
| **Weekly cost** | **12.00¢** | **12.00¢** |

One kept prompt costs **0.48¢ a week** (2 × AI Mode + 2 × ChatGPT). A full set of 25 is **12.00¢ a week**; the issue's upper size of 40 is 19.20¢.

The pre-check is 0.24¢ a prompt, once: 6.12¢ when a site's set is first built, and 0.09¢ a week for a fifth of the set rotating each quarter. It dropped 0 of 50 prompts.

Collecting a queued task is free. AI Mode's `task_get` repeats the task's cost in its own `cost` field; the account balance did not move across one, so only the post is counted.

## Against the 40¢ weekly cap

The measured rows are this run's. The other rows are the price book's pins (`src/lib/config/constants.ts`), not a reading of the production ledger: this run read no database, so what a real weekly pass settles at is not in this table.

| Weekly line | Cents | Source |
|---|---|---|
| The 12 SERPs, standard queue | 0.72¢ | price book |
| D19: 25 prompts × 2 engines × 2 runs | 12.00¢ | measured |
| D19: the quarter's rotation, pre-checked | 0.09¢ | measured |
| **The three together** | **12.81¢** | |
| **Left of the 40¢ cap** for everything else a weekly pass buys | **27.19¢** | |

What else a weekly pass buys today, and what each option would move:

| Line | Cents | Source |
|---|---|---|
| LLM Mentions: the flat request, then up to 100 rows | 10.00¢–20.00¢; the cap is checked against 20.00¢ | price book; 10¢ for 0 rows on reachkit.app, 2026-10-02 |
| The twelve asked on the two engines, which D19 replaces | 2.16¢ ledgered; 2.88¢ at the measured prices | price book, measured |
| Up to twelve page questions: a SERP and the two engines each | 2.88¢ ledgered; 3.60¢ at the measured prices | price book, measured |
| With LLM Mentions' 20.00¢ still reserved, what is left for the rest | 7.19¢ | |
| D19 at 1 run instead of 2 | 6.00¢ | measured |
| D19 at 40 prompts | 19.20¢ | measured |

**The price book is wrong about AI Mode.** The vendor charged 0.12¢ for a standard-queue AI Mode task; `PRICE_BOOK.AI_MODE_STD_C` is 0.06¢. Every AI Mode ask a paid pass makes on the standard queue is ledgered at 50% of its cost. The ChatGPT pin matched.

## What the samples showed

Unbranded prompts only; the two branded prompts are reported apart, as D19 rules. The band is Wilson's 95% interval on one week's samples; the product would report four weeks, about four times the samples.

| | reachkit.app | plausible.io |
|---|---|---|
| Unbranded samples | 92 | 92 |
| Named or linked | 0 | 54 |
| Mention rate, with its band | 0% (0–4%) | 59% (48–68%) |
| Branded samples naming or linking it | 8 of 8 | 8 of 8 |
| Own pages cited (distinct) | 2 | 19 |
| Run 1 and run 2 agree on named/not, same prompt and engine | 50 of 50 | 42 of 50 |
| Run 1 and run 2 returned the identical text | 0 of 50 | 0 of 50 |

## reachkit.app — the set

| # | Kind | Prompt | Words | Pre-check: brands named | AI Mode 1 | AI Mode 2 | ChatGPT 1 | ChatGPT 2 |
|---|---|---|---|---|---|---|---|---|
| 1 | category | What are the best AI discovery and search visibility tools right now, and what is each one good at? | 19 | 14: ChatGPT, Perplexity, Claude, Gemini, … | — | — | — | — |
| 2 | category | Which AI answer visibility platforms do people actually recommend this year? | 11 | 7: Otterly.ai, Peec AI, Peak AI, ZipTie, … | — | — | — | — |
| 3 | category | Which search discoverability platforms do people actually recommend this year? | 10 | 11: ChatGPT, Perplexity, Google Gemini, Claude, … | — | — | — | — |
| 4 | category | Which AI and search ranking platforms do people actually recommend this year? | 12 | 7: Perplexity AI, ChatGPT Search, Google AI Mode, Kagi, … | — | — | — | — |
| 5 | category | I am new to AI discovery and search visibility. Which products should I look at first? | 16 | 11: Google Search Console, Bing Webmaster Tools, Google Analytics 4, Semrush, … | — | — | — | — |
| 6 | use-case | Which tools help me get my site discovered by AI and search engines on a small budget? | 17 | 13: Google, Bing, ChatGPT, Perplexity, … | — | — | — | — |
| 7 | use-case | Which tools help me get my site discovered by AI and search engines without hiring an agency? | 17 | 12: ChatGPT, Perplexity, Google AI Overviews, Gemini, … | — | — | — | — |
| 8 | use-case | Which tools help me get my site discovered by AI and search engines as a team of one? | 18 | 8: Google Search Console, Answer Socrates, Airefs, Profound, … | — | — | — | — |
| 9 | use-case | Which tools help me get my site discovered by AI and search engines within a single day of setup? | 19 | 18: IndexNow API, Microsoft Bing, Yandex, Microsoft Copilot, … | — | — | — | — |
| 10 | use-case | Which tools help me get my site discovered by AI and search engines without an engineering team? | 17 | 14: ChatGPT, Perplexity, Gemini, Claude, … | — | — | — | — |
| 11 | use-case | Which tools help me get my site discovered by AI and search engines for a brand new website? | 18 | 15: Google, Bing, ChatGPT, Perplexity, … | — | — | — | — |
| 12 | use-case | Which tools help me get my site discovered by AI and search engines with a free trial? | 17 | 10: ChatGPT, Perplexity, Gemini, Google AI Overviews, … | — | — | — | — |
| 13 | persona | We are B2B SaaS founders and marketing leaders. Which AI discovery and search visibility tool fits us best? | 18 | 9: ChatGPT, Perplexity, Claude, Google AI Overviews, … | — | — | — | — |
| 14 | persona | Which AI discovery and search visibility software is built for B2B SaaS founders and marketing leaders? | 16 | 4: GrackerAI, Mentionova, Profound, Semrush | — | — | — | — |
| 15 | persona | What do B2B SaaS founders and marketing leaders actually use for AI discovery and search visibility? | 16 | 18: ChatGPT, Perplexity, Google AI Overviews, Claude, … | — | — | — | — |
| 16 | persona | I work with B2B SaaS founders and marketing leaders. Which AI discovery and search visibility product should I recommend to them? | 21 | 8: ChatGPT, Perplexity, Gemini, Claude, … | — | — | — | — |
| 17 | comparison | How does AEO Engine compare with MaxAEO for AI discovery and search visibility? | 13 | 5: AEO Engine, MaxAEO, ChatGPT, Perplexity, … | — | — | — | — |
| 18 | comparison | What are the best alternatives to AEO Engine for B2B SaaS founders and marketing leaders? | 15 | 7: AEO Engine, GoBlinkly, RankingonAI.com, Omniscient Digital, … | — | — | — | — |
| 19 | comparison | MaxAEO or Meltwater: which is the better choice for AI discovery and search visibility? | 14 | 2: MaxAEO, Meltwater | — | — | — | — |
| 20 | comparison | Which is better value for AI discovery and search visibility: AEO Engine, MaxAEO or Meltwater? | 15 | 3: MaxAEO, AEO Engine, Meltwater | — | — | — | — |
| 21 | problem | I am struggling to get my site discovered by AI and search engines. Which tools can fix that? | 18 | 12: ChatGPT, Perplexity, Google AI Overviews, Google Search Console, … | — | — | — | — |
| 22 | problem | Nothing I have tried helps me get my site discovered by AI and search engines. What software should I try next? | 21 | 9: SE Ranking, Semrush, Promptwatch, Surfer SEO, … | — | — | — | — |
| 23 | problem | What is the fastest way to get my site discovered by AI and search engines, and which products do it for me? | 22 | 10: ChatGPT, Perplexity, Google AI Overviews, Bing Webmaster Tools, … | — | — | — | — |
| 24 | branded | What is ReachKit, and is it any good for AI discovery and search visibility? | 14 | 10: ReachKit, ChatGPT, Claude, Perplexity, … | named | named | linked | linked |
| 25 | branded | Is ReachKit a good alternative to AEO Engine for AI discovery and search visibility? | 14 | 9: Reach, Reach AI, AEO Engine, ReachKit.ai, … | named | named | linked | linked |

Own pages cited:

- https://reachkit.app/?utm_source=chatgpt.com
- https://reachkit.app/how-it-works?utm_source=chatgpt.com

## plausible.io — the set

| # | Kind | Prompt | Words | Pre-check: brands named | AI Mode 1 | AI Mode 2 | ChatGPT 1 | ChatGPT 2 |
|---|---|---|---|---|---|---|---|---|
| 1 | category | What are the best privacy-friendly web analytics tools right now, and what is each one good at? | 17 | 7: Plausible Analytics, Fathom Analytics, Matomo, Umami, … | linked | linked | — | — |
| 2 | category | Which GDPR-compliant analytics platforms do people actually recommend this year? | 10 | 7: Plausible Analytics, Fathom Analytics, Matomo, Piwik PRO, … | named | named | named | named |
| 3 | category | Which privacy-first analytics platforms do people actually recommend this year? | 10 | 7: Google Analytics, Plausible Analytics, Fathom Analytics, PostHog, … | named | named | named | named |
| 4 | category | Which lightweight analytics platforms do people actually recommend this year? | 10 | 7: Google Analytics, Plausible Analytics, Umami, Fathom Analytics, … | named | named | named | — |
| 5 | category | I am new to privacy-friendly web analytics. Which products should I look at first? | 14 | 6: Google Analytics, Plausible Analytics, Matomo, Fathom Analytics, … | linked | linked | — | — |
| 6 | use-case | Which tools help me track website visitor behavior and performance without compromising visitor privacy on a small budget? | 18 | 5: Plausible Analytics, Umami, Fathom Analytics, Google Analytics, … | linked | — | named | — |
| 7 | use-case | Which tools help me track website visitor behavior and performance without compromising visitor privacy without hiring an agency? | 18 | 9: Plausible Analytics, Fathom Analytics, Matomo, Simple Analytics, … | linked | linked | — | — |
| 8 | use-case | Which tools help me track website visitor behavior and performance without compromising visitor privacy as a team of one? | 19 | 7: Plausible Analytics, Fathom Analytics, Ahrefs Web Analytics, PostHog, … | linked | named | — | — |
| 9 | use-case | Which tools help me track website visitor behavior and performance without compromising visitor privacy within a single day of setup? | 20 | 5: Google Analytics, Plausible Analytics, Umami, Ahrefs Web Analytics, … | named | linked | — | — |
| 10 | use-case | Which tools help me track website visitor behavior and performance without compromising visitor privacy without an engineering team? | 18 | 11: Plausible Analytics, Fathom Analytics, Simple Analytics, Matomo Cloud, … | linked | linked | linked | — |
| 11 | use-case | Which tools help me track website visitor behavior and performance without compromising visitor privacy for a brand new website? | 19 | 6: Plausible Analytics, Fathom Analytics, Umami, PostHog, … | named | linked | — | — |
| 12 | use-case | Which tools help me track website visitor behavior and performance without compromising visitor privacy with a free trial? | 18 | 3: Plausible Analytics, Fathom Analytics, Matomo | linked | linked | — | — |
| 13 | persona | We are website owners and SaaS companies. Which privacy-friendly web analytics tool fits us best? | 15 | 4: PostHog, Plausible Analytics, Fathom Analytics, Umami | linked | linked | — | — |
| 14 | persona | Which privacy-friendly web analytics software is built for website owners and SaaS companies? | 13 | 6: Plausible Analytics, Fathom Analytics, Simple Analytics, Matomo, … | linked | linked | named | linked |
| 15 | persona | What do website owners and SaaS companies actually use for privacy-friendly web analytics? | 13 | 8: Google Analytics, Plausible Analytics, Fathom Analytics, Umami, … | linked | linked | linked | — |
| 16 | persona | I work with website owners and SaaS companies. Which privacy-friendly web analytics product should I recommend to them? | 18 | 8: Plausible Analytics, Fathom Analytics, Umami, PostHog, … | linked | linked | linked | — |
| 17 | comparison | How does Matomo compare with Fathom Analytics for privacy-friendly web analytics? | 11 | 3: Matomo, Fathom Analytics, Google Analytics | named | named | — | — |
| 18 | comparison | What are the best alternatives to Matomo for website owners and SaaS companies? | 13 | 5: PostHog, Plausible Analytics, Umami, Piwik PRO, … | linked | named | linked | — |
| 19 | comparison | Fathom Analytics or Simple Analytics: which is the better choice for privacy-friendly web analytics? | 14 | 7: Fathom Analytics, Simple Analytics, Google Analytics, Swetrix, … | — | named | — | — |
| 20 | comparison | Which is better value for privacy-friendly web analytics: Matomo, Fathom Analytics or Simple Analytics? | 14 | 4: Matomo, Fathom Analytics, Simple Analytics, Google Analytics | — | — | — | — |
| 21 | problem | I am struggling to track website visitor behavior and performance without compromising visitor privacy. Which tools can fix that? | 19 | 6: Google Analytics, Plausible Analytics, Fathom Analytics, Matomo, … | linked | linked | — | — |
| 22 | problem | Nothing I have tried helps me track website visitor behavior and performance without compromising visitor privacy. What software should I try next? | 22 | 6: Google Analytics, Plausible Analytics, Matomo, PostHog, … | named | linked | — | — |
| 23 | problem | What is the fastest way to track website visitor behavior and performance without compromising visitor privacy, and which products do it for me? | 23 | 6: Plausible Analytics, Fathom Analytics, Simple Analytics, Matomo, … | linked | named | — | — |
| 24 | branded | What is Plausible, and is it any good for privacy-friendly web analytics? | 12 | 2: Plausible Analytics, Google Analytics | linked | linked | linked | linked |
| 25 | branded | Is Plausible a good alternative to Matomo for privacy-friendly web analytics? | 11 | 3: Plausible, Matomo, Google Analytics | linked | linked | linked | named |

Own pages cited:

- https://plausible.io/
- https://plausible.io/cookieless-web-analytics
- https://plausible.io/privacy-friendly-web-analytics?utm_source=chatgpt.com
- https://plausible.io/privacy-friendly-web-analytics
- https://plausible.io/privacy-focused-web-analytics
- https://plausible.io/security?utm_source=chatgpt.com
- https://plausible.io/data-policy?utm_source=chatgpt.com
- https://plausible.io/about?utm_source=chatgpt.com
- https://plausible.io/vs-matomo
- https://ingest.plausible.io/blog/web-analytics-vs-product-analytics?utm_source=chatgpt.com
- https://ingest.plausible.io/vs-matomo?utm_source=chatgpt.com
- https://plausible.io/docs/plausible-analytics-reviews
- https://plausible.io/compliance
- https://plausible.io/changelog
- https://plausible.io/privacy-focused-web-analytics?utm_source=chatgpt.com
- https://plausible.io/open-source-website-analytics?utm_source=chatgpt.com
- https://plausible.io/vs-matomo?utm_source=chatgpt.com
- https://plausible.io/features?utm_source=chatgpt.com
- https://plausible.io/self-hosted-web-analytics?utm_source=chatgpt.com

