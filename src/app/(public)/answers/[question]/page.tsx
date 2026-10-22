// Issue 1458 — an answer page, at the address v2 published. The question
// is the heading, the answer comes before any product is named, then the
// detail, the questions people ask next, and the sources with their date.
import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { publicMetadata } from "../../_seo/metadata";
import { JsonLd, articleSchemas, homeCrumb } from "../../_seo/structured";
import { ANSWERS, answerOf } from "../../_library";
import { BODY, CARD, LearnClose, LearnLoop, LibraryPage, Sources, TextCard } from "../../_library/parts";

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

export default async function AnswerPage({ params }: Params): Promise<React.JSX.Element> {
  const { question } = await params;
  const a = answerOf(question);
  if (a === undefined) notFound();

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
      {a.answer.map((text, i) => (
        <p key={text} className={i === 0 ? "text-lg" : undefined}>
          {text}
        </p>
      ))}
      {a.sections.map((section) => (
        <TextCard key={section.heading} heading={section.heading} paragraphs={section.paragraphs} />
      ))}
      <LearnLoop />
      <section className={CARD}>
        <div className={BODY}>
          <h2>{copy("answers.faq")}</h2>
          {a.faq.map((item) => (
            <div key={item.q} className="flex flex-col gap-1">
              <h3 className="text-base font-semibold">{item.q}</h3>
              <p>{item.a}</p>
            </div>
          ))}
        </div>
      </section>
      <LearnClose variant="answer" />
      <Sources checked={a.checked} sources={a.sources} />
    </LibraryPage>
  );
}
