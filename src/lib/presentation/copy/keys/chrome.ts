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
import type { CopyPartition } from "../registry.ts";

export const CHROME_COPY = Object.freeze({
  /* ── The header ──────────────────────────────────────────────────── */
  // Approved as written (ruling 11a): the screen set draws "ReachKit" as
  // the wordmark in the sidebar's brand row (S12) and in the public header
  // (S1). `mail.shell.wordmark` keeps its own copy — a mail cannot read a
  // stylesheet, so the two are different surfaces spending the same word,
  // which is why this key exists rather than one being imported.
  "chrome.wordmark": "ReachKit",
  // The footer's two Product links (UI-SPEC 3a). Approved as written.
  "chrome.nav.pricing": "Pricing",
  "chrome.nav.signin": "Sign In",
  /** The header's one solid CTA (UI-SPEC 3a). **It IS rendered on the
   *  landing** since ruling 2b of 2026-09-08 — "two solid primaries per
   *  screen are allowed where the artifact draws them (landing: header CTA
   *  + hero CTA)" — which supersedes the one-primary reading #290 applied
   *  here. The set brackets the label, so it is the owner's (approved
   *  2026-09-10, #459). */
  "chrome.cta.scan": "Scan My Site",
  /** The accessible name of the compact-band control that opens the
   *  links. It is the registered `Collapse`, listing them under the
   *  header — never a drawer or a dropdown (2026-09-07). */
  "chrome.nav.menu": "Open menu",
  /** #681's Light / Dark / System control. Owner-approved 2026-09-14. */
  "chrome.theme.label": "Theme",
  "chrome.theme.light": "Light",
  "chrome.theme.dark": "Dark",
  "chrome.theme.system": "System",
  /** The public header's one theme button, named for what a press does (board `PubLanding`). */
  "chrome.theme.to-dark": "Switch to dark theme",
  "chrome.theme.to-light": "Switch to light theme",
  /** The gallery, third of the header's three links (owner 2026-10-20, Q1). */
  "chrome.nav.scans": "Scan Library",
  "chrome.cta.start": "Scan My Site",
  /** Signed in, the header's one solid button into the app, in place of
   *  *Sign in* and *Start free* (owner 2026-09-26, #1125). The owner's
   *  word, kept over the verb-first press rule. The arrow is its icon. */
  "chrome.cta.app": "Dashboard",
  /* ── The footer ──────────────────────────────────────────────────── */
  "chrome.footer.product": "Product",
  "chrome.footer.legal": "Legal",
  "chrome.footer.contact": "Contact",
  "chrome.footer.contact.address": "hello@reachkit.app",
  /** §4.2's removal address, named from the footer so a person who never
   *  opened an email can still find it. */
  // The address is a slot, not a literal: `removal.address` (REQ-002 c1)
  // is its one home in the registry, and a second copy here would be a
  // second place to change it. The sentence is the set's, as written.
  "chrome.footer.opt-out": "Want your site’s report removed? {address}",
  /** The way out of a subscription, from every public page; signed out the app sends it to sign-in first. */
  "chrome.footer.cancel": "Cancel Your Contract",
  "chrome.footer.rights": "© 2026 ReachKit",

  /* ── The pricing page (board Pricing) ─────────────────────────────── */
  "pricing.title": "One Plan, Everything Included",
  "pricing.subline": "Up to {weekPages} pages a week on your site, new or updated. Your progress every Monday. Cancel any time.",
  "pricing.plan.badge": "One plan",
  "pricing.plan.chosen": "Pages chosen from what buyers search and ask AI",
  "pricing.plan.rivals": "Up to {rivals} competitors watched every Monday",
  "pricing.plan.mail": "A Monday email: what went live and what’s next",
  "pricing.plan.cancel": "Cancel any time from Settings.",
  "pricing.plan.unsure": "Not sure yet?",
  "pricing.plan.scan": "Scan your site free first",
  "pricing.all.not": "What ReachKit doesn’t do:",
  "pricing.all.not.maps": "Your Google Maps listing (Business Profile)",
  "pricing.first.title": "What you see from week 1",
  "pricing.first.body": "Your pages go live in week 1, and each Monday email shows where they stand.",
  "pricing.months.title": "Your first months",
  "pricing.months.day1.at": "Day 1",
  "pricing.months.day1.what": "You answer a few questions and connect your site. Your first page is written while you do it.",
  "pricing.months.day2.at": "Day 2",
  "pricing.months.day2.what": "Your first page goes live on your website, unless you stop it.",
  "pricing.months.monday.at": "First Monday",
  "pricing.months.monday.what": "Your first Monday email: what went live, and where you stand.",
  "pricing.compare.eyebrow": "How it compares",
  "pricing.compare.title": "{price} against the other ways",
  "pricing.compare.limit": "An agency often also handles your Maps listing, ads and links. We don’t.",
  "pricing.faq.title": "Before you pay",
  "pricing.close.title": "See your free report",
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
     and its line are the owner's (approved 2026-09-10, #459). */
  "chrome.notfound.eyebrow": "404",
  /** Changed 2026-09-21 (#936). S8's "There is no page at this address."
   *  was the sentence for a screen that then offered a scan field and a
   *  specimen address; the 2026-09-20 board draws the 404 as a quiet card
   *  that says what happened and offers two ways on. Drafted under the
   *  owner's 2026-09-16 ruling (#759); the owner corrects the wording. */
  "chrome.notfound.heading": "We Can’t Find That Page",
  /** The address is a slot and not part of the sentence: the set draws it
   *  in mono inside the line (§2 — "numerals, dates, URLs … JetBrains
   *  Mono"), and a face is not something a string can carry.
   *
   *  Still the *second* line on a public 404 — where reports live is worth
   *  saying to someone who mistyped one — under the new first line below
   *  (#936). */
  "chrome.notfound.line": "Reports live at {address}.",
  /** The 404's own first line, from the 2026-09-20 board: what probably
   *  happened, before where reports live. Drafted (#759). */
  "chrome.notfound.line.why": "The address may be mistyped, or the page may have moved.",
  /** The shape of a report address, as the set writes it. A specimen, not
   *  a link: it names the form, and the field below it is how a reader
   *  spends it. */
  "chrome.notfound.address": "reachkit.app/scan/yourdomain.com",
  "chrome.notfound.cta": "Scan It",
  /** The same 404 inside the app, where the set's line does not belong: a
   *  customer who is signed in is not being sent to a report address they
   *  already have. S8 draws no account arm, so the line is the owner's
   *  (12a — built in the set's idiom, written by the owner). */
  "chrome.notfound.line.app": "Nothing is at this address. Go back to Overview.",
  "chrome.error.eyebrow": "Error",
  "chrome.error.heading": "This Page Didn’t Load",
  "chrome.error.line": "Try again in a minute.",
  /** A screen that failed inside the app's frame: "screen", because "page" there means the customer's own pages. */
  "chrome.error.app.title": "This Screen Didn’t Load",
  "chrome.error.app.line": "We couldn’t load this screen. Your pages, your settings and this week’s plan are not changed by it.",
  "chrome.error.app.retry": "Try Again",
  "chrome.error.app.again": "It still didn’t load. Try again in a few minutes.",
  "chrome.error.app.offline": "You’re offline. Check your connection, then try again.",
  "chrome.error.app.code": "If it keeps happening, reply to any ReachKit email with this code: {digest}",

  /** The legal pages' own contents list, built from the document's
     headings (#936, the 2026-09-20 `R6-7` board). Drafted (#759). */
  "chrome.on-this-page": "On this page",

  /* ── The two ways back ────────────────────────────────────────────────
     One label each, and each has exactly one home even though two surfaces
     spend it: `chrome.back-to-reachkit` is S7's quiet control and the one
     way off `global-error`, which renders outside every group and so has
     no chrome to offer a reader instead. */
  "chrome.back-to-reachkit": "Back to ReachKit",
  "chrome.back-to-overview": "Back to Overview",

  /* ── The legal pages: one title and one body each, and the body is the whole page. Each is the owner's to approve. */
  "legal.privacy.title": "Privacy",
  "legal.privacy.body": "## 1. Who we are\n\nReachKit (“ReachKit”, “we”, “us”) is operated by Tim Clifford, trading as ReachKit, Schwedter Straße 235, 10435 Berlin, Germany, who is the controller of the personal data described here. This notice explains how we handle personal data when you use the website and product at reachkit.app. For any question about it, or to exercise any of the rights below, write to hello@reachkit.app or to the postal address above. We have not appointed a data protection officer, as the law does not require one for an operator of our size.\n\n## 2. What we collect\n\nWe collect as little as the product needs.\n\n- **Scan inputs.** The website address you submit, and the report we build from it: its Visibility Score, the searches and AI answers we measured, and the three problems we count. A free report is public at its own address from the moment it finishes and stays there; anyone holding the link can read it. Search engines are told not to index it. Some links we share name where we shared them, such as LinkedIn. A scan started from one keeps that one word, never a name.\n- **Your network address, hashed.** Free scans, sign-in links and free-page requests are limited per network. We keep a salted one-way hash of the address the request came from, never the address itself, for two days.\n- **Your email address.** We receive it when you ask for the free page — that is your opt-in to receiving that page and up to three short follow-ups about that domain, sent at 24, 72 and 168 hours, which stop the moment you subscribe or opt out. Every one of those mails carries a working opt-out link. We also receive it when you pay: it is where your sign-in link and receipts go. There is no password; you sign in with a one-time emailed link.\n- **Billing data.** Stripe collects and holds your card details. We store your subscription status, a Stripe customer reference, the billing country you gave and, if you entered one, your VAT number.\n- **Your site and market.** Your domain, the market and up to five competitor domains you confirm, your publishing settings, the voice note and never-claim list you write, and — if you connect one — the WordPress credentials you give us, encrypted at rest, never logged, and revoked when you disconnect.\n- **The pages we write for you**, their drafts, and the record of every publish: the search it targets, when it went live, and where.\n- **Visits to pages we host for you.** When someone opens a page we host for a customer, we count, by page and by day, visits that arrive from an AI answer or from Google search, and fetches by AI services and by Google; we keep only the count, the engine and the day — never the visitor’s network address, browser details, or the page or search they came from — and we place nothing on their device. For these pages we act for the customer who publishes them, under our [data processing agreement](/dpa), and the customer’s own privacy notice applies to their visitors.\n\n## 3. How we use it\n\nTo run scans and render reports; to write and deliver the free page you asked for and its follow-ups; to sign you in; to take payment and run your subscription; to write, publish and verify your pages; to scan your market every week and tell you what moved; to limit free scans per network; to count which of our shared links bring scans and customers; and to protect the service from abuse. We do not sell personal data, and we send no marketing beyond the follow-ups described above and one mail 30 days after a cancelled plan ends, which its opt-out stops.\n\n## 4. Language models\n\nReachKit uses Anthropic’s language models for two things: to label your market and propose the questions it asks, and to write the pages we publish for you — each grounded in facts read from your own live pages, with the source of each fact recorded. Every word ReachKit says in its own voice — on a screen or in a mail — is written by a person, never by a model.\n\n## 5. Service providers\n\nEach receives only the data its job needs.\n\n- **Supabase** — Our database and the sign-in link system.\n- **Vercel** — Hosting for every request to reachkit.app and for the pages we serve for you.\n- **Stripe** — Checkout, subscription billing, invoices and the billing portal.\n- **Resend** — Delivery of every email we send.\n- **DataForSEO** — Search rankings, search volumes and AI-answer data used while measuring.\n- **Anthropic** — The language models described above.\n- **Inngest** — Runs our background jobs, such as scans, page writing, publishing and mail, and holds what each job needs while it runs, and in its run history for a limited time.\n- **Cloudflare** — Forwards mail sent to hello@reachkit.app and remove@reachkit.app to our inbox.\n- **PostHog** — Product analytics. Our servers send it three events: a scan started, a payment went through, a page went live. Each event carries a pseudonymous one-way hash in place of the domain, email or account it is about, and no network address, browser details or page address. PostHog builds no profile of you, and nothing of it runs in your browser.\n\nWe also send the addresses of the pages we host for you to Google Search Console and to Google’s WebSub hub, so that Google can find them.\n\n## 6. International transfers\n\nSome of these providers process data outside the EU and EEA. Each transfer is covered by a safeguard the GDPR recognises: the European Commission’s Standard Contractual Clauses in the provider’s data processing agreement, or the provider’s certification under the EU-U.S. Data Privacy Framework.\n\n- **Supabase** — United States. Standard Contractual Clauses.\n- **Vercel** — United States. EU-U.S. Data Privacy Framework.\n- **Stripe** — United States. EU-U.S. Data Privacy Framework, with Standard Contractual Clauses as the fallback.\n- **Resend** — United States. EU-U.S. Data Privacy Framework.\n- **Anthropic** — United States. Standard Contractual Clauses.\n- **Inngest** — United States. Standard Contractual Clauses.\n- **PostHog** — United States. Standard Contractual Clauses.\n- **Cloudflare** — United States. EU-U.S. Data Privacy Framework.\n\nDataForSEO is based in Estonia, inside the EU. Google Search Console and Google’s WebSub hub receive only the public addresses of your hosted pages. To ask for a copy of a safeguard, write to the address in our Imprint.\n\n## 7. Public reports and their removal\n\nA free report is public at its address. If you own a site and want its report taken down, write to remove@reachkit.app. A granted request takes the report offline within five working days, and the domain is not scanned again unless you ask us to make it scannable.\n\n## 8. Legal basis and retention\n\nWhere the GDPR applies, we process your data to perform our contract with you — measuring, writing and publishing — and on our legitimate interest in limiting abuse, in counting which of our shared links bring scans and customers, and in following up on an action you started: the free page you asked for and its capped follow-ups. Free reports stay public until their owner asks for removal. The email address you give for a free page stays with that report until you ask us to remove it. If you opt out, we keep your address on a do-not-mail list, even after your account is deleted. Account, site and billing data stay for as long as your account exists. When you delete your account, your pages are exported to you first and taken down, and the account is closed at once: you are signed out and no one can sign in to it. Its data is then removed within {erasureDays} days, except for records the law requires us to keep, such as invoices, and your name and email address. We keep those two on our legitimate interest in inviting you back to ReachKit one day, and nothing else about you with them. To have them removed, reply to the goodbye mail we send when you delete your account, or write to remove@reachkit.app.\n\n## 9. Your rights\n\nYou can ask for access to, correction of, deletion of or a copy of your personal data, and object to or restrict certain processing. Settings lets you export your data and delete your account yourself; for anything else, write to the address in our Imprint and we will handle it by hand. If you are in the EU or EEA you can also complain to your local data protection authority.\n\n## 10. Cookies\n\nWe set one cookie, to keep you signed in. When it grows too large for one, your browser stores it in numbered parts. When you download your export before deleting your account or unpublishing every page, we set a second cookie for 30 minutes, so that only your browser can confirm that step. When you ask for a sign-in link or a change of email, we set a cookie for up to 24 hours, so that opening the link in the same browser signs you in without a second step. It holds no personal data and is removed once you are signed in. We set no analytics cookies, no advertising cookies and no cross-site trackers. Product analytics runs on our servers and stores nothing in your browser.\n\nYour browser also keeps two settings for this site in its own storage: light or dark mode, and whether the app’s side menu is open. They never leave your device.\n\n## 11. Changes\n\nWe update this notice as the product changes; the date above is always the current version’s.",
  /** The privacy notice's summary above it: four lines, each true of
     what the product sets and sends today. */
  "legal.summary.title": "In Short",
  "legal.summary.note": "A summary only. The full notice below is what applies.",
  /** Board Legal's tabs, follow-up timeline, provider table caption and rights (issue 1735). */
  "legal.tabs.label": "Legal documents",
  "legal.follow-ups.start": "Start",
  "legal.follow-ups.asked": "You ask for the free page",
  "legal.follow-ups.at": "{hours} h",
  "legal.follow-ups.step": "Follow-up {n}",
  "legal.follow-ups.note": "At most three, each with a working opt-out link. They stop the moment you subscribe or opt out.",
  "legal.providers.caption": "Who they are, and the one job each does for us",
  "legal.privacy.rights": "- Access\n- Correction\n- Deletion\n- A copy\n- Objection\n- Restriction",
  "legal.privacy.summary": "- We collect as little as the product needs.\n- We do not sell personal data.\n- Cookies only to sign you in and keep your account safe. No tracking or advertising cookies.\n- Export your data, or delete your account, from Settings.",
  "legal.terms.title": "Terms",
  "legal.terms.body": "## 1. The service\n\nReachKit measures how easily buyers find a website on Google and in AI answers, and shows the result in a free public report. A paid subscription adds the product: up to 7 pages a week for your site, new pages or updates to ones already live (in some weeks there are fewer good pages to write, and we publish fewer rather than fill the week), a weekly scan of your market, and a Monday email saying what moved. ReachKit is sold only to businesses: by subscribing you confirm that you are buying for your trade, business or profession, not as a consumer. These Terms govern your use of the website and product at reachkit.app. They are a contract between you and Tim Clifford, trading as ReachKit, Schwedter Straße 235, 10435 Berlin, Germany (“ReachKit”, “we”, “us”).\n\n## 2. Accounts\n\nAccounts are created by payment — there is no sign-up form — and you sign in with a one-time link sent to the email you paid with. There is no password, so keeping your email secure is how you keep your account secure.\n\n## 3. Acceptable use\n\nUse ReachKit for your own website or one you are authorised to work on. Do not scan domains in order to harass or harm anyone; do not attempt to break, overload, scrape or reverse-engineer the service; do not use the pages it writes for anything unlawful or deceptive; and do not resell its output as a bulk service without our written agreement.\n\n## 4. Price, billing and cancellation\n\nThe free report costs nothing and asks for no account. The subscription is €49 per month, VAT included, billed in advance through Stripe, and runs month to month. Cancel any time from Settings, where our payment provider Stripe’s billing page does it; you do not need to write to us. Your access continues to the end of the month you have paid for and is not renewed after it. Payments already made are not refunded unless the law requires it. We may change the price with reasonable notice; a change never applies to a period you have already paid for.\n\n## 5. Your content and the pages we write\n\nYou keep ownership of what you give us and of every page ReachKit writes for you. Each page is grounded in facts from your own live pages, names no invented author, avoids anything on your never-claim list, and is labelled as written by ReachKit wherever the product shows it to you. You are the publisher of record: a page goes live under your name, on your domain or your WordPress, and you are responsible for what is published there. Every page waits for the time to stop it that you set (24 hours by default, anywhere from 1 to 7 days) before it publishes. You can edit, stop, unpublish or export any page at any time.\n\n## 6. Where pages are published\n\nPages are published either to a hosted address on a subdomain of your own domain that you point at us, or to a WordPress site you connect. Preview addresses under reachkit.app are never indexed. Credentials you give us are encrypted, never logged, and revoked when you disconnect. If your access ends, hosted pages stay served for 30 days and then stop; your export stays available after that. For the pages we host for you, we process their visitors’ data on your behalf under our [data processing agreement](/dpa), which forms part of these Terms.\n\n## 7. Guidance, not guarantees\n\nScores, verdicts and problems are measured from public signals — your site’s HTML, search rankings, search volumes and the AI answers we read — using fixed rules. AI answers and rankings change, and none of this is a guarantee of rankings, mentions, traffic, revenue or any other outcome, nor legal, financial or professional advice. The service is provided “as is” and “as available” to the extent the law allows.\n\n## 8. Liability\n\nTo the maximum extent permitted by law, ReachKit is not liable for indirect, incidental, special or consequential damages, or for lost profits, revenue or data. Where liability cannot be excluded, our total liability is limited to the amount you paid us in the twelve months before the event giving rise to the claim. Nothing here limits liability that cannot be limited by law.\n\n## 9. Ending things\n\nYou may stop using ReachKit at any time. Cancelling takes effect at the end of the month you have paid for. Deleting your account exports your pages to you first and then removes your data; hosted pages stop being served at once. We may suspend or end access if you breach these Terms or use the service in a way that risks harm to others or to the service. Sections that by their nature should survive — the disclaimer and the limits above — continue to apply.\n\n## 10. Changes\n\nWe may update these Terms as the product changes. The date above is the current version’s, and continued use after a change means you accept it.\n\n## 11. Contact and governing law\n\nQuestions about these Terms go to hello@reachkit.app or to the postal address in our Imprint. These Terms, and every contract made under them, are governed by the law of Germany, excluding the UN Convention on Contracts for the International Sale of Goods. Where the law allows it, in particular where you are a merchant, a legal person under public law, or have no general place of jurisdiction in Germany, the courts of Berlin, Germany, have exclusive jurisdiction over any dispute arising from or in connection with these Terms.",
  "legal.dpa.title": "Data Processing Agreement",
  "legal.dpa.body": "## 1. What this agreement is\n\nThis is the data processing agreement under Article 28 of the GDPR between you, the customer, as controller, and Tim Clifford, trading as ReachKit, Schwedter Straße 235, 10435 Berlin, Germany (“ReachKit”, “we”, “us”), as processor. It covers the pages we host for you on your own domain, where we process the personal data of the people who visit them on your behalf. It forms part of our [Terms](/terms) and applies for as long as you publish hosted pages; there is nothing to sign. For everything else ReachKit does with personal data we are the controller, and our [privacy notice](/privacy) applies.\n\n## 2. The standard clauses\n\nYou and we agree to the European Commission’s standard contractual clauses between controllers and processors, set out in the Annex to Commission Implementing Decision (EU) 2021/915 of 4 June 2021, which are incorporated into this agreement by reference. Where they and our Terms disagree, the clauses prevail. In them:\n\n- Clause 5, the optional docking clause, is not used.\n- Under Clause 7.7, Option 2 applies: you give us general written authorisation to engage the sub-processors listed below, and we tell you of any intended addition or replacement at least 30 days in advance, so that you can object.\n- Clause 7.8 on international transfers is met by the safeguard named for each sub-processor below.\n- Their four annexes are the four sections that follow.\n\n## 3. The parties (Annex I)\n\n- **Controller:** the customer who publishes hosted pages, as named in their ReachKit account, reached at the email address they sign in with.\n- **Processor:** Tim Clifford, trading as ReachKit, Schwedter Straße 235, 10435 Berlin, Germany, reached at hello@reachkit.app.\n\n## 4. The processing (Annex II)\n\n- **Subject matter and nature.** Serving the pages ReachKit writes and publishes for you on a subdomain of your own domain, and counting how they are read.\n- **Data subjects.** The people, and the programs, that open your hosted pages.\n- **Personal data.** The visitor’s network address and the request headers their browser sends, such as browser details and the page they came from, processed while the page is served. We reduce the browser details, the referring page and any `utm_source` to an engine and a kind of read, and keep only a count by page, engine and day. When a request claims to come from Google’s crawler, its network address is checked against Google’s published ranges and then discarded.\n- **Special categories.** None.\n- **Purpose.** To deliver your pages to their readers, to protect the service from abuse, and to show you how often AI answers and search engines read your pages and send people to them.\n- **Duration.** For as long as you publish hosted pages. When your access ends, hosted pages stay served for 30 days and then stop; when you delete your account they stop at once, and the counts are removed with the rest of its data within {erasureDays} days.\n- **Frequency.** Continuous, on every request to a hosted page.\n\n## 5. Security measures (Annex III)\n\n- Hosted pages are served only over encrypted connections.\n- Stored data is encrypted at rest by our database and hosting providers.\n- A visit leaves nothing behind but a count: we store no visitor’s network address or headers, and we place nothing on their device.\n- Database access rules refuse every read and write by default; a customer’s data is reachable only from their own signed-in account and from our own servers.\n- Keys and credentials are held only as encrypted settings of our hosting provider, never in code and never in logs.\n- Access to the systems that run the service is limited to the operator.\n- We tell you of a personal data breach that affects your visitors without undue delay, and help you answer a visitor who exercises their rights. Since we keep nothing that identifies a visitor, there is usually nothing to hand over or delete.\n\n## 6. Sub-processors (Annex IV)\n\nThis list is current as of the date above. Each sub-processor touches hosted-page traffic or what it leaves behind, and receives only what its job needs.\n\n- **Vercel** — Serves every hosted page, and so receives each visitor’s request, network address and headers. United States; EU-U.S. Data Privacy Framework.\n- **Supabase** — Holds the pages and their daily counts; it receives no visitor’s address or headers. United States; Standard Contractual Clauses.\n- **Cloudflare** — Runs the name servers for the address your subdomain points at; it answers the lookup and does not receive the page request. United States; EU-U.S. Data Privacy Framework.\n\nBefore we add or replace a sub-processor, we change this list and its date, and email every customer with hosted pages at the address they sign in with, at least 30 days before the change takes effect. To object, write to hello@reachkit.app within that time. If we cannot meet your objection, you may unpublish your hosted pages or end your subscription before the change applies to you.\n\n## 7. Contact\n\nQuestions about this agreement, and objections, go to hello@reachkit.app or to the postal address in our [Imprint](/imprint).",
  "legal.imprint.title": "Imprint",
  "legal.imprint.body": "**Operator**\n\n- Tim Clifford, trading as ReachKit\n- Schwedter Straße 235\n- 10435 Berlin\n- Germany\n\n**Contact**\n\n- Email: hello@reachkit.app\n- Phone: +49 160 90840910\n\n**Responsible for the content of reachkit.app** (§ 18(2) MStV): Tim Clifford, address as above.\n\n**Report removal:** a site owner who wants the report about their domain taken down writes to remove@reachkit.app.",

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
  "legal.updated": "updated {date}",
  "legal.privacy.updated": "16 Nov 2026",
  "legal.terms.updated": "10 Nov 2026",
  "legal.imprint.updated": "7 Nov 2026",
  "legal.dpa.updated": "16 Nov 2026",
  /* ── How it works and About ───────────────────────────────────────────
     Issue 1396 (owner, 2026-10-10: "go"). Every sentence here is drafted
     and named in that pull request for the owner to correct. A figure is
     always a slot, filled at render from `src/lib/config/constants.ts`
     (`src/app/(public)/_how/facts.ts`), so no number is typed here. */
  "chrome.nav.works": "How It Works",
  "chrome.nav.about": "About",

  // The head and the four steps
  "how.eyebrow": "How It Works",
  "how.headline": "You Run Your Business, ReachKit Gets You Found",
  "how.lead": "We research your business and competitors. Then every week we write and publish pages that help buyers find you.",
  "how.top.monday": "Checked what {buyers} search and ask AI",
  "how.step.eyebrow": "Step {n} · {name}",
  "how.steps.jump": "The Four Steps",
  "how.step.1.title": "We Research You",
  "how.step.1.when": "first, then every Monday",
  "how.step.2.title": "We Pick What Buyers Ask",
  "how.step.2.when": "every Monday",
  "how.step.2.line": "The questions you can win on Google and in AI answers.",
  "how.step.3.title": "We Write Your Pages",
  "how.step.3.when": "up to {weekPages} a week",
  "how.step.4.title": "You See It Working",
  "how.step.4.when": "from week {week}",
  "how.step.4.line": "A Monday email shows what went live and your totals so far.",
  "how.steps.loop": "Repeats every week, without you",
  "how.steps.part": "Your part: answer a few questions and connect your site.",

  // research
  "how.research.title": "We Get to Know Your Business",
  "how.research.body": "First we read your website: what you sell, who buys, and where. Every page starts from this, so it says only what’s true.",
  "how.read.title": "Your business, as we read it",
  "how.read.pages": "{pages} pages read",
  "how.read.name": "Name",
  "how.read.sell": "What you sell",
  "how.read.buyers": "Who buys",
  "how.read.where": "Where",
  "how.read.language": "Language",
  "how.read.from": "from {source}",
  "how.read.whole": "from the whole site",
  "how.read.fix": "Wrong? Fix it in setup.",
  "how.read.held.ai": "AI is shut out of your site",
  "how.read.held.list": "No page list for Google",

  // competitors
  "how.rivals.title": "Who Buyers Choose Instead of You",
  "how.rivals.body": "We look up what your buyers search and ask AI, and see who gets chosen instead of you.",
  "how.rivals.google": "On Google",
  "how.rivals.first": "Google’s first page",
  "how.rivals.missing": "{business}: not on the first page",
  "how.rivals.ai": "Asked to AI",
  "how.rivals.answer": "AI answer",
  "how.rivals.absent": "{business}: not mentioned",
  "how.rivals.tally": "Mentioned in {n} of {total} AI answers",
  "how.rivals.more": "… and {n} more results",

  // questions
  "how.pick.title": "We Pick Questions You Can Win",
  "how.pick.body": "We pick questions that fit you, get searched, and that you can win. Each becomes a new page, or an update to one you have.",
  "how.pick.list": "What {buyers} search for",
  "how.pick.volume": "searched about {n} times a month",
  "how.pick.picked": "Picked",
  "how.pick.skipped": "Skipped",
  "how.reason.rival": "A competitor answers this",
  "how.reason.fits": "Fits your business, often asked",
  "how.reason.gap": "No page of yours answers this",
  "how.reason.update": "Your page is far down; update it",
  "how.reason.off": "Not a buyer",

  // pages
  "how.week.title": "Your Pages Go Live Every Week",
  "how.week.body": "Every Monday we plan up to {weekPages} pages for the week, new or updated. If nothing is worth writing, we skip the day.",
  "how.week.name": "{business}’s week",
  "how.week.auto": "Runs by itself",
  "how.week.new": "New",
  "how.week.update": "Update",
  "how.week.waiting": "Goes live tomorrow, {time}.",
  "how.week.edit": "Edit",
  "how.week.stop": "Stop",
  "how.week.planned": "Planned",
  "how.week.skip": "Nothing worth writing today, so no page.",
  "how.week.skip.why": "We skip a day, never fill it.",
  "how.week.address": "On your own web address.",

  // true
  "how.true.title": "Pages True to Your Business",
  "how.true.body": "Pages are written with AI, only from facts on your site and linked sources. Each faces up to {checks} checks, and anything invented is held back.",
  "how.true.eyebrow": "{business} · {place}",
  "how.true.never": "Not on your site, so it’s not in your page",
  "how.true.passed": "{checks} checks passed",
  "how.disclosure": "Written with Claude, an AI model, from your own site.",

  // found
  "how.found.title": "See It Working From Week {week}",
  "how.found.body": "Every Monday an email shows what went live and your totals so far. Google moves slowly, so it also shows what comes next.",
  "how.mail.subject": "AI mentioned you 3 more times",
  "how.mail.calm": "Nothing needs you. Each page goes live at {time} on its day unless you stop it.",
  "how.mail.why": "Why: {why}",
  "how.when.title": "What to expect, when",
  "how.when.first.at": "Week one",
  "how.when.first.what": "Your pages go live and your first Monday email arrives.",
  "how.when.found.at": "Days to weeks",
  "how.when.found.what": "Google finds your pages.",
  "how.when.showing.at": "Weeks",
  "how.when.showing.what": "Pages start showing when people search.",
  "how.when.top.at": "Months",
  "how.when.top.what": "Some reach Google’s first page. Not every page gets there.",

  // you do
  "how.part.title": "Your Part: Three Steps",
  "how.part.body": "Check what we read about your business, then connect your website. After that you’re done, though you can edit or stop any page.",
  "how.part.one": "Is this your business?",
  "how.part.one.line": "Your website, your country and the area you serve.",
  "how.part.two": "Here’s what we read",
  "how.part.two.line": "Fix anything we got wrong.",
  "how.part.optional": "optional",
  "how.part.three": "Connect your website",
  "how.part.three.line": "Copy one line we give you into your domain’s settings.",
  "how.part.pill.line": "one line",
  "how.part.after": "Every week after: nothing to do",
  "how.part.page": "goes live by itself",
  "how.part.window": "Optional. Each page goes live {hours} hours after it is written, unless you stop it.",

  // value
  "how.value.title": "{price} a Month, Everything Included",
  "how.value.body": "One plan, tax included. No contract, and you can cancel any time.",
  "how.value.jobs": "Who does the {jobs} jobs",
  "how.value.job.research": "research",
  "how.value.job.choose": "choose",
  "how.value.job.write": "write",
  "how.value.job.publish": "publish",
  "how.value.job.check": "check results",
  "how.value.time": "Your time",
  "how.value.covers": "Also covers Maps listing, ads and links",
  "how.value.cost": "Cost",
  "how.value.diy": "Do it yourself",
  "how.value.diy.jobs": "You do all {jobs}, every week",
  "how.value.diy.time": "Hours of your time, every week",
  "how.value.diy.covers": "You can",
  "how.value.diy.cost": "Your time, plus any AI writing tool",
  "how.value.diy.cost.head": "Hours, not money",
  "how.value.agency": "An agency",
  "how.value.agency.jobs": "They do; you brief and review",
  "how.value.agency.time": "A briefing call, then reviews",
  "how.value.agency.covers": "Often yes",
  "how.value.agency.cost": "a month, the most common fee¹",
  "how.value.ours.jobs": "We do all {jobs}, every week",
  "how.value.ours.time": "A few questions and one setting",
  "how.value.ours.covers": "No",
  "how.value.ours.cost": "{price} a month",
  "how.value.source": "¹ Most common agency fee for this work, Ahrefs survey of {providers} providers, {year}",
  "how.value.not": "Not included",
  "how.value.chart": "What it costs you each month",
  "how.value.chart.scale": "{min} to {max} a month. $ and € are not converted.",
  "how.value.chart.agency": "{fee} a month¹",
  "how.value.not.maps": "Your Google Maps listing",
  "how.value.not.ads": "Ads",
  "how.value.not.social": "Social posts",
  "how.value.not.perplexity": "Perplexity",
  "how.value.not.sites": "More than one website per plan",
  "how.value.not.promise": "A promise of a top spot on Google",
  "how.never.invent": "Invent people, reviews, tests or numbers.",
  "how.never.hide": "Hide text on a page.",

  // start
  "how.start.glance": "Your free report, at a glance",
  "how.start.score": "{score} of {max}",
  "how.start.score.name": "Visibility Score: one number for how easy you are to find",
  "how.start.ai": "{n} of {total} AI answers mention you",
  "how.start.missing": "{n} pages your site is missing",
  "how.start.caption": "{business}’s report",

  "about.title": "About ReachKit",
  "about.lead": "We work on getting your business found on Google and in AI answers. Every week we write pages from your site and put them live.",
  "about.who.title": "Who Builds It",
  "about.photo.alt": "Tim Clifford, who builds ReachKit",
  "about.who.founder": "ReachKit is built by {name}.",
  "about.who.founder.place": "ReachKit is built by {name} in {place}.",
  "about.who.imprint": "The company that runs it is named on the imprint.",
  "about.who.ask": "Questions?",
  "about.why.title": "Why ReachKit exists",
  "about.why.problem": "Buyers now ask AI what to use. The answer names only a few businesses.",
  "about.why.answer": "We check where you stand every week, and write the pages you’re missing.",
  "about.before.label": "Before",
  "about.before.line": "A buyer searched, and got a page of links",
  "about.now.label": "Now",
  "about.now.line": "A buyer asks AI, and gets one answer",
  "about.now.absent": "Everyone else: not mentioned",
  "about.does.title": "What ReachKit does, in four steps",
  "about.step.research": "Your business, your buyers and who they choose instead.",
  "about.step.pages": "Up to {weekPages} a week, from your own site, live on your website.",
  "about.rules.title": "The rules we keep",
  "about.rules.never": "We never",
  "about.never.promise": "Promise a top spot on Google.",
  "about.never.filler": "Put filler live.",
  "about.rules.always": "We always",
  "about.rules.source": "Every figure on a page matches a source.",
  "about.rules.checks": "A page that fails its checks twice never goes live.",
  "about.rules.unmeasured": "Something we couldn’t measure is shown as not measured, never as zero.",
  "about.proof.title": "See it on a real site",
  "about.proof.newest": "The newest page on ReachKit’s own blog",
  "about.proof.report": "Our own free report",
  "about.proof.open": "Open the report",
  "about.contact.address": "hello@reachkit.app",
  "about.how": "How ReachKit works, step by step",

  // Issue 1458: the pages Google still ranks from earlier versions. The articles' own words are data in `src/app/(public)/_library/`; these are the screens' words around them.
  "chrome.footer.learn": "Learn",
  "chrome.nav.compare": "Compare",
  "chrome.nav.tools": "Free Tools",
  "chrome.nav.teardowns": "Teardowns",
  // Issue 1512: ReachKit's own published articles, on its content host, linked from the footer and the landing.
  "chrome.nav.articles": "Articles",
  "landing.articles.heading": "Written by ReachKit",
  "landing.articles.all": "All articles",
  "library.sources": "Sources",
  "library.checked": "Facts checked on {date}.",
  "library.source": "{label} ({host})",
  "library.trademarks": "Product names are trademarks of their owners. ReachKit is not affiliated with or endorsed by them.",
  // The closing block every Learn page shares: what ReachKit does for the reader's own site, the weekly loop, their part, and the scan field.
  "library.close.compare.title": "Tools Help. ReachKit Does the Work.",
  "library.close.compare.them": "With a tool, you",
  "library.close.compare.us": "With ReachKit, we",
  "library.close.compare.1.them": "Look up what people search for",
  "library.close.compare.1.us": "We check what your buyers search and ask AI, every Monday",
  "library.close.compare.2.them": "Decide what to write",
  "library.close.compare.2.us": "We pick up to {weekPages} pages a week, new or updated",
  "library.close.compare.3.them": "Write it, or check what AI wrote",
  "library.close.compare.3.us": "We write from facts on your own site, put through up to {checks} checks",
  "library.close.compare.4.them": "Put it live and link it to your other pages",
  "library.close.compare.4.us": "It goes live on your website by itself",
  "library.close.compare.5.them": "Find out whether it worked",
  "library.close.compare.5.us": "The Monday email shows what went live and your totals so far",
  "library.close.teardown.title": "What ReachKit does for your site",
  "library.close.teardown.them": "A teardown gives you",
  "library.close.teardown.us": "ReachKit gives your site",
  "library.close.teardown.1.them": "A read of one product’s public pages",
  "library.close.teardown.1.us": "Your site, read first, then checked every Monday",
  "library.close.teardown.2.them": "An opinion on the pages it could add",
  "library.close.teardown.2.us": "The questions your buyers ask that no page of yours answers",
  "library.close.teardown.3.them": "Takeaways for you to act on",
  "library.close.teardown.3.us": "Pages written and live on your website, up to {weekPages} a week",
  "library.close.teardown.cta": "Get your site read, free",
  "library.close.teardowns.title": "Your site and competitors, read weekly",
  "library.close.teardowns.2.them": "An opinion on pages it could add",
  "library.close.teardowns.cta.lead": "The free scan shows where your buyers go instead, and suggests your first page.",
  "library.close.tools.title": "One page here, every page weekly",
  "library.close.tools.them": "A free tool",
  "library.close.weekly": "ReachKit, every week",
  "library.close.tools.1.them": "Checks one page when you ask",
  "library.close.tools.1.us": "Reads your whole site, then checks your market every Monday",
  "library.close.tools.2.them": "Shows what to fix",
  "library.close.tools.2.us": "Writes the pages your buyers are looking for",
  "library.close.tools.3.them": "You make each fix yourself",
  "library.close.tools.3.us": "Pages go live on your website by themselves",
  "library.close.tool.them": "This tool",
  "library.close.tool.1.them": "You check one page at a time",
  "library.close.tool.wordpress": "On WordPress, we fill in missing titles and the text under your links",
  "library.close.meta.1.us": "We read your whole site, then check your market every Monday",
  "library.close.meta.2.them": "You fix the hidden text yourself",
  "library.close.meta.3.them": "A better title helps a page get clicked",
  "library.close.meta.3.us": "New pages answer what buyers ask, so there’s more to find",
  "library.close.onpage.1.us": "We read up to {pages} pages, then check your market every Monday",
  "library.close.onpage.2.them": "You fix what the check finds",
  "library.close.onpage.3.them": "A tidy page still has to be found",
  "library.close.onpage.3.us": "New pages answer what buyers ask, up to {weekPages} a week",
  "library.close.scans.title": "Reports look once. ReachKit keeps going.",
  "library.close.scans.lead": "The free report shows where you stand today. With ReachKit, we check every Monday and write the pages you’re missing.",
  "library.close.scans.them": "The free report",
  "library.close.scans.1.them": "One report, on the day you scan",
  "library.close.scans.1.us": "Checked again every Monday",
  "library.close.scans.2.them": "A list of pages you’re missing",
  "library.close.scans.2.us": "Up to {weekPages} pages a week, written and live on your website",
  "library.close.scans.3.them": "A score you check yourself",
  "library.close.scans.3.us": "The Monday email shows your totals so far",
  "library.close.loop.1.title": "We check your market",
  "library.close.loop.1.when": "every Monday",
  "library.close.loop.1.line": "What buyers search and ask AI, and who they find instead of you.",
  "library.close.loop.2.title": "We pick the week’s pages",
  "library.close.loop.2.when": "up to {weekPages} a week",
  "library.close.loop.2.line": "New pages, or updates to ones you have. Never filler.",
  "library.close.loop.3.title": "Your pages go live",
  "library.close.loop.3.when": "on your website",
  "library.close.loop.3.line": "Written from facts on your own site. Edit or stop any page first.",
  "library.close.loop.4.title": "You see your totals so far",
  "library.close.loop.4.when": "from week 1",
  "library.close.loop.4.line": "The Monday email shows what went live and your totals so far.",
  "library.close.loop.4.sample": "{live} pages published so far",
  "library.close.example": "{business} is an example business.",
  "library.close.part": "Your part: answer a few questions and connect your site. Then nothing, unless you want to edit or stop a page.",
  "library.close.glance": "{business}’s report. For software, {software}’s report shows the same three numbers.",
  "library.close.scan.domain": "Scan {domain} for free",
  "compare.eyebrow": "Compare",
  "compare.title": "Compare ReachKit",
  "compare.lead": "How ReachKit Compares with AI Writing Tools, Google Research Tools and Page Checkers",
  "compare.jump": "{count} comparisons",
  "compare.group.suite": "Google Research Suites",
  "compare.group.suite.line": "Data about Google, for the person who does the work.",
  "compare.group.checker": "Page Checkers",
  "compare.group.checker.line": "Check one page at a time, and tell you what to fix.",
  "compare.group.competitors": "Competitor Research",
  "compare.group.competitors.line": "Data on the businesses you compete with.",
  "compare.group.audience": "Audience Research",
  "compare.group.audience.line": "Where your buyers spend their time.",
  "compare.group.ai": "AI Writing Tools",
  "compare.group.ai.line": "Write text when you ask. You do the rest.",
  "compare.group.data": "Search and App Data",
  "compare.group.data.line": "Figures about your own site, or your app.",
  "compare.item.table": "Side by side",
  "compare.item.feature": "What it does",
  "compare.item.yes": "Yes",
  "compare.item.no": "No",
  "compare.item.pick.them": "Pick {name} When",
  "compare.item.pick.us": "Pick ReachKit When",
  "compare.card.read": "Read the Comparison",
  "compare.item.more": "All comparisons",
  "compare.item.partly": "Partly",
  "compare.item.trail": "Breadcrumb",
  "compare.item.assistant": "Assistant",
  "compare.item.jobs": "Who does each job?",
  "compare.item.jobs.job": "The job",
  "compare.item.jobs.with": "With {name}",
  "compare.item.jobs.you": "You",
  "compare.item.jobs.count": "You do {count} of the 5 jobs,",
  "compare.item.jobs.every": "for every page.",
  "compare.item.jobs.none": "You do none of them.",
  "compare.item.jobs.none.line": "You can still edit or stop any page.",
  "compare.item.instead": "What ReachKit does instead",
  "compare.item.instead.lead": "Every Monday we check what your buyers search and ask AI. Then up to {weekPages} pages a week go live on your site by themselves.",
  "compare.job.choose": "Pick the topic",
  "compare.job.facts": "Give it the facts, check each claim",
  "compare.job.write": "Write the page",
  "compare.job.live": "Put it live, link it to your pages",
  "compare.job.results": "Find out whether it worked",
  "compare.job.facts.self": "Gather the facts, check each claim",
  "teardowns.title": "Teardowns",
  "teardowns.lead": "How real products explain themselves to buyers. Each one sourced and kept current.",
  "teardowns.reads.title": "What Every Teardown Reads",
  "teardowns.reads.offers": "What it offers",
  "teardowns.reads.offers.line": "What the hero and the plans say, quoted.",
  "teardowns.reads.promise": "The promise that sells",
  "teardowns.reads.promise.line": "The one outcome a buyer can say yes to.",
  "teardowns.reads.buyer": "Who it is for",
  "teardowns.reads.buyer.line": "The buyer with a reason to act now.",
  "teardowns.reads.opinion": "Our opinion",
  "teardowns.reads.opinion.line": "Pages it could add.",
  "teardowns.reads.caption": "A sketch, not a screenshot.",
  "teardowns.reads.deadline": "Buyer with a deadline",
  "teardowns.reads.side": "Side project",
  "teardowns.reads.page": "A page it could add",
  "teardowns.count": "{count} products",
  "teardowns.legend": "marks each product’s sharpest promise, in our words",
  "teardowns.card.read": "Read the Teardown",
  "teardowns.part": "{n} · {name}",
  "teardowns.part.offers": "What it offers",
  "teardowns.part.promise": "The promise",
  "teardowns.part.buyer": "The buyer",
  "teardowns.part.opinion": "Our opinion",
  "teardowns.sketch.lower": "further down the page",
  "teardowns.promise.crowd": "How many tools sound",
  "teardowns.promise.tool": "tool {letter}",
  "teardowns.promise.caption": "Our illustration. Tools A to C are not named products.",
  "teardowns.toc": "On this page",
  "teardowns.item.dates": "Written {written} · revised {revised}",
  "teardowns.item.dates.checked": "Written {written} · checked {checked}",
  "teardowns.sketch.caption": "Home page read {read}, checked {checked}. Quotes are its own words.",
  "teardowns.item.takeaways": "Takeaways",
  "teardowns.item.more": "All teardowns",
  "answers.faq": "Questions people ask",
  "tools.eyebrow": "Free Tools",
  "tools.title": "Free SEO Tools",
  "tools.lead": "See how Google sees one page. For your whole site, run the free scan.",
  "tools.meta.name": "Meta Tag Preview",
  "tools.meta.line": "See how a page looks in a Google result and when it is shared, and what’s missing.",
  "tools.meta.intro": "A meta tag preview shows how a page looks in Google and when shared.",
  "tools.onpage.name": "On-Page Check",
  "tools.onpage.line": "Check the title, headings and hidden text Google reads on one page.",
  "tools.onpage.intro": "An on-page check reads what Google sees on one page, like its title and headings.",
  "tools.scan.name": "Free Scan",
  "tools.scan.line": "Your whole site on Google and AI, with your competitors and a Visibility Score.",
  "tools.field.label": "Page address",
  "tools.field.placeholder": "yourdomain.com/page",
  "tools.submit": "Check This Page",
  "tools.problem.address": "That doesn’t look like a page address. Try the form example.com/page.",
  "tools.problem.limit": "That is the hourly limit for free checks. Try again in an hour, or run the free scan.",
  "tools.problem.read": "We could not read {url}. Check the address and try again.",
  "tools.problem.robots": "{url} asks automated readers not to read it, so we did not.",
  "tools.result": "{fine} of {total} checks are fine on {url}.",
  "tools.status.fine": "Fine",
  "tools.status.fix": "Fix",
  "tools.check.title": "Page title",
  "tools.check.title.fine": "{chars} characters: {value}",
  "tools.check.title.none": "The page has no title.",
  "tools.check.title.long": "{chars} characters, so Google may cut it short: {value}",
  "tools.check.description": "Text under your link",
  "tools.check.description.fine": "{chars} characters: {value}",
  "tools.check.description.none": "The page has none, so Google picks a piece of the page to show.",
  "tools.check.description.long": "{chars} characters, so Google may cut it short: {value}",
  "tools.check.h1": "Main heading",
  "tools.check.h1.fine": "One main heading: {value}",
  "tools.check.h1.none": "The page has no main heading.",
  "tools.check.h1.many": "The page has {count} main headings. One says more clearly what it is about.",
  "tools.check.canonical": "Main address",
  "tools.check.canonical.fine": "Points to {value}",
  "tools.check.canonical.none": "The page names no main address.",
  "tools.check.index": "Allowed on Google",
  "tools.check.index.fine": "Google and Bing may list this page.",
  "tools.check.index.none": "The page tells Google and Bing not to list it.",
  "tools.check.schema": "Business details for Google",
  "tools.check.schema.fine": "Says it’s {value}",
  "tools.check.schema.none": "The page gives Google no business details.",
  "tools.check.schema.other": "The page has labels for Google, but none says who runs the site.",
  "tools.check.share": "Link preview",
  "tools.check.share.fine": "The title, text and image for shared links are set.",
  "tools.check.share.none": "Missing: {value}",
  "tools.check.viewport": "Phone layout",
  "tools.check.viewport.fine": "The page is sized for phones.",
  "tools.check.viewport.none": "The page isn’t sized for phones, so phones shrink the desktop layout.",
  "tools.check.images": "Image descriptions",
  "tools.check.images.fine": "Every image has a description.",
  "tools.check.images.empty": "The page has no images.",
  "tools.check.images.none": "{count} of {total} images have no description for people who can’t see them.",
  "tools.check.lang": "Language",
  "tools.check.lang.fine": "Set to {value}",
  "tools.check.lang.none": "The page declares no language.",
  "tools.preview.google": "In a Google result",
  "tools.preview.share": "When the link is shared",
  "tools.preview.tags": "What the page tells Google",
  "tools.preview.untitled": "No title",
  "tools.preview.undescribed": "No description",
  "tools.preview.noimage": "No share image",
  "tools.micro": "One page · free · no account · no email",
  "tools.list.label": "Tools",
  "tools.onpage.cta": "Check a page",
  "tools.meta.cta": "Preview a page",
  "tools.fine.of": "{fine} of {total} checks are fine",
  "tools.fine.count": "{n} checks are fine",
  "tools.fix.count": "{n} to fix",
  "tools.all": "All {n} checks",
  "tools.group.google": "In Google’s results",
  "tools.group.reads": "What Google reads",
  "tools.group.visitors": "What visitors get",
  "tools.mark.label": "Where the checks sit on the page",
  "tools.mark.fine": "{name}: fine",
  "tools.mark.fix": "{name}: to fix",
  "tools.mark.missing": "{name}: missing",
  "tools.mark.images": "{count} of {total} images without a description",
  "tools.mark.nodescription": "no text under the link",
  "tools.preview.of": "Preview of {page}",
  "tools.preview.fine": "of {total} fine",
  "tools.preview.fine.count": "{n} fine",
  "tools.preview.fix.count": "{n} to fix: {names}",
  "tools.preview.title": "Title",
  "tools.preview.text": "Text under the link",
  "tools.preview.chars.fits": "{chars} characters · fits",
  "tools.preview.chars.long": "{chars} characters · Google may cut it short",
  "tools.preview.chars.none": "missing",
  "tools.preview.image.none": "Add a share picture. Without one, the shared link shows no picture.",
  "tools.preview.image.fine": "The shared link shows a picture.",
  "tools.preview.missing": "Missing",
  "tools.tag.page-title": "The page title in a Google result",
  "tools.tag.page-title.name": "the title",
  "tools.tag.description": "The text under your link in Google",
  "tools.tag.description.name": "the text under your link",
  "tools.tag.canonical": "The page’s main address",
  "tools.tag.canonical.name": "the main address",
  "tools.tag.og-title": "The title when the link is shared",
  "tools.tag.og-title.name": "the shared title",
  "tools.tag.og-description": "The text when the link is shared",
  "tools.tag.og-description.name": "the shared text",
  "tools.tag.og-image": "The picture when the link is shared",
  "tools.tag.og-image.name": "the share picture",
  "tools.tag.twitter-card": "How the link looks when shared on X",
  "tools.tag.twitter-card.name": "the X card",
  "answers.short": "Short Answer",
  "gone.head": "This Page Is Gone",
  "gone.line": "It belonged to an earlier version of ReachKit and has no replacement. The free scan is the place to start.",
}) satisfies CopyPartition;
