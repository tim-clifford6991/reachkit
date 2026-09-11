# Evidence — AI-answer visibility: what is measurable, at what cost, and how stable it is week to week

Sources: the vendor's own pricing and help pages, the incumbents'
published experiments, and the independent studies named below, every
page fetched and read on **2026-09-03**. Prices are taken from
`RESEARCH-dataforseo-endpoints.md` and not restated beyond the totals.

Bears on: BP-025 (the AI-answers card), BP-026, BP-038, BP-050 (the weekly
re-measurement), BP-051 (Monday verdicts); REQ-006, REQ-041, REQ-063,
REQ-065; `DATA-COSTS.md` §6 item 1 (the pinned run count) and §3's P8
("weekly movement").

Every quotation is verbatim from the page named, on the access date.
Numbers quoted are the studies' own; none is ours. Where a conclusion is
drawn for ReachKit it is marked "derived".

## 1. What is measurable, and what each measurement costs

Four things can be read from an AI answer without inference, and each has
a price on the endpoints the product admits:

| Measurable | Where it is read | Unit cost, 2026-09-03 |
|---|---|---|
| Whether an AI answer appeared for a search (AI Overview) | `ai_overview` item inside an organic SERP the product already buys | 0¢ for a cached overview; one extra base price (0.06¢ std / 0.2¢ live, refunded when unused) to fetch an asynchronous one — `RESEARCH-dataforseo-endpoints.md` §2.3 |
| Which domains the answer cites, and the text it cites them for | `references[].domain`, `references[].text` | inside the above |
| Whether the answer names the customer or a rival (mention) | string match over the answer's `markdown`/`text` | 0¢ |
| The same three on Google AI Mode | AI Mode SERP endpoint | 0.12¢ std / 0.4¢ live |
| The same three on ChatGPT search | LLM Scraper `sources`, `markdown` | 0.12¢ std / 0.4¢ live |
| The same on Perplexity, Claude, Gemini via API | LLM Responses | 0.06¢ + the model's own price; Perplexity live only |

What is *not* measurable without inference: sentiment, and whether a
mention is a recommendation. What is not measurable at all from the
answer: how many people asked the question. Semrush states the limit for
prompts generally: "Unlike keywords, individual prompts are often too
specific and unique to measure directly." (https://www.semrush.com/kb/1607-semrush-ai-visibility-data,
accessed 2026-09-03). Ahrefs states it for its own impressions number: "we
don't claim a validated link between Google search volume and how often a
query is asked inside an AI tool" (https://ahrefs.com/blog/brand-radar-methodology/,
accessed 2026-09-03).

Derived totals at ReachKit's pinned battery of 12 questions, one run each:
the weekly paid battery is 12 × (0.12 + 0.12)¢ = 2.88¢ at the vendor's
current AI Mode price, plus 0¢ to 1.56¢ for asynchronous AI Overviews on
the 13 target SERPs; ten runs per question per week, the sampling rule
`DATA-COSTS.md` §6 item 1 declines, would be 28.8¢ before the overviews.

## 2. Same prompt, run again: how much changes

**Brand lists.** SparkToro, dated "27 Jan 2026",
https://sparktoro.com/blog/new-research-ais-are-highly-inconsistent-when-recommending-brands-or-products-marketers-should-take-care-when-tracking-ai-visibility/
(accessed 2026-09-03):

- "600 volunteers ran 12 different prompts through each of the 3 tools a
  combined 2,961 times."
- "To get mathematical about it, there's a <1 in 100 chance that ChatGPT or
  Google's AI, if asked 100X, will give you the same list of brands in any
  two responses."
- "In fact, when it comes to ordering, AI tool responses are so random that
  it's more like 1 in 1,000 runs before you'd see two lists in the same
  order."
- And the counter-finding: "Even if rankings are random to the point of
  near-uselessness, appearances across dozens or hundreds of runs of the
  same prompt indicates a set of brands that the AI's system generally
  associates more (or less) as a good answer for the prompt intent.
  Measuring that percent visibility is (probably) a reasonable way to know
  how prominent or invisible your entity is within the AI's consideration
  set." Example: "City of Hope hospital in Los Angeles showed up in 69/71
  answers: a 97% visibility rate."

**Cited sources.** Parse, dated "July 8, 2026",
https://parse.gl/research/ai-citation-volatility-by-industry (accessed
2026-09-03):

- "We measured repeat answers from March 26 to April 25, 2026 on prompts
  with at least 12 answers that cited sources: 16,143 ChatGPT prompts and
  15,805 Google AI Overviews prompts, spanning 693,509 answers."
- "Two repeat ChatGPT answers to the same prompt shared only 21.2% of cited
  domains on average. The other 78.8% churned. Google AI Overviews was
  steadier, but still shared only 31.5% of sources."
- "For AI citations, the metric is how often a source appears across
  repeated runs. A single run is the anecdote."

**Why.** Otterly, "Last updated May 16, 2025",
https://otterly.ai/blog/why-does-chatgpt-provide-different-answers-to-the-same-question/
(accessed 2026-09-03): "Even with an identical prompt, the model doesn't
always generate responses in exactly the same way. This flexibility is due
to a mechanism called sampling, which introduces a degree of randomness".
And: "when you look at the brands being mentioned and the links being
cited, we do see exact or at least very similar results."

The vendor, on Google's surfaces: "Triggers are noisy. The same query can
produce a full overview on Monday, nothing on Tuesday, and a different
overview with a different source set on Wednesday. A daily pull is the
only way to keep up." (https://dataforseo.com/help-center/parse-google-ai-overviews-ai-mode,
accessed 2026-09-03.)

## 3. Day to day and week to week

**Day to day, sources.** GetMentions, dated "July 9, 2026",
https://www.getmentions.ai/blog/ai-citation-volatility-study (accessed
2026-09-03): "67,144 answers; 530,875 citations; 181,225 distinct URLs
across 55,387 domains" over "7 consecutive days, June 2026". "69% of the
typical answer's sources change from one day to the next." "Gemini keeps
28.1% of today's sources tomorrow; ChatGPT and Google AI Mode keep about
40%; Perplexity keeps 66.8%". "Sources cited all 7 days: 0.4% on Gemini,
11.1% on Perplexity". "84% of the sources cited for a question are used by
just one engine".

**Week to week, domains.** BrightEdge,
https://www.brightedge.com/resources/weekly-ai-search-insights/ai-search-citations-week-to-week-changes
(accessed 2026-09-03): "We track thousands of prompts across ChatGPT,
Gemini, Google AI Mode, Google AI Overviews, and Perplexity every week,
spanning nine industries." "96.8% of cited domains saw zero change week
over week. Among the roughly 3% that did move, 87% were declines. Only 13%
were gains. And those changes weren't gradual — most were binary, with
domains going from cited to not cited at all on a given prompt." "Brands
in the #1 or #2 mention position are nearly cemented — only 0.6% saw any
movement."

**Week to week, the other reading.** Alex Birkett, "August 19, 2026",
https://alexbirkett.com/citation-drift/ (accessed 2026-09-03), reporting
SISTRIX's April 2026 study: "82,619 prompts producing 1,548,213 snapshots
across six countries, three platforms, and 17 weeks of weekly
re-sampling." "The headline number is that citation churn runs 56% per
week at the domain level in Google AI Mode, and 74% in ChatGPT Search. AI
Overviews are more bimodal: for 53% of prompts nothing changes across the
full 17 weeks, but for the remaining minority the sources rotate as fast
as AI Mode." "for 86.5% of AI Mode prompts, there's a 'fixed core' of 1–5
reliably-cited domains, with the remainder rotating at 89% per week."
Birkett's own client snapshot: "Only 245 of them — 49% — appeared in both
snapshots." at URL level, "a domain-level stability of 65%, versus 49% at
the URL level." His recommendation: "Don't over index on any single
monthly snapshot; use aggregate presence over time as the metric, since
one week signal to noise is unfavorable."

**Month to month.** Same page, reporting Profound's July 2025 study
("roughly 80,000 prompts per platform"): "Google AI Overviews 59.3%,
ChatGPT 54.1%, Microsoft Copilot 53.4%, and Perplexity 40.5%" domain-level
drift over one month; "Extended to a six-month window (January to July),
drift climbs to 70–90%".

**Reconciling 96.8% stable with 56–74% churn.** Machine Relations,
"Published July 10, 2026",
https://machinerelations.ai/research/ai-citation-stability-week-to-week-evidence-2026
(accessed 2026-09-03): "Domain-level AI citations are remarkably stable:
BrightEdge found that 96.8% of cited domains saw zero change in any given
week. But URL-level citations are volatile: Writesonic tracked 23 million
cited sources and found 44% of pages appeared exactly once before
disappearing from AI answers entirely. Both findings are correct. They
measure different layers of the same system". Also: "BrightEdge's data
reveals a counterintuitive pattern: domains with larger citation
footprints are more likely to see week-over-week changes." And, from
Profound: "76% of citations were unique to a single platform, and only
0.8% appeared across all four measured engines."

Derived: the studies disagree on the headline because they count
different things — BrightEdge counts a domain as unchanged if it stayed in
the cited set across its thousands of prompts, SISTRIX and Parse count
whether the *same prompt* cites the same domains again. ReachKit's card is
the second kind of count: twelve named questions, each cell one answer.

## 4. Does running the prompt more often help? The one controlled experiment

Profound, "8 Jul, 2026", https://www.tryprofound.com/blog/is-once-a-day-enough
(accessed 2026-09-03):

- "we ran two copies of the same tracking setup side by side for two
  weeks. One ran every prompt once a day; the other ran the identical
  prompts ten times a day. Everything else was held constant: the same 753
  prompts across the same 7 platforms (ChatGPT, Google Gemini, Perplexity,
  Microsoft Copilot, DeepSeek, Google AI Mode, and Google AI Overviews) in
  the US, yielding 5,271 prompt configurations in all."
- "Once a day already lands within about 2 percentage points of a 10×-a-day
  reading for visibility. Running ten times improves precision by only
  about 10%."
- "Citation share is the one place extra runs help a little. Ten runs a
  day cut the day-to-day noise by roughly 40%, but even then, a substantial
  share of the movement comes from the platforms themselves changing."
- "You can't measure your way past drift. The AI platforms update their
  models, prompts, and infrastructure constantly. That underlying movement
  sets a floor on precision that no amount of same-day repetition can
  beat."
- The mechanism: "Averaging one draw across a large portfolio does most of
  the work that extra runs would have done." "the full portfolio is
  already doing the averaging. Because you're pooling one run each across
  thousands of prompts, a single daily pass gives you a reading that's
  very close to what you'd get from ten times the runs, at a tenth of the
  cost."
- "Which prompts you track matters more than how often you run them,
  especially for citation share."

Derived, and the point that bears on ReachKit: Profound's one-run result
rests on averaging across 753 prompts. ReachKit averages across twelve.
The same-day randomness that "averages away" over thousands of prompts
does not average away over twelve, so a single weekly run per question
gives an aggregate count ("cited on 2 of 9") whose week-to-week movement
is dominated by sampling noise and platform drift, not by anything the
customer did — and a per-question cell (this question: cited / not cited)
that Parse's numbers say will disagree with itself between two runs about
seven times in ten on ChatGPT and about two in three on AI Overviews.
Where the product shows movement (P8 "weekly movement"; REQ-041's "is it
working"; BP-051's Monday verdicts against each page's test), the honest
unit is presence across several weeks, not the difference between two
weeks — which is Birkett's recommendation and BrightEdge's own framing.

## 5. What first-run visibility looks like for a small brand

arXiv 2606.20065, "Submitted on 18 Jun 2026", https://arxiv.org/abs/2606.20065
(accessed 2026-09-03), abstract: "We analyze 100K+ prompt responses across
100+ brands tracked on Ranqo between March and May 2026. First visibility
runs form a clear three-tier brand-stature ladder: global household names
(e.g., Stripe, Nike) appear in 73% of relevant AI answers on their first
run; established mid-market and regional brands (e.g., Olipop, Klaviyo) in
44%; niche and small brands in just 11%". "When engines cite sources,
about 78% go to corporate websites; among non-corporate sources YouTube
leads, ahead of Reddit, editorial media, and Wikipedia."

Derived: at 11% for a niche brand, twelve questions yield an expected one
to two mentions, and a cold-start domain (REQ-091) zero — consistent with
`DATA-COSTS.md` §2's "you are cited in none of them" as the default first
reading, and a reason the card's zero must render as a measurement
(REQ-006 criterion 4), never as a change.

## 6. Summary for the artifacts this bears on

- REQ-006 / BP-025: the card's cell is a single sample of a process whose
  repeat-run agreement on cited domains is 21–32% per prompt (Parse). The
  card is honest as a snapshot with its denominator; it is not evidence of
  movement on its own. The asynchronous-overview finding in
  `RESEARCH-dataforseo-endpoints.md` §2.3 compounds this: without the flag,
  some "no AI answer" cells are unfetched answers.
- REQ-065 / BP-050 / P8 "weekly movement": across twelve questions, one
  run a week, the aggregate count moves for reasons the customer did not
  cause. Whether the product promises per-question weekly movement, or
  presence over a window, changes what the Overview says, so it is put to
  the owner (`OWNER-QUESTIONS.md`, Q2). The parameter side — run count,
  window length — is the system's under rule 1.1 once the promise is
  settled.
- `DATA-COSTS.md` §6 item 1: the evidence supports declining the ten-run
  rule on cost, and does not support treating one run as equivalent to
  ten at a portfolio of twelve. The two statements are compatible; the
  second is the one the copy must respect.
- BP-051: a page's Monday verdict against "cited in the AI answer for its
  question" inherits the same per-prompt noise; a verdict against
  organic-top-10 presence does not (BrightEdge's 96.8% and the `ranked_keywords`
  weekly refresh are the stabler signals).
