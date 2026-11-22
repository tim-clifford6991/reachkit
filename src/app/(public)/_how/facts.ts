// SPEC §1 No typed figure — every figure the public pages state
// about how the product works, read from the constants that run it.
//
// `/how-it-works`, `/about` and the landing's *What happens every day* fill
// their sentences' slots from here, so a figure is never typed into copy:
// change a constant and the page says the new number.
import { BATTERY, SETUP_MINUTES, TRACKED_PROMPTS, VETO, WEEK_PLAN } from "@/lib/config/constants";
import { HARD_RULES } from "@/lib/generate/rules/types";

export const HOW_FACTS = Object.freeze({
  searches: BATTERY.QUESTIONS,
  prompts: TRACKED_PROMPTS.PANEL,
  rivals: BATTERY.COMPETITORS_MAX,
  weekPages: WEEK_PLAN.days,
  checks: HARD_RULES.length,
  windowHours: VETO.defaultHours,
  setupMinutes: SETUP_MINUTES,
  /** The results on Google's first page. */
  googleFirstPage: 10,
});
