// BUILD §3 — the public shell's sentences, and the three legal pages.
// src/lib/presentation/copy/keys/chrome.ts — issue #266
//
// The fourteenth partition. `BUILD.md` names no public chrome at all —
// §3 says v3 "follows the shipped reachkit.app journey" and fixes the
// landing as "one field, one button", and no section of §4 describes a
// header, a footer or a legal page. The owner's 2026-09-07 review
// ("barely a shell — we are clearly missing the UI framework, navbars,
// footers") is what opened it, and the surfaces are built under the
// master's ship-then-steer ruling with the mockup linked on #266 and
// labelled *proposed — not in the approved idiom*: no approved artifact
// draws either surface, which is exactly why every sentence below is
// owner-owed rather than transcribed from one.
//
// **Every value here is the `TODO(copy)` marker.** Not one is written,
// and none is drafted "as a suggestion" — rule 7.3 names generated prose
// in the product as a defect, and a suggestion is what survives. The
// marker rather than the empty value on the standing ruling (2026-09-05,
// extended 2026-09-07): screens render the marker, mail keeps the throw,
// so a page whose chrome is unwritten still renders and can be reviewed.
//
// `chrome.wordmark` is owed rather than filled even though
// `mail.shell.wordmark` already carries "ReachKit": that one is
// transcribed from REQ-062's own quoted string, and nothing quotes the
// wordmark as the public header sets it. A second home for a string is
// rule 2.4's second copy; a second *decision* about it is the owner's.
import type { CopyPartition } from "../registry.ts";

export const CHROME_COPY = Object.freeze({
  /* ── The header ──────────────────────────────────────────────────── */
  // Approved as written (ruling 11a): the screen set draws "ReachKit" as
  // the wordmark in the sidebar's brand row (S12) and in the public header
  // (S1). `mail.shell.wordmark` keeps its own copy — a mail cannot read a
  // stylesheet, so the two are different surfaces spending the same word,
  // which is why this key exists rather than one being imported.
  "chrome.wordmark": ["ReachKit", { slots: {}, fixedBy: "UI-SPEC S12 · S1" }],
  // The footer's two Product links (UI-SPEC 3a). Approved as written.
  "chrome.nav.pricing": ["Pricing", { slots: {}, fixedBy: "UI-SPEC S1 · 3a" }],
  "chrome.nav.signin": ["Sign in", { slots: {}, fixedBy: "UI-SPEC S1 · 3a" }],
  /** The header's one solid CTA (UI-SPEC 3a). **It IS rendered on the
   *  landing** since ruling 2b of 2026-09-08 — "two solid primaries per
   *  screen are allowed where the artifact draws them (landing: header CTA
   *  + hero CTA)" — which supersedes the one-primary reading #290 applied
   *  here. Still owed: the set brackets the label. */
  "chrome.cta.scan": ["TODO(copy)", { slots: {}, fixedBy: "issue 266" }],
  /** The accessible name of the compact-band control that opens the
   *  links. It is the registered `Collapse`, listing them under the
   *  header — never a drawer or a dropdown (master, 2026-09-07). */
  "chrome.nav.menu": ["TODO(copy)", { slots: {}, fixedBy: "issue 266" }],

  /* ── The footer ──────────────────────────────────────────────────── */
  "chrome.footer.product": ["Product", { slots: {}, fixedBy: "the approved screen set · 3a" }],
  "chrome.footer.legal": ["Legal", { slots: {}, fixedBy: "the approved screen set · 3a" }],
  /** §4.2's removal address, named from the footer so a person who never
   *  opened an email can still find it. */
  "chrome.footer.opt-out": [
    // The address is a slot, not a literal: `removal.address` (REQ-002 c1)
    // is its one home in the registry, and a second copy here would be a
    // second place to change it. The sentence is the set's, as written.
    "Own this site and want its report taken down? Write to {address}.",
    { slots: { address: "text" }, fixedBy: "the approved screen set · 3a" },
  ],
  "chrome.footer.rights": ["TODO(copy)", { slots: {}, fixedBy: "issue 266" }],

  /* ── S4, the pricing page (issue #369) ─────────────────────────────── */
  //
  // The page around the offer. Its eyebrow is `offer.start` — the same two
  // words, from the key that owns them — so only three strings are new
  // here: the heading and the subline the set brackets, and the footnote it
  // spells out.
  "pricing.heading": ["TODO(copy)", { slots: {}, fixedBy: "REQ-021 c4" }],
  "pricing.subline": ["TODO(copy)", { slots: {}, fixedBy: "REQ-021 c4" }],
  /** REQ-020 c1's promise, in the set's own words: nothing is asked for
   *  before payment, and the site comes after. */
  "pricing.footnote": [
    "No account before payment. Your site is asked for after — or confirmed, if you came from a report.",
    { slots: {}, fixedBy: "UI-SPEC S4 · REQ-020 c1" },
  ],
  /* ── The two pages every route falls back to (UI-SPEC S8) ────────────
     Not found and error. They are the *shell's* own pages rather than any
     screen's — no route serves them, both route groups mount them, and the
     public pair renders inside this partition's header and footer — which
     is why their sentences live here beside the chrome's and not in a
     fifteenth partition of their own.

     The 404's four strings are the approved set's, unbracketed, so 11a
     makes them approved copy as written. **The error page's are not, all
     three of them.** S8 says only "the error page is the same shape with
     one written line" and draws none of it, so its eyebrow, its heading
     and its line are the owner's and carry the marker.

     The eyebrow was written here — "Something went wrong", issue #372's own
     Done-when wording — and is owed again on the master's review of #407
     (2026-09-09): a Done-when is the master's brief, not the owner's pen,
     and rule 6 leaves exactly two footings for a rendered string, the set's
     unbracketed word (11a) or a BUILD/REQ line quoted verbatim. It has
     neither. Nothing in BUILD.md or the archived REQ set writes it. */
  "chrome.notfound.eyebrow": ["404", { slots: {}, fixedBy: "UI-SPEC S8 (11a)" }],
  "chrome.notfound.heading": [
    "There is no page at this address.",
    { slots: {}, fixedBy: "UI-SPEC S8 (11a)" },
  ],
  /** The address is a slot and not part of the sentence: the set draws it
   *  in mono inside the line (§2 — "numerals, dates, URLs … JetBrains
   *  Mono"), and a face is not something a string can carry. */
  "chrome.notfound.line": [
    "Reports live at {address}.",
    { slots: { address: "text" }, fixedBy: "UI-SPEC S8 (11a)" },
  ],
  /** The shape of a report address, as the set writes it. A specimen, not
   *  a link: it names the form, and the field below it is how a reader
   *  spends it. */
  "chrome.notfound.address": [
    "reachkit.app/scan/yourdomain.com",
    { slots: {}, fixedBy: "UI-SPEC S8 (11a)" },
  ],
  "chrome.notfound.cta": ["Scan it", { slots: {}, fixedBy: "UI-SPEC S8 (11a)" }],
  /** The same 404 inside the app, where the set's line does not belong: a
   *  customer who is signed in is not being sent to a report address they
   *  already have. S8 draws no account arm, so the line is the owner's
   *  (12a — built in the set's idiom, written by the owner). */
  "chrome.notfound.line.app": ["TODO(copy)", { slots: {}, fixedBy: "UI-SPEC S8 (12a)" }],
  "chrome.error.eyebrow": ["TODO(copy)", { slots: {}, fixedBy: "UI-SPEC S8 (12a)" }],
  "chrome.error.heading": ["TODO(copy)", { slots: {}, fixedBy: "UI-SPEC S8 (12a)" }],
  "chrome.error.line": ["TODO(copy)", { slots: {}, fixedBy: "UI-SPEC S8 (12a)" }],

  /* ── The waiting state every screen that reads shares (UI-SPEC §4 rule 3)
     Issue #327. "Every empty, degraded or waiting state is one written
     line; never a spinner, never a blank card" — so a route's `loading.tsx`
     is one sentence and no furniture, and this is the sentence.

     Owner-owed, and it can have no other footing: no approved artifact
     draws a waiting screen, so 11a does not reach it, and neither BUILD.md
     nor the archived REQ set writes the words. It is one key rather than
     two because both mounts say the same thing — unlike the 404, whose
     public line names a report address a signed-in customer is not being
     sent to. If the owner wants the report's wait and the app's wait to
     read differently, the split is theirs and it is a second key here. */
  "chrome.loading.line": ["TODO(copy)", { slots: {}, fixedBy: "UI-SPEC §4 rule 3 (12a)" }],

  /* ── The two ways back ────────────────────────────────────────────────
     One label each, and each has exactly one home even though two surfaces
     spend it: `chrome.back-to-reachkit` is S7's quiet control and the one
     way off `global-error`, which renders outside every group and so has
     no chrome to offer a reader instead. */
  "chrome.back-to-reachkit": ["Back to ReachKit", { slots: {}, fixedBy: "UI-SPEC S7 (11a)" }],
  "chrome.back-to-overview": ["Back to Overview", { slots: {}, fixedBy: "UI-SPEC S8 · issue 372" }],

  /* ── The three legal pages ───────────────────────────────────────────
     One title and one body each, and the body is the whole page. These
     are the owner's to write in the strongest sense in the product: a
     privacy statement or a set of terms drafted by anything but the
     owner is a legal claim nobody made. The routes exist so the footer
     links reach a page rather than a 404, and each renders its marker
     until written. */
  "legal.privacy.title": ["Privacy", { slots: {}, fixedBy: "the approved screen set · 3a" }],
  "legal.privacy.body": ["TODO(copy)", { slots: {}, fixedBy: "issue 266" }],
  "legal.terms.title": ["Terms", { slots: {}, fixedBy: "the approved screen set · 3a" }],
  "legal.terms.body": ["TODO(copy)", { slots: {}, fixedBy: "issue 266" }],
  "legal.imprint.title": ["Imprint", { slots: {}, fixedBy: "the approved screen set · 3a" }],
  "legal.imprint.body": ["TODO(copy)", { slots: {}, fixedBy: "issue 266" }],

  /* ── S5's own two lines, and the date each document owes ──────────────
     2026-09-09, issue #370. The approved set draws the screen as "eyebrow
     Legal · title · updated [date] · one card". Two of those are strings
     the set writes unbracketed, and ruling 11a therefore approves as
     written: the eyebrow's own word, and "updated" in front of the date.

     The date itself is bracketed, so it is the owner's — and it is one
     date per document, not one for the product: a privacy statement and a
     set of terms are revised on their own days. So `legal.updated` is the
     sentence, written once, and each document owes only the date that goes
     in its slot. Until the owner writes one the line reads "updated
     TODO(copy)", which is the marker doing its job — the line is visibly
     present and visibly unwritten (rule 8) rather than a page with a blank
     where a revision date belongs. */
  "legal.eyebrow": ["Legal", { slots: {}, fixedBy: "UI-SPEC S5 (11a)" }],
  "legal.updated": [
    "updated {date}",
    { slots: { date: "date" }, fixedBy: "UI-SPEC S5 (11a)" },
  ],
  "legal.privacy.updated": ["TODO(copy)", { slots: {}, fixedBy: "UI-SPEC S5" }],
  "legal.terms.updated": ["TODO(copy)", { slots: {}, fixedBy: "UI-SPEC S5" }],
  "legal.imprint.updated": ["TODO(copy)", { slots: {}, fixedBy: "UI-SPEC S5" }],
}) satisfies CopyPartition;
