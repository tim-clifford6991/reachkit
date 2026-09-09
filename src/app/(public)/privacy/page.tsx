// UI-SPEC S5 — the privacy page (issues #266, #370).
// src/app/(public)/privacy/page.tsx
//
// One of S5's three routes. The screen is `LegalPage`, which every one of
// them renders; all this file decides is which document it is reading.
import type React from "react";
import { LegalPage } from "../_legal/LegalPage";
import { PRIVACY } from "../_legal/documents";

export default function PrivacyPage(): React.JSX.Element {
  return <LegalPage document={PRIVACY} />;
}
