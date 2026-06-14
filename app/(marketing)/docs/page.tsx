import type { Metadata } from "next";

import { ComingSoon } from "@/components/sections/coming-soon";

export const metadata: Metadata = { title: "Help & docs — ReachKit", robots: { index: false } };

export default function DocsPage() {
  return (
    <ComingSoon
      eyebrow="Help & docs"
      title="Documentation is on its way"
      blurb="Guides on reading your report, working the weekly action queue, and getting the most out of ReachKit are being written. Need help now? Contact us."
    />
  );
}
