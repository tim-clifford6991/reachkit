"use client";

/**
 * /test-competitors-view — styled fixture preview for the Competitors view
 * (Audience ▸ Competitors). Renders <CompetitorsBody> against a realistic
 * hardcoded Supply payload so the populated, styled UI can be reviewed
 * without auth or a live gather. No fetch, no auth gate.
 */
import { CompetitorsBody } from "@/components/app/intel/competitors-view";
import type { Supply } from "@/components/app/intel/supply-view";

const SAMPLE: Supply = {
  funnel: {
    category: "AI meeting notes",
    subject: {
      domain: "nudgi.ai",
      isSubject: true,
      monthlyTraffic: 4200,
      score: 52,
      band: "fair",
      category: "AI meeting notes",
      backlinks: {
        topQualityReferrers: [
          { host: "producthunt.com", category: "directory", url: "https://producthunt.com/products/nudgi" },
          { host: "indiehackers.com", category: "community", url: "https://indiehackers.com/product/nudgi" },
          { host: "betalist.com", category: "directory", url: "https://betalist.com/startups/nudgi" },
        ],
        byCategory: { directory: 5, community: 2 },
        qualityShare: 0.31,
        sampled: 14,
      },
      lens: {
        sources: { organic: 0.42, paid: 0.02, referral: 0.28, social: 0.14, direct: 0.1, email: 0.04 },
        activities: { content: 0.35, seo: 0.4, outreach: 0.25 },
        estimated: true,
      },
    },
    competitors: [
      {
        domain: "otter.ai",
        monthlyTraffic: 210000,
        score: 67,
        band: "findable",
        closeness: 4,
        reason: "Same core job (live meeting transcription) at a larger scale — closest apples-to-apples rival.",
        backlinks: {
          topQualityReferrers: [
            { host: "producthunt.com", category: "directory", url: "https://producthunt.com/products/otter-ai" },
            { host: "g2.com", category: "review", url: "https://g2.com/products/otter-ai" },
            { host: "zapier.com", category: "integration", url: "https://zapier.com/apps/otter" },
          ],
          byCategory: { directory: 8, review: 12, integration: 6 },
          qualityShare: 0.58,
          sampled: 46,
        },
      },
      {
        domain: "fireflies.ai",
        monthlyTraffic: 340000,
        score: 78,
        band: "findable",
        closeness: 5,
        reason: "Nearly identical positioning (AI notetaker for sales & recurring meetings) and pricing tier.",
        backlinks: {
          topQualityReferrers: [
            { host: "g2.com", category: "review", url: "https://g2.com/products/fireflies-ai" },
            { host: "capterra.com", category: "review", url: "https://capterra.com/p/fireflies" },
            { host: "reddit.com", category: "community", url: "https://reddit.com/r/sales/fireflies" },
          ],
          byCategory: { review: 18, community: 9 },
          qualityShare: 0.64,
          sampled: 58,
        },
      },
      {
        domain: "fathom.video",
        monthlyTraffic: 480000,
        score: 86,
        band: "high",
        closeness: 5,
        reason: "Direct free-tier competitor pulling the same Product Hunt / YC-adjacent audience.",
        backlinks: {
          topQualityReferrers: [
            { host: "producthunt.com", category: "directory", url: "https://producthunt.com/products/fathom" },
            { host: "ycombinator.com", category: "community", url: "https://news.ycombinator.com/item?id=fathom" },
            { host: "trustpilot.com", category: "review", url: "https://trustpilot.com/review/fathom.video" },
          ],
          byCategory: { directory: 10, community: 7, review: 9 },
          qualityShare: 0.71,
          sampled: 63,
        },
      },
    ],
    discoveryChannels: { directory: 23, review: 39, community: 18, integration: 6 },
    channelsMissing: [
      { host: "g2.com", type: "review", action: "Claim your G2 profile and seed 3 reviews", competitorsUsing: 2 },
      { host: "capterra.com", type: "review", action: "Submit a Capterra listing", competitorsUsing: 1 },
      { host: "zapier.com", type: "integration", action: "Ship a Zapier integration + app listing", competitorsUsing: 1 },
    ],
  },
  keywords: {
    gaps: [
      {
        keyword: "meeting notes",
        volume: 22200,
        bestPosition: 4,
        competitorsRanking: 2,
        opportunity: 88,
        competitors: [
          { domain: "otter.ai", position: 4, url: "https://otter.ai/blog/ai-meeting-notes" },
          { domain: "fireflies.ai", position: 7, url: "https://fireflies.ai/blog/meeting-notes" },
        ],
      },
      {
        keyword: "ai notetaker",
        volume: 14800,
        bestPosition: 3,
        competitorsRanking: 3,
        opportunity: 92,
        competitors: [
          { domain: "fireflies.ai", position: 3, url: "https://fireflies.ai" },
          { domain: "fathom.video", position: 5, url: "https://fathom.video" },
          { domain: "otter.ai", position: 9, url: "https://otter.ai" },
        ],
      },
      {
        keyword: "free ai meeting notetaker",
        volume: 9600,
        bestPosition: 2,
        competitorsRanking: 1,
        opportunity: 81,
        competitors: [{ domain: "fathom.video", position: 2, url: "https://fathom.video/free" }],
      },
      {
        keyword: "zoom notes",
        volume: 5400,
        bestPosition: 6,
        competitorsRanking: 2,
        opportunity: 54,
        competitors: [
          { domain: "otter.ai", position: 6, url: "https://otter.ai/integrations/zoom" },
          { domain: "fathom.video", position: 11, url: "https://fathom.video/use-cases" },
        ],
      },
      {
        keyword: "sales call recorder",
        volume: 3900,
        bestPosition: 8,
        competitorsRanking: 1,
        opportunity: 42,
        competitors: [{ domain: "fireflies.ai", position: 8, url: "https://fireflies.ai/blog/sales-calls" }],
      },
    ],
  },
  content: {
    subjectDomain: "nudgi.ai",
    entities: [
      {
        domain: "nudgi.ai",
        isSubject: true,
        contentTypeMix: { blog: 6, landing: 3, docs: 2 },
        pages: [
          { url: "https://nudgi.ai/blog/meeting-minutes", title: "How to write meeting minutes", contentType: "blog", cluster: "Meeting minutes", keywordCount: 4, etv: 210, wordCount: 1400 },
          { url: "https://nudgi.ai/", title: "Nudgi — AI meeting prep", contentType: "landing", cluster: "Brand", keywordCount: 2, etv: 180, wordCount: 600 },
          { url: "https://nudgi.ai/features", title: "Features", contentType: "landing", cluster: "Brand", keywordCount: 1, etv: 90, wordCount: 500 },
        ],
      },
      {
        domain: "otter.ai",
        isSubject: false,
        contentTypeMix: { guide: 8, comparison: 3, blog: 12 },
        pages: [
          { url: "https://otter.ai/templates", title: "Meeting minutes templates", contentType: "tool", cluster: "Meeting minutes", keywordCount: 18, etv: 3400, wordCount: 2200 },
          { url: "https://otter.ai/blog/ai-meeting-notes", title: "AI meeting notes guide", contentType: "guide", cluster: "AI notetaker", keywordCount: 14, etv: 2600, wordCount: 3100 },
          { url: "https://otter.ai/integrations/zoom", title: "Zoom integration", contentType: "landing", cluster: "Zoom notes", keywordCount: 6, etv: 980, wordCount: 900 },
        ],
      },
      {
        domain: "fireflies.ai",
        isSubject: false,
        contentTypeMix: { comparison: 5, blog: 15, docs: 4 },
        pages: [
          { url: "https://fireflies.ai/compare", title: "Compare AI notetakers", contentType: "comparison", cluster: "Best AI notetakers", keywordCount: 22, etv: 4100, wordCount: 2800 },
          { url: "https://fireflies.ai/blog/sales-calls", title: "Recording sales calls", contentType: "blog", cluster: "Sales calls", keywordCount: 11, etv: 1900, wordCount: 1700 },
          { url: "https://fireflies.ai/integrations", title: "Integrations", contentType: "landing", cluster: "Brand", keywordCount: 3, etv: 620, wordCount: 700 },
        ],
      },
      {
        domain: "fathom.video",
        isSubject: false,
        contentTypeMix: { landing: 4, blog: 9, listicle: 2 },
        pages: [
          { url: "https://fathom.video/", title: "Fathom — free AI notetaker", contentType: "landing", cluster: "Brand", keywordCount: 9, etv: 5200, wordCount: 800 },
          { url: "https://fathom.video/blog/free-notetaker", title: "Best free notetaker", contentType: "listicle", cluster: "Best AI notetakers", keywordCount: 16, etv: 3800, wordCount: 2100 },
          { url: "https://fathom.video/use-cases", title: "Use cases", contentType: "landing", cluster: "Zoom notes", keywordCount: 5, etv: 1100, wordCount: 950 },
        ],
      },
    ],
    clusters: [
      { label: "Meeting minutes", totalPages: 2, coveredBy: ["nudgi.ai", "otter.ai"] },
      { label: "AI notetaker", totalPages: 1, coveredBy: ["otter.ai"] },
      { label: "Best AI notetakers", totalPages: 2, coveredBy: ["fireflies.ai", "fathom.video"] },
      { label: "Sales calls", totalPages: 1, coveredBy: ["fireflies.ai"] },
      { label: "Zoom notes", totalPages: 2, coveredBy: ["otter.ai", "fathom.video"] },
      { label: "Brand", totalPages: 4, coveredBy: ["nudgi.ai", "fireflies.ai", "fathom.video"] },
    ],
  },
};

export default function TestCompetitorsViewPage() {
  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--c-ink)", marginBottom: 4 }}>
        Competitors view — fixture preview
      </h1>
      <p style={{ fontSize: 13, color: "var(--c-muted)", marginBottom: 24 }}>
        Styled, populated <code>CompetitorsBody</code> against a hardcoded Supply payload — no auth, no live gather.
      </p>
      <CompetitorsBody data={SAMPLE} />
    </main>
  );
}
