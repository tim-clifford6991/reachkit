// Issue 1458: the comparisons with audience, AI and data tools, ported from
// ReachKit v2 and corrected to what ReachKit does today. Facts about the
// other products were read on their own pages on 2026-10-15.
import type { Comparison } from "../types";
import { PRODUCT as P } from "../product";

const CHECKED = "2026-10-15";

export const OTHERS: readonly Comparison[] = [
  {
    slug: "sparktoro",
    name: "SparkToro",
    group: "audience",
    title: "ReachKit vs SparkToro",
    description:
      "SparkToro shows where your audience spends time. ReachKit shows whether they find you on Google and in AI answers, then puts pages live to change it.",
    summary: "SparkToro learns where buyers spend time. ReachKit checks whether they find you, then puts pages live.",
    intro:
      `SparkToro answers one question very well: where does my audience spend time online? ReachKit answers a different one: when that audience searches Google or asks AI, do they find you or your competitors? Then it writes up to ${P.weekPages} pages a week, new or updated, to change the answer. The two fit together. If buyers already search and find your competitors instead of you, start with ReachKit.`,
    theirs: {
      heading: "What SparkToro does well",
      paragraphs: [
        "SparkToro is audience research. Describe an audience and it shows the websites, podcasts, YouTube channels and social accounts that audience engages with far more than average. It also shows the words and phrases they type into Google and Bing, the social networks and AI tools they use, and the topics they care about.",
        "That is rare data. It helps you decide which newsletters to sponsor, which podcasts to pitch and which communities to join. SparkToro has a free plan for basic audience research, with three previews a month.",
      ],
    },
    does: ["choose"],
    rows: [
      { label: "Where your audience spends time", reachkit: false, them: true },
      { label: "Words your audience searches", reachkit: "partly: the searches in your market", them: true },
      { label: "Who is on Google's first page", reachkit: true, them: false },
      { label: "Whether AI answers mention you", reachkit: true, them: false },
      { label: "Visibility Score from 0 to 100", reachkit: true, them: false },
      { label: "Technical issues on your site", reachkit: true, them: false },
      { label: "Puts pages live on your website", reachkit: true, them: false },
      { label: "Free to start", reachkit: true, them: true },
    ],
    pickThem: [
      "You are planning sponsorships, podcast pitches or community work.",
      "You want to know which sites and accounts your buyers follow.",
      "You want audience profiles to shape your positioning.",
    ],
    pickUs: [
      "Buyers search for what you sell and find your competitors.",
      "You want your own site checked on Google and in AI answers.",
      "You want pages going live every week without writing them yourself.",
    ],
    checked: CHECKED,
    sources: [
      { label: "SparkToro home page", href: "https://sparktoro.com/" },
      { label: "SparkToro pricing", href: "https://sparktoro.com/pricing" },
    ],
  },
  {
    slug: "gummysearch",
    name: "GummySearch",
    group: "audience",
    title: "ReachKit vs GummySearch",
    badge: "Closed Nov 2025",
    description:
      "GummySearch, a Reddit research tool, closed on 30 November 2025. ReachKit checks whether buyers find your site on Google and in AI answers.",
    summary: "GummySearch closed in November 2025. ReachKit checks and grows how buyers find your site.",
    intro:
      "GummySearch has closed. Its own site says it shut down on 30 November 2025, to comply with Reddit's API policies, which forbid commercial applications. It was a research tool for Reddit, and ReachKit never did that job. If you came here looking for a GummySearch replacement for Reddit research, its site keeps a list of alternatives.",
    theirs: {
      heading: "What GummySearch did well",
      paragraphs: [
        "GummySearch called itself the research tool for Reddit. It let you discover, search and analyse Reddit communities, for startup ideas, demand validation, content ideas and sales leads.",
        "Reddit is where many buyers describe their problems in their own words, so it was a good way to hear how buyers talk. The service closed on 30 November 2025. Its site says Reddit's API policies forbid commercial applications.",
      ],
    },
    does: [],
    rows: [
      { label: "Open to new customers", reachkit: true, them: false },
      { label: "Reddit research", reachkit: false, them: "closed 30 November 2025" },
      { label: "Who is on Google's first page", reachkit: true, them: false },
      { label: "Whether AI answers mention you", reachkit: true, them: false },
      { label: "Technical issues on your site", reachkit: true, them: false },
      { label: "Puts pages live on your website", reachkit: true, them: false },
    ],
    pickThem: [
      "GummySearch has closed, so it cannot be picked today.",
      "For Reddit research, start from the alternatives its site lists.",
      "ReachKit does not read Reddit, so it is not a replacement.",
    ],
    pickUs: [
      "You know buyers want what you sell, but they find competitors.",
      "You want your site checked on Google and in AI answers.",
      `You want up to ${P.weekPages} pages a week, new or updated.`,
    ],
    checked: CHECKED,
    sources: [
      { label: "GummySearch home page, closing notice", href: "https://gummysearch.com/" },
      { label: "GummySearch closing announcement", href: "https://gummysearch.com/closing-time/" },
      { label: "GummySearch alternatives", href: "https://gummysearch.com/gummysearch-alternatives/" },
    ],
  },
  {
    slug: "similarweb",
    name: "Similarweb",
    group: "audience",
    title: "ReachKit vs Similarweb",
    description:
      "Similarweb estimates traffic and market share across the web. ReachKit checks your own site on Google and in AI answers, then puts pages live.",
    summary: "Similarweb maps whole markets. ReachKit checks your own site and puts pages live to grow it.",
    intro:
      `Similarweb is a digital data platform: traffic, channels and market share for millions of websites and apps. ReachKit is much narrower. It checks whether buyers find your one site on Google and in AI answers, and then writes up to ${P.weekPages} pages a week, new or updated, to change that. If you need to size a market or benchmark large competitors, pick Similarweb. If you own a small company site and buyers are not finding it, pick ReachKit.`,
    theirs: {
      heading: "What Similarweb does well",
      paragraphs: [
        "Similarweb gives one view across digital channels. It benchmarks competitors, tracks their ads across display, search and social, and offers market share dashboards. It says its data covers more than 100 million websites and 4 million apps.",
        "Its data comes from several sources: analytics that site owners connect, a network of devices running Similarweb products, public data and partners. Similarweb then extrapolates from those signals with its own models, so most figures for a site are estimates.",
      ],
    },
    does: ["choose", "results"],
    rows: [
      { label: "Traffic estimates for any site", reachkit: false, them: true },
      { label: "Market share dashboards", reachkit: false, them: true },
      { label: "Competitor ad tracking", reachkit: false, them: true },
      { label: "Whether AI answers mention you", reachkit: true, them: false },
      { label: "Technical issues on your site", reachkit: true, them: false },
      { label: "Puts pages live on your website", reachkit: true, them: false },
    ],
    pickThem: [
      "You are sizing a market for investors or a board.",
      "You need traffic and channel estimates for large competitors.",
      "You want to track competitors' ads across channels.",
    ],
    pickUs: [
      "You own a small company site and buyers are not finding it.",
      "You want your own searches and AI answers checked each week.",
      "You want pages put live for you, not a market report.",
    ],
    checked: CHECKED,
    sources: [
      { label: "Similarweb home page", href: "https://www.similarweb.com/" },
      { label: "Similarweb, our data", href: "https://www.similarweb.com/corp/ourdata/" },
    ],
  },
  {
    slug: "chatgpt",
    name: "ChatGPT",
    group: "ai",
    title: "ReachKit vs ChatGPT",
    heading: "ReachKit vs writing with ChatGPT yourself",
    description:
      "ChatGPT answers questions and writes. ReachKit checks whether ChatGPT and Google AI Mode mention your site, then puts pages live, written from your own facts.",
    summary: "ChatGPT is an assistant. ReachKit checks whether ChatGPT mentions you, and puts pages live to change it.",
    intro:
      "Many owners ask ChatGPT to write their blog posts. It writes fast, but you still choose the topic, give it the facts, check every claim, put the page live and find out whether it worked. ReachKit does all of that every week, from facts on your own site, and then checks whether ChatGPT and Google's AI answers mention you. If you enjoy writing with an assistant, use ChatGPT. If nobody on your team has the time, use ReachKit.",
    theirs: {
      heading: "What ChatGPT does well",
      paragraphs: [
        "ChatGPT can explain almost anything, at the depth you ask for. It rewrites a headline ten ways, drafts an email and talks an idea through with you. For a founder learning how search works, it is a patient tutor.",
        "OpenAI says ChatGPT can search the web, including on its free plan, and that answers which use search show their sources. OpenAI also says those sources can be incomplete or wrong, so it is worth opening them.",
      ],
    },
    ask: "Rewrite this headline ten ways.",
    does: ["write"],
    rows: [
      { label: "Chooses topics from what buyers search", reachkit: true, them: false },
      { label: "Writes from your site's facts, each linked", reachkit: true, them: "Partly: from what you paste in" },
      { label: "Checks every page before it goes live", reachkit: `Yes, up to ${P.checks} checks`, them: false },
      { label: "Puts pages live on your website", reachkit: true, them: false },
      { label: "Checks whether ChatGPT mentions you", reachkit: true, them: false },
      { label: "Answers any question you ask", reachkit: false, them: true },
      { label: "Price", reachkit: `${P.price} a month, one plan`, them: "Free plan and paid plans" },
      { label: "Free to start", reachkit: "Yes, the free scan", them: true },
    ],
    pickThem: [
      "you like writing and want a fast first draft",
      "you want to talk an idea through",
      "you'll put each page live and check it yourself",
    ],
    pickUs: [
      "nobody on your team writes, and you don't want to start",
      "you want topics chosen from what buyers actually search",
      "you want pages going live every week without asking",
    ],
    checked: CHECKED,
    sources: [
      { label: "OpenAI help, ChatGPT search", href: "https://help.openai.com/en/articles/9237897-chatgpt-search" },
      { label: "ChatGPT pricing", href: "https://chatgpt.com/pricing" },
    ],
  },
  {
    slug: "surfer-seo",
    name: "Surfer",
    group: "ai",
    title: "ReachKit vs Surfer",
    description:
      "Surfer helps you write and score articles for Google and AI search. ReachKit picks the topics and writes the pages, and they go live every week.",
    summary: "Surfer helps you write each page. ReachKit chooses and writes your pages, and they go live every week.",
    intro:
      `Surfer is a writing tool: you bring a topic and a draft, and it guides the draft with search data. ReachKit is for a founder who does not want to write at all. It checks where buyers find your competitors instead of you, then writes up to ${P.weekPages} pages a week, new or updated, from your own site. If you or a writer produce content and want each piece to compete, Surfer fits. If nobody on your team writes, ReachKit does it.`,
    theirs: {
      heading: "What Surfer does well",
      paragraphs: [
        "Surfer's Content Editor gives live search and AI search guidelines while you write, and a Content Score tells you how the draft compares. It can also write and edit with AI.",
        "Surfer also has an AI Tracker, which shows how your brand appears in AI tools like ChatGPT and flags answers that favour competitors. It offers several plans and free tools, including a free AI visibility audit.",
      ],
    },
    does: ["choose", "write", "results"],
    rows: [
      { label: "Editor that guides your draft", reachkit: false, them: true },
      { label: "Writes with AI", reachkit: "partly: whole pages, from your site", them: true },
      { label: "Tracks AI answers about you", reachkit: true, them: true },
      { label: "Technical issues on your site", reachkit: true, them: false },
      { label: "One plan, VAT included", reachkit: true, them: "partly: several plans" },
      { label: "Free to start", reachkit: true, them: "partly: free tools and an AI audit" },
    ],
    pickThem: [
      "You or a writer already produce articles and want each to compete.",
      "You choose your own topics and want guidance as you write.",
      "You want to edit every word before it goes out.",
    ],
    pickUs: [
      "Nobody on your team writes, and you do not want to start.",
      "You want the topics chosen from what buyers search.",
      "You want pages going live every week without you.",
    ],
    checked: CHECKED,
    sources: [
      { label: "Surfer home page", href: "https://surferseo.com/" },
      { label: "Surfer pricing", href: "https://surferseo.com/pricing/" },
    ],
  },
  {
    slug: "google-search-console",
    name: "Google Search Console",
    group: "data",
    title: "ReachKit vs Google Search Console",
    badge: "Free · keep using it",
    description:
      "Search Console is Google's free view of your site in Search. ReachKit adds competitors and AI answers, then puts pages live to grow your reach.",
    summary: "Use Search Console, it is free. ReachKit adds competitors, AI answers and pages every week.",
    intro:
      `You should have Google Search Console. It is free, it comes from Google, and nothing else shows how Google sees your site. ReachKit does not connect to it and does not replace it. ReachKit adds what Search Console does not show: which competitors are on the first page instead of you, whether AI answers mention you, and up to ${P.weekPages} pages a week, new or updated, to change that.`,
    theirs: {
      heading: "What Search Console does well",
      paragraphs: [
        "Search Console is a free service from Google to monitor, maintain and troubleshoot your site in Google Search. Its performance reports show which queries bring people to your site, with impressions, clicks and position.",
        "It shows which pages Google has indexed, and URL Inspection gives crawl, index and serving details for a single page. It can also email you when Google finds an issue on your site.",
      ],
    },
    does: ["results"],
    rows: [
      { label: "Google's own clicks and impressions", reachkit: false, them: true },
      { label: "Index status and URL Inspection", reachkit: false, them: true },
      { label: "Competitors on your searches", reachkit: true, them: false },
      { label: "Whether AI answers mention you", reachkit: true, them: false },
      { label: "Weekly email with what moved", reachkit: true, them: "partly: alerts on issues" },
      { label: "Puts pages live on your website", reachkit: true, them: false },
      { label: "Free", reachkit: "partly: the scan is free", them: true },
    ],
    pickThem: [
      "Always. It is free, and every site owner should verify it.",
      "You need Google's own word on whether a page is indexed.",
      "You want Google's own clicks and impressions for your site.",
    ],
    pickUs: [
      "You want to see which competitors Google shows instead of you.",
      "You want to know whether AI answers mention you.",
      "You want pages put live for you, not reports to read.",
    ],
    checked: CHECKED,
    sources: [
      { label: "Search Console overview", href: "https://search.google.com/search-console/about" },
      { label: "Search Console Help, about Search Console", href: "https://support.google.com/webmasters/answer/9128668" },
    ],
  },
  {
    slug: "appfigures",
    name: "Appfigures",
    group: "data",
    title: "ReachKit vs Appfigures",
    badge: "Different job",
    description:
      "Appfigures tracks apps in the App Store and Google Play. ReachKit does not read app stores: it checks and grows how buyers find your website.",
    summary: "Appfigures is for apps in the stores. ReachKit is for your website. Different jobs.",
    intro:
      `These are different jobs. Appfigures is app store data: keyword ranks, download and revenue estimates, and competing apps in the App Store and Google Play. ReachKit does not read app stores at all. It checks whether buyers find your website on Google and in AI answers, and writes up to ${P.weekPages} pages a week, new or updated, to change that. If your business lives in the stores, use Appfigures; if your website is how buyers find you, use ReachKit.`,
    theirs: {
      heading: "What Appfigures does well",
      paragraphs: [
        "Appfigures tracks how your app ranks for the keywords you choose, over time. For iOS apps it can split phone and tablet ranks.",
        "It estimates downloads and revenue for iOS and Android apps, and lets you compare your own figures with estimates for competing apps. For a business whose sales happen in the stores, that is the daily dashboard.",
      ],
    },
    does: [],
    rows: [
      { label: "App store keyword ranks", reachkit: false, them: true },
      { label: "Download and revenue estimates", reachkit: false, them: true },
      { label: "Compare with competing apps", reachkit: false, them: true },
      { label: "Your website on Google's first page", reachkit: true, them: false },
      { label: "Whether AI answers mention you", reachkit: true, them: false },
      { label: "Puts pages live on your website", reachkit: true, them: false },
    ],
    pickThem: [
      "Your revenue comes from the App Store or Google Play.",
      "You want to track your app's keyword ranks in the stores.",
      "You want download and revenue estimates for competing apps.",
    ],
    pickUs: [
      "Buyers find you through your website, not a store.",
      "You want your site checked on Google and in AI answers.",
      "You want pages going live on your site every week.",
    ],
    checked: CHECKED,
    sources: [
      { label: "Appfigures help, keyword performance", href: "https://help.appfigures.com/en/article/keyword-performance-9f0ocx/" },
      { label: "Appfigures help centre", href: "https://help.appfigures.com/" },
    ],
  },
];
