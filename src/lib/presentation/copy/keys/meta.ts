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
// **Every value is the `TODO(copy)` marker, and none is drafted.** No
// approved artifact writes a `<title>`, an `og:description` or an image's
// alt text — the screen set draws screens, not document heads, and
// UI-SPEC.md carries no `favicon`, `og` or `Open Graph` line at all — so
// ruling 11a fills nothing here, and CLAUDE.md's rule 7.3 makes a helpful
// suggestion the worst available answer, because a suggestion is what
// survives to production. Issue #326's own Done-when says the same in its
// own words: "owner-owed strings as `meta.*` keys (`TODO(copy)` marker
// acceptable, stated)". They are stated, in the PR that adds them.
//
// **The marker rather than the empty value**, on the standing ruling of
// 2026-09-05 extended 2026-09-07 and 2026-09-08 ("the screen rule has no
// exceptions"): a screen renders the marker, a mail keeps the throw. A
// `metadata` export is read at module scope, so the empty value's throw
// would take the whole route down rather than one string on it — which
// makes the marker not merely the ruled choice here but the only safe one.
//
// **The site name is not a key of this partition.** `chrome.wordmark`
// already carries "ReachKit" for the public header, and `og:site_name` and
// the manifest's `name` are the same word on the same product. A second
// home for it would be rule 2.4's second copy.
import type { CopyPartition } from "../registry.ts";

export const META_COPY = Object.freeze({
  /* ── The two screens a stranger arrives at ────────────────────────── */
  "meta.landing.title": ["TODO(copy)", { slots: {}, fixedBy: "issue 326" }],
  /** Spent twice: the landing's `<meta name="description">` and the web
   *  manifest's `description`, which describe the same product to two
   *  readers. Read from one key rather than written twice (rule 2.4). */
  "meta.landing.description": ["TODO(copy)", { slots: {}, fixedBy: "issue 326" }],
  "meta.pricing.title": ["TODO(copy)", { slots: {}, fixedBy: "issue 326" }],
  "meta.pricing.description": ["TODO(copy)", { slots: {}, fixedBy: "issue 326" }],

  /* ── The three legal pages ────────────────────────────────────────────
     Their on-screen headings are `legal.*.title` and are approved as
     written ("Privacy", "Terms", "Imprint"). A document title is a
     different sentence: it is read out of context, in a tab strip and in a
     search result, where the heading alone says nothing about whose
     privacy notice it is. Owed rather than composed from the heading and
     the wordmark — composing one would be this file writing copy. */
  "meta.privacy.title": ["TODO(copy)", { slots: {}, fixedBy: "issue 326" }],
  "meta.privacy.description": ["TODO(copy)", { slots: {}, fixedBy: "issue 326" }],
  "meta.terms.title": ["TODO(copy)", { slots: {}, fixedBy: "issue 326" }],
  "meta.terms.description": ["TODO(copy)", { slots: {}, fixedBy: "issue 326" }],
  "meta.imprint.title": ["TODO(copy)", { slots: {}, fixedBy: "issue 326" }],
  "meta.imprint.description": ["TODO(copy)", { slots: {}, fixedBy: "issue 326" }],

  /* ── The four addresses no crawler may index ──────────────────────────
     A `noindex` page still has a browser tab, and its link is still pasted
     into a chat window that unfurls it — REQ-001 c7's copied address is
     exactly that. So a title and a description are owed here for the same
     reason they are owed above. The robots directive is a separate promise,
     carried by `_seo/routes.ts` and, for the two token paths, by
     `next.config.ts`'s header half. */
  "meta.signin.title": ["TODO(copy)", { slots: {}, fixedBy: "issue 326" }],
  "meta.signin.description": ["TODO(copy)", { slots: {}, fixedBy: "issue 326" }],
  /** The report's two carry `{domain}`: the address is per-domain, and a
   *  shared report link that unfurled as the same sentence for every domain
   *  would be the one place the product tells its reader nothing. The slot
   *  is declared now so that whatever the owner writes has to spend it. */
  "meta.report.title": ["TODO(copy)", { slots: { domain: "text" }, fixedBy: "issue 326" }],
  "meta.report.description": ["TODO(copy)", { slots: { domain: "text" }, fixedBy: "issue 326" }],
  "meta.veto.title": ["TODO(copy)", { slots: {}, fixedBy: "issue 326" }],
  "meta.veto.description": ["TODO(copy)", { slots: {}, fixedBy: "issue 326" }],
  "meta.optout.title": ["TODO(copy)", { slots: {}, fixedBy: "issue 326" }],
  "meta.optout.description": ["TODO(copy)", { slots: {}, fixedBy: "issue 326" }],

  /* ── The two generated share images ───────────────────────────────────
     `og:image:alt`. Not decoration: it is what a screen reader announces of
     an unfurled link, and what stands in when the image does not load.
     Neither declares a slot, and the report's cannot — Next reads an
     image's `alt` as a module-scope export, before any address is resolved,
     so no domain is in scope where the sentence is read. */
  "meta.og.alt": ["TODO(copy)", { slots: {}, fixedBy: "issue 326" }],
  "meta.report.og.alt": ["TODO(copy)", { slots: {}, fixedBy: "issue 326" }],
}) satisfies CopyPartition;
