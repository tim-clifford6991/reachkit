// The landing links ReachKit's newest articles. ReachKit publishes on its own
// content host the way it publishes for a customer. Each of the newest three
// is one card that is one plain link in the server's HTML, with the index
// beside them, so the main site carries its weight to the pages it publishes. The list is the stored rows'
// (`_chrome/own-articles.ts`), never typed here.
//
// A server component, streamed behind no skeleton: with no article stored
// there is no band at all, so the page draws nothing while it reads.
import type React from "react";
import { ArrowRight, FileText } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { writePageDate } from "@/lib/publish/render/byline";
import { readOwnArticles } from "../_chrome/own-articles";
import { ARROW_NUDGE, CARD_LIFT } from "@/ui/lift";
import { ARTICLES_SECTION_ID, SECTION_HEADING } from "./sections";

const LABEL_ID = "latest-articles";
const SECTION = "pb-16 lg:pb-24";
const INNER = "mx-auto w-full max-w-6xl px-4";

export async function LatestArticles(): Promise<React.JSX.Element | null> {
  const own = await readOwnArticles();
  if (own === null) return null;
  return (
    <section id={ARTICLES_SECTION_ID} aria-labelledby={LABEL_ID} className={`${SECTION} scroll-mt-16`}>
      <div className={INNER}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="flex flex-col gap-2">
            <h2 id={LABEL_ID} className={`${SECTION_HEADING} m-0`}>
              {copy("landing.articles.heading")}
            </h2>
            <p className="text-base-content/70 text-lg">{copy("landing.articles.sub")}</p>
          </div>
          <a
            href={own.index}
            className="link link-hover link-primary group/all flex min-h-11 items-center gap-1 text-sm font-semibold"
          >
            {copy("landing.articles.all")}
            <ArrowRight
              aria-hidden
              size={14}
              strokeWidth={1.75}
              className="transition-transform duration-200 group-hover/all:translate-x-[3px]"
            />
          </a>
        </div>
        <ul className="mt-9 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {own.latest.map((article) => (
            <li key={article.url} className="min-w-0">
              <a href={article.url} className={`card card-border bg-base-100 h-full min-h-50 gap-3 p-6 ${CARD_LIFT}`}>
                <span className="rounded-field bg-primary/10 text-primary grid size-10 place-items-center">
                  <FileText size={20} strokeWidth={1.75} aria-hidden />
                </span>
                <strong className="line-clamp-3 text-lg font-bold break-words lg:text-xl">{article.title}</strong>
                <time dateTime={article.published.toISOString().slice(0, 10)} className="text-base-content/70 text-sm">
                  {writePageDate(article.published, null)}
                </time>
                <span className="text-primary mt-auto flex items-center gap-1 text-sm font-semibold">
                  {copy("landing.articles.read")}
                  <ArrowRight aria-hidden size={14} strokeWidth={1.75} className={ARROW_NUDGE} />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
