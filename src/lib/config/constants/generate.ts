// src/lib/config/constants/generate.ts — the context pack, the writer and its rules. Imports nothing.

/** SPEC §7 (D41) — the five-stage pipeline's own bounds.
 *
 *  `fixBeforeMs`: the one fix call is started only while the page has been
 *  in the making for less than this, so research, the write call and the fix
 *  call stay inside the draft job's invocation (`TIMING.jobsCeilingS`).
 *  `nextTopicBeforeMs`: D26's next topic is tried in the same run only this
 *  early, for the same reason. */
export const PIPELINE = Object.freeze({
  fixBeforeMs: 165_000,
  nextTopicBeforeMs: 120_000,
} as const);

/** What a context pack carries at most (SPEC §7, D41 stage 2): the business
 *  passages handed to the writer, the site's published and planned pages
 *  (D36: at most 100), and a Q&A page's questions (D42: 5–8). A business
 *  fact already stated on `repeatedOn` of the site's live pages is offered
 *  last: each page says something its siblings do not. */
export const PACK = Object.freeze({ facts: 40, pages: 100, questions: 8, repeatedOn: 2 } as const);

/** SPEC §7 (D61): two headings are too alike where they share this fraction
 *  of the longer one's words, or open with this many of the same words. */
export const DISTINCT_HEADINGS = Object.freeze({ overlap: 0.6, opening: 6 } as const);

/**
 * How much of the confirmed business profile a generation prompt may carry
 * (SPEC §7: the confirmed business profile joins the writer's inputs).
 *
 * **A bounded block, because a prompt's budget is the draft's cost.** The
 * profile is the customer's own curated lists, and a customer may add to
 * them: nothing else bounds what arrives, so the prompt does. `CAPS.DRAFT_C`
 * is the ceiling this protects — a page written from an unbounded list is a
 * page that spends the day's budget on vocabulary.
 *
 * **Four of the item caps restate pins held elsewhere**, rather than importing
 * them, because their homes reach the language model
 * (`src/lib/site-profile/summary.ts`'s `VOICE_LIST_MAX`) or bound what a
 * model may *answer* with rather than what a prompt may *carry*:
 *
 *   · `products` 8 and `promises` 8 — `VOICE_LIST_MAX.products` / `.claims`;
 *   · `audience` 4 — `PROFILE_LIST_BOUNDS.audienceTerms.max`;
 *   · `vocabulary` 12 — `PROFILE_LIST_BOUNDS.vocabulary.max`.
 *
 * `itemChars` and `jobChars`: an item is a product name or a promise, not a
 * paragraph, and *what you do* is one sentence.
 *
 * `blockChars` is the ceiling over all of it together, applied last, so the
 * worst case is one number rather than the product of six. The knowledge base
 * (SPEC §5) is offerings with their features and prices, proof, buyers'
 * questions and the founder's answers, and 6,000 characters — about 1,500
 * tokens, under half a cent a call on the small tier — is a drafted cap. What
 * is trimmed first is named in `src/lib/generate/voice/profile-block.ts`.
 *
 * `knowledgeItems` is how many entries each knowledge list may carry, and
 * `knowledgeItemChars` how long one may be: a differentiator or a customer
 * result is a sentence, not a product name.
 */
export const PROFILE_PROMPT_CAPS = Object.freeze({
  products: 8,
  audience: 4,
  promises: 8,
  vocabulary: 12,
  itemChars: 80,
  jobChars: 200,
  knowledgeItems: 12,
  knowledgeItemChars: 240,
  blockChars: 6000,
} as const);

/** SPEC §7 Rules: every asset links to the customer's own pages and to
 *  earlier assets in its cluster. (`src/lib/generate/links/`)
 *
 *  `SITE_MIN`–`SITE_MAX` — a page carries three to six links into the
 *  customer's own site. Up to `SITE_MAX` pages are offered to the writer,
 *  ranked by how much they share with the page's topic across the whole
 *  crawled inventory; a page the writer linked fewer than `SITE_MIN` of
 *  has the best of the rest listed until it holds that many.
 *
 *  `CLUSTER_PAGES_MAX` bounds the same list for the cluster's earlier
 *  pages, newest first. At one page a day a cluster rarely reaches it; the
 *  bound is there so a long-lived cluster does not turn every new page
 *  into an index of the old ones.
 *
 *  `BACK_PAGES_MAX` — links in both directions: when a page goes live, at
 *  most this many of the site's older live pages are planned an update
 *  that links to it (`opportunities/refresh.ts`).
 *
 *  The live check at publish: each address is asked once, `HEAD` then
 *  `GET`, for at most `CHECK_TIMEOUT_MS`, `CHECK_CONCURRENCY` at a time, and
 *  the whole check for at most `CHECK_BUDGET_MS` — it must fit beside the
 *  delivery inside the job's invocation. */
export const CROSS_LINKS = Object.freeze({
  SITE_MIN: 3,
  SITE_MAX: 6,
  CLUSTER_PAGES_MAX: 5,
  BACK_PAGES_MAX: 2,
  CHECK_TIMEOUT_MS: 5_000,
  CHECK_CONCURRENCY: 6,
  CHECK_BUDGET_MS: 12_000,
} as const);

export const GENERATION = Object.freeze({
  duplicateThreshold: 0.85, regenerations: 1,
} as const);

/** SPEC §7 *honesty by page type*: the most sentences naming the business one
 *  fit check reads. A page of 2,500 words that names it in every paragraph
 *  stays inside the check's one small call. */
export const FIT_CHECK_MAX_SENTENCES = 40;

// Generation
export const SHINGLE_SIZE = 5 as const;
export const NEAR_DUPLICATE_MAX = 0.85 as const;             // BUILD §8

/** SPEC §7 (D13): a draft is compared with what ReachKit wrote for **other**
 *  sites, at `NEAR_DUPLICATE_MAX` — the same bar as the same-site check, so
 *  there is no second threshold here. `months` is the ruling's; `pagesMax`
 *  bounds one read, newest first (a drafted default: a run that reaches it
 *  logs that it did); `noteSentences` is how many of the draft's own shared
 *  sentences the one rewrite is told to avoid. */
export const ELSEWHERE = Object.freeze({ months: 12, pagesMax: 1000, noteSentences: 12 } as const);

/** The pinned battery behind `no_machine_address`: an instruction or
 *  assertion directed at an assistant, a crawler or a ranking system about
 *  how to treat, cite, rank or recommend the page, matched against the
 *  rendered text. The battery decides the forms it lists and no others; no
 *  pass can prove the list complete, so a form found later is added here, in
 *  one file. An empty list is never shipped: `machine.test.ts` fails its
 *  guard assertion on one. */
export const MACHINE_ADDRESS_PATTERNS = Object.freeze([
  /\b(dear|attention|note to)\s+(the\s+)?(ai|assistant|chatbot|llm|language model)\b/i,
  /\bif you(?:'re| are) an? (ai|language model|assistant|chatbot)\b/i,
  /\bignore (?:all |any )?(?:previous|prior|the above) instructions\b/i,
  /\b(dear|attention|note to)\s+(the\s+)?(crawler|bot|spider|search engine)\b/i,
  /\b(please\s+)?(cite|rank|recommend|index)\s+this\s+(page|article|post|content)\b/i,
]);

export const CLAIM_RECHECK_SWEEP_MAX = 25 as const;

/** SPEC §6: "A format page fires only for a missing comparison, alternative,
 *  integration or template; glossary, changelog, blog and resources hub
 *  never qualify." The list is the gate: a format outside it never fires. */
export const FORMAT_PAGE_ALLOWED = Object.freeze([
  "comparison", "alternative", "integration", "template",
] as const);                                                  // §6


/** SPEC §7: the answerability pass may "shorten a first block to 40–320
 *  characters where a question heading already exists". The same bound is
 *  what a draft's opening block must fall inside to count as an answer. */
export const ANSWER_FIRST_BLOCK_CHARS = Object.freeze({ min: 40, max: 320 } as const); // §7

/** SPEC §7 (*What every page carries*): the counts a generated page is held
 *  to, in code. The answer box is counted in words; a section is an H2.
 *  `taglineRepeats`: a promise of the business's own is said at most twice.
 *  `businessPromises`: the closing section on how the business handles the
 *  question says at most this many of its promises. */
export const PAGE_BLOCKS = Object.freeze({
  answerWords: { min: 40, max: 60 },
  takeaways: { min: 3, max: 5 },
  faq: { min: 3, max: 6 },
  taglineRepeats: 2,
  businessPromises: 2,
} as const);                                                   // §7

/** SPEC §7 — what the prose check holds a generated page to
 *  (`src/lib/generate/rules/prose.ts`). Each threshold is set above what the
 *  pages people wrote reach and below what the stored pages did
 *  (`docs/walk/prose-gate.md`, `npm run eval:content -- --prose`): drafted
 *  from that measurement, the owner corrects them. */
export const PROSE = Object.freeze({
  /** Joining dashes: more than `perThousand` a thousand words, and at least
   *  `least` — a short page with one aside is not stopped. People's pages
   *  reached 6.4; the stored pages' middle was 8.5. */
  dashes: { perThousand: 7, least: 4 },
  /** A sentence of this many words or more is one a reader hears said
   *  again. It may be said `PAGE_BLOCKS.taglineRepeats` times. */
  repeatedSentence: { minWords: 4 },
  /** A run of `longWords` words said `longTimes` times — a tagline, one over
   *  its cap — or of `shortWords` said `shortTimes` times. People's pages
   *  said a run of four words four times and one of six three times. */
  repeatedPhrase: { shortWords: 4, shortTimes: 6, longWords: 7, longTimes: 3 },
  /** The items of one list that turn on the same label ("— result:"). */
  listScaffold: { minItems: 3 },
  /** Sentence lengths' standard deviation over their mean, under `least`,
   *  on a page of `minSentences` sentences or more. People's pages went as
   *  low as 0.31, so this stops only a page of sentences all one length. */
  evenSentences: { least: 0.3, minSentences: 20 },
  /** Tell phrases (`prose-english.ts`): one construction used `samePattern`
   *  times, or `most` of any kind together. People's pages reached two of a
   *  construction and six together. */
  tellPhrases: { samePattern: 3, most: 7 },
} as const);                                                   // §7

/** SPEC §7 — the page's voice (`src/lib/generate/voice/register.ts`). The
 *  short answer's length is the owner's; a simple question's longest is
 *  drafted. */
export const VOICE = Object.freeze({
  short: { words: { floor: 600, ceiling: 900 }, questionWords: 10 },
  /** Named statistics or quotations a page aims to carry, each from the
   *  pack with its source. */
  evidence: { min: 2, max: 4 },
} as const);                                                   // §7

/** SPEC §7 (D51) — what the stage-4 `title` check holds a page's `<title>`
 *  and its meta description to. The numbers, the year's types and the banned
 *  patterns are the ruling's; the engine names and the first three words of
 *  a search term are how code reads "an engine" and "the search term"
 *  (drafted). */
export const TITLE = Object.freeze({
  chars: { min: 30, max: 65 },
  /** The length a title is written for, and preferred among those proposed. */
  aim: { min: 50, max: 60 },
  /** The search's wording starts within this many characters of the title. */
  headChars: 30,
  /** How many titles the writer proposes; code picks one. */
  candidates: 3,
  /** How many rivals and places the writer is told count as a specific. */
  namesTold: 8,
  /** How many of the pack's figures the writer is shown. */
  figuresTold: 12,
  /** The least token overlap at which an H1 is its title's near twin. */
  headingMin: 0.8,
  /** How many of a search term's leading words the title must carry. */
  termWords: 3,
  /** Token overlap with a title the site has published or planned. */
  overlapMax: 0.8,
  description: { min: 120, max: 155 },
  /** The types whose title may carry the current year. A comparison and an
   *  alternatives page are listicles (D42). */
  yearTypes: ["listicle", "research", "insights"],
  banned: [
    "questions, answered",
    "buyer questions",
    "ultimate guide",
    "complete guide",
    "everything you need to know",
    "unlock",
    "comprehensive",
  ],
  engines: ["chatgpt", "perplexity", "claude", "gemini", "copilot", "google", "ai overview", "ai overviews", "ai mode"],
} as const);                                                   // §7 · D51



/** How many of a site's own passages a caller that needs only a few reads
 *  (`readFacts`): setup's voice sample and the lead's free page. A paid
 *  page's context pack carries `PACK.facts`. */
export const BRIEF_MAX_FACTS = 8 as const;                     // §7

/** SPEC §7 (*Two pools of facts*) — the research step's bounds. Chosen,
 *  except where the ruling names the figure: "at most two primary studies
 *  found by one search", and "a market statistic older than three years is
 *  not used". The rest are sized so the step stays a fraction of
 *  `CAPS.DRAFT_C`: thirteen pages of `readWords` words are four small-tier
 *  calls, about 7¢. */
export const RESEARCH = Object.freeze({
  /** The target's top results that are read, from the stored top ten. */
  topResults: 3,
  /** The named rivals whose own pricing and feature pages are read. */
  rivals: 4,
  /** SPEC §7: a listicle reads the own pages of up to this many products, an
   *  alternatives page's subject among them. Every other page keeps `rivals`. */
  options: 8,
  /** The products a listicle's options may be found among are the ones named
   *  on `namedOn` of the first `namedFrom` top results already read (the
   *  claim calls still read `topResults`). */
  namedFrom: 5,
  namedOn: 2,
  /** Drafted default: a listicle counts at least `optionsMin` options, the
   *  business among them, or it is not written that day (D26); under
   *  `optionsAim` its method section says why only those qualified. */
  optionsMin: 4,
  optionsAim: 5,
  /** D56: a rival's pages are found in its own sitemap — at most this many
   *  addresses of it, from this many sitemaps of an index. */
  sitemaps: 3,
  sitemapUrls: 2000,
  /** Ruled: at most two, found by one search. */
  studies: 2,
  /** Ruled: a statistic older than this many years is not used. */
  statisticMaxAgeYears: 3,
  /** A page is read for claims up to this many words. */
  readWords: 1500,
  /** A page with fewer readable words than this states nothing to cite. */
  minWords: 80,
  /** SPEC §7 (D41): a page's research is at most two model calls, so the
   *  pages read are split over two; seven to a call is the most one reads. */
  calls: 2,
  pagesPerCall: 7,
  claimsPerPage: 5,
  /** The market facts a context pack carries. */
  briefFacts: 24,
  /** *Current insights* (D48): the news searches it buys — the market's
   *  category, then its synonyms in their stored order — and, of the results
   *  they date inside `recentDays`, how many are read and how many kept. */
  newsSearches: 3,
  recentRead: 8,
  recentPages: 5,
  /** The read results one judgement holds against the market, and how many
   *  words of each it is shown. */
  recentJudged: 8,
  judgedWords: 120,
  /** D41 (drafted default): a *current insights* page reads web results
   *  published inside this many days. */
  recentDays: 30,
  /** A Q&A's questions (D61): the related searches of the target's SERP
   *  whose volume one keyword-overview call measures. */
  relatedSearches: 10,
  /** A market comparison stands on at least this many cited market facts. */
  comparisonMinFacts: 3,
  readTimeoutMs: 10_000,
  /** A public page read today is not read again inside this window. */
  freshnessDays: 7,
} as const);

/** SPEC §7 — a refresh closes the gap to the pages above it. The research
 *  step records the H2 and H3 headings of the top results it reads; a
 *  subtopic `coveredBy` of them head and the live page does not is a gap. A
 *  `close`, `unmet` or `lost_position` refresh may add up to `sectionsMax`
 *  sections from the gaps, each on a claim of the pack, and grow up to
 *  `growShare` of the live page, where its own place is `nearPageOne` (the
 *  write and fix it grows cost up to 3.7¢ more). The owner's are 2, 3, 40%
 *  and 11–20; `headingsPerPage` is a drafted bound on what one page's markup
 *  yields. */
export const HEADING_GAPS = Object.freeze({
  coveredBy: 2,
  sectionsMax: 3,
  growShare: 0.4,
  headingsPerPage: 40,
  nearPageOne: Object.freeze({ min: 11, max: 20 } as const),
} as const);

/** SPEC §7 (D12) — *a new page adds what the web does not say*.
 *
 *  `min` and `businessMin` are the ruling's: at least three claims found
 *  neither in the target's top results nor on the customer's pages, at least
 *  one of them a business fact. The rest are drafted bounds: how much of the
 *  customer's own pages the listing is shown, how many claims it may return,
 *  and how close an existing page has to be before a page short of the bar
 *  becomes an update of it rather than waiting — half of
 *  `KNOWN_CONTENT.COVERED_MIN`, at and above which the topic was already an
 *  update before it was ever written. */
export const ADDS = Object.freeze({
  min: 3,
  businessMin: 1,
  maxClaims: 12,
  /** Words of one of the customer's pages shown to the listing, and of all
   *  of them together. The code check reads every page whole. */
  sitePageWords: 600,
  siteWords: 3000,
  updateMin: 0.3,
} as const);

/** SPEC §7 (drafted default the owner may correct): a how-to or a Q&A is
 *  built from cited outside facts. Its pack holds claims from at least `min`
 *  distinct public pages, and its body links at least that many of them
 *  (`cites_market`), because a pack full of claims can still yield a body
 *  that links none. */
export const CITES_MARKET = Object.freeze({ min: 2 } as const);
