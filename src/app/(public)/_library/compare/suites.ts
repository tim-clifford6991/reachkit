// Issue 1458: comparisons of ReachKit with SEO suites, rank trackers and
// competitor analysis tools, ported from the v2 pages at the same addresses.
// Every fact about another company was read on its own site on 2026-10-15.
import type { Comparison } from "../types";
import { PRODUCT as P } from "../product";

const CHECKED = "2026-10-15";

export const SUITES: readonly Comparison[] = [
  {
    slug: "ahrefs",
    name: "Ahrefs",
    group: "suite",
    title: "ReachKit vs Ahrefs",
    description:
      `Ahrefs is a deep SEO data platform for professionals. ReachKit scans your site for free, then puts up to ${P.weekPages} pages a week live for you.`,
    summary: "Ahrefs gives search experts the data. ReachKit does the work for a founder.",
    intro:
      "Ahrefs is one of the largest SEO data platforms there is, and it is built for people whose job is search. ReachKit is built for a founder who owns a small company website and knows nothing about SEO. If you want to research keywords and backlinks yourself, pick Ahrefs. If you want to see where buyers go instead of you and have pages put live to change it, pick ReachKit.",
    theirs: {
      heading: "What Ahrefs does well",
      paragraphs: [
        "Ahrefs runs on its own web data, collected over more than ten years. Site Explorer shows what any site ranks for and who links to it. Keywords Explorer researches searches. Rank Tracker follows positions, Site Audit crawls a site for technical issues, and Brand Radar tracks how a brand appears in AI chatbots.",
        "There is a free plan, Ahrefs Free, for data on your own site, plus free SEO tools and an AI visibility checker. Paid plans start with Starter at €27 a month. Lite, at €119 a month, adds Site Explorer, Keywords Explorer, Rank Tracker, Site Audit and Brand Radar for one user.",
        "If SEO is your job, or you run campaigns for clients, that depth is worth what it costs.",
      ],
    },
    does: ["choose", "results"],
    rows: [
      { label: "Free scan with no account", reachkit: true, them: "partly: free plan and free tools" },
      { label: "Backlink index", reachkit: false, them: true },
      { label: "Keyword research database", reachkit: false, them: true },
      { label: "Whole site technical audit", reachkit: `partly: up to ${P.pages} pages`, them: true },
      { label: "AI answers checked", reachkit: true, them: true },
      { label: "Competitor research", reachkit: "partly: who wins your searches", them: true },
      { label: "Pages written and put live for you", reachkit: true, them: false },
      { label: "One plan, no tiers", reachkit: true, them: false },
    ],
    pickThem: [
      "SEO is your job, or you run it for clients.",
      "You need backlink data or keyword research across the whole web.",
      "You have the hours to turn data into work yourself.",
    ],
    pickUs: [
      "You own the website and have no time to learn SEO.",
      "You want pages going live every week without writing them.",
      "You want one price and nothing to configure.",
    ],
    checked: CHECKED,
    sources: [
      { label: "Ahrefs home page", href: "https://ahrefs.com/" },
      { label: "Ahrefs pricing", href: "https://ahrefs.com/pricing" },
    ],
  },
  {
    slug: "semrush",
    name: "Semrush",
    group: "suite",
    title: "ReachKit vs Semrush",
    description:
      "Semrush's free SEO Checker grades a site once a day. ReachKit's free scan shows who Google and AI send buyers to, then puts pages live.",
    summary: "Semrush checks more things. ReachKit shows who wins your buyers and puts pages live to change it.",
    intro:
      "Semrush offers a free SEO Checker at semrush.com/siteaudit, powered by its Site Audit, and on raw coverage it checks more than ReachKit does. ReachKit's free scan looks at something else as well: the Google searches buyers in your market make, who is on the first page, and whether AI answers mention you. If you want the widest audit of what is wrong with a site, pick Semrush. If you want pages put live to win those searches, pick ReachKit.",
    theirs: {
      heading: "What Semrush does well",
      paragraphs: [
        "The free SEO Checker returns an overall score, a prioritized to do list and a detailed report. It covers on-page elements, off-page signals such as backlinks and authority, technical SEO such as crawlability, indexing and canonicals, site performance including Core Web Vitals, and social media visibility. Semrush states you can run one check per day for free.",
        "The paid path goes further. Site Audit checks hundreds of technical and on-page issues, and Semrush One advertises more than 140 technical and on-page checks. Semrush offers a seven day free trial, cancel any time.",
        "For a large site, or a team with a marketer on it, that breadth is the right tool.",
      ],
    },
    does: ["choose", "results"],
    rows: [
      { label: "Free check with no account", reachkit: true, them: "partly: one check per day" },
      { label: "Technical issues with fixes", reachkit: `partly: up to ${P.pages} pages`, them: true },
      { label: "Core Web Vitals in depth", reachkit: false, them: true },
      { label: "Backlinks and authority", reachkit: false, them: true },
      { label: "Social media visibility", reachkit: false, them: true },
      { label: "Pages written and put live for you", reachkit: true, them: false },
    ],
    pickThem: [
      "You need speed, Core Web Vitals or backlinks checked.",
      "Your site is large enough to need a full crawl.",
      "A marketer on your team already works in Semrush.",
    ],
    pickUs: [
      "You want to know who Google and AI send your buyers to.",
      "You want pages put live for you, not a longer list.",
      "You want one plan with nothing to set up.",
    ],
    checked: CHECKED,
    sources: [{ label: "Semrush free SEO Checker", href: "https://www.semrush.com/siteaudit/" }],
  },
  {
    slug: "moz",
    name: "Moz",
    group: "suite",
    title: "ReachKit vs Moz",
    description:
      "Moz Pro pairs SEO tools with some of the best SEO teaching there is. ReachKit skips the course and puts pages live for you.",
    summary: "Moz teaches you how to get found on Google and gives you the tools. ReachKit does the work instead.",
    intro:
      "Moz is one of the oldest companies in SEO software, and its guides are how many people learned search. ReachKit makes the opposite offer: you should not have to learn it. If you want to become good at SEO, pick Moz. If you want to be found without taking the course, pick ReachKit.",
    theirs: {
      heading: "What Moz does well",
      paragraphs: [
        "Moz Pro brings together Keyword Explorer, Rank Tracker, Site Crawl, competitive research, an On-page Grader, Domain Authority and Brand Authority. Moz states a keyword index of more than 1.25 billion keywords and more than 40 trillion links in Link Explorer. Its plans also track how a brand appears in four AI models, including Google AI Mode and Perplexity.",
        "The teaching is the real gift. Moz Academy, Whiteboard Friday, the Moz Blog and the Beginner's Guide to SEO cover the subject from the basics up.",
        "Moz Pro Standard is $99 a month, or $79 a month paid yearly, and there is a free trial. A free Moz Community account gives limited access to MozBar, Keyword Explorer and Link Explorer.",
      ],
    },
    does: ["choose", "results"],
    rows: [
      { label: "Free scan with no account", reachkit: true, them: "partly: free tools and a free account" },
      { label: "SEO courses and guides", reachkit: false, them: true },
      { label: "Domain Authority and link metrics", reachkit: false, them: true },
      { label: "Keyword research database", reachkit: false, them: true },
      { label: "AI answers checked", reachkit: "partly: ChatGPT and Google AI Mode", them: true },
      { label: "Pages written and put live for you", reachkit: true, them: false },
      { label: "One plan, no tiers", reachkit: true, them: false },
    ],
    pickThem: [
      "You want to learn SEO as a skill.",
      "You track Domain Authority for partners or investors.",
      "You are hiring a marketer who will want familiar tools.",
    ],
    pickUs: [
      "You want results without the course.",
      "You want pages going live for you every week.",
      "You want one price with no tiers.",
    ],
    checked: CHECKED,
    sources: [
      { label: "Moz Pro product page", href: "https://moz.com/products/pro" },
      { label: "Moz Pro pricing", href: "https://moz.com/products/pro/pricing" },
    ],
  },
  {
    slug: "ubersuggest",
    name: "Ubersuggest",
    group: "suite",
    title: "ReachKit vs Ubersuggest",
    description:
      "Ubersuggest is affordable keyword research, a site audit and AI visibility tracking. ReachKit spends your budget on pages put live for you.",
    summary: "Ubersuggest gives you affordable data about Google. ReachKit turns your budget into pages that go live every week.",
    intro:
      "Ubersuggest, from Neil Patel, made SEO data affordable, and it now tracks AI search visibility too. ReachKit competes for the same founder budget with a different product: not cheaper data, but the work itself. If you want to research keywords and audit a large site, pick Ubersuggest. If you want pages written and put live for you, pick ReachKit.",
    theirs: {
      heading: "What Ubersuggest does well",
      paragraphs: [
        "Ubersuggest offers keyword research on a database of more than 2.2 billion keywords, content ideas, daily rank tracking, competitor keyword gaps and a full backlink profile. Its site audit crawls from 1,000 pages on the entry plan up to 150,000 on the top self-serve plan, and lists what to fix first.",
        "It tracks how a brand appears in Google AI Overviews, Gemini, ChatGPT and Perplexity. Content Studio drafts articles on paid plans.",
        "There is a free plan for light research, a Lifetime option for people who would rather pay once, and a seven day free trial that needs a credit card.",
      ],
    },
    does: ["choose", "results"],
    rows: [
      { label: "Free scan with no account", reachkit: true, them: "partly: free plan for light research" },
      { label: "Keyword research database", reachkit: false, them: true },
      { label: "Backlink profile", reachkit: false, them: true },
      { label: "Site audit", reachkit: `partly: up to ${P.pages} pages`, them: true },
      { label: "AI answers checked", reachkit: "partly: ChatGPT and Google AI Mode", them: true },
      { label: "Pages written and put live for you", reachkit: true, them: "partly: drafts you put live yourself" },
      { label: "Lifetime purchase", reachkit: false, them: true },
    ],
    pickThem: [
      "You want a low cost tool to explore keywords.",
      "You want to pay once with the Lifetime option.",
      `Your site is larger than ${P.pages} pages and needs a full audit.`,
    ],
    pickUs: [
      "You want your budget spent on pages, not more data.",
      "You do not want to write or put anything live yourself.",
      "You want one plan with nothing to set up.",
    ],
    checked: CHECKED,
    sources: [{ label: "Ubersuggest product page", href: "https://neilpatel.com/ubersuggest/" }],
  },
  {
    slug: "mangools",
    name: "Mangools",
    group: "suite",
    title: "ReachKit vs Mangools",
    description:
      "Mangools and KWFinder make keyword research friendly. ReachKit scans your own site and puts pages live every week to win your searches.",
    summary: "Mangools makes finding search terms pleasant. ReachKit finds what your buyers search for and puts pages live for it.",
    intro:
      "Mangools, best known for KWFinder, made keyword research pleasant to use. But keywords are one input, not the answer. If you enjoy the research and want a friendly tool for it, pick Mangools. If you want ReachKit to find the searches that matter and put pages live for them, pick ReachKit.",
    theirs: {
      heading: "What Mangools does well",
      paragraphs: [
        "KWFinder finds low difficulty, long tail keywords, by keyword or by a competitor's domain, with search volumes, difficulty scores and trends for more than 65,000 locations. A free account gets 5 lookups every 24 hours.",
        "The rest of the suite follows the same idea. SERPChecker analyses a results page, SERPWatcher tracks rankings with weekly updates (daily on the Agency plan), LinkMiner finds link opportunities and SiteProfiler gives a site's SEO metrics. Mangools also lists AI Search Watcher and free tools such as an AI Search Grader.",
        "Paid plans are Basic, Premium and Agency, with a 48 hour money back guarantee.",
      ],
    },
    does: ["choose", "results"],
    rows: [
      { label: "Free scan with no account", reachkit: true, them: "partly: free account, 5 lookups a day" },
      { label: "Keyword research tool", reachkit: false, them: true },
      { label: "Backlink lookups", reachkit: false, them: true },
      { label: "Competitors on your searches", reachkit: true, them: true },
      { label: "AI answers checked", reachkit: true, them: true },
      { label: "Pages written and put live for you", reachkit: true, them: false },
    ],
    pickThem: [
      "You want to find low competition keywords in a niche.",
      "You enjoy the research and want a pleasant tool.",
      "You need light rank tracking for a few terms.",
    ],
    pickUs: [
      "You do not know whether keywords are your problem.",
      "You want your own site scanned, not researched around.",
      "You want pages live, not another list.",
    ],
    checked: CHECKED,
    sources: [
      { label: "KWFinder product page", href: "https://mangools.com/kwfinder" },
      { label: "Mangools plans and pricing", href: "https://mangools.com/plans-and-pricing" },
    ],
  },
  {
    slug: "se-ranking",
    name: "SE Ranking",
    group: "suite",
    title: "ReachKit vs SE Ranking",
    description:
      "SE Ranking is a full SEO platform with daily rank tracking and agency reports. ReachKit puts pages live every week for one founder's site.",
    summary: "SE Ranking tracks where sites sit on Google every day, for professionals. ReachKit puts pages live to move you up.",
    intro:
      "SE Ranking is a complete SEO platform, with daily rank tracking at its core, plus audits, backlinks, competitor research and AI search tracking. It is a strong choice for agencies. ReachKit asks a different question: does a founder need daily positions, or pages that change them? If you run SEO for clients, pick SE Ranking. If you own one site and want the work done, pick ReachKit.",
    theirs: {
      heading: "What SE Ranking does well",
      paragraphs: [
        "SE Ranking tracks rankings daily, 2,000 keywords on Core and 5,000 on Growth. Around that sit a website audit, an on-page checker, keyword research, competitor research, backlink monitoring, a content editor and local rank tracking.",
        "It has moved into AI search. SE Visible follows how a brand appears in ChatGPT, Gemini, Perplexity and AI Overviews, and an AI Search add-on tracks more prompts. The Agency Pack adds white-label reports and client seats.",
        "Core is €109 a month, Growth €235, both less on annual billing. There is a 14 day free trial with no credit card.",
      ],
    },
    does: ["choose", "results"],
    rows: [
      { label: "Free scan with no account", reachkit: true, them: "partly: 14 day free trial" },
      { label: "Daily rank tracking", reachkit: false, them: true },
      { label: "White-label client reports", reachkit: false, them: "partly: Agency Pack add-on" },
      { label: "Backlink monitoring", reachkit: false, them: true },
      { label: "AI answers checked", reachkit: "partly: ChatGPT and Google AI Mode", them: true },
      { label: "Pages written and put live for you", reachkit: true, them: false },
      { label: "One plan, no add-ons", reachkit: true, them: false },
    ],
    pickThem: [
      "You run SEO for clients and need white-label reports.",
      "Daily positions across many keywords drive your decisions.",
      "You want a full suite and will do the work yourself.",
    ],
    pickUs: [
      "You own one site and want the work done.",
      "You would rather put pages live than watch positions.",
      "You want one price with no add-ons.",
    ],
    checked: CHECKED,
    sources: [
      { label: "SE Ranking home page", href: "https://seranking.com/" },
      { label: "SE Ranking pricing", href: "https://seranking.com/subscription.html" },
    ],
  },
  {
    slug: "moz-competitive-research",
    name: "Moz Competitive Research",
    group: "competitors",
    title: "ReachKit vs Moz Competitive Research",
    description:
      "Moz finds your true search competitors and compares up to 3 in Keyword Gap. ReachKit shows who wins your searches, then puts pages live.",
    summary: "Moz gives you deep competitor data. ReachKit shows who wins your buyers and puts pages live to win them back.",
    intro:
      "Moz's competitive research page is titled Free SEO Competitive Analysis Tool, and it lets you enter any domain. ReachKit's free scan also shows the competitors Google puts on the first page instead of you, but it is not a research tool. If you want to study competitors' keywords, content and links, pick Moz. If you want pages put live to win the searches they win, pick ReachKit.",
    theirs: {
      heading: "What Moz does well",
      paragraphs: [
        "True Competitor lists your real search competitors from the results where your site ranks, with two measures of how closely each one competes with you. Keyword Gap takes up to 3 competitors and finds searches where you are on the first two pages but they rank higher, and searches where they appear and you do not. Top Competing Content shows their most visible pages and the keywords each one ranks for.",
        "Moz Pro Campaigns tracks up to three competitors side by side each week. Domain Overview compares Domain Authority and Brand Authority, and Link Explorer compares links. Keyword Explorer runs on more than 1.25 billion keywords and Link Explorer on more than 40 trillion links.",
        "The teaching is strong too: a guide with a free template and a Moz Academy certification of six courses and exams. The deeper tools are part of Moz Pro, which has a free trial.",
      ],
    },
    does: ["choose"],
    rows: [
      { label: "Competitors found from search results", reachkit: true, them: true },
      { label: "Free with no account", reachkit: true, them: "partly: deeper tools in Moz Pro" },
      { label: "Competitors tracked weekly", reachkit: `partly: up to ${P.competitors}, paid`, them: "partly: up to 3 in Campaigns" },
      { label: "Keyword gap report", reachkit: false, them: true },
      { label: "Domain Authority and links", reachkit: false, them: true },
      { label: "AI answers checked", reachkit: true, them: true },
      { label: "Pages written and put live for you", reachkit: true, them: false },
    ],
    pickThem: [
      "You want to study competitors' keywords and content yourself.",
      "You need Domain Authority, Brand Authority or link comparisons.",
      "You want to learn competitive analysis as a skill.",
    ],
    pickUs: [
      "You already know who wins and want pages to answer it.",
      "You want competitors found and checked again for you.",
      "You have no hours for research.",
    ],
    checked: CHECKED,
    sources: [
      { label: "Moz Competitive Research", href: "https://moz.com/competitive-research" },
      { label: "Moz Pro pricing", href: "https://moz.com/products/pro/pricing" },
    ],
  },
  {
    slug: "seobility-competitor-analysis",
    name: "Seobility Competitor Analysis",
    group: "competitors",
    title: "ReachKit vs Seobility Competitor Analysis",
    description:
      "Seobility's free Basic plan tracks 3 competitors and 10 keywords weekly. ReachKit shows who wins your searches, then puts pages live.",
    summary: "Seobility monitors competitors for free. ReachKit shows who wins your buyers and puts pages live to change it.",
    intro:
      "Seobility's free Basic plan tracks 3 competitors and their rankings for 10 keywords, updated weekly. ReachKit's free scan shows the competitors on the first page of your market's searches, and its paid plan puts pages live. If you want to monitor competitors' rankings and backlinks, pick Seobility. If you want the work that changes them done for you, pick ReachKit.",
    theirs: {
      heading: "What Seobility does well",
      paragraphs: [
        "The free Basic plan includes 3 tracked competitors, their rankings for 10 keywords updated weekly, and 5 Keyword Research requests a day. Premium raises that to 20 competitors, 300 keywords updated daily and 50 requests a day, with a 14 day free trial, cancel any time.",
        "The Competitor Dashboard combines search visibility and referring domain growth. Ranking Monitoring compares visibility, positions and daily changes side by side. On Premium, Backlink Monitoring shows the links competitors gained or lost.",
        "Those are stated quotas on a free plan, and that is a real offer.",
      ],
    },
    does: ["choose"],
    rows: [
      { label: "Free competitor view", reachkit: true, them: "partly: 3 competitors, 10 keywords" },
      { label: "Competitors tracked weekly", reachkit: `partly: up to ${P.competitors}, paid`, them: "partly: 3 free, 20 on Premium" },
      { label: "Competitor backlinks", reachkit: false, them: "partly: on Premium" },
      { label: "Daily ranking changes", reachkit: false, them: "partly: on Premium" },
      { label: "Keyword research tool", reachkit: false, them: true },
      { label: "Pages written and put live for you", reachkit: true, them: false },
    ],
    pickThem: [
      "You want free competitor tracking with stated quotas.",
      "You need competitors' backlinks and referring domains.",
      "You want daily ranking changes.",
    ],
    pickUs: [
      "Monitoring is not your problem; doing the work is.",
      "You want to know whether AI answers mention you.",
      "You want pages going live for you every week.",
    ],
    checked: CHECKED,
    sources: [
      {
        label: "Seobility competitor analysis tools",
        href: "https://www.seobility.net/en/seo-competitor-analysis-tools/",
      },
    ],
  },
];
