"use client";

/**
 * /test-customers-view — unauth styled preview of the Customers view body,
 * fed a hardcoded fixture instead of a live `demand` layer fetch. Lets us
 * eyeball the kit-styled layout without running a real scan.
 */
import { CustomersBody } from "@/components/app/intel/customers-view";
import type { Demand } from "@/components/app/intel/demand-view";

const SAMPLE: Demand = {
  category: "meeting-prep & note-taking software",
  icp: {
    whoItsFor: "B2B sales and CS teams at 20-200 person companies who run 15+ external calls a week and need a shared record of what was decided.",
    jobsToBeDone: [
      "Capture and share every meeting decision without manual note-taking.",
      "Give reps a searchable history of what was promised to each account.",
      "Get new hires up to speed on an account without re-reading the whole email thread.",
    ],
    useCases: ["Sales discovery calls", "Customer QBRs", "Onboarding calls", "Internal syncs"],
  },
  searchDemand: {
    totalAddressableVolume: 74000,
    themes: [
      { theme: "AI meeting notes", totalVolume: 27500, intent: "commercial", sampleKeywords: ["ai meeting notes app", "best ai note taker", "meeting notes generator"] },
      { theme: "Call recording & transcription", totalVolume: 19800, intent: "transactional", sampleKeywords: ["record zoom calls", "call transcription software", "auto transcribe meetings"] },
      { theme: "Sales call summaries", totalVolume: 14200, intent: "commercial", sampleKeywords: ["sales call summary tool", "crm call notes"] },
      { theme: "Meeting prep tools", totalVolume: 8100, intent: "informational", sampleKeywords: ["how to prepare for a sales call", "meeting agenda template"] },
    ],
    topKeywords: [
      { keyword: "ai meeting notes app", volume: 9900, intent: "commercial" },
      { keyword: "record zoom calls", volume: 8200, intent: "transactional" },
    ],
  },
  community: {
    pockets: [
      {
        surface: "r/sales",
        platform: "reddit",
        count: 14,
        intentSum: 9,
        topThreads: [
          { title: "What's everyone using for automatic call notes now?", url: "https://reddit.com/r/sales/1", intent: 4, publishedAt: "2026-06-20T00:00:00Z", theme: "AI meeting notes" },
          { title: "Tired of retyping the same call recap into the CRM every day", url: "https://reddit.com/r/sales/2", intent: 4, publishedAt: "2026-06-25T00:00:00Z", theme: "Sales call summaries" },
        ],
      },
      {
        surface: "r/SaaS",
        platform: "reddit",
        count: 9,
        intentSum: 5,
        topThreads: [
          { title: "Best tool to summarize customer calls for the whole team", url: "https://reddit.com/r/saas/1", intent: 3, publishedAt: "2026-06-10T00:00:00Z", theme: "Sales call summaries" },
        ],
      },
      {
        surface: "r/CustomerSuccess",
        platform: "reddit",
        count: 6,
        intentSum: 3,
        topThreads: [
          { title: "How do you keep QBR notes consistent across CSMs?", url: "https://reddit.com/r/customersuccess/1", intent: 2, publishedAt: "2026-05-28T00:00:00Z", theme: "Meeting prep tools" },
          { title: "Onboarding a new CSM onto 40 accounts — any way to avoid reading every email thread?", url: "https://reddit.com/r/customersuccess/2", intent: 2, publishedAt: "2026-04-02T00:00:00Z", theme: "AI meeting notes" },
        ],
      },
    ],
  },
  buyerInsights: {
    pains: [{ text: "Manual note-taking eats into follow-up time" }, { text: "Notes are scattered across reps' personal docs" }, { text: "Hard to onboard new reps onto an account's history" }],
    lovedFeatures: ["Auto-generated summaries land in Slack within a minute", "CRM sync means no copy-pasting"],
    personas: ["Sales development rep", "Account executive", "Customer success manager"],
    buyerLanguage: ["\"Just works in the background\"", "\"Never miss a commitment again\""],
    sources: ["https://www.g2.com/products/gong/reviews", "https://www.trustradius.com/products/chorus/reviews", "https://www.capterra.com/p/gong-io/reviews/"],
  },
};

export function TestCustomersFixture() {
  return (
    <main style={{ background: "var(--c-bg)", minHeight: "100vh", padding: "40px 24px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: "var(--c-ink)", margin: 0 }}>Customers view — fixture preview</h1>
          <p style={{ fontSize: 12.5, color: "var(--c-muted)", margin: "4px 0 0" }}>Hardcoded sample data, no auth or live fetch — for styling review only.</p>
        </div>
        <CustomersBody data={SAMPLE} />
      </div>
    </main>
  );
}
