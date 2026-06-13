import type { Teardown } from "./types";

/**
 * Sofa — App Store Discoverability Teardown
 *
 * Source data: lib/eval/fixtures/sofa.json (golden-set fixture)
 * Score band: 0–30 (rubric); assigned 22 (critical tier — 4.9-star rating
 * but listing leads with a media-type list rather than the 'one app instead
 * of five' emotional hook that reviewers consistently cite).
 */
const sofa: Teardown = {
  slug: "sofa",
  appName: "Sofa",
  title: "App Store Teardown: Sofa",
  platform: "ios",
  publishedAt: "2026-06-01",
  lastVerified: "2026-06-13",
  blurb:
    "4.9 stars on pure design quality — yet 'media tracker app' (4,400/mo) is completely absent from the listing. The 'replaced Letterboxd, Goodreads, and Trakt' story isn't told anywhere.",
  score: {
    total: 22,
    breakdown: {
      content: 21,
      outreach: 17,
      seo: 28,
    },
  },
  intro:
    "Sofa has a 4.9-star rating. It is frequently described by users as 'the most beautiful app on my phone'. Its reviews include lines like 'finally deleted Letterboxd, Goodreads, Trakt, and a podcast app — Sofa does everything better'. This is extraordinary social proof for an app that most people searching for a watchlist or media tracker will never encounter, because the listing doesn't use the words they're typing.",
  sections: [
    {
      heading: "What does Sofa offer that four separate apps currently provide?",
      body: [
        "Sofa is a cross-media downtime organiser: movies, TV shows, books, podcasts, albums, games, and apps — all in a single beautifully designed queue. The emotional job-to-be-done is replacing the fragmented ecosystem of Letterboxd, Goodreads, Trakt, and a podcast client with a single place to keep track of everything you want to enjoy.",
        "The dominant review theme is 'cross-media lists' (121 mentions) and 'design quality' (108 mentions). Users are not describing Sofa as a better version of any single-category app — they're describing it as the elimination of four apps in favour of one. The actual review sentiment: 'I was running four different apps for one habit: keeping track of things I want to enjoy. Sofa replaced all four.'",
        "Competitors don't compete on the same dimension. Letterboxd covers film only. Goodreads covers books only. Trakt covers TV and film only. None of them have Sofa's design quality. The cross-media niche is effectively uncontested, which makes the discoverability gap even more frustrating: Sofa owns the category and is invisible in it.",
      ],
    },
    {
      heading: "Who is most likely to discover and love Sofa?",
      body: [
        "The core audience is media-hobbyists: people who actively maintain queues across multiple formats and currently do so across multiple apps with varying levels of frustration. Apple-ecosystem enthusiasts who care about design quality are a secondary but highly vocal group — the 'most beautiful app on my phone' reviews come from this segment.",
        "There's a third audience that's even more immediately convertible: people who are currently dissatisfied with Goodreads or Letterboxd. 'Goodreads alternatives' generates 3,400 monthly searches, driven largely by frustration with Goodreads' ageing design and stale experience. 'Letterboxd alternative' generates 1,800 monthly searches from users who wish their film tracker covered other media. Neither search currently surfaces Sofa.",
        "The gift-recommendation dimension also matters: Sofa is visually striking enough that people screenshot it and send it to friends. It has strong word-of-mouth potential for this reason, but that potential is being left organic and untended.",
      ],
    },
    {
      heading: "Where is the search volume for a product like Sofa?",
      body: [
        "The primary App Store gap is 'media tracker app' (4,400/mo) and 'watchlist app' (3,200/mo). These describe Sofa's core use case and neither Letterboxd, Goodreads, nor Trakt ranks competitively for the cross-media version of these queries. Adding both to the keyword field would fill gaps that have been empty since launch.",
        "On web search, the comparison intent cluster is the highest-value opportunity: 'Goodreads alternatives' (3,400/mo), 'Letterboxd alternative' (1,800/mo), 'best app for tracking books and movies' (1,100/mo). Users searching these terms are actively unhappy with their current solution and are open to switching. Sofa should own this traffic and currently captures almost none of it.",
        "For earned media, MacStories (400k Apple-centric readers) runs quarterly best-designed iOS app roundups. Sofa's 4.9-star rating and minimalist aesthetic is the strongest design story in the cross-media tracking category. The Sweet Setup (DA 72) also covers Apple app categories and doesn't mention Sofa despite it being the most highly rated option.",
      ],
    },
    {
      heading: "What should Sofa do to improve its discoverability?",
      body: [
        "The listing's first line should change. 'Your personal downtime wishlist' is soft copy that fails to communicate the 'one app instead of five' story that reviewers are telling organically. The new opening should be: 'One beautifully designed home for everything you want to enjoy — movies, books, games, podcasts, and more.' This is the emotional hook, stated plainly.",
        "The App Store keyword field should include 'media tracker' and 'watchlist app'. Neither competitor dominates these cross-media variants. Estimated keyword field impact: 7,600 combined monthly searches with very low competition.",
        "A content piece written in the voice of a real Sofa user — 'Why I deleted Letterboxd, Goodreads and Trakt for one app' — would capture 'Goodreads alternatives' and 'Letterboxd alternative' traffic at conversion intent. This is the piece that makes people feel understood before they've even seen the app.",
        "MacStories is the highest-value outreach target: a single mention in a quarterly app roundup reaches 400k design-sensitive Apple users and adds a DA-78 backlink. The pitch writes itself: 'beautiful design, cross-media tracking, 4.9 stars, replaced four apps with one.'",
      ],
    },
  ],
  takeaways: [
    "Lead with 'one home for everything you want to enjoy' — the 'replaced four apps' narrative is the strongest conversion message and it's not in the listing.",
    "Add 'media tracker' (4,400/mo) and 'watchlist app' (3,200/mo) to the App Store keyword field — the cross-media search niche is completely uncontested.",
    "Write a 'Why I deleted Letterboxd and Goodreads' piece targeting comparison-intent traffic (5,200+ combined monthly searches at conversion stage).",
    "Pitch MacStories for their quarterly best-designed iOS apps roundup — 400k readers, natural fit, Sofa is the strongest story in its category.",
    "The Sweet Setup (DA 72) ranks for 'best media apps iPhone' and doesn't mention Sofa — a single outreach email to be included in a roundup is a winnable backlink.",
  ],
};

export default sofa;
