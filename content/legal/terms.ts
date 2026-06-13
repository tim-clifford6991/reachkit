import type { LegalDocument } from "./types";

/**
 * Terms of Service content. Captures the load-bearing product stances:
 * the human-in-the-loop drafting rule (no auto-send), cancel-anytime billing,
 * and the "guidance not guarantees" disclaimer. Data-only; rendered by the
 * shared LegalLayout.
 */
export const terms: LegalDocument = {
  title: "Terms of Service",
  intro:
    "The agreement between you and ReachKit when you use the product. Plain language, no surprises.",
  lastUpdated: "2026-06-13",
  sections: [
    {
      heading: "1. The service",
      body: [
        "ReachKit analyses your App Store listing or website and produces a discoverability report — a score, positioning analysis, and a ranked queue of suggested actions with draft copy. Paid plans add an ongoing weekly action engine, monitoring, and verification. These Terms govern your use of the website and product at reachkit.app.",
      ],
    },
    {
      heading: "2. Eligibility & accounts",
      body: [
        "You must be able to form a binding contract to use ReachKit. You are responsible for the activity under your account and for keeping access to your email secure, since we use magic-link sign-in.",
      ],
    },
    {
      heading: "3. Acceptable use",
      body: [
        "Use ReachKit for your own products or products you are authorised to work on. Do not:",
      ],
      list: [
        "Scan URLs or domains you have no legitimate connection to in order to harass or harm others.",
        "Attempt to break, overload, scrape, or reverse-engineer the service.",
        "Use the service to generate spam, deceptive, or unlawful content.",
        "Resell or redistribute the output as if it were an automated bulk service without our written agreement.",
      ],
    },
    {
      heading: "4. Subscriptions & billing",
      body: [
        "Scanning is free. Paid plans are billed in advance on a recurring basis through Stripe at the price shown at checkout. You can cancel at any time; your plan remains active until the end of the current billing period and is not renewed after that. Except where required by law, payments already made are non-refundable. We may change pricing with reasonable notice; changes never apply to a period you have already paid for.",
      ],
    },
    {
      heading: "5. Your content",
      body: [
        "You keep ownership of the inputs you submit and the reports generated for you. You grant us the limited licence needed to process those inputs and operate the service (see the Privacy Policy for detail). You are responsible for ensuring you have the right to submit the URLs and information you provide.",
      ],
    },
    {
      heading: "6. Disclaimer — guidance, not guarantees",
      body: [
        "ReachKit’s scores, recommendations, and draft copy are probability-based guidance generated from public signals and language models. They are not guarantees of rankings, traffic, downloads, revenue, or any specific outcome, and they are not legal, financial, or professional advice. You are responsible for the decisions you make and the content you publish. The service is provided “as is” and “as available” without warranties of any kind, to the extent permitted by law.",
      ],
    },
    {
      heading: "7. Limitation of liability",
      body: [
        "To the maximum extent permitted by law, ReachKit is not liable for indirect, incidental, special, or consequential damages, or for lost profits, revenue, or data. Where liability cannot be excluded, our total aggregate liability is limited to the amount you paid us in the twelve months before the event giving rise to the claim. Nothing in these Terms limits liability that cannot be limited under applicable law.",
      ],
    },
    {
      heading: "8. Termination",
      body: [
        "You may stop using ReachKit and close your account at any time. We may suspend or terminate access if you breach these Terms or use the service in a way that risks harm to others or to the service. On termination, your right to use the service ends; sections that by their nature should survive (such as disclaimers and liability limits) continue to apply.",
      ],
    },
    {
      heading: "9. Changes to these Terms",
      body: [
        "We may update these Terms as the product evolves. The “Last updated” date above reflects the current version; continued use after a change means you accept the updated Terms.",
      ],
    },
    {
      heading: "10. Governing law & contact",
      body: [
        "The governing law and operator of the service are set out in our Imprint. For any question about these Terms, contact us at the email listed there.",
      ],
    },
    {
      heading: "11. Drafts require a human — no auto-send",
      body: [
        "ReachKit writes drafts; it never sends on your behalf. Every piece of outreach or published copy the product generates — emails, listing text, posts — is a draft that requires your review and edit before it goes anywhere. The product does not auto-send messages, auto-publish content, or contact third parties for you. This is a deliberate guardrail: you stay in control of, and accountable for, anything that reaches another person.",
      ],
    },
  ],
};
