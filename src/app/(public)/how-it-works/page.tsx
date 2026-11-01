// How the product works, in public (board *How it works*, decision
// 2026-10-20-1597). The head and its four-step strip, then ten sections, each
// with an outcome heading, a short body and one picture; six of them close
// with a *Show the detail* that holds the precise figures, where the board
// draws one. The pictures draw one example business, Harbor Plumbing.
//
// No figure is typed: every number is a slot filled from `_how/facts.ts` or
// the rules registry, and the example's own numbers come from
// `_how/specimen.ts`. It says once that pages are written with an AI model.
//
// A Server Component.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Check, FileText, MessageSquare, RefreshCw, Sparkles, TrendingUp, User, Wallet, X } from "lucide-react";
import { Surface } from "@/ui/layout";
import { HOSTED_RETENTION_DAYS } from "@/lib/config/constants";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { HARD_RULES } from "@/lib/generate/rules/types";
import { FIELD_SECTION_ID } from "../_landing/sections";
import { measuredCountryLists } from "@/lib/locale/locales";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";
import { startCheckout } from "../pricing/actions";
import { ScanForm } from "../_landing/ScanForm";
import { scanFormWords } from "../_landing/scan-form-words";
import { CHECK_LINES, CHECK_LINE_COPY, ENGINES_NAMED, HOW_FACTS as F, checksIn } from "../_how/facts";
import { EXAMPLES } from "../_how/specimen";
import { ThreeWays } from "../_how/compare";
import {
  AsWeRead,
  MondayEmail,
  PageWithSources,
  QuestionList,
  ReportGlance,
  TwoWeeks,
  WeekOfPages,
  WhatToExpect,
  WhatWeWorkToward,
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
/** The week a customer first sees the work: their first. */
const FIRST_WEEK = { week: 1 };
/** The one example business every picture draws. */
const EXAMPLE = EXAMPLES.plumber;

/** The four steps, each opening the section that tells it. */
const STEPS = [
  { n: 1, href: "#research", when: {}, icon: Building2 },
  { n: 2, href: "#questions", when: {}, icon: MessageSquare },
  { n: 3, href: "#pages", when: weekPages, icon: FileText },
  { n: 4, href: "#found", when: FIRST_WEEK, icon: TrendingUp },
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
  /** What the body promises, one line each, under it. */
  points?: readonly string[];
  detail?: React.ReactNode;
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
          {p.points === undefined ? null : (
            <ul className="flex flex-col gap-2">
              {p.points.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <Check {...ICON} className="text-success mt-1 shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          )}
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
          <p className={`${BODY} text-lg`}>{copy("how.lead")}</p>
          <ScanCta />
        </div>
        {TwoWeeks(EXAMPLE)}
      </div>
      <div className={`${INNER} mt-12`}>
        <h2 className="text-lg">{copy("how.steps.jump")}</h2>
        <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.n} className="min-w-0">
              <Link href={step.href} className="card card-border bg-base-100 h-full transition-transform hover:-translate-y-0.5">
                <span className="card-body gap-2">
                  <span className="flex items-center gap-2">
                    <span className="bg-primary text-primary-content grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold">
                      {step.n}
                    </span>
                    <span className="rounded-field bg-primary/10 text-primary grid size-8 shrink-0 place-items-center">
                      <step.icon {...ICON} />
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

const NOT_INCLUDED: readonly CopyKey[] = [
  "how.value.not.maps",
  "how.value.not.ads",
  "how.value.not.social",
  "how.value.not.perplexity",
  "how.value.not.sites",
  "how.value.not.promise",
];

/** The comparison both pages draw, then what the plan leaves out. */
function ValueFigure(): React.JSX.Element {
  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <ThreeWays />
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

/** The questions: the landing's full answers, word for word. */
function questions(): readonly Question[] {
  const landing = (id: string, vars?: Question["vars"]): Question => ({
    q: `landing.faq.${id}.q` as CopyKey,
    a: `landing.faq.${id}.a` as CopyKey,
    vars,
  });
  return [
    landing("spam"),
    landing("approve", { hours: F.windowHours }),
    landing("results"),
    landing("start", minutes),
    landing("stop", { days: String(HOSTED_RETENTION_DAYS) }),
    landing("any"),
    landing("german", measuredCountryLists()),
    landing("trial", { price: PRICE() }),
  ];
}

/** The AI sentence's slots: every number from the constants the weekly battery runs on. */
const aiSentenceSlots = (): Record<string, string | number> => ({
  engines: copy(ENGINES_NAMED),
  prompts: F.prompts,
  weeks: F.answerWeeks,
  answers: F.answers,
  unbranded: F.unbranded,
});

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
          points={[
            copy("how.research.bullet.voice"),
            copy("how.research.bullet.correct"),
            copy("how.research.bullet.fix", { minutes: F.fixMinutes }),
          ]}
          detail={
            <Detail>
              <p>{copy("how.research.detail.read", { rivals: F.rivals })}</p>
              <p>{copy("how.research.detail.blocked")}</p>
              <p>{copy("how.research.detail.held")}</p>
            </Detail>
          }
        >
          {AsWeRead(EXAMPLE)}
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
              <p>{copy("how.measure.ai", aiSentenceSlots())}</p>
              <p>{copy("how.measure.named")}</p>
              <p>
                <span className="text-base-content me-1 font-semibold">{copy("how.measure.limits")}</span>
                {`${copy("how.measure.limit.vary")} ${copy("how.measure.limit.perplexity")} ${copy("how.measure.limit.locale")}`}
              </p>
            </Detail>
          }
        >
          {WhoGetsThem(EXAMPLE)}
        </Section>

        <Section
          id="questions"
          band
          eyebrow={eyebrow(2)}
          title={copy("how.pick.title")}
          body={copy("how.pick.body")}
          detail={
            <Detail>
              <p>{copy("how.week.detail.plan", weekPages)}</p>
              <p>{copy("how.pick.detail.order", { newPages: F.newPages })}</p>
              <p>{copy("how.week.detail.fewer")}</p>
            </Detail>
          }
        >
          {QuestionList(EXAMPLE)}
        </Section>

        <Section id="pages" eyebrow={eyebrow(3)} title={copy("how.week.title")} body={copy("how.week.body", weekPages)} wide>
          {WeekOfPages(EXAMPLE)}
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
          points={[copy("how.true.bullet.facts"), copy("how.true.bullet.invented"), copy("how.true.bullet.held")]}
          detail={
            <Detail>
              <ChecksDetail />
            </Detail>
          }
        >
          {PageWithSources(EXAMPLE)}
          <p className={`${SMALL} inline-flex items-center gap-1.5`} data-testid={DISCLOSURE_TEST_ID}>
            <Sparkles size={16} strokeWidth={1.75} aria-hidden className="text-primary shrink-0" />
            {copy("how.disclosure")}
          </p>
        </Section>

        <Section
          id="found"
          eyebrow={eyebrow(4)}
          title={copy("how.found.title", FIRST_WEEK)}
          body={copy("how.found.body")}
          detail={
            <Detail>
              <p>
                {`${copy("how.monday.measure", { searches: F.searches })} ${copy("how.monday.mail", { weeks: F.answerWeeks })}`}
              </p>
              <p>{copy("how.monday.time")}</p>
            </Detail>
          }
        >
          <div className="grid min-w-0 grid-cols-1 items-start gap-4 md:grid-cols-2">
            {MondayEmail(EXAMPLE)}
            {WhatWeWorkToward(EXAMPLE)}
          </div>
          <WhatToExpect />
        </Section>

        <Section
          id="you-do"
          band
          eyebrow={copy("how.steps.part.more")}
          title={copy("how.part.title", minutes)}
          body={copy("how.part.body")}
          detail={
            <Detail>
              <p>
                {`${copy("how.control.window", { hours: F.windowHours, min: F.windowMinDays, max: F.windowMaxDays })} ${copy("how.control.act")}`}
              </p>
              <p>{copy("how.control.leave")}</p>
            </Detail>
          }
        >
          {YourPart(EXAMPLE)}
        </Section>

        <Section
          id="value"
          eyebrow={copy("how.value.eyebrow")}
          title={copy("how.value.title", { price: PRICE() })}
          body={copy("how.value.body")}
          wide
        >
          <ValueFigure />
          <div className="flex flex-wrap items-start gap-4">
            <ScanCta />
            <form action={startCheckout} data-testid={CHECKOUT_TEST_ID}>
              <button type="submit" className="btn btn-soft btn-primary">
                {copy("offer.start.priced")}
              </button>
            </form>
          </div>
        </Section>

        <Section id="faq" band eyebrow={copy("landing.faq.eyebrow")} title={copy("landing.faq.heading")} wide>
          <div className="grid min-w-0 grid-cols-1 items-start gap-2 lg:grid-cols-2">
            {questions().map((item) => (
              <details key={item.q} className="collapse collapse-arrow card-border bg-base-100 min-w-0">
                <summary className="collapse-title font-semibold">{copy(item.q)}</summary>
                <div className="collapse-content text-sm text-base-content/70">
                  <p data-disclosure={item.a === "landing.faq.spam.a" ? true : undefined}>{copy(item.a, item.vars)}</p>
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
          <div className="flex min-w-0 flex-col gap-2" data-testid={SCAN_TEST_ID}>
            <ScanForm words={scanFormWords(copy("landing.start.cta"))} />
            <p className="font-mono text-xs text-base-content/70">{copy("landing.hero.assurance")}</p>
          </div>
          {ReportGlance(EXAMPLE)}
        </Section>
      </main>
    </Surface>
  );
}
