// BUILD §9 — the verification leaf's public surface.
//
// `verifyLive()` is the name ARCHITECTURE.md's `src/lib/publish/**` row
// declares; everything else here is read by the page record, the published
// mail and the calendar's ways through.
export { dispositionFor, dueNow } from "./due";
export { bodyCoverage } from "./coverage";
export { classify, isOurPage, type Answer, type ClassifiedAnswer } from "./answer";
export {
  conditionFrom,
  siteConditionFor,
  type RobotsReading,
  type SiteCondition,
  type SiteConditionKind,
  type SiteReadings,
  type SitemapReading,
} from "./site";
export { CHECK_IDS, type CheckId } from "./checks";
export { verifyLive, type VerifyRun } from "./verify";
export {
  TELLING_COPY,
  tellingFor,
  type PublishedTelling,
  type TellingCopyKey,
} from "./telling";
export type {
  NotConfirmed,
  VerifyChecks,
  VerifyDisposition,
  VerifyOutcome,
} from "../types";
