// How the product works, in public (board *How it works*, decision
// 2026-10-20-1597). The head and its four-step strip, then ten sections, each
// with an outcome heading, a short body, one picture and a closed *Show the
// detail* that holds the precise figures. The pictures draw an example
// business, a plumber or a software firm, picked by a switch.
//
// No figure is typed: every number is a slot filled from `_how/facts.ts` or
// the rules registry, and the example's own numbers come from
// `_how/specimen.ts`. It says once that pages are written with an AI model.
//
// A Server Component. `ExampleSwitch` is the one client leaf.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, RefreshCw, User, Wallet, X } from "lucide-react";
import { Surface } from "@/ui/layout";
import { HOSTED_RETENTION_DAYS } from "@/lib/config/constants";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { HARD_RULES } from "@/lib/generate/rules/types";
import { FIELD_SECTION_ID } from "../_landing/sections";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";
import { startCheckout } from "../pricing/actions";
import { CHECK_LINES, CHECK_LINE_COPY, ENGINES_NAMED, HOW_FACTS as F, checksIn } from "../_how/facts";
import { AGENCY_BENCHMARK } from "../_how/specimen";
import {
  AsWeRead,
  MondayEmail,
  PageWithSources,
  QuestionList,
  ReportGlance,
  Switched,
  TwoWeeks,
  WeekOfPages,
  WhatToExpect,
  WhoGetsThem,
  YourPart,
} from "../_how/visuals";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.how);

/** Attribute values, never sentences: the copy sweep reads a bare JSX
 *  attribute string as product voice. */
const PAGE_TEST_ID = "how-it-works";
const DISCLOSURE_TEST_ID = "how-disclosure";
const SCAN_TEST_ID = "how-scan";
const CHECKOUT_TEST_ID = "how-checkout";
const SCAN_HREF = `/#${FIELD_SECTION_ID}`;

const INNER = "mx-auto w-full max-w-6xl px-4";
const LABEL = "text-xs font-semibold uppercase tracking-wide text-primary";
const BODY = "text-base-content/70";
const SMALL = "text-base-content/70 text-sm";
const LIST = "list-disc ps-6";
const LINK = "link link-hover link-primary inline-flex items-center gap-1 text-sm font-semibold";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

const PRICE = (): string => copy("price.amount");
const minutes = { minutes: F.setupMinutes };
const weekPages = { weekPages: F.weekPages };

/** The four steps, each opening the section that tells it. */
const STEPS = [
  { n: 1, href: "#research", when: {} },
  { n: 2, href: "#questions", when: {} },
  { n: 3, href: "#pages", when: weekPages },
  { n: 4, href: "#found", when: {} },
] as const;

const stepKey = (n: number, part: "title" | "when" | "line"): CopyKey => `how.step.${n}.${part}` as CopyKey;
const eyebrow = (n: number): string => copy("how.step.eyebrow", { n, name: copy(stepKey(n, "title")) });

function More(p: { href: string; label: string }): React.JSX.Element {
  return (
    <Link href={p.href} className={LINK}>
      {p.label}
      <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
    </Link>
  );
}

/** The free scan. Its one field lives on the landing, so this goes there. */
function ScanCta(): React.JSX.Element {
  return (
    <div className="flex flex-col items-start gap-2">
      <Link href={SCAN_HREF} className="btn btn-primary" data-testid={SCAN_TEST_ID}>
        {copy("landing.start.cta")}
        <ArrowRight {...ICON} />
      </Link>
      <p className="font-mono text-xs text-base-content/70">{copy("landing.hero.assurance")}</p>
    </div>
  );
}

function Detail(p: { children: React.ReactNode }): React.JSX.Element {
  return (
    <details className="collapse collapse-arrow card-border bg-base-100 min-w-0">
      <summary className="collapse-title text-sm font-semibold">{copy("how.detail")}</summary>
      <div className="collapse-content flex min-w-0 flex-col gap-3 text-sm text-base-content/70">{p.children}</div>
    </details>
  );
}

function Section(p: {
  id: string;
  eyebrow?: string;
  title: string;
  body?: string;
  detail: React.ReactNode;
  /** The picture under the text, full width, rather than beside it. */
  wide?: boolean;
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
      <div className={`${INNER} grid grid-cols-1 items-start gap-8 ${p.wide === true ? "" : "lg:grid-cols-[5fr_7fr] lg:gap-12"}`}>
        <div className="flex min-w-0 flex-col gap-4">
          <div>
            {p.eyebrow === undefined ? null : <p className={LABEL}>{p.eyebrow}</p>}
            <h2 id={heading} className="mt-2">
              {p.title}
            </h2>
          </div>
          {p.body === undefined ? null : <p className={`${BODY} max-w-2xl`}>{p.body}</p>}
          {p.wide === true ? null : p.detail}
        </div>
        <div className="flex min-w-0 flex-col gap-4">{p.children}</div>
        {p.wide === true ? p.detail : null}
      </div>
    </section>
  );
}

function Head(): React.JSX.Element {
  return (
    <section id="top" aria-labelledby="top-h" className="scroll-mt-16 pt-12 pb-12 lg:pt-16">
      <div className={`${INNER} grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-12`}>
        <div className="flex min-w-0 flex-col items-start gap-4">
          <p className={LABEL}>{copy("how.eyebrow")}</p>
          <h1 id="top-h" className="t-hero">
            {copy("how.headline")}
          </h1>
          <p className={`${BODY} text-lg`}>{copy("how.lead", minutes)}</p>
          <ScanCta />
          <Detail>
            <dl className="flex flex-col gap-3">
              {(["does", "how", "you", "get"] as const).map((ask) => (
                <div key={ask}>
                  <dt className="text-base-content font-semibold">{copy(`how.ask.${ask}.q` as CopyKey)}</dt>
                  <dd>{copy(`how.ask.${ask}.a` as CopyKey, { ...minutes, ...weekPages, price: PRICE() })}</dd>
                </div>
              ))}
            </dl>
          </Detail>
        </div>
        <Switched draw={TwoWeeks} />
      </div>
      <div className={`${INNER} mt-12`}>
        <h2 className="text-lg">{copy("how.steps.title")}</h2>
        <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.n} className="min-w-0">
              <Link href={step.href} className="card card-border bg-base-100 h-full transition-transform hover:-translate-y-0.5">
                <span className="card-body gap-2">
                  <span className="flex items-center gap-2">
                    <span className="bg-primary text-primary-content grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold">
                      {step.n}
                    </span>
                    <span className="badge badge-soft badge-primary badge-sm h-auto whitespace-normal">
                      {copy(stepKey(step.n, "when"), step.when)}
                    </span>
                  </span>
                  <span className="text-base font-semibold">{copy(stepKey(step.n, "title"))}</span>
                  <span className={SMALL}>{copy(stepKey(step.n, "line"))}</span>
                  <span className="text-primary mt-auto inline-flex items-center gap-1 text-sm font-semibold">
                    {copy("how.step.more")}
                    <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="badge badge-ghost mt-4 h-auto gap-1 py-1 whitespace-normal">
          <RefreshCw size={14} strokeWidth={1.75} aria-hidden />
          {copy("how.steps.loop")}
        </p>
        <div className="rounded-box bg-base-200 mt-4 flex flex-wrap gap-x-8 gap-y-2 p-4 text-sm">
          <span className="flex flex-wrap items-center gap-2">
            <User {...ICON} />
            {copy("how.steps.part", minutes)}
            <More href="#you-do" label={copy("how.steps.part.more")} />
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <Wallet {...ICON} />
            {copy("how.steps.value", { price: PRICE() })}
            <More href="#value" label={copy("how.steps.value.more")} />
          </span>
        </div>
      </div>
    </section>
  );
}

function ChecksDetail(): React.JSX.Element {
  return (
    <>
      <p>{copy("how.sources.site")}</p>
      <p>{copy("how.sources.market", { top: F.topResults, rivals: F.researchRivals })}</p>
      <p>{copy("how.sources.studies", { studies: F.studies, years: F.statisticYears })}</p>
      <p>{copy("how.sources.adds", { adds: F.adds, business: F.addsBusiness })}</p>
      <p>{copy("how.checks.count", { checks: F.checks, coded: F.checksCoded })}</p>
      <ul className="divide-base-300 flex flex-col divide-y">
        {CHECK_LINES.map((line) => {
          const count = checksIn(line);
          return (
            <li key={line} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0">{copy(CHECK_LINE_COPY[line])}</span>
              <span className="badge badge-soft badge-sm">
                {copy(count === 1 ? "how.checks.group.count.one" : "how.checks.group.count", { count })}
              </span>
            </li>
          );
        })}
      </ul>
      <p>{copy("how.checks.judged")}</p>
      <p>{copy("how.checks.fix")}</p>
      <p>{copy("how.links.live", { min: F.siteLinksMin, max: F.siteLinksMax, cluster: F.clusterLinks })}</p>
      <ul className={LIST}>
        <li>{copy("how.links.text")}</li>
        <li>{copy("how.links.check")}</li>
        <li>{copy("how.links.back", { back: F.backLinks })}</li>
      </ul>
    </>
  );
}

/** The three ways to get found, each in the same four rows. */
const WAYS = [
  { name: "how.value.diy", jobs: "how.value.diy.jobs", time: "how.value.diy.time", covers: "how.value.diy.covers", cost: "how.value.diy.cost" },
  { name: "how.value.agency", jobs: "how.value.agency.jobs", time: "how.value.agency.time", covers: "how.value.agency.covers", cost: "how.value.agency.cost" },
  { name: "chrome.wordmark", jobs: "how.value.ours.jobs", time: "how.value.ours.time", covers: "how.value.ours.covers", cost: "how.value.ours.cost" },
] as const satisfies readonly Record<string, CopyKey>[];

const ROWS = ["jobs", "time", "covers", "cost"] as const;

const NOT_INCLUDED: readonly CopyKey[] = [
  "how.value.not.maps",
  "how.value.not.ads",
  "how.value.not.social",
  "how.value.not.perplexity",
  "how.value.not.sites",
  "how.value.not.promise",
];

function ThreeWays(): React.JSX.Element {
  const vars = { ...minutes, price: PRICE(), fee: AGENCY_BENCHMARK.fee };
  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
        {WAYS.map((way) => (
          <div
            key={way.name}
            className={`card bg-base-100 min-w-0 border ${way.name === "chrome.wordmark" ? "border-primary" : "border-base-300"}`}
          >
            <div className="card-body gap-3">
              <h3 className="card-title text-base">{copy(way.name)}</h3>
              <dl className="flex flex-col gap-3">
                {ROWS.map((row) => (
                  <div key={row}>
                    <dt className="text-base-content/70 text-xs">{copy(`how.value.${row}` as CopyKey)}</dt>
                    <dd className={`text-sm ${row === "cost" ? "font-semibold" : ""}`}>{copy(way[row], vars)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        ))}
      </div>
      <figcaption className="text-base-content/70 text-xs">
        <a href={AGENCY_BENCHMARK.url} className="link" target="_blank" rel="noopener">
          {copy("how.value.source", { providers: AGENCY_BENCHMARK.providers, year: AGENCY_BENCHMARK.year })}
        </a>
      </figcaption>
      <div className="rounded-box bg-base-200 flex flex-col gap-2 p-4">
        <p className="text-sm font-semibold">{copy("how.value.not")}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {NOT_INCLUDED.map((key) => (
            <li key={key} className="flex items-center gap-1">
              <X size={14} strokeWidth={1.75} aria-hidden />
              {copy(key)}
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

type Question = { q: CopyKey; a: CopyKey; vars?: Record<string, string | number> };

/** The questions: the landing's answers word for word, plus software. */
function questions(): readonly Question[] {
  const landing = (id: string, vars?: Question["vars"]): Question => ({
    q: `landing.faq.${id}.q` as CopyKey,
    a: `landing.faq.${id}.a` as CopyKey,
    vars,
  });
  return [
    landing("spam", { checks: F.checks, ...weekPages }),
    landing("approve", { hours: F.windowHours, min: F.windowMinDays, max: F.windowMaxDays }),
    landing("results"),
    landing("start"),
    landing("stop", { days: String(HOSTED_RETENTION_DAYS) }),
    landing("local", weekPages),
    { q: "how.faq.software.q", a: "how.faq.software.a" },
    landing("german"),
    landing("trial", { price: PRICE() }),
  ];
}

export default function HowItWorksPage(): React.JSX.Element {
  return (
    <Surface
      arms={{
        compact: {
          kind: "declared",
          note: "full-width bands: the head and its four steps, then ten sections, each one column of text then its picture",
        },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="flex flex-col" data-testid={PAGE_TEST_ID}>
        <Head />

        <Section
          id="research"
          band
          eyebrow={eyebrow(1)}
          title={copy("how.research.title")}
          body={copy("how.research.body")}
          detail={
            <Detail>
              <p>{copy("how.research.detail.read", { rivals: F.rivals })}</p>
              <p>{copy("how.research.detail.blocked")}</p>
              <p>{copy("how.research.detail.held")}</p>
            </Detail>
          }
        >
          <Switched draw={AsWeRead} />
        </Section>

        <Section
          id="competitors"
          eyebrow={eyebrow(1)}
          title={copy("how.rivals.title")}
          body={copy("how.rivals.body", { rivals: F.rivals })}
          wide
          detail={
            <Detail>
              <p>{copy("how.measure.search", { searches: F.searches })}</p>
              <p>{copy("how.measure.ai", { engines: copy(ENGINES_NAMED), prompts: F.prompts, weeks: F.answerWeeks })}</p>
              <p>{copy("how.measure.named")}</p>
              <p className="text-base-content font-semibold">{copy("how.measure.limits")}</p>
              <ul className={LIST}>
                <li>{copy("how.measure.limit.vary")}</li>
                <li>{copy("how.measure.limit.perplexity")}</li>
                <li>{copy("how.measure.limit.locale")}</li>
              </ul>
            </Detail>
          }
        >
          <Switched draw={WhoGetsThem} />
        </Section>

        <Section
          id="questions"
          band
          eyebrow={eyebrow(2)}
          title={copy("how.pick.title")}
          body={copy("how.pick.body")}
          detail={
            <Detail>
              <p>{copy("how.choose.weigh")}</p>
              <p>{copy("how.choose.update")}</p>
            </Detail>
          }
        >
          <Switched draw={QuestionList} />
        </Section>

        <Section
          id="pages"
          eyebrow={eyebrow(3)}
          title={copy("how.week.title")}
          body={copy("how.week.body", weekPages)}
          wide
          detail={
            <Detail>
              <p>{copy("how.week.detail.plan", { ...weekPages, newPages: F.newPages })}</p>
              <p>{copy("how.week.detail.fewer")}</p>
            </Detail>
          }
        >
          <Switched draw={WeekOfPages} />
          <div className="rounded-box bg-primary/5 flex flex-col items-start gap-3 p-6 lg:flex-row lg:items-center lg:justify-between">
            <p className="font-semibold">{copy("how.week.cta")}</p>
            <ScanCta />
          </div>
        </Section>

        <Section
          id="true"
          band
          eyebrow={eyebrow(3)}
          title={copy("how.true.title")}
          body={copy("how.true.body", { checks: HARD_RULES.length })}
          detail={
            <Detail>
              <ChecksDetail />
            </Detail>
          }
        >
          <Switched draw={PageWithSources} />
          <p className={SMALL} data-testid={DISCLOSURE_TEST_ID}>
            {copy("how.disclosure")}
          </p>
        </Section>

        <Section
          id="found"
          eyebrow={eyebrow(4)}
          title={copy("how.found.title")}
          body={copy("how.found.body")}
          detail={
            <Detail>
              <p>{copy("how.monday.measure", { searches: F.searches, prompts: F.prompts })}</p>
              <p>{copy("how.monday.mail")}</p>
              <p>{copy("how.monday.time")}</p>
            </Detail>
          }
        >
          <div className="grid min-w-0 grid-cols-1 items-start gap-4 md:grid-cols-2">
            <Switched draw={MondayEmail} />
            <WhatToExpect />
          </div>
        </Section>

        <Section
          id="you-do"
          band
          eyebrow={copy("how.steps.part.more")}
          title={copy("how.part.title", minutes)}
          body={copy("how.part.body")}
          detail={
            <Detail>
              <p>{copy("how.control.window", { hours: F.windowHours, min: F.windowMinDays, max: F.windowMaxDays })}</p>
              <p>{copy("how.control.act")}</p>
              <p>{copy("how.control.leave")}</p>
            </Detail>
          }
        >
          <Switched draw={YourPart} />
        </Section>

        <Section
          id="value"
          eyebrow={copy("how.steps.value.more")}
          title={copy("how.value.title", { price: PRICE() })}
          body={copy("how.value.body", weekPages)}
          wide
          detail={
            <Detail>
              <p className="text-base-content font-semibold">{copy("how.never.title")}</p>
              <ul className={LIST}>
                <li>{copy("how.never.invent")}</li>
                <li>{copy("how.never.hide")}</li>
                <li>{copy("how.never.promise")}</li>
              </ul>
            </Detail>
          }
        >
          <ThreeWays />
          <div className="flex flex-wrap items-start gap-4">
            <ScanCta />
            <form action={startCheckout} data-testid={CHECKOUT_TEST_ID}>
              <button type="submit" className="btn btn-soft btn-primary">
                {copy("offer.start.priced")}
              </button>
            </form>
          </div>
        </Section>

        <Section
          id="faq"
          band
          eyebrow={copy("landing.faq.eyebrow")}
          title={copy("landing.faq.heading")}
          wide
          detail={
            <Detail>
              <p>{copy("how.faq.more")}</p>
            </Detail>
          }
        >
          <div className="grid min-w-0 grid-cols-1 items-start gap-2 lg:grid-cols-2">
            {questions().map((item) => (
              <details key={item.q} className="collapse collapse-arrow card-border bg-base-100 min-w-0">
                <summary className="collapse-title font-semibold">{copy(item.q)}</summary>
                <div className="collapse-content text-sm text-base-content/70">
                  <p>{copy(item.a, item.vars)}</p>
                </div>
              </details>
            ))}
          </div>
        </Section>

        <Section
          id="start"
          title={copy("landing.close.heading")}
          body={copy("how.start.body")}
          detail={
            <Detail>
              <p>
                <Link href="/scans" className="link link-primary">
                  {copy("how.start.all")}
                </Link>
              </p>
            </Detail>
          }
        >
          <Switched draw={ReportGlance} />
          <ScanCta />
        </Section>
      </main>
    </Surface>
  );
}
