// SPEC §7 (2026-09-20, #908) · issue #926 — what every page is written from.
//
// **The five are a closed list, and that is the point of the card.** §7:
// "The confirmed business profile … joins the writer's inputs, beside the
// voice, the target search, the facts read from the site and the site's own
// pages. This supersedes the closed seven-member prompt. Every rule about
// facts stands: only passages read from the customer's own site, word for
// word and linked; no invented people, reviews or figures." So the card ends
// on #926's own closing sentence — "Nothing else. We don't use facts from
// anywhere but your site." — which is the promise the list is evidence for.
//
// daisyUI in the route: `card`, `list`, `list-row`, `badge`; no title icon.
// The purpose chips are `badge`s, and their eight words are
// `setup.profile.purpose.*` — the registry already says them.
import type React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { BusinessProfile } from "@/lib/site-profile/business/types";

/** §7's five inputs, in the order it names them. A tuple, so a sixth is a
 *  compile error rather than a sentence nobody noticed was missing — and so
 *  the card cannot quietly stop being the closed list it claims to be. */
const SOURCES: readonly CopyKey[] = [
  "settings.business.source.business",
  "settings.business.source.voice",
  "settings.business.source.search",
  "settings.business.source.facts",
  "settings.business.source.pages",
];

/** The eight purpose words the registry already carries. Keyed by the token
 *  the crawl stores, so a purpose outside the closed set draws no chip
 *  rather than an untranslated token. */
const PURPOSE_COPY: Readonly<Record<string, CopyKey>> = {
  pricing: "setup.profile.purpose.pricing",
  about: "setup.profile.purpose.about",
  features: "setup.profile.purpose.features",
  product: "setup.profile.purpose.product",
  blog: "setup.profile.purpose.blog",
  contact: "setup.profile.purpose.contact",
  legal: "setup.profile.purpose.legal",
  other: "setup.profile.purpose.other",
};

export function WrittenFromPanel(p: { profile: BusinessProfile }): React.JSX.Element {
  return (
    <section
      className="card card-border min-w-0 bg-base-200"
      data-testid="settings-business-written-from"
    >
      <div className="card-body gap-4">
        <h2 className="card-title min-w-0 flex-wrap text-base">
          {copy("settings.business.written-from.title")}
        </h2>

        <ul className="list min-w-0" data-testid="written-from-sources">
          {SOURCES.map((key) => (
            <li className="list-row min-w-0" key={key}>
              <span className="min-w-0 wrap-anywhere">{copy(key)}</span>
            </li>
          ))}
        </ul>

        <p className="text-xs text-base-content/70 wrap-anywhere">
          {copy("settings.business.written-from.closed")}
        </p>

        {p.profile.purposes.length === 0 ? null : (
          <div className="flex min-w-0 flex-col gap-2 border-t border-base-300 pt-4">
            <h3 className="eyebrow">{copy("setup.profile.purposes")}</h3>
            <div className="flex min-w-0 flex-wrap gap-2" data-testid="written-from-purposes">
              {p.profile.purposes
                .filter((entry) => PURPOSE_COPY[entry.purpose] !== undefined)
                .map((entry) => (
                  <span className="badge badge-ghost badge-sm" key={entry.purpose}>
                    {copy(PURPOSE_COPY[entry.purpose] as CopyKey)}
                    <span className="num">{entry.count}</span>
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
