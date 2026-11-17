// The landing above How it works: the hero's offer and count, the story card
// and the walkthrough, then How it works, the plan and the articles (boards PubLanding and PubLandingPhone, version 37).
import type { CopyPartition } from "../registry.ts";

export const LANDING_COPY = Object.freeze({
  /** The why badge over the hero's title, and the title's catch words: a substring of `landing.headline`. */
  "landing.hero.why": ["Buyers Ask AI What to Use", { slots: {}, fixedBy: "owner 2026-11-16 · issue 2745" }],
  "landing.headline.mark": ["Get Found", { slots: {}, fixedBy: "owner 2026-11-16 · issue 2745" }],
  /** Every other public head's catch words, each a substring of its title key (DESIGN *Catch words*). */
  "how.headline.mark": ["Gets You Found", { slots: {}, fixedBy: "owner 2026-11-16 · issue 2745" }],
  "pricing.title.mark": ["Everything Included", { slots: {}, fixedBy: "owner 2026-11-16 · issue 2745" }],
  "about.title.mark": ["ReachKit", { slots: {}, fixedBy: "owner 2026-11-16 · issue 2745" }],
  "compare.title.mark": ["ReachKit", { slots: {}, fixedBy: "owner 2026-11-16 · issue 2745" }],
  "tools.title.mark": ["Free", { slots: {}, fixedBy: "owner 2026-11-16 · issue 2745" }],
  "gallery.heading.mark": ["in the Open", { slots: {}, fixedBy: "owner 2026-11-16 · issue 2745" }],
  /** The offer under the field, one tick line each. */
  "landing.hero.offer.free": ["Free scan and first page", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.hero.offer.price": ["{price} a month, cancel any time", { slots: { price: "text" }, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  /** The count of sites scanned, drawn only from a stored count of 100 or more. */
  "landing.hero.proof.scanned": ["{count}+ sites scanned", { slots: { count: "text" }, fixedBy: "board PubLanding v36 · owner 2026-11-01, issue 2249" }],
  "landing.hero.proof.scanned.line": ["with the free scan", { slots: {}, fixedBy: "board PubLanding v36 · owner 2026-11-01, issue 2249" }],
  /** The logo band's label, drawn from 8 sites with a logo: what the logos are, never customers. */
  "landing.proof.label": ["{count}+ Sites Scanned With the Free Scan", { slots: { count: "text" }, fixedBy: "owner 2026-11-16 · issue 2745" }],
  "landing.proof.pause": ["Pause the logos", { slots: {}, fixedBy: "issue 2754 · drafted" }],
  "landing.proof.play": ["Play the logos", { slots: {}, fixedBy: "issue 2754 · drafted" }],
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
  "landing.story.engine.ai": ["AI answers", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
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
  "landing.plan.pages": ["Up to {weekPages} Pages a Week", { slots: { weekPages: "text" }, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.pages.line": ["New or updated. Never filler.", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.facts": ["Facts From Your Site", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.facts.line": ["Every fact linked to its source. Up to {checks} checks before a page goes live.", { slots: { checks: "text" }, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.mail": ["An Email Every Monday", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.mail.line": ["What went live and what’s next. In week 1, one for each page too.", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.rivals": ["Up to {rivals} Competitors", { slots: { rivals: "text" }, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.rivals.line": ["Watched every week.", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.site": ["Site Checks", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.site.line": ["Your whole site checked for problems, with the fix for each.", { slots: {}, fixedBy: "board Landing · issue 1596" }],
  "landing.plan.tracking": ["Google and ChatGPT Tracking", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.tracking.line": ["Where your pages sit in Google, and which ones Google’s AI and ChatGPT link to.", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.time": ["Your Part", { slots: {}, fixedBy: "owner 2026-11-13 · issue 2656" }],
  "landing.plan.time.line": ["Answer a few questions and connect your site. That’s all.", { slots: {}, fixedBy: "owner 2026-11-13 · issue 2656" }],
  "landing.plan.control": ["Edit or Stop Any Page", { slots: {}, fixedBy: "board PubLanding v37 · owner 2026-11-06" }],
  "landing.plan.control.line": ["Each page waits {hours} hours before it goes live. Edit it, stop it, or do nothing.", { slots: { hours: "text" }, fixedBy: "board PubLanding v37 · owner 2026-11-06" }],
  "landing.plan.one": ["One Plan, Everything in It", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  "landing.plan.terms": ["VAT included. Cancel any time.", { slots: {}, fixedBy: "board PubLanding v34 · owner 2026-11-01" }],
  /** The article band under the questions: one line under its heading, and each card's way in. */
  "landing.articles.sub": ["ReachKit wrote and published each article, the same way it works for you.", { slots: {}, fixedBy: "board PubLanding v37 · owner 2026-11-06" }],
  "landing.articles.read": ["Read", { slots: {}, fixedBy: "board PubLanding v37 · owner 2026-11-06" }],
  // The short Learn close (canvas v36): your part and the price, each with its label in bold.
  "library.close.part.label": ["Your part:", { slots: {}, fixedBy: "board PubScans v36 · issue 2269" }],
  "library.close.part.do": ["answer a few questions and connect your site.", { slots: {}, fixedBy: "owner 2026-11-13 · issue 2656" }],
  "library.close.price.lead": ["{price} a month.", { slots: { price: "text" }, fixedBy: "board PubScans v36 · issue 2269" }],
  "library.close.price.rest": ["One plan. Cancel any time.", { slots: {}, fixedBy: "board PubScans v36 · issue 2269" }],
}) satisfies CopyPartition;
