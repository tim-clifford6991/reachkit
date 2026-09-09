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
}) satisfies CopyPartition;
