import type { Teardown } from "./types";

/**
 * Plausible Analytics — Web Discoverability Teardown
 *
 * Score band: 40–60 (rubric); assigned 52 (developing tier — strong category
 * presence and an established domain, but the discoverability strategy fights
 * head-on for "google analytics alternative" while under-serving the
 * higher-intent "GDPR / cookie-banner removal" audience it uniquely wins).
 */
const plausible: Teardown = {
  slug: "plausible",
  appName: "Plausible Analytics",
  title: "Web Teardown: Plausible Analytics",
  platform: "web",
  publishedAt: "2026-06-03",
  lastVerified: "2026-06-18",
  blurb:
    "Plausible competes for the crowded 'Google Analytics alternative' query alongside a dozen funded rivals. Its sharpest, least-contested audience isn't analytics-shoppers at all — it's teams trying to delete a cookie banner, and the messaging barely speaks to them.",
  score: {
    total: 52,
    breakdown: {
      content: 55,
      outreach: 48,
      seo: 53,
    },
  },
  intro:
    "Plausible has done the hard part: a genuinely differentiated product, an open-source codebase that earns developer trust, and an established domain with real category authority. The discoverability problem is one of crowding, not credibility. Plausible's primary positioning — the lightweight, privacy-first Google Analytics alternative — is also the positioning of Fathom, Simple Analytics, Umami, and a long tail of others. They are all crowding the same door. Plausible's most ownable audience is narrower and more urgent: the team that needs to remove a cookie-consent banner, satisfy a compliance review, or pass a GDPR audit. That audience converts faster and is barely addressed above the fold.",
  sections: [
    {
      heading: "What does Plausible do differently from every other analytics tool?",
      body: [
        "Plausible is a lightweight, cookieless, open-source web analytics tool that collects no personal data and requires no consent banner. The script is a fraction of the size of Google Analytics, the dashboard is a single legible page rather than a labyrinth of reports, and the whole thing is auditable open source. The core promise is simple: useful numbers without surveillance, and without the legal and performance baggage that comes with it.",
        "The differentiation that actually matters commercially is the compliance angle. Because Plausible stores no cookies and no personal data, sites running it can — in most EU interpretations — drop the cookie-consent banner entirely. That is not a nice-to-have. For a marketing team, a consent banner is a measurable conversion tax and a recurring legal-review headache. Plausible turns 'we need analytics' into 'we can delete the banner' — a far more concrete and fundable outcome.",
        "Competitors split the field. Google Analytics owns free-and-default. Fathom and Simple Analytics share the privacy-first lane almost identically. Umami and PostHog pull the self-hosted and product-analytics crowds. What none of them lead with as forcefully as they could is the banner-removal outcome — which is precisely the thing a non-technical buyer can approve a purchase for.",
      ],
    },
    {
      heading: "Who is Plausible's highest-intent audience?",
      body: [
        "It is tempting to say Plausible's ICP is 'developers who dislike Google Analytics'. That audience is real, vocal, and already largely aware of Plausible — but it is also the least monetisable, because developers self-host the open-source version and churn on price. The highest-intent buyer is the EU-facing marketing or compliance lead whose lawyer or DPO has flagged the cookie banner, the GA4 data transfer, or a pending audit.",
        "The specific profile: a SaaS or e-commerce team with meaningful EU traffic, a GDPR or Schrems-II exposure they have been told to fix, and a deadline. This buyer is not comparing dashboards. They are trying to make a compliance problem go away with the least engineering effort. For them, Plausible is not 'an analytics tool' — it is the cheapest path to a clean compliance review and a faster page without the banner.",
        "This audience converts at a different velocity than the developer crowd. A developer evaluates Plausible over weeks of side-by-side testing. A compliance-pressured marketer who lands on a page that says 'remove your cookie banner, keep your analytics' converts in a single session, because the page has named their exact open ticket.",
      ],
    },
    {
      heading: "Where is Plausible's audience searching?",
      body: [
        "The headline query 'google analytics alternative' (roughly 18,000/mo) is high-volume but brutally contested — every privacy-analytics competitor is bidding content and links at it, and ranking gains there are slow and expensive. Plausible already competes here; the marginal return on more effort is low. The more interesting clusters are downstream of intent.",
        "The compliance cluster is the undervalued one: 'cookieless analytics' (2,900/mo), 'GDPR compliant analytics' (3,600/mo), 'remove cookie banner' (1,900/mo), and 'analytics without cookie consent' (1,100/mo). These are lower-volume but dramatically higher-intent and far less defended, because most competitors frame themselves as analytics-first rather than compliance-first. A buyer typing 'remove cookie banner' has a budget and a deadline, not just curiosity.",
        "For outreach, the highest-affinity channels are not the analytics-tooling threads where Plausible is already well known. They are the privacy, compliance, and EU-startup communities: GDPR and data-protection subreddits, privacy-engineering newsletters, and the indie-web and IndieHackers crowd that already valorises the open-source, anti-surveillance ethos. These communities reward Plausible's values story in a way that the generic 'best analytics tool' roundups never will.",
      ],
    },
    {
      heading: "What should Plausible prioritise to improve its discoverability score?",
      body: [
        "The cheapest, highest-leverage move is a dedicated, well-optimised compliance landing page built around banner removal — 'Analytics without the cookie banner' — rather than relying on the general homepage to carry the GDPR story. This page should target 'GDPR compliant analytics' (3,600/mo) and 'remove cookie banner' (1,900/mo) directly in the title, H1, and FAQ schema. It speaks to a buyer with a budget, not a developer with a side project.",
        "For content, a definitive explainer on 'is Google Analytics GDPR compliant?' would capture an enormous, anxious, pre-qualified audience at the exact moment they are looking for an exit. This is a question Plausible can answer more credibly than almost anyone, and it routes naturally to the product as the resolution rather than feeling like a sales page.",
        "On outreach, Plausible should lean into the channels where its values are the differentiator rather than the table stakes: privacy and data-protection communities, EU-startup Slacks and newsletters, and the open-source directories. A guest piece or sponsored explainer in a compliance-focused newsletter reaches more ready-to-buy demand than another appearance in a 'top 10 analytics tools' listicle where it is one logo among ten.",
        "Finally, the homepage hero should make room for the compliance outcome alongside the privacy ethos. 'Privacy-friendly analytics' tells visitors what Plausible believes. 'Drop the cookie banner, keep your numbers' tells the compliance-pressured buyer that Plausible solves the specific ticket on their desk — and that is the line that closes them.",
      ],
    },
  ],
  takeaways: [
    "Stop spending the marginal effort on 'google analytics alternative' (18,000/mo, brutally contested) and redirect it to the high-intent compliance cluster competitors under-defend.",
    "Build a dedicated banner-removal landing page targeting 'GDPR compliant analytics' (3,600/mo) and 'remove cookie banner' (1,900/mo) — these searchers have a budget and a deadline.",
    "Write the definitive 'is Google Analytics GDPR compliant?' explainer — it captures an anxious, pre-qualified audience at the moment they need an exit.",
    "Shift outreach toward privacy and EU-compliance communities where Plausible's open-source, anti-surveillance values are the differentiator, not table stakes.",
    "Add a compliance-outcome line to the homepage hero ('Drop the cookie banner, keep your numbers') so the non-technical buyer sees their exact ticket solved above the fold.",
  ],
};

export default plausible;
