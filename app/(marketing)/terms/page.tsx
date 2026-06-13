/**
 * Terms of Service page (/terms) — Cycle 5 Task 11.
 *
 * Thin server component: content lives in content/legal/terms.ts and is
 * rendered by the shared LegalLayout. No client JS.
 */

import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { terms } from "@/content/legal/terms";
import { LegalLayout } from "../_legal-layout";

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: terms.title,
    description:
      "The terms for using ReachKit — service description, acceptable use, cancel-anytime billing, and the guidance-not-guarantees disclaimer.",
    path: "/terms",
  });
}

export default function TermsPage() {
  return <LegalLayout doc={terms} />;
}
