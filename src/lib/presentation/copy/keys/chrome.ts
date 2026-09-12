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
// draws either surface, which is why every sentence below that the set
// does not write is the owner's rather than transcribed from one.
//
// 2026-09-10, issue #459: the owner approved the master's drafted copy for
// every key this partition still owed ("copy proposal approved"; proposal
// sheet artifact 546f45a0-a996-4d25-b85e-fb03fda7b102), and the 16 approved
// strings are applied here byte for byte. No key in this partition is
// owner-owed or `TODO(copy)` any more. The legal bodies' bracketed
// `[[imprint: …]]` placeholder is part of the approved strings themselves.
import type { CopyPartition } from "../registry.ts";

export const CHROME_COPY = Object.freeze({
  /* ── The header ──────────────────────────────────────────────────── */
  // Approved as written (ruling 11a): the screen set draws "ReachKit" as
  // the wordmark in the sidebar's brand row (S12) and in the public header
  // (S1). `mail.shell.wordmark` keeps its own copy — a mail cannot read a
  // stylesheet, so the two are different surfaces spending the same word,
  // which is why this key exists rather than one being imported.
  "chrome.wordmark": ["ReachKit", { slots: {}, fixedBy: "S12 · S1" }],
  // The footer's two Product links (UI-SPEC 3a). Approved as written.
  "chrome.nav.pricing": ["Pricing", { slots: {}, fixedBy: "S1 · 3a" }],
  "chrome.nav.signin": ["Sign in", { slots: {}, fixedBy: "S1 · 3a" }],
  /** The header's one solid CTA (UI-SPEC 3a). **It IS rendered on the
   *  landing** since ruling 2b of 2026-09-08 — "two solid primaries per
   *  screen are allowed where the artifact draws them (landing: header CTA
   *  + hero CTA)" — which supersedes the one-primary reading #290 applied
   *  here. The set brackets the label, so it is the owner's (approved
   *  2026-09-10, #459). */
  "chrome.cta.scan": ["Free scan", { slots: {}, fixedBy: "issue 266" }],
  /** The accessible name of the compact-band control that opens the
   *  links. It is the registered `Collapse`, listing them under the
   *  header — never a drawer or a dropdown (master, 2026-09-07). */
  "chrome.nav.menu": ["Menu", { slots: {}, fixedBy: "issue 266" }],

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
  "chrome.footer.rights": ["© 2026 ReachKit. All rights reserved.", { slots: {}, fixedBy: "issue 266" }],

  /* ── S4, the pricing page (issue #369) ─────────────────────────────── */
  //
  // The page around the offer. Its eyebrow is `offer.start` — the same two
  // words, from the key that owns them — so only three strings are new
  // here: the heading and the subline the set brackets, and the footnote it
  // spells out.
  "pricing.heading": ["One plan. One page a day.", { slots: {}, fixedBy: "REQ-021 c4" }],
  "pricing.subline": ["€49 a month, VAT included. A page written and published for your site every day, your market re-measured every week. Cancel any time.", { slots: {}, fixedBy: "REQ-021 c4" }],
  /** REQ-020 c1's promise, in the set's own words: nothing is asked for
   *  before payment, and the site comes after. */
  "pricing.footnote": [
    "No account before payment. Your site is asked for after — or confirmed, if you came from a report.",
    { slots: {}, fixedBy: "S4 · REQ-020 c1" },
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
     and its line are the owner's (approved 2026-09-10, #459).

     The eyebrow was once written here — "Something went wrong", issue
     #372's own Done-when wording — and was returned to owed on the master's
     review of #407 (2026-09-09): a Done-when is the master's brief, not
     the owner's pen, and rule 6 leaves exactly two footings for a rendered
     string, the set's unbracketed word (11a) or a BUILD/REQ line quoted
     verbatim. It had neither. Nothing in BUILD or the archived REQ set writes it. */
  "chrome.notfound.eyebrow": ["404", { slots: {}, fixedBy: "S8 (11a)" }],
  "chrome.notfound.heading": [
    "There is no page at this address.",
    { slots: {}, fixedBy: "S8 (11a)" },
  ],
  /** The address is a slot and not part of the sentence: the set draws it
   *  in mono inside the line (§2 — "numerals, dates, URLs … JetBrains
   *  Mono"), and a face is not something a string can carry. */
  "chrome.notfound.line": [
    "Reports live at {address}.",
    { slots: { address: "text" }, fixedBy: "S8 (11a)" },
  ],
  /** The shape of a report address, as the set writes it. A specimen, not
   *  a link: it names the form, and the field below it is how a reader
   *  spends it. */
  "chrome.notfound.address": [
    "reachkit.app/scan/yourdomain.com",
    { slots: {}, fixedBy: "S8 (11a)" },
  ],
  "chrome.notfound.cta": ["Scan it", { slots: {}, fixedBy: "S8 (11a)" }],
  /** The same 404 inside the app, where the set's line does not belong: a
   *  customer who is signed in is not being sent to a report address they
   *  already have. S8 draws no account arm, so the line is the owner's
   *  (12a — built in the set's idiom, written by the owner). */
  "chrome.notfound.line.app": ["Nothing in the app lives at this address. The Overview is one step back.", { slots: {}, fixedBy: "S8 (12a)" }],
  "chrome.error.eyebrow": ["Error", { slots: {}, fixedBy: "S8 (12a)" }],
  "chrome.error.heading": ["This page didn’t load.", { slots: {}, fixedBy: "S8 (12a)" }],
  "chrome.error.line": ["Something went wrong on our side while it was loading. We can’t tell what from here — try again in a moment.", { slots: {}, fixedBy: "S8 (12a)" }],

  /* ── The waiting state every screen that reads shares (UI-SPEC §4 rule 3)
     Issue #327. "Every empty, degraded or waiting state is one written
     line; never a spinner, never a blank card" — so a route's `loading.tsx`
     is one sentence and no furniture, and this is the sentence.

     The owner's, and it can have no other footing: no approved artifact
     draws a waiting screen, so 11a does not reach it, and neither BUILD
     nor the archived REQ set writes the words. It is one key rather than
     two because both mounts say the same thing — unlike the 404, whose
     public line names a report address a signed-in customer is not being
     sent to. If the owner wants the report's wait and the app's wait to
     read differently, the split is theirs and it is a second key here. */
  "chrome.loading.line": ["Loading…", { slots: {}, fixedBy: "set §4 rule 3 (12a)" }],

  /* ── The two ways back ────────────────────────────────────────────────
     One label each, and each has exactly one home even though two surfaces
     spend it: `chrome.back-to-reachkit` is S7's quiet control and the one
     way off `global-error`, which renders outside every group and so has
     no chrome to offer a reader instead. */
  "chrome.back-to-reachkit": ["Back to ReachKit", { slots: {}, fixedBy: "S7 (11a)" }],
  "chrome.back-to-overview": ["Back to Overview", { slots: {}, fixedBy: "S8 · issue 372" }],

  /* ── The three legal pages ───────────────────────────────────────────
     One title and one body each, and the body is the whole page. These
     are the owner's to write in the strongest sense in the product: a
     privacy statement or a set of terms drafted by anything but the
     owner is a legal claim nobody made. The routes exist so the footer
     links reach a page rather than a 404. */
  "legal.privacy.title": ["Privacy", { slots: {}, fixedBy: "the approved screen set · 3a" }],
  "legal.privacy.body": ["## Who we are\n\nReachKit (“ReachKit”, “we”, “us”) is operated by [[imprint: owner fills legal entity, address, VAT id]]. This notice explains how we handle personal data when you use the website and product at reachkit.app. For any question about it, or to exercise any of the rights below, write to the address in our Imprint.\n\n## What we collect\n\nWe collect as little as the product needs.\n\n- **Scan inputs.** The website address you submit, and the report we build from it: its Discoverability Score, the searches and AI answers we measured, and the three problems we count. A free report is public at its own address from the moment it finishes and stays there; anyone holding the link can read it. Search engines are told not to index it.\n- **Your network address, hashed.** Free scans are limited per network. We keep a salted one-way hash of the address the scan came from, never the address itself.\n- **Your email address.** We receive it when you ask for the free page — that is your opt-in to receiving that page and up to three short follow-ups about that domain, sent at 24, 72 and 168 hours, which stop the moment you subscribe or opt out. Every one of those mails carries a working opt-out link. We also receive it when you pay: it is where your sign-in link and receipts go. There is no password; you sign in with a one-time emailed link.\n- **Billing data.** Stripe collects and holds your card details. We store your subscription status, a Stripe customer reference, the billing country you gave and, if you entered one, your VAT number.\n- **Your site and market.** Your domain, the market category and up to five rival domains you confirm, your publishing settings, the voice note and never-claim list you write, and — if you connect one — the WordPress credentials you give us, encrypted at rest, never logged, and revoked when you disconnect.\n- **The pages we write for you**, their drafts, and the record of every publish: the search it targets, when it went live, and where.\n\n## How we use it\n\nTo run scans and render reports; to write and deliver the free page you asked for and its follow-ups; to sign you in; to take payment and run your subscription; to write, publish and verify your pages; to re-measure your market every week and tell you what moved; to limit free scans per network; and to protect the service from abuse. We do not sell personal data, and we send no marketing beyond the follow-ups described above.\n\n## Language models\n\nReachKit uses Anthropic’s language models for two things: to label your market and propose the questions it asks, and to write the pages we publish for you — each grounded in facts read from your own live pages, with the source of each fact recorded. Every word ReachKit says in its own voice — on a screen or in a mail — is written by a person, never by a model.\n\n## Service providers\n\nEach receives only the data its job needs.\n\n- **Supabase** — our database and the sign-in link system.\n- **Vercel** — hosting for every request to reachkit.app and for the pages we serve for you.\n- **Stripe** — checkout, subscription billing, invoices and the billing portal.\n- **Resend** — delivery of every email we send.\n- **DataForSEO** — search rankings, search volumes and AI-answer data used while measuring.\n- **Anthropic** — the language models described above.\n\n## Public reports and their removal\n\nA free report is public at its address. If you own a site and want its report taken down, write to remove@reachkit.app. A granted request takes the report offline within five working days, and the domain is not scanned again unless you ask us to make it scannable.\n\n## Legal basis and retention\n\nWhere the GDPR applies, we process your data to perform our contract with you — measuring, writing and publishing — and on our legitimate interest in limiting abuse and in following up on an action you started: the free page you asked for and its capped follow-ups. Free reports stay public until their owner asks for removal. Account, site and billing data stay for as long as your account exists. When you delete your account, your pages are exported to you first and then removed, and we act on the deletion at once, except for records the law requires us to keep, such as invoices.\n\n## Your rights\n\nYou can ask for access to, correction of, deletion of or a copy of your personal data, and object to or restrict certain processing. Settings lets you export everything you have and delete your account yourself; for anything else, write to the address in our Imprint and we will handle it by hand. If you are in the EU or EEA you can also complain to your local data protection authority.\n\n## Cookies\n\nWe set one cookie, to keep you signed in. We run no analytics cookies, no advertising cookies and no cross-site trackers.\n\n## Changes\n\nWe update this notice as the product changes; the date above is always the current version’s.", { slots: {}, fixedBy: "issue 266" }],
  "legal.terms.title": ["Terms", { slots: {}, fixedBy: "the approved screen set · 3a" }],
  "legal.terms.body": ["## 1. The service\n\nReachKit measures how findable a website is in Google search and in AI answers, and shows the result in a free public report. A paid subscription adds the product: one page a day written for your site and published on your schedule, a weekly re-measure of your market, and a Monday email saying what moved. These Terms govern your use of the website and product at reachkit.app. They are with [[imprint: owner fills legal entity, address, VAT id]].\n\n## 2. Accounts\n\nAccounts are created by payment — there is no sign-up form — and you sign in with a one-time link sent to the email you paid with. There is no password, so keeping your email secure is how you keep your account secure.\n\n## 3. Acceptable use\n\nUse ReachKit for your own website or one you are authorised to work on. Do not scan domains in order to harass or harm anyone; do not attempt to break, overload, scrape or reverse-engineer the service; do not use the pages it writes for anything unlawful or deceptive; and do not resell its output as a bulk service without our written agreement.\n\n## 4. Price, billing and cancellation\n\nThe free report costs nothing and asks for no account. The subscription is €49 per month, VAT included, billed in advance through Stripe. Cancel any time from Settings, in one click: your access continues to the end of the period you have paid for and is not renewed after it. Payments already made are not refunded unless the law requires it. We may change the price with reasonable notice; a change never applies to a period you have already paid for.\n\n## 4a. Right of withdrawal (EU consumers)\n\nBy subscribing you ask us to begin at once — your site is measured the moment payment completes — and you acknowledge that once the service has been fully performed your statutory 14-day right of withdrawal ends. If you withdraw within 14 days before that, you may owe a proportionate amount for what was already provided. Independently of that, the plan is month to month and you can cancel at any time.\n\n## 5. Your content and the pages we write\n\nYou keep ownership of what you give us and of every page ReachKit writes for you. Each page is grounded in facts from your own live pages, names no invented author, avoids anything on your never-claim list, and is labelled as written by ReachKit wherever the product shows it to you. You are the publisher of record: a page goes live under your name, on your domain or your WordPress, and you are responsible for what is published there. Every page waits for the veto window you set (24 hours by default, from one day up to seven days) before it publishes. You can edit, stop, unpublish or export any page at any time.\n\n## 6. Where pages are published\n\nPages are published either to a hosted address on a subdomain of your own domain that you point at us, or to a WordPress site you connect. Preview addresses under reachkit.app are never indexed. Credentials you give us are encrypted, never logged, and revoked when you disconnect. If your access ends, hosted pages stay served for 30 days and then stop; your export stays available after that.\n\n## 7. Guidance, not guarantees\n\nScores, verdicts and problems are measured from public signals — your site’s HTML, search rankings, search volumes and the AI answers we read — using fixed rules. AI answers and rankings change, and none of this is a guarantee of rankings, citations, traffic, revenue or any other outcome, nor legal, financial or professional advice. The service is provided “as is” and “as available” to the extent the law allows.\n\n## 8. Liability\n\nTo the maximum extent permitted by law, ReachKit is not liable for indirect, incidental, special or consequential damages, or for lost profits, revenue or data. Where liability cannot be excluded, our total liability is limited to the amount you paid us in the twelve months before the event giving rise to the claim. Nothing here limits liability that cannot be limited by law.\n\n## 9. Ending things\n\nYou may stop using ReachKit at any time. Cancelling takes effect at the end of your paid period. Deleting your account exports your pages to you first and then removes your data; hosted pages stop being served at once. We may suspend or end access if you breach these Terms or use the service in a way that risks harm to others or to the service. Sections that by their nature should survive — the disclaimer and the limits above — continue to apply.\n\n## 10. Changes\n\nWe may update these Terms as the product changes. The date above is the current version’s, and continued use after a change means you accept it.\n\n## 11. Contact and governing law\n\nQuestions about these Terms go to the address in our Imprint. Governing law and venue: [[imprint: owner fills legal entity, address, VAT id]].", { slots: {}, fixedBy: "issue 266" }],
  "legal.imprint.title": ["Imprint", { slots: {}, fixedBy: "the approved screen set · 3a" }],
  "legal.imprint.body": ["[[imprint: owner fills legal entity, address, VAT id]]\n\n**Responsible for the content of reachkit.app:** the operator named above.\n\n**Report removal:** a site owner who wants the report about their domain taken down writes to remove@reachkit.app.", { slots: {}, fixedBy: "issue 266" }],

  /* ── S5's own two lines, and the date each document owes ──────────────
     2026-09-09, issue #370. The approved set draws the screen as "eyebrow
     Legal · title · updated [date] · one card". Two of those are strings
     the set writes unbracketed, and ruling 11a therefore approves as
     written: the eyebrow's own word, and "updated" in front of the date.

     The date itself is bracketed, so it is the owner's — and it is one
     date per document, not one for the product: a privacy statement and a
     set of terms are revised on their own days. So `legal.updated` is the
     sentence, written once, and each document carries only the date that
     goes in its slot. */
  "legal.eyebrow": ["Legal", { slots: {}, fixedBy: "S5 (11a)" }],
  "legal.updated": [
    "updated {date}",
    { slots: { date: "date" }, fixedBy: "S5 (11a)" },
  ],
  "legal.privacy.updated": ["10 Sep 2026", { slots: {}, fixedBy: "S5" }],
  "legal.terms.updated": ["10 Sep 2026", { slots: {}, fixedBy: "S5" }],
  "legal.imprint.updated": ["10 Sep 2026", { slots: {}, fixedBy: "S5" }],
}) satisfies CopyPartition;
