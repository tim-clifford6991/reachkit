// UI-SPEC S5 — which document each of the three legal routes is.
// src/app/(public)/_legal/documents.ts
//
// S5 is "one renderer for the three routes", so the only thing that differs
// between `/privacy`, `/terms` and `/imprint` is *which three keys* the
// renderer resolves. They are named here, once, as three frozen triples —
// not as a string discriminant a page passes and the renderer switches on.
// A triple is the whole difference between the routes, so a fourth legal
// document is a fourth entry here and a four-line `page.tsx`, and there is
// no branch in the renderer to extend.
import type { CopyKey } from "@/lib/presentation/copy";

/** The three sentences a legal page is made of: its title, the date the
 *  owner last revised it, and its body in Markdown. */
export interface LegalDocument {
  readonly title: CopyKey;
  /** The date alone — the renderer spends it in `legal.updated`'s slot, so
   *  the word "updated" is written once for all three documents and each
   *  document owes only its own date. */
  readonly updated: CopyKey;
  readonly body: CopyKey;
}

export const PRIVACY: LegalDocument = Object.freeze({
  title: "legal.privacy.title",
  updated: "legal.privacy.updated",
  body: "legal.privacy.body",
});

export const TERMS: LegalDocument = Object.freeze({
  title: "legal.terms.title",
  updated: "legal.terms.updated",
  body: "legal.terms.body",
});

export const IMPRINT: LegalDocument = Object.freeze({
  title: "legal.imprint.title",
  updated: "legal.imprint.updated",
  body: "legal.imprint.body",
});
