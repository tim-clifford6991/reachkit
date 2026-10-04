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
// **It carries the customer's identity** (SPEC §7, 2026-09-29, issue 1140;
// the *Hosted index* board in `docs/DESIGN.md`): their header, the
// business's name and one line, the newest page as a featured card, the
// rest as a grid of cards, and pages of them. Paging is `?page=` on the
// address, a link like the search is a form — no script. No ReachKit name,
// link or colour.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import type { HostedPage } from "@/lib/publish/destinations/hosted";
import { Surface } from "@/ui/layout";
import { HostedFooter, HostedHeader, type HostedBusiness } from "./chrome";
import { writeDate } from "./present";

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

/** How many cards one page of the index holds: four rows of three. */
export const INDEX_PAGE_SIZE = 12;

/** The page number as the address carries it: the first `page`, a whole
 *  number from 1. Anything else is the first page. */
export function pageOf(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value !== undefined && /^[1-9]\d{0,5}$/.test(value) ? Number(value) : 1;
}

/** The index's own address for one page of one search. The first page of
 *  no search is the bare root. */
function indexHref(query: string, page: number): string {
  const params = new URLSearchParams();
  if (query !== "") params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search === "" ? "/" : `/?${search}`;
}

/** The date a card states: the day the page was last published. */
function CardDate({ page }: { page: HostedPage }): React.JSX.Element {
  return (
    <p className="text-base-content/70 grow-0 text-sm">
      <time dateTime={page.publishedAt.toISOString().slice(0, 10)}>
        {writeDate(page.publishedAt, page.publisher.timeZone)}
      </time>
    </p>
  );
}

export function HostedIndex({
  business,
  pages,
  query,
  page,
}: {
  business: HostedBusiness;
  /** The index's own address on the customer's host. */
  canonical: string;
  /** Every live page, newest first. */
  pages: readonly HostedPage[];
  query: string;
  /** The page of the list asked for, from 1. */
  page: number;
}): React.JSX.Element {
  const matched = matchPages(pages, query);
  // The newest page leads the first page of the whole list. A search is a
  // list of matches, and a later page is more of the list: neither has one.
  const lead = query === "" ? (matched[0] ?? null) : null;
  const rest = lead === null ? matched : matched.slice(1);
  const pageCount = Math.max(1, Math.ceil(rest.length / INDEX_PAGE_SIZE));
  // A page past the end is the last page, never an empty one.
  const current = Math.min(page, pageCount);
  const featured = current === 1 ? lead : null;
  const shown = rest.slice((current - 1) * INDEX_PAGE_SIZE, current * INDEX_PAGE_SIZE);

  return (
    <Surface
      arms={{
        compact: { kind: "declared", note: "their header, the cards one a line, their footer" },
        medium: { kind: "declared", note: "the cards two a line" },
        wide: { kind: "declared", note: "the cards three a line" },
      }}
    >
      <HostedHeader business={business} />

      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 className="text-base-content text-4xl font-extrabold tracking-tight text-balance">
          {business.name}
        </h1>
        {business.line === null ? null : (
          <p className="text-base-content/70 mt-3 max-w-2xl text-lg">{business.line}</p>
        )}

        <form method="get" action="/" role="search" className="join my-8 w-full max-w-2xl">
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
        ) : matched.length === 0 ? (
          <p className="text-base-content/70">{copy("hosted.index.noMatch", { query })}</p>
        ) : (
          <>
            {featured === null ? null : (
              <section className="card card-border bg-base-100 mb-10" aria-labelledby="featured">
                <div className="card-body gap-2 sm:p-8">
                  <p className="eyebrow">{copy("hosted.index.latest")}</p>
                  <h2 id="featured" className="text-2xl font-extrabold tracking-tight text-balance">
                    <a href={`/${featured.slug}`} className="link link-hover text-base-content">
                      {featured.title}
                    </a>
                  </h2>
                  <CardDate page={featured} />
                  {featured.description === null ? null : (
                    <p className="text-base-content/80 max-w-2xl">{featured.description}</p>
                  )}
                </div>
              </section>
            )}

            {shown.length === 0 ? null : (
              <section aria-labelledby="articles">
                <h2 id="articles" className="mb-4 text-xl font-bold tracking-tight">
                  {copy("hosted.index.heading")}
                </h2>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {shown.map((entry) => (
                    <li key={entry.publicationId} className="card card-border bg-base-100">
                      <div className="card-body gap-2 p-5">
                        <h3 className="text-base font-bold tracking-tight">
                          <a href={`/${entry.slug}`} className="link link-hover text-base-content">
                            {entry.title}
                          </a>
                        </h3>
                        <CardDate page={entry} />
                        {entry.description === null ? null : (
                          <p className="text-base-content/80 line-clamp-3 text-sm">{entry.description}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {pageCount === 1 ? null : (
              <nav className="join mt-10" aria-label={copy("hosted.index.pages")}>
                {current === 1 ? null : (
                  <a href={indexHref(query, current - 1)} rel="prev" className="btn join-item">
                    {copy("hosted.index.newer")}
                  </a>
                )}
                <span aria-current="page" className="btn btn-disabled join-item text-base-content/70">
                  {copy("hosted.index.pageOf", { page: String(current), pages: String(pageCount) })}
                </span>
                {current === pageCount ? null : (
                  <a href={indexHref(query, current + 1)} rel="next" className="btn join-item">
                    {copy("hosted.index.older")}
                  </a>
                )}
              </nav>
            )}
          </>
        )}
      </main>

      <HostedFooter business={business} />
    </Surface>
  );
}
