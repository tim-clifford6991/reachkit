// SPEC §2 2026-09-24 (owner, #1059; listing ruled on #1058) — the free-scans
// gallery. src/app/(public)/scans/page.tsx — issue #1069
//
// Boards `R12-3-Gallery` and `R12-9-Phone-gallery`, in their order: a
// header with *Your site next?* beside it → a sticky toolbar (search by
// company or domain, the count, sort, and the category pills with their
// counts) → the cards, four across at `xl` and a list on a phone → *Show
// more reports* → the removal line.
//
// **Server-rendered and paged, with no client state.** Every control is a
// link or a GET form over this page's own address — `q`, `cat`, `sort`,
// `shown` — so the page works before and without JavaScript, a filtered
// view is a URL someone can share, and the database does the searching,
// the counting and the paging (`src/lib/scan/gallery.ts`).
//
// **What is listed is the view's, not this file's**: every finished free
// scan unless removed through the removal address, never a refused site
// (`free_scan_listing`). The page is indexed; the reports it links to are
// not (`_seo/routes.ts`).
import type React from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpDown, ChevronDown, Search } from "lucide-react";
import { Surface } from "@/ui/layout";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { SCORE_BANDS } from "@/lib/presentation/bands";
import { bandOf } from "@/lib/measure/bands";
import { BAND_TONE } from "@/ui/bands";
import { BADGE } from "@/app/(account)/app/_overview/badges";
import { GALLERY_SORTS, readGallery, searchTerm, type GalleryEntry, type GallerySort } from "@/lib/scan/gallery";
import { ScanForm } from "../_landing/ScanForm";
import { scanFormWords } from "../_landing/scan-form-words";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.scans);

// Read per request: a scan finished a minute ago, or a site removed a
// minute ago, is already right here.
export const dynamic = "force-dynamic";

/** Attribute values, never sentences — bound to names because the copy
 *  sweep reads a bare JSX attribute string as product voice. The logo is
 *  decorative: the company's name is written beside it. */
const IMG = { alt: "", loading: "lazy" } as const;
const SEARCH_AUTOCOMPLETE = "off";

/** Cards per page, and per *Show more reports*: four rows of four. */
const PAGE = 16;
/** However far *Show more* is followed, one response stays bounded. */
const MOST = PAGE * 20;

const SORT_WORD: Readonly<Record<GallerySort, CopyKey>> = {
  newest: "gallery.sort.newest",
  highest: "gallery.sort.highest",
  lowest: "gallery.sort.lowest",
  az: "gallery.sort.az",
};

type Params = { q?: string | string[]; cat?: string | string[]; sort?: string | string[]; shown?: string | string[] };

interface View {
  q: string;
  cat: string | null;
  sort: GallerySort;
  shown: number;
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function viewOf(p: Params): View {
  const sort = GALLERY_SORTS.find((s) => s === one(p.sort)) ?? "newest";
  const cat = one(p.cat)?.trim().slice(0, 120);
  const shown = Number.parseInt(one(p.shown) ?? "", 10);
  return {
    q: searchTerm(one(p.q)),
    cat: cat === undefined || cat === "" ? null : cat,
    sort,
    shown: Number.isFinite(shown) ? Math.min(Math.max(shown, PAGE), MOST) : PAGE,
  };
}

/** This page's own address with one part of the view changed. Defaults are
 *  left out, so the plain gallery is plain `/scans`. */
function href(v: View, change: Partial<View>): string {
  const next = { ...v, ...change };
  const params = new URLSearchParams();
  if (next.q !== "") params.set("q", next.q);
  if (next.cat !== null) params.set("cat", next.cat);
  if (next.sort !== "newest") params.set("sort", next.sort);
  if (next.shown !== PAGE) params.set("shown", String(next.shown));
  const query = params.toString();
  return query === "" ? "/scans" : `/scans?${query}`;
}

function formatDay(at: Date): string {
  return at.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** The site's own logo, served from our origin, or its first letter. */
function LogoTile(p: { entry: GalleryEntry }): React.JSX.Element {
  if (p.entry.hasLogo) {
    return (
      <span className="bg-base-100 border-base-300 flex size-12 flex-none items-center justify-center rounded-box border p-1.5 sm:size-14">
        <Image
          src={`/scans/logo/${encodeURIComponent(p.entry.domain)}`}
          alt={IMG.alt}
          width={48}
          height={48}
          unoptimized
          loading={IMG.loading}
          className="size-full object-contain"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="bg-base-200 text-base-content/70 flex size-12 flex-none items-center justify-center rounded-box text-lg font-semibold sm:size-14"
    >
      {Array.from(p.entry.company.trim())[0]?.toUpperCase()}
    </span>
  );
}

function Card(p: { entry: GalleryEntry }): React.JSX.Element {
  const { entry } = p;
  const band = entry.score === null ? null : bandOf(entry.score);
  const meta = [entry.category, formatDay(entry.scannedAt)].filter((part) => part !== null).join(" · ");
  return (
    <li className="min-w-0">
      <Link
        href={`/scan/${encodeURIComponent(entry.domain)}`}
        className="card group bg-base-100 h-full shadow-(--shadow-card) transition-[translate,box-shadow] duration-200 motion-safe:hover:-translate-y-0.5"
      >
        <div className="flex h-full flex-row items-center gap-4 p-4 sm:flex-col sm:items-stretch sm:p-0">
          <div className="border-base-300 relative flex items-center gap-3 sm:h-28 sm:justify-center sm:border-b sm:px-4">
            <LogoTile entry={entry} />
            <span className="hidden min-w-0 font-semibold sm:line-clamp-2">{entry.company}</span>
            {entry.hasLogo ? null : (
              <span className="badge badge-ghost badge-xs absolute end-2 top-2 hidden sm:inline-flex">
                {copy("gallery.card.no-logo")}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:p-4">
            <span className="truncate font-semibold sm:hidden">{entry.company}</span>
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate font-mono text-sm">{entry.domain}</span>
              <span className="num flex-none text-xl font-semibold">
                {entry.score ?? copy("gallery.card.no-score")}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-base-content/70 min-w-0 truncate text-xs">{meta}</span>
              {band === null ? null : (
                <span className={`${BADGE[BAND_TONE[band]]} badge-sm flex-none`}>{copy(SCORE_BANDS[band])}</span>
              )}
            </div>
            <span className="text-base-content/70 mt-2 hidden items-center gap-1 text-sm sm:inline-flex">
              {copy("gallery.card.view")}
              <ArrowRight
                size={14}
                strokeWidth={1.75}
                aria-hidden
                className="transition-transform duration-200 motion-safe:group-hover:translate-x-[3px]"
              />
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

function SortMenu(p: { view: View }): React.JSX.Element {
  return (
    <details className="dropdown dropdown-end">
      <summary className="btn btn-ghost btn-sm gap-1 font-medium" aria-label={copy("gallery.sort.label")}>
        <ArrowUpDown size={16} strokeWidth={1.75} aria-hidden className="sm:hidden" />
        <span className="text-base-content/70 hidden sm:inline">{copy("gallery.sort.label")}</span>
        <span className="hidden sm:inline">{copy(SORT_WORD[p.view.sort])}</span>
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden className="hidden sm:inline" />
      </summary>
      <ul className="menu dropdown-content bg-base-100 rounded-box z-30 mt-1 w-48 p-2 shadow-(--shadow-card)">
        {GALLERY_SORTS.map((sort) => (
          <li key={sort}>
            <Link
              href={href(p.view, { sort, shown: PAGE })}
              aria-current={sort === p.view.sort ? "true" : undefined}
              className={sort === p.view.sort ? "bg-primary/10 text-primary" : undefined}
            >
              {copy(SORT_WORD[sort])}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default async function ScansPage(props: { searchParams: Promise<Params> }): Promise<React.JSX.Element> {
  const view = viewOf(await props.searchParams);
  const gallery = await readGallery({ search: view.q, category: view.cat, sort: view.sort, shown: view.shown });
  const shown = gallery.entries.length;
  const pills: readonly { name: string | null; label: string; count: number }[] = [
    { name: null, label: copy("gallery.filter.all"), count: gallery.all },
    ...gallery.categories.map((c) => ({ name: c.name, label: c.name, count: c.count })),
  ];

  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="flex flex-col">
        <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pt-10 pb-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="flex min-w-0 flex-col gap-3">
            <p className="flex items-center gap-2">
              <span aria-hidden className="bg-success size-1.5 rounded-full" />
              <span className="eyebrow">{copy("gallery.eyebrow")}</span>
            </p>
            <h1 className="text-4xl font-semibold">{copy("gallery.heading")}</h1>
            <p className="text-base-content/70 max-w-2xl text-lg">{copy("gallery.subline")}</p>
          </div>
          <div className="card bg-base-100 order-last shadow-(--shadow-card) lg:order-none">
            <div className="card-body gap-3 p-5">
              <h2 className="text-base font-semibold">{copy("gallery.next.heading")}</h2>
              <ScanForm words={scanFormWords()} />
              <p className="text-base-content/70 font-mono text-xs">{copy("landing.hero.assurance")}</p>
            </div>
          </div>
        </section>

        <div className="bg-base-100 border-base-300 sticky top-16 z-20 border-y backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <form action="/scans" method="get" role="search" className="min-w-0 flex-1 sm:max-w-md">
                <label className="input w-full">
                  <Search size={16} strokeWidth={1.75} aria-hidden className="text-base-content/70" />
                  <input
                    type="search"
                    name="q"
                    defaultValue={view.q}
                    placeholder={copy("gallery.search.label")}
                    aria-label={copy("gallery.search.label")}
                    autoComplete={SEARCH_AUTOCOMPLETE}
                  />
                </label>
                {view.cat === null ? null : <input type="hidden" name="cat" value={view.cat} />}
                {view.sort === "newest" ? null : <input type="hidden" name="sort" value={view.sort} />}
              </form>
              <p className="text-base-content/70 hidden flex-1 text-sm md:block" aria-live="polite">
                {copy("gallery.showing", { shown: String(shown), total: String(gallery.total) })}
              </p>
              <SortMenu view={view} />
            </div>
            <nav aria-label={copy("gallery.filter.label")}>
              <ul className="flex flex-wrap gap-1">
                {pills.map((pill) => {
                  const current = pill.name === view.cat;
                  return (
                    <li key={pill.name ?? ""}>
                      <Link
                        href={href(view, { cat: pill.name, shown: PAGE })}
                        aria-current={current ? "true" : undefined}
                        className={`btn btn-sm rounded-full font-medium ${current ? "border-base-content bg-base-content text-base-100" : "btn-ghost"}`}
                      >
                        {pill.label}
                        <span className={`num text-xs ${current ? "" : "text-base-content/70"}`}>{pill.count}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </div>

        <section className="bg-base-200 flex-1">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
            <p className="text-base-content/70 text-sm md:hidden">
              {copy("gallery.showing", { shown: String(shown), total: String(gallery.total) })}
            </p>
            {shown === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <h2 className="text-lg font-semibold">{copy("gallery.empty.heading")}</h2>
                <p className="text-base-content/70">{copy("gallery.empty.body")}</p>
                <Link href="/" className="btn btn-soft btn-primary mt-2">
                  {copy("gallery.empty.cta")}
                </Link>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                {gallery.entries.map((entry) => (
                  <Card key={entry.domain} entry={entry} />
                ))}
              </ul>
            )}
            {shown < gallery.total && view.shown < MOST ? (
              <Link href={href(view, { shown: view.shown + PAGE })} scroll={false} className="btn btn-soft self-center">
                {copy("gallery.more")}
              </Link>
            ) : null}
            <p className="text-base-content/70 text-center text-sm">
              {copy("gallery.removal", { address: copy("removal.address") })}
            </p>
          </div>
        </section>
      </main>
    </Surface>
  );
}
