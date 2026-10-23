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
import { copy } from "@/lib/presentation/copy/reader";
import type { HostedPage } from "@/lib/publish/destinations/hosted";
import { Surface } from "@/ui/layout";
import { actionsOf, CompactAction, HostedFooter, HostedHeader, type HostedBusiness } from "./chrome";
import { indexHref, writeDate } from "./present";
import { blogSchema } from "./seo";

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
 *  number from 1. Anything else is the first page. A number past the last
 *  page is kept, so the route can answer it 404 (issue 1514). */
export function pageOf(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value !== undefined && /^[1-9]\d*$/.test(value) ? Number(value) : 1;
}

/** How many pages one search of the index runs to: the newest page leads
 *  the first page of the whole list, and the rest are twelve a page. */
export function indexPageCount(pages: readonly HostedPage[], query: string): number {
  const matched = matchPages(pages, query);
  const rest = query === "" ? matched.slice(1) : matched;
  return Math.max(1, Math.ceil(rest.length / INDEX_PAGE_SIZE));
}

/** A topic two or more live pages share: the page that leads it, and the rest. */
interface Topic {
  lead: HostedPage;
  rest: HostedPage[];
}

function byTitle(a: HostedPage, b: HostedPage): number {
  return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
}

/** Every live page once, for "All guides" (owner R1, 2026-10-22): the topics
 *  (SPEC §6 clusters) two or more pages share, largest first, and every other
 *  page in one A–Z list. A topic is led by its offering page, else its oldest. */
export function guidesByTopic(pages: readonly HostedPage[]): { topics: Topic[]; loose: HostedPage[] } {
  const byCluster = new Map<string, HostedPage[]>();
  const loose: HostedPage[] = [];
  for (const page of pages) {
    const cluster = page.cluster ?? null;
    if (cluster === null) loose.push(page);
    else byCluster.set(cluster, [...(byCluster.get(cluster) ?? []), page]);
  }
  const topics: Topic[] = [];
  for (const members of byCluster.values()) {
    if (members.length < 2) {
      loose.push(...members);
      continue;
    }
    const [lead, ...rest] = [...members].sort(
      (a, b) =>
        Number(b.offering === true) - Number(a.offering === true) ||
        a.firstPublishedAt.getTime() - b.firstPublishedAt.getTime()
    );
    topics.push({ lead: lead!, rest: rest.sort(byTitle) });
  }
  topics.sort((a, b) => b.rest.length - a.rest.length || byTitle(a.lead, b.lead));
  return { topics, loose: loose.sort(byTitle) };
}

function GuideLinks({ pages }: { pages: readonly HostedPage[] }): React.JSX.Element {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {pages.map((entry) => (
        <li key={entry.publicationId}>
          <a href={`/${entry.slug}`} className="link">
            {entry.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** "All guides": every live page one click from the index, by topic. */
function AllGuides({ pages }: { pages: readonly HostedPage[] }): React.JSX.Element {
  const { topics, loose } = guidesByTopic(pages);
  return (
    <section aria-labelledby="all-guides" className="mt-12">
      <h2 id="all-guides" className="text-xl font-bold tracking-tight">
        {copy("hosted.index.all")}
      </h2>
      <p className="text-base-content/70 mt-1 mb-4">{copy("hosted.index.allLead")}</p>
      {topics.length === 0 ? null : (
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          {topics.map(({ lead, rest }) => (
            <section key={lead.publicationId} className="card card-border bg-base-100">
              <div className="card-body gap-2 p-5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <h3 className="text-base font-bold tracking-tight">
                    <a href={`/${lead.slug}`} className="link link-hover text-base-content">
                      {lead.title}
                    </a>
                  </h3>
                  <span className="text-base-content/70 text-sm">
                    {copy("hosted.index.topicCount", { count: String(rest.length + 1) })}
                  </span>
                </div>
                <GuideLinks pages={rest} />
              </div>
            </section>
          ))}
        </div>
      )}
      {loose.length === 0 ? null : <GuideLinks pages={loose} />}
    </section>
  );
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
  canonical,
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
  const pageCount = indexPageCount(pages, query);
  // The route answers a page past the end 404 before it gets here.
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
      {/* SPEC §7 (2026-09-29, issue 1141): `Blog` with its `WebSite`, naming
          the pages this page of the list shows and no others. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: blogSchema({
            business,
            canonical,
            listed: featured === null ? shown : [featured, ...shown],
          }),
        }}
      />

      <HostedHeader business={business} />

      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 className="text-base-content text-4xl font-extrabold tracking-tight text-balance">
          {copy("hosted.index.title", { publisher: business.name })}
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
                  {copy("hosted.index.recent")}
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

            {/* A search is a list of matches: the whole list is the unfiltered index's. */}
            {query === "" ? <AllGuides pages={pages} /> : null}
          </>
        )}

        {/* E8: the index asks once, under its guides, where a phone is stored. */}
        {actionsOf(business).primary?.kind === "call" ? <CompactAction business={business} /> : null}
      </main>

      <HostedFooter business={business} />
    </Surface>
  );
}
