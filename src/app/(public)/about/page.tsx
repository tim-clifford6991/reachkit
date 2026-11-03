// SPEC §1 (2026-10-10, issue 1396) — who builds ReachKit, and why.
// src/app/(public)/about/page.tsx
//
// Board `PubAbout`: the lead and who builds it, why it exists with the
// before and now pictures, the four steps, the rules, a real site, then the
// short scan close. The founder's name and place, the newest page of
// ReachKit's own blog and the listed example report are read from stored
// rows (`_how/examples.ts`); where none is stored, that line is not drawn
// and the imprint still names the operator.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Ban,
  Building2,
  ChevronRight,
  CircleCheck,
  CircleX,
  FileText,
  Info,
  Link as LinkIcon,
  Mail,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  type LucideIcon,
} from "lucide-react";
import { Surface } from "@/ui/layout";
import { SiteMark } from "@/ui/SiteMark";
import { BrandMark } from "@/app/_brand/Brand";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";
import { readLiveExamples } from "../_how/examples";
import { HOW_FACTS as F } from "../_how/facts";
import { BAND, LearnClose } from "../_library/parts";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.about);

// The founder's line is a stored row, read per request.
export const dynamic = "force-dynamic";

/** Attribute values, never sentences (the copy sweep). */
const CARD = "card bg-base-100 shadow-(--shadow-card) min-w-0";
const ROW_CARD = `${CARD} flex-row items-start gap-3 p-5`;
const BODY = "card-body gap-3";
const SECTION = "flex min-w-0 flex-col gap-4 scroll-mt-16";
const EYEBROW = "text-primary text-xs font-semibold tracking-wide uppercase";
const SMALL = "text-base-content/70 text-sm";
/** Every heading reads near-black over the page's softer body text, the close's included. */
const HEADINGS = "[&_:is(h1,h2,h3)]:text-base-content";
/** The solid number tile the boards draw on each step. */
const STEP_TILE = "rounded-field bg-primary text-primary-content grid size-10 shrink-0 place-items-center font-extrabold";
const TILE = "rounded-field bg-primary/10 text-primary grid size-10 shrink-0 place-items-center";
const RULE_TILE = "rounded-field grid size-8 shrink-0 place-items-center";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const TILE_ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;
const NEW_TAB = { target: "_blank", rel: "noopener" } as const;
const PAGE_TEST_ID = "about";
const DISCLOSURE_TEST_ID = "about-disclosure";
const REPORT_TEST_ID = "about-report";
const HOW = "/how-it-works";

/** The board's specimen, a fictional invoicing app's buyer; every domain is reserved. */
const SPECIMEN = {
  search: "invoicing app for freelancers",
  results: [
    { name: "A big accounting suite", site: "a big suite’s site", path: "invoicing", title: "Invoicing for every size of business" },
    { name: "Ledgerline", site: "ledgerline.example", path: "freelancers", title: "Send invoices and get paid faster" },
    { name: "Paywise", site: "paywise.example", path: "invoices", title: "Simple invoices for freelancers" },
  ],
  question: "What’s a good invoicing app for freelancers?",
  answer: "Many freelancers use Ledgerline or Paywise.",
  /** The businesses the answer names, drawn bold where it names them. */
  named: ["Ledgerline", "Paywise"],
} as const;

/** The answer with each named business in bold. */
function Answer(): React.JSX.Element {
  const parts = SPECIMEN.answer.split(new RegExp(`(${SPECIMEN.named.join("|")})`));
  return <>{parts.map((part, i) => ((SPECIMEN.named as readonly string[]).includes(part) ? <strong key={i}>{part}</strong> : part))}</>;
}

/** The four steps, each opening the How it works section that tells it. */
const STEPS: readonly { n: number; href: string; title: CopyKey; line: CopyKey; Icon: LucideIcon }[] = [
  { n: 1, href: `${HOW}#research`, title: "how.step.1.title", line: "about.step.research", Icon: Building2 },
  { n: 2, href: `${HOW}#questions`, title: "how.step.2.title", line: "how.step.2.line", Icon: MessageSquare },
  { n: 3, href: `${HOW}#pages`, title: "how.step.3.title", line: "about.step.pages", Icon: FileText },
  { n: 4, href: `${HOW}#found`, title: "how.step.4.title", line: "how.step.4.line", Icon: TrendingUp },
];

const NEVER: readonly CopyKey[] = ["how.never.invent", "how.never.hide", "about.never.promise", "about.never.filler"];
const ALWAYS: readonly { key: CopyKey; Icon: LucideIcon }[] = [
  { key: "about.rules.source", Icon: LinkIcon },
  { key: "about.rules.checks", Icon: ShieldCheck },
  { key: "about.rules.unmeasured", Icon: Info },
];

export default async function AboutPage(): Promise<React.JSX.Element> {
  const { founder, page, report } = await readLiveExamples();
  const address = copy("about.contact.address");

  return (
    <Surface
      arms={{
        compact: { kind: "declared", note: "one reading column with its own 16px gutter, as the v36 boards draw it" },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-col px-4 py-12" data-testid={PAGE_TEST_ID}>
        <article className={`text-base-content/80 ${HEADINGS} mx-auto flex w-full min-w-0 max-w-(--w-read) flex-col gap-10 leading-relaxed`}>
          <section id="top" aria-labelledby="top-h" className={SECTION}>
            <h1 id="top-h" className="t-hero">{copy("about.title")}</h1>
            <p>{copy("about.lead")}</p>
            <section aria-labelledby="who-h" className={CARD}>
              <div className={BODY}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className={TILE}>
                    <User {...TILE_ICON} />
                  </span>
                  <h2 id="who-h" className="text-lg">
                    {copy("about.who.title")}
                  </h2>
                </div>
                <p>
                  {founder === null
                    ? null
                    : `${
                        founder.place === null
                          ? copy("about.who.founder", { name: founder.name })
                          : copy("about.who.founder.place", { name: founder.name, place: founder.place })
                      } `}
                  <Link href="/imprint" className="link-hover">
                    {copy("about.who.imprint")}
                  </Link>
                </p>
                <a href={`mailto:${address}`} className="rounded-box bg-base-200 flex min-h-11 min-w-0 items-center gap-3 p-3">
                  <span className={TILE}>
                    <Mail {...TILE_ICON} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{copy("about.who.ask")}</span>
                    <span className={`${SMALL} break-all`}>{address}</span>
                  </span>
                  <ChevronRight {...TILE_ICON} className="text-primary shrink-0" />
                </a>
              </div>
            </section>
          </section>

          <section id="why" aria-labelledby="why-h" className={`${SECTION} ${BAND}`}>
            <h2 id="why-h">{copy("about.why.title")}</h2>
            <p>{`${copy("about.why.problem")} ${copy("about.why.answer")}`}</p>
            <div className="grid min-w-0 grid-cols-1 items-center gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <figure className={CARD}>
                <div className={BODY}>
                  <p className={EYEBROW}>{copy("about.before.label")}</p>
                  <p className="font-semibold">{copy("about.before.line")}</p>
                  <p className="rounded-box bg-base-200 flex items-center gap-2 px-3 py-2 text-sm">
                    <Search {...ICON} />
                    {SPECIMEN.search}
                  </p>
                  <ol className="flex flex-col gap-3" aria-hidden>
                    {SPECIMEN.results.map((r) => (
                      <li key={r.site} className="flex min-w-0 items-start gap-2">
                        <SiteMark domain={r.site} hasLogo={false} size={32} />
                        <span className="flex min-w-0 flex-col">
                          <span className="text-sm font-semibold">{r.name}</span>
                          <span className="num text-base-content/70 text-xs break-all">{`${r.site} › ${r.path}`}</span>
                          <span className="text-primary text-sm">{r.title}</span>
                          <span className="bg-base-300 mt-1.5 block h-2 w-3/4 rounded-full" />
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </figure>
              <ArrowRight {...TILE_ICON} className="text-base-content/70 rotate-90 justify-self-center md:rotate-0" />
              <figure className={CARD}>
                <div className={BODY}>
                  <p className={EYEBROW}>{copy("about.now.label")}</p>
                  <p className="font-semibold">{copy("about.now.line")}</p>
                  <p className="rounded-box bg-base-200 self-end px-3 py-2 text-sm">{SPECIMEN.question}</p>
                  <div className="rounded-box border-base-300 flex flex-col gap-1 border p-3">
                    <span className={`${SMALL} flex items-center gap-1`}>
                      <Sparkles {...ICON} />
                      {copy("how.rivals.answer")}
                    </span>
                    <span className="text-sm">
                      <Answer />
                    </span>
                  </div>
                  <p className="rounded-box bg-error/10 text-error flex items-center gap-2 px-3 py-2 text-sm font-semibold">
                    <CircleX {...ICON} />
                    {copy("about.now.absent")}
                  </p>
                </div>
              </figure>
            </div>
          </section>

          <section id="does" aria-labelledby="does-h" className={SECTION}>
            <h2 id="does-h">{copy("about.does.title")}</h2>
            <ol className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              {STEPS.map((s) => (
                <li key={s.n} className="min-w-0">
                  <Link href={s.href} className={`${CARD} h-full`}>
                    <div className={BODY}>
                      <span className="flex items-center justify-between gap-2">
                        <span className={STEP_TILE} aria-hidden>
                          {s.n}
                        </span>
                        <span className={TILE}>
                          <s.Icon {...TILE_ICON} />
                        </span>
                      </span>
                      <h3>{copy(s.title)}</h3>
                      <span className={SMALL}>{copy(s.line, { weekPages: F.weekPages })}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
            <div className="rounded-box bg-base-200 flex flex-col gap-2 p-4 text-sm">
              <p className="flex items-start gap-2">
                <User {...ICON} className="text-primary mt-0.5 shrink-0" />
                <span>
                  <strong>{copy("library.close.part.label")}</strong> {copy("library.close.part.once", { minutes: F.setupMinutes })}
                </span>
              </p>
              <p className="flex items-start gap-2" data-testid={DISCLOSURE_TEST_ID}>
                <Sparkles {...ICON} className="text-primary mt-0.5 shrink-0" />
                <span>{copy("how.disclosure")}</span>
              </p>
            </div>
          </section>

          <section id="rules" aria-labelledby="rules-h" className={`${SECTION} ${BAND}`}>
            <h2 id="rules-h">{copy("about.rules.title")}</h2>
            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <h3 className="text-error flex items-center gap-2">
                  <Ban {...ICON} />
                  {copy("about.rules.never")}
                </h3>
                <ul className="flex flex-col gap-2">
                  {NEVER.map((key) => (
                    <li key={key} className={`${CARD} flex-row items-center gap-3 p-3`}>
                      <span className={`${RULE_TILE} bg-error/10 text-error`}>
                        <Ban {...ICON} />
                      </span>
                      <span className="text-base-content min-w-0 font-semibold">{copy(key)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <h3 className="text-success flex items-center gap-2">
                  <CircleCheck {...ICON} />
                  {copy("about.rules.always")}
                </h3>
                <ul className="flex flex-col gap-2">
                  {ALWAYS.map(({ key, Icon }) => (
                    <li key={key} className="rounded-box bg-success/10 flex min-w-0 items-center gap-3 p-3">
                      <span className={`${RULE_TILE} bg-base-100 text-success`}>
                        <Icon {...ICON} />
                      </span>
                      <span className="text-base-content min-w-0 font-semibold">{copy(key)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {page === null && report === null ? null : (
            <section id="proof" aria-labelledby="proof-h" className={SECTION}>
              <h2 id="proof-h">
                {copy("about.proof.title")}
              </h2>
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                {page === null ? null : (
                  <a href={page.url} className={ROW_CARD} {...NEW_TAB}>
                    <span className={TILE}>
                      <FileText {...TILE_ICON} />
                    </span>
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className={EYEBROW}>{copy("about.proof.newest")}</span>
                      <span className="font-semibold break-words">{page.title}</span>
                    </span>
                  </a>
                )}
                {report === null ? null : (
                  <Link href={`/scan/${report}`} className={ROW_CARD} data-testid={REPORT_TEST_ID}>
                    <span className="grid size-10 shrink-0 place-items-center">
                      <BrandMark size="lg" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className={EYEBROW}>{copy("about.proof.report")}</span>
                      <span className="num font-semibold break-all">{report}</span>
                      <span className="text-primary inline-flex items-center gap-1 text-sm font-semibold">
                        {copy("about.proof.open")}
                        <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
                      </span>
                    </span>
                  </Link>
                )}
              </div>
            </section>
          )}

          <LearnClose variant="about" />
        </article>
      </main>
    </Surface>
  );
}
