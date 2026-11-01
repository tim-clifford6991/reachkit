// The landing above How it works: the hero's offer and proof card, the story
// card and the walkthrough, then How it works and the plan (boards PubLanding and PubLandingPhone, version 36).
import type { CopyPartition } from "../registry.ts";

export const LANDING_COPY = Object.freeze({
  /** The offer under the field, one tick line each. */
  "landing.hero.offer.free": ["Free scan and first page", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.hero.offer.price": ["{price} a month, cancel any time", { slots: { price: "text" }, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  /** The proof card: each row is drawn only from a stored row. */
  /** The caller also passes `score`: writing `{score}` here and declaring the slot shows it again. */
  "landing.hero.proof.report": ["We run ReachKit on {domain}", { slots: { domain: "text" }, fixedBy: "owner 2026-11-01: our own report replaces the third-party example" }],
  "landing.hero.proof.report.open": ["See its free report", { slots: {}, fixedBy: "owner 2026-11-01: our own report replaces the third-party example" }],
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
  /** How it works: step 1's report header, step 2's days, step 3's Monday email (v36). */
  "landing.glance.free": ["Free report", { slots: {}, fixedBy: "board PubLanding v36 · owner 2026-11-01" }],
  "landing.inside.research": ["Research", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.inside.new": ["New page", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.inside.done": ["Done", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.inside.tomorrow": ["Tomorrow", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.mail.title": ["The Monday email", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.mail.live": ["pages live", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.mail.planned": ["planned this week", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.mail.row": ["{day} · New page · live today, {time}", { slots: { day: "text", time: "text" }, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  /** *What {price} a month gets you*: each card a title and one line, then the price band; its terms are the wording `landing.trust` shipped. */
  "landing.plan.pages": ["Up to {weekPages} pages a week", { slots: { weekPages: "text" }, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.pages.line": ["New or updated. Never filler.", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.facts": ["Facts from your site", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.facts.line": ["Every fact linked to its source. Up to {checks} checks before a page goes live.", { slots: { checks: "text" }, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.mail": ["An email every Monday", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.mail.line": ["What went live and what’s next. In week 1, one for each page too.", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.rivals": ["Up to {rivals} competitors", { slots: { rivals: "text" }, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.rivals.line": ["Watched every week.", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.site": ["Site checks", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.site.line": ["Your whole site checked for problems, with the fix for each.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.plan.tracking": ["Google and AI tracking", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.tracking.line": ["Where your pages sit in Google, and which ones AI answers link to.", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.time": ["{minutes} minutes, once", { slots: { minutes: "text" }, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.time.line": ["Answer a few questions and connect your site. That’s your part.", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.one": ["One plan, everything in it", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.terms": ["VAT included. Cancel any time.", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
}) satisfies CopyPartition;
