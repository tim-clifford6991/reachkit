import type { ResultsScreenProps } from "./results-screen";

/** Exact mockup demo data — used to verify the React conversion is 1:1. */
export const RESULTS_DEMO: ResultsScreenProps = {
  siteLabel: "bloom.io",
  score: 47,
  headline: "A 47 means real customers are searching — and landing on someone else.",
  intro:
    "is technically fine. The gap is discoverability: you're absent from the comparison and directory surfaces where your buyers actually decide.",
  pillars: [
    { label: "Content", value: 56, note: "thin top-funnel" },
    { label: "Outreach", value: 29, note: "biggest lever" },
    { label: "SEO", value: 54, note: "missing schema" },
  ],
  fixes: [
    { rank: 1, title: 'Publish 3 "bloom vs [rival]" comparison pages', why: "Captures high-intent buyers comparing you to Habitify & Streaks — queries you don't appear for today.", effort: "Deep", pillar: "Content", pred: 6 },
    { rank: 2, title: "Add FAQ + product schema to your pricing page", why: "Unlocks rich results and makes you eligible for AI answer citations. Pure code change.", effort: "$0 fix", pillar: "SEO", pred: 4 },
    { rank: 3, title: "Claim & optimize your G2 + Capterra listings", why: "High-authority directories you're completely absent from. Competitors rank here.", effort: "Quick", pillar: "Outreach", pred: 4 },
  ],
  lockedCount: 4,
  lockedWorth: 13,
  intendedTags: ["Goal-driven founders", "Productivity power users", "Busy professionals"],
  actualTags: ["Casual wellness seekers", "Habit beginners", "General consumers"],
  mirrorGap:
    "Your page reads like a casual wellness app — but your pricing and feature set are built for power users. That mismatch is why high-intent searchers click, skim, and bounce to a competitor that speaks their language.",
  gapRows: [
    { query: "habit tracker vs habitify", volume: "2,400", rank: "Not ranking", ranked: false, opp: "High" },
    { query: "best habit tracker 2026", volume: "8,100", rank: "#42", ranked: true, opp: "High" },
    { query: "free habit tracker template", volume: "3,300", rank: "Not ranking", ranked: false, opp: "High" },
    { query: "habit tracker for adhd", volume: "2,700", rank: "#51", ranked: true, opp: "High" },
  ],
  gapTotal: 34,
};
