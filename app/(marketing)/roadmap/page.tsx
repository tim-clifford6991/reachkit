import type { Metadata } from "next";

import { ComingSoon } from "@/components/sections/coming-soon";

export const metadata: Metadata = { title: "Roadmap — ReachKit", robots: { index: false } };

export default function RoadmapPage() {
  return (
    <ComingSoon
      eyebrow="Roadmap"
      title="Where ReachKit is headed"
      blurb="A public roadmap where you can see what's next and vote on it is in the works. Got a request? Reach us via the contact page."
    />
  );
}
