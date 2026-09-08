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
// The occupancy bars are the registered `Progress` component, not a chart
// module: `BUILD.md` §2.4's closed inventory owns `PresenceBars` (issue
// #11), which arrives here as a named, absent-safe `bars` slot. With the
// slot empty the same figures are still stated in writing beside each
// name, so nothing this card claims depends on the drawing.
import type React from "react";
import { Badge, Card, Divider, Progress, Table } from "@/ui/components";
import { CardHead } from "@/ui/idiom";
import { copy } from "@/lib/presentation/copy";
import type { PresenceSection } from "@/lib/scan/report";
import { Num, ratio } from "../_address/measured";

/** One direct-labelled bar: name, bar, value. The two-series colouring
 *  §2.4 fixes — `--chart-you` for the customer, `--chart-rival` for
 *  everyone else — belongs to `PresenceBars` (issue #11) and is not
 *  forced onto the registered `Progress`, which carries one tone. Until
 *  that slot is filled the identity is carried by the label, which is
 *  what §2.4 requires of it anyway. */
function OccupancyRow(p: {
  domain: string;
  count: number;
  measured: number;
}): React.JSX.Element {
  return (
    // `minmax(0, …)` on the tracks that hold text is load-bearing, the same
    // way `BUILD.md` §4.6 says it is for the calendar grid: an `auto` or
    // `1fr` track refuses to narrow below its content, so one long domain
    // pushes the whole document sideways at the compact band instead of
    // wrapping inside its own column.
    // At and above `--breakpoint-lg` the domain track is `max-content`:
    // the card has the room there, and a capped track was clipping
    // `rival-one.examp…` inside its own scroll wrap at 1024 and 1280
    // (issue #307). Below it the cap and the wrap stay — that band has
    // genuinely less width than the three columns need, and scrolling is
    // the honest answer rather than a track that squeezes the bar to a
    // sliver. The bar keeps a floor either way, because a bar whose whole
    // job is a length cannot be allowed to collapse.
    <div className="grid grid-cols-[minmax(3rem,8rem)_minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[max-content_minmax(4rem,1fr)_auto]">
      {/* The domain's track is capped at 8rem so one long name cannot push
          the row's bar and ratio off the card — and a domain is a value, so
          it is never broken mid-word to fit (`.num` in `src/ui/type.css`,
          issue #256). Both hold at once because the cell is a declared
          scroll container: ADR-093's "content fits its box **or the box
          changes**", and `overflow-x-auto` is how this design system
          changes it — the wrap every registered `Table` carries, and the
          first row of the layout sweep's scroll-container allow-list.
          `rival-three.example.org` needs 136px in a 128px track, which is
          the eight pixels this reaches. */}
      {/* `whitespace-nowrap` completes it (issue #244). `.num` bans
          breaking *inside* a word, and a hyphen is not inside one: it is
          a soft wrap opportunity the line-breaking algorithm is entitled
          to take, so `rival-one.example.net` still came apart as `rival-`
          / `one.example.net` — 168px of value on two lines in a 120px
          box, at every width. Same defect, one boundary further out. It
          is stated on this cell rather than on `.num` because `.num` also
          carries mono *lines* that hold spaces — a provenance line, a
          search phrase — and those must keep wrapping; a single-token
          value is a property of this cell's content, and this cell is
          already the declared scroll container that lets the box change
          instead. Whether `.num` should ban hyphen breaks for every
          single-token value is #256's question, not this card's. */}
      <div className="min-w-0 overflow-x-auto whitespace-nowrap">
        <Num>{p.domain}</Num>
      </div>
      <Progress value={p.count} max={p.measured} />
      <Num>{ratio(p.count, p.measured)}</Num>
    </div>
  );
}

export function GooglePresenceCard(p: {
  section: PresenceSection;
  /** Issue #11's `PresenceBars`. Absent is an absence — every value it
   *  would draw is written beside its own name below. */
  bars?: React.ReactNode;
}): React.JSX.Element {
  const { section } = p;

  return (
    <Card
      state="default"
      title={
        <CardHead
          eyebrow={copy("presence.title")}
          pill={<Badge tone="neutral">{copy("presence.source")}</Badge>}
        />
      }
    >
      <p>
        {copy("presence.occupancy", {
          you: String(section.you.top10Count),
          measured: String(section.measuredSearches),
        })}
      </p>

      {p.bars}

      {section.framing === "suppressed_no_rivals" ? (
        <p>{copy("presence.no-rivals")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <OccupancyRow
            domain={section.you.domain}
            count={section.you.top10Count}
            measured={section.measuredSearches}
          />
          {section.rivals.map((rival) => (
            <OccupancyRow
              key={rival.domain}
              domain={rival.domain}
              count={rival.top10Count}
              measured={section.measuredSearches}
            />
          ))}
        </div>
      )}
      <p className="text-xs opacity-60">{copy("presence.legend")}</p>

      <Divider />

      <h3>{copy("presence.absent-from.title")}</h3>
      {/* The three columns, sized rather than left to chance (issue #307).
          The card is half the report's width at 1024 and 1280, and three
          mono columns that could none of them fold added up to more than
          it had: the wrap scrolled and the rival column was clipped
          mid-domain (`rival-one.example.n…`).

          The volume is a count and the holder is a domain — both single
          values, and both end up exactly as wide as they need, because a
          value never folds and the auto table algorithm therefore cannot
          make them narrower. The search is the one column that is
          language: §2.3 puts a query in the mono face, and a query is
          several words, so it folds at its spaces (`Num`'s `phrase`) and
          takes whatever is left.

          **Pinning the two value columns to `max-content` is what broke
          it**, and the first attempt here did exactly that: a pinned
          column takes its *header's* width too, so the volume column —
          whose numbers are 32px wide — was held at 119px by an unwritten
          `TODO(copy)` header, and the table came to 455px in a 430px card
          at 1024. Unpinned, with a header that may fold and a query that
          may fold, the same three columns settle at 380px. The layout
          algorithm was already able to do this; what it needed was to be
          allowed to.

          At the compact band the sum still exceeds the card, and the
          registered `Table`'s own `overflow-x-auto` carries it — which is
          the right answer there and the reason this needed no media
          query. */}
      <Table
        zebra
        columns={[
          { key: "search", header: copy("presence.absent-from.column.search") },
          { key: "volume", header: copy("presence.absent-from.column.volume") },
          { key: "holder", header: copy("presence.absent-from.column.holder") },
        ]}
        rows={section.absentFrom.map((row) => ({
          search: <Num phrase>{row.keyword}</Num>,
          volume: <Num>{row.volume}</Num>,
          holder: row.topHolder === null ? <span>{copy("place.report.first-page.rival")}</span> : <Num>{row.topHolder}</Num>,
        }))}
        emptyMessage={copy("presence.absent-from.empty")}
      />
    </Card>
  );
}

/** REQ-004 c10/c11: named as absent in one written line; the rest of the
 *  report stays usable. */
export function GooglePresenceAbsent(): React.JSX.Element {
  return <Card state="degraded" title={<CardHead eyebrow={copy("presence.title")} />} degradedLine={copy("presence.absent")} />;
}
