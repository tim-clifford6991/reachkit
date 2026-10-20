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
      "A free SEO competitor analysis tool shows you, at no cost, which businesses Google puts above you, and for which searches. Every free tier of this kind has limits.",
      "The limits come in three units: how many competitors you may follow, how many searches are reported for them, and how often the figures update. Seobility's free Basic plan follows 3 competitors and shows where they appear on Google for 10 searches, updated weekly. Moz lists Competitive Research among its free tools, and its Keyword Gap tool compares you with up to 3 competitors.",
    ],
    sections: [
      {
        heading: "What Seobility's free plan includes",
        paragraphs: [
          "Seobility calls its Basic plan free. It follows 3 competitors and shows where they appear on Google for 10 searches, updated weekly. It allows 5 look-ups a day in its Keyword Research Tool.",
          "The paid Premium plan follows 20 competitors and shows where they appear for 300 searches, updated daily, with 50 Keyword Research look-ups a day. It adds a list of the other sites that link to your competitors, updated weekly.",
          "Seobility offers a 14-day free trial of Premium and says you can cancel at any time. The competitor analysis page gives no prices.",
        ],
      },
      {
        heading: "What Moz's free research includes",
        paragraphs: [
          "Moz's page is titled 'Free SEO Competitive Analysis Tool' and invites you to enter any web address to see how Moz Pro helps with competitor analysis. Competitive Research sits in Moz's 'Free SEO Tools' menu with Domain Analysis, Keyword Explorer, Link Explorer and MozBar.",
          "True Competitor lists your competitors from the Google results where your site appears, with two measures called Overlap and Rivalry. Keyword Gap takes up to 3 competitors and finds searches where you are on Google's first two pages but a competitor sits higher, and searches where they appear and you do not.",
          "Moz Pro Campaigns follow up to 3 competitors side by side and show where they appear on Google each week. Domain Overview shows Domain Authority and Brand Authority. Moz says Keyword Explorer draws on more than 1.25 billion search terms and Link Explorer on more than 40 trillion links. The page offers a free trial of Moz Pro but states no price and no trial length.",
        ],
      },
      {
        heading: "Where ReachKit sits",
        paragraphs: [
          `ReachKit is not a tool for researching search terms. Its free scan reads your site, works out who your buyers are, and checks ${P.searches} searches they make. It names the competitors on Google's first page instead of you. It is free, takes about a minute, and needs no account.`,
          `The same scan checks whether AI answers mention or link your site, gives a Visibility Score from 0 to 100 with its range, and lists what's holding your site back across up to ${P.pages} pages, each with a free fix.`,
          `The paid plan, ${P.price} a month, follows up to ${P.competitors} competitors and checks them again every week. Its main job is different: it writes up to ${P.weekPages} pages a week, new or updated, and they go live on your website to win those searches back. Never filler.`,
          "ReachKit keeps no list of the sites that link to others and no database of search terms, and it checks where you appear only for your own searches. If you need lists of search terms, or of the sites that link to your competitors, Seobility or Moz is the better choice.",
        ],
      },
    ],
    faq: [
      {
        q: "Is there a completely free competitor analysis tool?",
        a: "Yes, with limits. Seobility's Basic plan is free and follows 3 competitors, showing where they appear on Google for 10 searches, updated weekly. Moz lists Competitive Research among its free tools and invites you to enter any web address. Each limits what the free tier returns.",
      },
      {
        q: "How many competitors can you follow for free?",
        a: "Seobility's free Basic plan follows 3 competitors. Moz's Keyword Gap tool takes up to 3, and Moz Pro Campaigns follow up to 3 side by side. Seobility's paid Premium plan raises its limit to 20.",
      },
      {
        q: "How often do free competitor figures update?",
        a: "Seobility's free Basic plan updates where competitors appear for 10 searches weekly; its Premium plan updates 300 searches daily. Moz Pro Campaigns show where the competitors you follow appear each week.",
      },
      {
        q: "Does ReachKit have a free competitor analysis tool?",
        a: `In part. ReachKit's free scan runs ${P.searches} Google searches buyers in your market make and names the competitors on the first page of them, with no account. It does not list their search terms or the sites that link to them. The paid plan, ${P.price} a month, follows up to ${P.competitors} competitors and checks them again every week.`,
      },
      {
        q: "What does ReachKit check for free?",
        a: `The free scan gives a Visibility Score (one number for how easy you are to find), the competitors that show up instead of you, whether AI answers mention or link you, and what's holding your site back across up to ${P.pages} pages. The free on-page check reads one page's title, the text Google shows under its link, main heading, main address, whether Google may list it, business details Google can read, link previews, phone layout, image descriptions and language. Neither needs an account or an email.`,
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
