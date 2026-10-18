// The landing's section anchors, in a module with no `"use client"` (issue
// 1510). A constant a server component reads from a client module reaches
// it as a client reference — a function that throws — so the header's two
// links once rendered `href="/#function(){throw Error(…"`. Server and client
// files alike import them from here.

/** The hero section's own id — the anchor every CTA on the landing names. */
export const FIELD_SECTION_ID = "landing-field";

/** The two sections the public nav links to (#1066): *Why it matters* and
 *  *How to start*. Anchors on the landing, so the nav reaches them from
 *  every public route as `/#…`. */
export const WHY_SECTION_ID = "why";
export const HOW_SECTION_ID = "how";
