# Content A/B on reachkit.app

Written by `node scripts/eval-content.mjs --ab --run` on 2026-09-29 (#1153, epic #1127). Today's pipeline (A) beside a prototype of the 2026-09-29 content rulings (B) and the hand-written reference (C), all for reachkit.app as a customer, on the #1132 harness and its snapshot. Nothing was published and nothing was written to a database.

## Verdict

**The measured half of the owner's bar is met, narrowly. The bar is not passed yet: the owner's blind read is still owed, and one prototype defect will weigh on it.**

| The bar (owner, 2026-09-29) | A1 · A2 · A3 | B1 · B2 · B3 | B beats A? |
|---|---|---|---|
| Business fit (grader, 0–3) | 3 · 2 · 3 | 3 · 3 · 3 | Yes, by one pair (pair 2). |
| What the page adds beyond the top results | grader 3 · 2 · 3; test passes 3 of 3 | grader 3 · 3 · 3; test passes 2 of 3 (B3 fails) | Yes on the grader, by one pair. No on the non-commodity test. |
| Required blocks | 0/11 · 4/11 · 4/11 | 8/11 · 8/11 · 7/10 | Yes. |
| Length floor | 417 · 408 · 425 words, floor met 0 of 3 | 1,480 · 1,150 · 1,291 words, floor met 1 of 3 | Yes, but two of three B pages miss the floor. |
| Zero invented figures | 0 by the trace | 0 on reading. The trace flags one: the 17 in B1's Sources line, which is the cited article's own title, "17 Best AI SEO Tools in 2026". | Met. |
| The owner prefers B on two blind pairs | — | — | **Owed.** `ab-reachkit/blind/` is ready. |

The grader flagged two figures, and both are false: in A3 it flagged "one page a day", which is on the site, and in B2 it flagged a read date of 2026-09-29, which it took for a future date. Every B page's generation fits `CAPS.DRAFT_C`, at 17.5–24.4¢ against 45¢.

**Before the blind read:** B2 and B3 print the prompt's internal fact labels in their prose. B2 has 35 of them, as link text or bare, like `[F7][F8](https://reachkit.app/)`, and B3 has 16, like `[M39](…)`. The labels come from a prompt defect: the prompt never said not to print them. The rulings do not cause it. This run is kept as it ran rather than re-rolled until B looks better, so pairs 2 and 3 show the labels. Read them as noise.

**What B did better and worse.**
- Better: B carried the blocks today's pipeline lacks — takeaways, six to ten question sections, a comparison table, a sources list and stored buyer questions — and wrote about three times as much, with every figure traced to a site fact or a cited page. On all three of A's topics, the product's own rules stopped its roughly 410-word drafts.
- Worse: all three B answer boxes ran past 60 words, and two of three pages fell short of the length floor; the critic even cut B1 from 1,565 words to 1,480. B2 and B3 also print internal fact labels in their text.
- Topic choice did not deliver what the rulings hoped: B's small-tier call scored "what is the best seo software" at fit 3, the same generic list A ranks third, and B3, its one proposed topic, failed the non-commodity test because it said nothing new about the business.

**If the build goes ahead (#1133 on):** strip or forbid fact labels in the body, hold the answer box to 60 words in code, and check the length floor in code after the critic, not only in its prompt. The grader's *question headings* and *sections open with an answer* fail on every page that has a Sources section, C included, because that section's heading is not a question and it opens with a list. The grader needs that exemption before these two rows can tell pages apart.

## The arms

- **A (today).** The product's `generateDraft`, unmodified, exactly as `npm run eval:content` runs it: the brief, outline, draft and answerability prompts, the hard-rule battery and the claim check.
- **B (prototype).** `scripts/eval-content/prototype/arm-b.ts`, which changes nothing under `src/`. A knowledge base of 113 facts — 100 prose sentences from the snapshot's pages, with any run of words found on three or more pages cut as navigation, and 13 founder answers taken from the approved copy in `README.md`. One small-tier call for topics by business fit. The top three readable results per target, their claims copied word for word, and statistics older than three years dropped. One `claude-sonnet-5` call to write, under the new rules as one prompt, and one `claude-sonnet-5` critic that may rewrite once (adaptive thinking, medium effort).
- **C (reference).** The hand-written dogfood article, revision 2 (`ab-reachkit/C-reference.md`), graded as it is.

## The pages

| Page | Target search | Type the length is read as | Why this topic | Outcome |
|---|---|---|---|---|
| A1 | best ai seo software | comparison, 1500–2500 | today's ranking, first | stopped: no_private_figure |
| A2 | best seo software review | comparison, 1500–2500 | today's ranking, second | stopped: no_unsourced_testimonial |
| A3 | what is the best seo software | comparison, 1500–2500 | today's ranking, third | stopped: first_block_answers |
| B1 | best ai seo software | comparison, 1500–2500 | A1's topic, to isolate the writing | written; the critic rewrote it |
| B2 | what is the best seo software | comparison, 1500–2500 | fit 3, ai_gap, measured: ReachKit directly answers this question as an AI-powered SEO solution for findability. | written; the critic rewrote it |
| B3 | how to get found by chatgpt and google ai | problem or how-to, 1200–2000 | fit 3, ai_gap, proposed: AI answers cite competitors; this exact problem is ReachKit's core offering and no AI answer names it. | written; the critic rewrote it |
| C | why does chatgpt recommend my competitors | problem or how-to, 1200–2000 | the hand-written dogfood article, revision 2 | hand-written |

B passed over: "best ai seo software" (page 1's topic); "seo ai software" (one topic with "best ai seo software" (4+ shared top-ten addresses)); "ai tool seo" (one topic with "best ai seo software" (4+ shared top-ten addresses)); "best seo ai" (one topic with "best ai seo software" (4+ shared top-ten addresses)).

## Graded

Fit and Adds are the #1132 grader's model half, unchanged. Blocks and words are its checklist. *New claims* is the non-commodity listing: the page's claims that neither the target's top three results nor the site state (the test passes at three, one of them about the business). *Numbers* traces every figure on the page, years and dates aside, to the fact it came from: *traced* is a fact the page stood on, *pool only* is its arm's wider pool but no fact it listed, *unread* is a cited page this run could not read, and *invented* is nothing at all.

| Page | Fit 0–3 | Adds 0–3 | Blocks | Words / target | Floor met | New claims (business) | Test | Numbers traced / pool only / unread / invented | Nav text | Grader: invented figure |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | 3 | 3 | 0/11 | 417 / 1500–2500 | no | 5 (5) | pass | 5 / 0 / 0 / **0** | none; grader: yes | no |
| A2 | 2 | 2 | 4/11 | 408 / 1500–2500 | no | 3 (1) | pass | 3 / 0 / 0 / **0** | none; grader: yes | no |
| A3 | 3 | 3 | 4/11 | 425 / 1500–2500 | no | 7 (3) | pass | 0 / 0 / 0 / **0** | none; grader: yes | yes: "One page a day" is presented as a factual statement, but the facts show "Pages published 17" without confirming this is a daily rate. |
| B1 | 3 | 3 | 8/11 | 1480 / 1500–2500 | no | 11 (9) | pass | 22 / 3 / 0 / **1** | none; grader: no | no |
| B2 | 3 | 3 | 8/11 | 1150 / 1500–2500 | no | 4 (1) | pass | 25 / 0 / 0 / **0** | none; grader: no | yes: "read 2026-09-29" is a future date that could not have been accessed; the current context suggests this is being written in 2024 or early 2025. |
| B3 | 3 | 3 | 7/10 | 1291 / 1200–2000 | yes | 3 (0) | fail | 22 / 0 / 0 / **0** | none; grader: yes | no |
| C | 3 | 3 | 7/10 | 2147 / 1200–2000 | yes | 8 (1) | pass | 19 / 0 / 0 / **0** | none; grader: yes | no |

B before its critic, where the critic rewrote:

| Draft | Fit | Adds | Blocks | Words | Numbers traced / pool only / invented |
|---|---|---|---|---|---|
| B1 before critic | 3 | 3 | 8/11 | 1565 | 23 / 3 / **2** |
| B2 before critic | 3 | 3 | 9/11 | 929 | 25 / 0 / **0** |
| B3 before critic | 3 | 3 | 7/10 | 1312 | 25 / 0 / **0** |

### Required blocks, per page

| Block | A1 | A2 | A3 | B1 | B2 | B3 | C |
|---|---|---|---|---|---|---|---|
| short answer (40–60 words) | no | no | no | no | no | no | yes |
| 3–5 takeaways | no | no | no | yes | yes | yes | yes |
| question headings | no | no | no | no | no | no | no |
| H2 then H3, in order | no | yes | yes | yes | yes | yes | yes |
| sections open with an answer | no | yes | yes | no | no | no | no |
| 6–10 sections | no | no | no | yes | yes | yes | yes |
| a table | no | no | no | yes | yes | n/a | n/a |
| how the business handles it | no | yes | yes | yes | yes | yes | yes |
| 3–6 buyer questions (meta.faq) | no | no | no | yes | yes | yes | no |
| sources list | no | no | no | yes | yes | yes | yes |
| closing action | no | yes | yes | yes | yes | yes | yes |

C's buyer questions are read from its own *Questions buyers ask* section (2), since a hand-written page has no `meta.faq`.

## Cost per page

Generation is what writing the page cost; grading is the #1132 grade plus the non-commodity listing. B2 and B3 each carry half of B's topic call (2.28¢); B1's topic was A's. `CAPS.DRAFT_C` is 45.00¢.

| Page | Generation | Grading | Fits `CAPS.DRAFT_C` (generation) |
|---|---|---|---|
| A1 | 2.15¢ | 1.61¢ | yes |
| A2 | 1.70¢ | 1.90¢ | yes |
| A3 | 1.60¢ | 1.93¢ | yes |
| B1 | 17.54¢ | 2.82¢ | yes |
| B2 | 17.92¢ | 2.88¢ | yes |
| B3 | 24.42¢ | 3.06¢ | yes |
| C | hand-written | 4.78¢ | — |

Run total 110.71¢ of 300¢, of which 26.40¢ was an earlier attempt stopped part-way (its claim step returned nothing readable; the parse was fixed and the run started again).

## What the grader said

**A1** — What is the best AI SEO software?
- Fit: ReachKit is the business itself and the draft positions it as the direct answer to the search query "best ai seo software."
- Adds: The draft introduces a novel framework (measurement-publication-motion) and buyer-centric philosophy that competing results don't articulate.

**A2** — Where can I find reviews of the best SEO software?
- Fit: ReachKit is one specific tool within a broad "best SEO software review" search that compares many options, so it plainly helps but isn't the direct answer buyers seek.
- Adds: The draft adds clear reasoning about what matters in SEO tool selection (problem-solving, AI visibility, automation, team size) that the listicle-style top results don't explain.

**A3** — What is the best SEO software?
- Fit: ReachKit is directly presented as an AI answer monitor that solves the exact problem buyers search for when they want SEO software that handles AI visibility.
- Adds: The draft uniquely introduces AI answer monitoring as a category—none of the top results mention ChatGPT or Google AI Overviews as a visibility problem, making this a clear addition.
- Invented figure: "One page a day" is presented as a factual statement, but the facts show "Pages published 17" without confirming this is a daily rate.

**B1** — What Is the Best AI SEO Software?
- Fit: ReachKit's own offering is a central answer to the search query "best ai seo software," presented alongside direct competitors in a comparison framework.
- Adds: The draft adds substantial depth to top-result comparisons by providing a detailed feature-by-feature breakdown, accuracy analysis, pricing comparison, team background, and honest positioning of where ReachKit fits versus competitors.
- B's critic: {"adds":2,"specificity":2,"fit":2,"blocks":1,"length":2,"why":"The code flags missing required blocks (short answer, question headings, section-opening answers) and several numbers used without a listed fact backing them, which are hard rule violations. Content is otherwise reasonably specific and honest, but the structural failures are disqualifying and fixable in a rewrite."}

**B2** — What Is the Best SEO Software for Getting Found in AI Answers and Google?
- Fit: ReachKit is positioned as the direct answer to the search query, solving a specific gap that classic SEO tools don't address: AI-answer visibility.
- Adds: The draft introduces a new category (AI-answer visibility) that none of the top search results emphasize, positioning ReachKit as solving a different problem than traditional SEO tools.
- Invented figure: "read 2026-09-29" is a future date that could not have been accessed; the current context suggests this is being written in 2024 or early 2025.
- B's critic: {"adds":2,"specificity":2,"fit":3,"blocks":2,"length":0,"why":"Draft is well under the 1200-word minimum and code flagged missing question-heading/answer-opening compliance in places, so it fails hard requirements despite decent specificity and fit.","problem":"length and blocks"}

**B3** — How Do You Get Found by ChatGPT and Google AI?
- Fit: ReachKit's core offering—automated page generation targeting AI citation gaps—directly answers the search query and is the product being promoted.
- Adds: The draft adds substantial differentiation by explaining the scan-measure-publish workflow, the 24-hour veto window, the weekly re-measure cycle, and concrete pricing—details none of the top 10 results cover.
- B's critic: {"adds":2,"specificity":3,"fit":2,"blocks":0,"length":2,"why":"Missing the mandated 40-60 word short answer, section headings that aren't all questions properly (some are fine but the answer block itself violates word count), and section-opening-paragraph-before-list rule is inconsistently honored; also the ReachKit section doesn't link pricing page. Code flags missing blocks explicitly, which is disqualifying."}

**C** — Why does ChatGPT recommend my competitors?
- Fit: ReachKit's core offering—getting businesses named in AI answers—is directly the answer to why ChatGPT recommends competitors, and the draft explains both the problem and ReachKit's solution throughout.
- Adds: The draft adds extensive original analysis: a diagnostic table, step-by-step manual checking instructions, a comparison table of approaches, candid limitations of ReachKit, and practical page-writing guidance that none of the top-ranked competitor pages appear to offer.

## What the non-commodity test lists

**A1** (5; passes)
- business: AI answers and rankings change, and none of this is a guarantee of rankings, citations, traffic, revenue or any other outcome.
- business: ReachKit publishes one page a day written and published to the user's site.
- business: ReachKit measures the user's market every week and sends a weekly movement email.
- business: ReachKit provides a 24-hour veto window on every page before publication.
- business: ReachKit's pages are grounded in facts read from the user's own live pages, with the source of each fact recorded.

**A2** (3; passes)
- market: Search engines and AI systems now answer questions directly, often without sending a click to your site.
- advice: A tool that only tracks search rankings won't show you whether AI answers name you when buyers research your market.
- business: ReachKit publishes one page a day to close the gap—the gap between where your site appears and where buyers look when they're deciding whether to switch.

**A3** (7; passes)
- business: ReachKit publishes one page a day for your site.
- business: ReachKit scans your market every week.
- business: ReachKit identifies gaps where buyers ask questions that don't mention you or your rivals in AI answers.
- advice: AI answer monitors specifically help when buyers are asking questions in ChatGPT or Google AI Overviews and you're not being named there.
- advice: Site auditors are the right choice if your visibility is low because your site itself doesn't work.
- advice: Rank trackers are the right choice if you already know which buyer searches send business to you and your rivals.
- advice: Content planners are the right choice if you're building content from scratch or rewriting pages that don't rank.

**B1** (11; passes)
- business: Semrush One tracks citations across ChatGPT, Google AI Mode, Perplexity and AI Overviews in six regions: US, UK, Canada, Australia, India, and Spain.
- market: One OneLittleWeb reviewer cross-checked Semrush data against Google Search Console for six months across multiple client accounts and found the variance was typically under 10%.
- business: ReachKit grounds each page in facts from the user's own live pages rather than industry benchmarks.
- business: ReachKit uses DataForSEO as the source for search rankings, search volumes and AI-answer data.
- business: ReachKit's pages wait a day for the user to read them before going live.
- business: ReachKit re-measures the market every Monday.
- business: ReachKit uses Anthropic's language models to label the market, propose questions, and write pages.
- business: Every word ReachKit says in its own voice on screen or in email is written by a person, never by a model.
- business: ReachKit's pages are cancelled in one click from Settings.
- market: Rankability's Content Optimizer uses the same NLP technology that ChatGPT and Google use to understand content through entity extraction.
- business: Rankability has a new Tracker tool coming out soon to track brand mentions across ChatGPT, Perplexity, and Gemini.

**B2** (4; passes)
- market: Buyers now ask ChatGPT and Google's AI what to use, and the answer names a handful of companies.
- market: Rank trackers and content graders measure 'where do I sit in Google' but not 'does the AI answer mention me.'
- business: ReachKit is built for a founder who owns a small company website and knows nothing about SEO.
- advice: A small site often needs an AI-visibility scanner first, since it's the one showing whether AI answers mention you at all.

**B3** (3; fails)
- market: A McKinsey analysis found that only 5-10% of Google AI Overview citations come from a brand's own website.
- market: Among ChatGPT's top 10 most-cited domains, Wikipedia alone accounted for 40% of citations.
- market: Research covering 50 million+ user journeys across ChatGPT, Copilot, Google AI Overview, and Perplexity found specific citation concentration patterns.

**C** (8; passes)
- market: In the first four months of 2026, 68.01% of US Google searches ended without a click, up from 60.45% in 2024.
- market: On searches with an AI Overview, organic click-through is 2.94% without the Overview and 0.84% with one.
- market: Brands cited as a source inside an AI Overview had 1.08% click-through against 0.6% for brands not cited.
- market: The average AI search visitor is 4.4 times as valuable as the average visit from traditional organic search.
- market: A Princeton study found that adding quotations, statistics and cited sources gave a relative improvement of 30–40% in how much of a page an engine used.
- market: Ahrefs found that cited pages had titles closer to the prompt than pages that were not cited.
- market: Pages with plain, readable addresses were cited 89.78% of the time against 81.11% for those without.
- business: ReachKit's own scan on 28 September 2026 scored reachkit.app 19 of 100: Invisible.

## Every number, and where it came from

**A1**

| Number | In | Verdict | From |
|---|---|---|---|
| 49 | A free scan shows you what AI answers and Google search send buyers to right now. Scan my site free. One page a day closes the gap. €49 p… | traced | https://reachkit.app/pricing |
| 1 | A free scan shows you what AI answers and Google search send buyers to right now. Scan my site free. One page a day closes the gap. €49 p… | traced | https://reachkit.app/pricing |
| 24 | A free scan shows you what AI answers and Google search send buyers to right now. Scan my site free. One page a day closes the gap. €49 p… | traced | https://reachkit.app/pricing |
| 6 | This week on schedule: What buyers ask before they switch, answered publishes in 6 h 12 m unless you say otherwise. One page a day closes… | traced | https://reachkit.app/ |
| 12 | This week on schedule: What buyers ask before they switch, answered publishes in 6 h 12 m unless you say otherwise. One page a day closes… | traced | https://reachkit.app/ |

**A2**

| Number | In | Verdict | From |
|---|---|---|---|
| 49 | ReachKit is one option. It focuses on closing visibility gaps by writing and publishing one page a day for your site. The pricing is €49 … | traced | https://reachkit.app/pricing |
| 1 | ReachKit is one option. It focuses on closing visibility gaps by writing and publishing one page a day for your site. The pricing is €49 … | traced | https://reachkit.app/ |
| 24 | ReachKit is one option. It focuses on closing visibility gaps by writing and publishing one page a day for your site. The pricing is €49 … | traced | https://reachkit.app/pricing |

**A3**

No figures.

**B1**

| Number | In | Verdict | From |
|---|---|---|---|
| 49 | Pricing models differ: ReachKit charges a flat €49 a month, VAT included, while annual Semrush plans "usually save 20 to 30 percent" over… | traced | https://reachkit.app/pricing |
| 20 | Pricing models differ: ReachKit charges a flat €49 a month, VAT included, while annual Semrush plans "usually save 20 to 30 percent" over… | traced | https://onelittleweb.com/top-tools/best-ai-seo-tools/ |
| 30 | Pricing models differ: ReachKit charges a flat €49 a month, VAT included, while annual Semrush plans "usually save 20 to 30 percent" over… | traced | https://onelittleweb.com/top-tools/best-ai-seo-tools/ |
| 15 | Third-party ranking and keyword data can disagree with your own Google Search Console — one reviewer says they stop trusting a tool once … | pool | https://onelittleweb.com/top-tools/best-ai-seo-tools/ |
| 20 | Third-party ranking and keyword data can disagree with your own Google Search Console — one reviewer says they stop trusting a tool once … | traced | https://onelittleweb.com/top-tools/best-ai-seo-tools/ |
| 24 | ReachKit is narrower than the measurement platforms: it finds gaps and publishes one page a day, with a 24-hour window to stop each page … | traced | https://reachkit.app/pricing |
| 100 | These track how often your brand or your rivals get cited in AI answer engines and search results. OneLittleWeb reports Semrush One "trac… | traced | https://onelittleweb.com/top-tools/best-ai-seo-tools/ |
| 24 | These generate or automate the pages meant to earn those citations. SEO.AI describes itself as "the AI SEO agent that creates ranking con… | traced | https://reachkit.app/pricing |
| 7 | These generate or automate the pages meant to earn those citations. SEO.AI describes itself as "the AI SEO agent that creates ranking con… | traced | https://seo.ai/ |
| 20 | Semrush OneTracks rankings and AI-answer citations across six regions; platform dates to 2008, AI suite launched 2025Annual plans "usuall… | traced | https://onelittleweb.com/top-tools/best-ai-seo-tools/ |
| 30 | Semrush OneTracks rankings and AI-answer citations across six regions; platform dates to 2008, AI suite launched 2025Annual plans "usuall… | traced | https://onelittleweb.com/top-tools/best-ai-seo-tools/ |
| 49 | ReachKitFinds AI/search questions naming rivals and not you, writes one page a day answering each from your own site's facts€49 a month, … | traced | https://reachkit.app/pricing |
| 10 | Accuracy varies by tool and by how a reviewer checked it, and none of these figures are a promise. One OneLittleWeb reviewer says they "c… | traced | https://onelittleweb.com/top-tools/best-ai-seo-tools/ |
| 15 | Accuracy varies by tool and by how a reviewer checked it, and none of these figures are a promise. One OneLittleWeb reviewer says they "c… | pool | https://onelittleweb.com/top-tools/best-ai-seo-tools/ |
| 20 | Accuracy varies by tool and by how a reviewer checked it, and none of these figures are a promise. One OneLittleWeb reviewer says they "c… | traced | https://onelittleweb.com/top-tools/best-ai-seo-tools/ |
| 49 | ReachKit: "€49 per month, VAT included" — one plan, no tiers. | traced | https://reachkit.app/pricing |
| 20 | Semrush One: monthly plans exist, but "annual subscriptions usually save 20 to 30 percent," per OneLittleWeb. | traced | https://onelittleweb.com/top-tools/best-ai-seo-tools/ |
| 30 | Semrush One: monthly plans exist, but "annual subscriptions usually save 20 to 30 percent," per OneLittleWeb. | traced | https://onelittleweb.com/top-tools/best-ai-seo-tools/ |
| 76 | Some vendors publish outcome numbers from specific client work, and those numbers describe one account, not a typical result. OneLittleWe… | traced | https://onelittleweb.com/top-tools/best-ai-seo-tools/ |
| 1 | Some vendors publish outcome numbers from specific client work, and those numbers describe one account, not a typical result. OneLittleWe… | traced | https://reachkit.app/pricing |
| 2 | Some vendors publish outcome numbers from specific client work, and those numbers describe one account, not a typical result. OneLittleWe… | traced | https://seo.ai/ |
| 40 | Experience claims are common in this space, and they're worth reading alongside the product rather than instead of it. The OneLittleWeb a… | traced | https://onelittleweb.com/top-tools/best-ai-seo-tools/ |
| 20 | Experience claims are common in this space, and they're worth reading alongside the product rather than instead of it. The OneLittleWeb a… | traced | https://onelittleweb.com/top-tools/best-ai-seo-tools/ |
| 49 | The product then writes one page a day targeting a specific question your market asks where a rival gets named and you don't, grounding e… | traced | https://reachkit.app/pricing |
| 17 | OneLittleWeb, 17 Best AI SEO Tools in 2026: Tested by SEO Experts, read 2026-09-29 | invented |  |
| 15 | Rankability, We tested 15 best AI SEO tools. here's our favorite for 2026, read 2026-09-29 | pool | https://onelittleweb.com/top-tools/best-ai-seo-tools/ |

**B2**

| Number | In | Verdict | From |
|---|---|---|---|
| 24 | Every page waits 24 hours by default for you to read it — or stop it — before it goes live. [F14]F81 | traced | https://reachkit.app/ |
| 99 | Surfer SEOEssential $99/mo, Scale $219/mo M26 M27G2 4.7 (+419 reviews), Capterra 4.8 (+207 reviews) M28 M29Content optimization for Googl… | traced | https://www.marketermilk.com/blog/best-seo-tools |
| 219 | Surfer SEOEssential $99/mo, Scale $219/mo M26 M27G2 4.7 (+419 reviews), Capterra 4.8 (+207 reviews) M28 M29Content optimization for Googl… | traced | https://www.marketermilk.com/blog/best-seo-tools |
| 4.7 | Surfer SEOEssential $99/mo, Scale $219/mo M26 M27G2 4.7 (+419 reviews), Capterra 4.8 (+207 reviews) M28 M29Content optimization for Googl… | traced | https://www.marketermilk.com/blog/best-seo-tools |
| 419 | Surfer SEOEssential $99/mo, Scale $219/mo M26 M27G2 4.7 (+419 reviews), Capterra 4.8 (+207 reviews) M28 M29Content optimization for Googl… | traced | https://www.marketermilk.com/blog/best-seo-tools |
| 4.8 | Surfer SEOEssential $99/mo, Scale $219/mo M26 M27G2 4.7 (+419 reviews), Capterra 4.8 (+207 reviews) M28 M29Content optimization for Googl… | traced | https://www.marketermilk.com/blog/best-seo-tools |
| 207 | Surfer SEOEssential $99/mo, Scale $219/mo M26 M27G2 4.7 (+419 reviews), Capterra 4.8 (+207 reviews) M28 M29Content optimization for Googl… | traced | https://www.marketermilk.com/blog/best-seo-tools |
| 108 | AhrefsLite $108/mo, Standard $208/mo M37 M38G2 4.8 (+537 reviews), Capterra 4.9 (+417 reviews) M32 M33Keyword tracking, backlinks, site a… | traced | https://www.marketermilk.com/blog/best-seo-tools |
| 208 | AhrefsLite $108/mo, Standard $208/mo M37 M38G2 4.8 (+537 reviews), Capterra 4.9 (+417 reviews) M32 M33Keyword tracking, backlinks, site a… | traced | https://www.marketermilk.com/blog/best-seo-tools |
| 4.8 | AhrefsLite $108/mo, Standard $208/mo M37 M38G2 4.8 (+537 reviews), Capterra 4.9 (+417 reviews) M32 M33Keyword tracking, backlinks, site a… | traced | https://www.marketermilk.com/blog/best-seo-tools |
| 537 | AhrefsLite $108/mo, Standard $208/mo M37 M38G2 4.8 (+537 reviews), Capterra 4.9 (+417 reviews) M32 M33Keyword tracking, backlinks, site a… | traced | https://www.marketermilk.com/blog/best-seo-tools |
| 4.9 | AhrefsLite $108/mo, Standard $208/mo M37 M38G2 4.8 (+537 reviews), Capterra 4.9 (+417 reviews) M32 M33Keyword tracking, backlinks, site a… | traced | https://www.marketermilk.com/blog/best-seo-tools |
| 417 | AhrefsLite $108/mo, Standard $208/mo M37 M38G2 4.8 (+537 reviews), Capterra 4.9 (+417 reviews) M32 M33Keyword tracking, backlinks, site a… | traced | https://www.marketermilk.com/blog/best-seo-tools |
| 0 | GumloopFree $0/mo (5,000 credits), Pro $37/mo (20,000 credits) M35 M36—AI marketing workflows, including SEO workflows | traced | https://www.marketermilk.com/blog/best-seo-tools |
| 5000 | GumloopFree $0/mo (5,000 credits), Pro $37/mo (20,000 credits) M35 M36—AI marketing workflows, including SEO workflows | traced | https://www.marketermilk.com/blog/best-seo-tools |
| 37 | GumloopFree $0/mo (5,000 credits), Pro $37/mo (20,000 credits) M35 M36—AI marketing workflows, including SEO workflows | traced | https://www.marketermilk.com/blog/best-seo-tools |
| 20000 | GumloopFree $0/mo (5,000 credits), Pro $37/mo (20,000 credits) M35 M36—AI marketing workflows, including SEO workflows | traced | https://www.marketermilk.com/blog/best-seo-tools |
| 49 | ReachKit€49 a month, VAT included F18—Scans AI-answer and Google visibility, then publishes daily pages | traced | https://reachkit.app/pricing |
| 49 | One plan covers the whole loop for a flat monthly fee, with no separate tiers to compare against each other. It costs €49 per month, VAT … | traced | https://reachkit.app/pricing |
| 24 | One plan covers the whole loop for a flat monthly fee, with no separate tiers to compare against each other. It costs €49 per month, VAT … | traced | https://reachkit.app/ |
| 1 | 1 page a day, written and published for you F20 | traced | https://reachkit.app/ |
| 24 | 24-hour veto window on every page F20 | traced | https://reachkit.app/ |
| 24 | You start with a free scan that takes under a minute, no account required, and then confirm your market and rivals before anything publis… | traced | https://reachkit.app/ |
| 24 | You start with a free scan that takes under a minute, no account required, and then confirm your market and rivals before anything publis… | traced | https://reachkit.app/ |
| 24 | Marketer Milk, 24 best SEO tools I'm using in 2026 (free + paid), read 2026-09-29 | traced | https://reachkit.app/ |

**B3**

| Number | In | Verdict | From |
|---|---|---|---|
| 44.2 | Citations cluster near the top of a page: "44.2% came from the top 30% of a page's content" for ChatGPT, and "a similar distribution: 55%… | traced | https://blog.hubspot.com/marketing/how-to-show-up-in-chatgpt-results |
| 30 | Citations cluster near the top of a page: "44.2% came from the top 30% of a page's content" for ChatGPT, and "a similar distribution: 55%… | traced | https://blog.hubspot.com/marketing/how-to-show-up-in-chatgpt-results |
| 55 | Citations cluster near the top of a page: "44.2% came from the top 30% of a page's content" for ChatGPT, and "a similar distribution: 55%… | traced | https://blog.hubspot.com/marketing/how-to-show-up-in-chatgpt-results |
| 18012 | Citations concentrate near the top of a page, and most of them don't come from your own site at all. A "February 2026 analysis of 18,012 … | traced | https://blog.hubspot.com/marketing/how-to-show-up-in-chatgpt-results |
| 44.2 | Citations concentrate near the top of a page, and most of them don't come from your own site at all. A "February 2026 analysis of 18,012 … | traced | https://blog.hubspot.com/marketing/how-to-show-up-in-chatgpt-results |
| 30 | Citations concentrate near the top of a page, and most of them don't come from your own site at all. A "February 2026 analysis of 18,012 … | traced | https://blog.hubspot.com/marketing/how-to-show-up-in-chatgpt-results |
| 55 | Citations concentrate near the top of a page, and most of them don't come from your own site at all. A "February 2026 analysis of 18,012 … | traced | https://blog.hubspot.com/marketing/how-to-show-up-in-chatgpt-results |
| 30 | Citations concentrate near the top of a page, and most of them don't come from your own site at all. A "February 2026 analysis of 18,012 … | traced | https://blog.hubspot.com/marketing/how-to-show-up-in-chatgpt-results |
| 5 | "A McKinsey analysis found that only 5-10% of Google AI Overview citations come from a brand's own website." M56 And the field is crowded… | traced | https://blog.hubspot.com/marketing/how-to-show-up-in-chatgpt-results |
| 10 | "A McKinsey analysis found that only 5-10% of Google AI Overview citations come from a brand's own website." M56 And the field is crowded… | traced | https://blog.hubspot.com/marketing/how-to-show-up-in-chatgpt-results |
| 50 | "A McKinsey analysis found that only 5-10% of Google AI Overview citations come from a brand's own website." M56 And the field is crowded… | traced | https://blog.hubspot.com/marketing/how-to-show-up-in-chatgpt-results |
| 10 | "A McKinsey analysis found that only 5-10% of Google AI Overview citations come from a brand's own website." M56 And the field is crowded… | traced | https://blog.hubspot.com/marketing/how-to-show-up-in-chatgpt-results |
| 40 | "A McKinsey analysis found that only 5-10% of Google AI Overview citations come from a brand's own website." M56 And the field is crowded… | traced | https://blog.hubspot.com/marketing/how-to-show-up-in-chatgpt-results |
| 206 | Fast enough that ignoring it is no longer a neutral choice. "Semrush reported 206% growth in outbound ChatGPT referral traffic from Janua… | traced | https://www.dynadot.com/blog/how-to-get-found-in-chatgpt/ |
| 17 | Fast enough that ignoring it is no longer a neutral choice. "Semrush reported 206% growth in outbound ChatGPT referral traffic from Janua… | traced | https://www.dynadot.com/blog/how-to-get-found-in-chatgpt/ |
| 1.7 | Fast enough that ignoring it is no longer a neutral choice. "Semrush reported 206% growth in outbound ChatGPT referral traffic from Janua… | traced | https://www.dynadot.com/blog/how-to-get-found-in-chatgpt/ |
| 1 | Step 1: scan your domain, free, no account. Step 2: pick your market and rivals — we suggest, you confirm. Step 3: pages go live on your … | traced | https://reachkit.app/ |
| 2 | Step 1: scan your domain, free, no account. Step 2: pick your market and rivals — we suggest, you confirm. Step 3: pages go live on your … | traced | https://reachkit.app/ |
| 3 | Step 1: scan your domain, free, no account. Step 2: pick your market and rivals — we suggest, you confirm. Step 3: pages go live on your … | traced | https://www.dynadot.com/blog/how-to-get-found-in-chatgpt/ |
| 24 | Step 1: scan your domain, free, no account. Step 2: pick your market and rivals — we suggest, you confirm. Step 3: pages go live on your … | traced | https://reachkit.app/ |
| 49 | ReachKit subscription€49 a month, VAT included1 page a day, written and published for you; weekly re-measure of your whole market; weekly… | traced | https://reachkit.app/pricing |
| 24 | ReachKit subscription€49 a month, VAT included1 page a day, written and published for you; weekly re-measure of your whole market; weekly… | traced | https://reachkit.app/ |

**C**

| Number | In | Verdict | From |
|---|---|---|---|
| 40 | Pages that add quotations, statistics and cited sources were quoted up to 40% more in a Princeton study. Keyword stuffing did not help. | traced | https://developers.google.com/search/blog/2025/05/succeeding-in-ai-search |
| 68.01 | Yes, because fewer searches end in a click on any ranking at all. In the first four months of 2026, 68.01% of US Google searches ended wi… | traced | https://sparktoro.com/blog/in-2026-less-than-one-third-of-google-searches-still-send-a-click/ |
| 60.45 | Yes, because fewer searches end in a click on any ranking at all. In the first four months of 2026, 68.01% of US Google searches ended wi… | traced | https://sparktoro.com/blog/in-2026-less-than-one-third-of-google-searches-still-send-a-click/ |
| 2.94 | Where Google shows an AI Overview, the drop is steeper. Seer Interactive measured organic click-through at 2.94% on searches without an A… | traced | https://www.seerinteractive.com/insights/how-ai-overviews-are-impacting-ctr-5-initial-takeaways |
| 0.84 | Where Google shows an AI Overview, the drop is steeper. Seer Interactive measured organic click-through at 2.94% on searches without an A… | traced | https://www.seerinteractive.com/insights/how-ai-overviews-are-impacting-ctr-5-initial-takeaways |
| 1.08 | Where Google shows an AI Overview, the drop is steeper. Seer Interactive measured organic click-through at 2.94% on searches without an A… | traced | https://www.seerinteractive.com/insights/how-ai-overviews-are-impacting-ctr-5-initial-takeaways |
| 0.6 | Where Google shows an AI Overview, the drop is steeper. Seer Interactive measured organic click-through at 2.94% on searches without an A… | traced | https://www.seerinteractive.com/insights/how-ai-overviews-are-impacting-ctr-5-initial-takeaways |
| 4.4 | The visitors who do arrive from AI answers are worth more. Semrush found that the average AI search visitor is 4.4 times as valuable as t… | traced | https://www.semrush.com/blog/ai-search-seo-traffic-study/ |
| 30 | The best evidence so far comes from a Princeton study of generative engines, which tested changes to the same pages. Adding quotations, s… | traced | https://ahrefs.com/blog/why-chatgpt-cites-pages/ |
| 40 | The best evidence so far comes from a Princeton study of generative engines, which tested changes to the same pages. Adding quotations, s… | traced | https://arxiv.org/abs/2311.09735 |
| 1.4 | The best evidence so far comes from a Princeton study of generative engines, which tested changes to the same pages. Adding quotations, s… | traced | https://ahrefs.com/blog/why-chatgpt-cites-pages/ |
| 89.78 | The best evidence so far comes from a Princeton study of generative engines, which tested changes to the same pages. Adding quotations, s… | traced | https://ahrefs.com/blog/why-chatgpt-cites-pages/ |
| 81.11 | The best evidence so far comes from a Princeton study of generative engines, which tested changes to the same pages. Adding quotations, s… | traced | https://ahrefs.com/blog/why-chatgpt-cites-pages/ |
| 19 | ReachKit is built for exactly this gap, and we started with our own site. On 28 September 2026 our own scan scored reachkit.app 19 of 100… | traced | https://reachkit.app/scan/reachkit.app |
| 100 | ReachKit is built for exactly this gap, and we started with our own site. On 28 September 2026 our own scan scored reachkit.app 19 of 100… | traced | https://reachkit.app/scan/reachkit.app |
| 12 | It measures. "We ask AI your market's 12 biggest questions every week and show which ones name you and which name a rival. Then we write … | traced | https://reachkit.app/ |
| 49 | It costs one price. "€49 a month, VAT included. A page written and published for your site every day, your market re-measured every week.… | traced | https://reachkit.app/pricing |
| 5 | Seer Interactive, How AI Overviews are impacting CTR: 5 initial takeaways, 24 September 2024. | traced | https://www.seerinteractive.com/insights/how-ai-overviews-are-impacting-ctr-5-initial-takeaways |
| 1.4 | Ahrefs, Why ChatGPT cites pages, 1.4 million prompts. | traced | https://ahrefs.com/blog/why-chatgpt-cites-pages/ |

## Topics

B's small-tier call scored these at fit 2 or more (ranked fit first, then source — AI-answer gap, product, problem, buyer question, best-X — then volume):

| Search | Fit | Source | Kind | Measured | Why |
|---|---|---|---|---|---|
| best ai seo software | 3 | ai_gap | answer | volume 210 | ReachKit is AI-powered SEO software that finds AI-answer gaps and writes pages to fill them. |
| what is the best seo software | 3 | ai_gap | answer | volume 210 | ReachKit directly answers this question as an AI-powered SEO solution for findability. |
| seo ai software | 3 | ai_gap | answer | volume 170 | ReachKit is exactly this: AI-powered software for SEO targeting AI answers and Google search. |
| ai tool seo | 3 | ai_gap | answer | volume 140 | ReachKit is an AI tool that writes pages to improve SEO visibility in AI answers. |
| best seo ai | 3 | ai_gap | answer | volume 140 | ReachKit uses AI to write SEO pages targeting AI answers and search. |
| how to get found by chatgpt and google ai | 3 | ai_gap | problem_howto | proposed | AI answers cite competitors; this exact problem is ReachKit's core offering and no AI answer names it. |
| how to rank in ai answers | 3 | ai_gap | problem_howto | proposed | Core problem ReachKit solves; AI answers cite SEO tools but not guidance on AI-answer ranking. |
| best ai seo tools | 3 | product | answer | volume 880 | ReachKit is among best AI SEO tools, offering AI-answer targeting and automated page writing. |
| ai powered seo tool | 3 | product | answer | volume 880 | ReachKit is a clear example of AI-powered SEO tool with daily page generation. |
| ai tool for seo | 3 | product | answer | volume 880 | ReachKit is an AI tool purpose-built for SEO visibility and content. |
| ai tools for seo | 3 | product | answer | volume 880 | ReachKit is one of the best AI tools for SEO, combining AI writing with search optimization. |
| automated seo tool | 3 | product | answer | volume 720 | ReachKit automates SEO page writing and market measurement on a daily and weekly schedule. |
| seo ai tools | 3 | product | answer | volume 590 | ReachKit is a leading SEO AI tool, writing pages to target AI-answer gaps. |
| best ai tools for seo | 3 | product | answer | volume 480 | ReachKit is a best-in-category AI tool for SEO targeting and automation. |
| ai seo software | 3 | product | answer | volume 390 | ReachKit is AI SEO software for targeting AI answers and improving findability. |
| best seo software for small businesses | 3 | product | answer | volume 260 | ReachKit is designed for small-company owners with no SEO knowledge; €49/month, one page/day. |
| seo content writing software | 3 | product | answer | volume 170 | ReachKit writes one SEO page per day, grounded in the customer's own site facts. |
| seo content writer software | 3 | product | answer | volume 170 | ReachKit is content-writing software for SEO, using AI grounded in customer facts. |
| best seo automation software | 3 | product | answer | volume 140 | ReachKit automates page writing (one per day) and weekly market re-measurement. |
| ai software for seo | 3 | product | answer | volume 140 | ReachKit is AI software for SEO: finds gaps in AI answers, writes pages to fill them. |
| reachkit vs semrush | 3 | product | comparison | proposed | Direct product comparison: ReachKit's AI-answer focus vs. Semrush's broader SEO suite. |
| reachkit vs behindrankings | 3 | product | comparison | proposed | BehinRankings is a named rival; direct comparison of AI-answer-targeting approaches. |
| seo for ai recommendations | 3 | problem | problem_howto | proposed | ReachKit solves this: helps businesses appear in ChatGPT and Google AI recommendations. |
| find missing keywords in ai answers | 3 | problem | problem_howto | proposed | ReachKit's scan finds questions rivals answer but this business doesn't; the core problem it solves. |
| best google seo tools | 2 | ai_gap | answer | volume 140 | ReachKit improves Google search findability and ranks alongside Google-focused SEO tools. |
| ai tools market | 2 | ai_gap | answer | volume 70 | ReachKit is an AI tool in the SEO market, measuring and improving AI visibility. |
| ai seo tools | 2 | product | answer | volume 2400 | ReachKit is one AI SEO tool; competes with other AI-powered SEO platforms. |
| best rank tracking software | 2 | product | answer | volume 880 | ReachKit measures search rankings and AI answers weekly; tells you what moved every Monday. |
| best rank tracker software | 2 | product | answer | volume 880 | ReachKit tracks search rankings and measures visibility in AI answers weekly. |
| seo software affiliate | 2 | product | answer | volume 260 | ReachKit is a resellable SEO software product (with written agreement for bulk resale). |
| best seo software review | 2 | product | answer | volume 210 | ReachKit is a review-worthy SEO software with a clear differentiation: AI-answer targeting. |
| automated seo software free | 2 | product | answer | volume 170 | ReachKit automates SEO content; free scan available, paid plan €49/month. |
| best app for seo | 2 | product | answer | volume 140 | ReachKit is a web-based app for SEO improvement via AI-targeted content. |
| best free software for seo | 2 | product | answer | volume 140 | ReachKit offers a free scan and public report; the paid product is €49/month. |
| google rank software | 2 | product | answer | volume 140 | ReachKit tracks Google rankings weekly and measures search visibility. |
| seo software pricing | 2 | product | answer | volume 140 | ReachKit has transparent pricing: €49/month, VAT included, one plan, cancel anytime. |
| free trial seo software | 2 | product | answer | volume 140 | ReachKit's free scan and report function as a trial; paid plan is €49/month. |
| best seo software free | 2 | product | answer | volume 140 | ReachKit's free scan and permanent public report provide free SEO measurement. |
| ai seo tools 2025 | 2 | product | answer | volume 40 | ReachKit is a current AI SEO tool relevant to searches for 2025 AI solutions. |
| chatgpt alternative seo tool | 2 | product | comparison | proposed | ReachKit uses AI (Anthropic) for content; positions as ChatGPT-integrated SEO, not ChatGPT replacement. |
| cheapest ai seo software | 2 | product | answer | proposed | ReachKit at €49/month is competitive; appeals to price-conscious SMB buyers. |

## Research

- "best ai seo software" (stored top ten): https://onelittleweb.com/top-tools/best-ai-seo-tools/ — read; https://www.rankability.com/blog/best-ai-seo-tools/ — read; https://www.reddit.com/r/seogrowth/comments/1pva4y0/what_are_the_top_ai_powered_seo_services_to_boost/ — HTTP 403; https://seo.ai/ — read
- "best seo software review" (stored top ten): https://www.marketermilk.com/blog/best-seo-tools — read; https://technologyadvice.com/blog/sales/best-seo-tools/ — read; https://www.reddit.com/r/SEO/comments/1ehb8w3/best_seo_tool/ — HTTP 403; https://morningscore.io/best-seo-tools/ — read
- "what is the best seo software" (stored top ten): https://www.marketermilk.com/blog/best-seo-tools — read; https://technologyadvice.com/blog/sales/best-seo-tools/ — read; https://zapier.com/blog/best-seo-tools/ — read
- "how to get found by chatgpt and google ai" (web search): https://www.dynadot.com/blog/how-to-get-found-in-chatgpt/ — read; https://elhamgrowthstudio.substack.com/p/can-google-chatgpt-and-ai-search — read; https://blog.hubspot.com/marketing/how-to-show-up-in-chatgpt-results — read
- "why does chatgpt recommend my competitors" (web search): https://luxe.digital/business/why-chatgpt-recommends-your-competitor/ — read; https://www.trustsignals.com/blog/why-does-chatgpt-recommend-your-competitors-instead-of-you — read; https://www.mersel.ai/blog/chatgpt-recommends-your-competitor — read
- B1's claims dropped: none
- B2's claims dropped: "Surfer has three pricing tiers, and you also get a 20% discount if you pay annually." (not on the page word for word); "Their CEO Max was generous enough to give me a 20% off discount for any of my readers that" (not on the page word for word)
- B3's claims dropped: "a May 2026 analysis of 1,028,959 cited URLs reported that pages without query strings aver" (not on the page word for word); "A Search Engine Land analysis spanning 15 domains, almost 2 million monthly organic sessio" (not on the page word for word); "Bing's AI Performance dashboard, launched in public preview on February 10, 2026, reports " (not on the page word for word); "Measure What it describes LCP Loading of the largest visible content 2.5 seconds or less I" (not on the page word for word); "Domains with a presence on major review platforms earn triple the amount of ChatGPT citati" (not on the page word for word)

Each page is read for claims up to 4000 words, and for the non-commodity listing up to 2500 words.

## Every call

| Page | Step | Model | Tokens in | Tokens out | Searches | Cost |
|---|---|---|---|---|---|---|
| A1 | generate.brief | claude-haiku-4-5 (product tier) | 1853 | 227 | 0 | 0.30¢ |
| A1 | generate.outline | claude-haiku-4-5 (product tier) | 1986 | 89 | 0 | 0.24¢ |
| A1 | generate.brief | claude-haiku-4-5 (product tier) | 1853 | 220 | 0 | 0.30¢ |
| A1 | generate.outline | claude-haiku-4-5 (product tier) | 1979 | 83 | 0 | 0.24¢ |
| A1 | generate.draft | claude-haiku-4-5 (product tier) | 2818 | 688 | 0 | 0.63¢ |
| A1 | generate.answerability | claude-haiku-4-5 (product tier) | 3333 | 226 | 0 | 0.45¢ |
| A1 | eval.grade | claude-haiku-4-5 (product tier) | 2077 | 197 | 0 | 0.31¢ |
| A2 | generate.brief | claude-haiku-4-5 (product tier) | 1856 | 257 | 0 | 0.31¢ |
| A2 | generate.outline | claude-haiku-4-5 (product tier) | 2016 | 69 | 0 | 0.24¢ |
| A2 | generate.draft | claude-haiku-4-5 (product tier) | 2938 | 795 | 0 | 0.69¢ |
| A2 | generate.answerability | claude-haiku-4-5 (product tier) | 3539 | 201 | 0 | 0.45¢ |
| A2 | eval.grade | claude-haiku-4-5 (product tier) | 2171 | 219 | 0 | 0.33¢ |
| A3 | generate.brief | claude-haiku-4-5 (product tier) | 1821 | 238 | 0 | 0.30¢ |
| A3 | generate.outline | claude-haiku-4-5 (product tier) | 2094 | 61 | 0 | 0.24¢ |
| A3 | generate.draft | claude-haiku-4-5 (product tier) | 2864 | 670 | 0 | 0.62¢ |
| A3 | generate.answerability | claude-haiku-4-5 (product tier) | 3398 | 192 | 0 | 0.44¢ |
| A3 | eval.grade | claude-haiku-4-5 (product tier) | 2070 | 246 | 0 | 0.33¢ |
| B1 | eval.grade | claude-haiku-4-5 (product tier) | 4753 | 215 | 0 | 0.58¢ |
| B1 | eval.grade | claude-haiku-4-5 (product tier) | 4748 | 215 | 0 | 0.58¢ |
| B2 | eval.grade | claude-haiku-4-5 (product tier) | 4601 | 251 | 0 | 0.59¢ |
| B2 | eval.grade | claude-haiku-4-5 (product tier) | 4306 | 292 | 0 | 0.58¢ |
| B3 | eval.grade | claude-haiku-4-5 (product tier) | 5184 | 216 | 0 | 0.63¢ |
| B3 | eval.grade | claude-haiku-4-5 (product tier) | 5240 | 232 | 0 | 0.64¢ |
| C | eval.grade | claude-haiku-4-5 (product tier) | 5575 | 238 | 0 | 0.68¢ |
| topics | topic | claude-haiku-4-5 | 8088 | 2950 | 0 | 2.28¢ |
| B1 | claims | claude-haiku-4-5 | 11015 | 1117 | 0 | 1.66¢ |
| B1 | write | claude-sonnet-5 | 8830 | 6765 | 0 | 8.53¢ |
| B1 | critic | claude-sonnet-5 | 13684 | 4616 | 0 | 7.35¢ |
| B2 | claims | claude-haiku-4-5 | 17756 | 1152 | 0 | 2.35¢ |
| B2 | write | claude-sonnet-5 | 8646 | 6021 | 0 | 7.75¢ |
| B2 | critic | claude-sonnet-5 | 12375 | 4199 | 0 | 6.67¢ |
| B3 | search | claude-haiku-4-5 | 11603 | 69 | 1 | 2.19¢ |
| B3 | claims | claude-haiku-4-5 | 14452 | 1614 | 0 | 2.25¢ |
| B3 | write | claude-sonnet-5 | 9215 | 9369 | 0 | 11.21¢ |
| B3 | critic | claude-sonnet-5 | 14255 | 4772 | 0 | 7.62¢ |
| C | search | claude-haiku-4-5 | 11545 | 66 | 1 | 2.19¢ |
| A1 | grade: non-commodity | claude-haiku-4-5 | 11833 | 241 | 0 | 1.30¢ |
| A2 | grade: non-commodity | claude-haiku-4-5 | 14927 | 169 | 0 | 1.58¢ |
| A3 | grade: non-commodity | claude-haiku-4-5 | 14451 | 315 | 0 | 1.60¢ |
| B1 | grade: non-commodity | claude-haiku-4-5 | 13889 | 533 | 0 | 1.66¢ |
| B2 | grade: non-commodity | claude-haiku-4-5 | 16138 | 217 | 0 | 1.72¢ |
| B3 | grade: non-commodity | claude-haiku-4-5 | 16995 | 184 | 0 | 1.79¢ |
| C | grade: non-commodity | claude-haiku-4-5 | 17000 | 424 | 0 | 1.91¢ |

## Files

Every page is under `docs/walk/ab-reachkit/` as `A1.md` … `B3.md` and `C-reference.md`; a B page the critic rewrote keeps its draft as `B<n>-before-critic.md`. `blind/` holds each A–B pair relabelled X and Y at random, and `blind/key.md` the mapping.
