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
//   1. the hero — title, subline, the one field, the offer, the proof card
//      (`HeroProof.tsx`) and the six kinds of business — beside the story
//      card (`Storyboard.tsx`); on a phone the story card comes last (board
//      v36, decision 2026-11-01-2246);
//   2. the walkthrough video, once its file exists (`Walkthrough.tsx`);
//   3. the three steps, each beside its picture, and one link to How it works;
//   4. *Why you should care* — four features (`Features.tsx`);
//   5. what the one plan gets you: its cards, then the price band;
//   6. what to expect when, and the questions owners ask;
//   7. the newest three articles ReachKit published, where any are stored;
//   8. the closing band, whose one button returns to the field.
//
// One solid button per section (DESIGN, the calm layer): the hero's Scan,
// the price band's and the closing band's. Every other way on is a plain link.
//
// The bands run the viewport's width (#1107), each keeping its content at
// the footer's `max-w-6xl px-4`.
//
// A Server Component. It reads no session and no cookie. `ScanForm` and
// `FieldCta` are the client leaves.
import type React from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Surface } from "@/ui/layout";
import { measuredCountryLists } from "@/lib/locale/locales";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { ScanForm } from "./_landing/ScanForm";
import { scanFormWords } from "./_landing/scan-form-words";
import { InsideReachKit } from "./_landing/InsideReachKit";
import { ReportAtGlance } from "./_landing/ReportAtGlance";
import { Storyboard } from "./_landing/Storyboard";
import { Features } from "./_landing/Features";
import { FieldCta } from "./_landing/FieldCta";
import { MondayCard } from "./_landing/MondayCard";
import { PlanCards } from "./_landing/PlanCards";
import { LatestArticles } from "./_landing/LatestArticles";
import { HeroProof } from "./_landing/HeroProof";
import { WALKTHROUGH_SRC, Walkthrough } from "./_landing/Walkthrough";
import { KIND_ICON, KIND_WORD } from "./scans/kinds";
import { BUSINESS_KIND_NAMES } from "@/lib/market/kinds";
import { WhenSteps } from "./_how/visuals-when";
import { FAQ_SECTION_ID, FIELD_SECTION_ID, HOW_SECTION_ID, PRICE_SECTION_ID, WHY_SECTION_ID } from "./_landing/sections";
import { HOW_FACTS } from "./_how/facts";
import { PUBLIC_ROUTE_SEO } from "./_seo/routes";
import { staticMetadata } from "./_seo/metadata";
import { JsonLd, homeSchemas } from "./_seo/structured";

type LandingSearchParams = { problem?: string; value?: string };

const WEEK_PAGES = String(HOW_FACTS.weekPages);
const PRICE = (): string => copy("price.amount");

/** The three steps, each with its picture. */
const STEPS = [
  { n: "1", title: "landing.step.1.title", body: "landing.step.1.body", tag: "landing.step.1.tag", Figure: ReportAtGlance },
  { n: "2", title: "landing.step.2.title", body: "landing.step.2.body", tag: "landing.step.2.tag", Figure: InsideReachKit },
  { n: "3", title: "landing.step.3.title", body: "landing.step.3.body", tag: "landing.step.3.tag", Figure: MondayCard },
] as const;

/** The offer under the field, one tick line each. */
const offer = (): readonly string[] => [copy("landing.hero.offer.free"), copy("landing.hero.offer.price", { price: PRICE() })];

/** The questions and their short answers, in the board's order; How it
 *  works holds the full ones. The guarantee and *Cancel your contract* wait
 *  for the launch gate and are not drawn. */
function questions(): readonly { q: CopyKey; a: CopyKey; vars?: Record<string, string> }[] {
  return [
    { q: "landing.faq.spam.q", a: "landing.faq.spam.a" },
    { q: "landing.faq.approve.q", a: "landing.faq.approve.short", vars: { hours: String(HOW_FACTS.windowHours) } },
    { q: "landing.faq.results.q", a: "landing.faq.results.short" },
    { q: "landing.faq.stop.q", a: "landing.faq.stop.short" },
    { q: "landing.faq.any.q", a: "landing.faq.any.a" },
    { q: "landing.faq.start.q", a: "landing.faq.start.a", vars: { minutes: String(HOW_FACTS.setupMinutes) } },
    { q: "landing.faq.german.q", a: "landing.faq.german.short", vars: { germanCountries: measuredCountryLists().germanCountries } },
    { q: "landing.faq.trial.q", a: "landing.faq.trial.short" },
  ];
}

/** Bound to names: the copy sweep reads a bare JSX attribute string as voice. */
const PRICE_TEST_ID = "landing-price";
const PAGE_NAME = "landing";
const KINDS_ID = "kinds";

const SECTION = "border-t border-base-300 py-16 lg:py-24";
const INNER = "mx-auto w-full max-w-6xl px-4";
const LABEL = "text-xs font-semibold uppercase tracking-wide text-primary";
/** Heading size and weight come from `type.css`'s element rules. */
const HEADING = "mt-2 mb-3";
const BODY = "text-base-content/70";
/** `py-3` on a 20px line makes the link a 44px target. */
const MORE = "link link-hover link-primary inline-flex items-center gap-1 py-3 text-sm font-semibold";

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
      {/* `data-page` lets the shared header hide the announcement bar on this page only. */}
      <main className="flex flex-col" data-page={PAGE_NAME}>
        <JsonLd blocks={homeSchemas()} />
        {/* ══ HERO ══ */}
        <section id={FIELD_SECTION_ID} className="scroll-mt-20 pt-6 pb-12 lg:pt-10 lg:pb-22">
          <div className={`${INNER} grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12`}>
            <div className="flex min-w-0 flex-col items-start gap-5 lg:gap-6">
              <h1 className="t-hero">{copy("landing.headline")}</h1>
              <p className="text-lg text-base-content/70">{copy("landing.subline")}</p>
              <div className="w-full">
                <ScanForm searchParams={props.searchParams} words={scanFormWords()} />
              </div>
              <ul className="flex flex-col gap-1.5">
                {offer().map((line) => (
                  <li key={line} className="flex items-center gap-2">
                    <Check size={18} strokeWidth={1.75} className="text-success shrink-0" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
              <Suspense fallback={null}>
                <HeroProof />
              </Suspense>
              <div className="flex flex-col gap-2">
                <p id={KINDS_ID} className="text-sm font-bold">
                  {copy("landing.hero.kinds.label")}
                </p>
                <ul aria-labelledby={KINDS_ID} className="flex flex-wrap gap-1.5">
                  {BUSINESS_KIND_NAMES.map((kind) => {
                    const Icon = KIND_ICON[kind];
                    return (
                      <li key={kind} className="badge badge-outline border-base-300 h-8 gap-1.5 font-semibold">
                        <Icon size={16} strokeWidth={1.75} className="text-primary" aria-hidden />
                        {copy(KIND_WORD[kind])}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <Storyboard />
          </div>
        </section>

        <Walkthrough src={WALKTHROUGH_SRC} />

        {/* ══ THE THREE STEPS ══ */}
        <section id={HOW_SECTION_ID} className={`${SECTION} scroll-mt-16`}>
          <div className={`${INNER} flex flex-col gap-6 lg:gap-9`}>
            <div className="max-w-2xl">
              <p className={LABEL}>{copy("landing.start.eyebrow")}</p>
              <h2 className={HEADING}>{copy("landing.start.heading")}</h2>
            </div>
            <ol className="flex flex-col gap-4 lg:gap-5">
              {STEPS.map(({ n, title, body, tag, Figure }) => (
                <li key={n} className="card card-border bg-base-100 min-w-0" data-step={n}>
                  <div className="card-body grid grid-cols-1 gap-5 px-4 pt-5 pb-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start lg:gap-12 lg:p-8">
                    <div className="flex min-w-0 flex-col items-start gap-3 px-1 lg:px-0 lg:pt-2">
                      <div className="flex items-center gap-2.5">
                        <span className="bg-primary text-primary-content grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold">
                          {n}
                        </span>
                        <span className="badge badge-soft badge-primary badge-sm font-mono">{copy(tag)}</span>
                      </div>
                      <h3 className="card-title">{copy(title)}</h3>
                      <p className="max-w-sm text-base-content/70">{copy(body, { weekPages: WEEK_PAGES })}</p>
                    </div>
                    <Figure />
                  </div>
                </li>
              ))}
            </ol>
            <p>
              <More href="/how-it-works" label={copy("landing.how.full")} />
            </p>
          </div>
        </section>

        {/* ══ WHY YOU SHOULD CARE ══ */}
        <section id={WHY_SECTION_ID} className={`${SECTION} scroll-mt-16 bg-base-100`}>
          <div className={INNER}>
            <div className="max-w-2xl">
              <p className={LABEL}>{copy("landing.why.eyebrow")}</p>
              <h2 className={HEADING}>{copy("landing.why.heading")}</h2>
              <p className={`${BODY} text-lg`}>{copy("landing.why.sub")}</p>
            </div>
            <div className="mt-9">
              <Features />
            </div>
          </div>
        </section>

        {/* ══ WHAT THE ONE PLAN GETS YOU ══ The band's button brings the field into view, so it adds no second submit. */}
        <section id={PRICE_SECTION_ID} className={`${SECTION} scroll-mt-16`}>
          <div className={`${INNER} flex flex-col gap-6 lg:gap-8`}>
            <h2 className="m-0">{copy("landing.price.heading", { price: PRICE() })}</h2>
            <PlanCards />
            <div className="card card-border bg-primary/5 min-w-0" data-testid={PRICE_TEST_ID}>
              <div className="card-body gap-5 px-5 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-9 lg:py-7">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                  <p className="flex items-baseline gap-2">
                    <span className="num text-5xl font-semibold">{PRICE()}</span>
                    <span className="text-base-content/70">{copy("landing.price.month")}</span>
                  </p>
                  <p className="flex flex-col gap-1">
                    <strong>{copy("landing.plan.one")}</strong>
                    <span className="text-base-content/70">{copy("landing.plan.terms")}</span>
                  </p>
                </div>
                <FieldCta label={copy("landing.start.cta")} />
              </div>
            </div>
          </div>
        </section>

        {/* ══ QUESTIONS ══ */}
        <section id={FAQ_SECTION_ID} className={`${SECTION} scroll-mt-16`}>
          <div className={`${INNER} flex flex-col items-start gap-6 lg:gap-8`}>
            <h2 className="mb-0">{copy("landing.faq.heading")}</h2>
            <div className="w-full">
              <WhenSteps />
            </div>
            <div className="grid w-full grid-cols-1 items-start gap-3 lg:grid-cols-2 lg:gap-x-4">
              {questions().map((item) => (
                <details key={item.q} className="collapse collapse-arrow card-border bg-base-100 min-w-0">
                  {/* 20px above and below a 24px line: each question is at least a 64px target. */}
                  <summary className="collapse-title py-5 leading-6 font-semibold">{copy(item.q)}</summary>
                  <div className="collapse-content text-base-content/70">
                    {/* The spam answer names the model that writes the pages, as the board does. */}
                    <p data-disclosure={item.a === "landing.faq.spam.a" ? true : undefined}>{copy(item.a, item.vars)}</p>
                  </div>
                </details>
              ))}
            </div>
            <More href="/how-it-works#faq" label={copy("landing.faq.more")} />
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
              <div className="card-body items-center gap-3.5 px-5 py-7 text-center lg:px-10 lg:py-12">
                <h2 className="mb-0">{copy("landing.close.heading")}</h2>
                <FieldCta label={copy("landing.start.cta")} />
                <p className="text-xs text-base-content/70">{copy("landing.close.assurance")}</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Surface>
  );
}
