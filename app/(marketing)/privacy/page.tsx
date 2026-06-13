/**
 * Privacy Policy page (/privacy) — Cycle 5 Task 11.
 *
 * Thin server component: content lives in content/legal/privacy.ts and is
 * rendered by the shared LegalLayout. No client JS.
 */

import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { privacy } from "@/content/legal/privacy";
import { LegalLayout } from "../_legal-layout";

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: privacy.title,
    description:
      "How ReachKit collects, uses, and protects your data — scan inputs, email, abuse controls, analytics, and our sub-processors.",
    path: "/privacy",
  });
}

export default function PrivacyPage() {
  return <LegalLayout doc={privacy} />;
}
