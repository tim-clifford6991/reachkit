/**
 * Shared types for the legal pages (/privacy /terms /imprint) — Cycle 5 Task 11.
 *
 * Content lives as typed, exported objects (one per document) and is rendered
 * by the shared LegalLayout prose renderer in app/(marketing)/_legal-layout.tsx.
 * Keeping content data-only (no JSX) makes it trivial to review, diff, and — at
 * deploy time — swap the Impressum placeholders for the finalised DE entity.
 */

/**
 * One section of a legal document.
 *
 * - `heading` renders as an <h2>.
 * - `body` is one or more paragraphs (each string = one <p>).
 * - `list` (optional) renders as a <ul> after the body paragraphs.
 */
export interface LegalSection {
  heading: string;
  body: string[];
  list?: string[];
}

/** A complete legal document: page title + ordered sections. */
export interface LegalDocument {
  /** Page <h1> and the basis for <title> via buildMetadata. */
  title: string;
  /** Short sub-line under the title (one sentence). */
  intro: string;
  /** ISO date (YYYY-MM-DD) shown as the "Last updated" line. */
  lastUpdated: string;
  sections: LegalSection[];
}
