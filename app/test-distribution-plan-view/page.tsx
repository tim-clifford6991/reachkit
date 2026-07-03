"use client";

/**
 * /test-distribution-plan-view — styled fixture preview for the Distribution
 * plan view (Plan ▸ Distribution). Renders <DistributionPlanBody> against a
 * realistic hardcoded Synthesis payload so the populated, styled UI can be
 * reviewed without auth or a live gather. No fetch, no auth gate.
 */
import { DistributionPlanBody } from "@/components/app/intel/distribution-plan-view";
import type { Synthesis } from "@/components/app/intel/synthesis-view";

const SAMPLE: Synthesis = {
  category: "AI meeting notes",
  summary: "You're findable for branded search but invisible where buyers actually discover tools like yours — directories and community threads that feed 3 of your 4 rivals. Closing that gap is the single highest-leverage move this month.",
  contentPlan: [
    {
      topic: "Meeting minutes templates", targetKeywords: ["meeting minutes template", "meeting notes template"],
      estMonthlyVolume: 44400, intent: "informational", format: "Template + guide", depthTarget: "2,500+ words",
      buyerAngle: "Give teams a copy-paste starting point that funnels into the product.",
      competitorExemplars: [{ domain: "otter.ai", url: "https://otter.ai/templates", position: 4 }],
      brief: "Cover the standard sections, a downloadable template, and a short CTA.", agentPrompt: "Write a 2,500-word guide on meeting minutes templates.",
      priority: "high", evidence: "3 of 4 rivals rank here with long-form templates.",
    },
    {
      topic: "Best AI note-takers (2026)", targetKeywords: ["best ai notetaker", "ai meeting notes tools"],
      estMonthlyVolume: 18200, intent: "commercial", format: "Comparison listicle", depthTarget: "1,800+ words",
      buyerAngle: "Own the comparison SERP with an honest, well-sourced roundup.",
      competitorExemplars: [{ domain: "fireflies.ai", url: "https://fireflies.ai/compare", position: 2 }],
      brief: "Compare 6-8 tools on price, features, and integrations.", agentPrompt: "Write a comparison listicle of the best AI notetakers in 2026.",
      priority: "high", evidence: "High commercial intent, currently invisible on this SERP.",
    },
    {
      topic: "How to share meeting notes", targetKeywords: ["share meeting notes", "meeting notes workflow"],
      estMonthlyVolume: 9100, intent: "informational", format: "How-to guide", depthTarget: "1,200+ words",
      buyerAngle: "Top-of-funnel demand with low competition.",
      competitorExemplars: [],
      brief: "Walk through sharing notes across Slack, email, and docs.", agentPrompt: "Write a how-to guide on sharing meeting notes.",
      priority: "medium", evidence: "Low competition, quick to rank.",
    },
  ],
  distributionPlan: [
    {
      channel: "directory", target: "webcatalog.io", targetUrl: "https://webcatalog.io/submit",
      action: "Submit your tool", why: "Feeds 3 of 4 rivals and your audience browses it to find tools.",
      effort: "Low", priority: "high", ease: 0.85, impact: 0.65,
      evidence: "3 of 4 tracked rivals have a live listing here; this directory shows up in 12% of discovery-intent referrals.",
    },
    {
      channel: "community", target: "r/SaaS", targetUrl: "https://reddit.com/r/SaaS",
      action: "Answer 3 recurring threads about meeting notes", why: "Your top demand-signal source; rivals pull steady referral traffic here.",
      effort: "Medium", priority: "high", ease: 0.55, impact: 0.8,
      evidence: "9 threads mentioning \"ai meeting notes\" in the last 90 days, 2 answered by a competitor's founder.",
    },
    {
      channel: "podcast", target: "The Modern Manager", targetUrl: "",
      action: "Pitch a guest spot", why: "Your ICP (ops & PM leads) listens; a competitor guested in March.",
      effort: "Medium", priority: "medium", ease: 0.4, impact: 0.6,
      evidence: "Competitor's founder appeared on episode 214 (March 2026); no publicly listed submission form found.",
    },
    {
      channel: "marketplace", target: "Slack App Directory", targetUrl: "https://slack.com/apps",
      action: "Apply to the directory", why: "Distribution right where your buyers already work.",
      effort: "High", priority: "medium", ease: 0.3, impact: 0.7,
      evidence: "2 of 4 rivals have a listed Slack app; review approval typically takes 2-3 weeks.",
    },
  ],
};

export default function TestDistributionPlanViewPage() {
  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--c-ink)", marginBottom: 4 }}>
        Distribution plan view — fixture preview
      </h1>
      <p style={{ fontSize: 13, color: "var(--c-muted)", marginBottom: 24 }}>
        Styled, populated <code>DistributionPlanBody</code> against a hardcoded Synthesis payload — no auth, no live gather.
      </p>
      <DistributionPlanBody data={SAMPLE} />
    </main>
  );
}
