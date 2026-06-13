import type { Teardown } from "./types";

/**
 * CardPointers — App Store Discoverability Teardown
 *
 * Source data: lib/eval/fixtures/cardpointers.json (golden-set fixture)
 * Score band: 0–30 (rubric); assigned 26 (critical tier — highest review
 * volume and rating of the five but the per-merchant recommendation story
 * is completely absent from the listing).
 */
const cardpointers: Teardown = {
  slug: "cardpointers",
  appName: "CardPointers",
  title: "App Store Teardown: CardPointers",
  platform: "ios",
  publishedAt: "2026-06-01",
  lastVerified: "2026-06-13",
  blurb:
    "4.8 stars, 3,100 reviews — and the listing's key differentiator ('which card to swipe right now') is mentioned nowhere in the subtitle or screenshots.",
  score: {
    total: 26,
    breakdown: {
      content: 24,
      outreach: 22,
      seo: 32,
    },
  },
  intro:
    "CardPointers is the highest-rated app in this teardown series: 4.8 stars across 3,100 reviews in a category where even good apps struggle to crack 4.5. The product clearly works. The problem is what the listing is selling — 'maximize credit card rewards' — when the thing users actually love is something far more specific: an app that tells you, at the register, exactly which card to pull out of your wallet.",
  sections: [
    {
      heading: "What is CardPointers' real differentiator?",
      body: [
        "CardPointers' core value proposition is per-merchant card recommendation at the point of purchase. You open the app before checking out at a grocery store, coffee shop, or gas station, and it tells you which of your cards earns the highest multiplier at that specific merchant. That's the feature.",
        "Across 3,100 reviews, the dominant theme is 'card recommendations' (187 mentions), 'points maximization' (154), and 'bonus category tracking' (131). The representative review is: 'I literally open CardPointers at the register — it tells me my Amex gets 5x at this grocery chain.' AwardWallet tracks balances. MaxRewards sends offer alerts. Neither product does what CardPointers does: tell you exactly which card to swipe, right now, at this merchant.",
        "The listing currently says 'Get personalized card recommendations for every purchase, track your points, and find the best card for every merchant.' That's accurate but buried in the third position in a paragraph that opens with 'maximize credit card rewards and earn more points and miles' — a generic claim every competitor makes equally.",
      ],
    },
    {
      heading: "Who is the CardPointers power user?",
      body: [
        "CardPointers' ICP is the active credit card optimizer: someone with 3+ cards who feels genuine frustration when they realise they've been swiping the wrong one. The r/churning community (points-and-miles maximizers) has organically adopted CardPointers — members recommend it in app review threads unprompted.",
        "There are two distinct audiences. The first is the advanced churner tracking welcome bonuses, category multipliers, and transfer partners across 6–8 cards. The second is the more casual 'I have three good cards and I don't know which one to use where' user — a much larger market that's harder to reach but deeply qualified once it discovers the app.",
        "Both audiences search differently. The advanced churner goes to r/churning first. The casual optimizer types 'best credit card at grocery stores' or 'which card to use for groceries' into Google or the App Store. CardPointers has room to own both channels and currently owns neither at the discovery layer.",
      ],
    },
    {
      heading: "Where are CardPointers' potential users searching?",
      body: [
        "The App Store keyword opportunity is significant. 'Credit card rewards optimizer' (3,600/mo) and 'points maximizer' (1,800/mo) match CardPointers' use case precisely and neither AwardWallet nor MaxRewards occupies these terms. The keyword field currently misses both.",
        "On web search, long-tail merchant queries collectively represent 15k+ monthly searches: 'best credit card for groceries' (2,900/mo), 'best credit card at Costco' (2,100/mo), 'which card to use for gas' (1,600/mo), and so on. These are fragmented across generic personal finance blogs. A definitive, regularly updated guide from CardPointers would own the niche — the app has the data to do it authoritatively.",
        "For earned media, The Points Guy YouTube (280k subscribers) reviews credit card tools and their videos average 150k views. The per-merchant recommendation is uniquely visual and demo-friendly — watching the multiplier math unfold in real-time is more compelling than any static screenshot. No competitor is pitching this angle. NerdWallet ranks #1 for 'best credit card rewards app' (12k/mo searches) and CardPointers is not in their roundup.",
      ],
    },
    {
      heading: "What should CardPointers do to raise its discoverability score?",
      body: [
        "The highest-leverage single action is updating the App Store subtitle or first screenshot caption to anchor on 'Know which card to swipe before you check out.' This is the moment that converts — it's specific, it's visual, and it's something no competitor can claim. The current subtitle 'Maximize credit card rewards' is indistinguishable from AwardWallet's positioning.",
        "The keyword field should include 'credit card rewards optimizer' and 'points maximizer'. Neither competitor occupies these terms in the App Store. Combined monthly search volume: 5,400. Estimated effort: 15 minutes.",
        "A merchant guide — 'Which credit card to use at every major store in 2026' — is a long-term content asset that drives organic traffic and positions CardPointers as the authoritative source. It's also linkworthy: r/churning and r/creditcards will share it because it answers the question that comes up in those communities every week.",
        "Seeking a NerdWallet mention for 'best credit card rewards app' is the highest-DA SEO opportunity available: 12k monthly searches, page 1 occupied by NerdWallet, CardPointers not listed.",
      ],
    },
  ],
  takeaways: [
    "Anchor the listing on 'which card to swipe right now' — the per-merchant recommendation is the actual differentiator and every competitor's listing is indistinguishable without it.",
    "Add 'credit card rewards optimizer' (3,600/mo) and 'points maximizer' (1,800/mo) to the keyword field — both uncontested by direct competitors.",
    "Publish a merchant-category card guide — 'best credit card at [merchant]' queries collectively drive 15k+ monthly searches and no authoritative source exists.",
    "Pitch The Points Guy YouTube with a live demo of the per-merchant recommendation — it's the most demo-friendly product story in the category.",
    "Submit to NerdWallet's 'best credit card rewards apps' roundup — 12k monthly searches, page 1 uncontested by CardPointers despite it being the strongest product.",
  ],
};

export default cardpointers;
