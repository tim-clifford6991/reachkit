"use client";
// A secondary call to action on the landing: it brings the hero's field into
// view with the cursor in it (SPEC §1, "Secondary CTAs scroll to the field").
// A `type="button"`, never a second submit, and outline — the hero's Scan is
// the screen's one solid button (SPEC §1, 2026-09-14).

import type React from "react";

/** The hero section's own id — the anchor every CTA on the landing names. */
export const FIELD_SECTION_ID = "landing-field";

export function FieldCta(p: { label: string }): React.JSX.Element {
  return (
    <button
      type="button"
      className="btn btn-outline btn-primary"
      onClick={() => {
        const section = document.getElementById(FIELD_SECTION_ID);
        section?.scrollIntoView({ block: "start" });
        section?.querySelector("input")?.focus({ preventScroll: true });
      }}
    >
      {p.label}
    </button>
  );
}
