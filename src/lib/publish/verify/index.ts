// BUILD §9 — the verification leaf's public surface: `verifyLive()`, and what the page record, the published mail
// and the calendar read.
export { type Answer, type ClassifiedAnswer } from "./answer";
export {
  type RobotsReading,
  type SiteCondition,
  type SiteConditionKind,
  type SiteReadings,
  type SitemapReading,
} from "./site";
export { CHECK_IDS, type CheckId } from "./checks";
export { verifyLive, type VerifyRun } from "./verify";
export { tellingFor, type PublishedTelling, type TellingCopyKey } from "./telling";
export type {
  NotConfirmed,
  VerifyChecks,
  VerifyDisposition,
  VerifyOutcome,
} from "../types";
