// Issue 1458 — the frame every library page shares: the about page's
// reading column, the closing block, and the sources line. daisyUI
// classes in place, no wrapper of a daisyUI part.
import type React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChartColumn,
  Check,
  Compass,
  Database,
  List,
  PenLine,
  RefreshCw,
  Sparkles,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Surface } from "@/ui/layout";
import { SITE_PROFILE } from "@/lib/config/constants";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { parseDomain } from "@/lib/scan/domain";
import { ScanForm } from "../_landing/ScanForm";
import { scanFormWords } from "../_landing/scan-form-words";
import { HOW_FACTS } from "../_how/facts";
import { EXAMPLES } from "../_how/specimen";
import { ICON_TILE, ReportGlance } from "../_how/visuals";
import { longDate, type ComparisonGroup, type Source } from ".";

/** Attribute values, never sentences (the copy sweep). */
export const CARD = "card bg-base-100 shadow-(--shadow-card)";
export const BODY = "card-body gap-3";
export const LIST = "list-disc ps-6";
/** The heading ink: near-black over the column's softer body text. */
const HEADINGS = "[&_:is(h1,h2,h3)]:text-base-content";

/** Each kind of tool's icon, wherever the board names the kind. */
export const GROUP_ICON: Record<ComparisonGroup, LucideIcon> = {
  ai: PenLine,
  suite: Database,
  checker: List,
  competitors: Users,
  audience: Compass,
  data: ChartColumn,
};

const TILE_TONE = {
  primary: "bg-primary/10 text-primary",
  muted: "bg-base-200 text-base-content/70",
  solid: "bg-primary text-primary-content",
  success: "bg-success/10 text-success",
  plain: "bg-base-100 text-primary",
} as const;

/** A tinted square holding one icon, as the boards draw beside a heading or a row. */
export function Tile(p: { Icon: LucideIcon; tone?: keyof typeof TILE_TONE }): React.JSX.Element {
  return (
    <span aria-hidden className={`rounded-field grid size-9 flex-none place-items-center ${TILE_TONE[p.tone ?? "primary"]}`}>
      <p.Icon size={18} strokeWidth={1.75} />
    </span>
  );
}

/** When to pick which: a tile and a title, then check bullets; ReachKit's card carries the primary edge. */
export function Pick(p: { title: React.ReactNode; items: readonly string[]; Icon: LucideIcon; ours?: boolean }): React.JSX.Element {
  return (
    <div className={`${CARD} ${p.ours ? "border-primary border-[1.5px]" : ""}`}>
      <div className={BODY}>
        <div className="flex min-w-0 items-center gap-3">
          <Tile Icon={p.Icon} tone={p.ours ? "solid" : "muted"} />
          {p.title}
        </div>
        <ul className="flex flex-col gap-2">
          {p.items.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <Check size={16} strokeWidth={2} aria-hidden className={`mt-1 shrink-0 ${p.ours ? "text-primary" : "text-base-content/70"}`} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
const NEW_TAB = { target: "_blank", rel: "noopener" } as const;
const SOURCE_LINK = "link link-primary link-hover inline-flex min-h-11 items-center";
const HOW_HREF = "/how-it-works";
const START_ID = "start";

/** The page: an eyebrow where the board draws one, the heading, and the column under it. */
export function LibraryPage(p: {
  testId: string;
  eyebrow?: CopyKey;
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
        compact: { kind: "declared", note: "one reading column with its own 16px gutter, as the v36 boards draw it" },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-col px-4 py-12" data-testid={p.testId}>
        <article
          className={`text-base-content/80 ${HEADINGS} mx-auto flex w-full min-w-0 flex-col gap-3 leading-relaxed ${p.wide === true ? "" : "max-w-(--w-read)"}`}
        >
          {p.trail ??
            (p.eyebrow === undefined ? null : (
              <span className="text-base-content/70 text-xs font-semibold tracking-wide uppercase">{copy(p.eyebrow)}</span>
            ))}
          <h1 className="t-hero break-words">{p.title}</h1>
          <div className="mt-3 flex min-w-0 flex-col gap-4">{p.children}</div>
        </article>
      </main>
    </Surface>
  );
}

type Row = readonly [CopyKey, CopyKey];

/** The two-column section above the loop: what this page gives, beside what ReachKit gives your site. */
interface Weekly {
  readonly eyebrow?: CopyKey;
  readonly title: CopyKey;
  readonly lead?: CopyKey;
  readonly them: CopyKey;
  readonly us: CopyKey;
  readonly rows: readonly Row[];
}

/** The icons a board draws on its close: one per loop step, and one per compare side. */
interface Icons {
  readonly steps?: readonly [LucideIcon, LucideIcon, LucideIcon, LucideIcon];
  readonly them: LucideIcon;
  readonly us: LucideIcon;
}

interface Close {
  readonly weekly?: Weekly;
  /** Drawn where the board draws them. */
  readonly icons?: Icons;
  readonly heading?: CopyKey;
  /** The line under the field's heading; the short close has none. */
  readonly lead?: CopyKey;
  /** About ends on the field and a link to How it works, without the report card. */
  readonly glance: boolean;
  /** The close as canvas v36 draws it: no 4-step figure, only your part and the price, and the field alone in a tinted band. */
  readonly short?: true;
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
      title: "library.close.compare.title",
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
    glance: false,
    short: true,
    icons: { them: User, us: Sparkles },
  },
  "compare-tool": { glance: false, short: true },
  answer: { glance: false, short: true },
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
    glance: false,
    short: true,
    icons: { them: User, us: Sparkles },
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

/** A loop step's number, and its icon tile where the close has one. */
function StepMark(p: { step: number; Icon?: LucideIcon }): React.JSX.Element {
  const badge = (
    <span className="badge badge-soft badge-primary badge-sm" aria-hidden>
      {p.step}
    </span>
  );
  if (p.Icon === undefined) return badge;
  return (
    <span className="flex items-center gap-2">
      {badge}
      <span aria-hidden className={`${ICON_TILE} text-primary`}>
        <p.Icon size={16} strokeWidth={1.75} />
      </span>
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

/** The weekly loop ReachKit runs, and your part in it. */
function LearnLoop(p: { steps?: Icons["steps"] } = {}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="learn-loop">
      <figure className="flex min-w-0 flex-col gap-3">
        <ol className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          {LOOP.map((step) => (
            <li key={step} className={`${CARD} min-w-0`}>
              <div className="card-body gap-2 p-4">
                <StepMark step={step} Icon={p.steps?.[step - 1]} />
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

/** Your part and the price, without the loop's figure. */
export function YourPart(): React.JSX.Element {
  const line = "flex min-w-0 flex-[1_1_17rem] items-start gap-2.5";
  const icon = "text-primary mt-0.5 flex-none";
  return (
    <div className="rounded-box bg-base-200 flex min-w-0 flex-wrap gap-x-10 gap-y-3 px-5 py-4">
      <p className={line}>
        <User size={20} strokeWidth={1.75} aria-hidden className={icon} />
        <span>
          <strong>{copy("library.close.part.label")}</strong> {copy("library.close.part.once", FIGURES)}
        </span>
      </p>
      <p className={line}>
        <Wallet size={20} strokeWidth={1.75} aria-hidden className={icon} />
        <span>
          <strong>{copy("library.close.price.lead", { price: copy("price.amount") })}</strong> {copy("library.close.price.rest")}
          <Link href={HOW_HREF} className="link link-primary ms-1 inline-flex min-h-11 items-center gap-1 font-semibold no-underline">
            {copy("landing.hero.how")}
            <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
          </Link>
        </span>
      </p>
    </div>
  );
}

/** The weekly section's words, resolved. */
export interface WeeklyWords {
  readonly eyebrow?: string;
  readonly title: string;
  readonly lead?: string;
  readonly them: string;
  readonly us: string;
  readonly rows: readonly (readonly [string, string])[];
}

/** A compare row's side, opening with its icon where the close has one. */
function Side(p: { text: string; className: string; Icon?: LucideIcon }): React.JSX.Element {
  if (p.Icon === undefined) return <span className={p.className}>{p.text}</span>;
  return (
    <span className={`${p.className} flex min-w-0 items-start gap-2`}>
      <p.Icon size={16} strokeWidth={1.75} aria-hidden className="mt-1 flex-none" />
      <span className="min-w-0">{p.text}</span>
    </span>
  );
}

/** What this page gives beside what ReachKit gives, anything the page sets under it, then the weekly loop or only your part. */
export function WeeklyLoop(p: { w: WeeklyWords; icons?: Icons; short?: true; children?: React.ReactNode }): React.JSX.Element {
  const w = p.w;
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        {w.eyebrow === undefined ? null : (
          <span className="text-base-content/70 text-xs font-semibold tracking-wide uppercase">{w.eyebrow}</span>
        )}
        <h2 className="break-words">{w.title}</h2>
        {w.lead === undefined ? null : <p>{w.lead}</p>}
      </div>
      <div className={CARD}>
        <div className={BODY}>
          <div aria-hidden className="text-base-content/70 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 text-xs font-semibold tracking-wide uppercase">
            <span>{w.them}</span>
            <ArrowRight size={14} strokeWidth={1.75} className="mt-0.5" />
            <span className="text-primary">{w.us}</span>
          </div>
          <ul className="divide-base-300 flex min-w-0 flex-col divide-y">
            {w.rows.map(([them, us]) => (
              <li key={them} className="grid min-w-0 grid-cols-1 gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3">
                <Side text={them} className="text-base-content/70" Icon={p.icons?.them} />
                <ArrowRight size={16} strokeWidth={1.75} aria-hidden className="text-primary hidden sm:block" />
                <Side text={us} className="font-semibold" Icon={p.icons?.us} />
              </li>
            ))}
          </ul>
        </div>
      </div>
      {p.children}
      {p.short ? <YourPart /> : <LearnLoop steps={p.icons?.steps} />}
    </section>
  );
}

function wordsOf(w: Weekly): WeeklyWords {
  return {
    ...(w.eyebrow === undefined ? {} : { eyebrow: copy(w.eyebrow) }),
    title: copy(w.title),
    ...(w.lead === undefined ? {} : { lead: copy(w.lead, FIGURES) }),
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
      {close.weekly === undefined ? null : <WeeklyLoop w={wordsOf(close.weekly)} icons={close.icons} short={close.short} />}
      {close.short ? (
        <section id={START_ID} aria-labelledby="start-h" className="rounded-box border-primary/20 bg-primary/10 flex scroll-mt-20 flex-col items-center gap-3.5 border px-5 py-8 text-center sm:px-10 sm:py-12">
          <h2 id="start-h">{copy(close.heading ?? "landing.close.heading")}</h2>
          <div className="w-full max-w-xl text-start">
            <ScanForm words={scanFormWords(submit)} searchParams={p.domain === undefined ? undefined : { value: p.domain }} />
          </div>
          <p className={SMALL}>{copy("landing.hero.assurance")}</p>
        </section>
      ) : (
        <section id={START_ID} className={`${CARD} bg-base-200 scroll-mt-20`}>
          <div className={BODY}>
            <h2>{copy(close.heading ?? "landing.close.heading")}</h2>
            {close.lead === undefined ? null : <p>{copy(close.lead, FIGURES)}</p>}
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
      )}
    </div>
  );
}

/** Where the facts about another company were read, and when. */
export function Sources(p: {
  checked: string;
  sources: readonly Source[];
  id?: string;
  /** The date and "Sources" as one heading, each host in the code face (canvas v36 PubCompareTool, PubAnswer). */
  oneLine?: true;
}): React.JSX.Element {
  const checked = copy("library.checked", { date: longDate(p.checked) });
  return (
    <section
      aria-labelledby={p.id}
      className="text-base-content/70 flex min-w-0 scroll-mt-20 flex-col gap-2 text-sm"
      data-testid="library-sources"
    >
      {p.oneLine && p.sources.length > 0 ? null : <p>{checked}</p>}
      {p.sources.length === 0 ? null : (
        <>
          <h2 id={p.id} className="text-base">
            {p.oneLine ? `${checked} ${copy("library.sources")}` : copy("library.sources")}
          </h2>
          <ul className={LIST}>
            {p.sources.map((source) => (
              <li key={source.href} className="break-words">
                {source.href.startsWith("/") ? (
                  <Link href={source.href} className={SOURCE_LINK}>
                    {source.label}
                  </Link>
                ) : (
                  p.oneLine ? (
                    <span className="inline-flex flex-wrap items-center gap-x-2">
                      <a href={source.href} className={SOURCE_LINK} {...NEW_TAB}>
                        {source.label}
                      </a>
                      <span className="font-mono text-xs">{new URL(source.href).hostname}</span>
                    </span>
                  ) : (
                    <a href={source.href} className={SOURCE_LINK} {...NEW_TAB}>
                      {copy("library.source", { label: source.label, host: new URL(source.href).hostname })}
                    </a>
                  )
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
