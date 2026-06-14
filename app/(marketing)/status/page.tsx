import type { Metadata } from "next";

import { ComingSoon } from "@/components/sections/coming-soon";

export const metadata: Metadata = { title: "Status — ReachKit", robots: { index: false } };

export default function StatusPage() {
  return (
    <ComingSoon
      eyebrow="Status"
      title="All systems operational"
      blurb="A live status page with uptime history is coming soon. If something looks broken in the meantime, let us know via the contact page."
    />
  );
}
