// SPEC §1 (2026-10-10, issue 1396) — every figure the public pages state
// about how the product works, read from the constants that run it.
//
// `/how-it-works`, `/about` and the landing's *What happens every day* fill
// their sentences' slots from here, so a figure is never typed into copy:
// change a constant and the page says the new number.
import { BATTERY, CROSS_LINKS, PACE, SETUP_MINUTES, TRACKED_PROMPTS, VETO, WEEK_PLAN } from "@/lib/config/constants";
import { HARD_RULES } from "@/lib/generate/rules/types";

export const HOW_FACTS = Object.freeze({
  searches: BATTERY.QUESTIONS,
  prompts: Object.values(TRACKED_PROMPTS.SPLIT).reduce((sum, n) => sum + n, 0),
  rivals: BATTERY.COMPETITORS_MAX,
  newPages: PACE.NEW_PAGES_PER_WEEK,
  weekPages: WEEK_PLAN.days,
  checks: HARD_RULES.length,
  siteLinksMin: CROSS_LINKS.SITE_MIN,
  siteLinksMax: CROSS_LINKS.SITE_MAX,
  windowHours: VETO.defaultHours,
  setupMinutes: SETUP_MINUTES,
  /** The results on Google's first page. */
  googleFirstPage: 10,
});
