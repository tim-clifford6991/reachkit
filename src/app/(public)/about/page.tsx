// SPEC §1 (2026-10-10, issue 1396) — who builds ReachKit, and why.
// src/app/(public)/about/page.tsx
//
// Board `PubAbout`: the lead and who builds it, why it exists with the
// before and now pictures, the four steps, the rules, a real site, contact,
// then the Learn pages' closing field. The founder's name and place, the
// newest page of ReachKit's own blog and the listed example report are read
// from stored rows (`_how/examples.ts`); where none is stored, that line is
// not drawn and the imprint still names the operator.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, Check, Mail, Search, X } from "lucide-react";
import { Surface } from "@/ui/layout";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";
import { readLiveExamples } from "../_how/examples";
import { HOW_FACTS as F } from "../_how/facts";
import { EXAMPLES } from "../_how/specimen";
import { LearnClose } from "../_library/parts";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.about);

// The founder's line is a stored row, read per request.
export const dynamic = "force-dynamic";

/** Attribute values, never sentences (the copy sweep). */
const CARD = "card bg-base-100 shadow-(--shadow-card) min-w-0";
const BODY = "card-body gap-3";
const SECTION = "flex min-w-0 flex-col gap-4 scroll-mt-16";
const EYEBROW = "text-primary text-xs font-semibold tracking-wide uppercase";
const SMALL = "text-base-content/70 text-sm";
const LINK = "link link-primary inline-flex items-center gap-1 text-sm font-semibold";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const NEW_TAB = { target: "_blank", rel: "noopener" } as const;
const PAGE_TEST_ID = "about";
const DISCLOSURE_TEST_ID = "about-disclosure";
const CONTACT_HREF = "#contact";
const HOW = "/how-it-works";

/** The four steps, each opening the How it works section that tells it. */
const STEPS: readonly { n: number; href: string; title: CopyKey; line: CopyKey }[] = [
  { n: 1, href: `${HOW}#research`, title: "how.step.1.title", line: "about.step.research" },
  { n: 2, href: `${HOW}#questions`, title: "how.step.2.title", line: "how.step.2.line" },
  { n: 3, href: `${HOW}#pages`, title: "how.step.3.title", line: "about.step.pages" },
  { n: 4, href: `${HOW}#found`, title: "how.step.4.title", line: "how.step.4.line" },
];

const GAPS: readonly { name: CopyKey; problem: CopyKey; answer: CopyKey }[] = [
  { name: "about.gap.see.name", problem: "about.gap.see.problem", answer: "about.gap.see.answer" },
  { name: "about.gap.time.name", problem: "about.gap.time.problem", answer: "about.gap.time.answer" },
];

const NEVER: readonly CopyKey[] = ["how.never.invent", "how.never.hide", "about.never.promise", "about.never.filler"];
const ALWAYS: readonly CopyKey[] = ["about.rules.source", "about.rules.checks", "about.rules.unmeasured"];

function Head(p: { id: string; eyebrow: string; title: string; lead: string }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className={EYEBROW}>{p.eyebrow}</p>
      <h2 id={`${p.id}-h`}>{p.title}</h2>
      <p>{p.lead}</p>
    </div>
  );
}

function Gap(p: { name: CopyKey; problem: CopyKey; answer: CopyKey }): React.JSX.Element {
  return (
    <li className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
      <span className="rounded-box bg-base-200 flex min-w-0 flex-col p-3">
        <span className="font-semibold">{copy(p.name)}</span><span className={SMALL}>{copy(p.problem)}</span>
      </span>
      <span className="text-primary flex min-w-0 items-center gap-2 font-semibold">
        <Check {...ICON} />
        {copy(p.answer)}
      </span>
    </li>
  );
}

export default async function AboutPage(): Promise<React.JSX.Element> {
  const { founder, page, report } = await readLiveExamples();
  const plumber = EXAMPLES.plumber;
  const address = copy("about.contact.address");

  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-col px-4 py-12" data-testid={PAGE_TEST_ID}>
        <article className="text-base-content/80 mx-auto flex w-full min-w-0 max-w-(--w-read) flex-col gap-10 leading-relaxed">
          <section id="top" aria-labelledby="top-h" className={SECTION}>
            <span className="text-base-content/70 text-xs font-semibold tracking-wide uppercase">
              {copy("about.eyebrow")}
            </span>
            <h1 id="top-h">{copy("about.title")}</h1>
            <p>{copy("about.lead")}</p>
            <p className="flex flex-wrap gap-2">
              <span className="badge badge-ghost">{copy("about.chip.plan", { price: copy("price.amount") })}</span>
              <span className="badge badge-ghost">{copy("about.chip.time", { minutes: F.setupMinutes })}</span>
              <span className="badge badge-ghost">{copy("about.chip.control")}</span>
            </p>
            <section aria-labelledby="who-h" className={CARD}>
              <div className={BODY}>
                <div>
                  <h2 id="who-h">{copy("about.who.title")}</h2>
                  <p className={SMALL}>{copy("about.who.line")}</p>
                </div>
                <p>
                  {founder === null
                    ? null
                    : `${
                        founder.place === null
                          ? copy("about.who.founder", { name: founder.name })
                          : copy("about.who.founder.place", { name: founder.name, place: founder.place })
                      } `}
                  <Link href="/imprint" className="link link-primary">
                    {copy("about.who.imprint")}
                  </Link>
                </p>
                <a href={CONTACT_HREF} className="rounded-box bg-base-200 flex min-w-0 items-center gap-2 p-3">
                  <Mail {...ICON} />
                  <span className="font-semibold">{copy("about.who.ask")}</span><span className={SMALL}>{address}</span>
                </a>
              </div>
            </section>
          </section>

          <section id="why" aria-labelledby="why-h" className={SECTION}>
            <Head
              id="why"
              eyebrow={copy("about.why.eyebrow")}
              title={copy("about.why.title")}
              lead={`${copy("about.why.problem")} ${copy("about.why.answer")}`}
            />
            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
              <figure className={CARD}>
                <div className={BODY}>
                  <p className={EYEBROW}>{copy("about.before.label")}</p>
                  <p className="font-semibold">{copy("about.before.line")}</p>
                  <p className="rounded-box bg-base-200 flex items-center gap-2 px-3 py-2 text-sm">
                    <Search {...ICON} />
                    {plumber.search}
                  </p>
                  <ol className="flex flex-col gap-2">
                    {plumber.results.map((r) => (
                      <li key={r.url} className="flex min-w-0 flex-col">
                        <span className="text-sm font-semibold">{r.name}</span>
                        <span className="num text-base-content/70 text-xs">{r.url}</span>
                        <span className="text-primary text-sm">{r.title}</span>
                      </li>
                    ))}
                  </ol>
                  <figcaption className={SMALL}>{copy("about.before.caption")}</figcaption>
                </div>
              </figure>
              <figure className={CARD}>
                <div className={BODY}>
                  <p className={EYEBROW}>{copy("about.now.label")}</p>
                  <p className="font-semibold">{copy("about.now.line")}</p>
                  <p className="rounded-box bg-base-200 self-end px-3 py-2 text-sm">{plumber.question}</p>
                  <div className="rounded-box border-base-300 flex flex-col gap-1 border p-3">
                    <span className={`${SMALL} flex items-center gap-1`}>
                      <Bot {...ICON} />
                      {copy("how.rivals.answer")}
                    </span>
                    <span className="text-sm">{plumber.answer}</span>
                  </div>
                  <p className="text-error flex items-center gap-1 text-sm font-semibold">
                    <X {...ICON} />
                    {copy("about.now.absent")}
                  </p>
                  <figcaption className={SMALL}>{copy("about.now.caption")}</figcaption>
                </div>
              </figure>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <p className={EYEBROW}>{copy("about.gap.eyebrow")}</p>
              <ul className="flex flex-col gap-3">
                {GAPS.map((g) => (
                  <Gap key={g.name} {...g} />
                ))}
              </ul>
            </div>
            <p className={SMALL}>{copy("about.why.sample", { business: plumber.business })}</p>
          </section>

          <section id="does" aria-labelledby="does-h" className={SECTION}>
            <Head
              id="does"
              eyebrow={copy("about.does.eyebrow")}
              title={copy("about.does.title")}
              lead={copy("about.does.lead")}
            />
            <ol className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              {STEPS.map((s) => (
                <li key={s.n} className="min-w-0">
                  <Link href={s.href} className={`${CARD} h-full`}>
                    <div className={BODY}>
                      <span className="badge badge-primary badge-sm">{s.n}</span>
                      <h3>{copy(s.title)}</h3>
                      <span className={SMALL}>
                        {copy(s.line, { weekPages: F.weekPages })}
                        <span className="text-primary ms-1 inline-flex items-center gap-1 font-semibold">
                          {copy("how.step.more")}
                          <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
                        </span>
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
            <div className="rounded-box bg-base-200 flex flex-col gap-1 p-4 text-sm">
              <p>{copy("how.steps.part", { minutes: F.setupMinutes })}</p>
              <p data-testid={DISCLOSURE_TEST_ID}>{copy("how.disclosure")}</p>
            </div>
          </section>

          <section id="rules" aria-labelledby="rules-h" className={SECTION}>
            <Head
              id="rules"
              eyebrow={copy("about.rules.eyebrow")}
              title={copy("about.rules.title")}
              lead={copy("about.rules.lead")}
            />
            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <h3 className="flex items-center gap-2">
                  <X {...ICON} />
                  {copy("about.rules.never")}
                </h3>
                <ul className="flex flex-col gap-2">
                  {NEVER.map((key) => (
                    <li key={key} className="rounded-box bg-base-100 p-3">
                      {copy(key)}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <h3 className="flex items-center gap-2">
                  <Check {...ICON} />
                  {copy("about.rules.always")}
                </h3>
                <ul className="flex flex-col gap-2">
                  {ALWAYS.map((key) => (
                    <li key={key} className="p-3">
                      {copy(key)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section id="proof" aria-labelledby="proof-h" className={SECTION}>
            <Head
              id="proof"
              eyebrow={copy("about.proof.eyebrow")}
              title={copy("about.proof.title")}
              lead={copy("about.proof.lead")}
            />
            {page === null && report === null ? null : (
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                {page === null ? null : (
                  <a href={page.url} className={CARD} {...NEW_TAB}>
                    <div className={BODY}>
                      <span className={EYEBROW}>{copy("about.proof.newest")}</span>
                      <span className="font-semibold">{page.title}</span>
                    </div>
                  </a>
                )}
                {report === null ? null : (
                  <Link href={`/scan/${report}`} className={CARD}>
                    <div className={BODY}>
                      <span className={EYEBROW}>{copy("about.proof.report")}</span>
                      <span className="num font-semibold">{report}</span>
                      <span className={LINK}>
                        {copy("about.proof.open")}
                        <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
                      </span>
                    </div>
                  </Link>
                )}
              </div>
            )}
          </section>

          <section id="contact" aria-labelledby="contact-h" className={`${CARD} scroll-mt-16`}>
            <div className={BODY}>
              <h2 id="contact-h">{copy("about.contact.title")}</h2>
              <p className="flex flex-wrap gap-x-1">
                <span>{copy("about.contact.lead")}</span>
                <a href={`mailto:${address}`} className="link link-primary">
                  {address}
                </a>
              </p>
            </div>
          </section>

          <LearnClose variant="about" />
        </article>
      </main>
    </Surface>
  );
}
