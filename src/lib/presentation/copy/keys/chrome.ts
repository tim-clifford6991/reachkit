// BUILD §3 — the public shell's sentences, and the three legal pages.
// src/lib/presentation/copy/keys/chrome.ts — issue #266
//
// The fourteenth partition. `BUILD.md` names no public chrome at all —
// §3 says v3 "follows the shipped reachkit.app journey" and fixes the
// landing as "one field, one button", and no section of §4 describes a
// header, a footer or a legal page. The owner's 2026-09-07 review
// ("barely a shell — we are clearly missing the UI framework, navbars,
// footers") is what opened it, and the surfaces are built under the
// ruling on #266, with the mockup linked there and
// labelled *proposed — not in the approved idiom*: no approved artifact
// draws either surface, which is why every sentence below that the set
// does not write is the owner's rather than transcribed from one.
//
// 2026-09-10, issue #459: the owner approved the drafted copy for
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
   *  header — never a drawer or a dropdown (2026-09-07). */
  "chrome.nav.menu": ["Menu", { slots: {}, fixedBy: "issue 266" }],
  /** #681's Light / Dark / System control. Owner-approved 2026-09-14. */
  "chrome.theme.label": ["Theme", { slots: {}, fixedBy: "issue 681" }],
  "chrome.theme.light": ["Light", { slots: {}, fixedBy: "issue 681" }],
  "chrome.theme.dark": ["Dark", { slots: {}, fixedBy: "issue 681" }],
  "chrome.theme.system": ["System", { slots: {}, fixedBy: "issue 681" }],
  /** SPEC §1 2026-09-24 (#1066): the nav's two landing anchors, and the
   *  header's solid CTA. Words from boards `R12-1-Landing` / `R12-8`.
   *  *Free scans* joins them with the gallery (#1069). */
  "chrome.nav.why": ["Why it matters", { slots: {}, fixedBy: "issue 1066" }],
  "chrome.nav.how": ["How to start", { slots: {}, fixedBy: "issue 1066" }],
  /** The gallery's place in the nav, between *How to start* and *Pricing*
   *  (SPEC §1 2026-09-24; boards `R12-1` / `R12-3`, #1069). */
  "chrome.nav.scans": ["Free scans", { slots: {}, fixedBy: "issue 1069" }],
  "chrome.cta.start": ["Free scan", { slots: {}, fixedBy: "issue 1582" }],
  /** Signed in, the header's one solid button into the app, in place of
   *  *Sign in* and *Start free* (owner 2026-09-26, #1125). Drafted; the
   *  owner's word is "dashboard". The arrow is the button's icon. */
  "chrome.cta.app": ["Your dashboard", { slots: {}, fixedBy: "issue 1125" }],
  /** The dismissible banner above every public header (#1066). The one
   *  line the owner edits is `chrome.banner`; the tag, the region's name
   *  and the close button's name are the board's words. Its link is the
   *  hero's own `landing.submit.label`. */
  "chrome.banner": [
    "Every scan comes with your first page, proposed and free, at the end of your report.",
    { slots: {}, fixedBy: "issue 1066" },
  ],
  "chrome.banner.tag": ["Free", { slots: {}, fixedBy: "issue 1066" }],
  "chrome.banner.label": ["Announcement", { slots: {}, fixedBy: "issue 1066" }],
  "chrome.banner.dismiss": ["Dismiss", { slots: {}, fixedBy: "issue 1066" }],

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
  "pricing.heading": ["One plan. A page every day.", { slots: {}, fixedBy: "REQ-021 c4" }],
  "pricing.subline": ["€49 a month, VAT included. A page for your site every day, new or updated, and your market scanned every week. Cancel any time.", { slots: {}, fixedBy: "REQ-021 c4" }],
  /** REQ-020 c1's promise, in the set's own words: nothing is asked for
   *  before payment, and the site comes after. */
  "pricing.footnote": [
    "No account before payment. Your site is asked for after, or confirmed if you came from a report.",
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
     #372's own Done-when wording — and was returned to owed on the review
     of #407 (2026-09-09): a Done-when is a brief, not
     the owner's pen, and rule 6 leaves exactly two footings for a rendered
     string, the set's unbracketed word (11a) or a BUILD/REQ line quoted
     verbatim. It had neither. Nothing in BUILD or the archived REQ set writes it. */
  "chrome.notfound.eyebrow": ["404", { slots: {}, fixedBy: "S8 (11a)" }],
  /** Changed 2026-09-21 (#936). S8's "There is no page at this address."
   *  was the sentence for a screen that then offered a scan field and a
   *  specimen address; the 2026-09-20 board draws the 404 as a quiet card
   *  that says what happened and offers two ways on. Drafted under the
   *  owner's 2026-09-16 ruling (#759); the owner corrects the wording. */
  "chrome.notfound.heading": [
    "We can’t find that page",
    { slots: {}, fixedBy: "issue 936" },
  ],
  /** The address is a slot and not part of the sentence: the set draws it
   *  in mono inside the line (§2 — "numerals, dates, URLs … JetBrains
   *  Mono"), and a face is not something a string can carry.
   *
   *  Still the *second* line on a public 404 — where reports live is worth
   *  saying to someone who mistyped one — under the new first line below
   *  (#936). */
  "chrome.notfound.line": [
    "Reports live at {address}.",
    { slots: { address: "text" }, fixedBy: "S8 (11a)" },
  ],
  /** The 404's own first line, from the 2026-09-20 board: what probably
   *  happened, before where reports live. Drafted (#759). */
  "chrome.notfound.line.why": [
    "The address may be mistyped, or the page may have moved.",
    { slots: {}, fixedBy: "issue 936" },
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
  "chrome.error.line": ["Something went wrong on our side while it was loading. Try again in a moment.", { slots: {}, fixedBy: "S8 (12a)" }],

  /** The legal pages' own contents list, built from the document's
     headings (#936, the 2026-09-20 `R6-7` board). Drafted (#759). */
  "chrome.on-this-page": ["On this page", { slots: {}, fixedBy: "issue 936" }],

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
  "legal.privacy.body": ["## Who we are\n\nReachKit (“ReachKit”, “we”, “us”) is operated by [[imprint: owner fills legal entity, address, VAT id]]. This notice explains how we handle personal data when you use the website and product at reachkit.app. For any question about it, or to exercise any of the rights below, write to the address in our Imprint.\n\n## What we collect\n\nWe collect as little as the product needs.\n\n- **Scan inputs.** The website address you submit, and the report we build from it: its Visibility Score, the searches and AI answers we measured, and the three problems we count. A free report is public at its own address from the moment it finishes and stays there; anyone holding the link can read it. Search engines are told not to index it.\n- **Your network address, hashed.** Free scans are limited per network. We keep a salted one-way hash of the address the scan came from, never the address itself.\n- **Your email address.** We receive it when you ask for the free page — that is your opt-in to receiving that page and up to three short follow-ups about that domain, sent at 24, 72 and 168 hours, which stop the moment you subscribe or opt out. Every one of those mails carries a working opt-out link. We also receive it when you pay: it is where your sign-in link and receipts go. There is no password; you sign in with a one-time emailed link.\n- **Billing data.** Stripe collects and holds your card details. We store your subscription status, a Stripe customer reference, the billing country you gave and, if you entered one, your VAT number.\n- **Your site and market.** Your domain, the market and up to five competitor domains you confirm, your publishing settings, the voice note and never-claim list you write, and — if you connect one — the WordPress credentials you give us, encrypted at rest, never logged, and revoked when you disconnect.\n- **The pages we write for you**, their drafts, and the record of every publish: the search it targets, when it went live, and where.\n- **Visits to pages we host for you.** When someone opens a page we host for a customer, we count, by page and by day, visits that arrive from an AI answer or from Google or Bing search, and fetches by AI and search engines; we keep only the count, the engine and the day — never the visitor’s network address, browser details, or the page or search they came from — and we place nothing on their device. For these pages we act for the customer who publishes them, whose own privacy notice applies to their visitors.\n\n## How we use it\n\nTo run scans and render reports; to write and deliver the free page you asked for and its follow-ups; to sign you in; to take payment and run your subscription; to write, publish and verify your pages; to scan your market every week and tell you what moved; to limit free scans per network; and to protect the service from abuse. We do not sell personal data, and we send no marketing beyond the follow-ups described above.\n\n## Language models\n\nReachKit uses Anthropic’s language models for two things: to label your market and propose the questions it asks, and to write the pages we publish for you — each grounded in facts read from your own live pages, with the source of each fact recorded. Every word ReachKit says in its own voice — on a screen or in a mail — is written by a person, never by a model.\n\n## Service providers\n\nEach receives only the data its job needs.\n\n- **Supabase** — our database and the sign-in link system.\n- **Vercel** — hosting for every request to reachkit.app and for the pages we serve for you.\n- **Stripe** — checkout, subscription billing, invoices and the billing portal.\n- **Resend** — delivery of every email we send.\n- **DataForSEO** — search rankings, search volumes and AI-answer data used while measuring.\n- **Anthropic** — the language models described above.\n- **PostHog** — product analytics. Our servers send it three events: a scan started, a payment went through, a page went live. Each event carries a one-way hash in place of the domain, email or account it is about, and no network address, browser details or page address. PostHog builds no profile of you, and nothing of it runs in your browser.\n\n## International transfers\n\nSome of these providers process data outside the EU and EEA. Each transfer is covered by a safeguard the GDPR recognises: the European Commission’s Standard Contractual Clauses in the provider’s data processing agreement, or the provider’s certification under the EU-U.S. Data Privacy Framework.\n\n- **Supabase** — United States. Standard Contractual Clauses.\n- **Vercel** — United States. EU-U.S. Data Privacy Framework.\n- **Stripe** — United States. EU-U.S. Data Privacy Framework, with Standard Contractual Clauses as the fallback.\n- **Resend** — United States. EU-U.S. Data Privacy Framework.\n- **Anthropic** — United States. Standard Contractual Clauses.\n- **PostHog** — United States. Standard Contractual Clauses.\n\nDataForSEO is based in Estonia, inside the EU. To ask for a copy of a safeguard, write to the address in our Imprint.\n\n## Public reports and their removal\n\nA free report is public at its address. If you own a site and want its report taken down, write to remove@reachkit.app. A granted request takes the report offline within five working days, and the domain is not scanned again unless you ask us to make it scannable.\n\n## Legal basis and retention\n\nWhere the GDPR applies, we process your data to perform our contract with you — measuring, writing and publishing — and on our legitimate interest in limiting abuse and in following up on an action you started: the free page you asked for and its capped follow-ups. Free reports stay public until their owner asks for removal. Account, site and billing data stay for as long as your account exists. When you delete your account, your pages are exported to you first and then removed, and we act on the deletion at once, except for records the law requires us to keep, such as invoices.\n\n## Your rights\n\nYou can ask for access to, correction of, deletion of or a copy of your personal data, and object to or restrict certain processing. Settings lets you export your data and delete your account yourself; for anything else, write to the address in our Imprint and we will handle it by hand. If you are in the EU or EEA you can also complain to your local data protection authority.\n\n## Cookies\n\nWe set one cookie, to keep you signed in. When it grows too large for one, your browser stores it in numbered parts. When you download your export before deleting your account or unpublishing every page, we set a second cookie for 30 minutes, so that only your browser can confirm that step. We set no analytics cookies, no advertising cookies and no cross-site trackers. Product analytics runs on our servers and stores nothing in your browser.\n\nYour browser also keeps three settings for this site in its own storage: light or dark mode, whether you closed the banner at the top, and whether the app’s side menu is open. They never leave your device.\n\n## Changes\n\nWe update this notice as the product changes; the date above is always the current version’s.", { slots: {}, fixedBy: "issue 266" }],
  /** The privacy notice's summary above it: four lines, each true of
     what the product sets and sends today. */
  "legal.summary.title": ["In short", { slots: {}, fixedBy: "issue 1589" }],
  "legal.summary.note": ["A summary only. The full notice below is what applies.", { slots: {}, fixedBy: "issue 1589" }],
  "legal.privacy.summary": ["- We collect as little as the product needs.\n- We do not sell personal data.\n- Cookies only to sign you in and keep your account safe. No tracking or advertising cookies.\n- Export your data, or delete your account, from Settings.", { slots: {}, fixedBy: "issue 1589" }],
  "legal.terms.title": ["Terms", { slots: {}, fixedBy: "the approved screen set · 3a" }],
  "legal.terms.body": ["## 1. The service\n\nReachKit measures how easily buyers find a website on Google and in AI answers, and shows the result in a free public report. A paid subscription adds the product: a page every day for your site, new or an update to one already live, published on your schedule, a weekly scan of your market, and a Monday email saying what moved. These Terms govern your use of the website and product at reachkit.app. They are with [[imprint: owner fills legal entity, address, VAT id]].\n\n## 2. Accounts\n\nAccounts are created by payment — there is no sign-up form — and you sign in with a one-time link sent to the email you paid with. There is no password, so keeping your email secure is how you keep your account secure.\n\n## 3. Acceptable use\n\nUse ReachKit for your own website or one you are authorised to work on. Do not scan domains in order to harass or harm anyone; do not attempt to break, overload, scrape or reverse-engineer the service; do not use the pages it writes for anything unlawful or deceptive; and do not resell its output as a bulk service without our written agreement.\n\n## 4. Price, billing and cancellation\n\nThe free report costs nothing and asks for no account. The subscription is €49 per month, VAT included, billed in advance through Stripe. Cancel any time from Settings, in one click: your access continues to the end of the period you have paid for and is not renewed after it. Payments already made are not refunded unless the law requires it. We may change the price with reasonable notice; a change never applies to a period you have already paid for.\n\n## 4a. Right of withdrawal (EU consumers)\n\nBy subscribing you ask us to begin at once — your site is measured the moment payment completes — and you acknowledge that once the service has been fully performed your statutory 14-day right of withdrawal ends. If you withdraw within 14 days before that, you may owe a proportionate amount for what was already provided. Independently of that, the plan is month to month and you can cancel at any time.\n\n## 5. Your content and the pages we write\n\nYou keep ownership of what you give us and of every page ReachKit writes for you. Each page is grounded in facts from your own live pages, names no invented author, avoids anything on your never-claim list, and is labelled as written by ReachKit wherever the product shows it to you. You are the publisher of record: a page goes live under your name, on your domain or your WordPress, and you are responsible for what is published there. Every page waits for the time to stop it that you set (24 hours by default, from none up to seven days) before it publishes. You can edit, stop, unpublish or export any page at any time.\n\n## 6. Where pages are published\n\nPages are published either to a hosted address on a subdomain of your own domain that you point at us, or to a WordPress site you connect. Preview addresses under reachkit.app are never indexed. Credentials you give us are encrypted, never logged, and revoked when you disconnect. If your access ends, hosted pages stay served for 30 days and then stop; your export stays available after that.\n\n## 7. Guidance, not guarantees\n\nScores, verdicts and problems are measured from public signals — your site’s HTML, search rankings, search volumes and the AI answers we read — using fixed rules. AI answers and rankings change, and none of this is a guarantee of rankings, mentions, traffic, revenue or any other outcome, nor legal, financial or professional advice. The service is provided “as is” and “as available” to the extent the law allows.\n\n## 8. Liability\n\nTo the maximum extent permitted by law, ReachKit is not liable for indirect, incidental, special or consequential damages, or for lost profits, revenue or data. Where liability cannot be excluded, our total liability is limited to the amount you paid us in the twelve months before the event giving rise to the claim. Nothing here limits liability that cannot be limited by law.\n\n## 9. Ending things\n\nYou may stop using ReachKit at any time. Cancelling takes effect at the end of your paid period. Deleting your account exports your pages to you first and then removes your data; hosted pages stop being served at once. We may suspend or end access if you breach these Terms or use the service in a way that risks harm to others or to the service. Sections that by their nature should survive — the disclaimer and the limits above — continue to apply.\n\n## 10. Changes\n\nWe may update these Terms as the product changes. The date above is the current version’s, and continued use after a change means you accept it.\n\n## 11. Contact and governing law\n\nQuestions about these Terms go to the address in our Imprint. Governing law and venue: [[imprint: owner fills legal entity, address, VAT id]].", { slots: {}, fixedBy: "issue 266" }],
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
  "legal.privacy.updated": ["20 Oct 2026", { slots: {}, fixedBy: "S5" }],
  "legal.terms.updated": ["10 Sep 2026", { slots: {}, fixedBy: "S5" }],
  "legal.imprint.updated": ["10 Sep 2026", { slots: {}, fixedBy: "S5" }],
  /* ── How it works and About ───────────────────────────────────────────
     Issue 1396 (owner, 2026-10-10: "go"). Every sentence here is drafted
     and named in that pull request for the owner to correct. A figure is
     always a slot, filled at render from `src/lib/config/constants.ts`
     (`src/app/(public)/_how/facts.ts`), so no number is typed here. */
  "chrome.nav.works": ["How it works", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "chrome.nav.about": ["About", { slots: {}, fixedBy: "issue 1396 · drafted" }],

  "how.eyebrow": ["How it works", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.title": ["How ReachKit works", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.lead": ["ReachKit measures how buyers find you in Google and in AI answers, then publishes a page every day, new or updated, on your site. This page says how each step works, with the real numbers.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  /** Said once on the page: how the pages are made. No model version. */
  "how.disclosure": ["Pages are written with Claude, an AI model, from your own site.", { slots: {}, fixedBy: "issue 1396" }],

  "how.measure.title": ["What we measure", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.measure.search": ["We run {searches} searches in Google that buyers in your market make, and record who is on the first page of each.", { slots: { searches: "text" }, fixedBy: "issue 1396 · drafted" }],
  "how.measure.ai": ["Every Monday we ask {engines} the {prompts} questions a buyer in your market would ask. We ask each one {runs} times, because AI answers change from one run to the next.", { slots: { engines: "text", prompts: "text", runs: "text" }, fixedBy: "issue 1396 · drafted" }],
  "how.measure.engines": ["Google AI Mode and ChatGPT", { slots: {}, fixedBy: "issue 1396" }],
  "how.measure.named": ["An answer can mention you without linking to you. We count mentions and links separately.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.measure.limits": ["What this does not tell you", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.measure.limit.vary": ["Answers vary from run to run, so a week's figure is a sample.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.measure.limit.perplexity": ["Perplexity is not measured.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.measure.limit.locale": ["Each site is measured in one country and one language.", { slots: {}, fixedBy: "issue 1396 · drafted" }],

  "how.market.title": ["Your market and competitors", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.market.terms": ["We read your site to learn what you sell and who buys it. From that we choose up to {terms} search terms for your market and look up how often each one is searched.", { slots: { terms: "text" }, fixedBy: "issue 1396 · drafted" }],
  "how.market.rivals": ["Competitors come from what we saw in those results. We track up to {rivals}. The first {held} places go to the companies that hold the most first-page results on your searches. The others are brands people search for at least {volume} times a month.", { slots: { rivals: "text", held: "text", volume: "text" }, fixedBy: "issue 1396 · drafted" }],
  "how.market.blocked": ["Some sites block automated readers. For those we read the market from how the site appears in Google: the searches it ranks for, and the title and snippet shown for each page.", { slots: {}, fixedBy: "issue 1396 · drafted" }],

  "how.choose.title": ["How a page is chosen", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.choose.weigh": ["Each topic is weighed on four things: how many people search for it, how hard it is to rank for at your site's size, whether a competitor answers it today, and whether you already cover it.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.choose.update": ["A topic you already cover becomes an update to that page.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.choose.pace": ["The pace is a page every day, new or updated. At most {newPages} in a week are new pages. The other days update pages that are already live.", { slots: { newPages: "text" }, fixedBy: "owner 2026-10-10 · issue 1396" }],

  "how.sources.title": ["What a page is written from", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.sources.site": ["Facts about you come from your own site, word for word. Each one links to the page it came from.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.sources.market": ["Facts about the market come from the top {top} results for the search and from the pages of up to {rivals} competitors.", { slots: { top: "text", rivals: "text" }, fixedBy: "issue 1396 · drafted" }],
  "how.sources.studies": ["A page cites at most {studies} studies, and no statistic older than {years} years.", { slots: { studies: "text", years: "text" }, fixedBy: "issue 1396 · drafted" }],
  "how.sources.adds": ["A new page has to add at least {adds} things the top results do not say. At least {business} of them is a fact about your business.", { slots: { adds: "text", business: "text" }, fixedBy: "issue 1396 · drafted" }],

  "how.checks.title": ["The checks", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.checks.count": ["Before a page goes live it is read against {checks} checks. Code runs {coded} of them, with no AI involved.", { slots: { checks: "text", coded: "text" }, fixedBy: "issue 1396 · drafted" }],
  "how.checks.judged": ["The remaining check is a judgement an AI model makes: whether the page says you serve a case your site does not support.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.checks.group.count": ["{count} checks", { slots: { count: "text" }, fixedBy: "issue 1396 · drafted" }],
  "how.checks.group.count.one": ["{count} check", { slots: { count: "text" }, fixedBy: "issue 1396 · drafted" }],
  "how.checks.sources": ["Every fact and every figure matches a source.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.checks.invented": ["No invented people, reviews, tests or origins.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.checks.honest": ["Comparisons are fair, and the page claims nothing you told us to leave out.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.checks.hidden": ["No hidden text, placeholder or leftover example.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.checks.shape": ["The page answers the question first, and its title and headings hold up.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.checks.repeat": ["The page does not repeat one you already have.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.checks.fix": ["A page that fails gets one rewrite. If it fails again it is held, and nothing is published.", { slots: {}, fixedBy: "issue 1396 · drafted" }],

  "how.links.title": ["Links", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.links.live": ["Each page carries {min} to {max} links into your own site, chosen by what the page is about, and links to up to {cluster} earlier pages on the same subject.", { slots: { min: "text", max: "text", cluster: "text" }, fixedBy: "issue 1396 · drafted" }],
  "how.links.text": ["The words of a link say what you find at the other end.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.links.check": ["When a page goes out, every link on it is asked once. A link to a page of yours that is gone is taken out, and a source that is gone takes its claim with it.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.links.back": ["When a new page goes live, up to {back} of your earlier pages are updated with one sentence that links to it.", { slots: { back: "text" }, fixedBy: "issue 1396 · drafted" }],

  "how.control.title": ["Your control", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.control.window": ["A page goes live on its own {hours} hours after it is written. You can set that window anywhere from {min} to {max} days.", { slots: { hours: "text", min: "text", max: "text" }, fixedBy: "issue 1396 · drafted" }],
  "how.control.act": ["Until then you can edit the page or stop it. You do not have to do either.", { slots: {}, fixedBy: "issue 1396 · drafted" }],

  "how.monday.title": ["Every Monday", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.monday.measure": ["On Monday we run the {searches} searches again and ask the {prompts} questions again.", { slots: { searches: "text", prompts: "text" }, fixedBy: "issue 1396 · drafted" }],
  "how.monday.mail": ["Then we send one email. It opens with your numbers and how they changed since the Monday before. Below that are the pages that moved and what is being written this week.", { slots: {}, fixedBy: "issue 1396 · drafted" }],

  "how.never.title": ["What we never do", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.never.invent": ["Invent people, reviews, tests or numbers.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.never.hide": ["Hide text on a page.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.never.promise": ["Promise a ranking.", { slots: {}, fixedBy: "issue 1396 · drafted" }],

  "how.examples.title": ["Live examples", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.examples.report": ["A real report:", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.examples.page": ["A real published page:", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "how.examples.all": ["Every free report is listed in the open.", { slots: {}, fixedBy: "issue 1396 · drafted" }],

  "about.eyebrow": ["About", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "about.title": ["About ReachKit", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "about.who.title": ["Who builds it", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "about.who.founder": ["ReachKit is built by {name}.", { slots: { name: "text" }, fixedBy: "issue 1396 · drafted" }],
  "about.who.founder.place": ["ReachKit is built by {name} in {place}.", { slots: { name: "text", place: "text" }, fixedBy: "issue 1396 · drafted" }],
  "about.who.imprint": ["The company that operates it is named on the imprint.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "about.who.own": ["ReachKit writes its own blog the same way. The newest page:", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "about.why.title": ["Why it exists", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "about.why.problem": ["Buyers now ask ChatGPT and Google’s AI what to use, and the answer mentions a handful of companies. A small business cannot see whether it is one of them, and has no time to publish a page every day to change that.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "about.why.answer": ["ReachKit measures where you stand every week and writes the pages for you.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "about.rules.title": ["The rules we keep", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "about.rules.lead": ["We never:", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "about.rules.source": ["Every figure on a page matches a source, and a page that fails its checks twice is not published.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "about.rules.unmeasured": ["Something we could not measure is shown as not measured, never as zero.", { slots: {}, fixedBy: "issue 1396 · drafted" }],
  "about.how": ["How ReachKit works, step by step", { slots: {}, fixedBy: "issue 1396 · drafted" }],

  // Issue 1458: the pages Google still ranks from earlier versions. The articles' own words are data in `src/app/(public)/_library/`; these are the screens' words around them.
  "chrome.footer.learn": ["Learn", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "chrome.nav.compare": ["Compare", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "chrome.nav.tools": ["Free tools", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "chrome.nav.teardowns": ["Teardowns", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  // Issue 1512: ReachKit's own published articles, on its content host, linked from the footer and the landing.
  "chrome.nav.articles": ["Articles", { slots: {}, fixedBy: "issue 1512 · drafted" }],
  "landing.articles.heading": ["Latest articles", { slots: {}, fixedBy: "issue 1512 · drafted" }],
  "landing.articles.all": ["All articles", { slots: {}, fixedBy: "issue 1512 · drafted" }],
  "library.sources": ["Sources", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "library.checked": ["Facts checked on {date}.", { slots: { date: "text" }, fixedBy: "issue 1458 · drafted" }],
  "compare.eyebrow": ["Compare", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "compare.title": ["Compare ReachKit", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "compare.lead": ["How ReachKit compares with the tools founders try first. Each page says what the other tool does well, what ReachKit does instead, and when to pick which.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "compare.group.suite": ["SEO suites", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "compare.group.checker": ["On-page checkers", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "compare.group.competitors": ["Competitor research", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "compare.group.audience": ["Audience research", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "compare.group.ai": ["AI writing tools", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "compare.group.data": ["Search and app data", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "compare.item.table": ["Side by side", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "compare.item.feature": ["What it does", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "compare.item.yes": ["Yes", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "compare.item.no": ["No", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "compare.item.pick.them": ["Pick {name} when", { slots: { name: "text" }, fixedBy: "issue 1458 · drafted" }],
  "compare.item.pick.us": ["Pick ReachKit when", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "compare.item.more": ["All comparisons", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "teardowns.eyebrow": ["Teardowns", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "teardowns.title": ["Teardowns", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "teardowns.lead": ["How real products present themselves to buyers, read from the outside. Each one is dated, and revised when the product changes.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "teardowns.item.dates": ["Written {written} · revised {revised}", { slots: { written: "text", revised: "text" }, fixedBy: "issue 1458 · drafted" }],
  "teardowns.item.takeaways": ["Takeaways", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "teardowns.item.more": ["All teardowns", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "teardowns.rss": ["RSS feed", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "answers.eyebrow": ["Answer", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "answers.faq": ["Questions people ask", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.eyebrow": ["Free tools", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.title": ["Free SEO tools", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.lead": ["Check one page at a time, free, with no account and no email. For your whole site on Google and in AI, run the free scan.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.meta.name": ["Meta tag preview", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.meta.line": ["See how a page looks in a Google result and when it is shared, and which tags are missing.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.onpage.name": ["On-page check", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.onpage.line": ["Check the title, description, headings and other tags search engines read on one page.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.scan.name": ["Free scan", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.scan.line": ["Your whole site on Google and in AI answers, with your competitors and a Visibility Score.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.more": ["All free tools", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.field.label": ["Page address", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.field.placeholder": ["yourdomain.com/page", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.submit": ["Check this page", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.problem.address": ["That doesn’t look like a page address. Try the form example.com/page.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.problem.limit": ["That is the hourly limit for free checks. Try again in an hour, or run the free scan.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.problem.read": ["We could not read {url}. Check the address and try again.", { slots: { url: "text" }, fixedBy: "issue 1458 · drafted" }],
  "tools.problem.robots": ["{url} asks automated readers not to read it, so we did not.", { slots: { url: "text" }, fixedBy: "issue 1458 · drafted" }],
  "tools.result": ["{fine} of {total} checks are fine on {url}.", { slots: { fine: "text", total: "text", url: "text" }, fixedBy: "issue 1458 · drafted" }],
  "tools.status.fine": ["Fine", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.status.fix": ["Fix", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.title": ["Page title", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.title.fine": ["{chars} characters: {value}", { slots: { chars: "text", value: "text" }, fixedBy: "issue 1458 · drafted" }],
  "tools.check.title.none": ["The page has no title.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.title.long": ["{chars} characters, so Google may cut it short: {value}", { slots: { chars: "text", value: "text" }, fixedBy: "issue 1458 · drafted" }],
  "tools.check.description": ["Meta description", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.description.fine": ["{chars} characters: {value}", { slots: { chars: "text", value: "text" }, fixedBy: "issue 1458 · drafted" }],
  "tools.check.description.none": ["The page has no meta description, so Google picks a snippet itself.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.description.long": ["{chars} characters, so Google may cut it short: {value}", { slots: { chars: "text", value: "text" }, fixedBy: "issue 1458 · drafted" }],
  "tools.check.h1": ["Main heading", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.h1.fine": ["One main heading: {value}", { slots: { value: "text" }, fixedBy: "issue 1458 · drafted" }],
  "tools.check.h1.none": ["The page has no main heading.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.h1.many": ["The page has {count} main headings. One says more clearly what it is about.", { slots: { count: "text" }, fixedBy: "issue 1458 · drafted" }],
  "tools.check.canonical": ["Canonical address", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.canonical.fine": ["Points to {value}", { slots: { value: "text" }, fixedBy: "issue 1458 · drafted" }],
  "tools.check.canonical.none": ["The page names no canonical address.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.index": ["Indexing", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.index.fine": ["Search engines may index this page.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.index.none": ["The page tells search engines not to index it.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.schema": ["Structured data", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.schema.fine": ["Declares {value}", { slots: { value: "text" }, fixedBy: "issue 1458 · drafted" }],
  "tools.check.schema.none": ["The page declares no structured data.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.share": ["Share tags", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.share.fine": ["Open Graph title, description and image are set.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.share.none": ["Missing: {value}", { slots: { value: "text" }, fixedBy: "issue 1458 · drafted" }],
  "tools.check.viewport": ["Phone layout", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.viewport.fine": ["The page is sized for phones.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.viewport.none": ["No viewport tag, so a phone draws the desktop layout shrunk to fit.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.images": ["Image text", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.images.fine": ["Every image has alt text.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.images.empty": ["The page has no images.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.images.none": ["{count} of {total} images have no alt text.", { slots: { count: "text", total: "text" }, fixedBy: "issue 1458 · drafted" }],
  "tools.check.lang": ["Language", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.check.lang.fine": ["Declared as {value}", { slots: { value: "text" }, fixedBy: "issue 1458 · drafted" }],
  "tools.check.lang.none": ["The page declares no language.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.preview.google": ["In a Google result", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.preview.share": ["When the link is shared", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.preview.tags": ["The tags", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.preview.untitled": ["No title", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.preview.undescribed": ["No description", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "tools.preview.noimage": ["No share image", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "gone.head": ["This page is gone", { slots: {}, fixedBy: "issue 1458 · drafted" }],
  "gone.line": ["It belonged to an earlier version of ReachKit and has no replacement. The free scan is the place to start.", { slots: {}, fixedBy: "issue 1458 · drafted" }],
}) satisfies CopyPartition;
