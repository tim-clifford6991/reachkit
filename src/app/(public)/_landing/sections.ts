// The landing's section anchors, in a module with no `"use client"` (issue
// 1510). A constant a server component reads from a client module reaches
// it as a client reference — a function that throws — so the header's two
// links once rendered `href="/#function(){throw Error(…"`. Server and client
// files alike import them from here.

/** The hero section's own id — the anchor every CTA on the landing names. */
export const FIELD_SECTION_ID = "landing-field";

/** Two landing sections' anchors, so a link from any route can reach them as `/#…`. */
export const WHY_SECTION_ID = "why";
export const HOW_SECTION_ID = "how";

/** The plan and the questions, in the board's names. */
export const PRICE_SECTION_ID = "weekly";
export const FAQ_SECTION_ID = "faq";
