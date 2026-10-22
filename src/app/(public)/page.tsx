// BUILD §3 — the landing page (SPEC §1).
//
// One field, no account: the hero's `ScanForm` is exactly one text input and
// one submit control. Every further call to action (`FieldCta`) brings that
// field into view with the cursor in it — never a second submit and never a
// second field.
//
// **The order is the owner's of 2026-10-19** (board *Landing*, decision
// `2026-10-19-1596`), one story with one example business, below the chrome
// the group layout draws:
//   1. the hero — title, subline, the one field — beside the story card
//      (`Storyboard.tsx`), with the trust strip under both;
//   2. the three steps, each linking to its How it works section, the
//      second holding the *Inside ReachKit* preview;
//   3. *Why you should care* — four features (`Features.tsx`);
//   4. what the one plan gets you, and its price card;
//   5. the questions owners ask;
//   6. the newest three articles ReachKit published, where any are stored;
//   7. the closing band, whose one button returns to the field.
//
// One solid button per section (DESIGN, the calm layer): the hero's Scan
// and the closing band's button. Every other way on is a plain link.
//
// The bands run the viewport's width (#1107), each keeping its content at
// the footer's `max-w-6xl px-4`.
//
// A Server Component. It reads no session and no cookie. `ScanForm`,
// `InsideTabs` and `FieldCta` are the client leaves.
import type React from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Surface } from "@/ui/layout";
import { HOSTED_RETENTION_DAYS, REFUND_WINDOW_DAYS } from "@/lib/config/constants";
import { measuredCountryLists } from "@/lib/locale/locales";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { ScanForm } from "./_landing/ScanForm";
import { scanFormWords } from "./_landing/scan-form-words";
import { InsideReachKit } from "./_landing/InsideReachKit";
import { Storyboard } from "./_landing/Storyboard";
import { Features } from "./_landing/Features";
import { FieldCta } from "./_landing/FieldCta";
import { LatestArticles } from "./_landing/LatestArticles";
import { FAQ_SECTION_ID, FIELD_SECTION_ID, HOW_SECTION_ID, PRICE_SECTION_ID, WHY_SECTION_ID } from "./_landing/sections";
import { HOW_FACTS } from "./_how/facts";
import { PUBLIC_ROUTE_SEO } from "./_seo/routes";
import { staticMetadata } from "./_seo/metadata";
import { JsonLd, homeSchemas } from "./_seo/structured";

type LandingSearchParams = { problem?: string; value?: string };

const WEEK_PAGES = String(HOW_FACTS.weekPages);
const PRICE = (): string => copy("price.amount");

/** The three steps, each with the How it works section it opens. */
const STEPS = [
  { n: "1", title: "landing.step.1.title", body: "landing.step.1.body", tag: "landing.step.1.tag", more: "landing.step.1.more", href: "/how-it-works#research" },
  { n: "2", title: "landing.step.2.title", body: "landing.step.2.body", tag: "landing.step.2.tag", more: "landing.step.2.more", href: "/how-it-works#pages" },
  { n: "3", title: "landing.step.3.title", body: "landing.step.3.body", tag: "landing.step.3.tag", more: "landing.step.3.more", href: "/how-it-works#found" },
] as const;

/** What the one plan holds, after the pace. */
const INCLUDED: readonly { key: CopyKey; vars?: Record<string, string> }[] = [
  { key: "landing.price.facts" },
  { key: "landing.price.ready" },
  { key: "landing.price.monday" },
  { key: "landing.price.competitors", vars: { rivals: String(HOW_FACTS.rivals) } },
  { key: "landing.price.site" },
];

/** The questions, in the board's order. The guarantee and *Cancel your
 *  contract* wait for the launch gate and are not drawn. */
function questions(): readonly { id: string; vars?: Record<string, string>; more?: string }[] {
  return [
    { id: "spam", vars: { checks: String(HOW_FACTS.checks), weekPages: WEEK_PAGES } },
    {
      id: "approve",
      vars: { hours: String(HOW_FACTS.windowHours), min: String(HOW_FACTS.windowMinDays), max: String(HOW_FACTS.windowMaxDays) },
    },
    { id: "results", more: "/how-it-works#found" },
    { id: "stop", vars: { refundDays: String(REFUND_WINDOW_DAYS), days: String(HOSTED_RETENTION_DAYS) } },
    { id: "local", vars: { weekPages: WEEK_PAGES } },
    { id: "start" },
    { id: "german", vars: measuredCountryLists() },
    { id: "trial", vars: { price: PRICE() } },
  ];
}

/** Bound to names: the copy sweep reads a bare JSX attribute string as voice. */
const PRICE_TEST_ID = "landing-price";
const VALUE_HREF = "/how-it-works#value";

const SECTION = "border-t border-base-300 py-16 lg:py-24";
const INNER = "mx-auto w-full max-w-6xl px-4";
const LABEL = "text-xs font-semibold uppercase tracking-wide text-primary";
/** Heading size and weight come from `type.css`'s element rules. */
const HEADING = "mt-2 mb-3";
const BODY = "text-base-content/70";
const MORE = "link link-hover link-primary inline-flex items-center gap-1 text-sm font-semibold";

function More(p: { href: string; label: string }): React.JSX.Element {
  return (
    <Link href={p.href} className={MORE}>
      {p.label}
      <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
    </Link>
  );
}

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
          note: "full-width bands: hero, the three steps, the white Why band, the plan, the questions, closing card; each capped at max-w-6xl",
        },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="flex flex-col">
        <JsonLd blocks={homeSchemas()} />
        {/* ══ HERO ══ */}
        <section id={FIELD_SECTION_ID} className="scroll-mt-20 pt-12 pb-10 lg:pt-16 lg:pb-12">
          <div className={`${INNER} grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-12`}>
            <div className="flex min-w-0 flex-col items-center text-center lg:items-start lg:text-left">
              <h1 className="t-hero">{copy("landing.headline")}</h1>
              <p className="mt-4 max-w-xl text-lg text-base-content/70">{copy("landing.subline", { weekPages: WEEK_PAGES })}</p>
              <div className="mt-8 w-full max-w-xl">
                <ScanForm searchParams={props.searchParams} words={scanFormWords()} />
              </div>
              <p className="mt-3 font-mono text-xs text-base-content/70">{copy("landing.hero.assurance")}</p>
              <p className="mt-2 text-sm font-semibold">{copy("landing.hero.what")}</p>
              <p className="mt-2 text-sm text-base-content/70">{copy("landing.hero.for")}</p>
              <p className="mt-4">
                <More href="/how-it-works" label={copy("landing.hero.how")} />
              </p>
            </div>
            <Storyboard />
          </div>
          <p className={`${INNER} mt-10 text-center text-sm text-base-content/70`}>
            {copy("landing.trust", { price: PRICE(), checks: String(HOW_FACTS.checks) })}
          </p>
        </section>

        {/* ══ THE THREE STEPS ══ */}
        <section id={HOW_SECTION_ID} className={`${SECTION} scroll-mt-16`}>
          <div className={INNER}>
            <div className="mx-auto max-w-2xl text-left lg:text-center">
              <p className={LABEL}>{copy("landing.start.eyebrow")}</p>
              <h2 className={HEADING}>{copy("landing.start.heading")}</h2>
              <p className={BODY}>{copy("landing.start.body")}</p>
            </div>
            <ol className="mt-10 flex flex-col gap-4">
              {STEPS.map((step) => (
                <li key={step.n} className="card card-border bg-base-100 min-w-0">
                  <div className="card-body grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="flex min-w-0 flex-col items-start gap-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-primary text-primary-content grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold">
                          {step.n}
                        </span>
                        <span className="badge badge-soft badge-primary badge-sm font-mono">{copy(step.tag)}</span>
                      </div>
                      <h3 className="card-title">{copy(step.title)}</h3>
                      <p className="text-sm text-base-content/70">{copy(step.body, { weekPages: WEEK_PAGES })}</p>
                      <More href={step.href} label={copy(step.more)} />
                    </div>
                    {step.n === "2" && <InsideReachKit />}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ══ WHY YOU SHOULD CARE ══ */}
        <section id={WHY_SECTION_ID} className={`${SECTION} scroll-mt-16 bg-base-100`}>
          <div className={INNER}>
            <div className="grid grid-cols-1 items-end gap-4 lg:grid-cols-2 lg:gap-12">
              <div className="min-w-0">
                <p className={LABEL}>{copy("landing.why.eyebrow")}</p>
                <h2 className={HEADING}>{copy("landing.why.heading")}</h2>
              </div>
              <p className={`${BODY} min-w-0`}>{copy("landing.why.body")}</p>
            </div>
            <div className="mt-10">
              <Features />
            </div>
          </div>
        </section>

        {/* ══ WHAT THE ONE PLAN GETS YOU ══ */}
        <section id={PRICE_SECTION_ID} className={`${SECTION} scroll-mt-16`}>
          <div className={`${INNER} grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12`}>
            <div className="min-w-0">
              <h2 className={HEADING}>{copy("landing.price.heading", { price: PRICE() })}</h2>
              <ul className="mt-6 flex flex-col gap-3">
                <li className="flex items-start gap-2 font-semibold">
                  <Check size={16} strokeWidth={1.75} className="text-success mt-1 shrink-0" aria-hidden />
                  {copy("landing.pace", { weekPages: WEEK_PAGES })}
                </li>
                {INCLUDED.map((item) => (
                  <li key={item.key} className="flex items-start gap-2">
                    <Check size={16} strokeWidth={1.75} className="text-success mt-1 shrink-0" aria-hidden />
                    {copy(item.key, item.vars)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card card-border bg-base-100 min-w-0" data-testid={PRICE_TEST_ID}>
              <div className="card-body gap-3">
                <p className={LABEL}>{copy("landing.price.plan")}</p>
                <p className="num text-4xl font-bold">{PRICE()}</p>
                <p className="text-sm text-base-content/70">{copy("landing.price.terms", { price: PRICE() })}</p>
                <More href={VALUE_HREF} label={copy("landing.price.more")} />
              </div>
            </div>
          </div>
        </section>

        {/* ══ QUESTIONS ══ */}
        <section id={FAQ_SECTION_ID} className={`${SECTION} scroll-mt-16`}>
          <div className={`${INNER} max-w-3xl`}>
            <p className={LABEL}>{copy("landing.faq.eyebrow")}</p>
            <h2 className={HEADING}>{copy("landing.faq.heading")}</h2>
            <div className="mt-6 flex flex-col gap-2">
              {questions().map((q) => (
                <details key={q.id} className="collapse collapse-arrow card-border bg-base-100">
                  <summary className="collapse-title font-semibold">{copy(`landing.faq.${q.id}.q` as CopyKey)}</summary>
                  <div className="collapse-content flex flex-col items-start gap-3 text-sm text-base-content/70">
                    <p>{copy(`landing.faq.${q.id}.a` as CopyKey, q.vars)}</p>
                    {q.more !== undefined && <More href={q.more} label={copy("landing.faq.results.more")} />}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ══ LATEST ARTICLES ══ No article stored, no band. */}
        <Suspense fallback={null}>
          <LatestArticles />
        </Suspense>

        {/* ══ THE CLOSING BAND ══ Its button brings the field into view, so it
            adds no second submit. */}
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
