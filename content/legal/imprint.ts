import type { LegalDocument } from "./types";

/**
 * Imprint / Impressum content.
 *
 * POC-LAUNCH RESIDUAL (2026-07-16): governing law + ODR stance are now stated
 * (generically — law of the operator's place of establishment), resolving the
 * dangling reference from terms.ts. Still pending owner input: the registered
 * postal address (a mailbox/registered-address service is fine) and, once one
 * exists, the named jurisdiction — a directly-visible address is required for
 * full e-Commerce-Directive/Impressum compliance (Germany especially). Until
 * then the page stays `noindex` in app/(marketing)/imprint/page.tsx.
 */
export const imprint: LegalDocument = {
  title: "Imprint",
  intro:
    "Legal operator information for ReachKit. For any legal, privacy, or press matter, the contact email below is the fastest route to us.",
  lastUpdated: "2026-07-16",
  sections: [
    {
      heading: "Operator",
      body: [
        "ReachKit is operated by Tim Clifford. Full registered postal address and VAT / registration details are available on request via the contact email below.",
      ],
      list: [
        "Service: ReachKit",
        "Operator: Tim Clifford",
        "Contact email: hello@reachkit.app",
      ],
    },
    {
      heading: "Responsible for content",
      body: [
        "Responsible for the content of these pages: Tim Clifford, reachable at hello@reachkit.app.",
      ],
    },
    {
      heading: "Contact",
      body: [
        "For any legal or privacy matter, reach us at hello@reachkit.app. We aim to respond within a reasonable time.",
      ],
    },
    {
      heading: "Governing law",
      body: [
        "ReachKit is operated by a sole trader established in the European Union. These pages and the ReachKit service are governed by the law of the operator's place of establishment; if you are a consumer, the mandatory consumer-protection rules of your country of residence remain unaffected. The full agreement is in our Terms of Service.",
      ],
    },
    {
      heading: "EU online dispute resolution",
      body: [
        "The European Commission provides a platform for online dispute resolution (ODR) at https://ec.europa.eu/consumers/odr. We are neither obliged nor willing to participate in dispute resolution proceedings before a consumer arbitration board.",
      ],
    },
    {
      heading: "Liability for content & links",
      body: [
        "As a service provider we are responsible for our own content on these pages under general law. We are not obliged to monitor third-party information transmitted or stored, or to investigate circumstances that indicate unlawful activity. Our site may contain links to external websites whose content we do not control; responsibility for that content lies with its respective operator.",
      ],
    },
  ],
};
