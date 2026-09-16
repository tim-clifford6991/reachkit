// BUILD §9 — the hosted index: what a visitor sees at the root of a
// customer's hosted host (SPEC §7, owner 2026-09-16).
//
// Every live page of the site, newest first — the same list the sitemap is
// (`livePagesForSite`), so a page cannot be in one and missing from the
// other — and a search over it. A site that has published nothing says so
// rather than answering 404.
//
// **The search is a GET form and nothing else.** This surface carries no
// client JavaScript (see `page.tsx`), so the query is `?q=` on the address
// and the filter runs on the server: it works for a crawler, a reader with
// scripts off and a shared link alike, and it writes nothing.
//
// Like a page, it is the customer's: their name in the bar, their host
// beside it, their footer line, and no ReachKit name, link or colour.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import type { HostedPage } from "@/lib/publish/destinations/hosted";
import { Surface } from "@/ui/layout";
import { hostOf, QUIET_LINE, writeDate } from "./present";

/** The query as the address carries it: the first `q`, trimmed, or empty. */
export function queryOf(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").trim();
}

/** The pages a query keeps: every term, case-insensitively, somewhere in the
 *  title, the description or the body. An empty query keeps every page. */
export function matchPages(pages: readonly HostedPage[], query: string): HostedPage[] {
  const terms = query.toLowerCase().split(/\s+/).filter((term) => term !== "");
  if (terms.length === 0) return [...pages];
  return pages.filter((page) => {
    const text = `${page.title}\n${page.description ?? ""}\n${page.bodyMd}`.toLowerCase();
    return terms.every((term) => text.includes(term));
  });
}

export function HostedIndex({
  publisher,
  canonical,
  pages,
  query,
}: {
  /** The site's domain — the one identity it gave (`HostedPublisher.name`). */
  publisher: string;
  /** The index's own address on the customer's host. */
  canonical: string;
  /** Every live page, newest first. */
  pages: readonly HostedPage[];
  query: string;
}): React.JSX.Element {
  const shown = matchPages(pages, query);

  return (
    <Surface
      arms={{
        compact: { kind: "declared", note: "their bar, the list at max-w-2xl, their footer" },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <header className="border-base-300 mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 border-b px-4 py-3">
        <span className="text-base-content mr-auto flex min-w-0 items-center gap-2 font-extrabold tracking-tight">
          <span className="bg-base-content size-4 shrink-0 rounded-full" aria-hidden />
          <span>{publisher}</span>
        </span>
        <span className={QUIET_LINE}>{hostOf(canonical)}</span>
      </header>

      <main className="mx-auto w-full max-w-2xl px-5 py-12">
        <h1 className="text-base-content mb-6 text-4xl font-extrabold tracking-tight text-balance">
          {copy("hosted.index.heading")}
        </h1>

        <form method="get" action="/" role="search" className="join mb-8 w-full">
          <input
            type="search"
            name="q"
            defaultValue={query}
            aria-label={copy("hosted.index.searchLabel")}
            placeholder={copy("hosted.index.searchLabel")}
            className="input join-item w-full"
          />
          <button type="submit" className="btn join-item">
            {copy("hosted.index.searchSubmit")}
          </button>
        </form>

        {pages.length === 0 ? (
          <p className="text-base-content/70">{copy("hosted.index.empty")}</p>
        ) : shown.length === 0 ? (
          <p className="text-base-content/70">{copy("hosted.index.noMatch", { query })}</p>
        ) : (
          <ul className="flex flex-col gap-6">
            {shown.map((page) => (
              <li key={page.publicationId} className="flex flex-col gap-1">
                <a
                  href={`/${page.slug}`}
                  className="link link-hover text-base-content text-xl font-bold tracking-tight"
                >
                  {page.title}
                </a>
                <p className={QUIET_LINE}>
                  <time dateTime={page.publishedAt.toISOString().slice(0, 10)}>
                    {writeDate(page.publishedAt, page.publisher.timeZone)}
                  </time>
                </p>
                {page.description === null ? null : (
                  <p className="text-base-content/80 m-0">{page.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="border-base-300 mx-auto w-full max-w-6xl border-t px-4 py-6">
        <span className={QUIET_LINE}>{copy("hosted.footer", { publisher })}</span>
      </footer>
    </Surface>
  );
}
