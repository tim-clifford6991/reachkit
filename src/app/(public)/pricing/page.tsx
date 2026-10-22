// src/app/(public)/pricing/page.tsx — BUILD §4.1 module 6, REQ-021 c4/c5 (issue #19)
//
// The one price surface away from any report (board Pricing): the plan and
// what €49 buys, one example week, everything in the plan, what to expect
// from week 1, the comparison with the other ways, the questions asked before
// paying, and the free scan for anyone not ready yet.
//
// The offer is `PricingCard`, the report's own component in its `pricing`
// wording, so the two surfaces state the same price and one Start (REQ-021
// c4). Its control begins a scanless checkout and nothing is asked before it.
// The scan field at the foot is the landing's own form, a second path that
// asks for a website and never for an account.
//
// No figure is typed: counts come from `_how/facts.ts` and the constants, the
// example week from `_how/specimen.ts`. The 14-day guarantee and its rows wait
// for the launch gate (owner 2026-10-20, Q13).
import React, { use } from "react";
import type { Metadata } from "next";
import { Check, CircleCheck, CircleStop, Clock, Mail, Pencil, X } from "lucide-react";
import { Surface } from "@/ui/layout";
import { HOSTED_RETENTION_DAYS, REFUND_WINDOW_DAYS, VETO, WEEK_PLAN } from "@/lib/config/constants";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PricingCard } from "../scan/[domain]/_modules/pricing";
import { ScanForm } from "../_landing/ScanForm";
import { scanFormWords } from "../_landing/scan-form-words";
import { HOW_FACTS as F } from "../_how/facts";
import { EXAMPLES, weekSpan } from "../_how/specimen";
import { WeekCard, WhatToExpect } from "../_how/visuals";
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
const SMALL = "text-base-content/70 text-sm";
const CARD = "card card-border bg-base-100 min-w-0";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

const price = (): string => copy("price.amount");
const weekPages = { weekPages: WEEK_PLAN.days };

/** One section: its eyebrow, its title and lead, then what it shows. */
function Section(p: {
  id: string;
  eyebrow: string;
  title: string;
  body?: string;
  band?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const heading = `${p.id}-h`;
  return (
    <section
      id={p.id}
      aria-labelledby={heading}
      className={`border-base-300 scroll-mt-16 border-t py-12 lg:py-20 ${p.band === true ? "bg-base-100" : ""}`}
    >
      <div className={`${INNER} flex flex-col gap-8`}>
        <div className="flex flex-col gap-3">
          <p className="eyebrow">{p.eyebrow}</p>
          <h2 id={heading}>{p.title}</h2>
          {p.body === undefined ? null : <p className={LEAD}>{p.body}</p>}
        </div>
        {p.children}
      </div>
    </section>
  );
}

/** What €49 a month buys, as four figures. */
function Buys(): React.JSX.Element {
  const tiles = [
    [copy("pricing.buys.pages", weekPages), copy("pricing.buys.pages.what")],
    [copy("pricing.buys.rivals", { rivals: F.rivals }), copy("pricing.buys.rivals.what")],
    [copy("pricing.buys.mail"), copy("pricing.buys.mail.what")],
    [copy("pricing.buys.time", { minutes: F.setupMinutes }), copy("pricing.buys.time.what")],
  ] as const;
  const label = copy("pricing.buys", { price: price() });
  return (
    <div className="flex flex-col gap-3">
      <p className="eyebrow">{label}</p>
      <ul aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([value, what]) => (
          <li key={value} className={`${CARD} gap-1 p-4`}>
            <span className="num text-xl font-bold">{value}</span>
            <span className={SMALL}>{what}</span>
          </li>
        ))}
      </ul>
      <p className={`${SMALL} flex flex-wrap gap-x-4 gap-y-1`}>
        {(["pricing.chip.contract", "pricing.chip.setup", "pricing.chip.cancel"] as const).map((key) => (
          <span key={key} className="flex items-center gap-1">
            <Check {...ICON} className="text-success" />
            {copy(key)}
          </span>
        ))}
      </p>
    </div>
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

/** The three cards under the example week: where a page goes, the email
 *  before it, and the Monday email. */
function WeekParts(): React.JSX.Element {
  const e = EXAMPLES.plumber;
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
      <div className={CARD}>
        <div className="card-body gap-3">
          <p className="flex items-center gap-2 font-semibold">
            <CircleCheck {...ICON} className="text-success" />
            {copy("pricing.week.address")}
          </p>
          <p className="rounded-box bg-base-200 min-w-0 px-3 py-2 font-mono text-sm break-all">{`${e.blog}${e.pagePath}`}</p>
          <p className={SMALL}>{copy("pricing.week.address.line")}</p>
        </div>
      </div>
      <div className={CARD}>
        <div className="card-body gap-3">
          <p className="flex items-center gap-2 font-semibold">
            <Mail {...ICON} className="text-primary" />
            {copy("pricing.week.emailed")}
          </p>
          <span className="flex flex-wrap gap-1">
            <span className="badge badge-ghost badge-sm gap-1">
              <Pencil size={12} strokeWidth={1.75} aria-hidden />
              {copy("how.week.edit")}
            </span>
            <span className="badge badge-ghost badge-sm gap-1">
              <CircleStop size={12} strokeWidth={1.75} aria-hidden />
              {copy("how.week.stop")}
            </span>
          </span>
          <p className={SMALL}>{copy("how.part.window", { hours: VETO.defaultHours })}</p>
        </div>
      </div>
      <div className={CARD}>
        <div className="card-body gap-3">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <Mail {...ICON} className="text-primary" />
            {copy("pricing.week.mail")}
            <span className={`num ${SMALL} font-normal`}>{weekSpan().monday}</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              copy("how.mail.live", { n: e.mail.live }),
              copy("pricing.week.mail.climbing", { n: e.mail.climbing }),
              copy("how.mail.planned", { n: e.mail.planned }),
            ].map((line) => (
              <p key={line} className="rounded-box bg-base-200 p-2 text-xs">
                {line}
              </p>
            ))}
          </div>
          <p className="text-success flex items-center gap-1 text-sm font-semibold">
            <Check {...ICON} />
            {copy("pricing.week.mail.calm")}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Everything in the plan, each with how often it runs. */
const INCLUDED = [
  { key: "research", vars: {} },
  { key: "rivals", vars: { rivals: F.rivals } },
  { key: "asks", vars: { searches: F.searches, prompts: F.prompts } },
  { key: "pages", vars: weekPages },
  { key: "checks", vars: { checks: F.checks } },
  { key: "live", vars: {} },
  { key: "stop", vars: {} },
  { key: "mail", vars: {} },
  { key: "fix", vars: {} },
  { key: "language", vars: {} },
  { key: "yours", vars: {} },
] as const;

const NOT_DONE: readonly CopyKey[] = [
  "pricing.all.not.maps",
  "how.value.not.ads",
  "how.value.not.social",
  "how.value.not.perplexity",
  "how.value.not.sites",
  "how.value.not.promise",
];

function Included(): React.JSX.Element {
  return (
    <>
      <ul className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INCLUDED.map(({ key, vars }) => (
          <li key={key} className={`${CARD} gap-2 p-5`}>
            <span className="badge badge-soft badge-primary badge-sm">{copy(`pricing.all.${key}.when` as CopyKey)}</span>
            <h3 className="text-base font-semibold">{copy(`pricing.all.${key}` as CopyKey, vars)}</h3>
            <p className={SMALL}>{copy(`pricing.all.${key}.line` as CopyKey, vars)}</p>
          </li>
        ))}
      </ul>
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
    </>
  );
}

const FROM_WEEK_ONE: readonly CopyKey[] = [
  "pricing.first.plan",
  "pricing.first.live",
  "pricing.first.google",
  "pricing.first.ai",
];

function FromWeekOne(): React.JSX.Element {
  const steps = [
    { at: copy("pricing.months.day1.at"), what: copy("pricing.months.day1.what", { minutes: F.setupMinutes }) },
    { at: copy("pricing.months.day2.at"), what: copy("pricing.months.day2.what") },
    { at: copy("pricing.months.monday.at"), what: copy("pricing.months.monday.what") },
    ...(["found", "showing", "top"] as const).map((step) => ({
      at: copy(`how.when.${step}.at`),
      what: copy(`how.when.${step}.what`),
    })),
  ];
  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {FROM_WEEK_ONE.map((key) => (
            <li key={key} className="flex items-start gap-2">
              <Check {...ICON} className="text-success mt-1 shrink-0" />
              <span>{copy(key)}</span>
            </li>
          ))}
        </ul>
        <div className="rounded-box bg-base-200 flex items-start gap-3 p-4">
          <Clock {...ICON} className="mt-1 shrink-0" />
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">{copy("pricing.first.longer")}</h3>
            <p className="text-sm">{copy("pricing.first.longer.line")}</p>
          </div>
        </div>
      </div>
      <WhatToExpect title={copy("pricing.months.title")} steps={steps} maps={false} />
    </div>
  );
}

type Question = { q: CopyKey; a: CopyKey; vars?: Record<string, string | number> };

/** The questions asked before paying, the landing's answers where they are the same. */
function questions(): readonly Question[] {
  const landing = (id: string, vars?: Question["vars"]): Question => ({
    q: `landing.faq.${id}.q` as CopyKey,
    a: `landing.faq.${id}.a` as CopyKey,
    vars,
  });
  return [
    { q: "pricing.faq.pay.q", a: "pricing.faq.pay.a", vars: { price: price() } },
    landing("trial", { price: price() }),
    landing("start"),
    landing("approve", { hours: F.windowHours, min: F.windowMinDays, max: F.windowMaxDays }),
    landing("results"),
    landing("stop", { refundDays: String(REFUND_WINDOW_DAYS), days: String(HOSTED_RETENTION_DAYS) }),
    landing("local", weekPages),
    { q: "how.faq.software.q", a: "how.faq.software.a" },
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
        compact: { kind: "columns", count: 1 },
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
              <Buys />
            </div>
            <div className="min-w-0">
              <PricingCard startAction={startCheckout} terms="pricing" refused={refused} free={<FreeFirst />} />
            </div>
          </div>
        </section>

        <Section
          id="week"
          band
          eyebrow={copy("pricing.week.eyebrow")}
          title={copy("pricing.week.title", { price: price() })}
          body={copy("pricing.week.body", weekPages)}
        >
          {WeekCard(
            EXAMPLES.plumber,
            <p className={SMALL}>{copy("pricing.week.caption", { week: EXAMPLES.plumber.mail.week, ...weekPages })}</p>
          )}
          <WeekParts />
        </Section>

        <Section
          id="included"
          eyebrow={copy("pricing.all.eyebrow")}
          title={copy("pricing.all.title", { price: price() })}
          body={copy("pricing.all.body")}
        >
          <Included />
        </Section>

        <Section
          id="week1"
          band
          eyebrow={copy("pricing.first.eyebrow")}
          title={copy("pricing.first.title")}
          body={copy("pricing.first.body")}
        >
          <FromWeekOne />
        </Section>

        <Section
          id="compare"
          eyebrow={copy("pricing.compare.eyebrow")}
          title={copy("pricing.compare.title", { price: price() })}
          body={copy("pricing.compare.body")}
        >
          <ThreeWays />
          <p className={SMALL}>{copy("pricing.compare.limit")}</p>
        </Section>

        <Section id="before" band eyebrow={copy("landing.faq.eyebrow")} title={copy("pricing.faq.title")}>
          <div className="flex flex-col gap-2">
            {questions().map((item) => (
              <details key={item.q} className="collapse collapse-arrow card-border bg-base-100 min-w-0">
                <summary className="collapse-title font-semibold">{copy(item.q)}</summary>
                <div className="collapse-content text-base-content/70 text-sm">
                  <p>{copy(item.a, item.vars)}</p>
                </div>
              </details>
            ))}
          </div>
        </Section>

        <section id={START_ID} aria-labelledby={`${START_ID}-h`} className="border-base-300 scroll-mt-16 border-t py-12 lg:py-20">
          <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4">
            <div className="flex flex-col gap-3">
              <p className="eyebrow">{copy("pricing.plan.unsure")}</p>
              <h2 id={`${START_ID}-h`}>{copy("pricing.close.title")}</h2>
            </div>
            <p className="text-base-content/70">{copy("pricing.close.body")}</p>
            <ScanForm words={scanFormWords(copy("landing.start.cta"))} />
            <p className={SMALL}>{copy("landing.close.assurance")}</p>
          </div>
        </section>

        <p className="text-base-content/70 mx-auto max-w-xl px-4 pb-12 text-center text-sm">{copy("pricing.footnote")}</p>
      </main>
    </Surface>
  );
}
