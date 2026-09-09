// tests/presentation/sweeps/hosted-fixture.ts — BUILD §9, issue #49
//
// The hosted edge's row in the two conformance sweeps.
//
// **Why it is mocked at all.** Every route the App Router tree holds is in
// these sweeps' scope by construction (ADR-010), and the hosted page is a
// route. It is also the one route whose *whole* input is a Host header and
// a `publications` row — a request context these in-process sweeps do not
// have and a database they must never reach (`tests/setup.ts` refuses real
// network). So the Host and the row are supplied here, and the page's own
// render is what the sweeps then measure.
//
// **What it deliberately does not mock: the render.** The template, the
// Markdown renderer, the canonical composition and the `FAQPage` block are
// the real ones — the sweeps read a real hosted page, on a real fixture
// Host, exactly as a visitor would.
//
// The page speaks no sentence of ReachKit's (it reads no copy key at all),
// so it has nothing to say under a stop and nothing to leave blank at cold
// start. That is the answer the sweeps should get from it, and it is worth
// getting from the real file rather than from an exemption list.
import type { HostedPage } from "@/lib/publish/destinations/hosted";

export const HOSTED_SWEEP_HOST = "content.example.com";
export const HOSTED_SWEEP_DOMAIN = "example.com";
export const HOSTED_SWEEP_SITE_ID = "site-sweep-fixture";
export const HOSTED_SWEEP_SLUG = "best-onboarding-tools";

/** One live page, with a question-and-answer section — the arm that emits
 *  every part of the template, which is the one worth sweeping. */
export const HOSTED_SWEEP_PAGE: HostedPage = Object.freeze({
  publicationId: "pub-sweep-fixture",
  siteId: HOSTED_SWEEP_SITE_ID,
  slug: HOSTED_SWEEP_SLUG,
  title: "The best onboarding tools for small product teams",
  bodyMd:
    "Teams of under ten people pick an onboarding tool on two questions: how long " +
    "it takes to publish the first flow, and whether it needs an engineer.\n\n" +
    "## What to look for\n\n- Time to the first published flow\n- Whether a " +
    "non-engineer can ship a change\n",
  faq: Object.freeze([
    {
      question: "How long does the first flow take?",
      answer: "Under an hour on every tool measured here.",
    },
  ]),
  // §8's recorded passage, and it occurs in the body above verbatim: the
  // sweeps then read the arm that draws the mark **and** the source line
  // under it, which is the arm with every string on it.
  grounded: Object.freeze({
    passage: "how long it takes to publish the first flow",
    url: "https://example.org/onboarding-tools-compared",
    readAt: new Date("2026-08-28T00:00:00.000Z"),
  }),
  // The publisher S19 draws: a name, a category eyebrow and the zone the
  // byline's date is written in. A stated zone rather than `null`, because
  // that is the arm the customer's own page is served in.
  publisher: Object.freeze({
    name: HOSTED_SWEEP_DOMAIN,
    category: "user onboarding software",
    timeZone: "America/New_York",
  }),
  publishedAt: new Date("2026-09-01T09:00:00.000Z"),
  liveUrl: `https://${HOSTED_SWEEP_HOST}/${HOSTED_SWEEP_SLUG}`,
  record: Object.freeze({
    opportunityId: "opp-sweep-fixture",
    targetQuery: "best onboarding tools",
    measuredOn: new Date("2026-08-28T00:00:00.000Z"),
    mode: "autopilot" as const,
    liveUrl: `https://${HOSTED_SWEEP_HOST}/${HOSTED_SWEEP_SLUG}`,
  }),
});

/** What `@/lib/publish/destinations/hosted` answers inside a sweep.
 *
 *  **A partial mock, over the real module.** Only the four reads that
 *  would reach a database are replaced; everything else — the address
 *  composer, the cache tags, `HOSTED_ADAPTER` — stays the real export, so
 *  the canonical the sweep reads is composed the way a visitor's is, and a
 *  module that merely resolves this one (the destination registry, through
 *  `health/check.ts`) still finds every name it imports. Returning only the
 *  overrides would make that registry's import fail at module load, in a
 *  suite that has nothing to do with publishing. */
export async function hostedModuleMock(
  actual: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return {
    ...actual,
    hostedSiteForDomain: async (domain: string) =>
      domain === HOSTED_SWEEP_DOMAIN
        ? { siteId: HOSTED_SWEEP_SITE_ID, domain: HOSTED_SWEEP_DOMAIN }
        : null,
    livePageBySlug: async (_siteId: string, slug: string) =>
      slug === HOSTED_SWEEP_SLUG ? HOSTED_SWEEP_PAGE : null,
    livePagesForSite: async () => [HOSTED_SWEEP_PAGE],
    wasEverLive: async () => false,
  };
}
