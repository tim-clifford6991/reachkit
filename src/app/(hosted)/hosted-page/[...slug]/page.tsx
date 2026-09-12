// BUILD §9 — the hosted page: one typographic render, canonical on the
// customer's own domain, `FAQPage` from data, zero client JavaScript.
//
// §9: published pages "render through **one** clean typographic template
// (the §2 design system, light-only is acceptable), customisable later —
// never per-customer templates in MVP", and a published page "is listed in
// a sitemap, declares its canonical address on the customer's own domain,
// and — where the page has a question-and-answer section — is marked up as
// such."
//
// **Why the address is `/hosted-page/{…slug}` and the customer's is not.**
// `src/middleware.ts` rewrites every request on a `content.` Host — except
// `/robots.txt` and `/sitemap.xml`, which resolve the Host themselves — to
// this catch-all. A rewrite, never a redirect: the visitor stays at
// `content.{their domain}/{slug}`, which is the address the canonical link,
// the sitemap entry and `publications.live_url` all name. The rewrite is
// also the authorisation boundary: with it, *no* path on a customer's
// domain can reach a ReachKit screen, because every one of them lands here.
//
// **The whole page is in the HTML at first byte.** No `"use client"` in
// this module graph, no client component, no script but the JSON-LD block —
// which is data, not behaviour. REQ-062 c1 verifies exactly this property
// in the world, against "a crawler that runs no scripts"; this file is
// where it is true at the source.
//
// **`FAQPage` is emitted from `drafts.meta.faq` and never from parsing the
// body** (the archived BP-047 decision 2). A heading heuristic that is
// wrong emits schema claiming a question-and-answer section that is not
// there — a structured false statement on the customer's own domain. An
// absent or empty section emits no markup at all, never an empty
// `FAQPage`.
//
// **The page is the customer's, and the set draws whose** (UI-SPEC S19,
// issue #375). Their mark and their name at the top, the category they
// chose as the eyebrow, their own byline under the title, and their footer
// line at the bottom — §14.6's "customer is publisher of record: their
// domain, their identity", rendered. The title and the body are their page
// — the one place in the product generated prose is rendered (REQ-093 c2,
// `GeneratedText`) — and every other value on the surface is theirs too.
//
// **Three sentences, and they are structure rather than voice.** The
// byline, the source line and the canonical note are the only strings of
// ours, all three written unbracketed in the approved set and therefore
// approved copy under ruling 11a. They read as keys like every other
// sentence in the product (`publish.ts`'s `hosted.*`), and none of them
// names ReachKit except the one the set itself writes: the canonical note,
// which states the guardrail §9 and §14 fix — customer content never ranks
// on our domain — where a reader of the page can check it. There is no
// heading of ours, no navigation, no link to us and no wordmark.
//
// **Nothing on this surface is `--accent`.** The product's colour would be
// our branding on a stranger's domain; the customer's mark is `--ink`, as
// the set draws it, and the stylesheet section this page uses names the
// accent nowhere.
//
// **Nothing here writes.** No form, no server action, no mutation: a
// crawler cannot advance §9's state machine by fetching a page.
//
// The archived plan is WO-230.
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type React from "react";
import { BODY_CLASSES } from "@/app/(account)/app/draft/[draftId]/present";
import { copy } from "@/lib/presentation/copy";
import { markPassage, parseMarkdown, toHtml } from "@/lib/publish/render/markdown";
import { liveUrlOnHost, livePageBySlug, type HostedPage } from "@/lib/publish/destinations/hosted";
import { Surface } from "@/ui/layout";
import { resolveHost } from "../../resolve-host";

/** Nothing on this surface is cached (WO-028's NFR): a publication row that
 *  changes is read again on the very next request, so a takedown never
 *  waits on a TTL and a 410 is never served from a stale cache. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Resolved {
  page: HostedPage;
  canonical: string;
}

/** One resolution per request, shared by `generateMetadata` and the render.
 *  `cache` is React's own request-scoped memo — not a data cache, and not
 *  a TTL — so the two entry points below cannot disagree about which page
 *  they are describing, and the row is read once. */
const load = cache(async (slug: string): Promise<Resolved | null> => {
  const host = (await headers()).get("host") ?? "";
  const disposition = await resolveHost(host);
  // Every other disposition is somebody else's answer: `unknown` is the
  // 404 this file falls through to, and `gone` is answered 410 by
  // `../../gone/route.ts`, which the middleware rewrites to before this
  // route is reached. A page never renders for either.
  if (disposition.kind !== "site") return null;

  const page = await livePageBySlug(disposition.siteId, slug);
  if (page === null) return null;
  return {
    page,
    // Always the customer's own domain, composed from the one composer
    // (`liveUrlOnHost`, which `liveUrlFor` is itself written in terms of).
    // The host is the one that resolved — the label is the customer's
    // since SPEC §5's ruling of 2026-09-12 — so the canonical names the
    // address the visitor actually typed and never a recomposed guess at
    // it. There is no argument to it that yields a ReachKit address.
    canonical: liveUrlOnHost({ host: disposition.host, slug: page.slug }),
  };
});

/** The catch-all takes an array; only a single-segment address is a page.
 *  `content.{domain}/a/b` is not a deeper page, it is not a page at all. */
function oneSegment(slug: readonly string[]): string | null {
  return slug.length === 1 ? (slug[0] ?? null) : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const segment = oneSegment(slug);
  const resolved = segment === null ? null : await load(segment);
  if (resolved === null) return {};
  return {
    title: resolved.page.title,
    alternates: { canonical: resolved.canonical },
  };
}

/** `FAQPage` from the stored section, or nothing at all. */
function faqSchema(page: HostedPage, canonical: string): string | null {
  if (page.faq.length === 0) return null;
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${canonical}#faq`,
    mainEntity: page.faq.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
  // Next's own JSON-LD guidance: `JSON.stringify` does not escape a `<`,
  // and a body is customer- or model-written text.
  return JSON.stringify(schema).replace(/</g, "\\u003c");
}

/**
 * The locale this page's one date is written in.
 *
 * DECISIONS 2026-08-28 — "MVP is US-English only: one `SERP_LOCATION`
 * constant" — spelled the way `Intl` spells it, the same derivation
 * `src/lib/mail/blocks/format.ts` and `_shell/format.ts` each make at their
 * own boundary. `src/lib` never imports `src/app` and neither of those is
 * this surface's, so the pin is named once more here rather than reached
 * for across a seam it may not cross.
 */
const PAGE_LOCALE = "en-US";

/**
 * A date this page states, in the zone the customer publishes in.
 *
 * `formatMailDate`'s own reasoning, on the surface rather than in the
 * mail: a site that has stated no zone (REQ-073 c1 forbids inventing one)
 * has its date written in UTC rather than in a zone this product picked
 * for it. A published page's date is a calendar day, so at worst it is the
 * day either side — and a page that withheld its own publication date
 * because a setting was blank would be worse.
 *
 * **One date format on the page**, for the byline and for the source line
 * alike. The set's specimen writes the source's date without a year
 * ("retrieved 14 Sep"); a hosted page stays live for years and a bare day
 * and month on it is ambiguous, so both dates are written the one way.
 */
function writeDate(at: Date, timeZone: string | null): string {
  const parts = new Intl.DateTimeFormat(PAGE_LOCALE, {
    timeZone: timeZone ?? "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  // Composed from parts, not from the locale's own pattern: `en-US` orders
  // a short date month-first and punctuates it with a comma, and the set
  // draws "4 Sep 2026". The order the set draws is fixed, not the locale's
  // to choose; the month's own spelling still comes from `Intl`.
  return `${part("day")} ${part("month")} ${part("year")}`;
}

/** The address in the bar: the host the page answers at, taken off the
 *  canonical rather than composed a second time, so the two cannot
 *  disagree. A canonical that will not parse yields the whole string,
 *  which is still the customer's own address and never ours. */
function hostOf(canonical: string): string {
  try {
    return new URL(canonical).host;
  } catch {
    return canonical;
  }
}

/** The set's source line, or `null` for a page generation recorded no
 *  grounding for. The address stands in for the set's `[source title]`:
 *  what §8 records is where the fact was read, and a title we do not hold
 *  would have to be invented. */
function sourceLineFor(page: HostedPage): string | null {
  const grounded = page.grounded;
  if (grounded === null || grounded.url === "") return null;
  if (grounded.readAt === null) return null;
  return copy("hosted.source", {
    source: grounded.url,
    date: writeDate(grounded.readAt, page.publisher.timeZone),
  });
}

export default async function HostedPageRoute({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<React.JSX.Element> {
  const { slug } = await params;
  const segment = oneSegment(slug);
  const resolved = segment === null ? null : await load(segment);
  // An unknown Host, an address this site never published at, and a page in
  // any state but live all end here: 404, and never another customer's
  // page, never a ReachKit page, never a fallback.
  if (resolved === null) notFound();

  const { page, canonical } = resolved;
  const schema = faqSchema(page, canonical);
  // The one Markdown renderer (`markdown.ts`), which escapes every text
  // node on the way out — so a body cannot introduce markup and this
  // string is safe to set as HTML by construction rather than by a
  // sanitiser someone has to remember to call. A second renderer here is
  // exactly what that module's header forbids.
  const blocks = parseMarkdown(page.bodyMd);
  const grounded = page.grounded;
  const body = toHtml(
    grounded === null ? blocks : markPassage(blocks, grounded.passage).blocks,
    BODY_CLASSES
  );
  const sourceLine = sourceLineFor(page);

  return (
    <Surface
      arms={{
        // **Declared, not one column** (issue #375). A single-column arm
        // caps the whole surface at `--w-read`, which is right for the
        // article and wrong for everything around it: the customer's bar
        // and their footer line are the width of their page, and the set
        // draws both as rules across the top and the bottom. `declared`
        // takes no measure and no gutter, so the three widths on this
        // screen are the screen's own — the bar and the footer at
        // `--w-wide`, the article at `--w-read` — exactly as its stylesheet
        // states them.
        compact: { kind: "declared", note: "their bar, the article at --w-read, their footer" },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      {schema === null ? null : (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
      )}

      {/* The customer's own bar: their mark, their name, and the address
          this page answers at. Not a `<nav>` and not a link — there is
          nowhere on their site for us to send a reader. */}
      <header className="rk-hosted-bar">
        <span className="rk-hosted-brand">
          <span className="rk-hosted-mark" aria-hidden />
          <span>{page.publisher.name}</span>
        </span>
        <span className="rk-hosted-line">{hostOf(canonical)}</span>
      </header>

      <main>
        <article className="rk-hosted">
          {page.publisher.category === null ? null : (
            <span className="eyebrow">{page.publisher.category}</span>
          )}
          <h1 className="rk-hosted-h">{page.title}</h1>
          <p className="rk-hosted-line">
            <time dateTime={page.publishedAt.toISOString().slice(0, 10)}>
              {copy("hosted.published", {
                date: writeDate(page.publishedAt, page.publisher.timeZone),
                publisher: page.publisher.name,
              })}
            </time>
          </p>

          <hr className="rk-hosted-rule" />

          {/* The body, with §8's recorded passage marked where it is still
              in the text. `markPassage` is the same call the draft screen
              makes, so what the customer approved and what a visitor reads
              are marked alike; a passage that no longer occurs marks
              nothing rather than marking the nearest thing to it. */}
          <div className="rk-hosted-doc" dangerouslySetInnerHTML={{ __html: body }} />
          {sourceLine === null ? null : <p className="rk-hosted-line">{sourceLine}</p>}

          <hr className="rk-hosted-rule" />

          <p className="rk-hosted-line">
            {copy("hosted.canonical", {
              domain: page.publisher.name,
              canonical,
            })}
          </p>
        </article>
      </main>

      {/* Their line, and nothing of ours beside it. The imprint half of
          what the set draws here is the customer's to state and no column
          carries one yet, so the footer states what it has. */}
      <footer className="rk-hosted-foot">
        <span className="rk-hosted-line">
          {copy("hosted.footer", { publisher: page.publisher.name })}
        </span>
      </footer>
    </Surface>
  );
}
