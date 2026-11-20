// The landing above How it works: the hero's offer and count, the app picture
// and the walkthrough, then How it works, the plan and the articles (boards PubLanding and PubLandingPhone, version 37).
import type { CopyPartition } from "../registry.ts";

export const LANDING_COPY = Object.freeze({
  /** The why badge over the hero's title, and the title's catch words: a substring of `landing.headline`. */
  "landing.hero.why": ["Buyers Ask AI What to Use", { slots: {} }],
  "landing.headline.mark": ["Get Found", { slots: {} }],
  /** Every other public head's catch words, each a substring of its title key (DESIGN *Catch words*). */
  "how.headline.mark": ["Gets You Found", { slots: {} }],
  "pricing.title.mark": ["Everything Included", { slots: {} }],
  "about.title.mark": ["ReachKit", { slots: {} }],
  "compare.title.mark": ["ReachKit", { slots: {} }],
  "tools.title.mark": ["Free", { slots: {} }],
  "gallery.heading.mark": ["in the Open", { slots: {} }],
  /** The offer under the field, one tick line each. */
  "landing.hero.offer.free": ["Free scan and first page", { slots: {} }],
  "landing.hero.offer.price": ["{price} a month, cancel any time", { slots: { price: "text" } }],
  /** The count of sites scanned, drawn only from a stored count of 100 or more. */
  "landing.hero.proof.scanned": ["{count}+ sites scanned", { slots: { count: "text" } }],
  "landing.hero.proof.scanned.line": ["with the free scan", { slots: {} }],
  /** The logo band's label, drawn from 8 sites with a logo: what the logos are, never customers. */
  "landing.proof.label": ["{count}+ Sites Scanned", { slots: { count: "text" } }],
  "landing.proof.pause": ["Pause the logos", { slots: {} }],
  "landing.proof.play": ["Play the logos", { slots: {} }],
  /** The label over the six kinds of business: a list label, not a heading. */
  "landing.hero.kinds.label": ["Works for any business with a website", { slots: {} }],
  /** The walkthrough band, drawn only once the video file exists. */
  "landing.walkthrough.eyebrow": ["Walkthrough", { slots: {} }],
  "landing.walkthrough.heading": ["See ReachKit in 2 minutes", { slots: {} }],
  /** How it works: step 1's report header, step 2's days, step 3's Monday email (v36). */
  "landing.glance.more": ["+{more} more", { slots: { more: "text" } }],
  "landing.glance.free": ["Free report", { slots: {} }],
  "landing.inside.autopilot": ["Autopilot on", { slots: {} }],
  /** The hero's app picture: its figures are an example business's, never a forecast (SPEC §4). */
  "landing.inside.caption": ["Example: {business}’s Overview, a sample business. Its figures are not a forecast, and your numbers will differ.", { slots: { business: "text" } }],
  "landing.inside.research": ["Research", { slots: {} }],
  "landing.inside.new": ["New page", { slots: {} }],
  "landing.inside.done": ["Done", { slots: {} }],
  "landing.inside.tomorrow": ["Tomorrow", { slots: {} }],
  "landing.mail.title": ["The Monday email", { slots: {} }],
  "landing.mail.live": ["pages live", { slots: {} }],
  "landing.mail.planned": ["planned this week", { slots: {} }],
  "landing.mail.row": ["{day} · New page · live today, {time}", { slots: { day: "text", time: "text" } }],
  /** *What {price} a month gets you*: each card a title and one line, then the price band; its terms are the wording `landing.trust` shipped. */
  "landing.plan.pages": ["Up to {weekPages} Pages a Week", { slots: { weekPages: "text" } }],
  "landing.plan.pages.line": ["New or updated. Never filler.", { slots: {} }],
  "landing.plan.facts": ["Facts From Your Site", { slots: {} }],
  "landing.plan.facts.line": ["Every fact linked to its source. Up to {checks} checks before a page goes live.", { slots: { checks: "text" } }],
  "landing.plan.mail": ["An Email Every Monday", { slots: {} }],
  "landing.plan.mail.line": ["What went live and what’s next. In week 1, one for each page too.", { slots: {} }],
  "landing.plan.rivals": ["Up to {rivals} Competitors", { slots: { rivals: "text" } }],
  "landing.plan.rivals.line": ["Watched every week.", { slots: {} }],
  "landing.plan.site": ["Site Checks", { slots: {} }],
  "landing.plan.site.line": ["Your whole site checked for problems, with the fix for each.", { slots: {} }],
  "landing.plan.tracking": ["Google and ChatGPT Tracking", { slots: {} }],
  "landing.plan.tracking.line": ["Where your pages sit in Google, and which ones Google’s AI and ChatGPT link to.", { slots: {} }],
  "landing.plan.time": ["Your Part", { slots: {} }],
  "landing.plan.time.line": ["Answer a few questions and connect your site. That’s all.", { slots: {} }],
  "landing.plan.control": ["Edit or Stop Any Page", { slots: {} }],
  "landing.plan.control.line": ["Each page waits {hours} hours before it goes live. Edit it, stop it, or do nothing.", { slots: { hours: "text" } }],
  "landing.plan.one": ["One Plan, Everything in It", { slots: {} }],
  "landing.plan.terms": ["VAT included. Cancel any time.", { slots: {} }],
  /** The article band under the questions: one line under its heading, and each card's way in. */
  "landing.articles.sub": ["ReachKit wrote and published each article, the same way it works for you.", { slots: {} }],
  "landing.articles.read": ["Read", { slots: {} }],
  // The short Learn close (canvas v36): your part and the price, each with its label in bold.
  "library.close.part.label": ["Your part:", { slots: {} }],
  "library.close.part.do": ["answer a few questions and connect your site.", { slots: {} }],
  "library.close.price.lead": ["{price} a month.", { slots: { price: "text" } }],
  "library.close.price.rest": ["One plan. Cancel any time.", { slots: {} }],
}) satisfies CopyPartition;
