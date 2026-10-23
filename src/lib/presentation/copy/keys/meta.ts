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
// 2026-09-10, issue #459: the owner approved the drafted copy for
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
  "meta.landing.title": ["Get found on Google and AI · ReachKit", { slots: {}, fixedBy: "issue 326" }],
  /** Spent twice: the landing's `<meta name="description">` and the web
   *  manifest's `description`, which describe the same product to two
   *  readers. Read from one key rather than written twice (rule 2.4). */
  "meta.landing.description": ["Free scan, no account: see where Google and AI send buyers to your competitors, then let ReachKit publish up to {weekPages} pages a week, new or updated, to close the gap.", { slots: { weekPages: "text" }, fixedBy: "issue 326 · owner A1 2026-10-19" }],
  "meta.pricing.title": ["Pricing · €49 a month · ReachKit", { slots: {}, fixedBy: "issue 326" }],
  "meta.pricing.description": ["One plan at €49 a month, VAT included: up to {weekPages} pages a week for your site, new or updated, a weekly scan of your market, and time to stop any page before it goes live.", { slots: { weekPages: "text" }, fixedBy: "issue 326 · owner A1 2026-10-19" }],

  /* ── The three legal pages ────────────────────────────────────────────
     Their on-screen headings are `legal.*.title` and are approved as
     written ("Privacy", "Terms", "Imprint"). A document title is a
     different sentence: it is read out of context, in a tab strip and in a
     search result, where the heading alone says nothing about whose
     privacy notice it is. Its own key rather than composed from the
     heading and the wordmark — composing one would be this file writing
     copy. */
  "meta.privacy.title": ["Privacy · ReachKit", { slots: {}, fixedBy: "issue 326" }],
  "meta.privacy.description": ["How ReachKit handles personal data: what a free scan stores, what your email is used for, who processes it, and how to ask for a report’s removal.", { slots: {}, fixedBy: "issue 326" }],
  "meta.terms.title": ["Terms · ReachKit", { slots: {}, fixedBy: "issue 326" }],
  "meta.terms.description": ["The terms for using ReachKit: the free report, the €49 monthly subscription, cancellation, and what ReachKit publishes for you.", { slots: {}, fixedBy: "issue 326" }],
  "meta.imprint.title": ["Imprint · ReachKit", { slots: {}, fixedBy: "issue 326" }],
  "meta.imprint.description": ["Who operates ReachKit: the legal entity, its address, and how to reach it.", { slots: {}, fixedBy: "issue 326" }],

  /* ── The four addresses no crawler may index ──────────────────────────
     A `noindex` page still has a browser tab, and its link is still pasted
     into a chat window that unfurls it — REQ-001 c7's copied address is
     exactly that. So a title and a description are needed here for the
     same reason they are needed above. The robots directive is a separate
     promise, carried by `_seo/routes.ts` and, for the two token paths, by
     `next.config.ts`'s header half. */
  "meta.signin.title": ["Sign in · ReachKit", { slots: {}, fixedBy: "issue 326" }],
  "meta.signin.description": ["Enter the email you paid with and ReachKit sends you a sign-in link. No password.", { slots: {}, fixedBy: "issue 326" }],
  /** The report's two carry `{domain}`: the address is per-domain, and a
   *  shared report link that unfurled as the same sentence for every domain
   *  would be the one place the product tells its reader nothing. The slot
   *  is declared so that the owner's sentence has to spend it. */
  /** `/scans` — indexed, unlike the reports it lists (SPEC §2 2026-09-24,
   *  #1058). Drafted for the owner (#1069). */
  "meta.scans.title": ["Free scans · ReachKit", { slots: {}, fixedBy: "issue 1069 · drafted" }],
  "meta.scans.description": ["Every free ReachKit scan, listed: how each business shows up on Google and in AI answers, its Visibility Score, and a permanent link to its report.", { slots: {}, fixedBy: "issue 1069 · drafted" }],
  // Issue 1396: the two pages that say how the product works and who
  // builds it. Drafted; named in that pull request.
  "meta.how.title": ["How it works · ReachKit", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "meta.how.description": ["What ReachKit measures on Google and in AI answers, how a page for your site is chosen and written, the checks before it goes live, and what you control.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "meta.about.title": ["About · ReachKit", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "meta.about.description": ["Who builds ReachKit and why, and the rules it keeps about what it publishes.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  // Issue 1458: the pages Google still ranks from earlier versions. An article's own title and description are its data; the two slots below carry them.
  "meta.compare.title": ["Compare · ReachKit", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "meta.compare.description": ["How ReachKit compares with SEO suites, on-page checkers and AI tools: what each does well, what ReachKit does instead, and when to pick which.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "meta.teardowns.title": ["Teardowns · ReachKit", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "meta.teardowns.description": ["How real products present themselves to buyers on Google and in AI answers, read from the outside, dated and revised.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "meta.tools.title": ["Free SEO tools · ReachKit", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "meta.tools.description": ["Free SEO tools with no account: preview how a page looks in Google and when shared, and check the tags search engines read on any page.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "meta.tools.meta.title": ["Meta tag preview · ReachKit", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "meta.tools.meta.description": ["Free, no account: see how a page looks in a Google result and when shared on X, LinkedIn or Slack, and which title, description and share tags are missing.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "meta.tools.onpage.title": ["Free on-page SEO check · ReachKit", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "meta.tools.onpage.description": ["Free, no account: check one page’s title, meta description, main heading, canonical, indexing, structured data, share tags, phone layout and image text.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "meta.article.title": ["{title} · ReachKit", { slots: { title: "text" }, fixedBy: "issue 1458 · drafted" }],
  "meta.article.description": ["{description}", { slots: { description: "text" }, fixedBy: "issue 1458 · drafted" }],
  "meta.report.title": ["{domain} · Visibility Score · ReachKit", { slots: { domain: "text" }, fixedBy: "issue 326" }],
  "meta.report.description": ["How easily buyers find {domain} on Google and in AI answers, and the pages that would change it. Permanent link.", { slots: { domain: "text" }, fixedBy: "issue 326 · issue 1309" }],
  "meta.veto.title": ["Stop this page · ReachKit", { slots: {}, fixedBy: "issue 326" }],
  "meta.veto.description": ["A page ReachKit wrote for your site is waiting to publish. Stop it here in one step, or do nothing and it goes live as planned.", { slots: {}, fixedBy: "issue 326" }],
  "meta.optout.title": ["Unsubscribed · ReachKit", { slots: {}, fixedBy: "issue 326" }],
  "meta.optout.description": ["This link stops every follow-up email from ReachKit to your address. The page you asked for stays yours.", { slots: {}, fixedBy: "issue 326" }],
  // Issue 1512: the 404 had no `<title>`. Next reads no `metadata` from a `not-found.tsx`, so the screen renders this one itself.
  "meta.notfound.title": ["Page not found · ReachKit", { slots: {}, fixedBy: "issue 1512 · drafted" }],

  /* ── The two generated share images ───────────────────────────────────
     `og:image:alt`. Not decoration: it is what a screen reader announces of
     an unfurled link, and what stands in when the image does not load.
     Neither declares a slot, and the report's cannot — Next reads an
     image's `alt` as a module-scope export, before any address is resolved,
     so no domain is in scope where the sentence is read. */
  "meta.og.alt": ["ReachKit wordmark on a plain card, with the site’s address beneath it.", { slots: {}, fixedBy: "issue 326" }],
  "meta.report.og.alt": ["A ReachKit report card: the domain, its Visibility Score and the band word.", { slots: {}, fixedBy: "issue 326" }],

  /* ── The signed-in screens (#945) ─────────────────────────────────────
     Every `(account)` route had **no `<title>` at all** — axe's
     `document-title`, a serious finding on eight routes, because nothing
     under `src/app/(account)/` exported `metadata` and the root layout
     declared no default. These are the eight titles, in the shape the
     static public rows already use ("<Screen> — ReachKit").

     They carry a title and nothing else. A public row owes a search result
     two sentences, an Open Graph block and a canonical address; a signed-in
     screen is behind a session and is nobody's search result, so a
     description here would be a sentence written for a reader that does not
     exist. What it owes is the one thing #945 asks for: a person holding
     twenty tabs can tell which screen they are on.

     Each word is the one the product already says on the screen itself —
     `shell.nav.overview`, `overview.tab.search`,
     `overview.tile.ai-answers.label`, `overview.tab.rivals`,
     `shell.nav.plan`, `shell.nav.settings`, `setup.progress.setup`. They
     are spelled out rather than composed from those keys because a `<title>`
     is a sentence in its own right and this partition's whole point is that
     the sentence a reader sees is the string written here (rule 8). The
     wordmark is still `chrome.wordmark`'s where it stands alone — the
     `(account)` layout's fallback reads that key, not a copy of it.

     Drafted under the owner's 2026-09-16 ruling (#759) and named in the
     PR body so the owner can correct any of them. */
  "meta.app.overview.title": ["Overview · ReachKit", { slots: {}, fixedBy: "issue 945" }],
  "meta.app.search.title": ["Google · ReachKit", { slots: {}, fixedBy: "issue 945" }],
  "meta.app.ai-answers.title": ["AI · ReachKit", { slots: {}, fixedBy: "issue 945" }],
  "meta.app.rivals.title": ["Competitors · ReachKit", { slots: {}, fixedBy: "issue 945" }],
  "meta.app.plan.title": ["Plan · ReachKit", { slots: {}, fixedBy: "issue 945" }],
  "meta.app.draft.title": ["Your page · ReachKit", { slots: {}, fixedBy: "issue 945" }],
  // Owner ruling 2026-09-21 (#984): the page editor's tab says which page.
  // The title is the draft's own — model-written, and reaching a browser
  // tab through a slot in a written sentence, never as a sentence of ours.
  // The key above stays the floor: a draft with no title yet, and an id
  // that resolves to nothing, read it.
  "meta.app.draft.title.page": [
    "{title} · ReachKit",
    { slots: { title: "text" }, fixedBy: "owner 2026-09-21 · issue 984" },
  ],
  "meta.app.settings.title": ["Settings · ReachKit", { slots: {}, fixedBy: "issue 945" }],
  "meta.app.setup.title": ["Setup · ReachKit", { slots: {}, fixedBy: "issue 945" }],
  // #924: the DNS step after setup is its own address, so it says which
  // screen it is rather than falling back to the account layout's floor.
  "meta.app.setup.connect.title": [
    "Connect your website · ReachKit",
    { slots: {}, fixedBy: "owner E11 · issue 1601" },
  ],

  /* ── Settings' six sibling tabs (#925) ────────────────────────────────
     Settings became seven addresses on 2026-09-21, and #945's promise is
     that a person holding twenty tabs can tell which screen they are on.
     `/app/settings` keeps "Settings — ReachKit" above, because it *is* the
     address Settings; each sibling names itself inside it.

     **They cannot share one title**, and that is the test's own rule, not a
     preference: `tests/app/seo/account-title.test.ts` asserts "no two
     screens announce the same thing", so six tabs pointed at
     `meta.app.settings.title` would fail it — and rightly, since a reader
     on Billing would be told only that they are somewhere in Settings.

     The tab word is the one the bar says (`settings.tab.market`,
     `settings.publishing.title`, `settings.tab.voice`, `settings.tab.mail`,
     `settings.billing.title`, `settings.account.title`), spelled out rather
     than composed for the reason the eight above are: a `<title>` is a
     sentence in its own right and this partition's point is that the
     sentence a reader sees is the string written here (rule 8).

     Drafted under the owner's 2026-09-16 ruling (#759) and named in the PR
     body so the owner can correct any of them. */
  "meta.app.settings.market.title": [
    "Market and competitors · Settings · ReachKit",
    { slots: {}, fixedBy: "issue 925" },
  ],
  "meta.app.settings.publishing.title": [
    "Publishing · Settings · ReachKit",
    { slots: {}, fixedBy: "issue 925" },
  ],
  "meta.app.settings.voice.title": [
    "Your voice · Settings · ReachKit",
    { slots: {}, fixedBy: "issue 925" },
  ],
  "meta.app.settings.mail.title": [
    "Mail · Settings · ReachKit",
    { slots: {}, fixedBy: "issue 925" },
  ],
  "meta.app.settings.billing.title": [
    "Billing · Settings · ReachKit",
    { slots: {}, fixedBy: "issue 925" },
  ],
  "meta.app.settings.account.title": [
    "Account · Settings · ReachKit",
    { slots: {}, fixedBy: "issue 925" },
  ],
  // Issue 1478 (drafted): the owner's cost page.
  "meta.app.costs.title": ["Costs · ReachKit", { slots: {}, fixedBy: "issue 1478 (drafted)" }],
  // Issue 1550 (drafted): the account's view of the checks it fixes.
  "meta.app.issues.title": ["Technical issues · ReachKit", { slots: {}, fixedBy: "issue 1550 (drafted)" }],
}) satisfies CopyPartition;
