// SPEC §1 (2026-10-10, issue 1396) — how the product works, in public.
// src/app/(public)/how-it-works/page.tsx
//
// Ten sections in the issue's order: what is measured, how the market and
// the rivals are found, how a page is chosen, what it is written from, the
// checks, links, the customer's control, Monday, what is never done, and
// two live examples. It says once that pages are written with an AI model.
//
// **No figure is typed.** Every number is a slot filled from `_how/facts.ts`,
// which reads the constants the product runs on; the two examples are read
// from stored rows (`_how/examples.ts`) and are not drawn where none is
// stored. The page states only what the product does today.
//
// The legal pages' shape: a contents list beside the reading measure, one
// card a section. A Server Component with no client code of its own.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Surface } from "@/ui/layout";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { OnThisPage } from "../_legal/LegalPage";
import { FIELD_SECTION_ID } from "../_landing/sections";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";
import { CHECK_LINES, CHECK_LINE_COPY, ENGINES_NAMED, HOW_FACTS as F, checksIn } from "../_how/facts";
import { readLiveExamples, type LiveExamples } from "../_how/examples";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.how);

// The examples are stored rows: a report removed a minute ago is not linked.
export const dynamic = "force-dynamic";

/** Attribute values, never sentences: the copy sweep reads a bare JSX
 *  attribute string as product voice. */
const CARD = "card bg-base-100 scroll-mt-24 shadow-(--shadow-card)";
const BODY = "card-body gap-3";
const LIST = "list-disc ps-6";
const NEW_TAB = { target: "_blank", rel: "noopener" } as const;
const PAGE_TEST_ID = "how-it-works";
/** The one sentence that names the model the pages are written with. */
const DISCLOSURE_TEST_ID = "how-disclosure";

type Line = readonly [CopyKey, Record<string, string | number>?];

interface Section {
  id: string;
  title: CopyKey;
  lines: readonly Line[];
  /** A titled list under the paragraphs. */
  list?: { title?: CopyKey; items: readonly CopyKey[] };
}

const MEASURE: Section = {
  id: "measure",
  title: "how.measure.title",
  lines: [
    ["how.measure.search", { searches: F.searches }],
    ["how.measure.ai", { engines: copy(ENGINES_NAMED), prompts: F.prompts, runs: F.runs }],
    ["how.measure.named"],
  ],
  list: {
    title: "how.measure.limits",
    items: ["how.measure.limit.vary", "how.measure.limit.perplexity", "how.measure.limit.locale"],
  },
};

const MARKET: Section = {
  id: "market",
  title: "how.market.title",
  lines: [
    ["how.market.terms", { terms: F.terms }],
    ["how.market.rivals", { rivals: F.rivals, held: F.rivalsHeld, volume: F.rivalVolume }],
    ["how.market.blocked"],
  ],
};

const CHOOSE: Section = {
  id: "choose",
  title: "how.choose.title",
  lines: [["how.choose.weigh"], ["how.choose.update"], ["how.choose.pace", { newPages: F.newPages }]],
};

const SOURCES: Section = {
  id: "sources",
  title: "how.sources.title",
  lines: [
    ["how.sources.site"],
    ["how.sources.market", { top: F.topResults, rivals: F.researchRivals }],
    ["how.sources.studies", { studies: F.studies, years: F.statisticYears }],
    ["how.sources.adds", { adds: F.adds, business: F.addsBusiness }],
  ],
};

const CONTROL: Section = {
  id: "control",
  title: "how.control.title",
  lines: [
    ["how.control.window", { hours: F.windowHours, min: F.windowMinDays, max: F.windowMaxDays }],
    ["how.control.act"],
  ],
};

const MONDAY: Section = {
  id: "monday",
  title: "how.monday.title",
  lines: [["how.monday.measure", { searches: F.searches, prompts: F.prompts }], ["how.monday.mail"]],
};

const NEVER: Section = {
  id: "never",
  title: "how.never.title",
  lines: [],
  list: { items: ["how.never.invent", "how.never.hide", "how.never.promise"] },
};

const CHECKS = { id: "checks", title: "how.checks.title" } as const;
const LINKS = { id: "links", title: "how.links.title" } as const;
const EXAMPLES = { id: "examples", title: "how.examples.title" } as const;

/** The page's sections in order, for the contents list. */
const ORDER = [MEASURE, MARKET, CHOOSE, SOURCES, CHECKS, LINKS, CONTROL, MONDAY, NEVER, EXAMPLES] as const;

function Card(p: { id: string; title: CopyKey; children: React.ReactNode }): React.JSX.Element {
  return (
    <section id={p.id} className={CARD}>
      <div className={BODY}>
        <h2>{copy(p.title)}</h2>
        {p.children}
      </div>
    </section>
  );
}

function Prose(p: { section: Section }): React.JSX.Element {
  const { section } = p;
  return (
    <Card id={section.id} title={section.title}>
      {section.lines.map(([key, vars]) => (
        <p key={key}>{copy(key, vars)}</p>
      ))}
      {section.list === undefined ? null : (
        <>
          {section.list.title === undefined ? null : <h3>{copy(section.list.title)}</h3>}
          <ul className={LIST}>
            {section.list.items.map((key) => (
              <li key={key}>{copy(key)}</li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/** The checks in plain words, each line with how many rules stand behind
 *  it. The counts add up to the figure the first sentence states. */
function Checks(): React.JSX.Element {
  return (
    <Card id={CHECKS.id} title={CHECKS.title}>
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
    </Card>
  );
}

/** The four things `src/lib/generate/links/` and `publish/links/` do. */
function Links(): React.JSX.Element {
  return (
    <Card id={LINKS.id} title={LINKS.title}>
      <p>{copy("how.links.live", { min: F.siteLinksMin, max: F.siteLinksMax, cluster: F.clusterLinks })}</p>
      <ul className={LIST}>
        <li>{copy("how.links.text")}</li>
        <li>{copy("how.links.check")}</li>
        <li>{copy("how.links.back", { back: F.backLinks })}</li>
      </ul>
    </Card>
  );
}

function Examples(p: { live: LiveExamples }): React.JSX.Element {
  const { report, page } = p.live;
  return (
    <Card id={EXAMPLES.id} title={EXAMPLES.title}>
      {report === null ? null : (
        <p className="flex flex-wrap gap-x-2">
          <span>{copy("how.examples.report")}</span>
          <Link href={`/scan/${report}`} className="link link-primary font-mono">
            {report}
          </Link>
        </p>
      )}
      {page === null ? null : (
        <p className="flex flex-wrap gap-x-2">
          <span>{copy("how.examples.page")}</span>
          <a href={page.url} className="link link-primary" {...NEW_TAB}>
            {page.title}
          </a>
        </p>
      )}
      <p>
        <Link href="/scans" className="link link-primary">
          {copy("how.examples.all")}
        </Link>
      </p>
    </Card>
  );
}

export default async function HowItWorksPage(): Promise<React.JSX.Element> {
  const live = await readLiveExamples();
  const headings = ORDER.map((section) => ({ id: section.id, text: copy(section.title) }));

  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main
        className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-4 px-4 py-12 lg:flex-row lg:items-start lg:gap-8"
        data-testid={PAGE_TEST_ID}
      >
        <OnThisPage headings={headings} />
        <article className="text-base-content/80 flex w-full min-w-0 max-w-(--w-read) flex-col gap-3 leading-relaxed">
          <span className="text-base-content/70 text-xs font-semibold tracking-wide uppercase">
            {copy("how.eyebrow")}
          </span>
          <h1>{copy("how.title")}</h1>
          <p className="text-lg">{copy("how.lead")}</p>
          <p data-testid={DISCLOSURE_TEST_ID}>{copy("how.disclosure")}</p>

          <div className="mt-3 flex flex-col gap-4">
            <Prose section={MEASURE} />
            <Prose section={MARKET} />
            <Prose section={CHOOSE} />
            <Prose section={SOURCES} />
            <Checks />
            <Links />
            <Prose section={CONTROL} />
            <Prose section={MONDAY} />
            <Prose section={NEVER} />
            <Examples live={live} />
          </div>

          <p className="mt-3">
            <Link href={`/#${FIELD_SECTION_ID}`} className="btn btn-primary">
              {copy("landing.start.cta")}
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
            </Link>
          </p>
        </article>
      </main>
    </Surface>
  );
}
