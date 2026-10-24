// Issue 1458 — an answer page, at the address v2 published. The question
// is the heading, the answer comes before any product is named, then the
// free tiers drawn to one scale, each product's card, where ReachKit fits,
// the questions people ask next, and the sources with their date.
import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarCheck, Check, MessageSquareText, RefreshCw, Search, Users } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { CostBars } from "@/ui/charts";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { publicMetadata } from "../../_seo/metadata";
import { JsonLd, articleSchemas, homeCrumb } from "../../_seo/structured";
import { ANSWERS, answerOf, longDate } from "../../_library";
import { BODY, CARD, LearnClose, LibraryPage, Sources, WeeklyLoop } from "../../_library/parts";

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

const EYEBROW: CopyKey = "answers.eyebrow";
const PAGE_TEST_ID = "answer";
const SOURCES_ID = "src";
const LABEL = "text-base-content/70 text-xs font-semibold tracking-wide uppercase";
const SMALL = "text-base-content/70 text-sm";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const UNIT_ICONS = [Users, Search, RefreshCw] as const;

function Eyebrow(p: { children: React.ReactNode }): React.JSX.Element {
  return <span className={LABEL}>{p.children}</span>;
}

function Pick(p: { title: string; items: readonly string[] }): React.JSX.Element {
  return (
    <div className={CARD}>
      <div className={BODY}>
        <strong>{p.title}</strong>
        <ul className="flex flex-col gap-1">
          {p.items.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Check {...ICON} className="text-success mt-1 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default async function AnswerPage({ params }: Params): Promise<React.JSX.Element> {
  const { question } = await params;
  const a = answerOf(question);
  if (a === undefined) notFound();
  const [first, ...rest] = a.answer;

  return (
    <LibraryPage testId={PAGE_TEST_ID} eyebrow={EYEBROW} title={a.title}>
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
          <Eyebrow>
            <span className="flex items-center gap-1">
              <MessageSquareText {...ICON} />
              {copy("answers.short")}
            </span>
          </Eyebrow>
          <p className="text-lg">{first}</p>
          <Eyebrow>{a.units.title}</Eyebrow>
          <ol className="grid min-w-0 gap-2 sm:grid-cols-3">
            {a.units.items.map(([head, tail], i) => {
              const Icon = UNIT_ICONS[i % UNIT_ICONS.length]!;
              return (
                <li key={head} className="rounded-box bg-base-200 flex min-w-0 flex-col gap-1 p-3">
                  <span className="flex items-center gap-2">
                    <Icon {...ICON} />
                    <span className="badge badge-soft badge-primary badge-sm" aria-hidden>
                      {i + 1}
                    </span>
                  </span>
                  <strong>{head}</strong>
                  <span className={SMALL}>{tail}</span>
                </li>
              );
            })}
          </ol>
          {rest.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      </section>
      <p className={`${SMALL} flex flex-wrap items-center gap-x-2`}>
        <CalendarCheck {...ICON} />
        <span>{copy("library.checked", { date: longDate(a.checked) })}</span>
        <a href={`#${SOURCES_ID}`} className="link">
          {copy("library.sources")}
        </a>
      </p>

      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Eyebrow>{copy("compare.item.table")}</Eyebrow>
          <h2>{a.tiers.title}</h2>
          <p>{a.tiers.lead}</p>
        </div>
        {a.tiers.charts.map((chart) => (
          <figure key={chart.title} className={CARD} aria-label={chart.title}>
            <div className={BODY}>
              <p className="font-semibold">{chart.title}</p>
              <CostBars
                max={chart.max}
                rows={chart.rows.map((row) => ({
                  name: row.name,
                  note: row.terms,
                  value: row.limit,
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
            <h2>{section.heading}</h2>
            <ul className="flex flex-wrap gap-2">
              {section.chips.map((chip) => (
                <li key={chip} className="badge badge-outline">
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

      <section className="flex min-w-0 flex-col gap-4">
        <WeeklyLoop
          w={{
            eyebrow: copy("answers.fits.eyebrow"),
            title: a.fits.title,
            lead: a.fits.lead,
            them: a.fits.them,
            us: copy("library.close.weekly"),
            rows: a.fits.rows,
            detail: { summary: copy("how.detail"), body: a.fits.detail },
          }}
        />
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <Pick title={copy("compare.item.pick.them", { name: a.fits.pickThem.name })} items={a.fits.pickThem.items} />
          <Pick title={copy("compare.item.pick.us")} items={a.fits.pickUs} />
        </div>
      </section>

      <section className={CARD}>
        <div className={BODY}>
          <Eyebrow>{copy("answers.faq.eyebrow")}</Eyebrow>
          <h2>{copy("answers.faq")}</h2>
          {a.faq.map((item) => (
            <div key={item.q} className="flex flex-col gap-1">
              <h3 className="text-base font-semibold">{item.q}</h3>
              <p>{item.a}</p>
            </div>
          ))}
        </div>
      </section>
      <Sources checked={a.checked} sources={a.sources} id={SOURCES_ID} />
      <LearnClose variant="answer" />
    </LibraryPage>
  );
}
