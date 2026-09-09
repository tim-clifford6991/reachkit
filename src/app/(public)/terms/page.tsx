// UI-SPEC S5 — the terms page (issues #266, #370).
// src/app/(public)/terms/page.tsx
//
// One of S5's three routes. The screen is `LegalPage`, which every one of
// them renders; all this file decides is which document it is reading.
import type React from "react";
import { LegalPage } from "../_legal/LegalPage";
import { TERMS } from "../_legal/documents";

export default function TermsPage(): React.JSX.Element {
  return <LegalPage document={TERMS} />;
}
