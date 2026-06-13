import type { Teardown } from "./types";

/**
 * Opal — App Store Discoverability Teardown
 *
 * Source data: lib/eval/fixtures/opal.json (golden-set fixture)
 * Score band: 0–30 (rubric); assigned 27 (critical tier — strong product,
 * positioning doesn't name its single strongest differentiator).
 */
const opal: Teardown = {
  slug: "opal",
  appName: "Opal",
  title: "App Store Teardown: Opal",
  platform: "ios",
  publishedAt: "2026-06-01",
  lastVerified: "2026-06-13",
  blurb:
    "Opal's hard-block mechanism is the best focus-app story in the market. The listing doesn't mention it once.",
  score: {
    total: 27,
    breakdown: {
      content: 25,
      outreach: 21,
      seo: 34,
    },
  },
  intro:
    "Opal is the #1 screen time app for focus — or so says the listing. 4,200 reviews at 4.5 stars suggest the product is genuinely solving something. But there's a gap between what Opal does (locks you out without override) and what the listing communicates ('block distracting apps'). That gap is exactly what Freedom, Forest, and One Sec are quietly exploiting by ranking for the queries Opal should own.",
  sections: [
    {
      heading: "What does Opal offer that competitors don't?",
      body: [
        "Opal is the only mainstream focus app with a hard block — a mechanism that prevents you from disabling the block mid-session. There's no 'disable for 5 minutes' button. No override. Once you've started a focus session, the only way out is to wait.",
        "This is the feature reviewers cite almost universally. 'Unlike Screen Time you can't just disable it when you're weak — that's the whole point.' Across 4,200 reviews, themes of 'app blocking' (167 mentions), 'phone addiction' (112), and 'deep work' (89) dominate. The hard-block mechanism is the product.",
        "Freedom blocks apps but permits a manual override. Forest gamifies with tree-growing. One Sec introduces a friction delay. All three are softer versions of the same idea. Only Opal has removed willpower from the equation entirely — but you wouldn't know it from the App Store listing.",
      ],
    },
    {
      heading: "Who is the highest-intent Opal buyer?",
      body: [
        "Opal's core audience has tried gentler focus tools and failed. Knowledge workers who've tried Freedom and overridden their own blocks. Students who set Screen Time limits and immediately disabled them. Remote workers who recognise, in the cold light of day, that they need something they physically cannot reverse in a weak moment.",
        "The positioning mirror here is unusually clear: the people leaving 5-star reviews are not people who wanted a gentle reminder. They wanted a system that removed the decision entirely. 'I stopped doom-scrolling because I literally couldn't start' is the user story. The ICP is people who've already proved they can't trust themselves with a softer app.",
        "This audience is actively comparing tools. 'Freedom vs Opal' generates approximately 900 monthly searches. 'Screen time app comparison' has meaningful volume. These are buyers, not browsers — and Opal isn't capturing them because there's no comparison content on the site.",
      ],
    },
    {
      heading: "Where do Opal's potential users come from?",
      body: [
        "Three channels dominate: App Store search, productivity YouTube, and r/nosurf.",
        "On the App Store, 'app blocker for iPhone' has 8,100 monthly searches. Opal does not rank for it despite being the strongest product in the category. Forest and Freedom both rank higher for this term — despite having weaker hard-block capabilities — because their listings use the word 'blocker' more explicitly. The keyword field fix is 15 minutes of work.",
        "On YouTube, Matt D'Avella (4.8M subscribers) covers phone addiction. Thomas Frank's focus setup video has 320k views. The hard-block story — 'an app you literally can't override' — is a stronger video hook than any gamification story. No competitor is pitching this angle to this audience. Opal has a window.",
        "On Reddit, r/nosurf is the natural home. It's a community built around wanting less phone usage — and Opal is the most honest answer to what that community is describing.",
      ],
    },
    {
      heading: "What should Opal do next to improve its discoverability score?",
      body: [
        "The highest-leverage action is the App Store subtitle. 'Hard-block distractions — focus without willpower' communicates the actual differentiator, incorporates 'focus' naturally, and directly addresses the competitor comparison moment. The current subtitle 'Block distracting apps' loses the buyer who's deciding between Freedom and Opal.",
        "The keyword field should add 'app blocker for iPhone' (8,100/mo) and 'focus timer' (5,400/mo). These are the most-searched queries in the category and Opal's keyword field currently wastes characters on generic terms already covered by the Productivity category tag.",
        "A comparison article — 'Opal vs Freedom vs Screen Time: which actually works?' — targets 'freedom vs opal' and related comparison queries with exactly the right message at the right moment in the buyer journey. Users searching these terms have already decided to buy a focus app; they're choosing between options.",
        "AlternativeTo pages for Freedom and Screen Time collectively attract 18k+ monthly visitors. A listing captures them at peak comparison intent and adds a DA-70 backlink.",
      ],
    },
  ],
  takeaways: [
    "Name the hard-block mechanism in the subtitle — 'focus without willpower' is more specific and more ownable than any competitor's positioning.",
    "Add 'app blocker for iPhone' (8,100/mo) to the keyword field — this is Opal's highest-volume winnable query and it's not in the listing.",
    "Write a comparison article for 'Opal vs Freedom vs Screen Time' — buyers at this stage are already committed to purchasing a focus app.",
    "Pitch productivity YouTubers (Matt D'Avella, Thomas Frank) with the 'you can't override it' hook — it's more visual and more distinctive than any competitor story.",
    "List Opal on AlternativeTo as an alternative to Freedom and Screen Time — 18k monthly comparison-intent visitors at DA 70.",
  ],
};

export default opal;
