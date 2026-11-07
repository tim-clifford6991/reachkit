// How the product works, in public (board *How it works*, decision
// 2026-10-20-1597). The head and its four-step strip, then ten sections, each
// with an outcome heading, a short body and one picture, and nothing folded
// away but the questions. The pictures draw one example business, Tidyslot.
//
// No figure is typed: every number is a slot filled from `_how/facts.ts` or
// the rules registry, and the example's own numbers come from
// `_how/specimen.ts`. It says once that pages are written with an AI model.
//
// A Server Component.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, FileText, MessageSquare, RefreshCw, Sparkles, TrendingUp, X } from "lucide-react";
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
import { BUSINESS_KIND_NAMES } from "@/lib/market/kinds";
import { KIND_ICON, KIND_WORD } from "../scans/kinds";
import { HOW_FACTS as F } from "../_how/facts";
import { EXAMPLES } from "../_how/specimen";
import { ThreeWays } from "../_how/compare";
import { AsWeRead, PageWithSources, QuestionList, WeekOfPages, WhatToExpect, WhoGetsThem, YourPart } from "../_how/visuals";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.how);

/** Attribute values, never sentences: the copy sweep reads a bare JSX
 *  attribute string as product voice. */
const PAGE_TEST_ID = "how-it-works";
const DISCLOSURE_TEST_ID = "how-disclosure";
const SCAN_TEST_ID = "how-scan";
const CHECKOUT_TEST_ID = "how-checkout";
const SCAN_HREF = `/#${FIELD_SECTION_ID}`;
const KINDS_ID = "how-kinds";

const INNER = "mx-auto w-full max-w-6xl px-4";
const LABEL = "text-xs font-semibold uppercase tracking-wide text-primary";
const BODY = "text-base-content/70";
const SMALL = "text-base-content/70 text-sm";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

const PRICE = (): string => copy("price.amount");
const minutes = { minutes: F.setupMinutes };
const weekPages = { weekPages: F.weekPages };
/** The week a customer first sees the work: their first. */
const FIRST_WEEK = { week: 1 };
/** The one example business every picture draws. */
const EXAMPLE = EXAMPLES.software;

/** The four steps, each opening the section that tells it. */
const STEPS = [
  { n: 1, href: "#research", when: {}, icon: Building2 },
  { n: 2, href: "#questions", when: {}, icon: MessageSquare },
  { n: 3, href: "#pages", when: weekPages, icon: FileText },
  { n: 4, href: "#found", when: FIRST_WEEK, icon: TrendingUp },
] as const;

const stepKey = (n: number, part: "title" | "when"): CopyKey => `how.step.${n}.${part}` as CopyKey;
const eyebrow = (n: number): string => copy("how.step.eyebrow", { n, name: copy(stepKey(n, "title")) });

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

function Section(p: {
  id: string;
  eyebrow?: string;
  title: string;
  body?: string;
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
        </div>
        <div className="flex min-w-0 flex-col gap-4">{p.children}</div>
      </div>
    </section>
  );
}

function Head(): React.JSX.Element {
  return (
    <section id="top" aria-labelledby="top-h" className="scroll-mt-16 pt-12 pb-12 lg:pt-16">
      <div className={`${INNER} flex flex-col items-start gap-4`}>
        <p className={LABEL}>{copy("how.eyebrow")}</p>
        <h1 id="top-h" className="t-hero">
          {copy("how.headline")}
        </h1>
        <p className={`${BODY} max-w-2xl text-lg`}>{copy("how.lead")}</p>
        <ScanCta />
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
      <div className={`${INNER} mt-12`}>
        <h2 className="text-lg">{copy("how.steps.jump")}</h2>
        <ol className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.n} className="min-w-0">
              <Link href={step.href} className="card card-border bg-base-100 h-full transition-transform hover:-translate-y-0.5">
                <span className="card-body gap-2">
                  <span className="flex flex-wrap items-center gap-2 sm:grid sm:grid-cols-[auto_1fr]">
                    <span className="bg-primary text-primary-content grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold">
                      {step.n}
                    </span>
                    <span className="rounded-field bg-primary/10 text-primary grid size-8 shrink-0 place-items-center">
                      <step.icon {...ICON} />
                    </span>
                    <span className="badge badge-soft badge-primary badge-sm h-auto sm:col-span-2 sm:justify-self-start sm:whitespace-nowrap">
                      {copy(stepKey(step.n, "when"), step.when)}
                    </span>
                  </span>
                  <span className="text-base font-semibold">{copy(stepKey(step.n, "title"))}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="badge badge-ghost mt-4 h-auto gap-1 py-1 whitespace-normal">
          <RefreshCw size={14} strokeWidth={1.75} aria-hidden />
          {copy("how.steps.loop")}
        </p>
      </div>
    </section>
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
      <ThreeWays short />
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
    landing("stop", { days: String(HOSTED_RETENTION_DAYS) }),
    landing("any"),
    landing("german", measuredCountryLists()),
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

        <Section id="research" band eyebrow={eyebrow(1)} title={copy("how.research.title")} body={copy("how.research.body")}>
          {AsWeRead(EXAMPLE)}
        </Section>

        <Section id="competitors" title={copy("how.rivals.title")} body={copy("how.rivals.body")} wide>
          {WhoGetsThem(EXAMPLE)}
        </Section>

        <Section id="questions" band eyebrow={eyebrow(2)} title={copy("how.pick.title")} body={copy("how.pick.body")}>
          {QuestionList(EXAMPLE)}
        </Section>

        <Section id="pages" eyebrow={eyebrow(3)} title={copy("how.week.title")} body={copy("how.week.body", weekPages)} wide>
          {WeekOfPages(EXAMPLE)}
        </Section>

        <Section id="true" band title={copy("how.true.title")} body={copy("how.true.body", { checks: HARD_RULES.length })}>
          {PageWithSources(EXAMPLE)}
          <p className={`${SMALL} inline-flex items-center gap-1.5`} data-testid={DISCLOSURE_TEST_ID}>
            <Sparkles size={16} strokeWidth={1.75} aria-hidden className="text-primary shrink-0" />
            {copy("how.disclosure")}
          </p>
        </Section>

        <Section id="found" eyebrow={eyebrow(4)} title={copy("how.found.title", FIRST_WEEK)} body={copy("how.found.body")}>
          <WhatToExpect />
        </Section>

        <Section id="you-do" band title={copy("how.part.title", minutes)} body={copy("how.part.body")}>
          {YourPart(EXAMPLE)}
        </Section>

        <Section id="value" title={copy("how.value.title", { price: PRICE() })} body={copy("how.value.body")} wide>
          <ValueFigure />
          <form action={startCheckout} data-testid={CHECKOUT_TEST_ID}>
            <button type="submit" className="btn btn-primary">
              {copy("offer.start.priced")}
            </button>
          </form>
        </Section>

        <Section id="faq" band title={copy("landing.faq.heading")} wide>
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

        <Section id="start" title={copy("landing.close.heading")}>
          <div className="flex min-w-0 flex-col gap-2" data-testid={SCAN_TEST_ID}>
            <ScanForm words={scanFormWords(copy("landing.start.cta"))} />
            <p className="font-mono text-xs text-base-content/70">{copy("landing.hero.assurance")}</p>
          </div>
        </Section>
      </main>
    </Surface>
  );
}
