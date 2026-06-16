/**
 * Execution layer (M5) — coach checklists (PURE/static).
 *
 * Hacker News, Product Hunt, Discord, and Indie Hackers have NO safe automation
 * path (no write API, or posting is explicitly banned), so for these we coach the
 * human instead of offering a post button. The single fastest way to get banned
 * on all of them is soliciting upvotes / low-effort self-promo — the checklists
 * lead with that.
 */

import type { CoachPlatform } from "./intent";

export interface CoachGuide {
  label: string;
  intro: string;
  steps: string[];
}

export const COACH_GUIDES: Record<CoachPlatform, CoachGuide> = {
  hackernews: {
    label: "Hacker News",
    intro: "Show HN works — but HN punishes self-promo and vote-soliciting hard.",
    steps: [
      "Use an account that's 2+ weeks old with some karma before you post.",
      "Only 'Show HN:' something people can actually try right now.",
      "NEVER ask anyone to upvote — off-site vote rings are the cardinal sin.",
      "Post a weekday morning (US time) and reply to every comment.",
      "Lead with what it does, not why it's great.",
    ],
  },
  producthunt: {
    label: "Product Hunt",
    intro: "Engagement wins; gaming votes gets you pulled from the homepage.",
    steps: [
      "Never gate anything behind an upvote, and never buy/exchange votes.",
      "Launch at 12:01am PT to get a full day on the board.",
      "Line up genuine supporters who'll leave real comments.",
      "Be in the comments all day answering questions.",
    ],
  },
  discord: {
    label: "Discord communities",
    intro: "Cold DMs and link-drops get you removed; contribute first.",
    steps: [
      "Only post in the designated #self-promo / #showcase channel.",
      "Be helpful in the community for a while before you promote.",
      "Never cold-DM members about your product.",
      "One post, not a cross-channel blast.",
    ],
  },
  indiehackers: {
    label: "Indie Hackers",
    intro: "Share the journey; purely-promotional accounts get removed.",
    steps: [
      "Post a genuine learning/story — the product as context, not a pitch.",
      "Contribute to others' posts before promoting your own.",
      "One account per person; build a real history.",
    ],
  },
};
