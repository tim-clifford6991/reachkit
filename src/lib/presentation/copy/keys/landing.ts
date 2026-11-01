// The landing above How it works: the hero's offer and proof card, the story
// card and the walkthrough (boards PubLanding and PubLandingPhone, version 36).
import type { CopyPartition } from "../registry.ts";

export const LANDING_COPY = Object.freeze({
  /** The offer under the field, one tick line each. */
  "landing.hero.offer.free": ["Free scan and first page", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.hero.offer.price": ["{price} a month, cancel any time", { slots: { price: "text" }, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  /** The proof card: each row is drawn only from a stored row. */
  "landing.hero.proof.report": ["{domain} scores {score}", { slots: { domain: "text", score: "text" }, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.hero.proof.report.open": ["See its real free report", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.hero.proof.blog": ["Our blog is written by ReachKit", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.hero.proof.blog.open": ["Read the articles", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.hero.proof.scanned": ["{count}+ sites scanned", { slots: { count: "text" }, fixedBy: "board PubLanding v36 · owner 2026-11-01, issue 2249" }],
  "landing.hero.proof.scanned.line": ["with the free scan", { slots: {}, fixedBy: "board PubLanding v36 · owner 2026-11-01, issue 2249" }],
  /** The label over the six kinds of business: a list label, not a heading. */
  "landing.hero.kinds.label": ["Works for any business with a website", { slots: {}, fixedBy: "board PubLanding v36 · owner 2026-11-01" }],
  /** The hero's story card: four frames, one example business, as few words as possible (owner O3). */
  "landing.story.title": ["How ReachKit works for you", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.story.autopilot": ["Autopilot on", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.story.1.title": ["Competitors get found", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.story.1.when": ["Before", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.story.2.title": ["We research", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.story.2.when": ["Every Monday", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.story.3.title": ["We write pages", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.story.3.when": ["Checked, then live", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.story.4.title": ["You get found", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.story.4.when": ["After", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.story.engine.google": ["Google", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.story.engine.ai": ["AI", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.story.you": ["You", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.story.2.you": ["You", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.story.2.competitors": ["Competitors", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.story.2.google": ["Google", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.story.2.ai": ["AI answers", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.story.2.more": ["+{more} more", { slots: { more: "text" }, fixedBy: "board Landing · issue 1726 · drafted" }],
  "landing.story.3.week": ["This week", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.story.3.count": ["{n} of {total}", { slots: { n: "text", total: "text" }, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.story.3.live": ["Live", { slots: {}, fixedBy: "board PubLanding · owner O3 · 2026-10-31" }],
  "landing.story.3.next": ["Tomorrow", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.story.3.planned": ["Planned", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  /** The walkthrough band, drawn only once the video file exists. */
  "landing.walkthrough.eyebrow": ["Walkthrough", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.walkthrough.heading": ["See ReachKit in 2 minutes", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
}) satisfies CopyPartition;
