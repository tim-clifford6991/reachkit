// SPEC §7 (2026-10-10, issue 1391) — the site link map, on Settings ›
// Publishing.
//
// One card, two lists, read off the articles that are live: which of the
// customer's own pages the articles send readers to, and which articles
// stand alone — nothing of theirs links to them, or they link to nothing of
// theirs.
//
// **It states and offers no control**, like *Content we already know
// about*: links are chosen and repaired by ReachKit (a new page links the
// older ones, and the nearest older pages are updated to link it), so there
// is nothing here for the customer to do but see it.
//
// daisyUI in the route: `card`, `list`, `list-row`. lucide at 1.75.
import type React from "react";
import { Waypoints } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import type { LinkMap } from "@/lib/known-content/link-map";

const ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;
const VALUE_BOX = "min-w-0 max-w-full overflow-x-auto";

function readable(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

function aloneLine(article: { linkedFrom: number; linksOut: number }): string {
  if (article.linkedFrom === 0 && article.linksOut === 0) return copy("settings.linkmap.alone.both");
  return copy(article.linkedFrom === 0 ? "settings.linkmap.alone.in" : "settings.linkmap.alone.out");
}

export function LinkMapPanel(p: { map: LinkMap }): React.JSX.Element {
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="settings-link-map">
      <div className="card-body min-w-0 gap-3 p-4">
        <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold">
          <Waypoints {...ICON} size={18} />
          {copy("settings.linkmap.head")}
        </h2>

        {p.map.articles === 0 ? (
          <p className="text-sm text-base-content/70" data-testid="settings-link-map-empty">
            {copy("settings.linkmap.none")}
          </p>
        ) : (
          <>
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="eyebrow">{copy("settings.linkmap.receiving")}</h3>
              {p.map.receiving.length === 0 ? (
                <p className="text-sm text-base-content/70">{copy("settings.linkmap.receiving.none")}</p>
              ) : (
                <ul className="list min-w-0 rounded-box" data-testid="settings-link-map-receiving">
                  {p.map.receiving.map((page) => (
                    <li className="list-row min-w-0 px-0" key={page.url}>
                      <span className={`list-col-grow ${VALUE_BOX}`}>
                        <a className="link link-hover num text-sm" href={page.url} target="_blank" rel="noreferrer">
                          {readable(page.url)}
                        </a>
                      </span>
                      <span className="list-col-wrap min-w-0 text-xs text-base-content/70 wrap-anywhere">
                        {copy(page.articles === 1 ? "settings.linkmap.receiving.one" : "settings.linkmap.receiving.count", {
                          count: String(page.articles),
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="eyebrow">{copy("settings.linkmap.alone")}</h3>
              {p.map.alone.length === 0 ? (
                <p className="text-sm text-base-content/70">{copy("settings.linkmap.alone.none")}</p>
              ) : (
                <ul className="list min-w-0 rounded-box" data-testid="settings-link-map-alone">
                  {p.map.alone.map((article) => (
                    <li className="list-row min-w-0 px-0" key={article.url}>
                      <span className="list-col-grow min-w-0 text-sm wrap-anywhere">
                        <a className="link link-hover" href={article.url} target="_blank" rel="noreferrer">
                          {article.title === "" ? readable(article.url) : article.title}
                        </a>
                      </span>
                      <span className="list-col-wrap min-w-0 text-xs text-base-content/70 wrap-anywhere">
                        {aloneLine(article)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <p className="text-sm text-base-content/70">{copy("settings.linkmap.note")}</p>
      </div>
    </section>
  );
}
