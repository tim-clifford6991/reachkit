/**
 * Deep domain profiling (M2) — public surface.
 *
 * profileDomain → one domain's content channels (+ recency cadence) and SEO
 * standing. profileDomainCached adds the shared cross-user cache. profileCohort
 * fans out over the user + top-N competitors → the input to gap analysis.
 *
 * (Pipeline/report wiring is the next increment; this is the compute + cache +
 * fan-out core.)
 */

export type {
  DistributionProfile,
  ContentChannel,
  ChannelKind,
  SeoPosture,
  Cadence,
  CommunityPresence,
} from "./types";

export { gatherCommunityPresence, summarizePresence } from "./community";
export {
  youtubeChannelDates,
  parseChannelRef,
  parseUploadsPlaylist,
  parsePlaylistDates,
} from "./youtube-cadence";

export { profileDomain } from "./profile-domain";
export { profileDomainCached, getCachedProfile, upsertProfile, PROFILE_TTL_MS } from "./cache";
export { profileCohort, type Cohort } from "./cohort";
export {
  discoverCompetitorDomains,
  discoverProductCompetitors,
  filterProductCompetitors,
  parseCompetitorsDomain,
  rankCompetitorDomains,
  parseKeepList,
  COMPETITOR_BLOCKLIST,
} from "./competitors";

// Category/market-first discovery (the primary Stage-0 used by profileCohort).
export {
  discoverCompetitorsSmart,
  proposeCompetitors,
  parseProposed,
  domainFromUrl,
  isDisqualified,
  rankByCorroboration,
  type ProductInfo,
} from "./discover";

export { crawlContentChannels, toHost } from "./crawl";
export { computeCadence } from "./cadence";
export { detectChannels } from "./fingerprint";
export { fetchSeoPosture, parseRankOverview, parseBacklinksSummary } from "./seo";
