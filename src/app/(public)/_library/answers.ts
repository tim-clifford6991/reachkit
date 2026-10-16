// Issue 1458: the one answer page first published in ReachKit v2, brought
// back at its old address. The answer comes first and names no product of
// ours; ReachKit appears after it. Every Seobility and Moz figure was read on
// the vendor's own page on 2026-10-15.
import { PRODUCT as P } from "./product";
import type { Answer } from "./types";

export const ANSWERS: readonly Answer[] = [
  {
    slug: "free-seo-competitor-analysis-tool",
    title: "Free SEO competitor analysis tool",
    description:
      "Seobility's free plan tracks 3 competitors and 10 keywords, updated weekly. Moz's Keyword Gap takes up to 3. What each free tier gives you.",
    answer: [
      "A free SEO competitor analysis tool shows which sites rank against you in search, and for which keywords, at no cost. Every free tier of this kind has limits.",
      "The limits come in three units: how many competitors you may track, how many keywords are reported for them, and how often the data refreshes. Seobility's free Basic plan tracks 3 competitors and reports their rankings for 10 keywords, updated weekly. Moz lists Competitive Research among its free SEO tools, and its Keyword Gap tool compares you with up to 3 competitors.",
    ],
    sections: [
      {
        heading: "What Seobility's free plan includes",
        paragraphs: [
          "Seobility calls its Basic plan free. It tracks 3 competitors and reports competitor rankings for 10 keywords, updated weekly. It allows 5 requests a day to the Keyword Research Tool.",
          "The paid Premium plan tracks 20 competitors and reports their rankings for 300 keywords, updated daily, with 50 Keyword Research requests a day. It adds competitor backlink analysis and monitoring; backlinks update weekly.",
          "Seobility offers a 14-day free trial of Premium and says you can cancel at any time. The competitor analysis page gives no prices.",
        ],
      },
      {
        heading: "What Moz's free research includes",
        paragraphs: [
          "Moz's page is titled 'Free SEO Competitive Analysis Tool' and invites you to enter any domain to see how Moz Pro helps with competitor analysis. Competitive Research sits in Moz's Free SEO Tools menu with Domain Analysis, Keyword Explorer, Link Explorer and MozBar.",
          "True Competitor lists your competitors from the search results where your site ranks, with two measures called Overlap and Rivalry. Keyword Gap takes up to 3 competitors and finds keywords where you rank on the first two pages but a competitor ranks higher, and keywords where they rank and you do not.",
          "Moz Pro Campaigns track up to 3 competitors side by side and show how they rank each week. Domain Overview shows Domain Authority and Brand Authority. Moz says Keyword Explorer draws on more than 1.25 billion keywords and Link Explorer on more than 40 trillion links. The page offers a free trial of Moz Pro but states no price and no trial length.",
        ],
      },
      {
        heading: "Where ReachKit sits",
        paragraphs: [
          `ReachKit is not a keyword research tool. Its free scan reads your site, works out your market, and runs ${P.searches} Google searches that buyers in that market make. It names the competitors that show up on the first page of those searches instead of you. It is free, takes about a minute, and needs no account.`,
          `The same scan checks whether AI answers mention or link your site, gives a Visibility Score from 0 to 100 with its range, and lists technical issues across up to ${P.pages} pages, each with a free fix.`,
          `The paid plan, ${P.price} a month, tracks up to ${P.competitors} competitors and scans them again every week. Its main job is different: it publishes a page every day, new or updated, on your own site, to win those searches back.`,
          "ReachKit keeps no backlink index and no keyword database, and it tracks rankings only for your own searches. If you need keyword gaps or competitor backlinks, Seobility or Moz is the better tool.",
        ],
      },
    ],
    faq: [
      {
        q: "Is there a completely free SEO competitor analysis tool?",
        a: "Yes, with limits. Seobility's Basic plan is free and tracks 3 competitors, with their rankings for 10 keywords updated weekly. Moz lists Competitive Research among its free SEO tools and invites you to enter any domain. Each limits what the free tier returns.",
      },
      {
        q: "How many competitors can you track for free?",
        a: "Seobility's free Basic plan tracks 3 competitors. Moz's Keyword Gap tool takes up to 3, and Moz Pro Campaigns track up to 3 side by side. Seobility's paid Premium plan raises its limit to 20.",
      },
      {
        q: "How often does free competitor data refresh?",
        a: "Seobility's free Basic plan updates competitor rankings for 10 keywords weekly; its Premium plan updates 300 keywords daily. Moz Pro Campaigns show how tracked competitors rank each week.",
      },
      {
        q: "Does ReachKit have a free competitor analysis tool?",
        a: `In part. ReachKit's free scan runs ${P.searches} Google searches buyers in your market make and names the competitors on the first page of them, with no account. It does not report their keywords or backlinks. The paid plan, ${P.price} a month, tracks up to ${P.competitors} competitors and scans them again every week.`,
      },
      {
        q: "What does ReachKit check for free?",
        a: `The free scan gives a Visibility Score, the competitors that show up instead of you, whether AI answers mention or link you, and technical issues across up to ${P.pages} pages. The free on-page check reads one page's title, meta description, main heading, canonical, indexing, structured data, share tags, phone viewport, image alt text and language. Neither needs an account or an email.`,
      },
    ],
    checked: "2026-10-15",
    sources: [
      {
        label: "Seobility: SEO competitor analysis tools",
        href: "https://www.seobility.net/en/seo-competitor-analysis-tools/",
      },
      { label: "Moz: Competitive Research", href: "https://moz.com/competitive-research" },
      { label: "ReachKit free on-page check", href: "/tools/on-page-check" },
      { label: "ReachKit vs Moz Competitive Research", href: "/compare/moz-competitive-research" },
      { label: "ReachKit vs Seobility Competitor Analysis", href: "/compare/seobility-competitor-analysis" },
    ],
  },
];
