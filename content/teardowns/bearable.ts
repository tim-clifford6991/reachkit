import type { Teardown } from "./types";

/**
 * Bearable — App Store Discoverability Teardown
 *
 * Source data: lib/eval/fixtures/bearable.json (golden-set fixture)
 * Score band: 0–30 (rubric); assigned 24 (critical tier, realistic for
 * an app whose listing subtitle misses its own core value prop).
 */
const bearable: Teardown = {
  slug: "bearable",
  appName: "Bearable",
  title: "App Store Teardown: Bearable",
  platform: "ios",
  publishedAt: "2026-06-01",
  lastVerified: "2026-06-13",
  blurb:
    "The correlation engine is buried. 'Most flexible' is invisible in search. Three changes could shift the score by 20+ points.",
  score: {
    total: 24,
    breakdown: {
      content: 22,
      outreach: 18,
      seo: 31,
    },
  },
  intro:
    "Bearable is a genuinely excellent symptom-tracking app with a 4.7-star rating and 2,800 reviews. The App Store listing, however, is doing almost none of the work of getting it found. The headline sells flexibility. The users care about one thing: finding out what triggers their symptoms. That gap — between what the listing says and what users actually value — is costing installs every day.",
  sections: [
    {
      heading: "What does Bearable actually offer its users?",
      body: [
        "Bearable lets you log symptoms, mood, energy, sleep, medications, and more than 80 other factors — then surfaces statistical correlations between them. The correlation engine is the product. Everything else is scaffolding.",
        "The most-cited theme across 2,800 reviews is 'symptom correlation' (142 mentions), followed by 'factor tracking' (98) and 'energy levels' (87). Users are not downloading Bearable because it's 'flexible'. They're downloading it because they've spent years trying to figure out whether it's stress, diet, or sleep that's driving their flare-ups — and Bearable is the first tool that gives them an answer.",
        "The current listing description does mention correlation, but only in the second sentence. The subtitle — 'most flexible health and symptom tracker' — uses the word 'flexible' which is generic, unmemorable, and not a query anyone types into the App Store.",
      ],
    },
    {
      heading: "Who is Bearable's highest-intent user?",
      body: [
        "Bearable's core audience is people managing chronic conditions: fibromyalgia, ME/CFS, lupus, IBS, and similar illnesses where identifying triggers is the single most valuable health action they can take.",
        "The ICP signals from the fixture are precise: chronic illness self-managers tracking triggers, medication adherence trackers, health-data exporters who share logs with doctors. These users are not casual wellness-app browsers — they have high intent, high motivation to retain, and no great alternatives. Cara Care covers digestive conditions only. Symple does symptom tracking but without correlation. Medisafe is medication-only.",
        "The keyword 'chronic illness tracker' sees 2,400 monthly searches and is uncontested by direct competitors. It does not appear in Bearable's listing title or subtitle. That's a winnable position being left empty.",
      ],
    },
    {
      heading: "Where are Bearable's potential users searching?",
      body: [
        "Three surfaces dominate: the App Store search bar, Reddit communities, and YouTube app-review content.",
        "On the App Store, 'symptom tracker' (6,600/mo) is the primary transactional query. Bearable ranks for it but the subtitle doesn't reinforce it. 'Chronic illness tracker' (2,400/mo) and 'health diary app' (1,800/mo) are both absent from the keyword field. These are winnable with a single 15-minute metadata update.",
        "On Reddit, r/ChronicIllness (340k members) has an active 'what app do you use to track symptoms?' thread pattern. The correlation feature is the exact answer to the question being asked. Nobody from Bearable is in those threads. On YouTube, chronic illness app comparison videos average 48k views — Bearable appears in some but is rarely the featured subject.",
      ],
    },
    {
      heading: "What should Bearable do to improve its discoverability score?",
      body: [
        "The highest-leverage action is rewriting the App Store subtitle to lead with the correlation engine. 'Find what triggers your symptoms' is a direct answer to the question the chronic illness audience is actually asking. It incorporates a high-intent keyword ('symptom tracker') naturally and clearly differentiates from every competitor.",
        "The second action is the keyword field: adding 'chronic illness tracker' and 'health diary app' to the 100-character keyword field costs nothing and fills two gaps that have been empty since launch. Expected score impact: 8–9 points on the SEO sub-score.",
        "The third action is a content piece targeting 'how to track symptoms' (1,900/mo, low competition). A guide published on the Bearable website would capture health-curious users before they reach the App Store — and it's the kind of content that r/ChronicIllness and r/Fibromyalgia communities actively link to and share.",
        "For outreach, r/ChronicIllness (340k members) is the single highest-leverage community. Posting with a discussion angle — 'what methods do you use to identify your triggers?' — is honest, on-brand, and will drive organic App Store installs without violating community rules.",
      ],
    },
  ],
  takeaways: [
    "Rewrite the subtitle from 'most flexible' to 'Find what triggers your symptoms' — this is the real value prop and the most-searched intent.",
    "Add 'chronic illness tracker' and 'health diary app' to the App Store keyword field: 4,200 combined monthly searches, both uncontested.",
    "Publish a symptom-tracking guide on the website targeting 'how to track symptoms' (1,900/mo) — this surfaces Bearable before competitors reach the App Store.",
    "Engage r/ChronicIllness (340k members) with a discussion thread; correlation tracking is the answer to the most-asked question in that community.",
    "Capterra and G2 listings rank on page 1 for 'symptom tracking software' — a free listing captures comparison-stage buyers and adds DA 80+ backlinks.",
  ],
};

export default bearable;
