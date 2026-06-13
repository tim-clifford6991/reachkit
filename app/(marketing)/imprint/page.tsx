/**
 * Imprint / Impressum page (/imprint) — Cycle 5 Task 11.
 *
 * Thin server component: content lives in content/legal/imprint.ts and is
 * rendered by the shared LegalLayout. No client JS.
 *
 * NOTE: the entity/address/contact/registration fields are placeholders pending
 * the deploy-time entity/jurisdiction decision (#5). See content/legal/imprint.ts.
 */

import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { imprint } from "@/content/legal/imprint";
import { LegalLayout } from "../_legal-layout";

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: imprint.title,
    description:
      "Legal operator information (Impressum) for ReachKit pursuant to § 5 TMG.",
    path: "/imprint",
  });
}

export default function ImprintPage() {
  return <LegalLayout doc={imprint} />;
}
