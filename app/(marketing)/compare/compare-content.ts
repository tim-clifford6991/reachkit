/**
 * Compare content registry — the single source of truth for /compare and
 * /compare/[slug]. Every entry is a full differentiator page: honest about what
 * the other tool is good at, specific about where it leaves a solo founder, and
 * concrete about what ReachKit does instead (18 deterministic signals across
 * three weighted pillars — SEO 45%, Content 30%, Outreach 25% — a 0–100 score,
 * an evidence-cited weekly plan, and live re-check verification).
 *
 * Data only — no JSX. The page components in ./page.tsx and ./[slug]/page.tsx
 * stay thin renderers of this module.
 */

export type CompareCell =
  | { type: "check" }
  | { type: "cross" }
  | { type: "partial"; note: string };

export interface CompareRow {
  capability: string;
  /** [ReachKit, competitor] */
  cells: readonly [CompareCell, CompareCell];
}

export interface CompareSection {
  heading: string;
  paragraphs: readonly string[];
}

export type CompareCategoryId = "seo-suite" | "audience" | "ai-content" | "platform-data";

export interface CompareCategory {
  id: CompareCategoryId;
  label: string;
  note: string;
}

export interface CompareEntry {
  slug: string;
  name: string;
  /** Short category tag shown on cards ("SEO toolset", "audience research"…). */
  tagline: string;
  category: CompareCategoryId;
  /** One-line verdict for the /compare index card. */
  verdict: string;
  /** Appended to "ReachKit vs {name} — " in the page title. */
  titleTail: string;
  metaDescription: string;
  /** Hero paragraph under the H1. */
  intro: string;
  sections: readonly CompareSection[];
  useBothWhen: readonly string[];
  chooseReachKitWhen: readonly string[];
  rows: readonly CompareRow[];
}

const check: CompareCell = { type: "check" };
const cross: CompareCell = { type: "cross" };
const partial = (note: string): CompareCell => ({ type: "partial", note });

export const COMPARE_CATEGORIES: readonly CompareCategory[] = [
  {
    id: "seo-suite",
    label: "SEO suites & rank trackers",
    note: "Deep keyword and link databases built for professionals. Superb data — but the analysis, prioritisation, and follow-through are left to you.",
  },
  {
    id: "audience",
    label: "Audience & market research",
    note: "Tools that tell you about your market — who your buyers are, where they gather, what rivals' traffic looks like. None of them examine your own product's presence.",
  },
  {
    id: "ai-content",
    label: "AI assistants & content tools",
    note: "Great at producing words. Weak at measuring your actual situation — and a plan built on guesses inherits the guesses.",
  },
  {
    id: "platform-data",
    label: "Search & app-store data",
    note: "First-party dashboards that report what already happened. Essential inputs — ReachKit reads the same kinds of signals and turns them into the fix list.",
  },
];

export const COMPARE_ENTRIES: readonly CompareEntry[] = [
  // ── SEO suites & rank trackers ────────────────────────────────────────────
  {
    slug: "ahrefs",
    name: "Ahrefs",
    tagline: "SEO toolset",
    category: "seo-suite",
    verdict: "World-class link and keyword data for SEO pros. ReachKit skips the dataset and hands a founder the decision.",
    titleTail: "Do You Need the Data or the Decision?",
    metaDescription:
      "Ahrefs gives SEO professionals a world-class dataset. ReachKit gives solo founders the decision: an 18-signal discoverability score and an evidence-cited weekly plan from $29/mo.",
    intro:
      "Ahrefs is one of the best SEO datasets ever built, and it is built for people whose job is SEO. ReachKit is built for people whose job is the product — it scans your actual site and listings, scores your discoverability across 18 signals, and tells you what to fix this week.",
    sections: [
      {
        heading: "What Ahrefs is genuinely great at",
        paragraphs: [
          "Ahrefs earned its reputation. Its backlink index is among the largest in the industry, its keyword database covers billions of queries, and tools like Site Explorer and Keywords Explorer let a practitioner dissect almost any site's organic footprint. If you do SEO for a living — running client campaigns, building link-acquisition programmes, hunting content gaps across a large site — Ahrefs is a professional-grade instrument and worth what it costs.",
          "Its Site Audit is also genuinely thorough: it will crawl your site and flag hundreds of technical issues, from broken canonicals to orphan pages, with severity labels and documentation for each.",
        ],
      },
      {
        heading: "Where it leaves a solo founder stranded",
        paragraphs: [
          "The catch is in the job description. Ahrefs answers questions — but you have to know which questions to ask, how to read the answers, and how to turn fifty flagged issues and ten thousand keyword rows into the three things worth doing this week. That analysis layer is the actual work, and Ahrefs leaves all of it to you. For an agency, that's the value they sell. For a founder, it's a second job.",
          "Price compounds the problem. Ahrefs is priced for professionals — the entry plan alone costs several times ReachKit's Solo tier, and the features that make the suite sing sit on higher tiers still. Paying enterprise-adjacent prices to do your own analysis is exactly the trade most bootstrapped founders shouldn't make.",
          "And it's web-only. If your product also lives in an app store, your listing — title, screenshots, reviews, keyword coverage — is outside the frame entirely.",
        ],
      },
      {
        heading: "What ReachKit does instead",
        paragraphs: [
          "ReachKit starts from your product, not from a database. It scans your live site, listings, and reviews, measures the real search demand around your category and where your rivals actually show up, and computes a 0–100 discoverability score from 18 deterministic signals across three weighted pillars — SEO (45%), Content (30%), and Outreach (25%). No judgement calls, no vibes: the same inputs always produce the same score.",
          "Then it does the part Ahrefs leaves to you: it ranks the fixes by impact and hands you a weekly action plan where every item cites the evidence it came from — the tag that's missing, the query you don't rank for, the rival page outranking you. When you ship a fix, ReachKit re-checks it live; a fix only counts as done when the scan confirms it.",
          "The first scan is free, and the paid engine is $29/month Solo or $129/month Growth — priced for a founder's budget, not an agency retainer.",
        ],
      },
    ],
    useBothWhen: [
      "SEO is your actual job, or you manage campaigns across many client sites.",
      "You need deep link prospecting or historical backlink forensics.",
      "You have the hours (and budget) to do the analysis layer yourself.",
    ],
    chooseReachKitWhen: [
      "You're a founder who wants the ranked to-do list, not the dataset behind it.",
      "Your product lives on the web and in an app store.",
      "You want fixes verified live, not a dashboard you check and close.",
    ],
    rows: [
      { capability: "Discoverability score for web + app stores", cells: [check, partial("web SEO only")] },
      { capability: "Ranked action plan (not just data)", cells: [check, partial("audits list issues")] },
      { capability: "Evidence cited for every recommendation", cells: [check, cross] },
      { capability: "Fixes verified by live re-check", cells: [check, cross] },
      { capability: "Deep backlink / keyword index", cells: [cross, check] },
      { capability: "Real buyer search-demand measurement", cells: [check, check] },
      { capability: "Priced for solo founders", cells: [check, partial("professional pricing")] },
      { capability: "Free to start", cells: [check, partial("limited free tools")] },
    ],
  },
  {
    slug: "semrush",
    name: "Semrush",
    tagline: "marketing suite",
    category: "seo-suite",
    verdict: "Fifty tools for a marketing team with a driver. ReachKit is one engine that decides for you.",
    titleTail: "A Marketing Department vs a Decision Engine",
    metaDescription:
      "Semrush is an all-in-one suite built for marketing teams. ReachKit does one thing for solo founders: an 18-signal discoverability score and a ranked, verified weekly plan from $29/mo.",
    intro:
      "Semrush is the broadest marketing suite on the market — and breadth is exactly what a marketing team wants. ReachKit is the opposite bet: one engine that scans your product, scores its discoverability, and hands you the week's ranked fixes, because a solo founder needs the decision, not another department's toolbox.",
    sections: [
      {
        heading: "What Semrush is genuinely great at",
        paragraphs: [
          "Semrush is the closest thing to an entire marketing department in software: keyword research, rank tracking, site audits, backlink analysis, competitor intelligence, PPC research, content tooling, even social scheduling. For a marketing team that lives in these workflows daily, having it all under one login is a real advantage, and its competitive-research views are some of the best in the business.",
          "If you're hiring a marketer or an agency, Semrush proficiency is practically a lingua franca — the reports it generates are what much of the industry runs on.",
        ],
      },
      {
        heading: "Where it leaves a solo founder stranded",
        paragraphs: [
          "Breadth has a cost, and the cost is you. Fifty tools means fifty workflows to learn, and the suite assumes someone's job is to drive it: configure the projects, schedule the audits, interpret the dashboards, and translate a few hundred flagged issues into a plan. Semrush surfaces enormous amounts of information; deciding what any of it means for your product this week is left entirely to the person at the keyboard.",
          "It's also priced like the department it replaces. The entry plan costs more per month than ReachKit's Growth tier, per seat, and the site-audit output — hundreds of issues sorted by generic severity, not by impact on your product's actual demand — still needs an analyst to turn into action.",
          "A founder doesn't have an analyst. A founder has Tuesday evening.",
        ],
      },
      {
        heading: "What ReachKit does instead",
        paragraphs: [
          "ReachKit collapses the workflow into one loop. It scans your live site, app-store listings, and reviews; measures the real buyer search demand in your category and where competitors show up for it; and scores you 0–100 across 18 deterministic signals in three weighted pillars — SEO 45%, Content 30%, Outreach 25%. There's nothing to configure and no dashboard to babysit.",
          "The output isn't a report to interpret — it's a ranked weekly action plan where every item cites its evidence, and where each fix is re-checked live before it counts as done. That verification loop is the piece no suite offers: Semrush can tell you an issue exists; ReachKit confirms you actually fixed it.",
          "The workflow difference is easiest to feel on a Monday. Semrush greets you with dashboards to inspect and audits to re-run; ReachKit greets you with this week's three highest-impact fixes and the reasons they're on top. One tool asks for your attention; the other returns it.",
          "The first scan is free; the weekly engine is $29/month Solo or $129/month Growth.",
        ],
      },
    ],
    useBothWhen: [
      "You have (or are) a full-time marketer who lives in these tools.",
      "You run paid search and need PPC competitive research.",
      "Agencies or freelancers on your project already report through it.",
    ],
    chooseReachKitWhen: [
      "You want one prioritised list, not fifty tools to learn.",
      "Nobody on the team has 'drive the SEO suite' in their job description.",
      "You'd rather pay $29 for the decision than $100+ to make it yourself.",
    ],
    rows: [
      { capability: "Discoverability score for web + app stores", cells: [check, partial("web SEO + site audit only")] },
      { capability: "Ranked weekly action plan (not a dashboard)", cells: [check, partial("audits surface issues")] },
      { capability: "Evidence cited for every recommendation", cells: [check, cross] },
      { capability: "Fixes verified by live re-check", cells: [check, cross] },
      { capability: "Keyword, backlink + rank-tracking database", cells: [cross, check] },
      { capability: "PPC / social / content-team tooling", cells: [cross, check] },
      { capability: "Priced for solo founders", cells: [check, partial("team pricing, per seat")] },
      { capability: "Free to start", cells: [check, partial("limited free account")] },
    ],
  },
  {
    slug: "moz",
    name: "Moz",
    tagline: "SEO software",
    category: "seo-suite",
    verdict: "The tool that taught the industry SEO. ReachKit is for founders who'd rather skip the course.",
    titleTail: "Learn SEO, or Just Get Found?",
    metaDescription:
      "Moz pairs respected SEO metrics with the industry's best education. ReachKit skips the curriculum: an 18-signal score and an evidence-cited weekly plan for founders, from $29/mo.",
    intro:
      "Moz practically invented the SEO-software category, and its education is still how much of the industry learned the craft. ReachKit makes the opposite offer: you shouldn't have to learn the craft. It scans your product, scores it across 18 signals, and tells you what to fix — with the evidence attached.",
    sections: [
      {
        heading: "What Moz is genuinely great at",
        paragraphs: [
          "Moz's great gift to the industry is comprehension. Domain Authority became the shared shorthand for link strength; the Moz Blog and Whiteboard Friday taught a generation of marketers how search actually works. Its toolset — keyword research, rank tracking, site crawl, link analysis — is solid, approachable, and less intimidating than the heavyweight suites.",
          "If you want to become good at SEO — genuinely understand it, not just execute it — Moz's combination of tooling and teaching is arguably the best on-ramp there is.",
        ],
      },
      {
        heading: "Where it leaves a solo founder stranded",
        paragraphs: [
          "But comprehension is a curriculum, and a founder rarely has room for one. Moz's model still assumes you'll learn to read the metrics: what a DA of 23 implies, which crawl issues matter, how keyword difficulty trades against volume. The site crawl flags problems; ranking them against your product's actual buyer demand — deciding — remains your job.",
          "Domain Authority itself illustrates the gap. It's a genuinely useful comparative metric, but it isn't an action. Knowing your DA went from 21 to 23 tells you nothing about which page to fix on Tuesday.",
          "And like the other web suites, Moz doesn't look at app stores — if part of your surface area is a listing, it's invisible here.",
        ],
      },
      {
        heading: "What ReachKit does instead",
        paragraphs: [
          "ReachKit assumes you will never take the course, and builds the expertise into the engine. It scans your live site, listings, and reviews, measures real buyer search demand and competitor presence, and computes a 0–100 score from 18 deterministic signals across three weighted pillars (SEO 45%, Content 30%, Outreach 25%). The score explains itself: every signal shows why it matters and what to do.",
          "Instead of metrics to interpret, you get a ranked weekly plan with the evidence cited inline — and a verification loop that re-checks each fix live before marking it done. It's the difference between a grade with a syllabus and a to-do list with receipts.",
          "Concretely: where Moz would show you a keyword-difficulty column and a crawl report, ReachKit's plan reads more like \"your pricing page has no structured data and it's costing you rich results — here's the block to add\", followed by a re-scan that confirms it landed. Same underlying discipline, opposite starting point: the fix first, the theory available when you want it.",
          "First scan free; $29/month Solo, $129/month Growth after that.",
        ],
      },
    ],
    useBothWhen: [
      "You actively want to learn SEO as a skill, not just apply it.",
      "You track Domain Authority for partnerships, PR, or investor optics.",
      "You're growing into a marketing hire who'll want familiar tooling.",
    ],
    chooseReachKitWhen: [
      "You want outcomes without the curriculum.",
      "Your product needs app-store coverage, not just web.",
      "You want each fix verified live, not inferred from a metric's drift.",
    ],
    rows: [
      { capability: "Discoverability score for web + app stores", cells: [check, partial("web only")] },
      { capability: "Ranked, prioritised fixes", cells: [check, partial("site crawl flags issues")] },
      { capability: "Positioning / messaging gap analysis", cells: [check, cross] },
      { capability: "Evidence cited for every recommendation", cells: [check, cross] },
      { capability: "Fixes verified by live re-check", cells: [check, cross] },
      { capability: "Domain Authority + link metrics", cells: [cross, check] },
      { capability: "SEO education & community", cells: [cross, check] },
      { capability: "Free to start", cells: [check, partial("free tools + trial")] },
    ],
  },
  {
    slug: "ubersuggest",
    name: "Ubersuggest",
    tagline: "budget SEO",
    category: "seo-suite",
    verdict: "Honest budget keyword research. ReachKit spends the same money on answers instead of ideas.",
    titleTail: "Cheap Data vs an Affordable Decision",
    metaDescription:
      "Ubersuggest is genuinely affordable keyword research. ReachKit turns the same budget into decisions: an 18-signal score of your actual product and a verified weekly plan from $29/mo.",
    intro:
      "Ubersuggest deserves credit for making SEO data affordable — real keyword and audit tooling at a fraction of suite prices. ReachKit competes for the same founder budget with a different product entirely: not cheaper data, but the decision itself, computed from your actual site and listings.",
    sections: [
      {
        heading: "What Ubersuggest is genuinely great at",
        paragraphs: [
          "Ubersuggest's pitch is honest and it delivers: keyword ideas, content suggestions, basic rank tracking, and a site audit at genuinely indie prices — including a lifetime deal, which is nearly unheard of in this category. For a founder who wants to poke at keyword volumes and get a rough read on their site without committing to suite pricing, it's a sensible on-ramp.",
          "The content-ideas view — showing which posts in your topic earned traffic and links — is a quick, practical way to seed a blog roadmap.",
        ],
      },
      {
        heading: "Where it leaves a solo founder stranded",
        paragraphs: [
          "Being a cheaper version of the suites means inheriting their core gap at a discount: it hands you lists. Keyword lists, content-idea lists, audit-issue lists — flat, generic, and unranked against what actually moves your product. The site audit flags the same classes of issues for every site; it doesn't know your category's real buyer demand or which rival is eating your queries.",
          "The suggestions optimise for volume, not fit — chasing a high-volume keyword that doesn't match your positioning is a common way founders burn a quarter. And there's no loop: nothing verifies that what you changed worked, and app-store presence isn't covered at all.",
        ],
      },
      {
        heading: "What ReachKit does instead",
        paragraphs: [
          "At a similar price point, ReachKit inverts the model: instead of generic data about the whole web, it's a deep read of you. It scans your live site, listings, and reviews, measures the real search demand around your category and where competitors show up, and scores you 0–100 across 18 deterministic signals in three weighted pillars — SEO 45%, Content 30%, Outreach 25%.",
          "The output is a ranked weekly action plan, each item citing the evidence it came from, and each fix re-checked live before it counts. Keyword and demand data still appear — but as inputs to a decision, not homework.",
          "The practical difference shows up in what you do after opening the tool. An Ubersuggest session ends with a spreadsheet of candidate keywords and a vague intention; a ReachKit week ends with a shipped fix and a re-scan that confirmed it. For a founder with four spare hours a week, that gap is the whole game.",
          "First scan free; $29/month Solo or $129/month Growth.",
        ],
      },
    ],
    useBothWhen: [
      "You want a cheap sandbox for exploring keyword volumes and ideas.",
      "You grabbed the lifetime deal and use it for occasional lookups.",
      "You're seeding a content calendar and want topic inspiration.",
    ],
    chooseReachKitWhen: [
      "You want your budget buying decisions, not lists.",
      "Your product's surface includes an app-store listing.",
      "You want to know a fix worked, not hope it did.",
    ],
    rows: [
      { capability: "Discoverability score (0–100)", cells: [check, cross] },
      { capability: "Grounded in your live product pages", cells: [check, partial("site audit + keyword data")] },
      { capability: "App Store / ASO coverage", cells: [check, cross] },
      { capability: "Ranked weekly action plan", cells: [check, partial("flat suggestion lists")] },
      { capability: "Evidence cited for every recommendation", cells: [check, cross] },
      { capability: "Fixes verified by live re-check", cells: [check, cross] },
      { capability: "Keyword volume + content ideas", cells: [partial("surfaced in the report"), check] },
      { capability: "Affordable for indies", cells: [check, check] },
    ],
  },
  {
    slug: "mangools",
    name: "Mangools",
    tagline: "keyword research",
    category: "seo-suite",
    verdict: "The friendliest keyword research on the market. ReachKit answers the question keywords can't: what do I fix?",
    titleTail: "Beautiful Keyword Data vs Your Fix List",
    metaDescription:
      "Mangools (KWFinder) is the friendliest keyword research suite for beginners. ReachKit scans your actual product, scores 18 discoverability signals, and hands you a verified weekly plan from $29/mo.",
    intro:
      "Mangools — best known for KWFinder — made keyword research genuinely pleasant, which in this industry counts as a breakthrough. But keyword research is one input to discoverability, not the answer. ReachKit scans your actual product, scores the whole picture across 18 signals, and ranks the fixes for you.",
    sections: [
      {
        heading: "What Mangools is genuinely great at",
        paragraphs: [
          "Mangools took the most intimidating part of SEO tooling and made it approachable. KWFinder is widely considered the friendliest keyword-research tool for beginners: clean difficulty scores, honest volumes, and an interface that doesn't require a certification to read. The surrounding tools — SERP analysis, rank tracking, backlink lookups, site profiling — follow the same philosophy: fewer features, better presented, at prices an indie can justify.",
          "For finding low-competition keywords in a niche, it's arguably the best pound-for-pound tool at its price.",
        ],
      },
      {
        heading: "Where it leaves a solo founder stranded",
        paragraphs: [
          "A friendly window onto keyword data is still a window onto keyword data. Mangools tells you a keyword's difficulty and volume; it can't tell you whether that keyword matters for your product, whether your page is even eligible to rank for it, or whether keywords are your bottleneck at all. Plenty of founders have great keyword lists and a site that's technically or structurally invisible — the list doesn't help until the foundation does.",
          "There's no scan of your own pages, no prioritisation across SEO, content, and outreach, no draft fixes, and no verification. Mangools is a well-made instrument; the orchestra is still you.",
        ],
      },
      {
        heading: "What ReachKit does instead",
        paragraphs: [
          "ReachKit starts where keyword tools can't: your actual product. It scans your live site, listings, and reviews; measures the real buyer search demand in your category and which rivals show up for it; and computes a 0–100 discoverability score from 18 deterministic signals across three weighted pillars — SEO 45%, Content 30%, Outreach 25%. That structure is the point: it tells you whether keywords, content, or presence is what's actually holding you back.",
          "You get a ranked weekly action plan with the evidence cited per item, and a verify loop that re-checks each fix live before it counts as done. Keyword demand shows up in the report too — already filtered to what fits your positioning.",
          "Think of it as the difference between a thermometer and a diagnosis. KWFinder can tell you, precisely and pleasantly, how hot a keyword is. ReachKit tells you whether your product would benefit from ranking for it, what's blocking that today, and — after you ship the fix — whether it worked. Both are honest instruments; only one closes the loop.",
          "First scan free; $29/month Solo or $129/month Growth.",
        ],
      },
    ],
    useBothWhen: [
      "You're mining a niche for low-competition keyword opportunities.",
      "You enjoy the research itself and want a pleasant tool for it.",
      "You need a lightweight rank tracker for a handful of terms.",
    ],
    chooseReachKitWhen: [
      "You don't know whether keywords are even your bottleneck.",
      "You want your own pages scanned, scored, and fixed — not researched around.",
      "You want the plan ranked and verified, not another list to triage.",
    ],
    rows: [
      { capability: "Discoverability score (0–100)", cells: [check, cross] },
      { capability: "Scans your live product pages", cells: [check, partial("site profile lookups")] },
      { capability: "App Store / ASO coverage", cells: [check, cross] },
      { capability: "Ranked weekly action plan", cells: [check, cross] },
      { capability: "Fixes verified by live re-check", cells: [check, cross] },
      { capability: "Beginner-friendly keyword research", cells: [partial("demand surfaced in report"), check] },
      { capability: "Affordable for indies", cells: [check, check] },
      { capability: "Free to start", cells: [check, partial("free trial")] },
    ],
  },
  {
    slug: "se-ranking",
    name: "SE Ranking",
    tagline: "rank tracking suite",
    category: "seo-suite",
    verdict: "An agency's daily rank tracker at fair prices. ReachKit tracks one thing: whether buyers can find you.",
    titleTail: "Tracking Positions vs Fixing Discoverability",
    metaDescription:
      "SE Ranking is a fairly-priced rank-tracking suite loved by agencies. ReachKit is a decision engine for founders: an 18-signal discoverability score and a verified weekly fix list from $29/mo.",
    intro:
      "SE Ranking built a serious all-in-one — accurate rank tracking at its core, plus audits and competitor research — at prices well under the big suites. It's a strong choice for agencies. ReachKit asks a different question: does a solo founder need daily positions, or a weekly answer to 'what do I fix'?",
    sections: [
      {
        heading: "What SE Ranking is genuinely great at",
        paragraphs: [
          "SE Ranking's core is one of the more accurate and flexible rank trackers around — daily positions, any location, any device — wrapped in a genuinely complete suite: site audits, backlink monitoring, keyword research, and competitor analysis. Agencies particularly love it for the white-label reporting: client-ready dashboards at a price that preserves margin.",
          "For the money, it's one of the strongest value plays among the professional suites — a real alternative to tools costing twice as much.",
        ],
      },
      {
        heading: "Where it leaves a solo founder stranded",
        paragraphs: [
          "The suite is shaped around a professional's rhythm: check positions daily, run audits monthly, report to clients. A founder has no client to report to and no use for daily position deltas — the questions that matter are 'why am I not being found?' and 'what's the highest-impact fix this week?'. SE Ranking holds the raw material for those answers across half a dozen modules, but assembling them into a decision is your job.",
          "The audit output is classic suite fare — long issue lists ranked by generic severity, not by your category's real buyer demand. And app-store presence, reviews, and positioning aren't in the picture: it's a web-SEO instrument, precise about rankings and silent about the rest.",
        ],
      },
      {
        heading: "What ReachKit does instead",
        paragraphs: [
          "ReachKit replaces the tracking rhythm with a fixing rhythm. It scans your live site, listings, and reviews; measures real buyer search demand and where rivals show up for it; and computes a 0–100 score from 18 deterministic signals across three weighted pillars — SEO 45%, Content 30%, Outreach 25%. One number, decomposable to evidence, instead of a grid of daily positions.",
          "Each week you get a ranked action plan — every item citing the evidence behind it — and each shipped fix is re-checked live before it counts. Rankings still matter; they're an input to the score. But the product you interact with is the fix list, not the tracker.",
          "There's a psychological difference too. A rank tracker trains you to watch — positions wobble daily for reasons you can't control, and watching them feels like work while changing nothing. A verify loop trains you to ship: the only way the score moves is a confirmed fix. For a founder, the second habit compounds; the first just fills mornings.",
          "First scan free; $29/month Solo or $129/month Growth.",
        ],
      },
    ],
    useBothWhen: [
      "You run client SEO and need white-label reporting.",
      "Daily rank movement across locations genuinely drives your decisions.",
      "You want a cheaper general-purpose suite and will do the analysis yourself.",
    ],
    chooseReachKitWhen: [
      "You're the founder, and 'what do I fix this week' is the whole question.",
      "You want app-store, review, and positioning signals in one score.",
      "You'd rather verify fixes than watch positions.",
    ],
    rows: [
      { capability: "Discoverability score for web + app stores", cells: [check, partial("web SEO only")] },
      { capability: "Ranked weekly action plan", cells: [check, partial("audits list issues")] },
      { capability: "Evidence cited for every recommendation", cells: [check, cross] },
      { capability: "Fixes verified by live re-check", cells: [check, cross] },
      { capability: "Daily rank tracking, any location/device", cells: [cross, check] },
      { capability: "White-label / client reporting", cells: [cross, check] },
      { capability: "Priced for solo founders", cells: [check, partial("mid-market pricing")] },
      { capability: "Free to start", cells: [check, partial("free trial")] },
    ],
  },

  // ── Audience & market research ────────────────────────────────────────────
  {
    slug: "sparktoro",
    name: "SparkToro",
    tagline: "audience research",
    category: "audience",
    verdict: "The best tool for learning where your audience hangs out. ReachKit fixes whether they can find you.",
    titleTail: "Know Your Audience vs Be Found by It",
    metaDescription:
      "SparkToro reveals where your audience spends time. ReachKit fixes your side of the equation — an 18-signal discoverability score and a verified weekly action plan from $29/mo.",
    intro:
      "SparkToro answers a question almost nothing else can: where does my audience actually spend time? ReachKit answers the mirror image: when that audience goes looking, can they find you? The two are more complementary than competitive — but only one of them will hand you a fix list.",
    sections: [
      {
        heading: "What SparkToro is genuinely great at",
        paragraphs: [
          "SparkToro does audience research the hard way so you don't have to: it profiles the websites your audience visits, the podcasts they hear, the accounts they follow, and the words they use. For deciding where to do outreach, which newsletters to sponsor, or which communities to show up in, that data is close to unique — and it's shaped by a clear-eyed view of the zero-click era, where showing up where people already are matters as much as ranking.",
          "It's also refreshingly honest software: fair prices, a useful free tier, and no pretence of being an all-in-one suite.",
        ],
      },
      {
        heading: "Where it leaves a solo founder stranded",
        paragraphs: [
          "SparkToro looks outward at your market; it never looks at you. It can tell you your buyers read a certain blog and follow certain accounts — but not whether your own site is scannable, whether your listing's keywords match real demand, whether your positioning is legible, or why a rival outranks you for your own category. Audience intelligence tells you where to show up; it can't tell you why you're not being found.",
          "So a founder using SparkToro alone knows where the party is, while their own front door stays locked. The outreach data is a genuine asset — but it's one pillar of discoverability, not the building.",
          "There's also no execution loop: SparkToro's output is a research report, and turning it into sponsorships, mentions, and presence is a separate project you plan yourself. Nothing measures whether the effort changed how findable you are — which is the number a founder actually needs to move.",
        ],
      },
      {
        heading: "What ReachKit does instead",
        paragraphs: [
          "ReachKit works your side of the street. It scans your live site, listings, and reviews; measures the real buyer search demand in your category and where competitors show up for it; and computes a 0–100 score from 18 deterministic signals across three weighted pillars. Outreach — the where-you-show-up dimension SparkToro studies — is one of them, weighted at 25%, alongside SEO (45%) and Content (30%).",
          "The output is a ranked weekly action plan with evidence cited per item, and a verify loop that re-checks every shipped fix live before it counts. Where SparkToro ends with insight, ReachKit ends with a confirmed change to your product's findability.",
          "First scan free; $29/month Solo or $129/month Growth. Honestly: of every tool on this page, SparkToro is the one that pairs best with ReachKit.",
        ],
      },
    ],
    useBothWhen: [
      "You're planning sponsorships, podcast outreach, or community strategy.",
      "You want rich audience profiles to shape positioning and copy.",
      "Genuinely — SparkToro plus ReachKit covers both sides of discoverability.",
    ],
    chooseReachKitWhen: [
      "Your immediate problem is not being found, not knowing your audience.",
      "You want your own site and listings scanned, scored, and fixed.",
      "You want a weekly plan with verification, not research to act on later.",
    ],
    rows: [
      { capability: "Discoverability score (0–100)", cells: [check, cross] },
      { capability: "Grounded in your live product pages", cells: [check, partial("audience data, not your pages")] },
      { capability: "Ranked, prioritised fixes", cells: [check, cross] },
      { capability: "Evidence cited for every recommendation", cells: [check, cross] },
      { capability: "Fixes verified by live re-check", cells: [check, cross] },
      { capability: "Audience / where-they-gather research", cells: [partial("surfaced in the report"), check] },
      { capability: "Free to start", cells: [check, check] },
    ],
  },
  {
    slug: "gummysearch",
    name: "GummySearch",
    tagline: "Reddit research",
    category: "audience",
    verdict: "The best window into Reddit pain points. ReachKit turns your whole presence into a scored, fixable system.",
    titleTail: "Mining Reddit vs Fixing Your Findability",
    metaDescription:
      "GummySearch mines Reddit for pain points and demand signals. ReachKit scans your actual product presence, scores 18 discoverability signals, and ships a verified weekly plan from $29/mo.",
    intro:
      "GummySearch turned Reddit — the internet's biggest honest focus group — into a searchable research tool, and for validation and voice-of-customer work it's excellent. ReachKit works the other end of the funnel: once you know what buyers want, it makes sure they can actually find you.",
    sections: [
      {
        heading: "What GummySearch is genuinely great at",
        paragraphs: [
          "Reddit is where people complain honestly, and GummySearch is the best instrument for listening: it organises subreddit audiences, surfaces pain points and 'advice requests', and alerts you when your category comes up. For idea validation, voice-of-customer copywriting, and finding threads where your product is genuinely the answer, it's a sharp, fairly-priced tool that indie founders rightly love.",
          "Used well, it can hand you the exact vocabulary your buyers use — which is marketing gold.",
        ],
      },
      {
        heading: "Where it leaves a solo founder stranded",
        paragraphs: [
          "GummySearch covers one channel, and listening isn't the same as being found. It can show you fifty threads describing the problem you solve — and nothing about why those same people don't encounter your product when they search for a solution. Your site's technical health, your listing's keyword coverage, your positioning's legibility, your competitors' grip on the category queries: all outside the frame.",
          "There's also a subtle trap: Reddit research generates content and engagement ideas faster than a solo founder can execute, with no way to rank them against the fixes that would matter more. More ideas is not the constraint. Prioritisation is.",
        ],
      },
      {
        heading: "What ReachKit does instead",
        paragraphs: [
          "ReachKit is the prioritisation layer GummySearch can't be. It scans your live site, listings, and reviews; measures real buyer search demand and where rivals show up; and scores you 0–100 across 18 deterministic signals in three weighted pillars — SEO 45%, Content 30%, Outreach 25%. Community presence belongs in that outreach pillar; it's weighed against everything else instead of competing for your attention alone.",
          "The weekly plan ranks all of it — technical fixes, content gaps, presence plays — with evidence cited per item, and re-checks every fix live before it counts. Pair it with GummySearch's vocabulary mining and you have both the words and the findability.",
          "A concrete week with both: GummySearch surfaces the phrase buyers keep using for your problem; ReachKit's scan shows your landing page never says it, ranks the rewrite above your other fixes because measured demand backs it, drafts the copy, and confirms the change on re-scan. Research became a shipped, verified improvement — not a bookmark.",
          "First scan free; $29/month Solo or $129/month Growth.",
        ],
      },
    ],
    useBothWhen: [
      "You're validating a product idea or hunting voice-of-customer language.",
      "Reddit is genuinely where your buyers gather.",
      "You want alerting when your category or brand comes up in threads.",
    ],
    chooseReachKitWhen: [
      "You already know the demand exists — buyers just aren't finding you.",
      "You want one ranked plan across SEO, content, and outreach.",
      "You want fixes verified, not another stream of ideas.",
    ],
    rows: [
      { capability: "Discoverability score (0–100)", cells: [check, cross] },
      { capability: "Scans your live product pages", cells: [check, cross] },
      { capability: "Ranked weekly action plan", cells: [check, cross] },
      { capability: "Real buyer search-demand measurement", cells: [check, partial("Reddit demand signals")] },
      { capability: "Fixes verified by live re-check", cells: [check, cross] },
      { capability: "Reddit pain-point & audience mining", cells: [cross, check] },
      { capability: "Affordable for indies", cells: [check, check] },
      { capability: "Free to start", cells: [check, partial("free tier")] },
    ],
  },
  {
    slug: "similarweb",
    name: "Similarweb",
    tagline: "traffic intelligence",
    category: "audience",
    verdict: "Market-level traffic estimates for enterprises. ReachKit measures your niche precisely — and fixes it.",
    titleTail: "Estimating the Market vs Winning Your Corner of It",
    metaDescription:
      "Similarweb models market-level traffic for enterprise teams. ReachKit measures your niche precisely — an 18-signal discoverability score and a verified weekly action plan from $29/mo.",
    intro:
      "Similarweb is the reference tool for digital market intelligence — modelled traffic estimates, channel mixes, and market share for the world's websites. It's built for enterprise questions. A solo founder's question is smaller and sharper: why isn't my product being found, and what do I fix first?",
    sections: [
      {
        heading: "What Similarweb is genuinely great at",
        paragraphs: [
          "For understanding markets at altitude, Similarweb has no real peer. Its modelled estimates of traffic, sources, geography, and engagement across millions of sites let analysts size markets, benchmark competitors, and track share shifts over time. Investors, corp-dev teams, and enterprise marketers rely on it for exactly this, and its category- and industry-level views are genuinely illuminating.",
          "When the question is 'how big is this market and who's winning it?', Similarweb is the right instrument.",
        ],
      },
      {
        heading: "Where it leaves a solo founder stranded",
        paragraphs: [
          "The catch is resolution. Similarweb's estimates are modelled from panels and partnerships, and the methodology is honest about its limits: numbers get thin and noisy for smaller sites — which describes almost every early-stage SaaS and most of its direct competitors. The sites you most need to understand are precisely the ones the model sees least clearly.",
          "It's also descriptive, not prescriptive, and priced accordingly: the serious tiers are enterprise-priced, and what they buy you is a better map of the market — not a single change to how findable your product is. Knowing a rival gets an estimated share of category traffic doesn't tell you which page, tag, or listing of yours to fix on Tuesday.",
        ],
      },
      {
        heading: "What ReachKit does instead",
        paragraphs: [
          "ReachKit trades altitude for precision. Instead of modelling the whole web, it examines your corner of it exactly: your live site, listings, and reviews; the real search queries buyers use in your category, measured directly; and which competitors actually appear for them. From that it computes a 0–100 score across 18 deterministic signals in three weighted pillars — SEO 45%, Content 30%, Outreach 25% — where every number is observed, not estimated.",
          "Then it prescribes: a ranked weekly action plan, evidence cited per item, each fix re-checked live before it counts as done. Your competitive picture comes from where rivals actually show up in your category's searches — the part of market intelligence a founder can act on.",
          "The two tools also answer to different clocks. Similarweb's story plays out over quarters — share shifts, channel trends, market movements. A founder's discoverability problem is a this-week problem: the missing schema, the illegible headline, the query a rival owns. ReachKit is built for that clock.",
          "First scan free; $29/month Solo or $129/month Growth.",
        ],
      },
    ],
    useBothWhen: [
      "You're sizing markets for a raise, a board deck, or corp-dev work.",
      "Your competitors are large enough for the estimates to be reliable.",
      "You need channel-mix benchmarking across an industry.",
    ],
    chooseReachKitWhen: [
      "You and your rivals are niche — where modelled estimates go blind.",
      "You want observed measurements of your own presence, not projections.",
      "You want the market picture to end in a fix list, not a chart.",
    ],
    rows: [
      { capability: "Discoverability score (0–100)", cells: [check, cross] },
      { capability: "Scans your live product pages", cells: [check, cross] },
      { capability: "Accurate for small/niche sites", cells: [check, partial("estimates thin out")] },
      { capability: "Ranked weekly action plan", cells: [check, cross] },
      { capability: "Fixes verified by live re-check", cells: [check, cross] },
      { capability: "Market-level traffic & share estimates", cells: [cross, check] },
      { capability: "Competitor visibility in your category", cells: [check, partial("modelled, site-level")] },
      { capability: "Priced for solo founders", cells: [check, partial("enterprise tiers")] },
    ],
  },

  // ── AI assistants & content tools ─────────────────────────────────────────
  {
    slug: "chatgpt",
    name: "ChatGPT",
    tagline: "general AI assistant",
    category: "ai-content",
    verdict: "Brilliant generalist, ungrounded advisor. ReachKit measures first — so the plan can't hallucinate.",
    titleTail: "Plausible Advice vs Measured Evidence",
    metaDescription:
      "ChatGPT gives plausible SEO advice from what you tell it. ReachKit measures first: it scans your real pages, scores 18 signals, and cites evidence for every fix. Free scan, then $29/mo.",
    intro:
      "Ask ChatGPT how to improve your SEO and you'll get a fluent, sensible-sounding answer in seconds. The problem isn't the fluency — it's that the answer is built from what you told it, not from what's true about your product. ReachKit measures first, then advises, and cites the evidence for every fix.",
    sections: [
      {
        heading: "What ChatGPT is genuinely great at",
        paragraphs: [
          "As a thinking partner, ChatGPT is remarkable. It can explain any SEO concept at whatever depth you want, brainstorm positioning angles, rewrite a headline fifteen ways, and draft a meta description in seconds. For a founder learning the vocabulary of discoverability, it's the most patient tutor ever built — and for pure copy iteration it's genuinely useful.",
          "It's also cheap to try and infinitely flexible, which is why every founder has already asked it about their marketing at 1am.",
        ],
      },
      {
        heading: "Where it leaves a solo founder stranded",
        paragraphs: [
          "The failure mode is subtle: ChatGPT's advice is a well-written average of general best practice, applied to whatever picture of your product you happened to type in. It doesn't reliably fetch and parse your live pages, doesn't know your actual search demand or which competitors appear for your queries, and can't measure anything. Ask twice, get two different confident answers — there's no score, no baseline, no way to know if things improved.",
          "Worst of all, it's confident when it's wrong. Generic advice misapplied — chasing keywords that don't fit your positioning, fixing things that were fine — costs real weeks. An unmeasured plan isn't a plan; it's a plausible essay.",
        ],
      },
      {
        heading: "What ReachKit does instead",
        paragraphs: [
          "ReachKit inverts the order: measure, then advise. It fetches your actual site, listings, and reviews; measures the real buyer search demand in your category and which rivals show up for it; and computes a 0–100 discoverability score from 18 deterministic signals across three weighted pillars — SEO 45%, Content 30%, Outreach 25%. Deterministic means exactly that: same inputs, same score, every time.",
          "Every action in the weekly plan cites the evidence it came from — the missing tag, the unranked query, the rival page above you — so nothing can be hallucinated. And when you ship a fix, ReachKit re-checks it live; it only counts as done when the scan confirms it. That's the loop a chat window can't close.",
          "None of this is anti-AI — ReachKit uses language models too, for the parts they're good at, like drafting copy and explaining findings. The difference is architectural: the score, the demand numbers, and the rankings come from deterministic measurement of your real pages, and the AI is only ever allowed to speak from that evidence.",
          "First scan free; $29/month Solo or $129/month Growth.",
        ],
      },
    ],
    useBothWhen: [
      "You want a tutor for SEO concepts and vocabulary.",
      "You're iterating copy and want fifteen variants fast.",
      "You want to talk through positioning ideas before committing.",
    ],
    chooseReachKitWhen: [
      "You want advice grounded in your real pages, not your description of them.",
      "You want a score and a baseline, so progress is measurable.",
      "You want fixes verified live — not a fresh essay each session.",
    ],
    rows: [
      { capability: "Grounded in your live pages", cells: [check, cross] },
      { capability: "Discoverability score (0–100), deterministic", cells: [check, cross] },
      { capability: "Real buyer search-demand measurement", cells: [check, cross] },
      { capability: "Ranked, evidence-cited fixes", cells: [check, partial("generic, unranked")] },
      { capability: "Draft copy per action", cells: [check, partial("with prompting")] },
      { capability: "Fixes verified by live re-check", cells: [check, cross] },
      { capability: "General brainstorming & tutoring", cells: [cross, check] },
      { capability: "Free to start", cells: [check, check] },
    ],
  },
  {
    slug: "surfer-seo",
    name: "Surfer SEO",
    tagline: "content optimization",
    category: "ai-content",
    verdict: "Excellent at optimizing the article you chose. ReachKit tells you whether that article was the right move.",
    titleTail: "Optimizing an Article vs Fixing the Whole Funnel",
    metaDescription:
      "Surfer SEO optimizes individual articles against the SERP. ReachKit works a level up — scoring your whole product's discoverability across 18 signals with a verified weekly plan from $29/mo.",
    intro:
      "Surfer SEO is very good at its chosen job: scoring a piece of content against what already ranks and coaching it upward. But it starts after the most important decision — what to work on — has been made. ReachKit works one level up: it scores your whole product's discoverability and tells you whether content is even your bottleneck.",
    sections: [
      {
        heading: "What Surfer SEO is genuinely great at",
        paragraphs: [
          "Within its lane, Surfer is excellent. Give it a target keyword and a draft, and its content editor scores the draft against the pages that actually rank — terms to include, structure to match, length to hit — turning on-page optimization from guesswork into a checklist. Content teams shipping several articles a week get real, compounding value from that loop, and the AI-assisted drafting has matured into a genuine accelerant.",
          "If you already run a content pipeline with chosen targets, Surfer makes each piece measurably more competitive.",
        ],
      },
      {
        heading: "Where it leaves a solo founder stranded",
        paragraphs: [
          "Surfer's frame assumes the strategic questions are settled: you know content is your growth lever, you know which keywords to target, and you have the pipeline to produce. For most early SaaS founders, none of that is settled — and it's precisely where they're stuck. Surfer can't tell you whether your bottleneck is actually technical SEO, an illegible positioning, a weak listing, or absence from the places your buyers look.",
          "Optimizing article seventeen to a 92 content score while your product pages are structurally invisible is a real and common failure mode. Per-article excellence doesn't add up to discoverability if the foundation is the problem — and Surfer, by design, never looks at the foundation.",
          "It's also priced for the workflow it assumes: a content team shipping steadily. If you're not sure you should be publishing weekly at all, you'd be paying content-team rates to defer the strategic question.",
        ],
      },
      {
        heading: "What ReachKit does instead",
        paragraphs: [
          "ReachKit answers the question that comes first. It scans your live site, listings, and reviews; measures real buyer search demand and which competitors show up for it; and computes a 0–100 score from 18 deterministic signals across three weighted pillars — SEO 45%, Content 30%, Outreach 25%. That decomposition is the diagnosis: it shows whether content is your constraint or a distraction from it.",
          "The weekly plan ranks fixes across all three pillars with evidence cited per item — and when content is the right move, it says which content and why, grounded in measured demand rather than a keyword hunch. Every shipped fix is re-checked live before it counts.",
          "First scan free; $29/month Solo or $129/month Growth. If the scan says content is your lever, Surfer is a fine tool to execute with.",
        ],
      },
    ],
    useBothWhen: [
      "ReachKit's scan shows content is your bottleneck and you're ready to produce.",
      "You publish regularly and want each piece SERP-competitive.",
      "A writer or agency executes your content and needs a shared rubric.",
    ],
    chooseReachKitWhen: [
      "You don't yet know if content is the right lever at all.",
      "Your product pages and listings need fixing before your blog does.",
      "You want one ranked plan across SEO, content, and outreach — verified.",
    ],
    rows: [
      { capability: "Whole-product discoverability score", cells: [check, partial("per-article content score")] },
      { capability: "Covers web + app-store listings", cells: [check, cross] },
      { capability: "Tells you if content is the bottleneck", cells: [check, cross] },
      { capability: "Ranked weekly action plan", cells: [check, cross] },
      { capability: "Fixes verified by live re-check", cells: [check, partial("re-score a draft")] },
      { capability: "SERP-based content editor", cells: [cross, check] },
      { capability: "Priced for solo founders", cells: [check, partial("content-team pricing")] },
      { capability: "Free to start", cells: [check, partial("trial, then paid")] },
    ],
  },

  // ── Search & app-store data ───────────────────────────────────────────────
  {
    slug: "google-search-console",
    name: "Google Search Console",
    tagline: "search data",
    category: "platform-data",
    verdict: "The free source of truth every founder should have. ReachKit is what turns its data into a plan.",
    titleTail: "The Data You Should Have vs the Plan You Need",
    metaDescription:
      "Google Search Console is free, first-party, and essential. ReachKit turns that class of signal into decisions: an 18-signal score and a verified weekly action plan from $29/mo.",
    intro:
      "Let's be clear up front: you should have Google Search Console. It's free, it's first-party, and nothing else tells you how Google actually sees your site. The comparison isn't whether to use it — it's what GSC was never built to do: decide what you should fix, in what order, and confirm that you fixed it.",
    sections: [
      {
        heading: "What Search Console is genuinely great at",
        paragraphs: [
          "GSC is the ground truth. Impressions, clicks, and average positions for the real queries people typed; indexing status page by page; crawl errors, mobile usability, structured-data validation — straight from Google, at no cost. Every serious site should have it verified from day one, and any tool that contradicts GSC's numbers is wrong.",
          "For confirming whether Google can see a page at all, and which queries you're already surfacing for, it is simply the authoritative source.",
        ],
      },
      {
        heading: "Where it leaves a solo founder stranded",
        paragraphs: [
          "GSC reports; it doesn't advise. It will show you 300 queries with impressions and a position of 40 — and offer no opinion on which matter for your business, why you rank where you do, or what to change. Its issue reports flag problems without ranking them against each other, let alone against content and positioning problems it can't see at all.",
          "There's a colder gap, too: GSC only shows demand you already intersect. The queries your buyers use that you never appear for — the demand you're missing entirely — are invisible, along with your competitors, your app-store presence, and your reviews. It's a rearview mirror: accurate, essential, and silent about the road ahead.",
        ],
      },
      {
        heading: "What ReachKit does instead",
        paragraphs: [
          "ReachKit is the decision layer on top of exactly this class of signal. It scans your live site, listings, and reviews; measures the full buyer search demand in your category — including everything you don't yet rank for — and where competitors show up; and computes a 0–100 score from 18 deterministic signals across three weighted pillars (SEO 45%, Content 30%, Outreach 25%).",
          "Instead of reports to interpret, you get a ranked weekly action plan with evidence cited per item, and every shipped fix is re-checked live before it counts. Keep GSC verified — its numbers will confirm the trend as your score climbs. Use ReachKit to decide what moves the numbers.",
          "A useful way to hold the pair: GSC is the scoreboard, ReachKit is the coach. The scoreboard is authoritative and free, and you should absolutely watch it — but no one ever won a game by watching the scoreboard harder.",
          "First scan free; $29/month Solo or $129/month Growth.",
        ],
      },
    ],
    useBothWhen: [
      "Always — GSC is free and first-party; every founder should verify it.",
      "You need Google's own word on indexing or a manual action.",
      "You want first-party query data to confirm your progress.",
    ],
    chooseReachKitWhen: [
      "You want the demand you're missing, not just the queries you touch.",
      "You want issues ranked by impact and explained in plain English.",
      "Your discoverability includes app stores, reviews, and positioning.",
    ],
    rows: [
      { capability: "Discoverability score (0–100)", cells: [check, cross] },
      { capability: "Covers web + app-store listings", cells: [check, partial("web search only")] },
      { capability: "Shows demand you don't yet rank for", cells: [check, cross] },
      { capability: "Ranked, prioritised fixes", cells: [check, partial("flags issues, no priorities")] },
      { capability: "Plain-English explanations + draft copy", cells: [check, cross] },
      { capability: "Fixes verified by live re-check", cells: [check, cross] },
      { capability: "First-party Google impression + query data", cells: [cross, check] },
      { capability: "Free to use", cells: [partial("first scan free"), check] },
    ],
  },
  {
    slug: "appfigures",
    name: "Appfigures",
    tagline: "ASO analytics",
    category: "platform-data",
    verdict: "Serious app-store analytics for app businesses. ReachKit scores your whole presence — store and web — and plans the fixes.",
    titleTail: "App-Store Analytics vs Whole-Presence Fixes",
    metaDescription:
      "Appfigures is strong ASO analytics — ranks, downloads, reviews. ReachKit scores your entire presence, store and web, across 18 signals and ships a verified weekly plan from $29/mo.",
    intro:
      "Appfigures is proper app-store analytics: keyword ranks, downloads, revenue, and reviews tracked across stores, trusted by serious app businesses. But tracking a listing and fixing one are different jobs — and for most SaaS, the app store is only half the surface buyers search. ReachKit scores the whole presence and plans the fixes.",
    sections: [
      {
        heading: "What Appfigures is genuinely great at",
        paragraphs: [
          "Appfigures has been in the app-analytics business a long time, and it shows. Keyword rankings across the App Store and Google Play, download and revenue reporting, review aggregation with alerts, competitor rank tracking — the operational dashboard for a business whose revenue lives in the stores. Its ASO tooling is credible and its data hygiene has a good reputation among app developers.",
          "If you run a portfolio of apps, its reporting across them is genuinely hard to replace.",
        ],
      },
      {
        heading: "Where it leaves a solo founder stranded",
        paragraphs: [
          "Appfigures tells you what's happening to your listing; it doesn't decide what to do about it. Watching a keyword slide from #12 to #19 is not the same as knowing why, or whether it matters more than the four other things wrong with your listing, or what new title would recover it. The analysis and prioritisation are yours, and per-app pricing scales against you as you grow.",
          "The bigger blind spot is the web. Most SaaS buyers search the open web before or instead of a store, read comparison pages, and land on your site first. A founder can have a meticulously tracked listing and a website that's structurally invisible — and Appfigures will never mention it.",
        ],
      },
      {
        heading: "What ReachKit does instead",
        paragraphs: [
          "ReachKit treats your store listing and your website as one discoverable surface — because to a buyer, they are. It scans both, plus your reviews; measures real buyer search demand and where rivals show up for it; and computes a single 0–100 score from 18 deterministic signals across three weighted pillars — SEO 45%, Content 30%, Outreach 25%.",
          "Then it does the deciding: a ranked weekly action plan with evidence cited per item — including draft copy where copy is the fix — and a verify loop that re-checks each change live before it counts. Rank tracking tells you a number moved; ReachKit tells you what to change and confirms you changed it.",
          "The whole-surface view changes priorities in ways a store-only dashboard can't. If the scan shows your category's buyers search the web three times more than the store, this week's fix is your landing page, not your screenshot order — a call Appfigures has no data to make.",
          "First scan free; $29/month Solo or $129/month Growth — flat, not per app.",
        ],
      },
    ],
    useBothWhen: [
      "Your revenue genuinely lives in the stores and you need download/revenue ops.",
      "You manage a portfolio of apps and need cross-app reporting.",
      "You want review alerting wired into your support workflow.",
    ],
    chooseReachKitWhen: [
      "Your buyers search the web as much as the store.",
      "You want the fixes decided and verified, not the metrics charted.",
      "You want one flat price, not per-app tiers.",
    ],
    rows: [
      { capability: "Discoverability score (0–100)", cells: [check, cross] },
      { capability: "Covers app stores + web", cells: [check, partial("app stores only")] },
      { capability: "Ranked weekly action plan", cells: [check, cross] },
      { capability: "Draft copy per action", cells: [check, cross] },
      { capability: "Fixes verified by live re-check", cells: [check, partial("tracks rank over time")] },
      { capability: "ASO keyword rank + download data", cells: [partial("listing signals only"), check] },
      { capability: "Review aggregation & alerts", cells: [partial("reviews feed the scan"), check] },
      { capability: "Priced for solo founders", cells: [check, partial("per-app tiers")] },
    ],
  },
];

export const COMPARE_MAP: Record<string, CompareEntry> = Object.fromEntries(
  COMPARE_ENTRIES.map((e) => [e.slug, e]),
);

export const COMPARE_SLUGS: readonly string[] = COMPARE_ENTRIES.map((e) => e.slug);
