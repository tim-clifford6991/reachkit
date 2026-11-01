// src/app/(public)/pricing/page.tsx — BUILD §4.1 module 6, REQ-021 c4/c5 (issue #19)
//
// The one price surface away from any report (board Pricing): the plan card
// and what ReachKit doesn't do, what to expect from week 1, the comparison
// with the other ways, the questions asked before paying, and the free scan
// for anyone not ready yet.
//
// The offer is `PricingCard`, the report's own component in its `pricing`
// wording, so the two surfaces state the same price and one Start (REQ-021
// c4). Its control begins a scanless checkout and nothing is asked before it.
// The scan field at the foot is the landing's own form, a second path that
// asks for a website and never for an account.
//
// No figure is typed: counts come from `_how/facts.ts` and the constants. The
// money-back line and the refund answer wait for the launch gate (owner
// 2026-10-20, Q13).
import React, { use } from "react";
import type { Metadata } from "next";
import { CircleCheck, CircleStop, Clock4, Eye, Gift, Inbox, Pen, Plug, Search, Store, Timer, TrendingUp, X, type LucideIcon } from "lucide-react";
import { Surface } from "@/ui/layout";
import { WEEK_PLAN } from "@/lib/config/constants";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PricingCard } from "../scan/[domain]/_modules/pricing";
import { ScanForm } from "../_landing/ScanForm";
import { scanFormWords } from "../_landing/scan-form-words";
import { HOW_FACTS as F } from "../_how/facts";
import { WhatToExpect } from "../_how/visuals";
import { ThreeWays } from "../_how/compare";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";
import { startCheckout } from "./actions";
import { CHECKOUT_QUERY_KEY, REFUSED_MARKER, type PricingSearchParams } from "./state";

function isPromise<T>(value: Promise<T> | T | undefined): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/** Accepts a real `searchParams` Promise (production) or an already-plain
 *  object (this file's own tests). */
function usePricingSearchParams(
  searchParams: Promise<PricingSearchParams> | PricingSearchParams | undefined
): PricingSearchParams {
  if (isPromise(searchParams)) return use(searchParams);
  return searchParams ?? {};
}

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.pricing);

/** The anchor the plan card's free path and the closing field share. */
const START_ID = "start";

const INNER = "mx-auto w-full max-w-6xl px-4";
const LEAD = "text-base-content/70 max-w-2xl text-lg";

const price = (): string => copy("price.amount");
const weekPages = { weekPages: WEEK_PLAN.days };

/** One section: its eyebrow, its title and lead, then what it shows. */
function Section(p: {
  id: string;
  eyebrow?: string;
  title: string;
  body?: string;
  band?: boolean;
  /** What it shows sits beside the heading at desktop, not under it. */
  beside?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const heading = `${p.id}-h`;
  return (
    <section
      id={p.id}
      aria-labelledby={heading}
      className={`border-base-300 scroll-mt-16 border-t py-12 lg:py-20 ${p.band === true ? "bg-base-100" : ""}`}
    >
      <div className={`${INNER} grid grid-cols-1 items-start gap-8 ${p.beside === true ? "lg:grid-cols-2 lg:gap-12" : ""}`}>
        <div className="flex flex-col gap-3">
          {p.eyebrow === undefined ? null : <p className="eyebrow">{p.eyebrow}</p>}
          <h2 id={heading}>{p.title}</h2>
          {p.body === undefined ? null : <p className={LEAD}>{p.body}</p>}
        </div>
        {p.children}
      </div>
    </section>
  );
}

/** The plan card's free path: the field at the foot of this page. */
function FreeFirst(): React.JSX.Element {
  return (
    <p className="border-base-300 flex flex-wrap justify-center gap-1 border-t pt-4 text-sm">
      {copy("pricing.plan.unsure")}
      <a href={`#${START_ID}`} className="link link-primary font-semibold">
        {copy("pricing.plan.scan")}
      </a>
    </p>
  );
}

/** What the plan leaves out. */
const NOT_DONE: readonly CopyKey[] = [
  "pricing.all.not.maps",
  "how.value.not.ads",
  "how.value.not.social",
  "how.value.not.perplexity",
  "how.value.not.sites",
  "how.value.not.promise",
];

/** Under the card: the one list of what the plan leaves out. */
function NotDone(): React.JSX.Element {
  return (
    <div className="rounded-box bg-base-200 flex flex-col gap-2 p-4">
      <h3 className="text-sm font-semibold">{copy("pricing.all.not")}</h3>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {NOT_DONE.map((key) => (
          <li key={key} className="flex items-center gap-1">
            <X size={14} strokeWidth={1.75} aria-hidden />
            {copy(key)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FromWeekOne(): React.JSX.Element {
  const steps = [
    { at: copy("pricing.months.day1.at"), what: copy("pricing.months.day1.what", { minutes: F.setupMinutes }), icon: Timer },
    { at: copy("pricing.months.day2.at"), what: copy("pricing.months.day2.what"), icon: CircleCheck },
    { at: copy("pricing.months.monday.at"), what: copy("pricing.months.monday.what"), icon: Inbox },
    ...([["found", Search], ["showing", Eye], ["top", TrendingUp]] as const).map(([step, icon]) => ({
      at: copy(`how.when.${step}.at`),
      what: copy(`how.when.${step}.what`),
      icon,
    })),
  ];
  return <WhatToExpect title={copy("pricing.months.title")} steps={steps} notes={false} />;
}

type Question = { q: CopyKey; a: CopyKey; icon: LucideIcon; vars?: Record<string, string | number> };

/** The questions asked before paying, in the landing's words. */
function questions(): readonly Question[] {
  const landing = (id: string, icon: LucideIcon, vars?: Question["vars"]): Question => ({
    q: `landing.faq.${id}.q` as CopyKey,
    a: `landing.faq.${id}.a` as CopyKey,
    icon,
    vars,
  });
  return [
    landing("trial", Gift, { price: price() }),
    landing("start", Plug, { minutes: F.setupMinutes }),
    landing("approve", Pen, { hours: F.windowHours }),
    landing("results", Clock4),
    { q: "landing.faq.stop.q", a: "landing.faq.stop.short", icon: CircleStop },
    landing("any", Store),
  ];
}

export default function PricingPage(props: {
  searchParams?: Promise<PricingSearchParams> | PricingSearchParams;
}): React.JSX.Element {
  // A refused purchase comes back with the marker, so the offer says so
  // instead of the route throwing.
  const refused = usePricingSearchParams(props.searchParams)[CHECKOUT_QUERY_KEY] === REFUSED_MARKER;

  return (
    <Surface
      arms={{
        compact: {
          kind: "declared",
          note: "full-width bands: the head and its price card, week 1, the comparison, the questions, the closing card; each capped at max-w-6xl",
        },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="flex flex-col">
        <section id="top" aria-labelledby="top-h" className="scroll-mt-16 py-12 lg:py-16">
          <div className={`${INNER} grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-12`}>
            <div className="flex min-w-0 flex-col gap-5">
              <p className="eyebrow">{copy("chrome.nav.pricing")}</p>
              <h1 id="top-h" className="t-hero">
                {copy("pricing.title")}
              </h1>
              <p className={LEAD}>{copy("pricing.subline", weekPages)}</p>
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <PricingCard startAction={startCheckout} terms="pricing" refused={refused} free={<FreeFirst />} />
              <NotDone />
            </div>
          </div>
        </section>

        <Section
          id="week1"
          band
          beside
          title={copy("pricing.first.title")}
          body={copy("pricing.first.body")}
        >
          <FromWeekOne />
        </Section>

        <Section id="compare" eyebrow={copy("pricing.compare.eyebrow")} title={copy("pricing.compare.title", { price: price() })}>
          <ThreeWays caption={copy("pricing.compare.limit")} />
        </Section>

        <Section id="before" title={copy("pricing.faq.title")}>
          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2 lg:gap-x-4">
            {questions().map((item, i, all) => (
              <details
                key={item.q}
                // An odd last question spans both columns, so the grid has no hole.
                className={`collapse collapse-arrow card-border bg-base-100 min-w-0 ${all.length % 2 === 1 && i === all.length - 1 ? "lg:col-span-2" : ""}`}
              >
                {/* 20px above and below a 24px line: each question is at least a 64px target. */}
                <summary className="collapse-title flex items-center gap-3 py-5 leading-6 font-semibold">
                  <span className="rounded-field bg-primary/10 text-primary grid size-9 shrink-0 place-items-center">
                    <item.icon size={20} strokeWidth={1.75} aria-hidden />
                  </span>
                  {copy(item.q)}
                </summary>
                <div className="collapse-content text-base-content/70 ps-16 text-sm">
                  <p>{copy(item.a, item.vars)}</p>
                </div>
              </details>
            ))}
          </div>
        </Section>

        <div className={`${INNER} pb-16`}>
          <section
            id={START_ID}
            aria-labelledby={`${START_ID}-h`}
            className="card card-border bg-primary/5 scroll-mt-16"
          >
            <div className="card-body items-center gap-4 px-5 py-10 text-center lg:px-10">
              {/* The tint over the light canvas sits under the eyebrow ink's 4.5:1, so this one is darker. */}
              <p className="eyebrow text-base-content/70!">{copy("pricing.plan.unsure")}</p>
              <h2 id={`${START_ID}-h`} className="m-0">
                {copy("pricing.close.title")}
              </h2>
              <div className="w-full max-w-xl text-left">
                <ScanForm words={scanFormWords(copy("landing.start.cta"))} />
              </div>
              <p className="text-base-content/70 text-sm">{copy("landing.close.assurance")}</p>
            </div>
          </section>
        </div>
      </main>
    </Surface>
  );
}
