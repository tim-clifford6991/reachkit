# ReachKit — Supply → Demand → Synthesis: Data Architecture Plan

> **Status:** conceptualization / planning. This is the data-flow reference for the next build phase — what data we ingest, where it comes from, how we store it (to minimize API/backlink cost), and how it synthesizes into specific, actionable content + distribution plans. Implementation (TDD task) plans come *after* this is agreed.

**Goal:** Ingest as much supply-side and demand-side signal as feasible, store it cohesively on our side (compute-once, reuse-everywhere), and synthesize it into a **content plan** and a **distribution plan** that are specific enough to act on today (and to hand to an automation agent later) — without misinterpreting or miscalculating the data.

---

## 0. Principles (these govern every decision below)

1. **Compute once, store globally.** A competitor's SEO/backlink/keyword data is the *same regardless of which user is looking*. Domain-level data is a **global cache keyed by domain**, shared across all users. Only the *selection* and the *synthesized plan* are per-user. This is the single biggest cost lever.
2. **Every number is labeled with its confidence and whether it's measured or estimated.** ETV is an estimate. Direct traffic is a proxy. The traffic mix is a heuristic. We never present an estimate as a measurement.
3. **Every conclusion cites its evidence.** A content/distribution action must trace back to the data rows that justify it (which competitors, which keywords, which referrers). No black-box advice.
4. **Cross-reference = confidence.** A signal confirmed by ≥2 competitors (or ≥2 sources) outranks a single-source signal. Consensus leads.
5. **Honest gaps over fabrication.** If a channel can't be measured (e.g. email traffic), it's a flagged gap — not a made-up number.
6. **Demand is buyer-anchored, not competitor-anchored.** Supply tells us what works; Demand tells us what *our buyer* wants. Advice = the intersection, grounded in the user's own positioning.

---

## 1. The model

```
SUPPLY  (analyze YOU + each competitor, identically)        DEMAND  (the market / buyer — NOT competitors)
  Lens A — Traffic sources (where traffic comes from)         • Product-derived ICP hypothesis (LLM)
     organic · paid · direct · referral · social · email      • Search demand: keyword ideas, questions, intent
  Lens B — Growth activities (what work produces it)          • Competitor-review mining → buyer pains/language
     SEO · Content · Outreach                                 • Community listening → problems + watering-holes
  + Discoverability score (traffic-grounded)                          │
  + SEO metrics · Keyword rankings · Backlinks                        │
  + Content effectiveness (top pages, clusters, formats)              │
              │                                                       │
              └──────────────────►  SYNTHESIS  ◄─────────────────────┘
                    CONTENT PLAN      = demand themes × winning formats × your positioning
                    DISTRIBUTION PLAN = where competitors win × where YOUR audience actually is
                    → specific, evidence-cited, agent-promptable actions
```

---

## 2. SUPPLY layer — data elements

Analyzed **identically for the subject and each selected competitor**. Source column = how we get it; Store = where it lives; TTL = cache lifetime; Conf = confidence of the figure.

### 2.1 Identity & score
| Element | Source / endpoint | Output | Store | TTL | Conf |
|---|---|---|---|---|---|
| Category (micro) | LLM from homepage (`inferCategoryAndQueries`) | category string + search queries | `domain_profile` | 30d | — |
| Discoverability score | derived (`entityScore`) | 0–100, traffic-grounded | `domain_profile` | derived | High* |
| Monthly organic traffic (ETV) | DataForSEO Labs `domain_rank_overview` | est. monthly visits | `domain_profile` | 14d | Est |

\*High *relative*; absolute is an estimate. Score = `0.55·log(ETV) + 0.20·log(keywords) + 0.15·log(referring domains) + 0.10·log(presence)`.

### 2.2 Lens A — Traffic sources (the channel mix)
| Source | Get it? | How | Store | TTL | Conf |
|---|---|---|---|---|---|
| **Organic** | ✅ | `domain_rank_overview` organic ETV + keyword count | `domain_traffic_sources` | 14d | Est |
| **Paid** | ✅ detectable | `domain_rank_overview` **paid** block (paid keyword count + ETV) — *do they bid, how much* | same | 14d | Est |
| **Referral** | ✅ | Backlinks → referring-domain count + traffic-weighted | same | 30d | Est |
| **Social** | 🟡 | social-platform referrers + presence/cadence detection | same | 30d | Low |
| **Direct/brand** | 🟡 proxy | **branded-search volume** (search volume for the brand name) — replaces today's fixed 20% | same | 30d | Proxy |
| **Email** | 🔴 flag | detect newsletter (beehiiv/Substack/signup form) = yes/no, *not* traffic % | same | 30d | Presence |

> Measured-grade channel %s (true paid/social/email/direct split) require **Similarweb** — out of scope now, flagged as the precision upgrade. Our mix is "estimated from public SEO signals," always labeled.

### 2.3 Lens B — Growth activities (what *kind* of work drives growth)
| Activity | What we measure | Source | Store |
|---|---|---|---|
| **SEO** | keyword footprint, ranking distribution, backlink authority (referring domains, domain rank) | DataForSEO Labs + Backlinks summary | `domain_profile` |
| **Content** | blog/footprint present, **publish cadence**, **top pages** + content-driven traffic share | crawl + `relevant_pages` | `domain_content` |
| **Outreach** | **earned** referrers by type: PR/media · guest posts · podcasts · partnerships · communities | the referrer categorizer (built) | `domain_backlinks` (category col) |

> Outreach = the referrer categorization we already built. SEO/Content = keyword + page data. ~70% of Lens B already exists; this is mostly *re-presenting* under the two-lens UI.

### 2.4 SEO metrics & keyword rankings
| Element | Source | Output | Store | TTL |
|---|---|---|---|---|
| Organic keywords | `domain_rank_overview` | count + ETV | `domain_profile` | 14d |
| Referring domains / authority | Backlinks `summary` | referring_domains, rank | `domain_profile` | 30d |
| Ranked keywords | Labs `ranked_keywords` | keyword, position, volume, ETV, **ranking URL** | `domain_keywords` | 14d |
| Keyword gaps (cross-ref) | derived (`keyword-gap`) | rivals win / subject misses, consensus-sorted, brand-filtered | `keyword_gaps` (per cohort) | derived |

### 2.5 Backlinks / referrers
| Element | Source | Output | Store | TTL |
|---|---|---|---|---|
| Referring pages | Backlinks `backlinks/live` (one_per_domain) | host, **deep URL**, anchor, target | `domain_backlinks` | 30d |
| Referrer category | LLM (`classifyReferrers`) | marketplace/blog/media/community/…/ai_directory/spam | `domain_backlinks.category` | with row |
| Cross-competitor intersection | Backlinks `domain_intersection` | platforms feeding ≥2 rivals (channels-missing) | `referral_channels` (per cohort) | 30d |

### 2.6 Content effectiveness (the "Content Engine" per competitor)
| Element | Source | Output | Store | TTL |
|---|---|---|---|---|
| Top pages | Labs `relevant_pages` | URL, keyword count, ETV | `domain_content` | 14d |
| Content type per page | LLM/URL heuristic | comparison · listicle · guide · template · tool · landing · glossary | `domain_content.type` | with row |
| Topic clusters | LLM-cluster keywords+pages | ~8 themes (not 200 keywords) | `domain_content.clusters` | 14d |
| Intent mix | Labs `search_intent` / heuristic | informational/commercial/transactional split | `domain_content` | 14d |
| Winning format/depth | ranking-page teardown (built) | content type, word count, page backlinks, "why it ranks" | `page_teardowns` (per URL) | 30d |

---

## 3. DEMAND layer — data elements

**The key insight: don't ask the user's product for demand (they have no reviews). Ask the market and the competitors.** Keyed by category/subject (and shared where the category matches).

### 3.1 Product-derived ICP hypothesis (the seed)
| Element | Source | Output | Store |
|---|---|---|---|
| ICP hypothesis | LLM from homepage/product | who it's for, jobs-to-be-done, use-cases | `demand_icp` |

Zero reviews needed — the LLM reads the product page and *hypothesizes*. Everything below validates/enriches it.

### 3.2 Search demand (the backbone — DataForSEO, review-independent)
| Element | Source | Output | Store | TTL |
|---|---|---|---|---|
| Keyword universe | Labs `keyword_ideas` / `keyword_suggestions` / `related_keywords` (seeded from category) | the actual searches the market makes | `demand_keywords` | 30d |
| Questions | SERP `organic/live` **People-Also-Ask** + related searches | pains phrased as questions | `demand_questions` | 30d |
| Volume + intent | `search_intent` + Google Ads volume | demand size + buying signal per query | `demand_keywords` | 30d |

### 3.3 Competitor-review mining (the "no-reviews" unlock)
| Element | Source | Output | Store | TTL |
|---|---|---|---|---|
| Competitor reviews | Tavily extract on G2/Capterra/Product Hunt/Trustpilot review pages (+ DataForSEO Business Data where available) | who uses them (role/size/use-case), loves/hates, **buyer language** | `demand_reviews` (per competitor) | 60–90d |

The user has no reviews — competitors do. Mining the *cohort's* reviews gives whole-category buyer evidence.

### 3.4 Community listening (problems + watering-holes)
| Element | Source | Output | Store | TTL |
|---|---|---|---|---|
| Problem signals | Reddit (SERP `site:reddit.com` + Reddit API), HN (Algolia — built), Quora/forums via Tavily | real problems in buyer's words | `demand_community` | 30d |
| Watering-holes | which communities/publications/podcasts the audience frequents | distribution intel (where to reach them) | `demand_audience` | 30d |

### 3.5 Demand synthesis (derived)
| Element | Derived from | Output | Store |
|---|---|---|---|
| ICP + problem map | 3.1–3.4 | refined ICP, ranked problems/JTBD, the language buyers use | `demand_icp` |
| Demand pockets | search demand + community | clusters of unmet/high-demand need with volume | `demand_pockets` |
| Audience watering-holes | community + competitor referrers | ranked places the audience pays attention | `demand_audience` |

---

## 4. SYNTHESIS — content plan & distribution plan

Supply (what works) × Demand (what the buyer wants) × the user's positioning → **specific, evidence-cited actions**. Each action stores the evidence rows it came from (traceability) and is structured so a human can act today and an agent can execute later.

### 4.1 Content plan — one row per content asset to create
```
{
  topic: "Meeting minutes templates",              // a demand cluster, not a single keyword
  targetKeywords: ["meeting minutes template", "minute note template", ...],  // from keyword gaps
  totalVolume: 44400,
  intent: "informational",
  format: "comparison/listicle | how-to guide | template | tool | landing",   // the format that WINS this cluster
  depthTarget: "4,000+ words",                     // from ranking teardowns of who wins
  whyThisWins: "3 of 4 rivals rank via long-form guides; only ~3 backlinks needed — content depth is the lever",
  competitorExemplars: [ { domain, url, position } ],   // the exact pages winning it now (to study)
  brief: "<structured outline + the angle grounded in the user's positioning>",
  agentPrompt: "<ready-to-run prompt for a writing agent>",   // automation hook (later)
  priority: "high",                                 // volume × consensus × winnability × fit
  evidence: { keywordGapIds, teardownIds, demandPocketId }
}
```
Specific enough that the user sees: *the topic, the exact keywords, the format, the depth, the competitor pages to study, and a brief (or an agent prompt) to write it.*

### 4.2 Distribution plan — one row per distribution action
```
{
  channel: "directory | marketplace | community | media/PR | podcast | newsletter | partner | paid",
  action: "Submit your tool | Pitch a guest post | Get on this podcast | Apply to integration directory",
  target: "webcatalog.io",                          // the specific place
  targetUrl: "https://...",                          // deep link where applicable
  why: "feeds 3 of 4 rivals; your audience reads it (community signal)",   // supply × demand
  effort: "low | medium | high",
  evidence: { referralChannelIds, audienceWateringHoleIds },
  agentPrompt: "<later: outreach/submission automation prompt>",
  priority: "high"
}
```
Specific enough that the user sees: *the exact channel, the exact target, the action, and why it'll work.*

### 4.3 The two synthesis rules (so it stays accurate)
- **Content plan** is led by **demand** (what the buyer searches) filtered by **winnability** (format/depth the user can realistically produce) and **fit** (the user's positioning) — *not* by "copy whatever competitors rank for."
- **Distribution plan** is the intersection of **where competitors are found** (supply: categorized referrers, channels-missing) and **where the audience actually is** (demand: watering-holes). A channel that scores on both is top priority.

---

## 5. Storage schema (cohesive, global where possible)

```
# GLOBAL (keyed by domain — shared across all users; the cost saver)
domains(domain PK, first_seen, last_refreshed)
domain_profile(domain, category, score, etv, organic_keywords, referring_domains, authority, fetched_at)
domain_traffic_sources(domain, organic, paid, referral, social, direct, email, branded_search_vol, confidence_json, fetched_at)
domain_keywords(domain, keyword, position, volume, etv, ranking_url, fetched_at)
domain_backlinks(domain, referrer_host, referrer_url, anchor, target_url, category, fetched_at)
domain_content(domain, page_url, keyword_count, etv, content_type, cluster, fetched_at)
page_teardowns(url PK, keyword, content_type, title, word_count, page_referring_domains, top_referrers_json, why_it_ranks, fetched_at)

# GLOBAL (keyed by category — shared where category matches)
demand_keywords(category, keyword, volume, intent, source, fetched_at)
demand_questions(category, question, source, fetched_at)
demand_reviews(competitor_domain, role, company_size, sentiment, theme, quote, fetched_at)
demand_community(category, source, problem_text, url, fetched_at)

# PER-COHORT (a subject + its selected competitors)
cohorts(id, subject_domain, competitor_domains[], created_at)
keyword_gaps(cohort_id, keyword, volume, subject_pos, competitors_json, opportunity)
referral_channels(cohort_id, host, category, action, competitors_using)
demand_icp(subject_domain, icp_json, problem_map_json, fetched_at)
demand_pockets(subject_domain, cluster, volume, evidence_json)
demand_audience(subject_domain, watering_holes_json)

# PER-USER (the only truly user-specific data)
user_competitor_selection(app_id, competitor_domains[])   # who they chose to benchmark
content_plan(app_id, ...row from §4.1, evidence_json, status)
distribution_plan(app_id, ...row from §4.2, evidence_json, status)
```

---

## 6. Cost & freshness strategy

| Data class | Volatility | TTL | Notes |
|---|---|---|---|
| Backlinks / referring domains | slow | 30d | most expensive — cache hard, share globally |
| Ranked keywords / top pages | slow-ish | 14d | shared globally per domain |
| Traffic / ETV / authority | slow | 14d | shared globally |
| Search demand (keyword ideas/questions) | slow | 30d | shared per category |
| Competitor reviews | very slow | 60–90d | shared per competitor |
| Community signals | medium | 30d | refresh on demand |
| Synthesized plans | on selection change | — | recompute only when the cohort changes |

**Cost controls:** (1) global domain cache — a popular competitor is fetched once for everyone; (2) compute synthesis only on selection change, never on page load; (3) demand data shared per category; (4) incremental refresh (re-pull only stale rows, not whole profiles); (5) every external call goes through the cache layer first.

---

## 7. Accuracy & interpretation rules (hard-won — don't regress)

- **Discoverability is traffic-grounded.** Zero traffic → near-zero score, regardless of surfaces.
- **Traffic mix is an estimate; Direct is a branded-search proxy (not a fixed %); Email is presence-only.** Label confidence per channel.
- **Keyword gaps are brand-filtered** (a founder can't rank for a rival's brand) and **consensus-sorted** (multi-rival = real category keyword).
- **Referrers are spam/AI-directory filtered**; only quality categories count toward "discovery channels."
- **Two competitor sets for two jobs:** closeness-ranked (benchmark/learn-from, giants kept) vs size-banded (referral-channel cohort, giants dropped).
- **Cross-reference for confidence:** ≥2 sources/competitors before a strong claim.
- **ETV ≠ measured traffic; backlinks ≠ traffic; a backlink existing ≠ a live funnel.** Weight by the referrer's own traffic.
- **Never fabricate.** Empty/Cold-Start is an honest, correct output.
- **Cohort comparability bounds quality** — surface it (thin cohort / nascent category → disclose, don't pretend).

---

## 8. Build order (reuse first — most of Supply exists)

1. **Storage layer + global domain cache** — wrap existing adapters so every pull is cache-first and persisted. (Biggest cost win; unblocks everything.)
2. **Re-present Supply under the two-lens UI** (traffic sources + growth activities) — mostly existing data; add **paid** (`domain_rank_overview` paid block) and **branded-search** (direct proxy).
3. **Content effectiveness** — top pages → content types → topic clusters → format/depth (extend the teardown; add clustering).
4. **Demand layer** — search-demand mining (DataForSEO keyword ideas + PAA) and **competitor-review mining** (the no-reviews unlock) first; community listening next.
5. **Synthesis** — content plan + distribution plan with evidence + agent-promptable briefs.
6. **(Later) Automation** — agent execution of the plan rows.

---

## 9. Source / endpoint reference

| Need | Endpoint / source |
|---|---|
| Organic + paid traffic, keywords | DataForSEO Labs `domain_rank_overview` (organic + paid blocks) |
| Ranked keywords + ranking URL | Labs `ranked_keywords` |
| Top pages | Labs `relevant_pages` |
| Keyword ideas / demand | Labs `keyword_ideas` · `keyword_suggestions` · `related_keywords` |
| Intent | Labs `search_intent` |
| Questions / PAA | SERP `google/organic/live/advanced` |
| Search volume / branded search | Keywords Data `google_ads/search_volume` |
| Backlinks (page + domain) | Backlinks `backlinks/live`, `summary/live` |
| Cross-competitor link intersection | Backlinks `domain_intersection/live` |
| Bulk traffic / size | Labs `bulk_traffic_estimation` |
| Competitor reviews | Tavily extract on G2/Capterra/PH/Trustpilot (+ DataForSEO Business Data where available) |
| Community problems | Reddit API + SERP `site:reddit.com`; HN Algolia; Tavily |
| Category / ICP / clustering / why-it-ranks | Claude (Haiku) |
| **Precision upgrade (later):** measured channel split | Similarweb |
