# Evidence — DataForSEO Labs, SERP and AI Optimization endpoints, checked against the price book

Sources: DataForSEO's public pricing pages, API documentation and help
center, every page fetched and read on **2026-09-03**. Compared against
`DATA-COSTS.md` v1.3 §1 (its own header: "prices-checked: 2026-08-28") and
`BUILD.md` §6.1, §6.2, §6.4, and against the constants BP-005 pins from them.

Bears on: BP-005 (price book), BP-007 (cost seam), BP-008 (the closed
endpoint list and its interface), BP-011, BP-012, BP-025, BP-026, BP-036,
BP-050, BP-052; REQ-003, REQ-006, REQ-008, REQ-065, REQ-096.

Every quotation below is verbatim from the page named; the date is the
access date. Where a figure was derived from a quotation, the derivation is
marked "derived". Nothing here is a measurement of our own.

## 1. DataForSEO Labs (Google)

### 1.1 Pricing — one rule for every endpoint the product uses

Source: https://dataforseo.com/pricing/dataforseo-labs/dataforseo-google-api (accessed 2026-09-03).

- "DataForSEO Labs Google API encompasses a variety of endpoints that support
  the Live mode of data processing. Using the endpoints listed below, your
  account will be billed for both setting a task and retrieving its results."
- "ALL OTHER ENDPOINTS · Live mode · Real-time results with a single POST
  request · Turnaround time · up to 2 seconds on average · Price per task ·
  $0.012 · Price per item · $0.00012"
- "The number of domains you can get in response is limited to 1000, so you
  will have to make 1,000 requests in order to obtain 1M keywords or domains
  and related data."
- "Note that if you set include_clickstream_data to true, the cost of the
  request is multiplied by 2."

Derived against the price book (task 1.2¢ + 0.012¢ per row):

| Price-book row | Book | Derived from the vendor page | Verdict |
|---|---|---|---|
| `ranked_keywords` @ 50 | 1.8¢ | 1.2 + 50 × 0.012 = 1.8¢ | matches |
| `ranked_keywords` @ 100 | 2.4¢ | 1.2 + 1.2 = 2.4¢ | matches |
| `ranked_keywords` @ 300 | 4.8¢ | 1.2 + 3.6 = 4.8¢ | matches |
| `competitors_domain` @ 25 | 1.5¢ | 1.2 + 0.3 = 1.5¢ | matches |
| `keyword_suggestions` @ 50 | 1.8¢ | 1.2 + 0.6 = 1.8¢ | matches |

### 1.2 `ranked_keywords`

Source: https://docs.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live/ (accessed 2026-09-03).

- "This endpoint will provide you with the list of keywords that any domain,
  subdomain, or webpage is ranking for. You will also get SERP elements
  related to the keyword position, as well as monthly searches and other data
  relevant to the returned keywords."
- "Data updates: data is updated weekly, the latest update time is available
  in the Status endpoint."
- "You can send up to 2000 API calls per minute, each Live API call can
  contain only one task. The maximum number of calls that can be sent
  simultaneously is limited to 30."
- `limit`: "the maximum number of returned keywords · default value: 100 ·
  maximum value: 1000"
- `target`: "the domain name of the target website, subdomain or URL of the
  target webpage; the domain name must be specified without https:// or www.;
  the subdomain must be specified without https://; the webpage URL must be
  specified with https:// or www. Note: if you specify the webpage URL without
  https:// or www., the result will be returned for the entire domain rather
  than the specific page"
- Filters: "you can add several filters at once (8 filters maximum)".

Observed for BP-008's open `rests-on` row (whether a root-domain target
returns rows served on `content.`): the documentation confirms a subdomain
can be queried as its own `target`, which is the fallback the row names. It
does not state whether a root-domain target's rows include subdomain pages.
The row stays open; its disposition is the architect's or the first
validator's (rule 2.3b).

### 1.3 `competitors_domain`

Source: https://docs.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live/ (accessed 2026-09-03).

- "This endpoint will provide you with a full overview of ranking and traffic
  data of the competitor domains from organic and paid search. In addition to
  that, you will get the metrics specific to the keywords both competitor
  domains and your domain rank for within the same SERP."
- "Data updates: data is updated weekly, the latest update time is available
  in the Status endpoint."
- `limit`: "default value: 100 … maximum value: 1000".
- Response carries per competitor `avg_position`, `sum_position`,
  `intersections`, and "ranking and traffic data relevant to the keywords that
  the provided domain shares with the target domain".

The description is the vendor's own statement of the cold-start failure
`DATA-COSTS.md` §2 records: the endpoint keys on keywords "both competitor
domains and your domain rank for", so a domain ranking for nothing has no
intersections to return.

### 1.4 `keyword_suggestions`

Source: https://docs.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live/ (accessed 2026-09-03).

- "The Keyword Suggestions endpoint provides search queries that include the
  specified seed keyword."
- "The algorithm is based on the full-text search for the specified keyword
  and therefore returns only those search terms that contain the keyword you
  set in the POST array with additional words before, after, or within the
  specified key phrase. Returned keyword suggestions can contain the words
  from the specified key phrase in a sequence different from the one you
  specify."
- `limit`: "maximum value: 1000". `include_seed_keyword`: "if set to true,
  data for the seed keyword specified in the keyword field will be provided
  in the seed_keyword_data array of the response".
- Volume provenance, on the `search_volume` field family: "the value is
  based on Google Ads data".

Consequence for BP-011 (derived): every suggestion contains the seed's words,
so the market set is bounded by the vocabulary of the seed terms F5 produces;
a seed in the wrong vocabulary yields a wrong market, which is the failure
REQ-094's correction control exists for.

### 1.5 Labs limits

Source: https://docs.dataforseo.com/v3/dataforseo_labs/overview/ (accessed 2026-09-03).

- "DataForSEO Labs API supports only the Live method of data retrieval."
- "You can send up to 2000 API calls per minute. Contact us if you would like
  to raise the limit."
- "Note that the maximum number of requests that can be sent simultaneously
  is limited to 30."

## 2. SERP API — Google Organic, advanced

### 2.1 Pricing

Source: https://dataforseo.com/pricing/google-serp/google-organic-serp-api (accessed 2026-09-03).

- "Standard Queue … TURNAROUND TIME · 5 minutes on average* · Price per 1
  SERP (10 search results) · $0.0006"
- "Priority Queue … up to 1 minute on average · Price per 1 SERP (10 search
  results) · $0.0012"
- "Live Mode … up to 6 seconds on average · Price per 1 SERP (10 search
  results) · $0.002"
- "*The target turnaround time is 45 minutes. Extended processing may occur."
- "Price calculation for Google Organic SERP API is based on the number of
  requested SERPs (with 10 search results each), rather than search results'
  depth."
- Multipliers table: "'allinanchor:', 'allintext:', 'allintitle:',
  'allinurl:', 'define:', 'filetype:', 'id:', 'inanchor:', 'info:',
  'intext:', 'intitle:', 'inurl:', 'link:', 'site:' | Multiply by 5 for each
  parameter used"; "\"depth\" | Multiply for each 10 search engine results";
  "\"load_async_overview\" | Add one base price";
  "\"people_also_ask_click_depth\" | Add $0.00015 for each click".

Against the price book: `SERP_LIVE / SERP_STD` 0.2¢ · 0.06¢ **matches**
($0.002 / $0.0006). The `site:` ×5 and depth rules `BUILD.md` §6.4 names are
confirmed. The pricing page spells the parameter `load_async_overview`; the
docs and help center spell it `load_async_ai_overview` (§2.3).

The 45-minute standard-queue target bears on BP-050 and BP-003: a weekly
refresh on the standard queue is a two-step POST/GET job whose results may
arrive up to 45 minutes later, "Extended processing may occur", not a call
that returns.

### 2.2 What the endpoint returns

Source: https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/ (accessed 2026-09-03).

- "Live SERP provides real-time data on top search engine results for the
  specified keyword, search engine, and location. This endpoint will supply a
  complete overview of featured snippets and other extra elements of SERPs."
- "You can send up to 2000 API calls per minute, each Live SERP API call can
  contain only one task."
- `depth`: "default value: 10 · max value: 200 · Your account will be billed
  per each SERP containing up to 10 results; Setting depth above 10 may
  result in additional charges if the search engine returns more than 10
  results".
- The `ai_overview` item carries `asynchronous_ai_overview` — "indicates
  whether the element is loaded asynchronously · if true, the ai_overview
  element is loaded asynchronously; if false, the ai_overview element is
  loaded from cache; to obtain the content of ai_overview elements, use the
  load_async_ai_overview parameter in the POST request" — and an `items`
  array of `ai_overview_element`, `ai_overview_table_element`,
  `ai_overview_video_element`, `ai_overview_expanded_element`, each with
  `references`: "references relevant to the element · includes references to
  webpages that were used to generate the ai_overview_element". Each
  `ai_overview_reference` carries `source` ("reference source name or
  title"), `domain` ("domain name of the reference"), `url`, `title`, and
  `text` ("text snippet from the page that was used to generate the
  ai_overview_element").

So the per-domain citation BP-025 and BP-026 read from the SERP is a
documented field (`references[].domain`), and the string match BUILD §6.3
specifies ("Brand mentions/citations = string match over references") has
`text` and `title` to run over.

### 2.3 The asynchronous AI Overview — the fact that changes the free matrix

Source, docs: https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/ (accessed 2026-09-03), parameter `load_async_ai_overview`:

- "set to true to obtain ai_overview items is SERPs even if they are loaded
  asynchronously; if set to false, you will only obtain ai_overview items
  from cache; default value: false · Note: you will be charged extra $0.002
  for using this parameter; if the element is absent or contains
  \"asynchronous_ai_overview\": false, all extra charges will be returned to
  your account balance"

Source, help center: https://dataforseo.com/help-center/how-to-scrape-google-ai-overviews-with-serp-api (accessed 2026-09-03):

- "➤ Synchronous (cached by Google) – this type of AI Overview is immediately
  available when the search results load. Google has already processed and
  cached the content, so it's embedded directly within the HTML of the search
  results page."
- "➤ Asynchronous – this AI Overview variant is not immediately available in
  the HTML content when the search results are first loaded. This occurs when
  the AI Overview requires additional time to generate or retrieve the
  necessary information, resulting in a slight delay before the overview
  becomes visible to the user."
- "However, the data from asynchronous AI Overviews is not retrieved by
  default. To get this data, set the load_async_ai_overview parameter to
  true. When set to true, the API will make an additional request to retrieve
  data if an asynchronous AI Overview is detected."
- "Note that your account will be additionally charged when this parameter
  is set to true in a request. For example, a Standard request with normal
  priority costs $0.0006. If this request contains \"load_async_ai_overview\":
  \"true\", you will be billed an additional $0.0006, resulting in a total
  charge per request of $0.0012. If the asynchronous AI Overview is not
  available in the SERP, the extra charge will be refunded."
- "If \"load_async_ai_overview\": \"true\", but a cached AI Overview is
  present in the SERP, the additional charge is refunded."
- "If \"load_async_ai_overview\": \"false\", and an asynchronous AI Overview
  is detected, the API will return \"ai_overview\": null."

Source, help center: https://dataforseo.com/help-center/parse-google-ai-overviews-ai-mode (accessed 2026-09-03):

- "Set the load_async_ai_overview parameter to true in your request to fetch
  the asynchronous ones; without it, you'll see ai_overview: null on queries
  where Google didn't have a cached version ready."
- "Triggers are noisy. The same query can produce a full overview on Monday,
  nothing on Tuesday, and a different overview with a different source set on
  Wednesday. A daily pull is the only way to keep up."

Source, product update dated "December,11 2025": https://dataforseo.com/update/upgraded-aio-collection-for-databases-and-labs-api (accessed 2026-09-03):

- "Previously, our system captured data only for those AIOs that were already
  cached within the Google results pages. However, Google frequently serves
  AI Overviews asynchronously. This means they are not immediately available
  in the HTML content when the search results are first loaded."

What this does to the corpus (derived):

- `BUILD.md` §6.2 rules "Never set `load_async_ai_overview`" and prices the
  AI Overview "0¢ extra". With the flag off, a SERP whose AI Overview Google
  serves asynchronously returns `ai_overview: null` — indistinguishable from
  a search on which no AI Overview appeared. REQ-006 criterion 2 excludes
  such a search from the denominator and renders "no AI answer appeared";
  on an asynchronous overview that line is false: an AI answer appeared and
  was not fetched. The vendor says this case is frequent, and does not
  publish a rate.
- The surcharge is bounded and self-refunding: it equals one base price, is
  refunded when a cached overview is present or none exists, and is charged
  only when an asynchronous overview is actually retrieved. Worst case for
  the free path is therefore 12 live SERPs × 0.4¢ = 4.8¢ instead of 2.4¢,
  which takes the free report from ~6.3¢ to ~8.7¢ against `CAP_FREE` 12¢;
  for the weekly paid re-check, 13 standard SERPs × 0.12¢ = 1.56¢ instead
  of 0.78¢. These are derived figures, not vendor quotations.
- The three vendor pages disagree on the surcharge's size for the standard
  queue: the docs say "$0.002", the help center's worked example says
  "$0.0006" on a $0.0006 request, and the pricing page says "Add one base
  price". The help center and pricing page agree with each other; the docs'
  figure equals the live base price. Recorded, not resolved.
- Whether to spend it is a change to what the card promises (which AI
  answers "appear"), so it is an owner question (`OWNER-QUESTIONS.md`, Q1),
  not a parameter this file may choose.

## 3. SERP API — Google AI Mode

Source: https://dataforseo.com/pricing/google-serp/google-ai-mode-serp-api (accessed 2026-09-03).

- "Standard Queue … Turnaround time · 5 minutes* · Price per 1 SERP page ·
  $0.0012"
- "Priority Queue … up to 1 minute on average · Price per 1 SERP page ·
  $0.0024"
- "Live Mode … up to 6 seconds on average · Price per 1 SERP page · $0.004"
- "*The target turnaround time is 45 minutes. Extended processing may occur."

Source: https://docs.dataforseo.com/v3/serp/google/ai_mode/live/advanced/ (accessed 2026-09-03).

- "Google AI Mode SERP API provides search results from the AI Mode feature
  of Google Search."
- "Note: check Google Search Help for the list of countries where AI Mode is
  currently available"
- The result item is `type of element='ai_overview'` with `markdown` ("the
  text of the ai_overview formatted in the markdown markup language"), the
  same `ai_overview_element` / `ai_overview_table_element` /
  `ai_overview_video_element` children, and the same `references` array of
  `ai_overview_reference` with `source`, `domain`, `url`.

Source: https://dataforseo.com/help-center/parse-google-ai-overviews-ai-mode (accessed 2026-09-03): "The Google AI Mode Live Advanced endpoint returns content in the same format, so anything in the list below applies to both surfaces." And: "AI Overview is a single-shot summary keyed to the user's query. AI Mode behaves differently: it fans the query out into related subqueries, researches each, and synthesizes an answer with conversational memory. The two paths often land on different source sets, so a domain cited in one isn't automatically cited in the other".

**Divergence from the price book.** `BUILD.md` §6.1 pins `AI_MODE_LIVE /
STD` at 0.2¢ · 0.06¢ and BP-005 carries `AI_MODE_LIVE_C: 0.2;
AI_MODE_STD_C: 0.06`. The vendor's AI Mode price is $0.004 live / $0.0012
standard — 0.4¢ · 0.12¢, twice the organic SERP price the book copied.
Derived consequence: the paid weekly battery is 12 × (0.12¢ ChatGPT + 0.12¢
AI Mode) = 2.88¢, not the 2.2¢ `BUILD.md` §6.2 and `DATA-COSTS.md` §3 state;
the weekly refresh moves from ~8¢ to ~8.7¢ and the deep pass by the same
0.7¢. No cap is reached and no customer-visible number changes; the
correction is a price-book row and is the system's to make (rule 1.1, BP-005).

## 4. AI Optimization API

### 4.1 Scope of the API

Source: https://docs.dataforseo.com/v3/ai_optimization/overview/ (accessed 2026-09-03).

- "• LLM Responses API enables real-time generation of structured responses
  from leading LLMs, including ChatGPT, Claude, Gemini, and Perplexity, based
  on your specified input parameters."
- "• LLM Scraper API provides results from scraped ChatGPT searches, based on
  the keyword and other input parameters."
- "• AI Keyword Data API delivers search volume estimates and user intent
  insights based on keyword usage in AI tools like ChatGPT and other large
  language models."
- "• LLM Mentions API provides data on keyword, brand and website mentions
  in LLMs, including metrics like AI search volume, impressions and mentions
  count."
- "AI Keyword Data API and LLM Mentions API support only the Live method of
  data retrieval. LLM Responses and LLM Scraper APIs support both Standard
  and Live methods, depending on the selected AI platform."

### 4.2 LLM Scraper (ChatGPT, Gemini)

Source: https://dataforseo.com/pricing/ai-optimization/llm-scraper (accessed 2026-09-03).

- "LLM Scraper endpoints of DataForSEO AI Optimization APIs provide results
  from LLM searches. To date, only ChatGPT and Gemini are supported."
- "Standard Queue … Turnaround time · up to 45 minutes · Price per 1 results
  page · $0.0012"
- "Priority Queue … up to 5 minutes · Price per 1 results page · $0.0024"
- "Live Mode … Turnaround time · up to 90 seconds · Price per 1 results page
  · $0.004"

Source: https://docs.dataforseo.com/v3/ai_optimization/chat_gpt/llm_scraper/overview/ (accessed 2026-09-03).

- "ChatGPT LLM Scraper API allows you to retrieve results from ChatGPT Search
  mode, based on the keyword and other input paramaters. You can use this API
  to understand how ChatGPT responds to specific search queries, explore
  which sources and brands it quotes in its responses."
- "Execution time for tasks set with the Live ChatGPT LLM Scraper endpoint
  is currently up to 120 seconds."

Source: https://docs.dataforseo.com/v3/ai_optimization/chat_gpt/llm_scraper/live/advanced/ (accessed 2026-09-03). The result carries `model` ("indicates the model version"), `check_url` ("direct URL to search engine results"), `markdown`, `search_results` ("all web search outputs the model retrieved when looking up information, including duplicates and unused entries") and `sources` ("the sources the model actually cited or relied on in its final answer"), plus `force_web_search`: "Note: even if the parameter is set to true, there is no guarantee web sources will be cited in the response".

Against the price book: `CHATGPT_SCRAPE_STD` 0.12¢ **matches** ($0.0012);
live 0.4¢ matches. The two turnaround figures the vendor publishes for live
mode (90 s on the pricing page, 120 s in the docs) both exceed the free
report's 60-second promise (REQ-003), which is consistent with `BUILD.md`
§6.2's rule that the free path makes zero AI Optimization calls. `sources`
versus `search_results` is a documented distinction: a domain in
`search_results` was retrieved, not cited.

### 4.3 LLM Responses (ChatGPT, Claude, Gemini, Perplexity)

Source: https://dataforseo.com/pricing/ai-optimization/llm-responses (accessed 2026-09-03).

- "Live mode … Turnaround time · up to 120 seconds · Price per task · $0.0006
  + price charged by LLM*"
- "STANDARD QUEUE … Turnaround time · up to 72 hours · Price per task ·
  $0.0002 + $0.01**"
- "**$0.01 is an automatic prepayment required to execute the task. The final
  price depends on the price charged by the corresponding LLM's API – if it's
  less than $0.01, the difference is refunded to the account balance."

Source: https://docs.dataforseo.com/v3/ai_optimization/llm_responses/overview/ (accessed 2026-09-03): "ChatGPT, Gemini and Claude in LLM Responses API support both Standard and Live methods." "Perplexity in LLM Responses API supports only the Live method of data retrieval."

Source: https://docs.dataforseo.com/v3/ai_optimization/perplexity/llm_responses/live/ (accessed 2026-09-03): "Note: Perplexity uses web_search in all sonar-family models by default, but it's not guaranteed to work with every request." "The number of concurrent Live tasks is currently limited to 30 per account for each platform in the LLM Responses." The response reports `money_spent` and the task cost "includes the base task price plus the money_spent value"; `annotations` "may return empty even when web_search is true, as the AI will attempt to retrieve web information but may not find relevant results".

Source: https://docs.dataforseo.com/v3/ai_optimization/chat_gpt/llm_responses/live/ (accessed 2026-09-03): `user_prompt` "you can specify up to 500 characters"; `force_web_search`: "even if the parameter is set to true, there is no guarantee web sources will be cited in the response".

Against the price book: the 0.06¢ base **matches** ($0.0006 live). The
"≈0.5–0.6¢" Perplexity total in `DATA-COSTS.md` §1 depends on Perplexity's
own model price, which no DataForSEO page states; it is **not verified
here** and the row is deferred to v1.1 in any case. Perplexity has no
standard queue, so a deferred Perplexity engine could not ride the standard
price the weekly battery assumes.

### 4.4 AI Keyword Data

Source: https://dataforseo.com/pricing/ai-optimization/ai-keyword-search-volume (accessed 2026-09-03).

- "Price per task · $0.01 · Price per item · $0.0001"
- "The AI search volume values are calculated using statistical data from
  questions in the 'People Also Ask' SERP element."
- "The number of keywords you can get in response is limited to 1000".

Against the price book: "1¢/task + 0.01¢/kw" **matches**. The provenance
line is the fact to weigh before v1.1 admits it: the "AI search volume" is
modelled from People Also Ask, not observed in an AI tool.

### 4.5 LLM Mentions — not in the price book

Source: https://dataforseo.com/pricing/ai-optimization/llm-mentions (accessed 2026-09-03): "Price per request · $0.1 … Price per row · $0.001"; "Your account will be billed for setting a task and retrieving its results, where one row in the results is the object containing data on a single domain or keyword mention with related data." (The page's calculator also displays "$0.05" for 1,000 rows, which does not follow from the two unit prices it shows; recorded as displayed, unresolved.)

Source: https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/target_metrics/live/ (accessed 2026-09-03): "Live LLM Mentions Target Metrics endpoint provides aggregated metrics for mentions of the keywords or domains specified in the target array of the request. The results are specific to the selected platform (google for Google's AI Overview or chat_gpt for ChatGPT), location and language parameters".

This is a vendor-side index of who is mentioned in AI answers across the
vendor's own prompt corpus — the dataset the competing products in
`RESEARCH-competitor-visibility-measurement.md` sell. It is on no list in
`BUILD.md` §6.3 or §6.4. `DATA-COSTS.md` §6 item 5 already binds any new
spend site to "its own price-book row before it ships"; nothing here changes
that.

## 5. Rate and request limits

Source: https://dataforseo.com/help-center/rate-limits-and-request-limits (accessed 2026-09-03).

- "The general rate limit for DataForSEO API is 2,000 requests per minute."
- "➤ User Data endpoint: 6 requests per minute."
- "➤ Tasks Ready endpoints: 20 requests per minute. Using callbacks is
  recommended for better performance."
- "To ensure optimal API performance, we recommend setting up to 100 tasks
  per request for task_post endpoints. Most Live endpoints of DataForSEO APIs
  do not support setting multiple tasks in one request".
- "For endpoints working with our databases, the maximum number of
  simultaneous requests is limited to 30."
- "LLM Scraper endpoints, including Chat GPT LLM Scraper and Gemini LLM
  Scraper have a standard limit of 2000 requests per minute by default."

Source: https://docs.dataforseo.com/v3/serp/overview/ (accessed 2026-09-03): "You can send up to 2000 POST and GET API calls per minute in total, with each POST call containing no more than 100 tasks."

Derived for BP-008's NFR budget and BP-050: the free path's 12 live SERPs
and the Labs calls sit far inside 2,000/min, but every Labs call and every
live SERP is one task per call, and Labs calls share a 30-concurrent ceiling
per account — the bound the free scan's "bounded concurrency" must respect
across simultaneous free scans (200/day is the stated ceiling), not per
scan. A scheduled weekly job polling `Tasks Ready` is bounded at 20 polls a
minute; the vendor recommends callbacks instead.

## 6. Divergence summary against `DATA-COSTS.md` §1 and `BUILD.md` §6.1

| Book row | Book | Vendor, 2026-09-03 | Kind |
|---|---|---|---|
| Labs task + row | ~1.2¢ + 0.01¢/row | $0.012 + $0.00012 | matches (book rounds 0.012¢ to 0.01¢) |
| SERP organic live / std | 0.2¢ / 0.06¢ | $0.002 / $0.0006 | matches |
| **AI Mode live / std** | **0.2¢ / 0.06¢** | **$0.004 / $0.0012** | **diverges ×2** |
| ChatGPT scraper live / std | 0.4¢ / 0.12¢ | $0.004 / $0.0012 | matches |
| LLM Responses base | 0.06¢ + model | $0.0006 + LLM; std $0.0002 + $0.01 prepay | base matches; model cost unverified |
| AI Keyword Data | 1¢ + 0.01¢/kw | $0.01 + $0.0001 | matches |
| AI Overview inside SERP | 0¢ extra, flag never set | 0¢ only for cached overviews; async returns `null` unless flag set; surcharge one base price, refunded when unused | **diverges in kind** — see §2.3 |
| Standard-queue turnaround | "standard queue" | "5 minutes on average*" · "*The target turnaround time is 45 minutes" | design fact for BP-050 |
| LLM Mentions | absent | $0.1/request + $0.001/row | new endpoint, no row |

## Why this sits here and not in a requirement or blueprint

Vendor prices, limits and field names are evidence (rule 2.1: a REQ carries no
vendor evidence) and the price-book constants are BP-005's to restate (rule
2.4). Two findings change what a card says to a reader — §2.3's asynchronous
AI Overview and, through `RESEARCH-ai-answer-stability.md`, the weekly
movement of a single-sample cell — and those are put to the owner as
questions in `OWNER-QUESTIONS.md` rather than folded into REQ-006 here.
