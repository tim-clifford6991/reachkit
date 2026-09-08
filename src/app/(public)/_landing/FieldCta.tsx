// BUILD §3, REQ-099 c3 — a call to action that is the hero's field.
// src/app/(public)/_landing/FieldCta.tsx
//
// REQ-099 c3, verbatim: "every further call to action anywhere on the page
// brings that one field into view with the cursor in it, ready to type,
// without a page load and without adding a second input or a second submit
// control." Ruling 2b says the same thing from the other side: the landing
// may draw two solid primaries — the header's CTA and the hero's — and
// "every further CTA on the landing scrolls to the one field".
//
// So this is the *one* control on the page that is a call to action and not
// a submit: it moves the page to the field and puts the cursor in it. It is
// `type="button"`, so REQ-001 c1's count — one text input, one submit
// control — is untouched however many of these the page draws.
//
// **It scrolls and then focuses, in that order.** `focus()` alone scrolls
// the field into view in most browsers but lands it wherever the scroll
// container leaves it, often under the header; `scrollIntoView` first and
// `preventScroll` on the focus keeps the hero's whole first screen on
// screen, which is what c1 measures. `behavior: "smooth"` is not asked for:
// `prefers-reduced-motion` would then have to be read here, and the
// instant move is what a keyboard user gets anyway.
"use client";

import type React from "react";
import { Btn } from "@/ui/components/Btn";

/** The hero section's own id — the anchor the header, the closing CTA and
 *  the no-JavaScript fallback all name. One string, one home. */
export const FIELD_SECTION_ID = "landing-field";

export function FieldCta(p: { label: string; size?: "default" | "sm" }): React.JSX.Element {
  return (
    <Btn
      label={p.label}
      variant="primary"
      pill
      size={p.size}
      onClick={() => {
        const section = document.getElementById(FIELD_SECTION_ID);
        section?.scrollIntoView({ block: "start" });
        section?.querySelector("input")?.focus({ preventScroll: true });
      }}
    />
  );
}
