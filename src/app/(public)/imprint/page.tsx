// UI-SPEC S5 — the imprint page (issues #266, #370).
// src/app/(public)/imprint/page.tsx
//
// One of S5's three routes. The screen is `LegalPage`, which every one of
// them renders; all this file decides is which document it is reading.
import type React from "react";
import { LegalPage } from "../_legal/LegalPage";
import { IMPRINT } from "../_legal/documents";

export default function ImprintPage(): React.JSX.Element {
  return <LegalPage document={IMPRINT} />;
}
