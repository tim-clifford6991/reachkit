"use client";
// A secondary call to action on the landing: it brings the hero's field into
// view with the cursor in it (SPEC §1, "Secondary CTAs scroll to the field").
// A `type="button"`, never a second submit. It is the closing band's own
// action and that band's one solid button — the one-solid rule is per
// section (`docs/DESIGN.md`, the calm layer, 2026-09-24).

import type React from "react";
import { ArrowRight } from "lucide-react";

/** The hero section's own id — the anchor every CTA on the landing names. */
export const FIELD_SECTION_ID = "landing-field";

/** The two sections the public nav links to (#1066): *Why it matters* and
 *  *How to start*. Anchors on the landing, so the nav reaches them from
 *  every public route as `/#…`. */
export const WHY_SECTION_ID = "why";
export const HOW_SECTION_ID = "how";

/** Brings the hero's field into view with the cursor in it. Shared by this
 *  button and the header's own CTA and banner link on the landing. */
export function focusField(): void {
  const section = document.getElementById(FIELD_SECTION_ID);
  section?.scrollIntoView({ block: "start" });
  section?.querySelector("input")?.focus({ preventScroll: true });
}

export function FieldCta(p: { label: string }): React.JSX.Element {
  return (
    <button type="button" className="btn btn-primary" onClick={focusField}>
      {p.label}
      <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
