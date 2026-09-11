// UI-SPEC S5 — the privacy page (issues #266, #370).
// src/app/(public)/privacy/page.tsx
//
// One of S5's three routes. The screen is `LegalPage`, which every one of
// them renders; all this file decides is which document it is reading.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-11: REQ-092 c8's stopped-work sweep exempts the legal document card
//   (`.rk-doc`, on `/privacy` `/terms` `/imprint` only): the approved privacy notice and terms
//   name the service providers as a disclosure, not as the cause of a stop; the rest of those
//   screens is still swept, and the test asserts the card is there to take out. — master, #459
//   (PR 485, `tests/presentation/sweeps/stopped.test.tsx`)

import type React from "react";
import type { Metadata } from "next";
import { LegalPage } from "../_legal/LegalPage";
import { PRIVACY } from "../_legal/documents";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";

/** Issue #326: the one composer, with this route's own row. The three
 *  legal pages are one screen and three documents, and a search result
 *  that could not tell them apart would be three of the same page. */
export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.privacy);

export default function PrivacyPage(): React.JSX.Element {
  return <LegalPage document={PRIVACY} />;
}
