import type { Metadata } from "next";

import { ComingSoon } from "@/components/sections/coming-soon";

export const metadata: Metadata = { title: "Blog — ReachKit", robots: { index: false } };

export default function BlogPage() {
  return (
    <ComingSoon
      eyebrow="Blog"
      title="Notes on getting found"
      blurb="Field notes on discoverability, ASO and SEO for solo founders are on the way. In the meantime, our teardowns show the playbook in action."
    />
  );
}
