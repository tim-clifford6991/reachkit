// Issue 1458 — the frame every library page shares: the about page's
// reading column, the closing block, and the sources line. daisyUI
// classes in place, no wrapper of a daisyUI part.
import type React from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import { Surface } from "@/ui/layout";
import { SITE_PROFILE } from "@/lib/config/constants";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { parseDomain } from "@/lib/scan/domain";
import { ScanForm } from "../_landing/ScanForm";
import { scanFormWords } from "../_landing/scan-form-words";
import { HOW_FACTS } from "../_how/facts";
import { EXAMPLES } from "../_how/specimen";
import { ReportGlance } from "../_how/visuals";
import { longDate, type Source } from ".";

/** Attribute values, never sentences (the copy sweep). */
export const CARD = "card bg-base-100 shadow-(--shadow-card)";
export const BODY = "card-body gap-3";
export const LIST = "list-disc ps-6";
const NEW_TAB = { target: "_blank", rel: "noopener" } as const;
const HOW_HREF = "/how-it-works";
const START_ID = "start";

/** The page: an eyebrow, the heading, and the column under it. */
export function LibraryPage(p: {
  testId: string;
  eyebrow: CopyKey;
  /** Where the page sits, drawn in place of the eyebrow. */
  trail?: React.ReactNode;
  title: string;
  /** Wide pages (an index) use the about page's outer measure. */
  wide?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-col px-4 py-12" data-testid={p.testId}>
        <article
          className={`text-base-content/80 mx-auto flex w-full min-w-0 flex-col gap-3 leading-relaxed ${p.wide === true ? "" : "max-w-(--w-read)"}`}
        >
          {p.trail ?? (
            <span className="text-base-content/70 text-xs font-semibold tracking-wide uppercase">
              {copy(p.eyebrow)}
            </span>
          )}
          <h1 className="break-words">{p.title}</h1>
          <div className="mt-3 flex min-w-0 flex-col gap-4">{p.children}</div>
        </article>
      </main>
    </Surface>
  );
}

/** One titled card of paragraphs. */
export function TextCard(p: { heading: string; paragraphs: readonly string[] }): React.JSX.Element {
  return (
    <section className={CARD}>
      <div className={BODY}>
        <h2>{p.heading}</h2>
        {p.paragraphs.map((text) => (
          <p key={text}>{text}</p>
        ))}
      </div>
    </section>
  );
}

type Row = readonly [CopyKey, CopyKey];

/** The two-column section above the loop: what this page gives, beside what ReachKit gives your site. */
interface Weekly {
  readonly eyebrow: CopyKey;
  readonly title: CopyKey;
  readonly lead: CopyKey;
  readonly them: CopyKey;
  readonly us: CopyKey;
  readonly rows: readonly Row[];
}

interface Close {
  readonly weekly?: Weekly;
  readonly heading?: CopyKey;
  readonly lead: CopyKey;
  /** About ends on the field and a link to How it works, without the report card. */
  readonly glance: boolean;
}

const TEARDOWN_ROW_1: Row = ["library.close.teardown.1.them", "library.close.teardown.1.us"];
const TEARDOWN_ROW_3: Row = ["library.close.teardown.3.them", "library.close.teardown.3.us"];
const TOOL_WEEKLY = {
  eyebrow: "library.close.tools.eyebrow",
  title: "library.close.tools.title",
  them: "library.close.tool.them",
  us: "library.close.weekly",
} as const;

const CLOSE = {
  about: { lead: "library.close.about.lead", glance: false },
  compare: {
    weekly: {
      eyebrow: "library.close.compare.eyebrow",
      title: "library.close.compare.title",
      lead: "library.close.compare.lead",
      them: "library.close.compare.them",
      us: "library.close.compare.us",
      rows: [
        ["library.close.compare.1.them", "library.close.compare.1.us"],
        ["library.close.compare.2.them", "library.close.compare.2.us"],
        ["library.close.compare.3.them", "library.close.compare.3.us"],
        ["library.close.compare.4.them", "library.close.compare.4.us"],
        ["library.close.compare.5.them", "library.close.compare.5.us"],
      ],
    },
    lead: "how.start.body",
    glance: true,
  },
  "compare-tool": { lead: "how.start.body", glance: true },
  answer: { lead: "how.start.body", glance: true },
  teardowns: {
    weekly: {
      eyebrow: "library.close.teardown.eyebrow",
      title: "library.close.teardowns.title",
      lead: "library.close.teardowns.lead",
      them: "library.close.teardown.them",
      us: "library.close.teardown.us",
      rows: [TEARDOWN_ROW_1, ["library.close.teardowns.2.them", "library.close.teardown.2.us"], TEARDOWN_ROW_3],
    },
    lead: "library.close.teardowns.cta.lead",
    glance: true,
  },
  teardown: {
    weekly: {
      eyebrow: "library.close.teardown.eyebrow",
      title: "library.close.teardown.title",
      lead: "library.close.teardown.lead",
      them: "library.close.teardown.them",
      us: "library.close.teardown.us",
      rows: [TEARDOWN_ROW_1, ["library.close.teardown.2.them", "library.close.teardown.2.us"], TEARDOWN_ROW_3],
    },
    heading: "library.close.teardown.cta",
    lead: "library.close.teardown.cta.lead",
    glance: true,
  },
  tools: {
    weekly: {
      ...TOOL_WEEKLY,
      lead: "library.close.tools.lead",
      them: "library.close.tools.them",
      rows: [
        ["library.close.tools.1.them", "library.close.tools.1.us"],
        ["library.close.tools.2.them", "library.close.tools.2.us"],
        ["library.close.tools.3.them", "library.close.tools.3.us"],
      ],
    },
    lead: "how.start.body",
    glance: true,
  },
  "tool-meta": {
    weekly: {
      ...TOOL_WEEKLY,
      lead: "library.close.meta.lead",
      rows: [
        ["library.close.tool.1.them", "library.close.meta.1.us"],
        ["library.close.meta.2.them", "library.close.tool.wordpress"],
        ["library.close.meta.3.them", "library.close.meta.3.us"],
      ],
    },
    lead: "library.close.meta.cta.lead",
    glance: true,
  },
  "tool-on-page": {
    weekly: {
      ...TOOL_WEEKLY,
      lead: "library.close.onpage.lead",
      rows: [
        ["library.close.tool.1.them", "library.close.onpage.1.us"],
        ["library.close.onpage.2.them", "library.close.tool.wordpress"],
        ["library.close.onpage.3.them", "library.close.onpage.3.us"],
      ],
    },
    lead: "library.close.onpage.cta.lead",
    glance: true,
  },
  scans: {
    weekly: {
      eyebrow: "library.close.scans.eyebrow",
      title: "library.close.scans.title",
      lead: "library.close.scans.lead",
      them: "library.close.scans.them",
      us: "library.close.weekly",
      rows: [
        ["library.close.scans.1.them", "library.close.scans.1.us"],
        ["library.close.scans.2.them", "library.close.scans.2.us"],
        ["library.close.scans.3.them", "library.close.scans.3.us"],
      ],
    },
    lead: "how.start.body",
    glance: true,
  },
} as const satisfies Record<string, Close>;

export type LearnCloseVariant = keyof typeof CLOSE;

/** Every figure a closing sentence states, read from the constants that run the product. */
export const FIGURES = {
  weekPages: HOW_FACTS.weekPages,
  checks: HOW_FACTS.checks,
  windowHours: HOW_FACTS.windowHours,
  minutes: HOW_FACTS.setupMinutes,
  searches: HOW_FACTS.searches,
  pages: SITE_PROFILE.MAX_PAGES,
};
/** Sample figure for the fourth step: the example business's pages climbing on Google. */
const SAMPLE_CLIMBING = 3;
const LOOP = [1, 2, 3, 4] as const;
/** Monday to Sunday, as the letters a calendar heads its columns with. */
const WEEK = [0, 1, 2, 3, 4, 5, 6] as const;
const MONDAY = Date.UTC(2026, 0, 5);
const DAY_MS = 86_400_000;
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "narrow", timeZone: "UTC" });
const SMALL = "text-base-content/70 text-sm";

/** What each step of the loop looks like for the example business. */
function LoopSample(p: { step: (typeof LOOP)[number] }): React.JSX.Element {
  const e = EXAMPLES.plumber;
  if (p.step === 1) {
    return (
      <span className="rounded-box bg-base-200 flex min-w-0 flex-col gap-1 p-2 text-xs">
        <span className="num break-words">{e.search}</span>
        <span className="break-words">{e.question}</span>
      </span>
    );
  }
  if (p.step === 2) {
    return (
      <span className="num text-base-content/70 flex gap-2 text-xs" aria-hidden>
        {WEEK.map((i) => (
          <span key={i}>{WEEKDAY.format(MONDAY + i * DAY_MS)}</span>
        ))}
      </span>
    );
  }
  if (p.step === 3) {
    return (
      <span className="rounded-box bg-base-200 flex min-w-0 flex-col gap-1 p-2 text-xs">
        <span className="flex min-w-0 flex-wrap items-center gap-1">
          <span className="num text-base-content/70 min-w-0 truncate">{e.blog}</span>
          <span className="badge badge-success badge-sm">{copy("calendar.stage.live")}</span>
        </span>
        <span className="break-words">{e.page.title}</span>
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold">
      {copy("library.close.loop.4.sample", { live: e.mail.live, climbing: SAMPLE_CLIMBING })}
    </span>
  );
}

/** The call under a page's opening: down to the scan field at the foot. */
export function ScanJump(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <Link href={`#${START_ID}`} className="btn btn-primary btn-soft">
        {copy("landing.start.cta")}
        <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
      </Link>
      <p className="text-base-content/70 font-mono text-xs">{copy("landing.hero.assurance")}</p>
    </div>
  );
}

/** The weekly loop ReachKit runs, and your part in it. Compare and Answer
 *  pages draw it beside their own "what ReachKit does" section; `detail`
 *  opens the whole loop in one paragraph. */
export function LearnLoop(p: { detail?: { summary: string; body: string } } = {}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="learn-loop">
      <figure className="flex min-w-0 flex-col gap-3">
        <ol className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          {LOOP.map((step) => (
            <li key={step} className={`${CARD} min-w-0`}>
              <div className="card-body gap-2 p-4">
                <span className="badge badge-soft badge-primary badge-sm" aria-hidden>
                  {step}
                </span>
                <h3 className="text-base font-semibold">{copy(`library.close.loop.${step}.title` as CopyKey)}</h3>
                <div className="flex min-w-0 flex-col items-start gap-2">
                  <span className="badge badge-ghost badge-sm">{copy(`library.close.loop.${step}.when` as CopyKey, FIGURES)}</span>
                  <span className={SMALL}>{copy(`library.close.loop.${step}.line` as CopyKey)}</span>
                  <LoopSample step={step} />
                </div>
              </div>
            </li>
          ))}
        </ol>
        <p className="badge badge-soft badge-primary gap-1 self-center">
          <RefreshCw size={12} strokeWidth={1.75} aria-hidden />
          {copy("how.steps.loop")}
        </p>
        <figcaption className={SMALL}>{copy("library.close.example", { business: EXAMPLES.plumber.business })}</figcaption>
      </figure>
      {p.detail === undefined ? null : (
        <details className="collapse-arrow border-base-300 collapse min-w-0 border">
          <summary className="collapse-title font-semibold">{p.detail.summary}</summary>
          <div className="collapse-content">
            <p>{p.detail.body}</p>
          </div>
        </details>
      )}
      <div className="rounded-box bg-base-200 flex min-w-0 flex-col gap-1 p-4 text-sm">
        <p>{copy("library.close.part", FIGURES)}</p>
        <p className="flex flex-wrap items-center gap-x-1">
          <span>{copy("landing.price.terms", { price: copy("price.amount") })}</span>
          <Link href={HOW_HREF} className="link link-primary inline-flex items-center gap-1">
            {copy("landing.hero.how")}
            <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
          </Link>
        </p>
      </div>
    </div>
  );
}

/** The weekly section's words, resolved. */
export interface WeeklyWords {
  readonly eyebrow: string;
  readonly title: string;
  readonly lead: string;
  readonly them: string;
  readonly us: string;
  readonly rows: readonly (readonly [string, string])[];
  readonly detail?: { summary: string; body: string };
}

/** What this page gives beside what ReachKit gives, the weekly loop, and your part. */
export function WeeklyLoop(p: { w: WeeklyWords }): React.JSX.Element {
  const w = p.w;
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-base-content/70 text-xs font-semibold tracking-wide uppercase">{w.eyebrow}</span>
        <h2 className="break-words">{w.title}</h2>
        <p>{w.lead}</p>
      </div>
      <div className={CARD}>
        <div className={BODY}>
          <div className="text-base-content/70 hidden grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 text-xs font-semibold tracking-wide uppercase sm:grid">
            <span>{w.them}</span>
            <span aria-hidden className="w-4" />
            <span>{w.us}</span>
          </div>
          <ul className="divide-base-300 flex min-w-0 flex-col divide-y">
            {w.rows.map(([them, us]) => (
              <li key={them} className="grid min-w-0 grid-cols-1 gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3">
                <span className="text-base-content/70">{them}</span>
                <ArrowRight size={16} strokeWidth={1.75} aria-hidden className="text-primary hidden sm:block" />
                <span className="font-semibold">{us}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <LearnLoop detail={w.detail} />
    </section>
  );
}

function wordsOf(w: Weekly): WeeklyWords {
  return {
    eyebrow: copy(w.eyebrow),
    title: copy(w.title),
    lead: copy(w.lead, FIGURES),
    them: copy(w.them),
    us: copy(w.us),
    rows: w.rows.map(([them, us]) => [copy(them, FIGURES), copy(us, FIGURES)] as const),
  };
}

/** The site a tool was just asked about, as the scan field would read it. */
export function checkedDomain(value: string): string | undefined {
  const parsed = parseDomain(value);
  return parsed.ok ? parsed.domain : undefined;
}

/** The close every Learn page shares: what ReachKit does for your site, the
 *  weekly loop, your part, and the scan field with the free report's three
 *  figures. `domain` prefills the field where a tool has just read a page. */
export function LearnClose(p: { variant: LearnCloseVariant; domain?: string }): React.JSX.Element {
  const close: Close = CLOSE[p.variant];
  const submit =
    p.domain === undefined ? copy("landing.start.cta") : copy("library.close.scan.domain", { domain: p.domain });
  return (
    <div className="mt-6 flex min-w-0 flex-col gap-6" data-testid="learn-close" data-variant={p.variant}>
      {close.weekly === undefined ? null : <WeeklyLoop w={wordsOf(close.weekly)} />}
      <section id={START_ID} className={`${CARD} bg-base-200 scroll-mt-20`}>
        <div className={BODY}>
          <h2>{copy(close.heading ?? "landing.close.heading")}</h2>
          <p>{copy(close.lead, FIGURES)}</p>
          <ScanForm words={scanFormWords(submit)} searchParams={p.domain === undefined ? undefined : { value: p.domain }} />
          <p className={`${SMALL} flex flex-wrap gap-x-3`}>
            <span>{copy("landing.hero.assurance")}</span>
            {close.glance ? null : (
              <Link href={HOW_HREF} className="link link-primary">
                {copy("about.how")}
              </Link>
            )}
          </p>
          {close.glance
            ? ReportGlance(
                EXAMPLES.plumber,
                copy("library.close.glance", { business: EXAMPLES.plumber.business, software: EXAMPLES.software.business })
              )
            : null}
        </div>
      </section>
    </div>
  );
}

/** Where the facts about another company were read, and when. */
export function Sources(p: { checked: string; sources: readonly Source[] }): React.JSX.Element {
  return (
    <section className="text-base-content/70 flex min-w-0 flex-col gap-2 text-sm" data-testid="library-sources">
      <p>{copy("library.checked", { date: longDate(p.checked) })}</p>
      {p.sources.length === 0 ? null : (
        <>
          <h2 className="text-base">{copy("library.sources")}</h2>
          <ul className={LIST}>
            {p.sources.map((source) => (
              <li key={source.href} className="break-words">
                {source.href.startsWith("/") ? (
                  <Link href={source.href} className="link">
                    {source.label}
                  </Link>
                ) : (
                  <a href={source.href} className="link" {...NEW_TAB}>
                    {copy("library.source", { label: source.label, host: new URL(source.href).hostname })}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Every page that names another company's product says whose name it is. */
export function Trademarks(): React.JSX.Element {
  return <p className="text-base-content/70 text-sm">{copy("library.trademarks")}</p>;
}

/** Back to the index the page belongs to. */
export function BackLink(p: { href: string; label: CopyKey }): React.JSX.Element {
  return (
    <p>
      <Link href={p.href} className="link link-primary">
        {copy(p.label)}
      </Link>
    </p>
  );
}
