// src/lib/config/constants/publish.ts — the veto, destinations, the hosted blog and who reads it. Imports nothing.

/** SPEC §0 and §7: "Default 24 h; range 1-7 days; there is no zero window."
 *  `minDays` read 0 until 2026-09-12, which is a draft with no veto path at
 *  all — the one window the ruling forbids. */
export const VETO = Object.freeze({
  defaultHours: 24, minDays: 1, maxDays: 7,
} as const);

/** SPEC §6 (2026-09-20, #908) measure (d) and §7 of the same date, issue
 *  #921 — the three closed lists behind "pages fetched by an answer engine
 *  for a user's question, and visitors arriving from one, counted by day,
 *  page and engine".
 *
 *  **Beside `AI_READER_AGENTS`, never inside it.** That list is read by
 *  the blocked-readers count, the paste block and the score; adding a
 *  name to it would change a score and a site-issue count. These are a
 *  different question — not "may an engine read this site" but "did one
 *  read this page, and why" — so they are their own pins and the one
 *  overlap (the three search indexers) is spelled here again rather than
 *  sliced out of a list that means something else.
 *
 *  **Three kinds, and only two of them are progress.** A *user fetcher* is
 *  an engine going to the page because a person asked it something; a
 *  *search indexer* is an engine building the index it answers from. §6(d)
 *  is explicit that "training crawlers are not progress and are not shown",
 *  so `AI_TRAINING_CRAWLERS` exists to be *excluded* by name rather than by
 *  omission — a token that matches it is never counted, whatever else the
 *  agent string also says.
 *
 *  Each token maps to the engine a customer knows it by; the engine names
 *  are internal handles (constitution rule 1.1), and every word drawn on
 *  the card is a registry key. */
export const AI_BLOG_ENGINES = Object.freeze([               // SPEC §6 2026-09-20 (d) · issue 921
  "chatgpt", "perplexity", "claude", "gemini", "copilot",
] as const);

/** The user-triggered fetchers: an engine fetching the page because a
 *  person asked it a question. Named by SPEC §6's own issue #921. */
export const AI_ANSWER_FETCHERS = Object.freeze({            // issue 921
  "ChatGPT-User": "chatgpt",
  "Perplexity-User": "perplexity",
  "Claude-User": "claude",
} as const);

/** The search indexers: an engine building the index its answers are drawn
 *  from. All three are also in `AI_READER_AGENTS`, which asks a different
 *  question of them. */
export const AI_SEARCH_INDEXERS = Object.freeze({            // issue 921
  "OAI-SearchBot": "chatgpt",
  "PerplexityBot": "perplexity",
  "Claude-SearchBot": "claude",
} as const);

/** Excluded by name, never by omission: a hit whose agent carries one of
 *  these is not counted at all. §6(d): "training crawlers are not progress
 *  and are not shown." SPEC §9 (D14) reads the same list: a site that
 *  blocks one has opted out of training, which is never an issue.
 *  Google-Extended is a robots token only and never appears in a request's
 *  agent string. */
export const AI_TRAINING_CRAWLERS = Object.freeze([          // issue 921 · SPEC §9 D14
  "GPTBot", "ClaudeBot", "Google-Extended",
] as const);

/** Where a visitor came from, when the referrer or `utm_source` says an AI
 *  app. Hosts are matched as the host itself or a subdomain of it, so
 *  `www.perplexity.ai` is Perplexity and `perplexity.ai.example.com` is
 *  not. This is the "at least" half of the card: most AI apps send no
 *  referrer at all, and the sentence beside the figure says so. */
export const AI_REFERRER_HOSTS = Object.freeze({             // issue 921
  "chatgpt.com": "chatgpt",
  "perplexity.ai": "perplexity",
  "gemini.google.com": "gemini",
  "copilot.microsoft.com": "copilot",
  "claude.ai": "claude",
} as const);

/** The same five, as the `utm_source` values an AI app appends when it
 *  sends no referrer. Lower-cased at the comparison, never here. */
export const AI_REFERRER_SOURCES = Object.freeze({           // issue 921
  chatgpt: "chatgpt",
  perplexity: "perplexity",
  gemini: "gemini",
  copilot: "copilot",
  claude: "claude",
} as const);

/** The card's own window (drafted, issue #921: "Last 7 days") and how long
 *  a day's counts are kept. Four weeks is the rolling window every other
 *  AI-answer measure on this screen is read over (`ANSWER_RATE_WEEKS`), so
 *  the roll-up outlives the card's week by enough to answer a month and no
 *  longer. Retention is enforced by the writer, in the same statement that
 *  counts a hit — see `record_publication_read`. */
export const BLOG_READS_WINDOW_D = 7 as const;               // issue 921
export const BLOG_READS_RETENTION_W = 4 as const;            // issue 921

/** The two search crawlers a hosted page counts (issue 1553), by the token
 *  each engine documents for its agent string. An agent claiming one is
 *  counted only from an address inside that engine's published ranges
 *  (`SEARCH_CRAWLER_RANGES`): the agent string is free text, the address
 *  is not. Case-sensitive, as the AI tokens above are. */
export const SEARCH_CRAWLERS = Object.freeze({               // issue 1553
  Googlebot: "google",
  bingbot: "bing",
} as const);

/** The search hosts a hosted page's visitor counts as coming from (issue
 *  1614, D6), matched exactly on the `Referer` host — no suffix or
 *  substring, so `google.evil.example` and `mail.google.com` are not
 *  search. Google's own list of its search domains
 *  (https://www.google.com/supported_domains), each bare and with `www.`. */
const GOOGLE_SEARCH_TLDS = `
  com ad ae com.af com.ag al am co.ao com.ar as at com.au az ba com.bd be bf bg com.bh bi
  bj com.bn com.bo com.br bs bt co.bw by com.bz ca cd cf cg ch ci co.ck cl cm cn com.co
  co.cr com.cu cv com.cy cz de dj dk dm com.do dz com.ec ee com.eg es com.et fi com.fj fm
  fr ga ge gg com.gh com.gi gl gm gr com.gt gy com.hk hn hr ht hu co.id ie co.il im co.in
  iq is it je com.jm jo co.jp co.ke com.kh ki kg co.kr com.kw kz la com.lb li lk co.ls lt
  lu lv com.ly co.ma md me mg mk ml com.mm mn com.mt mu mv mw com.mx com.my co.mz com.na
  com.ng com.ni ne nl no com.np nr nu co.nz com.om com.pa com.pe com.pg com.ph com.pk pl pn
  com.pr ps pt com.py com.qa ro ru rw com.sa com.sb sc se com.sg sh si sk com.sl sn so sm
  sr st com.sv td tg co.th com.tj tl tm tn to com.tr tt com.tw co.tz com.ua co.ug co.uk
  com.uy co.uz com.vc co.ve co.vi com.vn vu ws rs co.za co.zm co.zw cat`.trim().split(/\s+/);
export const SEARCH_REFERRER_HOSTS: Readonly<Record<string, (typeof SEARCH_CRAWLERS)[keyof typeof SEARCH_CRAWLERS]>> = Object.freeze({
  ...Object.fromEntries(GOOGLE_SEARCH_TLDS.flatMap((tld) => [["google." + tld, "google"], ["www.google." + tld, "google"]])),
  "bing.com": "bing",
  "www.bing.com": "bing",
});

/** Where each engine publishes its crawler's addresses, as JSON
 *  `{ prefixes: [{ ipv4Prefix } | { ipv6Prefix }] }` (Google, "Verifying
 *  Googlebot"; Bing, "Verifying Bingbot"). Read at most once a day per
 *  process. */
export const SEARCH_CRAWLER_RANGES = Object.freeze({         // issue 1553
  google: "https://developers.google.com/static/search/apis/ipranges/googlebot.json",
  bing: "https://www.bing.com/toolbox/bingbot.json",
} as const);
export const SEARCH_CRAWLER_RANGES_TTL_H = 24 as const;      // issue 1553

/** Search Console's limit of properties per account (Google, "Usage
 *  limits"). The pool hands a new host to the first account below it. */
export const GSC_PROPERTIES_PER_ACCOUNT = 1000 as const;      // issue 1553

/** The window impressions and the best place are read over, ending the
 *  day the pass runs: the four weeks every other measure on Overview uses
 *  (`ANSWER_RATE_WEEKS`). Search Console's newest days are still filling,
 *  which a sum over four weeks absorbs. */
export const SEARCH_READING_WINDOW_D = 28 as const;           // issue 1553

/** SPEC §7 (2026-10-18, issue 1514): how long a cached hosted article may
 *  take to its first byte, read by `scripts/smoke.sh` from where it runs.
 *  Measured at 0.42–0.89 s from the EU on 2026-10-18; a text page's largest
 *  paint is mostly this and its fonts. */
export const HOSTED_TTFB_BUDGET_MS = 1000 as const;
/** And how many fonts a hosted page may preload (the same ruling). */
export const HOSTED_FONT_PRELOADS = 2 as const;

// Publishing, destinations and verification
export const PUBLISH_RETRY_BACKOFF_MIN = Object.freeze([5, 30, 180] as const);   // BP-045 · REQ-056 c4
export const DESTINATION_HEALTH_MAX_AGE_H = 24 as const;     // BP-058 · REQ-074 c1
/** How long one destination's health check stands before the read path
 *  will run another. Chosen, not transcribed (BP-058 NFR budget): the
 *  smallest window that collapses an ordinary navigation burst — a
 *  customer moving between Overview, the calendar and Settings — into one
 *  check. Deliberately not `DESTINATION_HEALTH_MAX_AGE_H`, which bounds a
 *  different thing: the age of the date the customer reads. Reversal cost
 *  is this one number. */
export const DESTINATION_HEALTH_DEBOUNCE_S = 60 as const;    // BP-058 NFR budget
/** How long a destination must have needed reconnecting before the one
 *  breakage mail is due (§9, REQ-074 c6: "has needed reconnecting for 24
 *  hours"). Deliberately not `DESTINATION_HEALTH_MAX_AGE_H`, which also
 *  holds 24 and bounds the age of the date the customer reads: one is how
 *  stale a check may be, the other is how long a breakage stands before
 *  the customer is written to, and they move independently. */
export const DESTINATION_BREAKAGE_MAIL_DELAY_H = 24 as const; // BP-058 · REQ-074 c6
/** How long the project's domain list stands before one hostname is asked
 *  about again (SPEC §5, 2026-09-12 — the hostname is added "on save … and
 *  the certificate is automatic once the CNAME resolves"). Chosen, not
 *  transcribed: the health pass reaches every hosted destination, so
 *  without a window each pass is one vendor call per destination. An hour
 *  is the coarsest window that still heals a save made while the vendor was
 *  unreachable on the same day the founder made it. Reversal cost is this
 *  one number. */
export const DESTINATION_HOSTNAME_RECHECK_H = 1 as const;     // SPEC §5 (2026-09-12)
/** The shortest gap between two vendor calls a founder's own "check
 *  connection" press may make for one site (issue #757). Chosen, not
 *  transcribed: a press asks the vendor now rather than waiting out
 *  `DESTINATION_HOSTNAME_RECHECK_H`, so it needs its own floor or the button
 *  becomes a way to call the Domains API in a loop. Half a minute is longer
 *  than a double-click or a second tab and shorter than the time it takes to
 *  edit a DNS record and come back. A press inside it is told when it may ask
 *  again — never handed an old answer as a new one. Reversal cost is this one
 *  number. */
export const DESTINATION_HOSTNAME_CHECK_FLOOR_S = 30 as const; // SPEC §5 (2026-09-16, #757)

/** BP-049 NFR budget: "`VERIFY.coverageFloor = 0.95` and `VERIFY.userAgent`
 *  belong in BP-005 (config over constants, rule 7)." `userAgent` is our own
 *  token, chosen here as a parameter (rule 1.1) — "our own token … it is not
 *  one of the six named AI agents, and impersonating one of them would be a
 *  false statement to a server we are measuring" — never customer copy. */
export const VERIFY = Object.freeze({                         // BP-049 · REQ-062
  coverageFloor: 0.95,
  userAgent: "ReachKitVerify/1.0 (+https://reachkit.app)",     // userAgent is a machine token, not customer copy
  /** How many sitemap documents one page's check may read before it stops
   *  and reports that it could not read the site's sitemap (issue #50).
   *  A sitemap index names further documents, and following them without a
   *  bound turns one page's check into an unbounded crawl of a site
   *  ReachKit does not serve. Chosen here as a parameter: five covers the
   *  robots-declared documents plus the two conventional addresses on every
   *  shape of site this check has to read, and a site that needs more is
   *  reported as unread for that one page rather than crawled further.
   *  Reversing it is one number and no customer-visible consequence. */
  sitemapMaxDocuments: 5,
} as const);
/** BUILD §11: `publish/verify` runs "+24h" after a publish. Distinct from
 *  `DAILY_WINDOW_H`, which is BP-023's free-scan rate-limit window and
 *  happens to share the number; the two move independently. */
export const PUBLISH_VERIFY_DELAY_H = 24 as const;            // BP-049 · BUILD §11

// ── Setup's destination card (issue #14) — BUILD §4.3 (§9's hosted CMS)
/** §9, transcribed (rule 1.2 — nothing chosen): "**Hosted CMS:**
 *  `content.{customer-domain}` by CNAME → our edge route serves
 *  static-rendered pages by Host header." The label, never the record,
 *  which is `src/lib/publish/setup/cards.ts`'s (rule 2.5). The target the
 *  record points at is `HOSTED_EDGE_CNAME_TARGET`, an env binding, because
 *  it differs per deployment; this label does not. */
export const HOSTED_SUBDOMAIN_LABEL = "content" as const;     // BUILD §4.3

// ── Publishing, the veto leaf (issue #46) — BUILD §9
/** The whole of one delivery attempt, bounded. Distinct from the egress
 *  seam's per-request bound (BUILD §6.4: 8 s default, 15 s hard maximum),
 *  which bounds one byte-stream toward one customer URL: an adapter makes
 *  several requests — create, set meta, read back the address — and this is
 *  the bound on all of them together, so a destination that answers every
 *  request slowly cannot hold a publish attempt open indefinitely.
 *  Chosen (rule 1.1): 20 s is above the §6.4 hard maximum, so a single
 *  slow request still fails on its own bound and is reported as itself,
 *  and low enough that a held attempt is retried within the first backoff
 *  step (`PUBLISH_RETRY_BACKOFF_MIN[0]`, 5 minutes). Reversal cost: one
 *  number. Raised as a possible pin by #45's PR and taken here. */
export const PUBLISH_DELIVER_TIMEOUT_MS = 20_000 as const;   // BP-045 · BUILD §9 (chosen)

/** The veto token's entropy, in bytes from a CSPRNG (REQ-057 c1's "single
 *  action to stop it"). 32 bytes is the width every other single-use
 *  secret in the product is minted at; only its SHA-256 hash is stored. */
export const VETO_TOKEN_BYTES = 32 as const;                 // BP-046 · REQ-057 c1

// ── The WordPress destination (issue #54) — BUILD §9 · REQ-060
/**
 * The pins the WordPress adapter runs on. One group, because every member
 * is a fact about the same destination and a reader chasing one wants the
 * others in front of them.
 *
 * `stampSlug` and `stampName` are **ADR-083 Decision 5's pin**, and their
 * *values* are the owner's, not this file's: the term is visible on the
 * customer's own public site from the moment a page is delivered
 * (ADR-084 Decision 5), and a customer-visible string is owner-owed. They
 * are pinned here so that the reversal is one line and so that no second
 * spelling of the term can exist; the values below are placeholders the
 * owner rules on, and the PR that added them says so.
 *
 * `markerPrefix` is **ADR-080 decision 5's marker**, and it is not a
 * tuning knob: it is the only at-most-once mechanism available at a
 * destination whose database we cannot index. Changing it is a migration
 * of somebody else's site and requires a fallback that finds the old shape
 * first.
 *
 * `markerSearchLimit` bounds the candidate page the marker search reads
 * back before confirming each candidate exactly. **Chosen** (rule 1.1):
 * no requirement states one. Derivation: the search is by a token that
 * appears in no human-written post, so a correct site returns at most one
 * row; 20 is small enough that a site answering with a page of unrelated
 * posts costs one bounded read, and large enough that a site whose search
 * ranks loosely still carries our post in the first page. Reversal cost:
 * one number.
 */
export const WORDPRESS = Object.freeze({
  /** The REST root, appended to the customer's site root. Derived from
   *  `baseUrl` at every call and stored nowhere a second time. */
  restBase: "/wp-json",
  /** The idempotency marker's token. `{prefix}:{draftId}` is what the
   *  search looks for and what a candidate is confirmed against. */
  markerPrefix: "reachkit-draft",
  /** How many candidates the marker search reads back before confirming. */
  markerSearchLimit: 20,
  /** ADR-083's findability stamp, as a `post_tag` term. Owner-owed values. */
  stampSlug: "reachkit",
  stampName: "ReachKit",
} as const);

// ── The hosted edge (issue #49) — BUILD §9
/** §9, transcribed (rule 1.2 — nothing chosen): "Preview at
 *  `{slug}.reachkit.app` is `noindex` **forever** (site-reputation-abuse
 *  guardrail — customer content never ranks on our domain)."
 *
 *  The parent of every preview host, and the one place the spelling lives.
 *  It is **not** `NEXT_PUBLIC_APP_URL`'s host and never derived from it:
 *  the app's own address is a per-deployment binding (`dev.reachkit.app`
 *  today, the apex at M4), while this suffix is the product's own name and
 *  the same in every deployment. `resolveHost()` reads both — the app's own
 *  host is subtracted from this suffix's children, so the deployment's own
 *  address is never mistaken for a customer's preview. */
export const PREVIEW_HOST_SUFFIX = "reachkit.app" as const;   // BUILD §9

/** REQ-076 c10, quoted through `DECISIONS.md` and BP-060: 30 days after a
 *  departed customer's paid-through date "ReachKit stops serving their
 *  hosted pages and every address that served one returns 410 Gone rather
 *  than a page, a redirect or a not-found" — and a deleted account's pages
 *  stop at the moment of deletion (REQ-079 c6).
 *
 *  Deliberately **not** `REPORT_REMOVED_STATUS`, which happens to hold the
 *  same number and bounds a different thing: that one is the report
 *  address's answer after a written removal request (#28), and the two move
 *  independently — the same reason `PUBLISH_VERIFY_DELAY_H` is its own
 *  constant beside `DAILY_WINDOW_H`. */
export const HOSTED_GONE_STATUS = 410 as const;               // BUILD §9 · REQ-076 c10

// ── The Markdown renderer (issue #158) — BUILD §9 · §4.6
/**
 * The schemes a draft's link may address, and the whole of the renderer's
 * address policy (`src/lib/publish/render/markdown.ts`).
 *
 * **An allowlist, never a blocklist.** A blocklist of dangerous schemes is
 * always one scheme behind — `javascript:` is the one everybody names and
 * `data:`, `vbscript:` and the next one nobody has written down are the
 * reason the list is closed the other way round. A link whose scheme is not
 * one of these renders as its own label, in plain text: the words the
 * customer wrote survive and the address does not become clickable.
 *
 * It is pinned here rather than left inside the renderer because it decides
 * what publishes onto a customer's own domain, and because it is read in
 * two directions — the renderer vets an address against it, and a test
 * asserts a scheme outside it never reaches an `href`.
 *
 * `/` is on it because a draft may link within the site it is published to;
 * every other member names a scheme a reader's browser will open as a
 * document or a mail, and nothing that executes.
 */
export const MARKDOWN_LINK_SCHEMES = Object.freeze([
  "http://",
  "https://",
  "mailto:",
  "/",
] as const);
