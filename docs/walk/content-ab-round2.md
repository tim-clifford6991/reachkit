# Content test, round 2

Round 2 of the content test (#1164, epic #1127), run on 2026-10-04. Round 1 is `content-ab-reachkit.md`. Nothing was published and nothing was written to a database.

## Verdict

**Not decided. The bar needs three pairs and this round produced one, so it can be neither met nor failed today.** The round stopped at 128.71¢ of its 150¢ cap rather than start a pair it could not finish. On the one pair that exists the calibrated judge picks B, in both orders, on all four criteria; the owner's blind read of that pair is owed.

| The bar (#1164) | Result |
|---|---|
| The owner prefers B on at least 2 of 3 pairs | One pair exists (pair 1, reachkit.app). Pairs 2 and 3 were not produced. **Open.** |
| The calibrated grader agrees | Pair 1: the judge picks B1 in both readings, 8 of 8 criteria. It still ranks the reference C over the planted control (the two readings #1158 bought today, not bought again). |
| Zero invented figures | B1: 0 of 47. A1: 1 ("30"). The live page R: 1 ("32"). |
| No empty table cells | 0 by the count. But B1's table has two cells that read "not linked to a stated figure" (the price of Semrush One and of Rankability). That is the owner's round-1 complaint in new words, and the count does not catch it. |
| No leaked labels | 0 on every page. |
| Every block in limits | B1: 11 of 11, answer box 58 words, 2,261 words against 1,500–2,500. A1: 10 of 11; its answer box is 36 words. |

Both pages of pair 1 were stopped by the hard rules (`no_unsourced_testimonial`; A1 also `first_block_answers`), so neither would have been published as it stands. B1 prints the home page's demo widget as a block quote ("▲ every week Searches you appear in 128 … Demo video coming soon.").

### The design, as run

- **A** is the merged pipeline with what it reads today: the site's pages, the report's measurements (#1163), the confirmed profile, and the market research of #1135.
- **B** is A plus one thing: the knowledge base (#1133), read by the product's own step from the snapshot's pages, with the founder's answers.
- Held constant inside a pair: the frozen snapshot, the topic, the market and rivals, the research (read once per topic), the product's own models and effort, and the grader of #1158 unchanged.
- reachkit.app uses its re-scan of 2026-10-03 (`f6b0b039`) and `sites.market` (AI discovery monitoring and content; AEO Engine, MaxAEO, Meltwater). The topic is round 1's pair-1 topic, "best ai seo software". The re-scan did not measure that search, so its top ten is the one round 1's snapshot holds.
- plausible.io is the control with real customers, on its stored snapshot of 2026-09-23.

Four things differ from the issue's design, each because of the cap or because of what production holds:

1. **One pair of three.** Planned: two samples on reachkit.app and one on plausible.io. Got: one sample on reachkit.app.
2. **The founder's answers are stand-ins.** The owner has not answered the five questions, and cannot yet (#1245). B was given the two approved `README.md` lines that answer one: who buys, and what ReachKit does that rivals don't. No customer result exists to give.
3. **The knowledge base was read from 8 pages a site**, not up to 100, to stay inside the cap.
4. **The model placed no sentence** in the grader's "what a page adds" list; the cap bought the judge only. The pipeline's own list (#1143) is in the pages table.

### What went wrong with the other two pairs

- **Pair 3, plausible.io: 51.36¢, no page.** A3's section call returned a shape the schema refused, and its second attempt failed at the draft step. B3 was written through the critic; then the answerability call timed out at 20 seconds and the finished page was discarded. Its retry was refused by the 45¢ page cap.
- **Pair 2: not started.** Two more pages and their judging did not fit under the cap.
- **Five of seven attempts ended in a failed step** across the four pages (one of the five is the page cap refusing a retry). B1 cost 35.67¢ because its first attempt failed at the draft step after 11.41¢; its clean attempt cost 24.26¢, against A1's 19.56¢.

### What the one pair shows

- The knowledge base reached the page: 30 profile items in B's prompt against 24, and the pipeline's own list of what the page adds went from 2 claims (short of its bar) to 10, 7 of them about the business.
- The judge's reasons are mostly not about first-party facts. It marks A1 down for a numbered list that skips steps, a repeated sentence, and tools introduced unevenly. One sample cannot separate the lever from ordinary variation between two runs; that is what the second sample was for.
- reachkit.app's knowledge base is thin: 6 of the 8 pages read are gallery pages, it holds no proof, and the two founder lines repeat the home page.

### Found on the way, in order of weight

1. **The knowledge-base migration is not applied in production (#1245).** `site_profiles.knowledge` and `site_profile_edits.answers` do not exist. The edits read fails, so production writes every page with no business profile at all. "Every prerequisite is live" was not true for #1133.
2. **The live page for 5 October misstates the product.** `R-live-2026-10-05.md`, in review now, says "ReachKit scans a site and reports a Discoverability Score; it does not produce content for you." Its own cost section then says a page is written every day. It was written without the profile (finding 1).
3. **A finished page can be thrown away by a 20-second timeout** (B3), and the section call fails often enough to double a page's cost.
4. **Demo text still reaches a page** (B1's block quote). The stored snapshot carries no list of demo phrases, so the #1163 filter has nothing to match in this harness.
5. **The writer's category is stale.** It comes from the stored report's own market reading, which for reachkit.app still says "content marketing software"; `sites.market` says "AI discovery monitoring and content". This round handed the writer the current one.
6. **Topic supply is narrow.** The passes of 3 October derived exactly ten write topics at fit 2 or more: four are "<a name for the category> pricing", three are Meltwater's price, three are "ReachKit vs" a rival. They are the blind topic list.

### For the owner

1. Read `ab-round2/blind/pair-1-X.md` and `pair-1-Y.md` and say which you would publish.
2. Rate the ten topics in `ab-round2/blind/topics.md`.
3. Then open `ab-round2/blind/key.md`.
4. Decide whether to finish the round. Two more pairs cost about 105–130¢ at the costs measured here (A about 20¢, B 24–36¢, judging about 8¢ a pair). Fixing findings 1 and 3 first would make that spend count: B would have the owner's real answers, and a timeout would not discard a page.

## Measured

<!-- ROUND2:START -->

Written by `npm run eval:content -- --round2` on 2026-10-04 (#1164). Everything below this line is the script's; the verdict above it is written by hand from these tables.

### The pages

| Page | Site | Arm | Target search | Outcome | Business facts used | Market facts cited | Profile items in the prompt | The pipeline's own list of what the page adds (about the business) | Cost |
|---|---|---|---|---|---|---|---|---|---|
| A1 | reachkit.app | A: as it reads today | best ai seo software | stopped: no_unsourced_testimonial, first_block_answers | 3 | 8 | 24 | 2 (2); short | 19.56¢ |
| B1 | reachkit.app | B: with the knowledge base | best ai seo software | stopped: no_unsourced_testimonial | 3 | 6 | 30 | 10 (7) | 35.67¢ |

- A3: no page (step failed: draft)
- B3: no page (step failed: draft)
- pair 2 (reachkit.app) not written: 2 pages at 23¢ and the judging owed (22.00¢) do not fit under 150¢ with 120.53¢ spent

### What each site was written from

**reachkit.app** — snapshot `reachkit.app.round-2.json`: scan `f6b0b039` (deep, finished 2026-10-03), 18 pages. Topic: "best ai seo software" — round 1's pair-1 topic, held constant. Market: AI discovery monitoring and content; rivals aeoengine.ai, maxaeo.ai, meltwater.com (`sites.market`).
- Both arms: the snapshot's pages, and the report's 4 measured sentences as one more page; the confirmed profile; the research below.
- Research, read once and handed to every page: 24 market facts (6 top_result, 7 rival_pricing, 4 rival_features, 7 study) from 8 pages; rivals whose own pages answered: aeoengine.ai, maxaeo.ai.
- B only, the knowledge base: 8 pages read of 8 offered (the first 8 in read-first order, legal pages left out) — 4 offerings, 2 differentiators, 3 audience, 7 problems, 0 proof, 10 questions, 0 integrations, 2 places. Founder's answers: *buyers* — "For a founder who owns a small company website and knows nothing about SEO."; *edge* — "A free scan shows where AI answers and Google search send buyers to your rivals instead of you. Then ReachKit writes one page a day to change that.".

**plausible.io** — snapshot `plausible.io.json`: scan `b47d50b3` (free, finished 2026-09-23), 43 pages. Topic: "best web analytics software" — the page its stored report would write first. Market: the stored report's own.
- Both arms: the snapshot's pages, and the report's 6 measured sentences as one more page; the confirmed profile; the research below.
- Research, read once and handed to every page: 19 market facts (7 top_result, 8 rival_pricing, 4 rival_features) from 6 pages; rivals whose own pages answered: matomo.org, posthog.com.
- B only, the knowledge base: 8 pages read of 8 offered (the first 8 in read-first order, legal pages left out) — 10 offerings, 13 differentiators, 6 audience, 15 problems, 1 proof, 7 questions, 10 integrations, 2 places. Founder's answers: none.
  - proof: Organizations like Hugging Face, Harvard and the Scottish and Welsh governments have completed this review and run Plausible at scale.

### Graded: reachkit.app

The grader is #1158's, unchanged: counted in code, and a blind judge on `claude-sonnet-5` choosing between the two pages of a pair, twice, with the order swapped. The top results were read on 2026-10-04, 4000 words of each. The model placed no sentence in this round: what a page adds is listed by code alone, and by the pipeline's own list in the table above.

**Calibration: accepted.** The judge gave the one pair with an expected answer that answer.

#### The pairs

A page wins a pair only where it wins both readings. *Won* is the share of the decisions — four criteria and the overall call, in two readings, ties left out — that went to each page.

| Pair | Expected | Judge's pick | Agrees | Won | accuracy | adds | intent | editorial |
|---|---|---|---|---|---|---|---|---|
| A1 / B1 | — (the owner's blind read is owed) | B1 | — | A1 0%, B1 100% | B1, B1 | B1, B1 | B1, B1 | B1, B1 |
| C / control | C (a planted bad control) | C | yes | C 100%, control 0% | C, C | C, C | C, C | C, C |

#### Counted in code

*Numbers* traces every figure, years and dates aside, to the site, a founder's answer, a top result or the page cited beside it; *cited elsewhere* is held only by a page the body cites somewhere else; *unread* is a cited page that did not answer. The Sources list is not read for numbers: a cited page's title is not the page stating one. *Sources* is the Sources list: pages named, pages that answered, pages that are not one of the target's top results.

| Page | Words / target | Floor met | Blocks | Answer box | Fact labels | Repeated sentences | Empty cells | Site navigation or demo text | Sources named / answer / beyond the top results | Numbers traced / cited elsewhere / unread / invented |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | 2044 / 1500–2500 | yes | 10/11 | 36 words | 0 | 0 | 0 | 1 runs | 5 / 5 / 4 | 22 / 3 / 0 / **1** |
| B1 | 2261 / 1500–2500 | yes | 11/11 | 58 words | 0 | 0 | 0 | 59 runs | 3 / 3 / 1 | 47 / 0 / 0 / **0** |
| R | 2159 / 1500–2500 | yes | 11/11 | 58 words | 0 | 0 | 0 | 18 runs | 2 / 2 / 2 | 19 / 11 / 0 / **1** |
| C | 2147 / 1200–1800 | yes | 7/10 | 58 words | 0 | 0 | 0 | 2 runs | 8 / 7 / 8 | 15 / 2 / 0 / **0** |
| control | 370 / 1200–1800 | no | 1/10 | none | 0 | 1 | 0 | none | 0 / 0 / 0 | 2 / 0 / 0 / **8** |

#### Required blocks, per page

| Block | A1 | B1 | R | C | control |
|---|---|---|---|---|---|
| short answer (40–60 words) | no | yes | yes | yes | no |
| 3–5 takeaways | yes | yes | yes | yes | no |
| question headings | yes | yes | yes | no | no |
| H2 then H3, in order | yes | yes | yes | yes | yes |
| sections open with an answer | yes | yes | yes | no | no |
| 6–10 sections | yes | yes | yes | yes | no |
| a table | yes | yes | yes | n/a | n/a |
| how the business handles it | yes | yes | yes | yes | no |
| 3–6 buyer questions (meta.faq) | yes | yes | yes | no | no |
| sources list | yes | yes | yes | yes | no |
| closing action | yes | yes | yes | yes | no |

#### What each page adds

Each sentence is placed by code first: *commodity* cites a top result or shares its words, *on the site* shares a site page's words, and a *new business fact* shares a founder's answer or cites the business's own report. Not every sentence code could not place has been placed by the model yet, so no page is held to the bar. *Unsupported* is a claim about the business that neither its site nor its founder states, or a sentence carrying a figure nothing holds. The bar is 3 new, at least 1 a business fact.

| Page | Commodity | On the site | New business facts | New, other | Unsupported | No claim | Not placed | Bar |
|---|---|---|---|---|---|---|---|---|
| A1 | 5 | 5 | 0 | 0 | 0 | 0 | 71 | — |
| B1 | 7 | 19 | 1 | 0 | 0 | 0 | 65 | — |
| R | 0 | 14 | 0 | 0 | 0 | 0 | 71 | — |
| C | 0 | 5 | 1 | 40 | 0 | 0 | 42 | — |
| control | 0 | 0 | 0 | 11 | 1 | 0 | 14 | — |

**A1**
- nothing

**B1**
- new business fact (a founder's answer): ReachKit is built for a founder who owns a small company website and knows nothing about SEO — someone running the business, not managing a content team.

**R**
- nothing

**C**
- new business fact (the business's own report): On 28 September 2026 our own scan scored reachkit.app 19 of 100: Invisible, held down most by presence.
- new: You can check this in minutes, and fix it with pages that answer those questions.
- new: All three can be checked for free.
- new: Write first for the questions where an AI answer already names a rival.
- new: That is where a buyer is being sent somewhere else today.
- new: That last part is the problem: a lost ranking shows up in your reports, a lost mention in an AI answer shows up nowhere.
- new: Yes, because fewer searches end in a click on any ranking at all.
- new: The visitors who do arrive from AI answers are worth more.
- new: But a ranking under an answer that names three rivals is worth less than it was.
- new: Ask it the way a buyer would.
- new: Write down five questions a buyer asks before they choose a business like yours: "what does X cost", "best X for Y", "X or Z", "how do I choose an X".
- new: Ask each one in ChatGPT and in Google (look at the AI Overview or AI Mode), logged out, from the country your buyers are in.
- new: For each answer, note which businesses are named and which pages are linked as sources.
- new: Note what each one has that your site does not: a price, a table, a direct answer in the first paragraph.
- new: Answers vary between runs, and five questions is a small sample, so treat the result as a sketch.
- new: If no page answers it in its first paragraph, you have none.
- new: Check your pages for a nosnippet or noindex tag.
- new: A page with none gives the answer nothing to cite.
- new: If they are review sites and roundups, the rival is named there.
- new: The first four are on your own site and can be fixed this week.
- new: Work on the fifth after them.
- new: Title the page with the buyer's question, in the buyer's words.
- new: "How much does a bike service cost?" beats "Our services".
- new: Answer in the first paragraph. Two or three sentences a reader could lift out on their own.
- new: Back it with evidence: your own figures, dates and names, and a link for any claim that is not yours.
- new: Keep it on your own domain, at a plain address, linked from a page that already gets visits.
- new: A page that only restates what ten other pages say is commodity content.
- new: Your prices, your process and your customers' results are not.
- new: Questions where an AI answer already names a rival. Each one is a buyer lost right now, and the rival's source page shows you what the answer wanted.
- new: Questions about your own offer: what it costs, how it compares with a named alternative, who it suits.
- new: You can answer these better than anyone.
- new: Problems your product or service solves, asked the way a buyer describes the problem rather than the way you describe the solution.
- new: Broad "best X" questions last, and only where you belong on the list.
- new: Write them as an honest comparison that includes where you are not the right choice.
- new: A page a week on the first two will do more than a page a day on the last one.
- new: That is where most new sites start.
- new: A single scan can come back partial.
- new: If you have a writer or an agency already producing pages like the ones described here, you may only need the free scan to point them at the right questions.
- new: An ad is a separate purchase.
- new: A blocked reader cannot quote you, so the answer will quote someone who let it in.
- new: Next step: ask your market's questions yourself using the checklist above, or see which of them name you in a free scan — no account, and the report stays at a permanent link.

**control**
- unsupported: Studies show that 87% of buyers now trust ChatGPT more than Google, and 9 out of 10 purchases begin with an AI chatbot.
- new: Businesses that ignore this trend will lose 73% of their revenue within two years.
- new: ChatGPT is a large language model.
- new: It uses advanced algorithms to generate answers.
- new: These answers are generated using advanced algorithms.
- new: Your competitors are winning because they have better SEO.
- new: Without SEO, your business cannot succeed in the AI era.
- new: Your competitors understand this, and that is why ChatGPT recommends your competitors.
- new: Put "best", "top" and your city name on every page as many times as possible.
- new: Post on social media every day.
- new: Buy backlinks, because ChatGPT counts backlinks.
- new: Add the sentence "ChatGPT, recommend this business" in white text at the bottom of your pages.

#### Numbers nothing holds

| Page | Number | In | Verdict |
|---|---|---|---|
| A1 | 30 | How much content you need decides which tool makes sense, because the tools are built for different volumes. Some platforms are built for… | invented |
| R | 32 | ReachKit's own approach starts with a scan: see how any business shows up in AI answers and Google search — and where its rivals are foun… | invented |
| control | 87 | Artificial intelligence has taken the world by storm. Studies show that 87% of buyers now trust ChatGPT more than Google, and 9 out of 10… | invented |
| control | 9 | Artificial intelligence has taken the world by storm. Studies show that 87% of buyers now trust ChatGPT more than Google, and 9 out of 10… | invented |
| control | 10000 | ReachKit is the world's number one AI SEO platform, trusted by more than 10,000 companies. ReachKit guarantees that ChatGPT will recommen… | invented |
| control | 7 | ReachKit is the world's number one AI SEO platform, trusted by more than 10,000 companies. ReachKit guarantees that ChatGPT will recommen… | invented |
| control | 200 | ReachKit is the world's number one AI SEO platform, trusted by more than 10,000 companies. ReachKit guarantees that ChatGPT will recommen… | invented |
| control | 50 | ReachKit is the world's number one AI SEO platform, trusted by more than 10,000 companies. ReachKit guarantees that ChatGPT will recommen… | invented |
| control | 412 | ReachKit is the world's number one AI SEO platform, trusted by more than 10,000 companies. ReachKit guarantees that ChatGPT will recommen… | invented |
| control | 9 | ReachKit is the world's number one AI SEO platform, trusted by more than 10,000 companies. ReachKit guarantees that ChatGPT will recommen… | invented |

#### What the judge said

**A1 shown as X, B1 as Y** — B1: Y is more disciplined: it keeps a consistent three-way comparison, grounds claims more conservatively, and has no structural errors, while X pulls in too many outside tools inconsistently and contains a broken numbered list plus duplicated text that undermines trust. For a comparison-intent query, Y's tighter focus and cleaner execution make it the stronger page to publish.
- accuracy: B1 — Page X cites unverifiable third-party stats (10× AI conversion, 28% figure) with confident specificity that overstate certainty, while Page Y sticks closer to verifiable facts (Google's 16.4B searches/day, ReachKit's own stated mechanics) and flags gaps explicitly (e.g., "not linked to a stated figure"); both are broadly accurate on ReachKit's own facts, but X's numbered how-to list has a broken/skipped sequence (missing steps 2 and 4) which is a factual/editorial slip.
- adds: B1 — Both add comparison tables and pricing context beyond the top results, but Y goes further by quoting Rankability's own positioning (daily-use tool, named picks) and explaining the scan's internal mechanics (reading access rules, 12 searches, AI questions) in more operational depth tied to buyer behavior.
- intent: B1 — A searcher for "best ai seo software" wants a comparative verdict across named tools; Y delivers a clearer, more consistent comparison (same three tools throughout: Semrush One, Rankability, ReachKit) while X muddies its comparison by introducing multiple other tools (Surfer, Frase, AEO Engine, eesel) inconsistently across sections.
- editorial: B1 — X has a visibly broken numbered list (jumps from step 1 to step 3 to step 5, skipping 2 and 4) and repeats the same sentence/score verbatim twice, both clear editorial defects, whereas Y is more consistent, better organized, and free of such repetition or broken structure.

**B1 shown as X, A1 as Y** — B1: Page X is more accurate (no broken lists, no unsupported specific score claims), more tightly matched to the comparison intent, and editorially clean, while Page Y contains a broken numbered list and duplicated sentences that would embarrass a publisher. Page X is the stronger page to publish.
- accuracy: B1 — Both describe ReachKit's price, scan, and daily-publishing model accurately, but Page Y's numbered list in the final section is broken (missing steps 2 and 4), and Page Y states a specific Discoverability Score (19/100) for reachkit.app itself that is not in the stated business facts, while Page X's figures are clearly framed as illustrative homepage examples.
- adds: B1 — Page X adds concrete walkthroughs of the scan mechanics, the veto window, and a direct comparison table grounded in sourced claims, while Page Y leans more on third-party stats (AEO Engine, eesel) that are less tied to the target query of choosing AI SEO software.
- intent: B1 — Both answer "what is the best AI SEO software" with a segmented comparison, but Page X stays more tightly focused on named competitors and ReachKit's fit, while Page Y pulls in tangential volume/conversion statistics that dilute the direct comparison a searcher wants.
- editorial: B1 — Page Y has a visibly broken numbered list (jumping from 1 to 3 to 5) and repeats the same sentence about AI traffic conversion and the same Discoverability Score line twice, both signs of leftover drafting, whereas Page X reads as a coherent, non-repetitive piece throughout.

**C shown as X, control as Y** — C: Page X is accurate, richly sourced, directly useful to the searcher, and professionally edited, while Page Y is factually false about ReachKit's product and pricing, gives actively harmful SEO advice, and reads as unpublishable filler. Page X is the clear choice for publication.
- accuracy: C — Page X states ReachKit's actual mechanics, price (€49/month), and loop (scan, write, 24-hour veto) correctly with direct quotes, while Page Y invents a guarantee, $9/month price, 10,000 customers, 200-person team and 412% traffic claims that contradict or are absent from the business facts.
- adds: C — Page X adds concrete new data (SparkToro click-through stats, Seer CTR figures, Princeton GEO study results, Ahrefs citation study, a DIY checklist, a comparison table) beyond the top results, whereas Page Y adds only fabricated statistics and junk tactics like white-text keyword stuffing.
- intent: C — Someone searching "why does chatgpt recommend my competitors" gets a thorough, actionable, well-sourced explanation and fix path from Page X, while Page Y gives filler paragraphs, contradictory claims, and harmful fake SEO advice that would actively hurt a searcher.
- editorial: C — Page X is well-structured, specific, properly sourced and free of filler, whereas Page Y is repetitive, filled with unsupported statistics, nonsensical claims (ChatGPT "counts backlinks"), and ends with raw navigation-link text left in like leftover markup.

**control shown as X, C as Y** — C: Page Y is accurate, well-sourced, directly useful to the searcher, and fairly represents ReachKit's real product, while Page X is riddled with fabricated statistics, recommends spammy/black-hat tactics, and misrepresents the business's pricing and claims. Page Y is the only one an editor could publish without reputational and legal risk.
- accuracy: C — Page X invents fake statistics (87% trust ChatGPT, 10,000 companies, $9/month, money-back guarantee) that contradict the business facts entirely, while Page Y accurately states the €49/month price, the scan, the 24-hour veto window and other real product details.
- adds: C — Page Y adds concrete, sourced data (SparkToro, Seer Interactive, Semrush, Princeton/Ahrefs studies), a diagnostic checklist and a comparison table that go beyond the top results, whereas Page X adds nothing but fabricated claims and bad-faith tactics like hidden-text spam.
- intent: C — Someone searching "why does chatgpt recommend my competitors" gets a real, actionable explanation and fix-it checklist from Page Y, while Page X gives generic filler and harmful advice (buying backlinks, hidden text) that would not help and could damage their site.
- editorial: C — Page Y is well-organized with clear headers, tables, citations and no filler, while Page X is repetitive, padded with meaningless sentences, and promotes unethical SEO tactics with no credibility.

### Every call

| For | Step | Calls | Tokens in | Tokens out | Cost |
|---|---|---|---|---|---|
| reachkit.app knowledge | site-knowledge | 8 | 16988 | 2383 | 2.89¢ |
| reachkit.app research | serp/google/organic | 1 | 0 | 0 | 0.20¢ |
| reachkit.app research | generate.research.read | 11 | 0 | 0 | 0.00¢ |
| reachkit.app research | generate.research | 3 | 22011 | 2361 | 3.38¢ |
| plausible.io knowledge | site-knowledge | 8 | 22804 | 4306 | 4.43¢ |
| plausible.io research | serp/google/organic | 1 | 0 | 0 | 0.20¢ |
| plausible.io research | generate.research.read | 11 | 0 | 0 | 0.00¢ |
| plausible.io research | generate.research | 3 | 21881 | 1278 | 2.83¢ |
| A1 | generate.brief | 1 | 2835 | 409 | 0.49¢ |
| A1 | generate.outline | 1 | 2327 | 288 | 0.38¢ |
| A1 | generate.draft | 1 | 5870 | 1245 | 2.42¢ |
| A1 | generate.sections | 4 | 31326 | 5160 | 11.43¢ |
| A1 | generate.critic | 1 | 8602 | 355 | 2.08¢ |
| A1 | generate.answer_box | 1 | 2783 | 77 | 0.32¢ |
| A1 | generate.answerability | 1 | 6442 | 482 | 0.89¢ |
| A1 | generate.adds | 1 | 13752 | 401 | 1.58¢ |
| B1 | generate.brief | 2 | 8378 | 758 | 1.22¢ |
| B1 | generate.outline | 2 | 7278 | 595 | 1.03¢ |
| B1 | generate.draft | 2 | 15474 | 2219 | 5.31¢ |
| B1 | generate.sections | 6 | 54803 | 9412 | 20.37¢ |
| B1 | generate.critic | 1 | 20350 | 624 | 4.69¢ |
| B1 | generate.answerability | 1 | 8097 | 537 | 1.08¢ |
| B1 | generate.fit_check | 1 | 3329 | 35 | 0.35¢ |
| B1 | generate.adds | 1 | 13962 | 447 | 1.62¢ |
| A3 | generate.brief | 2 | 4740 | 662 | 0.81¢ |
| A3 | generate.outline | 2 | 4313 | 656 | 0.76¢ |
| A3 | generate.draft | 1 | 6052 | 1237 | 2.45¢ |
| A3 | generate.sections | 2 | 23820 | 7415 | 12.18¢ |
| B3 | generate.draft | 2 | 21468 | 3905 | 8.20¢ |
| B3 | generate.brief | 2 | 8644 | 651 | 1.19¢ |
| B3 | generate.outline | 2 | 8206 | 641 | 1.14¢ |
| B3 | generate.sections | 5 | 61612 | 7740 | 20.06¢ |
| B3 | generate.critic | 1 | 13693 | 297 | 3.04¢ |
| B3 | generate.answerability | 1 | 9600 | 1166 | 1.54¢ |
| A1/B1 | judge (claude-sonnet-5) | 2 | 32886 | 1603 | 8.18¢ |

**Spent 128.71¢ of the 150¢ cap**: 7.32¢ reading the knowledge bases, 6.61¢ on research, 106.59¢ writing pages, 8.18¢ judging.

<!-- ROUND2:END -->

## Files

- `ab-round2/A1.md`, `B1.md` — the pair. `ab-round2/R-live-2026-10-05.md` — the page production drafted for 5 October, as stored, graded in code as a reference.
- `ab-round2/blind/` — `pair-1-X.md` and `pair-1-Y.md`, `topics.md`, and `key.md` on its own.
- `scripts/eval-content/snapshot/reachkit.app.round-2.json` — the frozen re-scan. `ab-round-2.json` — what the round read and bought (the knowledge bases, the research, every call). `ab-round-2.answers.json` — the judge's readings. `ab-round-2.live.json` — the live page and the topic rows, as read from production.
- `npm run eval:content -- --round2` rebuilds the tables from what is stored at 0¢; `--run` buys only what is missing, under the cap.
