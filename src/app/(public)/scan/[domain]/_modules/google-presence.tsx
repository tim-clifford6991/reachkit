// BUILD §4.1 module 2, right card — Google search
//
// Occupancy over the searches actually measured — the customer's bar in
// the accent, every rival's in neutral grey, each direct-labelled with its
// name and its value — and beneath a divider, the five biggest searches
// the customer is absent from.
//
// **Rivals are context, never alarms** (`BUILD.md` §2.5): no rival bar is
// ever red, and `PresenceSection` has no member a size, a forecast or a
// severity could travel in, so the promise holds by there being nowhere to
// put a violation.
//
// **No market-total footnote.** The owner removed it on 2026-09-03, both
// halves; `PresenceSection` carries no `totalMonthlyVolume` and no sum
// over the selected searches' volumes exists anywhere in this file. The
// `/mo` column of the absent-from table is each listed search's own
// volume, which §4.1 states as a column of that table.
//
// **The occupancy is `PresenceBars`** (issue #352, the approved
// `walk/report` drawing). §2.4's closed inventory owns this drawing, and
// it arrived here as an absent-safe `bars` slot that nothing ever filled —
// so the card drew the same rows by hand out of the registered `Progress`
// instead, which carries **one** tone: every rival's bar was painted in
// the customer's own accent, and §2.5's "rival strength is neutral gray,
// never red — rivals are context, not alarms" held only because the third
// colour it forbids was not the one being spent. `PresenceBars` reads its
// colour from `SERIES_COLOR` by identity and by nothing else, so the
// customer is `--chart-you` and every rival `--chart-rival` by
// construction, and every bar still carries its own name and its own value
// beside it (§2.4: "identity is never colour-alone").
//
// daisyUI in the route (DESIGN rule 1): `card`, `badge`, `table`,
// `divider`, `btn`; the bars are Recharts (#550); lucide at stroke 1.75.
//
// A zero is a measurement: the chart draws it as a hairline stub with the
// `0` written beside it, never as an absent row (§6.6).
import type React from "react";
import { Search } from "lucide-react";
import { PresenceBars } from "@/ui/charts";
import { copy } from "@/lib/presentation/copy";
import type { PresenceSection } from "@/lib/scan/report";
import { dash, Num } from "../_address/measured";

function Head(p: { right: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="card-title text-base-content/70 text-xs tracking-wide uppercase">
        <Search size={16} strokeWidth={1.75} aria-hidden />
        {copy("presence.title")}
      </h2>
      {p.right}
    </div>
  );
}

export function GooglePresenceCard(p: { section: PresenceSection }): React.JSX.Element {
  const { section } = p;

  return (
    <section className="card bg-base-100 border-base-300 border">
      <div className="card-body gap-3">
        <Head
          right={
            <span className="badge badge-ghost h-auto py-1 text-xs whitespace-normal">
              {copy("presence.source")}
            </span>
          }
        />

        {/* REQ-008 c3: the customer's count appears once, on their own bar.
            REQ-092: with no rivals to draw, say so where the bars would be. */}
        {section.framing === "suppressed_no_rivals" ? (
          <p className="grow-0 text-sm">{copy("presence.no-rivals")}</p>
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <PresenceBars
              you={{ name: section.you.domain, value: section.you.top10Count }}
              rivals={section.rivals.map((rival) => ({
                name: rival.domain,
                value: rival.top10Count,
              }))}
              measured={section.measuredSearches}
              label={copy("presence.title")}
            />
          </div>
        )}
        <div className="divider my-0" />

        <p className="text-base-content/60 grow-0 text-xs font-semibold tracking-wide uppercase">
          {copy("presence.absent-from.title")}
        </p>
        {/* The search folds at its spaces; the volume and the holder are
            single values and never fold, so the wrap scrolls at 320. No
            market-total footnote follows (owner, 2026-09-03). */}
        <div className="min-w-0 overflow-x-auto">
          <table className="table table-zebra table-sm">
            <thead>
              <tr>
                <th className="whitespace-normal">{copy("presence.absent-from.column.search")}</th>
                <th className="whitespace-normal">{copy("presence.absent-from.column.volume")}</th>
                <th className="whitespace-normal">{copy("presence.absent-from.column.holder")}</th>
              </tr>
            </thead>
            <tbody>
              {section.absentFrom.length === 0 ? (
                <tr>
                  <td colSpan={3}>{copy("presence.absent-from.empty")}</td>
                </tr>
              ) : (
                section.absentFrom.map((row, i) => (
                  <tr key={`${i}-${row.keyword}`}>
                    <td>
                      <Num phrase>{row.keyword}</Num>
                    </td>
                    <td>
                      <Num>{row.volume}</Num>
                    </td>
                    <td>
                      {row.topHolder === null ? (
                        <span>{copy("place.report.first-page.rival")}</span>
                      ) : (
                        <Num>{row.topHolder}</Num>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/** REQ-004 c10/c11: named as absent in one written line; the rest of the
 *  report stays usable. */
export function GooglePresenceAbsent(): React.JSX.Element {
  return (
    <section className="card bg-base-100 border-base-300 border">
      <div className="card-body gap-3">
        <Head right={<Num unmeasured>{dash()}</Num>} />
        <p className="grow-0 text-sm">{copy("presence.absent")}</p>
        <div className="card-actions">
          <button type="button" className="btn btn-outline btn-primary btn-sm">
            {copy("control.rescan-incomplete")}
          </button>
        </div>
      </div>
    </section>
  );
}
