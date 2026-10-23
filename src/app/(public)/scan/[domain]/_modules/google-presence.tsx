// BUILD §4.1 module 2, right card — Google search (board PubReport)
//
// The customer's first-page count over the searches measured, a waffle of
// who is on the first page — one square per search, each row named and
// tallied, the customer's own row last — the biggest search and who is
// first on it, and closed beneath them the searches the customer is missing.
//
// **Rivals are context, never alarms** (`BUILD.md` §2.5): no rival square is
// ever red, and `PresenceSection` has no member a size, a forecast or a
// severity could travel in.
//
// **No market-total footnote** (owner, 2026-09-03): no sum over the
// searches' volumes exists in this file; each listed search carries its own.
//
// daisyUI in the route (DESIGN rule 1): `card`, `table`, `collapse`; the
// waffle is CSS grid (a grid that is not a series); lucide at stroke 1.75.
// A zero is a measurement: the customer's row is drawn with none filled.
import type React from "react";
import { Search } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import type { PresenceSection } from "@/lib/scan/report";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { RetryPart } from "@/lib/scan/retry";
import { dash, Num } from "../_address/measured";
import { RetryPartControl } from "../_address/retry-part";
import { AnswerMatrix, type MatrixRow } from "./ai-answers";

/** This card's retry part, bound rather than inline — see
 *  `ai-answers.tsx` for why the sweep requires it. */
const PRESENCE_PART: RetryPart = "presence";

/** The waffle's root, found by the report's tests. */
export const PRESENCE_WAFFLE_TEST_ID = "presence-waffle";

/** A column head, repeated beside its value in the stacked shape and hidden
 *  from `sm` where the real head row takes over (#956). It writes no
 *  sentence of its own — the caller passes the same `presence.absent-from.
 *  column.*` key the `<th>` above it uses. */
function Label(p: { children: React.ReactNode }): React.JSX.Element {
  return <span className="text-base-content/70 text-xs sm:hidden">{p.children}</span>;
}

function Head(p: { right?: React.ReactNode }): React.JSX.Element {
  // The card's name is its heading, under the section's own (board PubReport).
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <Search size={18} strokeWidth={1.75} aria-hidden />
        {copy("presence.title")}
      </h3>
      {p.right}
    </div>
  );
}

/** A count as the report writes a volume: grouped, in its one locale. */
function volumeOf(n: number): string {
  return n.toLocaleString("en-US");
}

/** One row of the waffle: a square per search measured, filled for each one
 *  this domain is on the first page of, and the tally beside it. */
function waffleRow(name: string, count: number, measured: number, you: boolean): MatrixRow {
  return {
    name,
    you,
    cells: Array.from({ length: measured }, (_, i) => (i < count ? "cited" : "not-cited")),
    count: String(count),
  };
}

/** The biggest search, its volume, and who is first on it, where stored. */
function MostSearched(p: { most: NonNullable<PresenceSection["mostSearched"]> }): React.JSX.Element {
  const slots = { search: p.most.keyword, volume: volumeOf(p.most.volume) };
  return (
    <p className="bg-base-200 rounded-box grow-0 px-3.5 py-3 text-sm" data-testid="presence-most-searched">
      {p.most.topHolder === null
        ? copy("report.google.most.none", slots)
        : copy("report.google.most", { ...slots, holder: p.most.topHolder })}
    </p>
  );
}

export function GooglePresenceCard(p: { section: PresenceSection }): React.JSX.Element {
  const { section } = p;
  const absentTitle = copy("presence.absent-from.title");
  const rows = [
    ...section.rivals.map((rival) => waffleRow(rival.domain, rival.top10Count, section.measuredSearches, false)),
    waffleRow(section.you.domain, section.you.top10Count, section.measuredSearches, true),
  ];

  return (
    <section className="card bg-base-100 shadow-(--shadow-card) min-w-0">
      <div className="card-body gap-4">
        <Head />
        {/* REQ-008 c3: the customer's count appears once as the figure;
            the waffle's own row tallies it beside the competitors'. */}
        <p className="flex grow-0 flex-col gap-1">
          <span className="text-3xl">
            <Num figure>
              {copy("report.figure.of", {
                count: String(section.you.top10Count),
                total: String(section.measuredSearches),
              })}
            </Num>
          </span>
          <span>{copy("presence.finding")}</span>
        </p>
        <p className="grow-0 text-base-content/70 text-sm">
          {copy("presence.source", { measured: String(section.measuredSearches) })}
        </p>
        {section.framing === "suppressed_no_rivals" ? (
          <p className="grow-0 text-sm">{copy("presence.no-rivals")}</p>
        ) : (
          <div className="flex min-w-0 flex-col gap-1">
            <p className="grow-0 text-base-content/70 text-xs">{copy("report.google.waffle")}</p>
            <div className="min-w-0 overflow-x-auto" tabIndex={0} role="region" aria-label={copy("presence.title")}>
              <AnswerMatrix rows={rows} label={copy("presence.title")} testId={PRESENCE_WAFFLE_TEST_ID} />
            </div>
          </div>
        )}
        {section.mostSearched === undefined ? null : <MostSearched most={section.mostSearched} />}
        {/* SPEC §2 (owner, 2026-10-07, issue 1328): the card is its finding
            and its waffle; the searches open from their own name. */}
        <details className="collapse collapse-arrow border-base-300 border" data-testid="presence-absent-from">
          <summary className="collapse-title">
            <span className="eyebrow">{absentTitle}</span>
            <span className="text-base-content/70 ms-2 text-sm">
              <Num>{String(section.absentFrom.length)}</Num>
            </span>
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
                          <Num>{volumeOf(row.volume)}</Num>
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
        <Head right={<Num unmeasured>{dash()}</Num>} />
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
