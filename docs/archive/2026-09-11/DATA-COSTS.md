---
id: DATA-COSTS
type: data-and-cost-model
title: "ReachKit — datasets and unit costs"
version: 1.3 (cold-start rival derivation)
date: 2026-08-28
status: for-review
grounds: MVP.md v2.0, the app prototype of 28 Aug
prices-checked: 2026-08-28 (DataForSEO public pricing pages; current LLM API price sheets)
---

# ReachKit — every dataset, and what it costs

Split the way the product splits: what one **free report** needs, what one **paid
scan** needs, and what **one day of content** needs. Every row names the vendor
endpoint or the model call, and every price traces to a public price sheet checked
today or to a figure already measured in production.

**Currency:** US cents (vendors bill USD). €49 ≈ $53 at time of writing.

---

## 1. The vendor price book

The unit prices everything below is computed from. Pin these as constants with a
test, as the existing price-book discipline requires.

### DataForSEO

| Endpoint | Used for | Unit price | Notes |
|---|---|---|---|
| Labs `ranked_keywords` | Every search the domain appears in: keyword · volume · position · URL | ~1.2¢ task + 0.01¢/row → **1.8¢ @ 50 rows · 4.8¢ @ 300** | Matches our measured invoices |
| Labs `competitors_domain` | Rival domains **with their footprint metrics** in one call | **1.5¢** @ 25 rows | One call covers the whole free-report contrast table |
| Labs `keyword_suggestions` | The market's search set + volumes from a seed | **~1.8¢** per call @ 50 rows | Rows bill as returned |
| SERP Google organic, advanced | Who holds a target search's top 10 | **0.2¢** live · 0.06¢ standard | Depth 10; deeper doubles per extra 100 |
| AI Optimization: **LLM Scraper** | What ChatGPT / Gemini actually answer, scraped from the product UI | **0.4¢ live · 0.12¢ standard** per page | ChatGPT + Gemini only |
| AI Optimization: **LLM Responses** | Perplexity (and API-side Claude/Gemini) answers | **0.06¢ + the model's own cost ≈ 0.5–0.6¢** | Model cost dominates |
| AI Optimization: AI Keyword Data | How queries are phrased inside AI tools, with volumes | 1¢/task + 0.01¢/kw | **Not in MVP** — nice-to-have for question derivation later |

**A failed call is still a ledger row (2026-09-11, #504, PR 514).** Every DataForSEO
failure is ledgered as a typed row (`{vendorFailure, endpoint, billed}`), never a null
payload. A request the vendor refused (`http_<n>`, `task_<code>`, or a `task_post` the
standard queue did not accept) is settled at **0 ¢**. So is `no_surface`, a request
that was never sent. Every other failure (`timeout`, `transport`, `unparseable`,
`deadline`, and any failure after an accepted `task_post`) is settled at its reservation,
because the money may have been spent. Failures are never cached (BUILD §6.4, no negative
cache). The 0 ¢ side follows DataForSEO's documented behaviour (an errored task is not
charged); it has not been checked against an invoice.

### Inference

| Model tier | $/M in · out | Used for |
|---|---|---|
| Nano class (GPT-nano / Flash-Lite) | $0.20 · $1.25 | Category inference, question phrasing, briefs, outlines, claim checks |
| **Haiku 4.5** | $1.00 · $5.00 | The grounded draft and the answerability pass |
| Sonnet 4.6 | $3.00 · $15.00 | Optional quality upgrade on the draft step only (+4¢/draft) |

Everything else — every fetch of the customer's or a rival's own pages,
robots.txt, parsing, scoring, brand-mention matching, near-duplicate checks — is
**own compute at ~0¢**, and stays that way because mention detection is string
matching against stored answers, never an LLM call.

---

## 2. What the FREE report needs

Eight datasets. Six are free to produce; two cost money. **Every derivation below
works at zero presence** — a domain that ranks for nothing still gets a complete
report (§2a).

| # | Dataset | Feeds (in the UI) | Source | Cost |
|---|---|---|---|---|
| F1 | Home document + detected pricing page, raw HTML | Foundations + Answerability drivers, grounding facts for the free page offer | Own fetch | 0¢ |
| F2 | `robots.txt` + per-agent verdicts | "AI readers blocked" problem card, Foundations | Own fetch + parse | 0¢ |
| F3 | On-page measurements (title, headings, answer blocks, evidence density, schema, OG) | Score drivers, "Unquotable pages" card | Own parse of F1 | 0¢ |
| F4 | Customer's ranked keywords (50 rows) | Presence driver, "you appear in N searches" footnote, branded split | `ranked_keywords` @ 50 (0 rows is a legal, billed result) | 1.8¢ |
| F5 | Category label + market seed terms | Question derivation, suggestions seed | Nano ×1 over **F1's homepage text** — never over rankings, so it works at zero presence | ~0.3¢ |
| F6 | The market's search set + volumes | "Searches you're absent from", the market denominator, the 12 questions | `keyword_suggestions` **seeded from F5's category terms** — never from the customer's rankings | 1.8¢ |
| F7 | Top-10 + **AI Overview** (with cited domains) for each of the 12 questions' source searches | Both contrast cards, "holds #1", the dot matrix | **12 organic SERPs, live** — `ai_overview` + references ride at 0¢ | 2.4¢ |
| F8 | **Rivals, derived from F7** — non-platform domains ranked by top-10 occupancy + AI citations across the 12 SERPs | The contrast table, setup's suggested-rival chips | Counting over F7. `competitors_domain` is **dropped from the free path** — it keys on the customer's own rankings and returns nothing on cold start | 0¢ |

### One free report: **~6.3¢** (cap 12¢)

| | |
|---|---|
| DataForSEO | 6.0¢ |
| Inference | 0.3¢ |
| **Total** | **~6.3¢** |

Three rulings inside that number, all decided by the arithmetic:

- **The free AI matrix is Google's AI answers, not a ChatGPT scrape (owner ruling, 28 Aug).** The 12 questions' source searches are queried as 12 organic SERPs (2.4¢ live); each returns the top-10 **and** the `ai_overview` with its cited domains at no extra charge. Half the cost of the ChatGPT scraper, and the same SERPs genuinely supply the "holds #1" column, which previously had no free-path source. ChatGPT and AI Mode answers are paid-only. The free path makes **zero** AI Optimization API calls.
- **Honest rendering:** an AI Overview does not appear on every query, so the matrix denominator is stated — *"Google shows an AI answer on 9 of your market's 12 biggest searches — you are cited in none of them."* A question with no AI Overview renders as a muted "no AI answer" cell, never as a miss against the customer.
- **Rivals are derived from the market, never from the customer (owner requirement, 28 Aug).** `competitors_domain` keys on keyword overlap with the customer's own rankings — on a cold-start domain it returns nothing, which is exactly the wrong failure for the users the product exists to help. Instead, rivals = the non-platform domains that keep appearing across the 12 SERPs already bought (top-10 occupancy + AI-Overview citations, UGC/directory domains filtered to a "sources" list). Costs 0¢, works identically at 0 or 10,000 ranked keywords, and the free contrast is *their share of the market's 12 biggest searches* vs yours — sharper than global footprint counts, which move to paid. `competitors_domain` survives only as a warm-start supplement inside the paid scan.

Worst-case daily exposure at the existing bounds (200 free scans/day): **~$13/day**.

### 2a. Cold start is the default case, not an edge case

A domain ranking for nothing gets the identical pipeline — nothing branches:

| Dataset | At zero presence |
|---|---|
| F4 | Returns 0 rows, still billed the task fee; "you appear in 0 searches" is a measurement |
| F5–F6 | Seeded from the homepage's own text — presence never enters the derivation |
| F7–F8 | About the *market*, not the customer — identical output either way |
| Score | SearchPresence 0, Presence floors at 1; a clean cold-start site lands ~10–15, Invisible — honest |
| Opportunities | All Write-family (nothing to Improve yet); winnability threshold `max(500, 5×ranked)` = 500, so winnable targets still exist |

The report's story at cold start writes itself from the same modules: *your market
makes N searches a month · these domains own it · you appear in 0 · here are the
first pages of your foundation.*

---

## 3. What the PAID scan needs

Everything above, deeper, plus five datasets the free path never touches. This is
the onboarding deep pass; the weekly refresh is the same shape minus the monthly
rival items.

| # | Dataset | Feeds | Source | Cost |
|---|---|---|---|---|
| P1 | Customer's full ranked set (300 rows) | Opportunity derivation, striking distance, Overview growth chart | `ranked_keywords` @ 300 | 4.8¢ |
| P2 | Each approved rival's ranked set (100 rows) | Keyword gap, format gap, "how far ahead" ratios | `ranked_keywords` ×3 rivals · **monthly** | 7.2¢ |
| P3 | Rival discovery + metrics refresh | Standing table, setup suggestions | `competitors_domain` · monthly | 1.5¢ |
| P4 | Market search set, wider | Question set refresh, market denominator | `keyword_suggestions` ×2 | 3.6¢ |
| P5 | Top-10 for each target search (≤13 SERPs) | Winnability test (weakest-site-in-top-10), "answered today by", done-when tests | SERP advanced ×13 | 2.6¢ |
| P6 | Customer's measured pages (home + up to 25 ranking URLs) | Improve-family opportunities, per-page answerability | Own fetches | 0¢ |
| P7 | Rival home + robots.txt (2 docs × 3 rivals) | Directive comparison, citation pairings | Own fetches | 0¢ |
| P8 | **12 questions × 2 engines + AI Overviews**, stored verbatim | AI matrix, share of voice, substitution, weekly movement | ChatGPT scraper (std) + Google AI Mode SERP (std) + `ai_overview` **free** inside P5's SERPs | 2.2¢ |
| P9 | Opportunity typing + classification labels | The calendar's supply, Write/Improve/Fix split | Haiku ×~4 | 3.6¢ |

### One paid deep scan: **~30¢** (cap 150¢) · one weekly refresh: **~8¢**

| | Deep (onboarding, live) | Weekly (scheduled, standard) |
|---|---|---|
| DataForSEO | 26.9¢ | 7.7¢ |
| Inference | 3.6¢ | ~0.5¢ |
| **Total** | **~30¢** | **~8¢** |

The onboarding pass runs live (the customer is waiting); every scheduled run uses
the standard queue at a third to a seventh of live prices, and the suggestions
draw moves to a monthly cadence — the market's search set does not change weekly.

**The AI battery ruling (v1.1 of this doc):** Perplexity's LLM Responses (~0.56¢
per answer, 70% of the old battery cost) are **deferred**. The MVP battery is
ChatGPT (scraper, real product answers) + Google AI Mode (SERP endpoint, Google's
real AI answer surface) + AI Overviews read **free** out of the target SERPs the
scan already buys — three AI answer columns for 2.2¢ a week instead of 9.6¢.

---

## 4. What ONE DAY of content needs

The generation pipeline, priced per step at current model prices:

| Step | Model | Tokens (in/out) | Cost |
|---|---|---|---|
| Brief from the opportunity's evidence | Nano | 2k / 0.5k | 0.1¢ |
| Outline | Nano | 3k / 1k | 0.2¢ |
| **Grounded draft** (evidence + customer pages + voice) | Haiku | 8k / 2.5k | 2.1¢ |
| Answerability + SEO pass | Haiku | 6k / 2.5k | 1.9¢ |
| Do-not-claim + grounding check | Nano | 4k / 0.3k | 0.1¢ |
| Near-duplicate check vs published set | Embeddings | — | ~0.1¢ |
| Retry allowance (×1.5 on the two Haiku steps) | — | — | 2.0¢ |
| Publish + next-day verification fetch | Own | — | 0¢ |

### One day of content: **~6.5¢** — call it **≤10¢** with headroom

Upgrading the draft step alone to Sonnet adds ~4¢. **The €0.45 per-draft ceiling
stands as the enforced cap, but the working number is now ~7×–10× below it** —
the PRD's $0.70/draft was priced against 2024-era models and is off by an order
of magnitude at today's prices.

---

## 5. The month, rolled up

| Line | Monthly per customer |
|---|---|
| Weekly refresh ×4.33 | $0.33 |
| Rival + suggestions refresh (monthly) | $0.12 |
| 30 days of content | $1.95 |
| Hosted CMS delivery | ~$0.30 |
| **Total COGS** | **~$2.71 ≈ €2.50** |

**Gross margin at €49: ~95%.** The three headline unit costs:

| | Cost | Cap |
|---|---|---|
| **1 free report** | **~6¢** | 12¢ |
| **1 paid deep scan** | **~30¢** (weekly refresh ~8¢) | 150¢ |
| **1 day of content** | **~7¢** | 45¢ |

---

## 6. What moves these numbers

In order of danger, unchanged in kind from the earlier analysis but now with the
levers named:

1. **Battery growth.** 12 questions × 3 engines weekly is 9.6¢. The PRD's ≥10-runs-per-prompt sampling rule would make it ~96¢/week — the single fastest way to take the margin from 94% to 85%. Question count, engine count and run count stay pinned constants.
2. **Live mode creep.** Live SERP/scraper calls cost 3–7× standard. Live is justified exactly once: the free report's 60-second promise. Everything scheduled runs standard queue.
3. **Row-limit creep.** Labs rows bill as returned; every row limit is a pinned constant.
4. **Model creep.** The pipeline assumes nano for scaffolding and Haiku for prose. Sonnet-everywhere would triple draft cost and still fit the cap — which is exactly why the cap has to be enforced in the seam, not assumed.
5. **A fourth engine or per-draft re-probing** are new spend sites, and each needs its own price-book row before it ships.
