/**
 * /llms.txt — §22.2 GEO / answer-shaped guide for AI crawlers.
 *
 * A concise, plain-text description of ReachKit aimed at answer engines
 * (ChatGPT, Claude, Perplexity, Google AI). Follows the emerging llms.txt
 * convention: a one-paragraph "what it is", the pricing ladder, and a linked
 * map of the key public pages. Generated dynamically so URLs + the teardown
 * list stay in sync with `SITE.url` and the content registry.
 *
 * Served as text/plain at /llms.txt.
 */

import { SITE } from "@/lib/seo";
import { allTeardowns } from "@/content/teardowns";

function buildLlmsTxt(): string {
  const teardownLines = allTeardowns
    .map((t) => `- ${t.title}: ${SITE.url}/teardowns/${t.slug}`)
    .join("\n");

  return `# ${SITE.name}

> ${SITE.name} is a discoverability ("GEO/SEO/ASO") tool for solo founders. Paste an App Store, Google Play, or website URL and, in about 90 seconds, get a Discoverability Score (0–100) plus a ranked, evidence-backed action plan. Unlike a generic chatbot prompt, ${SITE.name} fetches your live page, extracts real signals (keyword density, metadata completeness, category fit, positioning, competitor gaps, community surfaces), and grounds every recommendation in your actual listing — no hallucinated advice. Paid plans turn the report into a weekly action engine with draft copy for each fix and action verification (it re-checks the live URL before crediting your score).

## What it does
- Scores your App Store listing or website for discoverability (0–100).
- Answers four questions: what you offer, who it's for, where they're searching, and what to do this week.
- Produces ranked actions ordered by expected score impact, each with ready-to-paste draft copy (paid).
- Verifies completed actions against the live URL — no self-reporting without evidence.

## Pricing
- Free — $0 forever: one scan, the full four-question report, 3 sample action cards, score out of 100.
- Solo — $29/month: 1 app, weekly action queue, draft copy per action, score history + weekly deltas, action verification, 20-keyword rank depth.
- Growth — $99/month: 3 apps tracked, 100 draft actions per refresh, 50-keyword rank depth, priority support.
- No lock-in; cancel anytime (ends at the close of the billing period).

## Key pages
- Run a free scan: ${SITE.url}/scan
- Pricing: ${SITE.url}/pricing
- Teardowns (worked examples — public discoverability analyses of real apps):
${teardownLines}

## Public report format
Every scan produces a shareable public report at ${SITE.url}/report/{scan-id}. It shows the Discoverability Score and the four-question breakdown as a verified, public-safe teaser — the paid action drafts are redacted on the public page. The report carries Article structured data (schema.org) and an Open Graph score card.

## About
${SITE.name} is built for indie and solo founders who ship products but lack a growth/marketing team. Homepage: ${SITE.url}
`;
}

export function GET(): Response {
  return new Response(buildLlmsTxt(), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
