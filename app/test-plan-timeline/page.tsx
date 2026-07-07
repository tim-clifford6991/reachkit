/**
 * /test-plan-timeline — fixture render of the singular plan timeline
 * (PlanTimelineBody with a sample board + synthesis, no auth / no gathers).
 * Fixture idiom: sample board + synthesis rendered directly, no auth/gathers.
 */
import { PlanTimelineBody } from "@/components/app/intel/plan-timeline-view";
import type { Synthesis } from "@/components/app/intel/synthesis-view";
import type { ActionBoard } from "@/lib/scan/action-board";

const SYNTHESIS: Synthesis = {
  domain: "notably.app",
  category: "AI meeting notes",
  summary: "Findable for branded search, invisible where buyers discover tools like yours.",
  contentPlan: [
    { topic: "Best AI meeting note tools compared", targetKeywords: ["ai meeting notes"], estMonthlyVolume: 5400, intent: "commercial", format: "comparison", depthTarget: "2,000–3,000 words", buyerAngle: "For teams drowning in undocumented calls", competitorExemplars: [], brief: "Compare honestly, include rivals.", agentPrompt: "Write a comparison.", priority: "high", evidence: "keyword gap" },
    { topic: "How to run meetings people don't hate", targetKeywords: ["better meetings"], estMonthlyVolume: 2900, intent: "informational", format: "guide", depthTarget: "1,500 words", buyerAngle: "Pain-first angle", competitorExemplars: [], brief: "Lead with the pain.", agentPrompt: "Write a guide.", priority: "medium", evidence: "demand theme" },
  ],
  distributionPlan: [
    { channel: "community", action: "Share your build story in r/SaaS", target: "r/SaaS", targetUrl: "https://reddit.com/r/SaaS", why: "Buyers describe this exact pain weekly.", effort: "low", priority: "high", ease: 0.8, impact: 0.7, evidence: "3 live threads" },
    { channel: "directory", action: "Submit to AlternativeTo", target: "AlternativeTo", targetUrl: "https://alternativeto.net", why: "2 of 3 rivals are listed; you're absent.", effort: "low", priority: "high", ease: 0.8, impact: 0.6, evidence: "funnel gap" },
    { channel: "podcast", action: "Pitch the SaaS Podcast", target: "The SaaS Podcast", targetUrl: "https://saasclub.io/podcast", why: "Audience match with your ICP.", effort: "medium", priority: "medium", ease: 0.5, impact: 0.55, evidence: "discovery channel" },
  ],
};

const BOARD: ActionBoard = {
  open: [
    { id: "a1", title: "Fix your meta description", category: "seo", why: "Buyers see a truncated pitch in results.", predictedDelta: 4, actualDelta: null, createdAt: "2026-07-01T00:00:00Z", verifiedAt: null, draft: "New meta: Notably turns every call into searchable notes.", verifyUrl: "https://notably.app", effortMin: 15, target: null },
  ],
  verifying: [
    { id: "a2", title: "Publish the pricing page", category: "content", why: "Buyers bounce when they can't find a price.", predictedDelta: 3, actualDelta: null, createdAt: "2026-06-24T00:00:00Z", verifiedAt: null, draft: "# Pricing\n\nSimple, honest tiers: Free scan, Solo $59/mo, Growth $129/mo.", verifyUrl: "https://notably.app/pricing", effortMin: 60, target: null },
  ],
  done: [
    { id: "a3", title: "Add structured data", category: "seo", why: null, predictedDelta: 5, actualDelta: 6, createdAt: "2026-06-17T00:00:00Z", verifiedAt: "2026-06-20T00:00:00Z", draft: null, verifyUrl: "https://notably.app", effortMin: null, target: null },
  ],
  retry: [],
};

export default function TestPlanTimelinePage() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px", background: "var(--c-bg)" }}>
      {/* Fixed "today" (Wed Jul 8 2026) so the calendar renders deterministically. */}
      <PlanTimelineBody board={BOARD} synthesis={SYNTHESIS} domain="notably.app" score={{ total: 62, delta: 4 }} today={new Date(2026, 6, 8)} />
    </main>
  );
}
