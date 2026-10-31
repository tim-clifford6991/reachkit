// SPEC §2 2026-09-24 (owner, #1059; listing ruled on #1058) — the free-scans
// gallery, in board `PubScans`'s order: the heading with the count and a scan
// field → the 12 newest reports' scores → the reports, filtered by kind of
// business, searched and sorted → what every free report shows → the close.
//
// **On a phone the first card is on screen on load** (SPEC §2 2026-10-10,
// issue 1377): the sticky toolbar is two rows, the scan field waits for the
// laptop width, and the score strip is drawn after the reports.
//
// **Server-rendered and paged, with no client state.** Every control is a
// link or a GET form over this page's own address — `q`, `kind`, `sort`,
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
import {
  ArrowRight,
  ArrowUpDown,
  Briefcase,
  ChartColumn,
  ChevronDown,
  FileText,
  LayoutGrid,
  Laptop,
  Search,
  Store,
  Utensils,
  Video,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Surface } from "@/ui/layout";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { SCORE_BANDS } from "@/lib/presentation/bands";
import { bandOf, type BandHandle } from "@/lib/measure/bands";
import { BUSINESS_KIND_NAMES, isBusinessKind, type BusinessKind } from "@/lib/market/kinds";
import { BAND_TONE } from "@/ui/bands";
import { BADGE } from "@/app/(account)/app/_overview/badges";
import {
  GALLERY_MOST as MOST,
  GALLERY_PAGE as PAGE,
  GALLERY_SORTS,
  galleryShown,
  readGallery,
  searchTerm,
  type GalleryEntry,
  type GallerySort,
} from "@/lib/scan/gallery";
import { ScoreStrip } from "@/ui/charts/ScoreStrip";
import { ScanForm } from "../_landing/ScanForm";
import { scanFormWords } from "../_landing/scan-form-words";
import { EXAMPLES } from "../_how/specimen";
import { SCORE_RING } from "../_how/visuals";
import { LearnClose, ScanJump } from "../_library/parts";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";
import { SiteIcon } from "./SiteIcon";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.scans);

// Rendered per request: the listing's cache is keyed by an uncached read of
// the removals and the newest scan, so a scan finished a minute ago, or a
// site removed a minute ago, is already right here.
export const dynamic = "force-dynamic";

/** Attribute values, never sentences — bound to names because the copy
 *  sweep reads a bare JSX attribute string as product voice. The logo is
 *  decorative: the company's name is written beside it. */
const IMG = { alt: "", loading: "lazy" } as const;
const SEARCH_AUTOCOMPLETE = "off";
const LOOK = "card";
/** Where a free report lives, as the example report's address bar reads it. */
const REPORT_HOST = "reachkit.app";
/** The strip holds the newest reports, at most this many. */
const STRIP = 12;
/** The strip's axis is drawn in steps of this many points. */
const STEP = 5;
const SCORE_MAX = 100;
const BAND_ORDER: readonly BandHandle[] = ["invisible", "hard-to-find", "findable", "dominant"];
/** A band's dot in the strip's legend, drawn as the chart draws it: a
 *  findable score is filled, a lower one a ring. */
const DOT: Readonly<Record<BandHandle, string>> = {
  invisible: "border-(--chart-rival) border",
  "hard-to-find": "border-(--chart-rival) border-[3px]",
  findable: "bg-(--chart-rival)",
  dominant: "bg-(--chart-rival)",
};
const RING: Readonly<Record<BandHandle, number>> = { invisible: 1.5, "hard-to-find": 3, findable: 0, dominant: 0 };

const SORT_WORD: Readonly<Record<GallerySort, CopyKey>> = {
  newest: "gallery.sort.newest",
  highest: "gallery.sort.highest",
  lowest: "gallery.sort.lowest",
  az: "gallery.sort.az",
};

type Params = {
  q?: string | string[];
  kind?: string | string[];
  sort?: string | string[];
  shown?: string | string[];
};

interface View {
  q: string;
  kind: BusinessKind | null;
  sort: GallerySort;
  shown: number;
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function viewOf(p: Params): View {
  const sort = GALLERY_SORTS.find((s) => s === one(p.sort)) ?? "newest";
  const kind = one(p.kind);
  return {
    q: searchTerm(one(p.q)),
    kind: isBusinessKind(kind) ? kind : null,
    sort,
    shown: galleryShown(Number.parseInt(one(p.shown) ?? "", 10)),
  };
}

/** This page's own address with one part of the view changed. Defaults are
 *  left out, so the plain gallery is plain `/scans`. */
function href(v: View, change: Partial<View>): string {
  const next = { ...v, ...change };
  const params = new URLSearchParams();
  if (next.q !== "") params.set("q", next.q);
  if (next.kind !== null) params.set("kind", next.kind);
  if (next.sort !== "newest") params.set("sort", next.sort);
  if (next.shown !== PAGE) params.set("shown", String(next.shown));
  const query = params.toString();
  return query === "" ? "/scans" : `/scans?${query}`;
}

function formatDay(at: Date): string {
  return at.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** The site's own logo, served from our origin; with none stored, the
 *  site's own icon, then its first letter (`SiteIcon`, #1110 §6). */
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
    <SiteIcon
      domain={p.entry.domain}
      look={LOOK}
      letter={Array.from(p.entry.company.trim())[0]?.toUpperCase() ?? ""}
      noLogo={copy("gallery.card.no-logo")}
    />
  );
}

const KIND_WORD: Readonly<Record<BusinessKind, CopyKey>> = {
  "local-service": "gallery.kind.local-service",
  shop: "gallery.kind.shop",
  hospitality: "gallery.kind.hospitality",
  "professional-services": "gallery.kind.professional-services",
  software: "gallery.kind.software",
  creator: "gallery.kind.creator",
};

const KIND_ICON: Readonly<Record<BusinessKind, LucideIcon>> = {
  "local-service": Wrench,
  shop: Store,
  hospitality: Utensils,
  "professional-services": Briefcase,
  software: Laptop,
  creator: Video,
};

/** A score in its ring with its band, or "Not scored": a report with no score never reads 0 and draws no ring. */
function ScoreLine(p: { score: number | null }): React.JSX.Element {
  if (p.score === null) {
    return <p className="text-base-content/70 text-sm">{copy("gallery.card.no-score")}</p>;
  }
  const band = bandOf(p.score);
  const score = copy("gallery.card.score", { score: String(p.score), max: String(SCORE_MAX) });
  return (
    <div className="flex items-center gap-3">
      <div
        role="img"
        aria-label={score}
        className={`${SCORE_RING} flex-none [--size:3rem]`}
        style={{ "--value": p.score } as React.CSSProperties}
      />
      <p className="flex flex-wrap items-center gap-2">
        <span className="num text-lg font-semibold">{score}</span>
        <span className={`${BADGE[BAND_TONE[band]]} badge-sm`}>{copy(SCORE_BANDS[band])}</span>
      </p>
    </div>
  );
}

function Card(p: { entry: GalleryEntry }): React.JSX.Element {
  const { entry } = p;
  const meta = [entry.kind === null ? null : copy(KIND_WORD[entry.kind]), entry.category, formatDay(entry.scannedAt)]
    .filter((part) => part !== null)
    .join(" · ");
  const Kind = entry.kind === null ? null : KIND_ICON[entry.kind];
  return (
    <li className="min-w-0">
      <Link
        href={`/scan/${encodeURIComponent(entry.domain)}`}
        className="card group bg-base-100 h-full shadow-(--shadow-card) transition-[translate,box-shadow] duration-200 motion-safe:hover:-translate-y-0.5"
      >
        <div className="card-body gap-2 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <LogoTile entry={entry} />
            <div className="flex min-w-0 flex-col">
              {/* Names wrap rather than clamp: the gate reads a clamp as a
                  cut, and a card may grow a line. */}
              <h3 className="text-base font-semibold break-words">{entry.company}</h3>
              {/* A domain is a value: it wraps rather than being cut. */}
              <span className="text-base-content/70 min-w-0 font-mono text-sm break-all">{entry.domain}</span>
            </div>
          </div>
          <ScoreLine score={entry.score} />
          <p className="text-base-content/70 flex min-w-0 items-start gap-1.5 text-xs">
            {Kind === null ? null : <Kind size={16} strokeWidth={1.75} aria-hidden className="flex-none" />}
            <span className="min-w-0 break-words">{meta}</span>
          </p>
          <span className="text-base-content/70 mt-auto hidden items-center gap-1 text-sm sm:inline-flex">
            {copy("gallery.card.view")}
            <ArrowRight
              size={14}
              strokeWidth={1.75}
              aria-hidden
              className="transition-transform duration-200 motion-safe:group-hover:translate-x-[3px]"
            />
          </span>
        </div>
      </Link>
    </li>
  );
}

function SortMenu(p: { view: View }): React.JSX.Element {
  return (
    <details className="dropdown dropdown-end">
      <summary
        className="btn btn-ghost btn-sm gap-1 font-medium"
        aria-label={copy("gallery.sort.label")}
      >
        <ArrowUpDown
          size={16}
          strokeWidth={1.75}
          aria-hidden
          className="sm:hidden"
        />
        <span className="text-base-content/70 hidden sm:inline">
          {copy("gallery.sort.label")}
        </span>
        <span className="hidden sm:inline">{copy(SORT_WORD[p.view.sort])}</span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          aria-hidden
          className="hidden sm:inline"
        />
      </summary>
      <ul className="menu dropdown-content bg-base-100 rounded-box z-30 mt-1 w-48 p-2 shadow-(--shadow-card)">
        {GALLERY_SORTS.map((sort) => (
          <li key={sort}>
            <Link
              href={href(p.view, { sort, shown: PAGE })}
              aria-current={sort === p.view.sort ? "true" : undefined}
              className={
                sort === p.view.sort ? "bg-primary/10 text-primary" : undefined
              }
            >
              {copy(SORT_WORD[sort])}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The strip's axis: whole steps around the scores shown, never past 0 or 100. */
function axisOf(scores: readonly number[]): { low: number; high: number; ticks: number[] } {
  const low = Math.max(0, Math.floor(Math.min(...scores) / STEP) * STEP);
  const high = Math.min(SCORE_MAX, Math.max(low + STEP, Math.ceil(Math.max(...scores) / STEP) * STEP));
  const ticks: number[] = [];
  for (let tick = low; tick <= high; tick += STEP) ticks.push(tick);
  return { low, high, ticks };
}

/** The newest reports' scores on one axis, each in its band; an unscored
 *  report is named in the caption, never drawn at 0. */
function NewestStrip(p: { entries: readonly GalleryEntry[] }): React.JSX.Element | null {
  const scored = p.entries.flatMap((entry) => (entry.score === null ? [] : [{ domain: entry.domain, score: entry.score }]));
  if (scored.length === 0) return null;
  const unscored = p.entries.filter((entry) => entry.score === null);
  const n = String(p.entries.length);
  const axis = axisOf(scored.map((entry) => entry.score));
  const bands = BAND_ORDER.filter((band) => scored.some((entry) => bandOf(entry.score) === band));
  const caption = [
    copy("gallery.strip.caption"),
    unscored.length === 0
      ? null
      : unscored.length === 1
        ? copy("gallery.strip.unscored.one", { n, domain: unscored[0]!.domain })
        : copy("gallery.strip.unscored.many", { count: String(unscored.length), n }),
  ]
    .filter((part) => part !== null)
    .join(" ");
  return (
    <figure
      aria-label={copy("gallery.strip.label", { n })}
      className="card bg-base-100 shadow-(--shadow-card) min-w-0"
      data-testid="gallery-strip"
    >
      <div className="card-body gap-3 p-5">
        <p className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-semibold">
            <ChartColumn size={16} strokeWidth={1.75} aria-hidden className="text-primary" />
            {copy("gallery.strip.title", { n })}
          </span>
          <span className="text-base-content/70 flex flex-wrap gap-3 text-xs">
            {bands.map((band) => (
              <span key={band} className="inline-flex items-center gap-1.5">
                <span aria-hidden className={`size-3 rounded-full ${DOT[band]}`} />
                {copy(SCORE_BANDS[band])}
              </span>
            ))}
          </span>
        </p>
        <ScoreStrip
          points={scored.map((entry) => ({ name: entry.domain, score: entry.score, ring: RING[bandOf(entry.score)] }))}
          low={axis.low}
          high={axis.high}
          ticks={axis.ticks}
        />
        <figcaption className="text-base-content/70 text-sm">{caption}</figcaption>
      </div>
    </figure>
  );
}

const INSIDE = [1, 2, 3, 4] as const;

/** The four questions every free report answers, on the example business's report. */
function InsideReport(): React.JSX.Element {
  const e = EXAMPLES.plumber;
  const band = bandOf(e.report.score);
  const well = "rounded-box bg-base-200 flex min-w-0 flex-col gap-1 p-3";
  const step = "badge badge-soft badge-primary badge-sm";
  return (
    <section aria-labelledby="inside-h" className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 py-12">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="eyebrow">{copy("gallery.inside.eyebrow")}</p>
        <h2 id="inside-h">{copy("gallery.inside.heading")}</h2>
        <p className="text-base-content/70 max-w-2xl">{copy("gallery.inside.lead")}</p>
      </div>
      <figure className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="mockup-browser border-base-300 bg-base-100 min-w-0 border">
          <div className="mockup-browser-toolbar min-w-0">
            <div className="input w-full min-w-0">
              <span className="truncate">{`${REPORT_HOST}/scan/${e.site}`}</span>
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2 p-4 sm:grid-cols-2">
            <div className={well}>
              <span className={step} aria-hidden>{INSIDE[0]}</span>
              <span className="flex flex-wrap items-center gap-2">
                <span
                  aria-hidden
                  className={`${SCORE_RING} [--size:3rem]`}
                  style={{ "--value": e.report.score } as React.CSSProperties}
                />
                <span className="num text-lg font-semibold">
                  {copy("gallery.card.score", { score: String(e.report.score), max: String(SCORE_MAX) })}
                </span>
                <span className={`${BADGE[BAND_TONE[band]]} badge-sm`}>{copy(SCORE_BANDS[band])}</span>
              </span>
            </div>
            <div className={well}>
              <span className={step} aria-hidden>{INSIDE[1]}</span>
              <span className="font-semibold">{copy("gallery.inside.rivals")}</span>
              {e.watched.map((rival) => (
                <span key={rival} className="text-base-content/70 font-mono text-xs break-all">{rival}</span>
              ))}
            </div>
            <div className={well}>
              <span className={step} aria-hidden>{INSIDE[2]}</span>
              <span className="font-semibold">{copy("how.rivals.tally", { n: e.tally.n, total: e.tally.total })}</span>
              <progress aria-hidden className="progress progress-primary" value={e.tally.n} max={e.tally.total} />
            </div>
            <div className={well}>
              <span className={step} aria-hidden>{INSIDE[3]}</span>
              <span className="font-semibold">{copy("how.start.missing", { n: e.report.missing })}</span>
              <span className="text-base-content/70 flex min-w-0 items-start gap-1.5 text-sm">
                <FileText size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 flex-none" />
                <span className="min-w-0 break-words">{e.page.title}</span>
              </span>
            </div>
          </div>
        </div>
        <ol className="card bg-base-100 shadow-(--shadow-card) flex min-w-0 flex-col gap-3 p-5">
          {INSIDE.map((n) => (
            <li key={n} className="flex min-w-0 gap-3">
              <span className={step} aria-hidden>{n}</span>
              <span className="flex min-w-0 flex-col">
                <strong>{copy(`gallery.inside.${n}.title` as CopyKey)}</strong>
                <span className="text-base-content/70 text-sm">{copy(`gallery.inside.${n}.line` as CopyKey)}</span>
              </span>
            </li>
          ))}
        </ol>
        <figcaption className="text-base-content/70 text-sm lg:col-span-2">
          {copy("library.close.example", { business: e.business })}
        </figcaption>
      </figure>
    </section>
  );
}

export default async function ScansPage(props: {
  searchParams: Promise<Params>;
}): Promise<React.JSX.Element> {
  const view = viewOf(await props.searchParams);
  const plain = view.q === "" && view.kind === null && view.sort === "newest";
  const [gallery, newest] = await Promise.all([
    readGallery({ search: view.q, kind: view.kind, sort: view.sort, shown: view.shown }),
    // The strip and the count are the whole listing's, whatever is filtered.
    plain ? null : readGallery({ search: "", kind: null, sort: "newest", shown: PAGE }),
  ]);
  const listing = newest ?? gallery;
  const shown = gallery.entries.length;
  const pills: readonly { kind: BusinessKind | null; label: string; Icon: LucideIcon }[] = [
    { kind: null, label: copy("gallery.filter.all"), Icon: LayoutGrid },
    ...BUSINESS_KIND_NAMES.map((kind) => ({ kind, label: copy(KIND_WORD[kind]), Icon: KIND_ICON[kind] })),
  ];
  const showing = copy("gallery.showing", { shown: String(shown), total: String(gallery.total) });

  return (
    // The surface declares its own edges: the toolbar and the card ground
    // run the viewport's width, and each band keeps its own `max-w-6xl`.
    <Surface
      arms={{
        compact: {
          kind: "declared",
          note: "full-width bands: header, sticky toolbar, card grid; each capped at max-w-6xl",
        },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="flex flex-col">
        <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pt-10 pb-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
          <div className="flex min-w-0 flex-col gap-3">
            <p className="flex items-center gap-2">
              <span aria-hidden className="bg-success size-1.5 rounded-full" />
              <span className="eyebrow">{copy("gallery.eyebrow")}</span>
            </p>
            <h1 className="text-4xl font-semibold">
              {copy("gallery.heading")}
            </h1>
            <p className="text-base-content/70 max-w-2xl text-lg">
              {copy("gallery.subline", { count: String(listing.total) })}
            </p>
          </div>
          {/* From `lg`, beside the heading. Below it the field follows the
              cards, so a phone opens on them. */}
          <div className="card bg-base-100 hidden shadow-(--shadow-card) lg:flex">
            <div className="card-body gap-3 p-5">
              <h2 className="text-base font-semibold">
                {copy("landing.close.heading")}
              </h2>
              <ScanForm words={scanFormWords()} />
              <p className="text-base-content/70 font-mono text-xs">
                {copy("gallery.next.assurance")}
              </p>
            </div>
          </div>
        </section>

        {/* After the reports on a phone, so its first card is on screen. */}
        <div className="mx-auto w-full max-w-6xl px-4 pb-8 order-1 lg:order-none">
          <NewestStrip entries={listing.entries.slice(0, STRIP)} />
        </div>

        <section aria-labelledby="list" className="flex flex-col">
          <h2 id="list" className="mx-auto w-full max-w-6xl px-4 pb-3 text-2xl">
            {copy("gallery.list.heading")}
          </h2>
          <div
            data-testid="gallery-toolbar"
            className="bg-base-100 border-base-300 sticky top-16 z-20 border-y backdrop-blur-md"
          >
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2 sm:gap-3 sm:py-3">
              <nav
                aria-label={copy("gallery.filter.label")}
                className="-m-1 flex min-w-0 items-center gap-2"
              >
                <span className="eyebrow hidden flex-none pl-1 sm:inline">{copy("gallery.filter.label")}</span>
                {/* One row that scrolls sideways and never wraps. Its padding
                    keeps a pill's focus ring inside the scrolling box, and
                    the `nav` gives the same four pixels back. */}
                <ul className="flex min-w-0 flex-1 gap-1 overflow-x-auto p-1">
                  {pills.map((pill) => {
                    const current = pill.kind === view.kind;
                    return (
                      <li key={pill.kind ?? ""} className="flex-none">
                        <Link
                          href={href(view, { kind: pill.kind, shown: PAGE })}
                          aria-current={current ? "true" : undefined}
                          className={`btn btn-sm rounded-full font-medium whitespace-nowrap ${current ? "border-base-content bg-base-content text-base-100" : "btn-ghost"}`}
                        >
                          <pill.Icon size={16} strokeWidth={1.75} aria-hidden />
                          {pill.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <div className="flex items-center gap-3">
                <form
                  action="/scans"
                  method="get"
                  role="search"
                  className="min-w-0 flex-1 sm:max-w-md"
                >
                  <label className="input w-full">
                    <Search
                      size={16}
                      strokeWidth={1.75}
                      aria-hidden
                      className="text-base-content/70"
                    />
                    <input
                      type="search"
                      name="q"
                      defaultValue={view.q}
                      placeholder={copy("gallery.search.label")}
                      aria-label={copy("gallery.search.label")}
                      autoComplete={SEARCH_AUTOCOMPLETE}
                    />
                  </label>
                  {view.kind === null ? null : (
                    <input type="hidden" name="kind" value={view.kind} />
                  )}
                  {view.sort === "newest" ? null : (
                    <input type="hidden" name="sort" value={view.sort} />
                  )}
                </form>
                <p
                  className="text-base-content/70 hidden flex-1 text-sm md:block"
                  aria-live="polite"
                >
                  {showing}
                </p>
                <SortMenu view={view} />
              </div>
            </div>
          </div>

          <div className="bg-base-200 flex-1">
            <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
              <p className="text-base-content/70 text-sm md:hidden">{showing}</p>
              {shown === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center" data-testid="gallery-empty">
                  <h3 className="text-lg font-semibold">
                    {copy("gallery.empty.heading")}
                  </h3>
                  <p className="text-base-content/70">
                    {copy("gallery.empty.body")}
                  </p>
                  <Link href="/" className="btn btn-soft btn-primary mt-2">
                    {copy("gallery.empty.cta")}
                  </Link>
                </div>
              ) : (
                <ul
                  data-testid="gallery-cards"
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4"
                >
                  {gallery.entries.map((entry) => (
                    <Card key={entry.domain} entry={entry} />
                  ))}
                </ul>
              )}
              {shown < gallery.total && view.shown < MOST ? (
                <Link
                  href={href(view, { shown: view.shown + PAGE })}
                  scroll={false}
                  className="btn btn-soft self-center"
                >
                  {copy("gallery.more")}
                </Link>
              ) : null}
              {/* Below `lg` the heading's field is here, as one button down to
                  the field at the foot — soft, so the screen keeps one solid. */}
              <div className="card bg-base-100 shadow-(--shadow-card) lg:hidden">
                <div className="card-body items-center gap-3 p-5 text-center">
                  <h2 className="text-base font-semibold">
                    {copy("landing.close.heading")}
                  </h2>
                  <ScanJump />
                </div>
              </div>
              <p className="text-base-content/70 text-center text-sm">
                {copy("gallery.removal", { address: copy("removal.address") })}
              </p>
            </div>
          </div>
        </section>

        <div className="order-2 lg:order-none">
          <InsideReport />
        </div>
        <div className="mx-auto w-full max-w-5xl px-4 pb-12 order-3 lg:order-none">
          <LearnClose variant="scans" />
        </div>
      </main>
    </Surface>
  );
}
