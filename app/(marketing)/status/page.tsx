import type { Metadata } from "next";

import { ComingSoon } from "@/components/sections/coming-soon";

export const metadata: Metadata = { title: "Status — ReachKit", robots: { index: false } };

export default function StatusPage() {
  return (
    <ComingSoon
      eyebrow="Status"
      title="Status page coming soon"
      blurb="A live status page with uptime history is on the way. If something looks broken in the meantime, let us know via the contact page."
    />
  );
}
