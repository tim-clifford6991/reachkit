"use client";
// A secondary call to action on the landing: it brings the hero's field into
// view with the cursor in it (SPEC §1, "Secondary CTAs scroll to the field").
// A `type="button"`, never a second submit. It is the closing band's own
// action and that band's one solid button — the one-solid rule is per
// section (`docs/DESIGN.md`, the calm layer, 2026-09-24).

import type React from "react";
import { ArrowRight } from "lucide-react";
import { FIELD_SECTION_ID } from "./sections";

/** Brings the hero's field into view with the cursor in it. Shared by this
 *  button and the header's own CTA and banner link on the landing. */
export function focusField(): void {
  const section = document.getElementById(FIELD_SECTION_ID);
  section?.scrollIntoView({ block: "start" });
  section?.querySelector("input")?.focus({ preventScroll: true });
}

/** `soft` where the section already has its solid button, or needs none. */
export function FieldCta(p: { label: string; soft?: boolean }): React.JSX.Element {
  return (
    <button type="button" className={p.soft ? "btn btn-primary btn-soft" : "btn btn-primary"} onClick={focusField}>
      {p.label}
      <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
