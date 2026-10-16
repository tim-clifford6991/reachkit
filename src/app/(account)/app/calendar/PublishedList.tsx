// SPEC §4 (owner, 2026-10-15, issue 1457) — every page published, the rows
// Overview's Content tile counts.
//
// The tile and this list read the one selector (`../_overview/content.ts`),
// so the total is this list's length and "in the last 4 weeks" is its
// marked rows. A daisyUI card and a plain list; titles wrap, nothing is
// clamped.
import type React from "react";
import { CONTENT_RECENT_WEEKS } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { formatCount, formatDate } from "../_shell/format";
import type { ContentModel } from "../_overview/content";

/** The anchor Overview's Content tile opens. */
export const PUBLISHED_ID = "published";

export function PublishedList(p: { content: ContentModel | null; timeZone: string }): React.JSX.Element | null {
  if (p.content === null) return null;
  const recent = new Set(p.content.recent.map((page) => page.id));
  return (
    <section
      id={PUBLISHED_ID}
      className="card card-border min-w-0 scroll-mt-32 bg-base-100"
      data-testid="plan-published"
    >
      <div className="card-body gap-3 p-4">
        <h2 className="card-title text-base!">{copy("calendar.published.title")}</h2>
        {p.content.pages.length === 0 ? (
          <p className="text-sm text-base-content/70">{copy("calendar.published.none")}</p>
        ) : (
          <>
            <p className="text-xs text-base-content/70">
              {copy("calendar.published.count", {
                total: formatCount(p.content.pages.length),
                recent: formatCount(p.content.recent.length),
                weeks: formatCount(CONTENT_RECENT_WEEKS),
              })}
            </p>
            <ul className="flex min-w-0 flex-col" aria-label={copy("calendar.published.title")}>
              {p.content.pages.map((page) => (
                <li
                  key={page.id}
                  className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-base-300 py-2"
                  data-testid="plan-published-row"
                  data-recent={recent.has(page.id) ? "" : undefined}
                >
                  {page.url === null ? (
                    <span className="min-w-0 text-sm break-words">{page.title}</span>
                  ) : (
                    <a href={page.url} className="link link-hover min-w-0 text-sm break-words">
                      {page.title}
                    </a>
                  )}
                  <span className="num text-xs text-base-content/70">{formatDate(page.publishedAt, p.timeZone)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
