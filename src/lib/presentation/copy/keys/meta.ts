// BUILD §2.5 · §3 — what a public route says about itself in its own <head>.
// src/lib/presentation/copy/keys/meta.ts — issue #326
//
// The fifteenth partition. Every `(public)` route now exports a document
// title, a description, an Open Graph title and description and a Twitter
// card, and each one of those is a sentence the product speaks —
// spoken to a search result, a shared link and a browser tab rather than to
// a screen, but a sentence all the same (ARCHITECTURE rule 8). So they are
// keys here and not literals in nine `metadata` exports, which the
// string-literal sweep would *not* have caught: its four rules are JSX-
// shaped (`jsx-text`, `jsx-expression-string`, `jsx-attribute`) plus one
// mail-body rule scoped to `src/lib/mail/`, and a `metadata` object is
// neither. The rule that keeps these honest is this file existing.
//
// Growing the closed list to fifteen is the two-line change `registry.ts`
// describes — one import, one spread — and the named row in
// `registry.test.ts`, on the footing `keys/chrome.ts` records for the
// fourteenth: BP-020 decision 5 named eleven partitions before the
// BP-001-owned surfaces existed, and a surface's sentences must land in
// some partition.
//
// No approved artifact writes a `<title>`, an `og:description` or an
// image's alt text — the screen set draws screens, not document heads, and
// UI-SPEC.md carries no `favicon`, `og` or `Open Graph` line at all — so
// ruling 11a fills nothing here, and every value is the owner's. Issue
// #326 landed them as "owner-owed strings as `meta.*` keys (`TODO(copy)`
// marker acceptable, stated)".
//
// **The marker rather than the empty value** was the choice while they
// were owed, on the standing ruling of 2026-09-05 extended 2026-09-07 and
// 2026-09-08 ("the screen rule has no exceptions"): a screen renders the
// marker, a mail keeps the throw. A `metadata` export is read at module
// scope, so the empty value's throw would take the whole route down rather
// than one string on it.
//
// 2026-09-10, issue #459: the owner approved the master's drafted copy for
// every key this partition still owed ("copy proposal approved"; proposal
// sheet artifact 546f45a0-a996-4d25-b85e-fb03fda7b102), and the 20 approved
// strings are applied here byte for byte. No key in this partition is
// owner-owed or `TODO(copy)` any more.
//
// **The site name is not a key of this partition.** `chrome.wordmark`
// already carries "ReachKit" for the public header, and `og:site_name` and
// the manifest's `name` are the same word on the same product. A second
// home for it would be rule 2.4's second copy.
import type { CopyPartition } from "../registry.ts";

export const META_COPY = Object.freeze({
  /* ── The two screens a stranger arrives at ────────────────────────── */
  "meta.landing.title": ["ReachKit — see what AI tells buyers about your market", { slots: {}, fixedBy: "issue 326" }],
  /** Spent twice: the landing's `<meta name="description">` and the web
   *  manifest's `description`, which describe the same product to two
   *  readers. Read from one key rather than written twice (rule 2.4). */
  "meta.landing.description": ["Free scan, no account: see where AI answers and Google send buyers to your rivals, then let ReachKit write one page a day to close the gap.", { slots: {}, fixedBy: "issue 326" }],
  "meta.pricing.title": ["Pricing — ReachKit, €49 a month", { slots: {}, fixedBy: "issue 326" }],
  "meta.pricing.description": ["One plan at €49 a month, VAT included: a page a day written and published for your site, a weekly re-measure of your market, a 24-hour veto on every page.", { slots: {}, fixedBy: "issue 326" }],

  /* ── The three legal pages ────────────────────────────────────────────
     Their on-screen headings are `legal.*.title` and are approved as
     written ("Privacy", "Terms", "Imprint"). A document title is a
     different sentence: it is read out of context, in a tab strip and in a
     search result, where the heading alone says nothing about whose
     privacy notice it is. Its own key rather than composed from the
     heading and the wordmark — composing one would be this file writing
     copy. */
  "meta.privacy.title": ["Privacy — ReachKit", { slots: {}, fixedBy: "issue 326" }],
  "meta.privacy.description": ["How ReachKit handles personal data: what a free scan stores, what your email is used for, who processes it, and how to ask for a report’s removal.", { slots: {}, fixedBy: "issue 326" }],
  "meta.terms.title": ["Terms — ReachKit", { slots: {}, fixedBy: "issue 326" }],
  "meta.terms.description": ["The terms for using ReachKit: the free report, the €49 monthly subscription, cancellation, and what ReachKit publishes for you.", { slots: {}, fixedBy: "issue 326" }],
  "meta.imprint.title": ["Imprint — ReachKit", { slots: {}, fixedBy: "issue 326" }],
  "meta.imprint.description": ["Who operates ReachKit: the legal entity, its address, and how to reach it.", { slots: {}, fixedBy: "issue 326" }],

  /* ── The four addresses no crawler may index ──────────────────────────
     A `noindex` page still has a browser tab, and its link is still pasted
     into a chat window that unfurls it — REQ-001 c7's copied address is
     exactly that. So a title and a description are needed here for the
     same reason they are needed above. The robots directive is a separate
     promise, carried by `_seo/routes.ts` and, for the two token paths, by
     `next.config.ts`'s header half. */
  "meta.signin.title": ["Sign in — ReachKit", { slots: {}, fixedBy: "issue 326" }],
  "meta.signin.description": ["Enter the email you paid with and ReachKit sends you a sign-in link. No password.", { slots: {}, fixedBy: "issue 326" }],
  /** The report's two carry `{domain}`: the address is per-domain, and a
   *  shared report link that unfurled as the same sentence for every domain
   *  would be the one place the product tells its reader nothing. The slot
   *  is declared so that the owner's sentence has to spend it. */
  "meta.report.title": ["{domain} · Discoverability Score · ReachKit", { slots: { domain: "text" }, fixedBy: "issue 326" }],
  "meta.report.description": ["How findable {domain} is in Google and in AI answers, against its market’s 12 biggest searches — and the pages that would change it. Permanent link.", { slots: { domain: "text" }, fixedBy: "issue 326" }],
  "meta.veto.title": ["Stop this page — ReachKit", { slots: {}, fixedBy: "issue 326" }],
  "meta.veto.description": ["A page ReachKit wrote for your site is waiting to publish. Stop it here in one step, or do nothing and it goes live as planned.", { slots: {}, fixedBy: "issue 326" }],
  "meta.optout.title": ["Opted out — ReachKit", { slots: {}, fixedBy: "issue 326" }],
  "meta.optout.description": ["This link stops every follow-up email from ReachKit to your address. The page you asked for stays yours.", { slots: {}, fixedBy: "issue 326" }],

  /* ── The two generated share images ───────────────────────────────────
     `og:image:alt`. Not decoration: it is what a screen reader announces of
     an unfurled link, and what stands in when the image does not load.
     Neither declares a slot, and the report's cannot — Next reads an
     image's `alt` as a module-scope export, before any address is resolved,
     so no domain is in scope where the sentence is read. */
  "meta.og.alt": ["ReachKit wordmark on a plain card, with the site’s address beneath it.", { slots: {}, fixedBy: "issue 326" }],
  "meta.report.og.alt": ["A ReachKit report card: the domain, its Discoverability Score and the band word.", { slots: {}, fixedBy: "issue 326" }],
}) satisfies CopyPartition;
