/**
 * /scan — dedicated scan entry point. Uses the SAME shared <ScanHero/> as the
 * landing hero (identical UI, input field + "Analyze my site" button, and copy)
 * so the experience is consistent everywhere. Keeps the HowTo JSON-LD.
 */

import type { Metadata } from "next";
import { buildMetadata, howToLd } from "@/lib/seo";
import { ScanHero } from "@/components/sections/scan-hero";

export const metadata: Metadata = buildMetadata({
  title: "Scan your product — free discoverability report",
  description:
    "Paste your App Store URL or website. Get a Discoverability Score, positioning gap, and ranked action steps in 90 seconds. Free, no account needed.",
  path: "/scan",
});

const HOW_TO_LD = howToLd({
  name: "How to scan your product with ReachKit",
  description:
    "Get a free discoverability score and ranked action plan for your App Store listing or website in under two minutes.",
  steps: [
    { name: "Paste your URL", text: "Copy your App Store URL, Google Play URL, or website address and paste it into the scan input." },
    { name: "Wait ~90 seconds", text: "ReachKit fetches your live product page, extracts 18 discoverability signals, and runs the four-question analysis engine." },
    { name: "Read your report", text: "Review your Discoverability Score, positioning mirror, search gap analysis, and ranked action steps. Free, no account required." },
  ],
});

export default function ScanPage() {
  return (
    <main aria-label="Scan your product" style={{ background: "var(--c-surface)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(HOW_TO_LD) }} />
      <ScanHero />
    </main>
  );
}
