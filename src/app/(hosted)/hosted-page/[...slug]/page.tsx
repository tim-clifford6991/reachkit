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
// **It speaks no sentence of ReachKit's.** The title and the body are the
// customer's page — the one place in the product generated prose is
// rendered (REQ-093 c2, `GeneratedText`) — and there is no other string on
// this surface: no heading of ours, no footer, no link, no name. That is
// why this file reads no copy key and why doing so is not a gap in the
// registry: a page on a stranger's domain has no voice of ours to speak in.
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
import { parseMarkdown, toHtml } from "@/app/(account)/app/draft/[draftId]/markdown";
import { liveUrlFor, livePageBySlug, type HostedPage } from "@/lib/publish/destinations/hosted";
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
    // (`liveUrlFor`). There is no argument to it that yields a ReachKit
    // address, and no branch here that could introduce one.
    canonical: liveUrlFor({ domain: disposition.domain, slug: page.slug }),
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
  const body = toHtml(parseMarkdown(page.bodyMd), BODY_CLASSES);

  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      {schema === null ? null : (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
      )}
      <main className="mx-auto max-w-2xl px-5 py-14">
        <article>
          <h1 className="text-3xl font-extrabold tracking-tight text-balance">{page.title}</h1>
          {/* §2.3: every date is JetBrains Mono with tabular-nums, which
              `.num` is the one mechanism for. A date is a numeral, not a
              sentence — there is no line of ours around it. */}
          <p className="text-base-content/60 mt-2 text-sm">
            <time className="num" dateTime={page.publishedAt.toISOString().slice(0, 10)}>
              {page.publishedAt.toISOString().slice(0, 10)}
            </time>
          </p>
          <div className="mt-8" dangerouslySetInnerHTML={{ __html: body }} />
        </article>
      </main>
    </Surface>
  );
}
