// SPEC §1 2026-09-24 (owner on #1058: it ships) — the landing's logo strip.
// src/app/(public)/_landing/RecentlyScanned.tsx — issue #1069
//
// Boards `R12-1-Landing` (under the hero), `R12-8-Phone-landing` and
// `R12-10-Dark-landing`: the label *Recently scanned* with *See all free
// scans* beside a row of logos and company names — no score, no date — each
// linking to `/scans`. Labelled *Recently scanned*, never *Trusted by*.
//
// **The list is `/scans`'s** (`readRecent`, the same `free_scan_listing`
// view), so a removed or refused site leaves the strip and the gallery at
// once. A server component: the list is rendered here and the drift is CSS
// alone (`animate-drift`), so the landing's script budget (#988) is untouched.
//
// **The drift.** Two copies of the list side by side move half the track
// in 80s and start again where they began; the second copy is hidden from
// assistive technology and from the tab order. It pauses under the pointer
// and while a logo has focus. Under reduced motion nothing moves, the second
// copy is not drawn, and the row scrolls sideways instead. A short list
// (under `DRIFT_FROM`) would leave a gap in the loop, so it stands still.
//
// **Greyscale until hover**, and in dark each logo is a light silhouette
// (`R12-10`); the name is muted ink until hover. A site with no usable logo
// gets its first letter on a tile, as its gallery card does.
import type React from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import type { StripEntry } from "@/lib/scan/gallery";

/** How many of the newest scans the strip carries. */
const SHOWN = 16;
/** Fewer than this and the row does not drift. */
const DRIFT_FROM = 8;

/** Attribute values, never sentences — bound to names because the copy
 *  sweep reads a bare JSX attribute string as product voice. The logo is
 *  decorative: the company's name is written beside it. */
const IMG = { alt: "", loading: "lazy" } as const;
const LABEL_ID = "recently-scanned";
const GALLERY = "/scans";

const SECTION = "col-span-full pb-10 lg:pb-12";
const INNER =
  "mx-auto grid w-full max-w-6xl grid-cols-1 gap-2 lg:grid-cols-[10rem_minmax(0,1fr)] lg:items-center lg:gap-6";

function initial(company: string): string {
  return (Array.from(company.trim())[0] ?? "?").toLocaleUpperCase("en-US");
}

function Logo(p: { entry: StripEntry }): React.JSX.Element {
  if (!p.entry.hasLogo) {
    return (
      <span
        aria-hidden
        className="bg-base-200 grid size-7 flex-none place-items-center rounded-field text-sm font-semibold"
      >
        {initial(p.entry.company)}
      </span>
    );
  }
  return (
    <Image
      src={`${GALLERY}/logo/${encodeURIComponent(p.entry.domain)}`}
      alt={IMG.alt}
      width={28}
      height={28}
      unoptimized
      loading={IMG.loading}
      className="size-7 flex-none object-contain grayscale transition-[filter] group-hover/logo:grayscale-0 dark:brightness-0 dark:invert dark:group-hover/logo:brightness-100 dark:group-hover/logo:invert-0"
    />
  );
}

function Row(p: {
  entries: readonly StripEntry[];
  copyOf?: boolean;
}): React.JSX.Element {
  return (
    <ul
      aria-hidden={p.copyOf ? true : undefined}
      className={`flex flex-none gap-2 pr-2 ${p.copyOf ? "motion-reduce:hidden" : ""}`}
    >
      {p.entries.map((entry) => (
        <li key={entry.domain} className="flex-none">
          <a
            href={GALLERY}
            tabIndex={p.copyOf ? -1 : undefined}
            className="group/logo text-base-content/70 hover:bg-base-100 hover:text-base-content flex items-center gap-2.5 rounded-box px-3 py-2 transition-colors"
          >
            <Logo entry={entry} />
            <span className="text-base font-semibold whitespace-nowrap">
              {entry.company}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** What the strip holds while its list is read: the same band, quiet. */
export function RecentlyScannedSkeleton(): React.JSX.Element {
  return (
    <div aria-hidden className={SECTION}>
      <div className={INNER}>
        <div className="skeleton h-5 w-36" />
        <div className="skeleton h-11 w-full" />
      </div>
    </div>
  );
}

export async function RecentlyScanned(): Promise<React.JSX.Element | null> {
  let entries: readonly StripEntry[];
  try {
    // Imported here, not at the top: the database client checks its
    // environment when it loads, and the landing renders without one.
    const { readRecent } = await import("@/lib/scan/gallery");
    entries = await readRecent(SHOWN);
  } catch (error) {
    // The strip is not the landing's job: a failed read drops the strip,
    // never the page the field is on.
    console.error(error);
    return null;
  }
  if (entries.length === 0) return null;
  const drifts = entries.length >= DRIFT_FROM;

  return (
    <section aria-labelledby={LABEL_ID} className={SECTION}>
      <div className={INNER}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 lg:flex-col lg:items-start">
          <p className="flex items-center gap-2">
            <span
              aria-hidden
              className="status status-success relative after:absolute after:inset-0 after:rounded-full after:bg-inherit after:opacity-0 motion-safe:after:animate-beacon"
            />
            <span id={LABEL_ID} className="eyebrow">
              {copy("landing.strip.label")}
            </span>
          </p>
          <a
            href={GALLERY}
            className="link link-hover link-primary group/all flex items-center gap-1 text-sm font-semibold"
          >
            {copy("landing.strip.all")}
            <ArrowRight
              aria-hidden
              size={14}
              strokeWidth={1.75}
              className="transition-transform duration-200 group-hover/all:translate-x-[3px]"
            />
          </a>
        </div>
        <div
          className={`group/strip min-w-0 overflow-x-auto py-1 [scrollbar-width:none] ${drifts ? "mask-x-from-90%" : ""}`}
        >
          <div
            className={`flex w-max ${drifts ? "motion-safe:animate-drift group-focus-within/strip:[animation-play-state:paused] group-hover/strip:[animation-play-state:paused]" : ""}`}
          >
            <Row entries={entries} />
            {drifts ? <Row entries={entries} copyOf /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
