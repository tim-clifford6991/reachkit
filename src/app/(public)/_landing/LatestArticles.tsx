// Issue 1512 — the landing links ReachKit's newest articles.
//
// ReachKit publishes on its own content host the way it publishes for a
// customer. The landing names the newest three by title, each a plain link
// in the server's HTML, and the index beside them, so the main site carries
// its weight to the pages it publishes. The list is the stored rows'
// (`_chrome/own-articles.ts`), never typed here.
//
// A server component, streamed behind no skeleton: with no article stored
// there is no band at all, so the page draws nothing while it reads.
import type React from "react";
import { ArrowRight } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { writePageDate } from "@/lib/publish/render/byline";
import { readOwnArticles } from "../_chrome/own-articles";

const LABEL_ID = "latest-articles";
const SECTION = "pb-16 lg:pb-24";
const INNER = "mx-auto w-full max-w-6xl px-4";

export async function LatestArticles(): Promise<React.JSX.Element | null> {
  const own = await readOwnArticles();
  if (own === null) return null;
  return (
    <section aria-labelledby={LABEL_ID} className={SECTION}>
      <div className={INNER}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id={LABEL_ID}>{copy("landing.articles.heading")}</h2>
          <a
            href={own.index}
            className="link link-hover link-primary group/all flex items-center gap-1 text-sm font-semibold"
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
        <ul className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {own.latest.map((article) => (
            <li key={article.url} className="card card-border bg-base-100 min-w-0">
              <div className="card-body gap-2">
                <a href={article.url} className="link link-hover card-title break-words">
                  {article.title}
                </a>
                <time dateTime={article.published.toISOString().slice(0, 10)} className="text-base-content/70 text-sm">
                  {writePageDate(article.published, null)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
