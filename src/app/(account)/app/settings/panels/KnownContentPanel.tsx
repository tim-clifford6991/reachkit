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
// daisyUI in the route: `card`, and the Settings rows (`SettingRow`, #1089).
// No library added, no chart — three
// numbers are three numbers.
import type React from "react";
import { Library } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import type { KnownContentCounts } from "../business-provider";
import { SettingRow } from "./SettingRow";

const ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;

/** The three sources, in the order a reader meets them: what we wrote for
 *  them, what they wrote, and what the crawl read. */
const SOURCES = [
  { key: "ours", label: "settings.known.ours" },
  { key: "wordpress", label: "settings.known.wordpress" },
  { key: "site", label: "settings.known.site" },
] as const satisfies readonly { key: keyof KnownContentCounts; label: Parameters<typeof copy>[0] }[];

export function KnownContentPanel(p: { known: KnownContentCounts }): React.JSX.Element {
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="settings-known-content">
      <div className="card-body min-w-0 gap-3 p-4">
        <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold">
          <Library {...ICON} size={18} />
          {copy("settings.known.head")}
        </h2>

        {p.known.total === 0 ? (
          <p className="text-sm text-base-content/70" data-testid="settings-known-empty">
            {copy("settings.known.none")}
          </p>
        ) : (
          <>
            <p className="text-sm text-base-content/70" data-testid="settings-known-total">
              {copy("settings.known.total", { count: String(p.known.total) })}
            </p>
            {/* The settable-row shape every Settings tab draws (#1089): the
                source at the near edge, its count at the far one. */}
            <div className="flex min-w-0 flex-col">
              {SOURCES.map((source) => (
                <SettingRow key={source.key} name={copy(source.label)} testId={`settings-known-${source.key}`}>
                  <span className="figure">{p.known[source.key]}</span>
                </SettingRow>
              ))}
            </div>
          </>
        )}

        <p className="text-sm text-base-content/70">{copy("settings.known.note")}</p>
      </div>
    </section>
  );
}
