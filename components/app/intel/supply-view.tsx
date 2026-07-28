/**
 * Supply intel — shared TYPE definitions for "how you and your rivals get found".
 *
 * The interactive `SupplyView` component was removed 2026-07-24: its route
 * (`/app/supply`) is a redirect to `/app/audience/competitors`, so the component
 * was never mounted. The live Supply surfaces are `dashboard-view.tsx` (dashboard)
 * and `competitors-view.tsx` (/app/audience/competitors); both import the `Supply`
 * type from here. This module is now types-only.
 */

interface Backlinks { topQualityReferrers: { host: string; category: string; url: string; anchor?: string; target?: string; authority?: number | null; dofollow?: boolean | null; etv?: number | null; relevance?: "core" | "low" }[]; byCategory: Record<string, number>; qualityShare: number; sampled: number }
interface Entity { domain: string; isSubject?: boolean; monthlyTraffic: number; score: number; band: string; mix?: { organic: number; referral: number; social: number; direct: number; organicKeywords: number; referringDomains: number; socialMentions: number } | null; brandedSearchVolume?: number; topPagesCount?: number }
interface CompetitorDeep extends Entity { closeness: number; reason: string; backlinks: Backlinks }
interface Channel { host: string; type: string; action: string; competitorsUsing: number }
interface Gap { keyword: string; volume: number; bestPosition: number; competitorsRanking: number; competitors: { domain: string; position: number; url: string }[]; opportunity: number }

/** Content-effectiveness payload (Item 3). */
type ContentType = "guide" | "comparison" | "listicle" | "landing" | "tool" | "blog" | "docs" | "other";
interface ContentPage { url: string; title?: string; contentType: ContentType; cluster: string; keywordCount: number; etv: number; wordCount: number }
interface ContentEntity { domain: string; isSubject: boolean; contentTypeMix: Partial<Record<ContentType, number>>; pages: ContentPage[] }
interface ContentCluster { label: string; totalPages: number; coveredBy: string[] }
interface ContentIntel { subjectDomain: string; entities: ContentEntity[]; clusters: ContentCluster[] }

export interface Supply {
  funnel: { subject: Entity & { category: string; backlinks?: Backlinks }; category: string; competitors: CompetitorDeep[]; discoveryChannels: Record<string, number>; channelsMissing: Channel[]; channelStrength?: Record<string, Record<string, "hi" | "med" | "lo" | "absent">> };
  /** Keyword-gap (`gaps`) is no longer fetched on the mounted supply path (it renders
   *  on no mounted view); the endpoint returns `null`. Synthesis gathers its own for
   *  the plan. Kept optional so legacy cached payloads still type-check. */
  keywords?: { gaps: Gap[] } | null;
  content?: ContentIntel;
}
