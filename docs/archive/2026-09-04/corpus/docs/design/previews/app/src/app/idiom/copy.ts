/**
 * COPY FOR THE THREE IDIOM SCREENS.
 *
 * Two kinds of string live here and they are kept apart on purpose, because
 * a transcribed string and an owed one look identical once they are both
 * inside quotation marks.
 *
 *   SIGNIN — OWNER-SUPPLIED, VERBATIM. The owner endorsed the live sign-in
 *   page by pointing at it ("this has always looked clean →
 *   https://reachkit.app/login") and attaching a screenshot. Every string in
 *   SIGNIN is transcribed from that page as the owner gave it. Not
 *   paraphrased, not improved, and not one string of the design-guardian's
 *   own is added to it (constitution §1: customer-visible strings are the
 *   owner's).
 *
 *   LANDING — OWED. BUILD.md §3's tagline is approved and stands, and it is
 *   the ONLY approved string on that page. Everything else is a bracketed
 *   slot in the corpus convention (src/mock/data.ts): the screen renders the
 *   bracket, so the hole is visible on the drawing rather than filled by a
 *   sentence nobody wrote. Rule 7.3 names long generated text in a UI as a
 *   defect; drafting it "as a suggestion" is how it arrives.
 *
 * The bracketed convention, unchanged:
 *   [thing — owner's]  a customer-visible sentence only the owner writes
 *   [thing]            a data identity supplied at runtime
 *   bare words         transcribed verbatim from an approved artifact
 */

/* ── The sign-in screen — every string owner-supplied, transcribed ──────── */
export const SIGNIN = {
  heading: "Welcome back",
  body: "Enter the email you paid with and we'll send you a sign-in link. No password — accounts are created by payment, never by a signup form.",
  fieldPlaceholder: "you@company.com",
  submit: "Send my link",
  /* One sentence, two clauses; the second clause is the accent link. Split
     only so the link can be marked up — the string is not edited. */
  newLead: "New to ReachKit? ",
  newLeadLink: "Start a free scan →",

  panelHeading: "One number tells you how findable you are.",
  /* A data identity, not copy. The domain the specimen score belongs to is
     the open question this screen raises — see the route's own note. */
  panelDomain: "[domain]",
  scoreLabel: "Discoverability Score",
  scorePill: "+6 pts est.",
  scoreValue: "47",
  scoreOf: "/100",
  scoreMax: 100,
  panelLine: "Hard to find — and we'll show you the fixes that move it.",
} as const;

/* ── The landing page — one approved string, sixteen owed ────────────────
   The numbering matches the enumerated list handed back with this route, so
   the owner can write them in one pass and they land in one place. */
export const LANDING = {
  /* APPROVED. BUILD.md §3, verbatim — the tagline stands and is the only
     string on this page that is not owed. */
  tagline: "See what AI tells buyers about your market — and write your way in.",

  subline: "[L1 · landing subline — owner's]",
  fieldLabel: "[L2 · hero field label — owner's]",
  fieldPlaceholder: "[L3 · hero field placeholder — owner's]",
  cta: "[L4 · hero CTA label — owner's]",
  specimenLabel: "[L5 · hero specimen label — owner's]",
  specimenCaption: "[L6 · hero specimen caption — owner's]",

  videoEyebrow: "[L7 · demo eyebrow — owner's]",
  videoHeading: "[L8 · demo heading — owner's]",
  videoBlocked: "[L9 · video-blocked line — owner's]",
  videoOpen: "[L10 · open-the-video label — owner's]",

  whyEyebrow: "[L11 · why-care eyebrow — owner's]",
  whyHeading: "[L12 · why-care heading — owner's]",
  whyBody: "[L13 · why-care body — owner's]",

  doesEyebrow: "[L14 · what-it-does eyebrow — owner's]",
  doesHeading: "[L15 · what-it-does heading — owner's]",
  does: [
    { title: "[L16 · what-it-does card 1 title — owner's]", line: "[L17 · what-it-does card 1 line — owner's]" },
    { title: "[L18 · what-it-does card 2 title — owner's]", line: "[L19 · what-it-does card 2 line — owner's]" },
    { title: "[L20 · what-it-does card 3 title — owner's]", line: "[L21 · what-it-does card 3 line — owner's]" },
  ],

  startEyebrow: "[L22 · how-to-start eyebrow — owner's]",
  startHeading: "[L23 · how-to-start heading — owner's]",
  startBody: "[L24 · how-to-start body — owner's]",
  startCta: "[L25 · how-to-start CTA label — owner's]",
} as const;

/* ── The overview, take A ────────────────────────────────────────────────
   Every module label and every written line on this screen already exists
   as a bracketed slot in src/mock/data.ts (OVERVIEW). The idiom adds no
   string of its own and this file adds none for it: a card head that needed
   a new sentence would be a new promise, and the idiom is a shape, not a
   promise. */
