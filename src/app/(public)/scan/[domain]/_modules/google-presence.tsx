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
import { ABSENT_FROM_MAX } from "@/lib/config/constants";
import type { PresenceSection } from "@/lib/scan/report";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { RetryPart } from "@/lib/scan/retry";
import { dash, Num } from "../_address/measured";
import { RetryPartControl } from "../_address/retry-part";

/** This card's retry part, bound rather than inline — see
 *  `ai-answers.tsx` for why the sweep requires it. */
const PRESENCE_PART: RetryPart = "presence";

/** A column head, repeated beside its value in the stacked shape and hidden
 *  from `sm` where the real head row takes over (#956). It writes no
 *  sentence of its own — the caller passes the same `presence.absent-from.
 *  column.*` key the `<th>` above it uses. */
function Label(p: { children: React.ReactNode }): React.JSX.Element {
  return <span className="text-base-content/70 text-xs sm:hidden">{p.children}</span>;
}

function Head(p: { right: React.ReactNode; heading?: boolean }): React.JSX.Element {
  // The card's name is an eyebrow (#1068); on the measured card the heading
  // is the finding under it, and on the absent card the name is the heading.
  const Tag = p.heading === true ? "h2" : "p";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Tag className="eyebrow flex items-center gap-2">
        <Search size={14} strokeWidth={1.75} aria-hidden />
        {copy("presence.title")}
      </Tag>
      {p.right}
    </div>
  );
}

export function GooglePresenceCard(p: { section: PresenceSection }): React.JSX.Element {
  const { section } = p;
  // Issue 1309: the list's heading names five only where it holds five.
  const absentTitle = copy(
    section.absentFrom.length === ABSENT_FROM_MAX ? "presence.absent-from.title" : "presence.absent-from.title.short"
  );

  return (
    <section className="card bg-base-100 shadow-(--shadow-card) min-w-0">
      <div className="card-body gap-4">
        <Head
          right={
            <span className="badge badge-soft h-auto py-1 text-xs whitespace-normal">
              {copy("presence.source", { measured: String(section.measuredSearches) })}
            </span>
          }
        />

        {/* REQ-008 c3: the customer's count appears once, on their own bar.
            REQ-092: with no rivals to draw, say so where the bars would be.

            **This wrap no longer scrolls (#956).** It carried
            `overflow-x-auto` for the drawing #943 replaced, whose labels
            were laid out beside the bars and could run wider than the card.
            Since #943 each row is a line of HTML above a bar that is
            `width: 100%`, and the domain clamps to its own line — so there
            has been nothing here to scroll to, and an `overflow-x: auto`
            that never scrolls is still a box the layout law has to excuse
            and a tab stop #947 would have to name. `min-w-0` is the half
            that was doing the work, and it stays. */}
        {/* The card's finding, as its heading (#1068): the customer's own
            count as the figure, and one short line under it saying what it
            counts (issue 1444). The competitors' counts are the bars. */}
        <h2 className="flex flex-col gap-1">
          <span className="text-3xl">
            <Num figure>
              {copy("report.figure.of", {
                count: String(section.you.top10Count),
                total: String(section.measuredSearches),
              })}
            </Num>
          </span>
          <span className="text-base font-normal">{copy("presence.finding")}</span>
        </h2>
        {section.framing === "suppressed_no_rivals" ? (
          <p className="grow-0 text-sm">{copy("presence.no-rivals")}</p>
        ) : (
          <div className="min-w-0">
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
        {/* SPEC §2 (owner, 2026-10-07, issue 1328): the card is its finding
            and its bars; the searches open from their own name. */}
        <details className="collapse collapse-arrow border-base-300 border" data-testid="presence-absent-from">
          <summary className="collapse-title">
            <span className="eyebrow">{absentTitle}</span>
          </summary>
          <div className="collapse-content min-w-0">
            {/* **One table, two shapes (#956).** From `sm` it is the three-column
                table it has always been, in the wrap that lets a wide row scroll.
                Below `sm` there is no scroller at all — a column pushed off the
                right edge of one is a column a phone reader never sees, and this
                is the first screen a prospect meets, most often on a phone. The
                row falls instead: the search on its own line, then the volume and
                the holder each on a line of their own, labelled by the column
                head that would have named them. That is #952's shape for the AI
                answers grid, and `docs/DESIGN.md`'s 2026-09-20 rule read for a
                table — "a bar gets its own full-width line under its label".

                **No second DOM.** The head row is `hidden sm:table-header-group`
                and each in-cell label is `sm:hidden`, so every string is written
                once and only one of the two is ever on screen.

                **The cells are subgrid, never `display: contents`** (#952's own
                finding): a `contents` element generates no box, so
                `getBoundingClientRect()` reports it at 0×0 and every value
                inside measures as escaping its parent. A `col-span-2` subgrid
                cell has a real box and still sits in the row's own two columns.

                **Why the holder gets a line and not half of one.** It is a
                domain — one unbreakable token in the mono face, which #256 fixed
                in place by taking `break-words` off `.num`. Sharing a line with
                the volume leaves it about 150px, which is where a fixture domain
                already sits, so it would clamp; and a clamped value in the mono
                face outside a scroller is what `checkNoClippingOrTruncation`
                calls a clipped value, correctly. A full-width line is the box
                changing instead, which is the rule.

                **It keeps #947's tab stop, and keeps it at every width.** From
                `sm` this wrap can still scroll, and a pane that scrolls with no
                way into it from a keyboard is #947's defect returning. An
                attribute cannot be given a breakpoint, so the tab stop stands
                below `sm` too, where the wrap no longer scrolls — and what it
                costs there is one stop on a *named* landmark, which announces
                "5 biggest searches you're absent from" rather than nothing. That
                is the cheaper of the two errors available.

                No market-total footnote follows (owner, 2026-09-03). */}
            <div
              className="min-w-0 sm:overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-label={absentTitle}
            >
              <table className="table table-zebra table-sm">
                <thead className="hidden sm:table-header-group text-base-content/70">
                  <tr>
                    <th className="whitespace-normal">{copy("presence.absent-from.column.search")}</th>
                    <th className="whitespace-normal">{copy("presence.absent-from.column.volume")}</th>
                    <th className="whitespace-normal">{copy("presence.absent-from.column.holder")}</th>
                  </tr>
                </thead>
                <tbody>
                  {section.absentFrom.length === 0 ? (
                    <tr className="grid grid-cols-[auto_minmax(0,1fr)] sm:table-row">
                      <td className="col-span-2 sm:table-cell" colSpan={3}>
                        {copy("presence.absent-from.empty")}
                      </td>
                    </tr>
                  ) : (
                    section.absentFrom.map((row, i) => (
                      <tr
                        key={`${i}-${row.keyword}`}
                        className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 sm:table-row"
                      >
                        <td className="col-span-2 max-sm:border-0 max-sm:pb-1 sm:table-cell">
                          <Num phrase>{row.keyword}</Num>
                        </td>
                        <td className="col-span-2 grid grid-cols-subgrid items-baseline max-sm:border-0 max-sm:py-0 sm:table-cell">
                          <Label>{copy("presence.absent-from.column.volume")}</Label>
                          <Num>{row.volume}</Num>
                        </td>
                        <td className="col-span-2 grid grid-cols-subgrid items-baseline max-sm:border-0 max-sm:pt-0 max-sm:pb-2 sm:table-cell">
                          <Label>{copy("presence.absent-from.column.holder")}</Label>
                          {row.topHolder === null ? (
                            <span className="min-w-0">{copy("place.report.first-page.rival")}</span>
                          ) : (
                            <Num clamp={row.topHolder}>{row.topHolder}</Num>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}

/** REQ-004 c10/c11: named as absent in one written line; the rest of the
 *  report stays usable. */
export function GooglePresenceAbsent(p: { cutOff?: boolean; domain?: CanonicalDomain } = {}): React.JSX.Element {
  return (
    <section className="card bg-base-100 shadow-(--shadow-card) min-w-0">
      <div className="card-body gap-4">
        <Head heading right={<Num unmeasured>{dash()}</Num>} />
        <p className="grow-0 text-sm">{copy("presence.absent")}</p>
        {/* Issue 715: the same control the AI-answers card draws, for the
            same purchase — both cards are counted over the twelve question
            SERPs, so the part either of them is missing is that stage's. */}
        {p.cutOff === true && p.domain !== undefined ? (
          <RetryPartControl domain={p.domain} part={PRESENCE_PART} />
        ) : (
          <div className="card-actions">
            <button type="button" className="btn btn-soft btn-primary btn-sm">
              {copy(p.cutOff === true ? "control.retry-part" : "control.rescan-incomplete")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
