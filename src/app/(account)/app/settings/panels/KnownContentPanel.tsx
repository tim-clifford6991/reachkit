// SPEC §7 (2026-09-20, #928) — "Content we already know about" (`R4-11`).
//
// One card, four numbers and one sentence. The numbers are the index's own
// (`known_content`): the pages ReachKit wrote for this site, the posts on
// their connected WordPress, and the pages the crawl read of their main
// site. The sentence says what the index is for — "Checked before every
// page, so we link to what exists and never write it twice."
//
// **It states counts and offers no control.** Nothing on this card is a
// decision the customer makes: the index is re-read when they connect a
// WordPress and every Monday, and a button to rebuild it would be a second
// way to spend a read on somebody else's host for no answer they could not
// already have. What it is for is trust — they can see the writer knows
// what they already have.
//
// **A site whose index holds nothing says so.** Not three zeroes in a row:
// a founder on their first day has no pages of ours, an unconnected blog
// and a crawl that has run once, and three zeroes read as a broken card
// rather than as a new account.
//
// daisyUI in the route: `collapse`, a fold as the board draws it, one
// `progress` and a list. A blog that was never read says so, never 0.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import type { KnownContentCounts } from "../business-provider";

export function KnownContentPanel(p: { known: KnownContentCounts }): React.JSX.Element {
  const { known } = p;
  const max = known.ours + known.site + (known.wordpress ?? 0);
  return (
    <details className="collapse collapse-arrow card-border min-w-0 bg-base-100" data-testid="settings-known-content">
      <summary className="collapse-title font-semibold">{copy("settings.known.head")}</summary>
      <div className="collapse-content flex min-w-0 flex-col gap-3">
        <p className="text-sm text-base-content/70">{copy("settings.known.note")}</p>
        {known.total === 0 && known.wordpress === null ? (
          <p className="text-sm text-base-content/70" data-testid="settings-known-empty">
            {copy("settings.known.none")}
          </p>
        ) : (
          <>
            <p className="text-sm" data-testid="settings-known-total">
              {copy("settings.known.total", { count: String(known.total) })}
            </p>
            {/* The share we wrote of every page read; a blog not read is not counted. */}
            {max > 0 && (
              <progress className="progress progress-primary w-full" value={known.ours} max={max} aria-hidden data-testid="settings-known-meter" />
            )}
            <ul className="flex min-w-0 flex-col gap-1 text-sm">
              <li data-testid="settings-known-ours">{copy("settings.known.ours", { count: String(known.ours) })}</li>
              <li data-testid="settings-known-site">{copy("settings.known.site", { count: String(known.site) })}</li>
              <li className={known.wordpress === 0 || known.wordpress === null ? "text-base-content/70" : ""} data-testid="settings-known-wordpress">
                {known.wordpress === null
                  ? copy("settings.known.wordpress.unread")
                  : copy("settings.known.wordpress", { count: String(known.wordpress) })}
              </li>
            </ul>
          </>
        )}
      </div>
    </details>
  );
}
