// The landing above How it works: the hero's offer and count, the app picture
// and the walkthrough, then How it works, the plan and the articles (boards PubLanding and PubLandingPhone, version 37).
import type { CopyPartition } from "../registry.ts";

export const LANDING_COPY = Object.freeze({
  /** The why badge over the hero's title, and the title's catch words: a substring of `landing.headline`. */
  "landing.hero.why": "Buyers Ask AI What to Use",
  "landing.headline.mark": "Get Found",
  /** Every other public head's catch words, each a substring of its title key (DESIGN *Catch words*). */
  "how.headline.mark": "Gets You Found",
  "pricing.title.mark": "Everything Included",
  "about.title.mark": "ReachKit",
  "compare.title.mark": "ReachKit",
  "tools.title.mark": "Free",
  "gallery.heading.mark": "in the Open",
  /** The offer under the field, one tick line each. */
  "landing.hero.offer.free": "Free scan and first page",
  "landing.hero.offer.price": "Then up to {weekPages} pages a week, {price} a month",
  /** The count of sites scanned, drawn only from a stored count of 100 or more. */
  "landing.hero.proof.scanned": "{count}+ sites scanned",
  "landing.hero.proof.scanned.line": "with the free scan",
  /** The logo band's label, drawn from 8 sites with a logo: what the logos are, never customers. */
  "landing.proof.label": "{count}+ Sites Scanned",
  "landing.proof.pause": "Pause the logos",
  "landing.proof.play": "Play the logos",
  /** The label over the six kinds of business: a list label, not a heading. */
  "landing.hero.kinds.label": "Works for any business with a website",
  /** The walkthrough band, drawn only once the video file exists. */
  "landing.walkthrough.eyebrow": "Walkthrough",
  "landing.walkthrough.heading": "See ReachKit in 2 Minutes",
  /** How it works: step 1's report header, step 2's days, step 3's Monday email (v36). */
  "landing.glance.more": "+{more} more",
  "landing.glance.free": "Free report",
  "landing.inside.autopilot": "Autopilot on",
  /** The hero's app picture: its figures are an example business's, never a forecast (SPEC §4). */
  "landing.inside.caption": "Example: {business}’s Overview, a sample business. Its figures are not a forecast, and your numbers will differ.",
  "landing.inside.research": "Research",
  "landing.inside.new": "New page",
  "landing.inside.done": "Done",
  "landing.inside.tomorrow": "Tomorrow",
  "landing.mail.title": "The Monday email",
  "landing.mail.live": "pages live",
  "landing.mail.planned": "planned this week",
  "landing.mail.row": "{day} · New page · live today, {time}",
  /** *What {price} a month gets you*: each card a title and one line, then the price band; its terms are the wording `landing.trust` shipped. */
  "landing.plan.pages": "Up to {weekPages} Pages a Week",
  "landing.plan.pages.line": "New or updated. Never filler.",
  "landing.plan.facts": "Facts From Your Site",
  "landing.plan.facts.line": "Every fact linked to its source. Up to {checks} checks before a page goes live.",
  "landing.plan.mail": "An Email Every Monday",
  "landing.plan.mail.line": "What went live and what’s next. In week 1, one for each page too.",
  "landing.plan.rivals": "Up to {rivals} Competitors",
  "landing.plan.rivals.line": "Watched every week.",
  "landing.plan.site": "Site Checks",
  "landing.plan.site.line": "Your whole site checked for problems, with the fix for each.",
  "landing.plan.tracking": "Google and ChatGPT Tracking",
  "landing.plan.tracking.line": "Where your pages sit in Google, and which ones Google’s AI and ChatGPT link to.",
  "landing.plan.time": "Your Part",
  "landing.plan.time.line": "Answer a few questions and connect your site. That’s all.",
  "landing.plan.control": "Edit or Stop Any Page",
  "landing.plan.control.line": "Each page waits {hours} hours before it goes live. Edit it, stop it, or do nothing.",
  "landing.plan.one": "One Plan, Everything in It",
  "landing.plan.terms": "Cancel any time.",
  /** The article band under the questions: one line under its heading, and each card's way in. */
  "landing.articles.sub": "ReachKit wrote and published each article, the same way it works for you.",
  "landing.articles.read": "Read",
  // The short Learn close (canvas v36): your part and the price, each with its label in bold.
  "library.close.part.label": "Your part:",
  "library.close.part.do": "answer a few questions and connect your site.",
  "library.close.price.lead": "{price} a month.",
  "library.close.price.rest": "One plan. Cancel any time.",
}) satisfies CopyPartition;
