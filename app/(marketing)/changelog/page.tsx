import type { Metadata } from "next";

import { ComingSoon } from "@/components/sections/coming-soon";

export const metadata: Metadata = { title: "Changelog — ReachKit", robots: { index: false } };

export default function ChangelogPage() {
  return (
    <ComingSoon
      eyebrow="Changelog"
      title="What's new in ReachKit"
      blurb="We ship constantly. A public changelog of new signals, features and fixes is coming soon — follow along on X for now."
    />
  );
}
