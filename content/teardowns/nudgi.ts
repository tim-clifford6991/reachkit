import type { Teardown } from "./types";

/**
 * Nudgi — Web Discoverability Teardown
 *
 * Source data: lib/eval/fixtures/nudgi.json (golden-set fixture)
 * Score band: 0–25 (rubric); assigned 19 (critical tier — early-stage SaaS,
 * 1-year domain, 187 PH upvotes but no SEO presence and homepage doesn't
 * address the habit-burnout audience it uniquely serves).
 */
const nudgi: Teardown = {
  slug: "nudgi",
  appName: "Nudgi",
  title: "Web Teardown: Nudgi",
  platform: "web",
  publishedAt: "2026-06-01",
  lastVerified: "2026-06-13",
  blurb:
    "Every competitor is targeting people who want to build habits. Nudgi is the only product that could credibly target people who've already quit every habit app they've tried — and the homepage doesn't mention it.",
  score: {
    total: 19,
    breakdown: {
      content: 18,
      outreach: 15,
      seo: 24,
    },
  },
  intro:
    "Nudgi is an early-stage SaaS product with a clearly defined positioning and an underserved audience. The no-guilt, gentle-nudge angle is genuine — it's reflected in the Product Hunt reviews and the early user feedback. The discoverability problem is not that the positioning is wrong. It's that the homepage is talking to the same generic 'I want to build better habits' audience that Habitica, Focusmate, and Done are fighting over. Nudgi has a different story to tell, to a different audience — and it isn't telling it.",
  sections: [
    {
      heading: "What does Nudgi do differently from every other habit app?",
      body: [
        "Nudgi sends gentle, well-timed reminders without the streak mechanics, gamification, or guilt loops that define most habit apps. The tagline — 'habit software without the shame cycle' — captures the product accurately. Set an intention once, receive a nudge at the right moment. No streak counter to break, no avatar to neglect, no daily check-in that makes you feel worse when you miss it.",
        "The Product Hunt reviews are the most revealing signal. 'I've tried Habitica, Streaks, and Done — all of them made me feel guilty. Nudgi is the first habit app I've actually stuck with.' This is the testimonial. The product isn't better at building habits in the same way as competitors. It's different because it doesn't make you feel bad when life gets in the way.",
        "Competitors have each staked out a specific position: Habitica uses gamification and avatar progression. Focusmate uses social accountability with scheduled video sessions. Done uses streaks and completion tracking. All three create anxiety when you fall off the wagon. Nudgi is the anti-anxiety option — and no competitor is occupying that position.",
      ],
    },
    {
      heading: "Who is Nudgi's most convertible audience?",
      body: [
        "Nudgi's ICP is not 'people who want to build habits'. That market is saturated and dominated by Habitica and Streaks. Nudgi's ICP is people who have already tried those apps and quit. Habit-app burnout is a real, named experience — and it's a much smaller but much more motivated audience.",
        "The specific profile: ADHD individuals for whom rigid habit systems create shame rather than momentum, knowledge workers who've experienced the productivity-guilt cycle firsthand, and Cal Newport / slow-productivity readers who've been persuaded that the hustle model doesn't work. These users are not looking for another version of the same thing. They're looking for permission to do it differently.",
        "187 Product Hunt upvotes with a 1-year-old domain suggests the positioning resonates with the early adopter layer. The challenge is reaching the next layer — people who are currently mid-failure on their Habitica streak and have just started searching for something better.",
      ],
    },
    {
      heading: "Where is Nudgi's potential audience searching?",
      body: [
        "Two web search clusters are immediately actionable. 'Habit reminder app' (5,400/mo) is a transactional query with moderate competition — Nudgi's 1-year domain can rank for this with a focused on-page optimisation of the features page. 'Gentle habit tracker' (1,600/mo) has very low competition and is essentially undefended. Neither Focusmate nor Habitica ranks for it because their positioning is the opposite of gentle.",
        "The second cluster is more emotionally loaded but higher-converting: 'why can't I stick to habits' (2,400/mo), 'habit app burnout' (1,200/mo), 'best habit app for ADHD' (1,800/mo). These are people mid-struggle, actively looking for a different approach. A well-written piece that names streak anxiety as the cause and Nudgi's gentle nudge model as the solution would capture these searchers at their highest-intent moment.",
        "For outreach, the anti-hustle and slow-productivity creator community is the highest-affinity channel: Cal Newport's Deep Questions podcast (200k downloads per episode), r/slatestarcodex, r/productivity threads about habit fatigue. None of Nudgi's competitors are present in these communities because their positioning — gamification and social accountability — is antithetical to the slow-productivity ethos.",
      ],
    },
    {
      heading: "What should Nudgi prioritise to improve its discoverability score?",
      body: [
        "The most important action is also the cheapest: rewriting the homepage hero to directly address the habit-burnout audience. 'Built for people who've quit every other habit app' is more specific, more empathetic, and more ownable than 'gentle reminders to help you build habits'. The current headline talks to everyone. The new one talks to the person who most needs Nudgi.",
        "For SEO, the /features page title tag should be optimised for 'habit reminder app' (5,400/mo) and 'gentle habit tracker' (1,600/mo). These are achievable for a 1-year domain with low competition. Adding appropriate H1/H2 language that naturally incorporates these terms is a half-day implementation.",
        "A long-form content piece targeting 'why you keep quitting habit apps' would serve double duty: SEO content capturing high-intent search traffic and a shareable asset for the slow-productivity community. People searching 'why can't I stick to habits' are pre-qualified Nudgi buyers — they just don't know the product exists yet.",
        "Product Hunt's 'Slow Productivity' collection (8,200 followers) and Indie Hackers' product directory are free distribution channels that match Nudgi's early-adopter audience. Listing in both is under 2 hours of work with a measurable expected impact on referral traffic.",
      ],
    },
  ],
  takeaways: [
    "Rewrite the homepage hero to 'Built for people who've quit every other habit app' — this is the ICP-specific hook that competitors cannot claim.",
    "Optimise the /features page for 'habit reminder app' (5,400/mo) and 'gentle habit tracker' (1,600/mo) — both are achievable for a 1-year domain.",
    "Write a piece targeting 'why you keep quitting habit apps' — the 2,400/mo search volume comes from pre-qualified buyers who are already mid-failure.",
    "Engage the slow-productivity community (Cal Newport readers, r/slatestarcodex) — no competitor is present there and Nudgi's positioning is a natural fit.",
    "List on Product Hunt's 'Slow Productivity' collection (8,200 followers) and Indie Hackers directory — both are free and reach exactly the right early-adopter audience.",
  ],
};

export default nudgi;
