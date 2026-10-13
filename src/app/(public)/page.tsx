// BUILD §3 — the landing page (SPEC §1).
//
// One field, no account: the hero's `ScanForm` is exactly one text input and
// one submit control. Every further call to action (`FieldCta`) brings that
// field into view with the cursor in it — never a second submit and never a
// second field.
//
// **The order is the owner's of 2026-09-24** (SPEC §1, #1059; boards
// `R12-1-Landing`, `R12-8-Phone-landing` and the dark one, `R12-10`), below the
// chrome the group layout draws:
//   1. the hero — title, subtitle, the one field — beside the *Inside
//      ReachKit* preview at the same height (`InsideReachKit.tsx`);
//   2. the *Recently scanned* logo strip (`RecentlyScanned.tsx`, #1069),
//      streamed behind a quiet skeleton so the hero never waits on its read;
//   3. *What happens every day* (2026-10-10, issue 1396), the eight steps
//      where the empty *See it work* frame stood, linked to `/how-it-works`;
//   4. *Why you should care* — four features (`Features.tsx`);
//   5. *What to do next* — three step cards with their times;
//   6. the closing band, whose one button returns to the field.
//
// One solid button per section (DESIGN, the calm layer, #1063): the hero's
// Scan and the closing band's button. The eight steps' link is soft.
//
// The bands run the viewport's width (#1107): *Why you should care* is a
// full-bleed `base-100` band, not an inset box, and each band keeps its
// content at the footer's `max-w-6xl px-4`. So the surface declares its
// edges, as `/scans` does.
//
// A Server Component. It reads no session and no cookie. `ScanForm`,
// `InsideTabs` and `FieldCta` are the client leaves.
import type React from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Surface } from "@/ui/layout";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { ScanForm } from "./_landing/ScanForm";
import { scanFormWords } from "./_landing/scan-form-words";
import { InsideReachKit } from "./_landing/InsideReachKit";
import { Features } from "./_landing/Features";
import { RecentlyScanned, RecentlyScannedSkeleton } from "./_landing/RecentlyScanned";
import { FieldCta, FIELD_SECTION_ID, HOW_SECTION_ID, WHY_SECTION_ID } from "./_landing/FieldCta";
import { HOW_FACTS } from "./_how/facts";
import { PUBLIC_ROUTE_SEO } from "./_seo/routes";
import { staticMetadata } from "./_seo/metadata";

type LandingSearchParams = { problem?: string; value?: string };

/** The two section numbers — a data identity, not a sentence. */
const SECTION_NUMBER = ["01", "02"] as const;

/** The three steps of *What to do next*. */
const STEPS = [
  { n: "1", title: "landing.step.1.title", body: "landing.step.1.body", tag: "landing.step.1.tag" },
  { n: "2", title: "landing.step.2.title", body: "landing.step.2.body", tag: "landing.step.2.tag" },
  { n: "3", title: "landing.step.3.title", body: "landing.step.3.body", tag: "landing.step.3.tag" },
] as const;

/** Bound to a name: the copy sweep reads a bare JSX attribute string as voice. */
const DAY_TEST_ID = "landing-day";

/** *What happens every day*: the eight steps, in order. A figure is a slot
 *  filled from the constants, never typed (issue 1396). */
const DAY_STEPS: readonly { title: CopyKey; line: CopyKey; vars?: Record<string, number> }[] = [
  { title: "landing.day.1.title", line: "landing.day.1.line" },
  { title: "landing.day.2.title", line: "landing.day.2.line", vars: { searches: HOW_FACTS.searches, prompts: HOW_FACTS.prompts } },
  { title: "landing.day.3.title", line: "landing.day.3.line", vars: { rivals: HOW_FACTS.rivals } },
  { title: "landing.day.4.title", line: "landing.day.4.line" },
  { title: "landing.day.5.title", line: "landing.day.5.line" },
  { title: "landing.day.6.title", line: "landing.day.6.line", vars: { checks: HOW_FACTS.checks } },
  { title: "landing.day.7.title", line: "landing.day.7.line", vars: { hours: HOW_FACTS.windowHours } },
  { title: "landing.day.8.title", line: "landing.day.8.line" },
];

/** The surface is `declared`, so it pads nothing: every band's content
 *  takes the footer's own measure and gutter (#1107). */
const SECTION = "border-t border-base-300 py-16 lg:py-24";
const INNER = "mx-auto w-full max-w-6xl px-4";
const LABEL = "flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-primary";
/** Heading size and weight come from `type.css`'s element rules. */
const HEADING = "mt-2 mb-3";
const BODY = "text-base-content/70";

/** The one public route a stranger is meant to arrive at from a search
 *  result: indexable, in the sitemap, with its own share image. */
export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.landing);

export default function LandingPage(props: {
  searchParams?: Promise<LandingSearchParams> | LandingSearchParams;
}): React.JSX.Element {
  return (
    <Surface
      arms={{
        compact: {
          kind: "declared",
          note: "full-width bands: hero, the eight steps, the white Why band, steps, closing card; each capped at max-w-6xl",
        },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="flex flex-col">
        {/* ══ HERO ══ Two columns at the same height (SPEC §1, 2026-09-24):
            the grid stretches both, and the preview fills its column. */}
        <section id={FIELD_SECTION_ID} className="scroll-mt-20 pt-12 pb-10 lg:pt-16 lg:pb-8">
          <div className={`${INNER} grid grid-cols-1 items-stretch gap-10 lg:grid-cols-2 lg:gap-12`}>
            <div className="flex min-w-0 flex-col items-center justify-center text-center lg:items-start lg:text-left">
              <h1 className="t-hero">{copy("landing.headline")}</h1>
              <p className="mt-4 max-w-xl text-lg text-base-content/70">{copy("landing.subline")}</p>
              <div className="mt-8 w-full max-w-xl">
                <ScanForm searchParams={props.searchParams} words={scanFormWords()} />
              </div>
              <p className="mt-3 font-mono text-xs text-base-content/70">{copy("landing.hero.assurance")}</p>
            </div>
            <InsideReachKit />
          </div>
        </section>

        {/* ══ RECENTLY SCANNED ══ Logos and names only, each to `/scans`.
            Its own `max-w-6xl` sets the measure; the declared surface adds
            no gutter, so this wrapper gives it the other bands' `px-4`. */}
        <div className="px-4">
          <Suspense fallback={<RecentlyScannedSkeleton />}>
            <RecentlyScanned />
          </Suspense>
        </div>

        {/* ══ WHAT HAPPENS EVERY DAY ══ Where the empty video frame stood
            (SPEC §1 2026-10-10, issue 1396): the eight steps, each figure
            read from the constants the product runs on (`_how/facts.ts`),
            and one link to the page that says the rest. */}
        <section className="pt-4 pb-16 lg:pt-8">
          <div className={INNER} data-testid={DAY_TEST_ID}>
            <div className="mx-auto max-w-2xl text-left lg:text-center">
              <p className={`${LABEL} lg:justify-center`}>{copy("landing.day.eyebrow")}</p>
              <h2 className={HEADING}>{copy("landing.day.heading")}</h2>
              <p className={BODY}>{copy("landing.day.body")}</p>
            </div>
            <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DAY_STEPS.map((step, i) => (
                <li key={step.title} className="card card-border bg-base-100 min-w-0">
                  <div className="card-body gap-2">
                    <span className="bg-primary/10 text-primary grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold">
                      {i + 1}
                    </span>
                    <h3 className="card-title">{copy(step.title)}</h3>
                    <p className="text-sm text-base-content/70">{copy(step.line, step.vars)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-center">
              <Link href="/how-it-works" className="btn btn-soft btn-primary">
                {copy("landing.day.more")}
              </Link>
            </p>
          </div>
        </section>

        {/* ══ 01 · WHY YOU SHOULD CARE ══ */}
        <section id={WHY_SECTION_ID} className={`${SECTION} scroll-mt-16 bg-base-100`}>
          <div className={INNER}>
            <div className="grid grid-cols-1 items-end gap-4 lg:grid-cols-2 lg:gap-12">
              <div className="min-w-0">
                <p className={LABEL}>
                  <span className="font-mono">{SECTION_NUMBER[0]}</span>
                  <span>{copy("landing.why.eyebrow")}</span>
                </p>
                <h2 className={HEADING}>{copy("landing.why.heading")}</h2>
              </div>
              <p className={`${BODY} min-w-0`}>{copy("landing.why.body")}</p>
            </div>
            <div className="mt-10">
              <Features />
            </div>
          </div>
        </section>

        {/* ══ 02 · WHAT TO DO NEXT ══ Three step cards, each with its number
            and its time inside it: a column on a phone, a row at `lg`. */}
        <section id={HOW_SECTION_ID} className={`${SECTION} scroll-mt-16`}>
          <div className={INNER}>
            <div className="mx-auto max-w-2xl text-left lg:text-center">
              <p className={`${LABEL} lg:justify-center`}>
                <span className="font-mono">{SECTION_NUMBER[1]}</span>
                <span>{copy("landing.start.eyebrow")}</span>
              </p>
              <h2 className={HEADING}>{copy("landing.start.heading")}</h2>
              <p className={BODY}>{copy("landing.start.body")}</p>
            </div>

            <ol className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {STEPS.map((step) => (
                <li key={step.n} className="card card-border bg-base-100 min-w-0">
                  <div className="card-body gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="bg-primary text-primary-content grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold">
                        {step.n}
                      </span>
                      <span className="badge badge-soft badge-primary badge-sm font-mono">{copy(step.tag)}</span>
                    </div>
                    <h3 className="card-title">{copy(step.title)}</h3>
                    <p className="text-sm text-base-content/70">{copy(step.body)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ══ THE CLOSING BAND ══ A tinted card on the ground, in no band of
            its own. The hero's own action, stated again: its button brings
            the field into view, so it adds no second submit. */}
        <section className="pb-16 lg:pb-24">
          <div className={INNER}>
            <div className="card card-border bg-primary/5">
              <div className="card-body grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12 lg:p-12">
                <div className="min-w-0">
                  <h2 className="mb-3">{copy("landing.close.heading")}</h2>
                  <p className={BODY}>{copy("landing.close.body")}</p>
                </div>
                <div className="flex flex-col items-stretch gap-2 text-center lg:items-center">
                  <FieldCta label={copy("landing.start.cta")} />
                  <p className="font-mono text-xs text-base-content/70">{copy("landing.close.assurance")}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Surface>
  );
}
