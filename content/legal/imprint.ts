import type { LegalDocument } from "./types";

/**
 * Imprint / Impressum content (per German §5 TMG).
 *
 * The operating entity and jurisdiction are the deploy-time decision #5 and are
 * NOT finalised yet. The placeholder fields below are intentionally left as
 * bracketed TODOs and MUST be replaced with the real entity, address, contact,
 * and registration/VAT details before this goes live in production.
 *
 * TODO: finalize at deploy (entity/jurisdiction #5) — replace every […]
 * placeholder below and the governing-law reference in terms.ts §10.
 */
export const imprint: LegalDocument = {
  title: "Imprint",
  intro:
    "Legal operator information (Impressum) pursuant to § 5 TMG (German Telemedia Act).",
  lastUpdated: "2026-06-13",
  sections: [
    {
      heading: "Operator",
      body: [
        "TODO: finalize at deploy (entity/jurisdiction #5). The placeholders below are not the final legal details.",
      ],
      list: [
        "Entity: [Entity name]",
        "Address: [Address]",
        "Contact email: [Contact email]",
        "VAT / registration: [VAT/registration]",
      ],
    },
    {
      heading: "Responsible for content",
      body: [
        "Responsible for content pursuant to § 18 (2) MStV: [Responsible person, address] — TODO: finalize at deploy (entity/jurisdiction #5).",
      ],
    },
    {
      heading: "Contact",
      body: [
        "For any legal or privacy matter, reach us at [Contact email]. We aim to respond within a reasonable time.",
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
