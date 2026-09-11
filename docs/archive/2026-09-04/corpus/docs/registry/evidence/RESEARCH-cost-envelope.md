# Evidence — every dataset against the cost envelope: freshness, cache key, worst-case calls, cents

Read on **2026-09-03** against `BUILD.md` §6, `DATA-COSTS.md` v1.3,
`00-project.md`'s cost table, and the nodes that own the seam and the caches:
BP-005 (price book, `CACHE_WINDOWS_D`), BP-006, BP-007 (`fetches`), BP-008
(the closed endpoint list), BP-009 (`llm()`), BP-011, BP-012, BP-023, BP-025,
BP-026, BP-028, BP-036, BP-042, BP-050, BP-052. Vendor prices are not
re-derived here: they are `registry/evidence/RESEARCH-dataforseo-endpoints.md`'s,
quoted from pages that file accessed on 2026-09-03.

Bears on: BP-005, BP-007, BP-008, BP-009, BP-023, BP-028, BP-050, ADR-094;
REQ-003, REQ-065, REQ-094.

**Every cent figure below is a corpus or vendor figure with its source named.
Nothing here is a measurement of our own** — no call has been made and no
`src/` exists.

## 0. The three verdicts

| Envelope (`00-project.md`) | Target | Cap | What the corpus's own numbers give | Verdict |
|---|---|---|---|---|
| 1 free report | ~6¢ | **12¢** | 6.6¢ typical · **9.0¢** worst · **15.9¢ worst once the correction REQ-094 promises runs inside the same ceiling** | **breached** — §1.4 |
| 1 paid deep scan | ~30¢ | 150¢ | **30.7¢** (`RESEARCH-dataforseo-endpoints.md` §3) | holds, 4.9× headroom |
| weekly refresh | ~8¢ | 40¢ | **8.7¢** (same) | holds, 4.6× headroom |
| 1 day of content | ~7¢ | 45¢ | **6.4¢** (§3 — the corpus spends one row less than the book) | holds, 7.0× headroom |

One cap is at risk and it is the free one, which is also the only cap a
stranger's experience depends on. The other three carry between 4.6× and 7×
headroom, and the two divergences found in them move the monthly COGS from
`DATA-COSTS.md` §5's **$2.71 to ~$2.74** — ~95% gross margin at €49 either
way, unchanged in kind.

## 1. The free report

`DATA-COSTS.md` §2's eight datasets, plus the second nano call BP-025 decision
2 adds and the correction REQ-094 gives every report.

| # | Dataset | Freshness window | Cache key | Worst-case calls | ¢ |
|---|---|---|---|---|---|
| F1 | Home + detected pricing HTML | `CACHE_WINDOWS_D.own` = 7d — **pinned, passed by nobody** (§2.1) | **undeclared** | 2 fetches | 0 |
| F2 | `robots.txt` + per-agent verdicts | same 7d, same gap | **undeclared** | 1 fetch | 0 |
| F3 | On-page measurements | derived from F1; no cache | n/a | 0 | 0 |
| F4 | `ranked_keywords`@50 | **undeclared**; `BUILD.md` §6.4's "own domain 7d" implies `.own` | **undeclared** | 1 | 1.8 |
| F5 | Nano business profile (`'profile'`) | none — BP-009 states no cache for `llm()` | n/a | 1 | 0.3 |
| F5b | Nano question phrasing (`'question-phrasing'`) | none | n/a | 1 | 0.3 |
| F6 | `keyword_suggestions`@50 | `CACHE_WINDOWS_D.suggestions` = 30d — pinned, passed by nobody | **undeclared** | 1 | 1.8 |
| F7 | 12 organic SERPs, **live**, `loadAsyncAiOverview: true` | `CACHE_WINDOWS_D.serp` = 30d — pinned, passed by nobody | **undeclared, and it decides the weekly's true cost** (§2.2) | 12 | 2.4 typical · **4.8 worst** |
| F8 | Rivals derived from F7 | n/a — counts over F7 | n/a | 0 | 0 |
| | **One scan** | | | **19 paid calls** | **6.6 typical · 9.0 worst** |
| C | One correction (REQ-094 c1) re-running `BUILD.md` §6.7 steps 2–5 | **same ceiling** (REQ-094 c3) | new category ⇒ new queries ⇒ **no hit is possible** | 1 + 1 + 12 | 4.5 typical · **6.9 worst** |
| | **Scan + its one correction** | | | **33 paid calls** | **11.1 typical · 15.9 worst** |

Sources for each cent figure: F4/F6 `BUILD.md` §6.1's price book, matched to
the vendor page in `RESEARCH-dataforseo-endpoints.md` §1.1. F5+F5b BP-025
decision 2, verbatim: "two nano calls per scan, ≈0.6¢ rather than ≈0.3¢". F7
BP-025's NFR budget, verbatim: "2.4¢ where Google served no asynchronous
overview to fetch, up to 4.8¢ worst case". The 6.6¢ typical is BP-011's NFR
budget, verbatim: "`BUILD.md` §6.3's free-scan headline of '~6.3¢' is ~6.6¢
(0.6 nano + 1.8 suggestions + 2.4 SERPs + 1.8 `ranked_keywords`@50)". The 9.0¢
is BP-025's "~7.2¢ worst case for this node's own spend … together with F4's
1.8¢". The correction's shape is `BUILD.md` §6.7 step 5.

### 1.1 The 12¢ cap holds for a scan and fails for a corrected scan

`CAPS.FREE_C` is 12¢. A scan alone reaches 9.0¢ worst case — 3.0¢ of headroom.
A scan whose reader takes the correction the report offers reaches **15.9¢ in
one cost context**, because REQ-094 criterion 3 says so in terms: the
re-measurement "spends no further scan allowance and **opens no second spend
ceiling**", and BP-028's NFR budget agrees ("it belongs to the scan it
corrects"). BP-007 will not bill past the cap — it degrades — so the money is
safe and the promise is not: the correction stops mid-flight and REQ-094
criterion 7's "the correction did not complete" becomes the ordinary result
for exactly the reports whose market was read wrongly.

**Even with no surcharge charged at all** the pair is 11.1¢ against 12¢. The
figure `BUILD.md` §6.7 step 5 states — "~4.2¢; worst case 10.5¢, still under
the 12¢ cap" — is 6.3¢ + 4.2¢, which is the *sum*, not a worst case, and it
was computed at one nano call and 0.2¢ a SERP. Both operands moved before the
sentence was re-read.

Filed: BP-028, ADR-094, BP-023 (whose NFR still calls the cap "headroom rather
than the operating point"), and `OWNER-QUESTIONS.md` item 9 — whether a re-run
of the free report is the same free report ADR-094's ruling was scoped to.

## 2. What no node states

### 2.1 Freshness: four windows are pinned and none is passed

BP-007's `recordFetch` makes **`freshnessDays` a required per-call argument**.
BP-005 pins `CACHE_WINDOWS_D: { own: 7; rival: 30; serp: 30; suggestions: 30 }`
— `BUILD.md` §6.4's four windows, transcribed. **BP-052 is the only node in the
corpus that reads that constant.** BP-008, the only node that buys vendor data,
exposes no freshness argument on any of its six functions and its body declares
no endpoint-to-window map.

The gap has a sharp edge. `BUILD.md` §6.4 states the SERP window with an
exception — *"SERPs 30d (except the weekly target re-check)"* — and **no
artifact carries the exception**. At the pinned 30 days, BP-050's weekly
re-measurement finds its thirteen target SERPs in cache in three weeks of every
four: `runWeekly` returns `status: 'done'`, `accountForWeek` returns
`{ kind: 'complete' }` stamped with this week's `measuredAt`, and the values
under that date are up to a month old. REQ-065's promise of a weekly
re-measurement and REQ-041 criterion 7's "no earlier week's value labelled with
that week's date" both break, silently, by a cache hit rather than by any
failure the product reports. Filed on BP-008 and BP-050.

### 2.2 The cache key is undeclared, and it is the largest unpriced lever

BP-007 keys `fetches` on `source + cache_key + policy_version`. **No node says
what `cache_key` is for any endpoint.** For `serpOrganic` the choice decides the
product's largest recurring cost:

| Key | Consequence |
|---|---|
| query + `SERP_LOCATION` | a market's thirteen weekly target SERPs are bought **once**, however many customers track that market; every customer after the first in a market reads them free |
| anything carrying the site id | bought **once per customer per week**, which is what BP-050's "≈8¢ ledgered per site" and `DATA-COSTS.md` §5's COGS both assume |

Both are defensible and the corpus states neither. Since every call is fixed to
one location and depth (BP-008: "Every call is fixed to `SERP_LOCATION` (Google
US / en) and depth 10"), a SERP payload is genuinely customer-independent — the
saving is real and nothing has priced it. A cache key is a parameter and
therefore the system's (rule 1.1); filed on BP-008 as a thing to state, not as a
question to ask.

### 2.3 `fetches` cannot be both a keyed cache and a per-call ledger

BP-007 makes the table unique on `(source, cache_key, policy_version)` **and**
the ledger of every spend. Those want different row counts. Every ordinary
re-buy collides: a SERP re-bought after its window expires, and the empty
payload BP-007 itself promises "is a miss and is retried on the next scan …
billed once per scan and never remembered as an answer". Upsert loses a
ledgered spend the same paragraph promises is always kept; insert fails. Filed
on BP-007.

### 2.4 The seam caps against a price the vendor may refund

ADR-094 decision 3 makes BP-008 ledger "the surcharge rate (2x the base price)"
on every flagged SERP "whether or not DataForSEO's own response later refunds
the difference", so recorded spend never under-counts. The unstated consequence
is that `capHit()` measures against those over-stated cents: a free scan can be
degraded at a ceiling it did not reach. Filed on BP-007.

## 3. The paid scan and the content day

| | Dataset | Freshness | Cache key | Calls | ¢ |
|---|---|---|---|---|---|
| P1 | `ranked_keywords`@300 | own 7d, unpassed | undeclared | 1 | 4.8 |
| P2 | `ranked_keywords`@100 × 3 rivals, monthly | `.rival` 30d — **read by BP-052, the one node that does** | undeclared | 3 | 7.2 |
| P3 | `competitors_domain`, monthly | `.rival` 30d | undeclared | 1 | 1.5 |
| P4 | `keyword_suggestions` × 2, monthly | `.suggestions` 30d, unpassed | undeclared | 2 | 3.6 |
| P5 | ≤13 target SERPs | `.serp` 30d — **the re-check exception has no home** (§2.1) | undeclared | 13 | 2.6 live · 0.78 std |
| P6 | ≤25 own ranking pages | own 7d, unpassed | undeclared | 25 fetches | 0 |
| P7 | Rival home + robots × 3 | `.rival` 30d | undeclared | 6 fetches | 0 |
| P8 | Battery: ChatGPT std ×12 + AI Mode std ×12 (+ AI Overview free inside P5) | none stated | undeclared | 24 | book **2.2** · vendor **2.88** |
| P9 | Haiku × 4, opportunity typing | none | n/a | 4 | 3.6 |
| | **Deep pass** | | | **48 paid calls** | **~30.7** vs cap 150 |
| | **Weekly refresh** (P1 + P5 std + P8) | | | **37 paid calls** | **~8.7** vs cap 40 |

P8's divergence is `RESEARCH-dataforseo-endpoints.md` §3 and §6: the price book
pins AI Mode at 0.2¢/0.06¢ and the vendor's own pricing page, accessed
2026-09-03, reads "Live Mode … $0.004" and "Standard Queue … $0.0012" — 0.4¢ ·
0.12¢, twice the pin, the one row of nine that file's divergence table marks
"diverges ×2". That file names the fix as BP-005's under rule 1.1 and it has not
been made; the same stale figure is restated in BP-008's NFR budget ("weekly
paid battery 2.2¢") and BP-050's ("≈8¢ ledgered per site"). Filed on all three.

**One day of content**, `DATA-COSTS.md` §4 priced against what the corpus
actually spends:

| Step | Model | Book ¢ | Corpus |
|---|---|---|---|
| Brief | nano | 0.1 | as booked |
| Outline | nano | 0.2 | as booked |
| Grounded draft | Haiku | 2.1 | as booked |
| Answerability + SEO | Haiku | 1.9 | as booked |
| Do-not-claim + grounding check | nano | 0.1 | as booked |
| Near-duplicate vs published set | Embeddings | 0.1 | **0¢** — BP-042 uses BP-005's `SHINGLE_SIZE: 5` / `NEAR_DUPLICATE_MAX: 0.85`; BP-009's `LlmCallSite` union has no embedding site and no tier for one |
| Retry allowance (×1.5 on the two Haiku steps) | — | 2.0 | as booked |
| | | **6.5** | **6.4** vs `CAPS.DRAFT_C` 45 |

The divergence runs in the cheap direction. What it costs is legibility: the
seam quotes a per-day total assembled from a call it cannot make, so nobody
reading BP-009's budget can tell which rows it enforces `CAPS.DRAFT_C` against.
Filed on BP-009 — together with its "the free scan's **single** nano call",
which BP-025 decision 2 and this node's own two-site union both refute.

**And the price book prices none of it.** `PRICE_BOOK` carries six DataForSEO
rows and no inference row, while eight `llm()` call sites across two tiers must
each supply `costCents` for BP-007 to cap against. `DATA-COSTS.md` §6 names
model creep as danger 4, enforced "in the seam, not assumed"; a seam that cannot
price a call cannot cap it. Filed on BP-005.

## 4. The four named dangers, checked

`DATA-COSTS.md` §6, in its own order.

| Danger | State |
|---|---|
| 1 · Battery growth | **held by construction.** `BATTERY.QUESTIONS: 12`, `TARGET_SERPS_MAX: 13`, `COMPETITORS_MAX: 5` pinned in BP-005 and asserted; a fourth engine has no function on BP-008 to call. Run counts are 1 by absence of any sampling parameter |
| 2 · Live-mode creep | **held by construction.** BP-008 decision 2 makes `mode` required and never defaulted, so a scheduled caller cannot inherit `'live'`. The free path and the deep pass are the two live sites, and both are sites where a human waits |
| 3 · Row-limit creep | **held by construction.** `rankedKeywords`'s `rows` is the literal union `50\|100\|300` and `keywordSuggestions`'s is `50` — a row limit outside the price book is a type error |
| 4 · Model creep | **not held.** The tier is a free `'nano' \| 'haiku'` argument at each `llm()` call site with no per-site constraint, and the price book has no model row to cap against (§3). `DATA-COSTS.md` names Sonnet as a +4¢ upgrade that "would still fit the cap — which is exactly why the cap has to be enforced in the seam" |
| 5 · A new spend site | **partly held.** BP-008 decision 1 makes an endpoint a compile error until it exists, but ADR-094 admitted a *parameter* that is a new spend site with no price-book row (§2.4) — the first case that took the shape rule 5 did not anticipate |

## Why this sits here and not in a blueprint

Vendor prices and per-dataset arithmetic are evidence (rule 2.1); the pins are
BP-005's to hold and the budgets are each node's own (rule 2.4). Every finding
above is filed as a `REVIEW(...)` line on the node that owns it — BP-005 (×3),
BP-007 (×2), BP-008 (×3), BP-009 (×2), BP-023, BP-028, BP-050 (×2), ADR-094 —
and the one that would change what the free report promises is
`OWNER-QUESTIONS.md` item 9.
