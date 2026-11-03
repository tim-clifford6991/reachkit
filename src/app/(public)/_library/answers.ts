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
    answer:
      "A free SEO competitor analysis tool shows you, at no cost, which businesses Google puts above you, and for which searches. Every free tier of this kind has limits.",
    units: {
      title: "The limits come in three units",
      items: [
        ["How many competitors", "you may follow"],
        ["How many searches", "are reported for them"],
        ["How often", "the figures update"],
      ],
    },
    tiers: {
      title: "What each free tier gives you",
      lead: "Drawn to scale. A dashed bar means no number is given.",
      charts: [
        {
          title: "1 · Competitors you can follow",
          max: 20,
          rows: [
            { name: "Seobility Basic", terms: "free", limit: "3 competitors", amount: 3 },
            { name: "Moz Keyword Gap", terms: "part of Competitive Research", limit: "up to 3", amount: 3 },
            { name: "Seobility Premium", terms: "paid, 14-day trial", limit: "20 competitors", amount: 20 },
            {
              name: "ReachKit free scan",
              terms: "free, no account",
              limit: `the ones on Google's first page for ${P.searches} searches`,
              amount: null,
              ours: true,
            },
            { name: "ReachKit", terms: `${P.price} a month`, limit: `up to ${P.competitors}, every Monday`, amount: Number(P.competitors), ours: true },
          ],
        },
        {
          title: "2 and 3 · Searches reported, and how often",
          max: 300,
          rows: [
            { name: "Seobility Basic", terms: "free", limit: "10 searches · weekly", amount: 10 },
            { name: "Seobility Premium", terms: "paid", limit: "300 searches · daily", amount: 300 },
            { name: "Moz Pro Campaigns", terms: "free trial", limit: "weekly · count not stated", amount: null },
            { name: "ReachKit free scan", terms: "free, no account", limit: `${P.searches} searches · once`, amount: Number(P.searches), ours: true },
            {
              name: "ReachKit",
              terms: `${P.price} a month`,
              limit: `${P.searches} searches + ${P.prompts} AI questions · every Monday`,
              amount: Number(P.searches),
              ours: true,
            },
          ],
        },
      ],
      caption:
        "From each product's own pages, checked 15 October 2026. ReachKit's searches are the ones your buyers make, chosen for you.",
    },
    sections: [
      {
        heading: "What Seobility's free plan includes",
        chips: ["Basic: free", "3 competitors", "10 searches, weekly", "5 look-ups a day", "Premium: 20 · 300 · daily", "14-day trial"],
        paragraphs: [
          "Seobility calls its Basic plan free. It follows 3 competitors and shows where they appear on Google for 10 searches, updated weekly. It allows 5 look-ups a day in its Keyword Research Tool.",
        ],
      },
      {
        heading: "What Moz's free research includes",
        chips: ["Keyword Gap: up to 3", "Campaigns: up to 3, weekly", "True Competitor", "Free trial, no price stated"],
        paragraphs: [
          "True Competitor lists your competitors from the Google results where your site appears, with two measures called Overlap and Rivalry. Keyword Gap takes up to 3 competitors and finds searches where you are on Google's first two pages but a competitor sits higher, and searches where they appear and you do not.",
        ],
      },
    ],
    fits: {
      title: "Where ReachKit fits",
      lead: "ReachKit is not a tool for researching search terms. It shows who Google and AI pick instead of you, then writes the pages to change it, every week.",
      them: "A free competitor tool",
      rows: [
        ["Shows who sits above you on Google", "Shows who sits above you, and whether AI answers mention you"],
        ["Updates weekly or daily", "Checks Google and AI answers again every Monday"],
        ["You decide what to write, and write it", `Up to ${P.weekPages} pages a week go live on your website. Never filler.`],
      ],
      pickThem: {
        name: "Seobility or Moz",
        items: ["you need lists of search terms", "you need the sites that link to your competitors"],
      },
      pickUs: [
        "you want to see who gets your buyers on Google and in AI answers",
        "you want the pages written and live, not a list of things to do",
      ],
    },
    faq: [
      {
        q: "Is there a completely free SEO competitor analysis tool?",
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
        a: `In part. ReachKit's free scan checks ${P.searches} Google searches buyers in your market make and shows the competitors on the first page of them, with no account. It does not list their search terms or the sites that link to them. The paid plan, ${P.price} a month, follows up to ${P.competitors} competitors and checks them again every week.`,
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
