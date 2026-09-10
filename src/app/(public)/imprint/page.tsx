// UI-SPEC S5 — the imprint page (issues #266, #370).
// src/app/(public)/imprint/page.tsx
//
// One of S5's three routes. The screen is `LegalPage`, which every one of
// them renders; all this file decides is which document it is reading.
import type React from "react";
import type { Metadata } from "next";
import { LegalPage } from "../_legal/LegalPage";
import { IMPRINT } from "../_legal/documents";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";

/** Issue #326: the one composer, with this route's own row. The three
 *  legal pages are one screen and three documents, and a search result
 *  that could not tell them apart would be three of the same page. */
export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.imprint);

export default function ImprintPage(): React.JSX.Element {
  return <LegalPage document={IMPRINT} />;
}
