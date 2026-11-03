// Issue 1458 — an answer page, at the address v2 published. The question
// is the heading, the answer comes before any product is named, then the
// free tiers drawn to one scale, each product's card, where ReachKit fits,
// the questions people ask next, and the sources with their date.
import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarCheck, CircleQuestionMark, Database, RefreshCw, Search, Sparkles, User, Users, Zap } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { CostBars } from "@/ui/charts";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { publicMetadata } from "../../_seo/metadata";
import { JsonLd, articleSchemas, homeCrumb } from "../../_seo/structured";
import { ANSWERS, answerOf, longDate } from "../../_library";
import { BAND, BODY, CARD, LearnClose, LibraryPage, Pick, Tile, WeeklyLoop } from "../../_library/parts";
import { Sources } from "../../_library/sources";

/** Every answer is known at build; any other address is a 404. */
export const dynamicParams = false;

export function generateStaticParams(): { question: string }[] {
  return ANSWERS.map((a) => ({ question: a.slug }));
}

type Params = { params: Promise<{ question: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { question } = await params;
  const a = answerOf(question);
  if (a === undefined) return {};
  return publicMetadata({
    seo: PUBLIC_ROUTE_SEO.answer,
    path: `/answers/${a.slug}`,
    vars: { title: a.title, description: a.description },
  });
}

const PAGE_TEST_ID = "answer";
const SOURCES_ID = "src";
const LABEL = "text-base-content/70 text-xs font-semibold tracking-wide uppercase";
const SMALL = "text-base-content/70 text-sm";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const UNIT_ICONS = [Users, Search, RefreshCw] as const;
const FITS_ICONS = { them: User, us: Sparkles } as const;
const FAQ_ICONS = [CircleQuestionMark, Users, RefreshCw, Sparkles, Search] as const;
const NUMBER = /(\d[\d,.]*)/;

function Eyebrow(p: { children: React.ReactNode }): React.JSX.Element {
  return <span className={LABEL}>{p.children}</span>;
}

/** A limit as the board prints it: the reading face, with each number bold. */
function figure(text: string): React.ReactNode {
  return text.split(NUMBER).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

export default async function AnswerPage({ params }: Params): Promise<React.JSX.Element> {
  const { question } = await params;
  const a = answerOf(question);
  if (a === undefined) notFound();

  return (
    <LibraryPage testId={PAGE_TEST_ID} title={a.title}>
      {/* Issue 1512: the date the page prints. It has no index, so the
          trail is home and the page. */}
      <JsonLd
        blocks={articleSchemas({
          path: `/answers/${a.slug}`,
          headline: a.title,
          modified: a.checked,
          trail: [homeCrumb()],
        })}
      />
      <section className={`${CARD} border-primary/30 border`}>
        <div className={BODY}>
          <span className={`${LABEL} text-primary flex items-center gap-1.5`}>
            <Zap {...ICON} />
            {copy("answers.short")}
          </span>
          <p className="text-base-content text-lg font-semibold">{a.answer}</p>
          <Eyebrow>{a.units.title}</Eyebrow>
          <ol className="grid min-w-0 gap-2 sm:grid-cols-3">
            {a.units.items.map(([head, tail], i) => {
              const Icon = UNIT_ICONS[i % UNIT_ICONS.length]!;
              return (
                <li key={head} className="rounded-box border-base-300 bg-base-100 flex min-w-0 flex-col gap-2 border p-4">
                  <span className="flex items-center gap-2.5">
                    <Tile Icon={Icon} />
                    <span className="badge badge-primary ms-auto font-bold" aria-hidden>
                      {i + 1}
                    </span>
                  </span>
                  <strong className="text-base-content">{head}</strong>
                  <span className={SMALL}>{tail}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
      <p className={`${SMALL} flex flex-wrap items-center gap-x-2`}>
        <CalendarCheck {...ICON} />
        <span>{copy("library.checked", { date: longDate(a.checked) })}</span>
        <a href={`#${SOURCES_ID}`} className="link link-primary inline-flex min-h-11 items-center">
          {copy("library.sources")}
        </a>
      </p>

      <section className={`flex min-w-0 flex-col gap-4 ${BAND}`}>
        <div className="flex min-w-0 flex-col gap-2">
          <h2>{a.tiers.title}</h2>
          <p>{a.tiers.lead}</p>
        </div>
        {a.tiers.charts.map((chart, i) => (
          <figure key={chart.title} className={CARD} aria-label={chart.title}>
            <div className={BODY}>
              <p className="text-base-content flex items-center gap-3 font-bold">
                <Tile Icon={i === 0 ? Users : Search} />
                {chart.title}
              </p>
              <CostBars
                tall
                max={chart.max}
                rows={chart.rows.map((row) => ({
                  name: row.name,
                  note: row.terms,
                  value: figure(row.limit),
                  span: row.amount === null ? null : [0, row.amount],
                  you: row.ours,
                }))}
              />
            </div>
          </figure>
        ))}
        <p className={SMALL}>{a.tiers.caption}</p>
      </section>

      {a.sections.map((section) => (
        <section key={section.heading} className={CARD}>
          <div className={BODY}>
            <div className="flex min-w-0 items-center gap-3">
              <Tile Icon={Database} tone="muted" />
              <h2 className="text-xl">{section.heading}</h2>
            </div>
            <ul className="flex flex-wrap gap-2">
              {section.chips.map((chip) => (
                <li key={chip} className="badge border-base-300 bg-base-100 h-auto py-1">
                  {chip}
                </li>
              ))}
            </ul>
            {section.paragraphs.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </div>
        </section>
      ))}

      <WeeklyLoop
        w={{ title: a.fits.title, lead: a.fits.lead, them: a.fits.them, us: copy("library.close.weekly"), rows: a.fits.rows }}
        icons={FITS_ICONS}
        short
        band
      >
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <Pick
            title={<strong className="text-base-content">{copy("compare.item.pick.them", { name: a.fits.pickThem.name })}</strong>}
            items={a.fits.pickThem.items}
            Icon={Database}
          />
          <Pick title={<strong className="text-base-content">{copy("compare.item.pick.us")}</strong>} items={a.fits.pickUs} Icon={Sparkles} ours />
        </div>
      </WeeklyLoop>

      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="faq-h">
        <h2 id="faq-h">{copy("answers.faq")}</h2>
        {a.faq.map((item, i) => (
          <details key={item.q} className="collapse-arrow rounded-box bg-base-100 collapse shadow-(--shadow-card)">
            <summary className="collapse-title flex min-h-11 items-center gap-3.5 pe-12">
              <Tile Icon={FAQ_ICONS[i % FAQ_ICONS.length]!} />
              <h3 className="min-w-0 flex-1 text-base">{item.q}</h3>
            </summary>
            <div className="collapse-content ps-[4.5rem]">
              <p>{item.a}</p>
            </div>
          </details>
        ))}
      </section>
      <Sources checked={a.checked} sources={a.sources} id={SOURCES_ID} oneLine />
      <LearnClose variant="answer" />
    </LibraryPage>
  );
}
