import type { LegalDocument } from "./types";

/**
 * Privacy Policy content — GDPR-shaped, honest about exactly what ReachKit
 * collects and which sub-processors touch the data. Data-only; rendered by the
 * shared LegalLayout. Update `lastUpdated` whenever the substance changes.
 */
export const privacy: LegalDocument = {
  title: "Privacy Policy",
  intro:
    "What we collect, why we collect it, and who we share it with. We keep this short and honest.",
  lastUpdated: "2026-06-13",
  sections: [
    {
      heading: "Who we are",
      body: [
        "ReachKit (“ReachKit”, “we”, “us”) is a discoverability and go-to-market tool for founders. This policy explains how we handle personal data when you use the website and product at reachkit.app.",
        "For the legal operator details and the data controller for the purposes of the GDPR, see our Imprint.",
      ],
    },
    {
      heading: "What data we collect",
      body: [
        "We try to collect as little as possible. Specifically:",
      ],
      list: [
        "Scan inputs — the App Store URLs and website URLs you submit for analysis, and the report data we derive from them.",
        "Email address — used to send you the magic link you sign in with, and product email related to your account.",
        "A hashed form of your IP address — stored only to rate-limit scans and prevent abuse. We do not retain raw IP addresses for analytics.",
        "Usage analytics — anonymised, aggregated product events (pages viewed, features used) via PostHog, so we can understand what works and fix what doesn’t.",
        "Billing data — if you subscribe, your payment is handled by Stripe; we store your subscription status and a Stripe customer reference, never your full card number.",
      ],
    },
    {
      heading: "How we use it",
      body: [
        "We use your data to run scans and generate your report, to authenticate you, to operate and improve the product, to process subscriptions, and to protect the service from abuse. We do not sell your personal data, and we do not use your scan inputs to train third-party models beyond what is necessary to generate your report.",
      ],
    },
    {
      heading: "Service providers (sub-processors)",
      body: [
        "We rely on a small set of trusted providers to deliver the service. Each only receives the data needed for its function:",
      ],
      list: [
        "Supabase — database, authentication, and storage for your account and scan data.",
        "Stripe — subscription billing and payment processing.",
        "Anthropic — the language model that generates report copy and draft actions from your scan inputs.",
        "DataForSEO — keyword, ranking, and search-visibility data used during a scan.",
        "Resend — transactional email delivery (magic links and account email).",
        "PostHog — privacy-conscious product analytics.",
      ],
    },
    {
      heading: "Legal basis & retention",
      body: [
        "Where the GDPR applies, we process your data on the basis of performing our contract with you (running scans, providing the product), our legitimate interest (securing the service, understanding product usage), and your consent where required. We keep account and scan data for as long as your account is active, and delete or anonymise it on request or within a reasonable period after account closure, subject to any legal retention obligations.",
      ],
    },
    {
      heading: "Your rights",
      body: [
        "You can ask us to access, correct, export, or delete your personal data, and you can object to or restrict certain processing. To exercise any of these rights, contact us using the email in our Imprint. If you are in the EU/EEA, you also have the right to lodge a complaint with your local data protection authority.",
      ],
    },
    {
      heading: "Cookies",
      body: [
        "We use a small number of strictly necessary cookies to keep you signed in, and privacy-conscious analytics that avoid cross-site tracking. We do not run third-party advertising cookies.",
      ],
    },
    {
      heading: "Changes & contact",
      body: [
        "We may update this policy as the product evolves; the “Last updated” date above always reflects the current version. For any privacy question or request, contact us at the address listed in our Imprint.",
      ],
    },
  ],
};
