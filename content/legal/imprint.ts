import type { LegalDocument } from "./types";

/**
 * Imprint / Impressum content.
 *
 * NOTE FOR LAUNCH: the registered postal address and VAT/registration number
 * still need to be filled in with the final operating-entity details before a
 * public launch in jurisdictions that require a full Impressum (e.g. Germany).
 * Until then this page is presentable (no broken placeholders) and is marked
 * `noindex` in app/(marketing)/imprint/page.tsx.
 */
export const imprint: LegalDocument = {
  title: "Imprint",
  intro:
    "Legal operator information for ReachKit. For any legal, privacy, or press matter, the contact email below is the fastest route to us.",
  lastUpdated: "2026-06-14",
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
      heading: "EU online dispute resolution",
      body: [
        "The European Commission provides a platform for online dispute resolution (ODR) at https://ec.europa.eu/consumers/odr. We are neither obliged nor willing to participate in dispute resolution proceedings before a consumer arbitration board unless stated otherwise once the operating entity is finalised.",
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
