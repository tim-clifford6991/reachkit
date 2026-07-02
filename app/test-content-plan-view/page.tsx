"use client";

/**
 * /test-content-plan-view — styled fixture preview for the Content plan view
 * (Plan ▸ Content). Renders <ContentPlanBody> against a realistic hardcoded
 * Synthesis payload so the populated, styled UI can be reviewed without auth
 * or a live gather. No fetch, no auth gate.
 */
import { ContentPlanBody } from "@/components/app/intel/content-plan-view";
import type { Synthesis } from "@/components/app/intel/synthesis-view";

const SAMPLE: Synthesis = {
  category: "AI meeting notes",
  summary: "You're findable for branded search but invisible where buyers actually discover tools like yours — directories and community threads that feed 3 of your 4 rivals. Closing that gap is the single highest-leverage move this month.",
  contentPlan: [
    {
      topic: "AI meeting notes: the complete guide", targetKeywords: ["ai meeting notes", "ai meeting notes software"],
      estMonthlyVolume: 27600, intent: "informational", format: "Guide", depthTarget: "3,000+ words",
      buyerAngle: "Anchor the category with a definitive resource buyers land on before they've picked a vendor — build trust early in the funnel.",
      competitorExemplars: [{ domain: "fireflies.ai", url: "https://fireflies.ai/blog/ai-meeting-notes", position: 3 }],
      brief: "Cover what AI meeting notes are, how they work, buying criteria, and a short comparison CTA.",
      agentPrompt: "Write a 3,000-word definitive guide on AI meeting notes covering how they work, buying criteria, and use cases.",
      priority: "high", evidence: "3 of 4 rivals rank top-5 for this head term; you don't rank at all.",
    },
    {
      topic: "Best AI note-takers (2026)", targetKeywords: ["best ai notetaker", "ai meeting assistant comparison"],
      estMonthlyVolume: 18200, intent: "commercial", format: "Comparison", depthTarget: "1,800+ words",
      buyerAngle: "Own the comparison SERP with an honest, well-sourced roundup right when buyers are evaluating.",
      competitorExemplars: [{ domain: "otter.ai", url: "https://otter.ai/compare", position: 2 }],
      brief: "Compare 6-8 tools on price, features, and integrations; end with a clear recommendation matrix.",
      agentPrompt: "Write a comparison listicle of the best AI note-takers in 2026, covering price, features, and integrations.",
      priority: "high", evidence: "High commercial intent, currently invisible on this SERP.",
    },
    {
      topic: "10 meeting productivity tips backed by data", targetKeywords: ["meeting productivity", "run better meetings"],
      estMonthlyVolume: 9100, intent: "informational", format: "Listicle", depthTarget: "1,400+ words",
      buyerAngle: "Top-of-funnel demand with low competition — a natural entry point that funnels into product mentions.",
      competitorExemplars: [],
      brief: "Ten data-backed tips, each tied back to a feature that makes the tip effortless.",
      agentPrompt: "Write a listicle of 10 data-backed meeting productivity tips, tying each to a relevant product feature.",
      priority: "medium", evidence: "Low competition, quick to rank, feeds mid-funnel intent.",
    },
    {
      topic: "Meeting notes template library", targetKeywords: ["meeting notes template", "meeting minutes template"],
      estMonthlyVolume: 5400, intent: "informational", format: "Template", depthTarget: "800+ words + downloads",
      buyerAngle: "Give teams a copy-paste starting point that funnels straight into the product.",
      competitorExemplars: [{ domain: "notion.so", url: "https://notion.so/templates/meeting-notes", position: 5 }],
      brief: "A small set of downloadable templates (1:1, standup, retro) with a short how-to-use section.",
      agentPrompt: "Write a short guide introducing a meeting notes template library with 3 downloadable formats.",
      priority: "low", evidence: "Steady long-tail volume; low urgency relative to the other gaps.",
    },
  ],
  distributionPlan: [],
};

export default function TestContentPlanViewPage() {
  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--c-ink)", marginBottom: 4 }}>
        Content plan view — fixture preview
      </h1>
      <p style={{ fontSize: 13, color: "var(--c-muted)", marginBottom: 24 }}>
        Styled, populated <code>ContentPlanBody</code> against a hardcoded Synthesis payload — no auth, no live gather.
      </p>
      <ContentPlanBody data={SAMPLE} />
    </main>
  );
}
