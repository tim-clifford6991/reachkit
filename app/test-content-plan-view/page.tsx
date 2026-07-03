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
      competitorExemplars: [
        { domain: "fireflies.ai", url: "https://fireflies.ai/blog/ai-meeting-notes", position: 3 },
        { domain: "otter.ai", url: "https://otter.ai/blog/what-are-ai-meeting-notes", position: 5 },
      ],
      brief: "Cover what AI meeting notes are, how they work under the hood (transcription + summarization), the buying criteria teams should weigh (accuracy, integrations, privacy), and close with a short comparison CTA into our product. Aim for a resource buyers bookmark and return to before they've shortlisted a vendor.",
      agentPrompt: "Write a 3,000-word definitive guide titled \"AI Meeting Notes: The Complete Guide.\" Structure: (1) what AI meeting notes are and how the tech works, (2) the 5 buying criteria that matter most (accuracy, integrations, privacy, pricing, ease of setup), (3) common use cases by team type, (4) a short comparison CTA. Target keyword \"ai meeting notes\" naturally in the H1 and first 100 words. Tone: authoritative but not salesy — this is a trust-building top-of-funnel piece.",
      priority: "high", evidence: "3 of 4 rivals rank top-5 for this head term; you don't rank at all.",
    },
    {
      topic: "Best AI note-takers (2026)", targetKeywords: ["best ai notetaker", "ai meeting assistant comparison"],
      estMonthlyVolume: 18200, intent: "commercial", format: "Comparison", depthTarget: "1,800+ words",
      buyerAngle: "Own the comparison SERP with an honest, well-sourced roundup right when buyers are evaluating.",
      competitorExemplars: [
        { domain: "otter.ai", url: "https://otter.ai/compare", position: 2 },
        { domain: "fireflies.ai", url: "https://fireflies.ai/vs", position: 4 },
      ],
      brief: "Compare 6-8 tools on price, features, and integrations; end with a clear recommendation matrix. Be even-handed on the first pass through competitors, then make the case for where our product wins on specific buyer needs.",
      agentPrompt: "Write a comparison listicle: \"Best AI Note-Takers in 2026.\" Cover 6-8 tools including us, fireflies.ai, and otter.ai. For each: pricing tier, standout feature, best-fit team size, and one honest limitation. Close with a recommendation matrix (by team size, by budget, by integration needs). Target keyword \"best ai notetaker.\" Avoid generic AI-listicle tone — cite specific feature differences, not vague superlatives.",
      priority: "high", evidence: "High commercial intent, currently invisible on this SERP.",
    },
    {
      topic: "10 meeting productivity tips backed by data", targetKeywords: ["meeting productivity", "run better meetings"],
      estMonthlyVolume: 9100, intent: "informational", format: "Listicle", depthTarget: "1,400+ words",
      buyerAngle: "Top-of-funnel demand with low competition — a natural entry point that funnels into product mentions.",
      competitorExemplars: [],
      brief: "Ten data-backed tips, each tied back to a feature that makes the tip effortless. Pull stats from published research where possible rather than inventing numbers.",
      agentPrompt: "Write a listicle of 10 data-backed meeting productivity tips (e.g. shorter default meeting lengths, async status updates, agenda-first invites). For each tip, cite a real study or data point, then a one-line tie-in to a feature that makes it effortless to adopt. Keep each section under 120 words. Target keyword \"meeting productivity.\"",
      priority: "medium", evidence: "Low competition, quick to rank, feeds mid-funnel intent.",
    },
    {
      topic: "Meeting notes template library", targetKeywords: ["meeting notes template", "meeting minutes template"],
      estMonthlyVolume: 5400, intent: "informational", format: "Template", depthTarget: "800+ words + downloads",
      buyerAngle: "Give teams a copy-paste starting point that funnels straight into the product.",
      competitorExemplars: [
        { domain: "notion.so", url: "https://notion.so/templates/meeting-notes", position: 5 },
        { domain: "coda.io", url: "https://coda.io/templates/meeting-notes", position: 8 },
      ],
      brief: "A small set of downloadable templates (1:1, standup, retro) with a short how-to-use section for each, plus a nudge toward automating them with the product.",
      agentPrompt: "Write a short guide introducing a meeting notes template library with 3 downloadable formats: 1:1, team standup, and retro. For each, include the template structure and a 2-sentence how-to-use note. Close with a line connecting manual templates to how the product auto-generates the same structure. Target keyword \"meeting notes template.\"",
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
